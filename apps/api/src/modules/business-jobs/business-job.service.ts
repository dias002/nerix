import { DomainError, fail, ok } from "../../domain/result.js";
import type { BusinessService } from "../business/business.service.js";
import type { BusinessWebsiteService } from "../business-websites/business-website.service.js";
import type { CreateBusinessWebsiteDraftInput } from "../business-websites/business-website.types.js";
import type { KnowledgeBaseService } from "../knowledge-base/knowledge-base.service.js";
import type { TelegramBotOrderService } from "../telegram-bots/telegram-bot.service.js";
import type { TelegramMiniAppDraftInput } from "../telegram-bots/telegram-bot.types.js";
import type { BusinessJobRepository } from "./business-job.repository.js";

export class BusinessJobService {
  constructor(
    private readonly repository: BusinessJobRepository,
    private readonly business: BusinessService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly websites: BusinessWebsiteService,
    private readonly telegramBots: TelegramBotOrderService
  ) {}

  async listJobs(userId: string) {
    const workspace = await this.requireWorkspace(userId);
    if (!workspace.ok) return workspace;

    return ok({
      workspaceId: workspace.value.id,
      jobs: await this.repository.listByWorkspaceId(workspace.value.id),
    });
  }

  async getJob(userId: string, jobId: string) {
    const workspace = await this.requireWorkspace(userId);
    if (!workspace.ok) return workspace;

    const job = await this.repository.getById(workspace.value.id, jobId);
    if (!job) {
      return fail(new DomainError("not_found", "Business job was not found.", 404));
    }

    return ok({
      workspaceId: workspace.value.id,
      job,
    });
  }

  async cancelJob(userId: string, jobId: string) {
    const workspace = await this.requireWorkspace(userId);
    if (!workspace.ok) return workspace;

    const job = await this.repository.cancel(workspace.value.id, jobId);
    if (!job) {
      return fail(new DomainError("not_found", "Business job was not found.", 404));
    }

    return ok({
      workspaceId: workspace.value.id,
      job,
    });
  }

  async createWebsiteDraftJob(userId: string, input: Omit<CreateBusinessWebsiteDraftInput, "userId">) {
    const workspace = await this.requireWorkspace(userId);
    if (!workspace.ok) return workspace;

    const knowledgeContext = await this.knowledgeBase.buildContextForWorkspaceId(workspace.value.id);
    const job = await this.repository.create({
      workspaceId: workspace.value.id,
      createdByUserId: userId,
      channel: "website",
      capability: "website_generation",
      taskType: "website_copy",
      payload: {
        country: input.country,
        companyName: input.companyName ?? "",
        city: input.city ?? "",
        style: input.style,
        siteType: input.siteType,
      },
    });

    await this.repository.markRunning(workspace.value.id, job.id);
    const result = await this.websites.createDraft({
      ...input,
      userId,
      workspaceId: workspace.value.id,
      knowledgeContext,
    });
    if (!result.ok) {
      await this.repository.markFailed(workspace.value.id, job.id, result.error.message);
      return fail(result.error);
    }

    const completedJob = await this.repository.markSucceeded(workspace.value.id, job.id, {
      result: {
        websiteId: result.value.website.id,
        assistantSummary: result.value.assistantSummary,
      },
    });

    return ok({
      ...result.value,
      job: completedJob ?? job,
    });
  }

  async createTelegramMiniAppDraftJob(userId: string, input: Omit<TelegramMiniAppDraftInput, "userId">) {
    const workspace = await this.requireWorkspace(userId);
    if (!workspace.ok) return workspace;

    const knowledgeContext = await this.knowledgeBase.buildContextForWorkspaceId(workspace.value.id);
    const job = await this.repository.create({
      workspaceId: workspace.value.id,
      createdByUserId: userId,
      channel: "telegram",
      capability: "bot_setup",
      taskType: "bot_policy",
      payload: {
        country: input.country,
        companyName: input.companyName,
        businessCategory: input.businessCategory,
        goals: input.goals,
      },
    });

    await this.repository.markRunning(workspace.value.id, job.id);
    const result = this.telegramBots.createMiniAppDraft({
      ...input,
      userId,
      knowledgeContext,
    });
    if (!result.ok) {
      await this.repository.markFailed(workspace.value.id, job.id, result.error.message);
      return fail(result.error);
    }

    const completedJob = await this.repository.markSucceeded(workspace.value.id, job.id, {
      result: {
        botName: result.value.draft.botName,
        managedBotUrl: result.value.draft.managedBotUrl,
        companyName: result.value.draft.companyName,
      },
    });

    return ok({
      ...result.value,
      job: completedJob ?? job,
    });
  }

  private async requireWorkspace(userId: string) {
    const workspace = await this.business.getWorkspace(userId);
    if (!workspace.ok) return workspace;

    return ok(workspace.value.workspace);
  }
}
