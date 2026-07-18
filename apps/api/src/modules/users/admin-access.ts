import { config } from "../../config.js";
import type { DatabaseClient } from "../../database/index.js";

export const ownerEntitlementCredits = 50_000;
export const ownerEntitlementReferenceId = "owner-full-access";
export const appReviewEntitlementCredits = 50_000;
export const appReviewEntitlementReferenceId = "app-review-full-access";

const builtInOwnerEmails = ["dias.sunnatilla@gmail.com"];
const appReviewEntitlementEmails = ["apple.review@nomduchat.com"];

type Entitlement = {
  credits: number;
  referenceId: string;
  referenceType: string;
  source: string;
  periodYears: number;
  matchesEmail(email: string | null | undefined): boolean;
};

const ownerEntitlement: Entitlement = {
  credits: ownerEntitlementCredits,
  referenceId: ownerEntitlementReferenceId,
  referenceType: "owner_entitlement",
  source: "built_in_owner_entitlement",
  periodYears: 20,
  matchesEmail: isOwnerEmail,
};

const appReviewEntitlement: Entitlement = {
  credits: appReviewEntitlementCredits,
  referenceId: appReviewEntitlementReferenceId,
  referenceType: "app_review_entitlement",
  source: "app_review_full_access",
  periodYears: 1,
  matchesEmail: isAppReviewEntitlementEmail,
};

export function isAdminEmail(email: string | null | undefined) {
  return isOwnerEmail(email) || configuredAdminEmails().has(normalizeEmail(email));
}

export function isOwnerEmail(email: string | null | undefined) {
  return builtInOwnerEmails.includes(normalizeEmail(email));
}

export function isAppReviewEntitlementEmail(email: string | null | undefined) {
  return appReviewEntitlementEmails.includes(normalizeEmail(email));
}

export async function ensureOwnerAccountEntitlements(client: DatabaseClient, databaseUserId: string) {
  await ensureOwnerSubscription(client, databaseUserId);
  await ensureOwnerWalletCredits(client, databaseUserId);
}

export async function ensureOwnerSubscription(client: DatabaseClient, databaseUserId: string) {
  await ensureEntitlementSubscription(client, databaseUserId, ownerEntitlement);
}

export async function ensureOwnerWalletCredits(client: DatabaseClient, databaseUserId: string) {
  await ensureEntitlementWalletCredits(client, databaseUserId, ownerEntitlement);
}

export async function ensureAppReviewAccountEntitlements(client: DatabaseClient, databaseUserId: string) {
  await ensureAppReviewSubscription(client, databaseUserId);
  await ensureAppReviewWalletCredits(client, databaseUserId);
}

export async function ensureAppReviewSubscription(client: DatabaseClient, databaseUserId: string) {
  await ensureEntitlementSubscription(client, databaseUserId, appReviewEntitlement);
}

export async function ensureAppReviewWalletCredits(client: DatabaseClient, databaseUserId: string) {
  await ensureEntitlementWalletCredits(client, databaseUserId, appReviewEntitlement);
}

async function ensureEntitlementSubscription(
  client: DatabaseClient,
  databaseUserId: string,
  entitlement: Entitlement
) {
  const user = await findEntitledUser(client, databaseUserId, entitlement);
  if (!user) return;

  const currentSubscription = await client.query<{ id: string; plan_slug: string }>(
    `
      select id, plan_slug
      from subscriptions
      where user_id = $1 and status = 'active'
      order by created_at desc
      limit 1
    `,
    [databaseUserId]
  );

  if (currentSubscription.rows[0]?.plan_slug === "business") return;

  await client.query(
    `
      update subscriptions
      set status = 'cancelled',
          cancel_at_period_end = true,
          updated_at = now()
      where user_id = $1 and status = 'active'
    `,
    [databaseUserId]
  );

  const country = user.countryCode === "RU" ? "RU" : "KZ";
  const provider = country === "RU" ? "yookassa" : "kaspi";
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setUTCFullYear(now.getUTCFullYear() + entitlement.periodYears);

  await client.query(
    `
      insert into subscriptions (
        user_id,
        plan_slug,
        status,
        country_code,
        provider,
        current_period_start,
        current_period_end
      )
      values ($1, 'business', 'active', $2, $3, $4, $5)
    `,
    [databaseUserId, country, provider, now.toISOString(), periodEnd.toISOString()]
  );
}

async function ensureEntitlementWalletCredits(
  client: DatabaseClient,
  databaseUserId: string,
  entitlement: Entitlement
) {
  const user = await findEntitledUser(client, databaseUserId, entitlement);
  if (!user) return;

  await client.query(
    `
      insert into wallets (user_id, available_credits, reserved_credits, currency)
      values ($1, 0, 0, 'NOMDUCHAT')
      on conflict (user_id, currency) do nothing
    `,
    [databaseUserId]
  );

  const wallet = await client.query<{
    id: string;
    available_credits: string | number;
    reserved_credits: string | number;
  }>(
    `
      select id, available_credits, reserved_credits
      from wallets
      where user_id = $1 and currency = 'NOMDUCHAT'
      limit 1
    `,
    [databaseUserId]
  );

  const row = wallet.rows[0];
  if (!row) return;

  const availableCredits = toNumber(row.available_credits);
  const entitlementLedger = await client.query<{ id: string }>(
    `
      select id
      from ledger_entries
      where wallet_id = $1
        and reference_type = $2
        and reference_id = $3
      limit 1
    `,
    [row.id, entitlement.referenceType, entitlement.referenceId]
  );
  const hasEntitlementLedger = Boolean(entitlementLedger.rows[0]);

  if (availableCredits === entitlement.credits) return;
  if (availableCredits > entitlement.credits && !hasEntitlementLedger) return;

  const nextAvailableCredits = entitlement.credits;
  const amountCredits = nextAvailableCredits - availableCredits;
  const ledgerType = amountCredits >= 0 ? "topup" : "adjustment";

  await client.query(
    `
      update wallets
      set available_credits = $1,
          updated_at = now()
      where id = $2
    `,
    [nextAvailableCredits, row.id]
  );

  await client.query(
    `
      insert into ledger_entries (
        wallet_id,
        type,
        amount_credits,
        balance_after_credits,
        reference_type,
        reference_id,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      row.id,
      ledgerType,
      amountCredits,
      nextAvailableCredits,
      entitlement.referenceType,
      entitlement.referenceId,
      JSON.stringify({
        email: user.email,
        source: entitlement.source,
        previousAvailableCredits: availableCredits,
      }),
    ]
  );
}

function configuredAdminEmails() {
  return new Set(
    config.ADMIN_EMAILS.split(",")
      .map(normalizeEmail)
      .filter(Boolean)
  );
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

async function findEntitledUser(client: DatabaseClient, databaseUserId: string, entitlement: Entitlement) {
  const result = await client.query<{ email: string | null; country_code: string | null }>(
    `
      select email, country_code
      from users
      where id = $1
      limit 1
    `,
    [databaseUserId]
  );

  const user = result.rows[0];
  if (!entitlement.matchesEmail(user?.email)) return null;

  return {
    email: user.email ?? "",
    countryCode: user.country_code ?? "KZ",
  };
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}
