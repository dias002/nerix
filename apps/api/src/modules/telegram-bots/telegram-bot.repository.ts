import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, LOCAL_USER_PUBLIC_ID, toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import type {
  CreateTelegramBotOrderRepositoryInput,
  TelegramBotCountry,
  TelegramBotCurrency,
  TelegramBotOrderRecord,
  TelegramBotOrderStatus,
  TelegramBotTone,
} from "./telegram-bot.types.js";

export interface TelegramBotOrderRepository {
  listByUser(userId: string): Promise<TelegramBotOrderRecord[]>;
  findById(userId: string, orderId: string): Promise<TelegramBotOrderRecord | null>;
  create(input: CreateTelegramBotOrderRepositoryInput): Promise<TelegramBotOrderRecord | null>;
}

export class InMemoryTelegramBotOrderRepository implements TelegramBotOrderRepository {
  private readonly orders = new Map<string, TelegramBotOrderRecord>();

  async listByUser(userId: string) {
    return [...this.orders.values()]
      .filter((order) => order.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((order) => ({ ...order }));
  }

  async findById(userId: string, orderId: string) {
    const order = this.orders.get(orderId);
    return order && order.userId === userId ? { ...order } : null;
  }

  async create(input: CreateTelegramBotOrderRepositoryInput) {
    const now = new Date().toISOString();
    const order: TelegramBotOrderRecord = {
      id: randomUUID(),
      userId: input.userId,
      workspaceId: input.workspaceId,
      country: input.country,
      currency: input.currency,
      amountMinor: input.amountMinor,
      status: input.status,
      companyName: input.companyName,
      ownerName: input.ownerName ?? "",
      contact: input.contact,
      businessDescription: input.businessDescription,
      services: input.services,
      audience: input.audience ?? "",
      botPurpose: input.botPurpose,
      tone: input.tone,
      responseRules: input.responseRules,
      escalationContact: input.escalationContact,
      faq: input.faq ?? "",
      sourceLinks: input.sourceLinks ?? "",
      botUsername: input.botUsername?.trim() || null,
      botTokenProvided: input.botTokenProvided,
      botTokenHint: input.botTokenHint,
      setupSummary: input.setupSummary,
      systemPrompt: input.systemPrompt,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(order.id, order);
    return { ...order };
  }
}

type TelegramBotOrderRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  country: string;
  currency: string;
  amount_minor: string | number;
  status: string;
  company_name: string;
  owner_name: string;
  contact: string;
  business_description: string;
  services: string;
  audience: string;
  bot_purpose: string;
  tone: string;
  response_rules: string;
  escalation_contact: string;
  faq: string;
  source_links: string;
  bot_username: string | null;
  bot_token_provided: boolean;
  bot_token_hint: string | null;
  setup_summary: string;
  system_prompt: string;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

export class PostgresTelegramBotOrderRepository implements TelegramBotOrderRepository {
  constructor(private readonly database: DatabaseClient) {}

  async listByUser(userId: string) {
    const databaseUserId = await this.ensureUser(userId);
    if (!databaseUserId) return [];

    const result = await this.database.query<TelegramBotOrderRow>(
      `
        select
          id,
          user_id,
          workspace_id,
          country,
          currency,
          amount_minor,
          status,
          company_name,
          owner_name,
          contact,
          business_description,
          services,
          audience,
          bot_purpose,
          tone,
          response_rules,
          escalation_contact,
          faq,
          source_links,
          bot_username,
          bot_token_provided,
          bot_token_hint,
          setup_summary,
          system_prompt,
          created_at,
          updated_at
        from telegram_bot_orders
        where user_id = $1
        order by created_at desc
      `,
      [databaseUserId]
    );

    return result.rows.map(mapTelegramBotOrderRow);
  }

  async findById(userId: string, orderId: string) {
    const databaseUserId = await this.ensureUser(userId);
    if (!databaseUserId) return null;

    const result = await this.database.query<TelegramBotOrderRow>(
      `
        select
          id,
          user_id,
          workspace_id,
          country,
          currency,
          amount_minor,
          status,
          company_name,
          owner_name,
          contact,
          business_description,
          services,
          audience,
          bot_purpose,
          tone,
          response_rules,
          escalation_contact,
          faq,
          source_links,
          bot_username,
          bot_token_provided,
          bot_token_hint,
          setup_summary,
          system_prompt,
          created_at,
          updated_at
        from telegram_bot_orders
        where user_id = $1 and id::text = $2
        limit 1
      `,
      [databaseUserId, orderId]
    );

    return result.rows[0] ? mapTelegramBotOrderRow(result.rows[0]) : null;
  }

  async create(input: CreateTelegramBotOrderRepositoryInput) {
    const databaseUserId = await this.ensureUser(input.userId);
    if (!databaseUserId) return null;

    const workspaceId = input.workspaceId ?? (await this.findWorkspaceId(databaseUserId));
    const result = await this.database.query<TelegramBotOrderRow>(
      `
        insert into telegram_bot_orders (
          user_id,
          workspace_id,
          country,
          currency,
          amount_minor,
          status,
          company_name,
          owner_name,
          contact,
          business_description,
          services,
          audience,
          bot_purpose,
          tone,
          response_rules,
          escalation_contact,
          faq,
          source_links,
          bot_username,
          bot_token_provided,
          bot_token_hint,
          setup_summary,
          system_prompt
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23
        )
        returning
          id,
          user_id,
          workspace_id,
          country,
          currency,
          amount_minor,
          status,
          company_name,
          owner_name,
          contact,
          business_description,
          services,
          audience,
          bot_purpose,
          tone,
          response_rules,
          escalation_contact,
          faq,
          source_links,
          bot_username,
          bot_token_provided,
          bot_token_hint,
          setup_summary,
          system_prompt,
          created_at,
          updated_at
      `,
      [
        databaseUserId,
        workspaceId,
        input.country,
        input.currency,
        input.amountMinor,
        input.status,
        input.companyName,
        input.ownerName ?? "",
        input.contact,
        input.businessDescription,
        input.services,
        input.audience ?? "",
        input.botPurpose,
        input.tone,
        input.responseRules,
        input.escalationContact,
        input.faq ?? "",
        input.sourceLinks ?? "",
        input.botUsername?.trim() || null,
        input.botTokenProvided,
        input.botTokenHint,
        input.setupSummary,
        input.systemPrompt,
      ]
    );

    return result.rows[0] ? mapTelegramBotOrderRow(result.rows[0]) : null;
  }

  private async ensureUser(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    if (userId === LOCAL_USER_PUBLIC_ID) {
      await ensureLocalUser(this.database);
    }

    return databaseUserId;
  }

  private async findWorkspaceId(databaseUserId: string) {
    const result = await this.database.query<{ id: string }>(
      `
        select id
        from business_workspaces
        where user_id = $1
        limit 1
      `,
      [databaseUserId]
    );
    return result.rows[0]?.id ?? null;
  }
}

function mapTelegramBotOrderRow(row: TelegramBotOrderRow): TelegramBotOrderRecord {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    workspaceId: row.workspace_id,
    country: normalizeCountry(row.country),
    currency: normalizeCurrency(row.currency),
    amountMinor: Number(row.amount_minor),
    status: normalizeStatus(row.status),
    companyName: row.company_name,
    ownerName: row.owner_name,
    contact: row.contact,
    businessDescription: row.business_description,
    services: row.services,
    audience: row.audience,
    botPurpose: row.bot_purpose,
    tone: normalizeTone(row.tone),
    responseRules: row.response_rules,
    escalationContact: row.escalation_contact,
    faq: row.faq,
    sourceLinks: row.source_links,
    botUsername: row.bot_username,
    botTokenProvided: row.bot_token_provided,
    botTokenHint: row.bot_token_hint,
    setupSummary: row.setup_summary,
    systemPrompt: row.system_prompt,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function normalizeCountry(value: string): TelegramBotCountry {
  return value === "RU" ? "RU" : "KZ";
}

function normalizeCurrency(value: string): TelegramBotCurrency {
  return value === "RUB" ? "RUB" : "KZT";
}

function normalizeStatus(value: string): TelegramBotOrderStatus {
  if (
    value === "draft" ||
    value === "ready_for_payment" ||
    value === "paid" ||
    value === "in_setup" ||
    value === "connected" ||
    value === "cancelled"
  ) {
    return value;
  }
  return "ready_for_payment";
}

function normalizeTone(value: string): TelegramBotTone {
  if (value === "expert" || value === "sales" || value === "strict") return value;
  return "friendly";
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
