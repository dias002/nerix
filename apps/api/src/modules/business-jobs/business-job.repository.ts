import { randomUUID } from "node:crypto";
import type { AiTaskType } from "@nomduchat/shared";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, LOCAL_USER_PUBLIC_ID, toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import type { BusinessJobCapability, BusinessJobChannel, BusinessJobRecord } from "./business-job.types.js";

type CreateBusinessJobInput = {
  workspaceId: string;
  createdByUserId: string;
  channel: BusinessJobChannel;
  capability: BusinessJobCapability;
  taskType: AiTaskType;
  payload: Record<string, unknown>;
};

export interface BusinessJobRepository {
  listByWorkspaceId(workspaceId: string): Promise<BusinessJobRecord[]>;
  getById(workspaceId: string, jobId: string): Promise<BusinessJobRecord | null>;
  create(input: CreateBusinessJobInput): Promise<BusinessJobRecord>;
  markRunning(workspaceId: string, jobId: string): Promise<BusinessJobRecord | null>;
  markSucceeded(
    workspaceId: string,
    jobId: string,
    input: { result: Record<string, unknown>; provider?: string | null; model?: string | null }
  ): Promise<BusinessJobRecord | null>;
  markFailed(workspaceId: string, jobId: string, errorMessage: string): Promise<BusinessJobRecord | null>;
  cancel(workspaceId: string, jobId: string): Promise<BusinessJobRecord | null>;
}

export class InMemoryBusinessJobRepository implements BusinessJobRepository {
  private readonly jobs = new Map<string, BusinessJobRecord>();

  async listByWorkspaceId(workspaceId: string) {
    return [...this.jobs.values()]
      .filter((job) => job.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(cloneJob);
  }

  async getById(workspaceId: string, jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.workspaceId !== workspaceId) return null;
    return cloneJob(job);
  }

  async create(input: CreateBusinessJobInput) {
    const now = new Date().toISOString();
    const job: BusinessJobRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      createdByUserId: input.createdByUserId,
      channel: input.channel,
      capability: input.capability,
      taskType: input.taskType,
      status: "queued",
      payload: structuredClone(input.payload),
      result: null,
      provider: null,
      model: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
    };
    this.jobs.set(job.id, job);
    return cloneJob(job);
  }

  async markRunning(workspaceId: string, jobId: string) {
    const current = this.jobs.get(jobId);
    if (!current || current.workspaceId !== workspaceId) return null;

    const now = new Date().toISOString();
    const updated: BusinessJobRecord = {
      ...current,
      status: "running",
      startedAt: current.startedAt ?? now,
      updatedAt: now,
    };
    this.jobs.set(jobId, updated);
    return cloneJob(updated);
  }

  async markSucceeded(
    workspaceId: string,
    jobId: string,
    input: { result: Record<string, unknown>; provider?: string | null; model?: string | null }
  ) {
    const current = this.jobs.get(jobId);
    if (!current || current.workspaceId !== workspaceId) return null;

    const now = new Date().toISOString();
    const updated: BusinessJobRecord = {
      ...current,
      status: "succeeded",
      result: structuredClone(input.result),
      provider: input.provider ?? current.provider,
      model: input.model ?? current.model,
      errorMessage: null,
      updatedAt: now,
      startedAt: current.startedAt ?? now,
      finishedAt: now,
    };
    this.jobs.set(jobId, updated);
    return cloneJob(updated);
  }

  async markFailed(workspaceId: string, jobId: string, errorMessage: string) {
    const current = this.jobs.get(jobId);
    if (!current || current.workspaceId !== workspaceId) return null;

    const now = new Date().toISOString();
    const updated: BusinessJobRecord = {
      ...current,
      status: "failed",
      errorMessage,
      updatedAt: now,
      startedAt: current.startedAt ?? now,
      finishedAt: now,
    };
    this.jobs.set(jobId, updated);
    return cloneJob(updated);
  }

  async cancel(workspaceId: string, jobId: string) {
    const current = this.jobs.get(jobId);
    if (!current || current.workspaceId !== workspaceId) return null;
    if (current.status === "succeeded" || current.status === "failed" || current.status === "cancelled") {
      return cloneJob(current);
    }

    const now = new Date().toISOString();
    const updated: BusinessJobRecord = {
      ...current,
      status: "cancelled",
      errorMessage: null,
      updatedAt: now,
      finishedAt: now,
    };
    this.jobs.set(jobId, updated);
    return cloneJob(updated);
  }
}

