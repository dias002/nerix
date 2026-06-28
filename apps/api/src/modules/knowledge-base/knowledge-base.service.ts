import { DomainError, fail, ok } from "../../domain/result.js";
import type { BusinessService } from "../business/business.service.js";
import type {
  CreateKnowledgeBaseEntryInput,
  KnowledgeBaseEntryRecord,
  UpdateKnowledgeBaseEntryInput,
} from "./knowledge-base.types.js";
import type { KnowledgeBaseRepository } from "./knowledge-base.repository.js";

export class KnowledgeBaseService {
  constructor(
    private readonly repository: KnowledgeBaseRepository,
    private readonly business: BusinessService
  ) {}

  async listEntries(userId: string) {
    const workspace = await this.requireWorkspace(userId);
    if (!workspace.ok) return workspace;

    return ok({
      workspaceId: workspace.value.id,
      entries: await this.repository.listByWorkspaceId(workspace.value.id),
    });
  }

  async createEntry(userId: string, input: CreateKnowledgeBaseEntryInput) {
    const workspace = await this.requireWorkspace(userId);
    if (!workspace.ok) return workspace;

    const normalized = normalizeCreateInput(input);
    if (!normalized.title || !normalized.content) {
      return fail(new DomainError("validation_failed", "Knowledge base entry title and content are required.", 400));
    }

    const entry = await this.repository.create({
      workspaceId: workspace.value.id,
      createdByUserId: userId,
      entry: normalized,
    });

    return ok({
      workspaceId: workspace.value.id,
      entry,
    });
  }

  async updateEntry(userId: string, entryId: string, input: UpdateKnowledgeBaseEntryInput) {
    const workspace = await this.requireWorkspace(userId);
    if (!workspace.ok) return workspace;

    const normalized = normalizeUpdateInput(input);
    const entry = await this.repository.update(workspace.value.id, entryId, normalized);
    if (!entry) {
      return fail(new DomainError("not_found", "Knowledge base entry was not found.", 404));
    }

    return ok({
      workspaceId: workspace.value.id,
      entry,
    });
  }

  async deleteEntry(userId: string, entryId: string) {
    const workspace = await this.requireWorkspace(userId);
    if (!workspace.ok) return workspace;

    const deleted = await this.repository.remove(workspace.value.id, entryId);
    if (!deleted) {
      return fail(new DomainError("not_found", "Knowledge base entry was not found.", 404));
    }

    return ok({
      workspaceId: workspace.value.id,
      deleted: true,
    });
  }

  async buildContextForWorkspaceId(workspaceId: string) {
    const entries = await this.repository.listByWorkspaceId(workspaceId);
    return summarizeKnowledgeEntries(entries);
  }

  private async requireWorkspace(userId: string) {
    const workspace = await this.business.getWorkspace(userId);
    if (!workspace.ok) return workspace;

    return ok(workspace.value.workspace);
  }
}

function normalizeCreateInput(input: CreateKnowledgeBaseEntryInput): CreateKnowledgeBaseEntryInput {
  return {
    type: input.type,
    title: input.title.trim(),
    content: input.content.trim(),
    sourceUrl: input.sourceUrl?.trim(),
    tags: normalizeTags(input.tags),
  };
}

function normalizeUpdateInput(input: UpdateKnowledgeBaseEntryInput): UpdateKnowledgeBaseEntryInput {
  return {
    type: input.type,
    title: input.title?.trim(),
    content: input.content?.trim(),
    sourceUrl: input.sourceUrl?.trim(),
    tags: input.tags ? normalizeTags(input.tags) : undefined,
  };
}

function normalizeTags(tags: string[] | undefined) {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

function summarizeKnowledgeEntries(entries: KnowledgeBaseEntryRecord[]) {
  return entries
    .slice(0, 8)
    .map((entry) => {
      const title = entry.title.trim();
      const content = entry.content.trim().replace(/\s+/g, " ").slice(0, 500);
      const tags = entry.tags.length ? ` [${entry.tags.join(", ")}]` : "";
      return `${entry.type}${tags}: ${title}\n${content}`;
    })
    .join("\n\n")
    .slice(0, 4_000);
}
