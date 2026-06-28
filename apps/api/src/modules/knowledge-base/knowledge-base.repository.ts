import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, LOCAL_USER_PUBLIC_ID, toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import type {
  CreateKnowledgeBaseEntryInput,
  KnowledgeBaseEntryRecord,
  UpdateKnowledgeBaseEntryInput,
} from "./knowledge-base.types.js";

export interface KnowledgeBaseRepository {
  listByWorkspaceId(workspaceId: string): Promise<KnowledgeBaseEntryRecord[]>;
  getById(workspaceId: string, entryId: string): Promise<KnowledgeBaseEntryRecord | null>;
  create(input: {
    workspaceId: string;
    createdByUserId: string;
    entry: CreateKnowledgeBaseEntryInput;
  }): Promise<KnowledgeBaseEntryRecord>;
  update(
    workspaceId: string,
    entryId: string,
    input: UpdateKnowledgeBaseEntryInput
  ): Promise<KnowledgeBaseEntryRecord | null>;
  remove(workspaceId: string, entryId: string): Promise<boolean>;
}

export class InMemoryKnowledgeBaseRepository implements KnowledgeBaseRepository {
  private readonly entries = new Map<string, KnowledgeBaseEntryRecord>();

  async listByWorkspaceId(workspaceId: string) {
    return [...this.entries.values()]
      .filter((entry) => entry.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((entry) => ({ ...entry, tags: [...entry.tags] }));
  }

  async getById(workspaceId: string, entryId: string) {
    const entry = this.entries.get(entryId);
    if (!entry || entry.workspaceId !== workspaceId) return null;
    return { ...entry, tags: [...entry.tags] };
  }

  async create(input: { workspaceId: string; createdByUserId: string; entry: CreateKnowledgeBaseEntryInput }) {
    const now = new Date().toISOString();
    const record: KnowledgeBaseEntryRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      createdByUserId: input.createdByUserId,
      type: input.entry.type,
      title: input.entry.title,
      content: input.entry.content,
      sourceUrl: input.entry.sourceUrl?.trim() || null,
      tags: [...new Set((input.entry.tags ?? []).map((tag) => tag.trim()).filter(Boolean))],
      createdAt: now,
      updatedAt: now,
    };
    this.entries.set(record.id, record);
    return { ...record, tags: [...record.tags] };
  }

  async update(workspaceId: string, entryId: string, input: UpdateKnowledgeBaseEntryInput) {
    const current = this.entries.get(entryId);
    if (!current || current.workspaceId !== workspaceId) return null;

    const updated: KnowledgeBaseEntryRecord = {
      ...current,
      type: input.type ?? current.type,
      title: input.title?.trim() || current.title,
      content: input.content?.trim() || current.content,
      sourceUrl: input.sourceUrl === undefined ? current.sourceUrl : input.sourceUrl.trim() || null,
      tags:
        input.tags === undefined
          ? [...current.tags]
          : [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))],
      updatedAt: new Date().toISOString(),
    };
    this.entries.set(entryId, updated);
    return { ...updated, tags: [...updated.tags] };
  }

  async remove(workspaceId: string, entryId: string) {
    const current = this.entries.get(entryId);
    if (!current || current.workspaceId !== workspaceId) return false;
    this.entries.delete(entryId);
    return true;
  }
}