type BusinessJobRow = {
  id: string;
  workspace_id: string;
  created_by_user_id: string | null;
  channel: string;
  capability: string;
  task_type: string;
  status: string;
  payload: Record<string, unknown> | string;
  result: Record<string, unknown> | string | null;
  provider: string | null;
  model: string | null;
  error_message: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: Date | string | null;
  finished_at: Date | string | null;
} & Record<string, unknown>;

export class PostgresBusinessJobRepository implements BusinessJobRepository {
  constructor(private readonly database: DatabaseClient) {}

  async listByWorkspaceId(workspaceId: string) {
    const result = await this.database.query<BusinessJobRow>(
      `
        select
          id,
          workspace_id,
          created_by_user_id,
          channel,
          capability,
          task_type,
          status,
          payload,
          result,
          provider,
          model,
          error_message,
          created_at,
          updated_at,
          started_at,
          finished_at
        from business_jobs
        where workspace_id = $1
        order by created_at desc
      `,
      [workspaceId]
    );

    return result.rows.map(mapBusinessJobRow);
  }

  async getById(workspaceId: string, jobId: string) {
    const result = await this.database.query<BusinessJobRow>(
      `
        select
          id,
          workspace_id,
          created_by_user_id,
          channel,
          capability,
          task_type,
          status,
          payload,
          result,
          provider,
          model,
          error_message,
          created_at,
          updated_at,
          started_at,
          finished_at
        from business_jobs
        where workspace_id = $1 and id = $2
        limit 1
      `,
      [workspaceId, jobId]
    );

    return result.rows[0] ? mapBusinessJobRow(result.rows[0]) : null;
  }

  async create(input: CreateBusinessJobInput) {
    const databaseUserId = await ensureUser(this.database, input.createdByUserId);
    const result = await this.database.query<BusinessJobRow>(
      `
        insert into business_jobs (
          workspace_id,
          created_by_user_id,
          channel,
          capability,
          task_type,
          status,
          payload
        )
        values ($1, $2, $3, $4, $5, 'queued', $6::jsonb)
        returning
          id,
          workspace_id,
          created_by_user_id,
          channel,
          capability,
          task_type,
          status,
          payload,
          result,
          provider,
          model,
          error_message,
          created_at,
          updated_at,
          started_at,
          finished_at
      `,
      [input.workspaceId, databaseUserId, input.channel, input.capability, input.taskType, JSON.stringify(input.payload)]
    );

    return mapBusinessJobRow(result.rows[0]);
  }

  async markRunning(workspaceId: string, jobId: string) {
    const result = await this.database.query<BusinessJobRow>(
      `
        update business_jobs
        set
          status = 'running',
          started_at = coalesce(started_at, now()),
          updated_at = now()
        where workspace_id = $1 and id = $2
        returning
          id,
          workspace_id,
          created_by_user_id,
          channel,
          capability,
          task_type,
          status,
          payload,
          result,
          provider,
          model,
          error_message,
          created_at,
          updated_at,
          started_at,
          finished_at
      `,
      [workspaceId, jobId]
    );

    return result.rows[0] ? mapBusinessJobRow(result.rows[0]) : null;
  }

  async markSucceeded(
    workspaceId: string,
    jobId: string,
    input: { result: Record<string, unknown>; provider?: string | null; model?: string | null }
  ) {
    const result = await this.database.query<BusinessJobRow>(
      `
        update business_jobs
        set
          status = 'succeeded',
          result = $3::jsonb,
          provider = $4,
          model = $5,
          error_message = null,
          started_at = coalesce(started_at, now()),
          finished_at = now(),
          updated_at = now()
        where workspace_id = $1 and id = $2
        returning
          id,
          workspace_id,
          created_by_user_id,
          channel,
          capability,
          task_type,
          status,
          payload,
          result,
          provider,
          model,
          error_message,
          created_at,
          updated_at,
          started_at,
          finished_at
      `,
      [workspaceId, jobId, JSON.stringify(input.result), input.provider ?? null, input.model ?? null]
    );

    return result.rows[0] ? mapBusinessJobRow(result.rows[0]) : null;
  }

