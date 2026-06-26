import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, LOCAL_USER_PUBLIC_ID, toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import type {
  BusinessWebsiteContent,
  BusinessWebsiteCountry,
  BusinessWebsiteRecord,
  BusinessWebsiteStatus,
  BusinessWebsiteStyle,
  BusinessWebsiteType,
  CreateBusinessWebsiteRepositoryInput,
  UpdateBusinessWebsiteInput,
} from "./business-website.types.js";

export interface BusinessWebsiteRepository {
  listByUser(userId: string): Promise<BusinessWebsiteRecord[]>;
  getById(userId: string, siteId: string): Promise<BusinessWebsiteRecord | null>;
  getPublishedBySlug(slug: string): Promise<BusinessWebsiteRecord | null>;
  create(input: CreateBusinessWebsiteRepositoryInput): Promise<BusinessWebsiteRecord | null>;
  update(userId: string, siteId: string, input: UpdateBusinessWebsiteInput): Promise<BusinessWebsiteRecord | null>;
  publish(userId: string, siteId: string): Promise<BusinessWebsiteRecord | null>;
}

export class InMemoryBusinessWebsiteRepository implements BusinessWebsiteRepository {
  private readonly sites = new Map<string, BusinessWebsiteRecord>();

  async listByUser(userId: string) {
    return [...this.sites.values()]
      .filter((site) => site.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(cloneSite);
  }

  async getById(userId: string, siteId: string) {
    const site = this.sites.get(siteId);
    if (!site || site.userId !== userId) return null;
    return cloneSite(site);
  }

  async getPublishedBySlug(slug: string) {
    const normalizedSlug = normalizeSlug(slug);
    const site = [...this.sites.values()].find(
      (candidate) => candidate.slug === normalizedSlug && candidate.status === "published"
    );
    return site ? cloneSite(site) : null;
  }

  async create(input: CreateBusinessWebsiteRepositoryInput) {
    const now = new Date().toISOString();
    const slug = this.uniqueSlug(input.slug);
    const site: BusinessWebsiteRecord = {
      id: randomUUID(),
      userId: input.userId,
      workspaceId: input.workspaceId,
      country: input.country,
      status: input.status,
      slug,
      title: input.title,
      prompt: input.prompt,
      siteType: input.siteType,
      style: input.style,
      content: cloneContent(input.content),
      publicationPath: `/site/${slug}`,
      createdAt: now,
      updatedAt: now,
      publishedAt: input.status === "published" ? now : null,
    };
    this.sites.set(site.id, site);
    return cloneSite(site);
  }

  async update(userId: string, siteId: string, input: UpdateBusinessWebsiteInput) {
    const site = this.sites.get(siteId);
    if (!site || site.userId !== userId) return null;

    const slug = input.slug ? this.uniqueSlug(input.slug, site.id) : site.slug;
    const updated: BusinessWebsiteRecord = {
      ...site,
      slug,
      title: input.title ?? site.title,
      content: input.content ? cloneContent(input.content) : cloneContent(site.content),
      publicationPath: `/site/${slug}`,
      updatedAt: new Date().toISOString(),
    };
    this.sites.set(site.id, updated);
    return cloneSite(updated);
  }

  async publish(userId: string, siteId: string) {
    const site = this.sites.get(siteId);
    if (!site || site.userId !== userId) return null;

    const now = new Date().toISOString();
    const published: BusinessWebsiteRecord = {
      ...site,
      status: "published",
      publishedAt: site.publishedAt ?? now,
      updatedAt: now,
    };
    this.sites.set(site.id, published);
    return cloneSite(published);
  }

  private uniqueSlug(value: string, currentId?: string) {
    const base = normalizeSlug(value) || "business-site";
    let candidate = base;
    let suffix = 2;
    while ([...this.sites.values()].some((site) => site.id !== currentId && site.slug === candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}

type BusinessWebsiteRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  country: string;
  status: string;
  slug: string;
  title: string;
  prompt: string;
  site_type: string;
  style: string;
  content: BusinessWebsiteContent | string;
  publication_path: string;
  created_at: Date | string;
  updated_at: Date | string;
  published_at: Date | string | null;
} & Record<string, unknown>;

export class PostgresBusinessWebsiteRepository implements BusinessWebsiteRepository {
  constructor(private readonly database: DatabaseClient) {}

  async listByUser(userId: string) {
    const databaseUserId = await this.ensureUser(userId);
    if (!databaseUserId) return [];

    const result = await this.database.query<BusinessWebsiteRow>(
      `
        select
          id,
          user_id,
          workspace_id,
          country,
          status,
          slug,
          title,
          prompt,
          site_type,
          style,
          content,
          publication_path,
          created_at,
          updated_at,
          published_at
        from business_websites
        where user_id = $1
        order by updated_at desc
      `,
      [databaseUserId]
    );

    return result.rows.map(mapBusinessWebsiteRow);
  }

  async getById(userId: string, siteId: string) {
    const databaseUserId = await this.ensureUser(userId);
    if (!databaseUserId) return null;

    const result = await this.database.query<BusinessWebsiteRow>(
      `
        select
          id,
          user_id,
          workspace_id,
          country,
          status,
          slug,
          title,
          prompt,
          site_type,
          style,
          content,
          publication_path,
          created_at,
          updated_at,
          published_at
        from business_websites
        where id = $1 and user_id = $2
        limit 1
      `,
      [siteId, databaseUserId]
    );

    return result.rows[0] ? mapBusinessWebsiteRow(result.rows[0]) : null;
  }

  async getPublishedBySlug(slug: string) {
    const result = await this.database.query<BusinessWebsiteRow>(
      `
        select
          id,
          user_id,
          workspace_id,
          country,
          status,
          slug,
          title,
          prompt,
          site_type,
          style,
          content,
          publication_path,
          created_at,
          updated_at,
          published_at
        from business_websites
        where slug = $1 and status = 'published'
        limit 1
      `,
      [normalizeSlug(slug)]
    );

    return result.rows[0] ? mapBusinessWebsiteRow(result.rows[0]) : null;
  }

  async create(input: CreateBusinessWebsiteRepositoryInput) {
    const databaseUserId = await this.ensureUser(input.userId);
    if (!databaseUserId) return null;

    const workspaceId = input.workspaceId ?? (await this.findWorkspaceId(databaseUserId));
    const slug = await this.uniqueSlug(input.slug);
    const result = await this.database.query<BusinessWebsiteRow>(
      `
        insert into business_websites (
          user_id,
          workspace_id,
          country,
          status,
          slug,
          title,
          prompt,
          site_type,
          style,
          content,
          publication_path,
          published_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
        returning
          id,
          user_id,
          workspace_id,
          country,
          status,
          slug,
          title,
          prompt,
          site_type,
          style,
          content,
          publication_path,
          created_at,
          updated_at,
          published_at
      `,
      [
        databaseUserId,
        workspaceId,
        input.country,
        input.status,
        slug,
        input.title,
        input.prompt,
        input.siteType,
        input.style,
        JSON.stringify(input.content),
        `/site/${slug}`,
        input.status === "published" ? new Date().toISOString() : null,
      ]
    );

    return result.rows[0] ? mapBusinessWebsiteRow(result.rows[0]) : null;
  }

  async update(userId: string, siteId: string, input: UpdateBusinessWebsiteInput) {
    const databaseUserId = await this.ensureUser(userId);
    if (!databaseUserId) return null;

    const current = await this.getById(userId, siteId);
    if (!current) return null;

    const slug = input.slug ? await this.uniqueSlug(input.slug, siteId) : current.slug;
    const result = await this.database.query<BusinessWebsiteRow>(
      `
        update business_websites
        set
          slug = $3,
          title = $4,
          content = $5::jsonb,
          publication_path = $6,
          updated_at = now()
        where id = $1 and user_id = $2
        returning
          id,
          user_id,
          workspace_id,
          country,
          status,
          slug,
          title,
          prompt,
          site_type,
          style,
          content,
          publication_path,
          created_at,
          updated_at,
          published_at
      `,
      [
        siteId,
        databaseUserId,
        slug,
        input.title ?? current.title,
        JSON.stringify(input.content ?? current.content),
        `/site/${slug}`,
      ]
    );

    return result.rows[0] ? mapBusinessWebsiteRow(result.rows[0]) : null;
  }

  async publish(userId: string, siteId: string) {
    const databaseUserId = await this.ensureUser(userId);
    if (!databaseUserId) return null;

    const result = await this.database.query<BusinessWebsiteRow>(
      `
        update business_websites
        set
          status = 'published',
          published_at = coalesce(published_at, now()),
          updated_at = now()
        where id = $1 and user_id = $2
        returning
          id,
          user_id,
          workspace_id,
          country,
          status,
          slug,
          title,
          prompt,
          site_type,
          style,
          content,
          publication_path,
          created_at,
          updated_at,
          published_at
      `,
      [siteId, databaseUserId]
    );

    return result.rows[0] ? mapBusinessWebsiteRow(result.rows[0]) : null;
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

  private async uniqueSlug(value: string, currentId?: string) {
    const base = normalizeSlug(value) || "business-site";
    let candidate = base;
    let suffix = 2;

    while (true) {
      const result = await this.database.query<{ id: string }>(
        `
          select id
          from business_websites
          where slug = $1
          limit 1
        `,
        [candidate]
      );
      const existingId = result.rows[0]?.id;
      if (!existingId || existingId === currentId) return candidate;

      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }
}

function mapBusinessWebsiteRow(row: BusinessWebsiteRow): BusinessWebsiteRecord {
  const slug = normalizeSlug(row.slug);
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    workspaceId: row.workspace_id,
    country: normalizeCountry(row.country),
    status: normalizeStatus(row.status),
    slug,
    title: row.title,
    prompt: row.prompt,
    siteType: normalizeSiteType(row.site_type),
    style: normalizeStyle(row.style),
    content: parseContent(row.content),
    publicationPath: row.publication_path || `/site/${slug}`,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    publishedAt: row.published_at ? toIso(row.published_at) : null,
  };
}

function cloneSite(site: BusinessWebsiteRecord): BusinessWebsiteRecord {
  return {
    ...site,
    content: cloneContent(site.content),
  };
}

function cloneContent(content: BusinessWebsiteContent): BusinessWebsiteContent {
  return JSON.parse(JSON.stringify(content)) as BusinessWebsiteContent;
}

function parseContent(value: BusinessWebsiteContent | string): BusinessWebsiteContent {
  if (typeof value !== "string") return cloneContent(value);
  return JSON.parse(value) as BusinessWebsiteContent;
}

function normalizeCountry(value: string): BusinessWebsiteCountry {
  return value === "RU" ? "RU" : "KZ";
}

function normalizeStatus(value: string): BusinessWebsiteStatus {
  return value === "published" ? "published" : "draft";
}

function normalizeStyle(value: string): BusinessWebsiteStyle {
  if (value === "premium" || value === "bold" || value === "warm") return value;
  return "clean";
}

function normalizeSiteType(value: string): BusinessWebsiteType {
  if (value === "services" || value === "catalog") return value;
  return "landing";
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s_-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