type KnowledgeBaseEntryRow = {
  id: string;
  workspace_id: string;
  created_by_user_id: string | null;
  type: string;
  title: string;
  content: string;
  source_url: string | null;
  tags: string[] | null;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

export class PostgresKnowledgeBaseRepository implements KnowledgeBaseRepository {
  constructor(private readonly database: DatabaseClient) {}

  async listByWorkspaceId(workspaceId: string) {
    const result = await this.database.query<KnowledgeBaseEntryRow>(
      `
        select
          id,
          workspace_id,
          created_by_user_id,
          type,
          title,
          content,
          source_url,
          tags,
          created_at,
          updated_at
        from workspace_knowledge_entries
        where workspace_id = $1
        order by updated_at desc
      `,
      [workspaceId]
    );

    return result.rows.map(mapKnowledgeBaseEntryRow);
  }

  async getById(workspaceId: string, entryId: string) {
    const result = await this.database.query<KnowledgeBaseEntryRow>(
      `
        select
          id,
          workspace_id,
          created_by_user_id,
          type,
          title,
          content,
          source_url,
          tags,
          created_at,
          updated_at
        from workspace_knowledge_entries
        where workspace_id = $1 and id = $2
        limit 1
      `,
      [workspaceId, entryId]
    );

    return result.rows[0] ? mapKnowledgeBaseEntryRow(result.rows[0]) : null;
  }

  async create(input: { workspaceId: string; createdByUserId: string; entry: CreateKnowledgeBaseEntryInput }) {
    const databaseUserId = await ensureUser(this.database, input.createdByUserId);
    const tags = [...new Set((input.entry.tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
    const result = await this.database.query<KnowledgeBaseEntryRow>(
      `
        insert into workspace_knowledge_entries (
          workspace_id,
          created_by_user_id,
          type,
          title,
          content,
          source_url,
          tags
        )
        values ($1, $2, $3, $4, $5, $6, $7::text[])
        returning
          id,
          workspace_id,
          created_by_user_id,
          type,
          title,
          content,
          source_url,
          tags,
          created_at,
          updated_at
      `,
      [
        input.workspaceId,
        databaseUserId,
        input.entry.type,
        input.entry.title,
        input.entry.content,
        input.entry.sourceUrl?.trim() || null,
        tags,
      ]
    );

    return mapKnowledgeBaseEntryRow(result.rows[0]);
  }

  async update(workspaceId: string, entryId: string, input: UpdateKnowledgeBaseEntryInput) {
    const current = await this.getById(workspaceId, entryId);
    if (!current) return null;

    const result = await this.database.query<KnowledgeBaseEntryRow>(
      `
        update workspace_knowledge_entries
        set
          type = $3,
          title = $4,
          content = $5,
          source_url = $6,
          tags = $7::text[],
          updated_at = now()
        where workspace_id = $1 and id = $2
        returning
          id,
          workspace_id,
          created_by_user_id,
          type,
          title,
          content,
          source_url,
          tags,
          created_at,
          updated_at
      `,
      [
        workspaceId,
        entryId,
        input.type ?? current.type,
        input.title?.trim() || current.title,
        input.content?.trim() || current.content,
        input.sourceUrl === undefined ? current.sourceUrl : input.sourceUrl.trim() || null,
        input.tags === undefined
          ? current.tags
          : [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))],
      ]
    );

    return result.rows[0] ? mapKnowledgeBaseEntryRow(result.rows[0]) : null;
  }

  async remove(workspaceId: string, entryId: string) {
    const result = await this.database.query(
      `
        delete from workspace_knowledge_entries
        where workspace_id = $1 and id = $2
      `,
      [workspaceId, entryId]
    );

    return result.rowCount > 0;
  }
}

async function ensureUser(database: DatabaseClient, userId: string) {
  const databaseUserId = toDatabaseUserId(userId);
  if (!databaseUserId) return null;

  if (userId === LOCAL_USER_PUBLIC_ID) {
    await ensureLocalUser(database);
  }

  return databaseUserId;
}

function mapKnowledgeBaseEntryRow(row: KnowledgeBaseEntryRow): KnowledgeBaseEntryRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    createdByUserId: row.created_by_user_id ? toPublicUserId(row.created_by_user_id) : null,
    type: normalizeType(row.type),
    title: row.title,
    content: row.content,
    sourceUrl: row.source_url,
    tags: row.tags ?? [],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function normalizeType(value: string): KnowledgeBaseEntryRecord["type"] {
  if (
    value === "company_profile" ||
    value === "service" ||
    value === "faq" ||
    value === "policy" ||
    value === "brand_voice" ||
    value === "source_note"
  ) {
    return value;
  }
  return "source_note";
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