  async markFailed(workspaceId: string, jobId: string, errorMessage: string) {
    const result = await this.database.query<BusinessJobRow>(
      `
        update business_jobs
        set
          status = 'failed',
          error_message = $3,
          started_at = coalesce(started_at, now()),
          finished_at = now(),
          updated_at = now()
        where workspace_id = $1 and id = $2
        returning
          id,
          workspace_id,
          created_by_user_id,
          channel,
          capability,
          task_type,
          status,
          payload,
          result,
          provider,
          model,
          error_message,
          created_at,
          updated_at,
          started_at,
          finished_at
      `,
      [workspaceId, jobId, errorMessage]
    );

    return result.rows[0] ? mapBusinessJobRow(result.rows[0]) : null;
  }

  async cancel(workspaceId: string, jobId: string) {
    const result = await this.database.query<BusinessJobRow>(
      `
        update business_jobs
        set
          status = case
            when status in ('succeeded', 'failed', 'cancelled') then status
            else 'cancelled'
          end,
          error_message = null,
          finished_at = case
            when status in ('succeeded', 'failed', 'cancelled') then finished_at
            else now()
          end,
          updated_at = now()
        where workspace_id = $1 and id = $2
        returning
          id,
          workspace_id,
          created_by_user_id,
          channel,
          capability,
          task_type,
          status,
          payload,
          result,
          provider,
          model,
          error_message,
          created_at,
          updated_at,
          started_at,
          finished_at
      `,
      [workspaceId, jobId]
    );

    return result.rows[0] ? mapBusinessJobRow(result.rows[0]) : null;
  }
}

function cloneJob(job: BusinessJobRecord): BusinessJobRecord {
  return {
    ...job,
    payload: structuredClone(job.payload),
    result: job.result ? structuredClone(job.result) : null,
  };
}

async function ensureUser(database: DatabaseClient, userId: string) {
  const databaseUserId = toDatabaseUserId(userId);
  if (!databaseUserId) return null;

  if (userId === LOCAL_USER_PUBLIC_ID) {
    await ensureLocalUser(database);
  }

  return databaseUserId;
}

function mapBusinessJobRow(row: BusinessJobRow): BusinessJobRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    createdByUserId: row.created_by_user_id ? toPublicUserId(row.created_by_user_id) : null,
    channel: normalizeChannel(row.channel),
    capability: normalizeCapability(row.capability),
    taskType: normalizeTaskType(row.task_type),
    status: normalizeStatus(row.status),
    payload: parseJson(row.payload),
    result: row.result ? parseJson(row.result) : null,
    provider: row.provider,
    model: row.model,
    errorMessage: row.error_message,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    startedAt: row.started_at ? toIso(row.started_at) : null,
    finishedAt: row.finished_at ? toIso(row.finished_at) : null,
  };
}

function normalizeChannel(value: string): BusinessJobChannel {
  if (value === "website" || value === "telegram" || value === "email" || value === "crm" || value === "internal") {
    return value;
  }
  return "internal";
}

function normalizeCapability(value: string): BusinessJobCapability {
  if (
    value === "website_generation" ||
    value === "bot_setup" ||
    value === "campaign_generation" ||
    value === "knowledge_ingest" ||
    value === "workspace_analysis"
  ) {
    return value;
  }
  return "workspace_analysis";
}

function normalizeTaskType(value: string): AiTaskType {
  if (
    value === "chat_reply" ||
    value === "customer_support" ||
    value === "deal_summary" ||
    value === "website_copy" ||
    value === "campaign_copy" ||
    value === "bot_policy" ||
    value === "knowledge_search" ||
    value === "internal_analysis" ||
    value === "code_generation" ||
    value === "media_generation"
  ) {
    return value;
  }
  return "internal_analysis";
}

function normalizeStatus(value: string): BusinessJobRecord["status"] {
  if (value === "queued" || value === "running" || value === "succeeded" || value === "failed" || value === "cancelled") {
    return value;
  }
  return "queued";
}

function parseJson(value: Record<string, unknown> | string) {
  return typeof value === "string" ? (JSON.parse(value) as Record<string, unknown>) : value;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
