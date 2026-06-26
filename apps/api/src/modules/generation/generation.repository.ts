import { randomUUID } from "node:crypto";
import type { AiModality } from "@nomduchat/shared";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import type {
  CreateGenerationJobInput,
  CreateMediaAssetInput,
  MediaGenerationJob,
  MediaGenerationStatus,
  UpdateGenerationJobInput,
  UserMediaAsset,
} from "./generation.types.js";

export interface GenerationRepository {
  createJob(input: CreateGenerationJobInput): Promise<MediaGenerationJob>;
  updateJob(userId: string, jobId: string, input: UpdateGenerationJobInput): Promise<MediaGenerationJob | null>;
  findJob(userId: string, jobId: string): Promise<MediaGenerationJob | null>;
  listJobs(userId: string): Promise<MediaGenerationJob[]>;
  createAsset(input: CreateMediaAssetInput): Promise<UserMediaAsset>;
  listAssets(userId: string): Promise<UserMediaAsset[]>;
}

export class InMemoryGenerationRepository implements GenerationRepository {
  private readonly jobs = new Map<string, MediaGenerationJob>();
  private readonly assets = new Map<string, UserMediaAsset>();

  async createJob(input: CreateGenerationJobInput) {
    const now = new Date().toISOString();
    const job: MediaGenerationJob = {
      id: input.id,
      userId: input.userId,
      agentId: input.agentId,
      modality: input.modality,
      status: "queued",
      prompt: input.prompt,
      provider: input.provider,
      model: input.model,
      reservationId: input.reservationId,
      reservedCredits: input.reservedCredits,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async updateJob(userId: string, jobId: string, input: UpdateGenerationJobInput) {
    const current = this.jobs.get(jobId);
    if (!current || current.userId !== userId) return null;

    const next: MediaGenerationJob = {
      ...current,
      ...definedValues(input),
      metadata: input.metadata ? { ...current.metadata, ...input.metadata } : current.metadata,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, next);
    return next;
  }

  async findJob(userId: string, jobId: string) {
    const job = this.jobs.get(jobId);
    return job && job.userId === userId ? job : null;
  }

  async listJobs(userId: string) {
    return [...this.jobs.values()]
      .filter((job) => job.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createAsset(input: CreateMediaAssetInput) {
    const now = new Date().toISOString();
    const asset: UserMediaAsset = {
      id: randomUUID(),
      userId: input.userId,
      projectId: input.projectId,
      mediaType: input.mediaType,
      title: input.title,
      status: input.status ?? "ready",
      durationSeconds: input.durationSeconds,
      transcript: input.transcript,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.assets.set(asset.id, asset);
    return asset;
  }

  async listAssets(userId: string) {
    return [...this.assets.values()]
      .filter((asset) => asset.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}

type JobRow = {
  id: string;
  user_id: string;
  agent_slug: string | null;
  modality: string;
  status: string;
  prompt: string;
  provider: string | null;
  model: string | null;
  reservation_id: string | null;
  result_url: string | null;
  result_mime_type: string | null;
  reserved_credits: string | number;
  final_credits: string | number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type AssetRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  media_type: string;
  title: string;
  status: string;
  duration_seconds: string | number | null;
  transcript: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

export class PostgresGenerationRepository implements GenerationRepository {
  constructor(private readonly database: DatabaseClient) {}

  async createJob(input: CreateGenerationJobInput) {
    const databaseUserId = toDatabaseUserId(input.userId);
    if (!databaseUserId) {
      throw new Error(`Invalid user id '${input.userId}'.`);
    }

    await ensureLocalUser(this.database);
    const result = await this.database.query<JobRow>(
      `
        with selected_agent as (
          select id
          from agents
          where slug = $3
          limit 1
        ), inserted as (
          insert into generation_jobs (
            id,
            user_id,
            agent_id,
            modality,
            status,
            prompt,
            provider,
            model,
            reserved_credits,
            reservation_id,
            metadata
          )
          values ($1, $2, (select id from selected_agent), $4, 'queued', $5, $6, $7, $8, $9, $10::jsonb)
          returning *
        )
        select ${jobSelectColumns}
        from inserted gj
        left join agents a on a.id = gj.agent_id
      `,
      [
        input.id,
        databaseUserId,
        input.agentId ?? null,
        input.modality,
        input.prompt,
        input.provider,
        input.model,
        input.reservedCredits,
        input.reservationId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );

    return mapJobRow(result.rows[0]);
  }

  async updateJob(userId: string, jobId: string, input: UpdateGenerationJobInput) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    const current = await this.findJob(userId, jobId);
    if (!current) return null;
    const metadata = input.metadata ? { ...current.metadata, ...input.metadata } : current.metadata;

    const result = await this.database.query<JobRow>(
      `
        with updated as (
          update generation_jobs
          set status = coalesce($3, status),
              reservation_id = coalesce($4, reservation_id),
              reserved_credits = coalesce($5, reserved_credits),
              final_credits = coalesce($6, final_credits),
              result_url = coalesce($7, result_url),
              result_mime_type = coalesce($8, result_mime_type),
              error_message = $9,
              metadata = $10::jsonb,
              updated_at = now()
          where id = $1 and user_id = $2
          returning *
        )
        select ${jobSelectColumns}
        from updated gj
        left join agents a on a.id = gj.agent_id
      `,
      [
        jobId,
        databaseUserId,
        input.status ?? null,
        input.reservationId ?? null,
        input.reservedCredits ?? null,
        input.finalCredits ?? null,
        input.resultUrl ?? null,
        input.resultMimeType ?? null,
        input.errorMessage ?? null,
        JSON.stringify(metadata),
      ]
    );

    return result.rows[0] ? mapJobRow(result.rows[0]) : null;
  }

  async findJob(userId: string, jobId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    const result = await this.database.query<JobRow>(
      `
        select ${jobSelectColumns}
        from generation_jobs gj
        left join agents a on a.id = gj.agent_id
        where gj.id = $1 and gj.user_id = $2
        limit 1
      `,
      [jobId, databaseUserId]
    );

    return result.rows[0] ? mapJobRow(result.rows[0]) : null;
  }

  async listJobs(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return [];

    const result = await this.database.query<JobRow>(
      `
        select ${jobSelectColumns}
        from generation_jobs gj
        left join agents a on a.id = gj.agent_id
        where gj.user_id = $1
        order by gj.created_at desc
        limit 50
      `,
      [databaseUserId]
    );

    return result.rows.map(mapJobRow);
  }

  async createAsset(input: CreateMediaAssetInput) {
    const databaseUserId = toDatabaseUserId(input.userId);
    if (!databaseUserId) {
      throw new Error(`Invalid user id '${input.userId}'.`);
    }

    const result = await this.database.query<AssetRow>(
      `
        insert into user_media_assets (
          user_id,
          project_id,
          media_type,
          title,
          status,
          duration_seconds,
          transcript,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        returning id,
                  user_id,
                  project_id,
                  media_type,
                  title,
                  status,
                  duration_seconds,
                  transcript,
                  metadata,
                  created_at,
                  updated_at
      `,
      [
        databaseUserId,
        input.projectId ?? null,
        input.mediaType,
        input.title,
        input.status ?? "ready",
        input.durationSeconds ?? null,
        input.transcript ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );

    return mapAssetRow(result.rows[0]);
  }

  async listAssets(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return [];

    const result = await this.database.query<AssetRow>(
      `
        select id,
               user_id,
               project_id,
               media_type,
               title,
               status,
               duration_seconds,
               transcript,
               metadata,
               created_at,
               updated_at
        from user_media_assets
        where user_id = $1
        order by created_at desc
        limit 50
      `,
      [databaseUserId]
    );

    return result.rows.map(mapAssetRow);
  }
}

const jobSelectColumns = `
  gj.id,
  gj.user_id,
  a.slug as agent_slug,
  gj.modality,
  gj.status,
  gj.prompt,
  gj.provider,
  gj.model,
  gj.reservation_id,
  gj.result_url,
  gj.result_mime_type,
  gj.reserved_credits,
  gj.final_credits,
  gj.error_message,
  gj.metadata,
  gj.created_at,
  gj.updated_at
`;

function mapJobRow(row: JobRow): MediaGenerationJob {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    agentId: row.agent_slug ?? undefined,
    modality: row.modality as AiModality,
    status: row.status as MediaGenerationStatus,
    prompt: row.prompt,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    reservationId: row.reservation_id ?? undefined,
    resultUrl: row.result_url ?? undefined,
    resultMimeType: row.result_mime_type ?? undefined,
    reservedCredits: toNumber(row.reserved_credits),
    finalCredits: row.final_credits === null ? undefined : toNumber(row.final_credits),
    errorMessage: row.error_message ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapAssetRow(row: AssetRow): UserMediaAsset {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    projectId: row.project_id ?? undefined,
    mediaType: row.media_type as AiModality,
    title: row.title,
    status: row.status,
    durationSeconds: row.duration_seconds === null ? undefined : toNumber(row.duration_seconds),
    transcript: row.transcript ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function definedValues<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
