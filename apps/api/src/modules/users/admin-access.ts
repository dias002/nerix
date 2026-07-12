import { config } from "../../config.js";
import type { DatabaseClient } from "../../database/index.js";

export const ownerEntitlementCredits = 50_000;
export const ownerEntitlementReferenceId = "owner-full-access";

const builtInOwnerEmails = ["dias.sunnatilla@gmail.com"];

export function isAdminEmail(email: string | null | undefined) {
  return isOwnerEmail(email) || configuredAdminEmails().has(normalizeEmail(email));
}

export function isOwnerEmail(email: string | null | undefined) {
  return builtInOwnerEmails.includes(normalizeEmail(email));
}

export async function ensureOwnerAccountEntitlements(client: DatabaseClient, databaseUserId: string) {
  await ensureOwnerSubscription(client, databaseUserId);
  await ensureOwnerWalletCredits(client, databaseUserId);
}

export async function ensureOwnerSubscription(client: DatabaseClient, databaseUserId: string) {
  const owner = await findOwnerUser(client, databaseUserId);
  if (!owner) return;

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

  const country = owner.countryCode === "RU" ? "RU" : "KZ";
  const provider = country === "RU" ? "yookassa" : "kaspi";
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setUTCFullYear(now.getUTCFullYear() + 20);

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

export async function ensureOwnerWalletCredits(client: DatabaseClient, databaseUserId: string) {
  const owner = await findOwnerUser(client, databaseUserId);
  if (!owner) return;

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
  const ownerEntitlementLedger = await client.query<{ id: string }>(
    `
      select id
      from ledger_entries
      where wallet_id = $1
        and reference_type = 'owner_entitlement'
        and reference_id = $2
      limit 1
    `,
    [row.id, ownerEntitlementReferenceId]
  );
  const hasOwnerEntitlement = Boolean(ownerEntitlementLedger.rows[0]);

  if (availableCredits === ownerEntitlementCredits) return;
  if (availableCredits > ownerEntitlementCredits && !hasOwnerEntitlement) return;

  const nextAvailableCredits = ownerEntitlementCredits;
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
      values ($1, $2, $3, $4, 'owner_entitlement', $5, $6::jsonb)
    `,
    [
      row.id,
      ledgerType,
      amountCredits,
      nextAvailableCredits,
      ownerEntitlementReferenceId,
      JSON.stringify({
        email: owner.email,
        source: "built_in_owner_entitlement",
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

async function findOwnerUser(client: DatabaseClient, databaseUserId: string) {
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
  if (!isOwnerEmail(user?.email)) return null;

  return {
    email: user.email ?? "",
    countryCode: user.country_code ?? "KZ",
  };
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}
