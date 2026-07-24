import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../database/index.js";
import { toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import type { CreateSupportTicketInput, SupportTicketRecord, SupportTicketStatus, SupportTicketTopic } from "./support.types.js";

export interface SupportRepository {
  create(input: CreateSupportTicketInput): Promise<SupportTicketRecord>;
}

export class InMemorySupportRepository implements SupportRepository {
  private readonly tickets = new Map<string, SupportTicketRecord>();

  async create(input: CreateSupportTicketInput) {
    const now = new Date().toISOString();
    const ticket: SupportTicketRecord = {
      id: randomUUID(),
      userId: input.userId ?? null,
      name: input.name ?? null,
      email: input.email,
      topic: input.topic,
      message: input.message,
      status: "open",
      metadata: input.pageUrl ? { pageUrl: input.pageUrl } : {},
      createdAt: now,
      updatedAt: now,
    };
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }
}

type SupportTicketRow = {
  id: string;
  user_id: string | null;
  contact_name: string | null;
  contact_email: string;
  topic: string;
  message: string;
  status: string;
  metadata: Record<string, unknown> | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export class PostgresSupportRepository implements SupportRepository {
  constructor(private readonly database: DatabaseClient) {}

  async create(input: CreateSupportTicketInput) {
    const userId = input.userId ? toDatabaseUserId(input.userId) : null;
    const result = await this.database.query<SupportTicketRow>(
      `
        insert into support_tickets (
          user_id,
          contact_name,
          contact_email,
          topic,
          message,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6::jsonb)
        returning
          id,
          user_id,
          contact_name,
          contact_email,
          topic,
          message,
          status,
          metadata,
          created_at,
          updated_at
      `,
      [
        userId,
        input.name ?? null,
        input.email,
        input.topic,
        input.message,
        JSON.stringify(input.pageUrl ? { pageUrl: input.pageUrl } : {}),
      ]
    );

    return mapTicketRow(result.rows[0]);
  }
}

function mapTicketRow(row: SupportTicketRow): SupportTicketRecord {
  return {
    id: row.id,
    userId: row.user_id ? toPublicUserId(row.user_id) : null,
    name: row.contact_name,
    email: row.contact_email,
    topic: normalizeTopic(row.topic),
    message: row.message,
    status: normalizeStatus(row.status),
    metadata: readMetadata(row.metadata),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function normalizeTopic(value: string): SupportTicketTopic {
  if (value === "billing" || value === "access" || value === "refund" || value === "technical") return value;
  return "other";
}

function normalizeStatus(value: string): SupportTicketStatus {
  return value === "closed" ? "closed" : "open";
}

function readMetadata(value: Record<string, unknown> | string | null | undefined) {
  if (!value) return {};
  if (typeof value !== "string") return value;

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
