import { DomainError, fail, ok } from "../../domain/result.js";
import type { SubscriptionService } from "../subscriptions/subscription.service.js";
import {
  isBusinessIdeaStatus,
  isBusinessMemberStatus,
  isBusinessRoleKey,
} from "./business.seed.js";
import type { BusinessAccessState, BusinessRepository, CreateBusinessMemberInput } from "./business.repository.js";
import type { BusinessIdeaStatus } from "./business.types.js";

const businessSeatLimit = 5;

export class BusinessService {
  constructor(
    private readonly repository: BusinessRepository,
    private readonly subscriptions: SubscriptionService
  ) {}

  async getWorkspace(userId: string) {
    const access = await this.resolveAccess(userId);
    const workspace = await this.repository.getWorkspace(userId, access);
    if (!workspace) {
      return fail(new DomainError("not_found", `Business workspace for user '${userId}' was not found.`, 404));
    }

    return ok(workspace);
  }

  async addMember(userId: string, input: CreateBusinessMemberInput) {
    const name = input.name.trim();
    if (!name) {
      return fail(new DomainError("validation_failed", "Employee name is required.", 400));
    }

    if (!isBusinessRoleKey(input.roleKey)) {
      return fail(new DomainError("validation_failed", "Business role is invalid.", 400));
    }

    if (input.status && !isBusinessMemberStatus(input.status)) {
      return fail(new DomainError("validation_failed", "Employee status is invalid.", 400));
    }

    const access = await this.resolveAccess(userId);
    const current = await this.repository.getWorkspace(userId, access);
    if (!current) {
      return fail(new DomainError("not_found", `Business workspace for user '${userId}' was not found.`, 404));
    }

    if (current.members.length >= businessSeatLimit) {
      return fail(new DomainError("validation_failed", "Business plan includes up to 5 employees.", 400));
    }

    const workspace = await this.repository.addMember(userId, { ...input, name }, access);
    if (!workspace) {
      return fail(new DomainError("not_found", `Business workspace for user '${userId}' was not found.`, 404));
    }

    return ok(workspace);
  }

  async addDealNote(userId: string, dealId: string, text: string) {
    const noteText = text.trim();
    if (!noteText) {
      return fail(new DomainError("validation_failed", "Deal note text is required.", 400));
    }

    const access = await this.resolveAccess(userId);
    const current = await this.repository.getWorkspace(userId, access);
    const dealExists = current?.deals.some((deal) => deal.id === dealId) ?? false;
    if (!dealExists) {
      return fail(new DomainError("not_found", `Business deal '${dealId}' was not found.`, 404));
    }

    const workspace = await this.repository.addDealNote(userId, dealId, noteText, access);
    if (!workspace) {
      return fail(new DomainError("not_found", `Business deal '${dealId}' was not found.`, 404));
    }

    return ok(workspace);
  }

  async updateIdeaStatus(userId: string, ideaId: string, status: BusinessIdeaStatus) {
    if (!isBusinessIdeaStatus(status)) {
      return fail(new DomainError("validation_failed", "Business idea status is invalid.", 400));
    }

    const access = await this.resolveAccess(userId);
    const current = await this.repository.getWorkspace(userId, access);
    const ideaExists =
      current?.advisorViews.some((view) => view.ideas.some((idea) => idea.id === ideaId)) ?? false;
    if (!ideaExists) {
      return fail(new DomainError("not_found", `Business idea '${ideaId}' was not found.`, 404));
    }

    const workspace = await this.repository.updateIdeaStatus(userId, ideaId, status, access);
    if (!workspace) {
      return fail(new DomainError("not_found", `Business idea '${ideaId}' was not found.`, 404));
    }

    return ok(workspace);
  }

  private async resolveAccess(userId: string): Promise<BusinessAccessState> {
    const subscription = await this.subscriptions.currentSubscription(userId);
    const activeSubscription = subscription.ok ? subscription.value.subscription : null;
    const isBusinessActive = activeSubscription?.status === "active" && activeSubscription.planId === "business";

    return {
      mode: isBusinessActive ? "active" : "demo",
      planRequired: "business" as const,
      enabled: true,
      subscriptionPlanId: activeSubscription?.planId ?? null,
      message: isBusinessActive
        ? "Business workspace is active for this account."
        : "Demo workspace is available. A Business subscription turns it into the live company cabinet.",
    };
  }
}
