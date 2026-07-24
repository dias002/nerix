import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, LOCAL_USER_PUBLIC_ID, toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import type { CreateProjectInput, ProjectRecord, ProjectStatus, ProjectType, UpdateProjectInput } from "./project.types.js";

export interface ProjectRepository {
  listByUser(userId: string): Promise<ProjectRecord[]>;
  create(input: CreateProjectInput): Promise<ProjectRecord | null>;
  update(userId: string, projectId: string, input: UpdateProjectInput): Promise<ProjectRecord | null>;
  delete(userId: string, projectId: string): Promise<boolean>;
}

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, ProjectRecord>();

  async listByUser(userId: string) {
    return [...this.projects.values()]
      .filter((project) => project.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(cloneProject);
  }

  async create(input: CreateProjectInput) {
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: randomUUID(),
      userId: input.userId,
      title: input.title,
      description: input.description ?? "",
      projectType: input.projectType ?? "general",
      status: input.status ?? "planned",
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    this.projects.set(project.id, project);
    return cloneProject(project);
  }

  async update(userId: string, projectId: string, input: UpdateProjectInput) {
    const project = this.projects.get(projectId);
    if (!project || project.userId !== userId) return null;

    const updated: ProjectRecord = {
      ...project,
      title: input.title ?? project.title,
      description: input.description ?? project.description,
      projectType: input.projectType ?? project.projectType,
      status: input.status ?? project.status,
      metadata: input.metadata ?? project.metadata,
      updatedAt: new Date().toISOString(),
    };
    this.projects.set(project.id, updated);
    return cloneProject(updated);
  }

  async delete(userId: string, projectId: string) {
    const project = this.projects.get(projectId);
    if (!project || project.userId !== userId) return false;
    this.projects.delete(projectId);
    return true;
  }
}

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  project_type: string;
  status: string;
  metadata: Record<string, unknown> | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export class PostgresProjectRepository implements ProjectRepository {
  constructor(private readonly database: DatabaseClient) {}

  async listByUser(userId: string) {
    const databaseUserId = await this.ensureUser(userId);
    if (!databaseUserId) return [];

    const result = await this.database.query<ProjectRow>(
      `
        select
          id,
          user_id,
          name,
          description,
          project_type,
          status,
          metadata,
          created_at,
          updated_at
        from user_projects
        where user_id = $1
        order by updated_at desc
      `,
      [databaseUserId]
    );

    return result.rows.map(mapProjectRow);
  }

  async create(input: CreateProjectInput) {
    const databaseUserId = await this.ensureUser(input.userId);
    if (!databaseUserId) return null;

    const result = await this.database.query<ProjectRow>(
      `
        insert into user_projects (
          user_id,
          name,
          description,
          project_type,
          status,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6::jsonb)
        returning
          id,
          user_id,
          name,
          description,
          project_type,
          status,
          metadata,
          created_at,
          updated_at
      `,
      [
        databaseUserId,
        input.title,
        input.description ?? "",
        input.projectType ?? "general",
        input.status ?? "planned",
        JSON.stringify(input.metadata ?? {}),
      ]
    );

    return result.rows[0] ? mapProjectRow(result.rows[0]) : null;
  }

  async update(userId: string, projectId: string, input: UpdateProjectInput) {
    const databaseUserId = await this.ensureUser(userId);
    if (!databaseUserId) return null;

    const currentResult = await this.database.query<ProjectRow>(
      `
        select
          id,
          user_id,
          name,
          description,
          project_type,
          status,
          metadata,
          created_at,
          updated_at
        from user_projects
        where id = $1 and user_id = $2
        limit 1
      `,
      [projectId, databaseUserId]
    );
    const current = currentResult.rows[0];
    if (!current) return null;

    const result = await this.database.query<ProjectRow>(
      `
        update user_projects
        set
          name = $3,
          description = $4,
          project_type = $5,
          status = $6,
          metadata = $7::jsonb,
          updated_at = now()
        where id = $1 and user_id = $2
        returning
          id,
          user_id,
          name,
          description,
          project_type,
          status,
          metadata,
          created_at,
          updated_at
      `,
      [
        projectId,
        databaseUserId,
        input.title ?? current.name,
        input.description ?? current.description,
        input.projectType ?? current.project_type,
        input.status ?? current.status,
        JSON.stringify(input.metadata ?? readMetadata(current.metadata)),
      ]
    );

    return result.rows[0] ? mapProjectRow(result.rows[0]) : null;
  }

  async delete(userId: string, projectId: string) {
    const databaseUserId = await this.ensureUser(userId);
    if (!databaseUserId) return false;

    const result = await this.database.query(
      `
        delete from user_projects
        where id = $1 and user_id = $2
      `,
      [projectId, databaseUserId]
    );

    return result.rowCount > 0;
  }

  private async ensureUser(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    if (userId === LOCAL_USER_PUBLIC_ID) {
      await ensureLocalUser(this.database);
    }

    return databaseUserId;
  }
}

function mapProjectRow(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    title: row.name,
    description: row.description,
    projectType: normalizeProjectType(row.project_type),
    status: normalizeStatus(row.status),
    metadata: readMetadata(row.metadata),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function cloneProject(project: ProjectRecord): ProjectRecord {
  return {
    ...project,
    metadata: { ...project.metadata },
  };
}

function normalizeStatus(value: string): ProjectStatus {
  if (value === "active" || value === "done") return value;
  return "planned";
}

function normalizeProjectType(value: string): ProjectType {
  if (value === "content" || value === "marketing" || value === "development" || value === "research") return value;
  return "general";
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
