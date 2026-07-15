import { DomainError, fail, ok } from "../../domain/result.js";
import { getSelectableModelAccess } from "../ai-gateway/provider-registry.js";
import type { PlanId } from "../subscriptions/subscription.types.js";
import type { ConversationRepository } from "./conversation.repository.js";

const freeDailyTextLimit = 7;
const paidOnlyAgentIds = new Set(["image", "video", "avatar", "music", "voice"]);
const paidOnlyModalities = new Set(["image", "video", "avatar_video", "music", "voice"]);

export type SubscriptionAccessService = {
  currentSubscription(userId: string): Promise<{
    ok: true;
    value: {
      subscription: {
        planId: string;
        status: string;
      } | null;
    };
  } | {
    ok: false;
    error: {
      code: string;
      message: string;
      statusCode?: number;
    };
  }>;
};

export class ChatUsagePolicy {
  constructor(
    private readonly conversations: Pick<ConversationRepository, "countFreeTextRequestsSince">,
    private readonly subscriptions?: SubscriptionAccessService
  ) {}

  async getUsageLimits(userId: string, options: { isAdmin?: boolean } = {}) {
    if (options.isAdmin) {
      return ok({
        planId: "admin",
        hasActiveSubscription: true,
        text: {
          dailyLimit: null,
          usedToday: null,
          remainingToday: null,
        },
        media: {
          image: true,
          video: true,
          avatarVideo: true,
          music: true,
          voice: true,
        },
      });
    }

    const access = await this.getSubscriptionAccess(userId);
    const dailyTextUsed = await this.conversations.countFreeTextRequestsSince(userId, startOfUtcDayIso());
    const dailyTextRemaining = Math.max(0, freeDailyTextLimit - dailyTextUsed);

    return ok({
      planId: access.planId,
      hasActiveSubscription: access.hasActiveSubscription,
      text: {
        dailyLimit: access.hasActiveSubscription ? null : freeDailyTextLimit,
        usedToday: access.hasActiveSubscription ? null : dailyTextUsed,
        remainingToday: access.hasActiveSubscription ? null : dailyTextRemaining,
      },
      media: {
        image: access.hasActiveSubscription,
        video: access.hasActiveSubscription,
        avatarVideo: access.hasActiveSubscription,
        music: access.hasActiveSubscription,
        voice: access.hasActiveSubscription,
      },
    });
  }

  async assertRequestAllowed(input: { userId: string; selectedModelId?: string; route: { agentId: string; modality: string }; isAdmin?: boolean }) {
    if (input.isAdmin) return ok({ allowed: true });

    const access = await this.getSubscriptionAccess(input.userId);

    const modelAccess = getSelectedModelAccess(input.selectedModelId, input.route.modality);
    if (modelAccess?.minPlanId && !hasPlanAccess(access.planId, modelAccess.minPlanId)) {
      return fail(
        new DomainError(
          "subscription_required",
          `Модель ${modelAccess.label} доступна с тарифа ${modelAccess.minPlanName}. Выберите Auto или OpenAI GPT-4o mini, либо подключите подходящую подписку.`,
          402
        )
      );
    }

    if (access.hasActiveSubscription) return ok({ allowed: true });

    if (paidOnlyModalities.has(input.route.modality) || paidOnlyAgentIds.has(input.route.agentId)) {
      return fail(
        new DomainError(
          "subscription_required",
          "Картинки, видео, аватар-ролики, песни и голос доступны после подписки. В бесплатном режиме доступно 7 обычных текстовых запросов в день.",
          402
        )
      );
    }

    const dailyTextUsed = await this.conversations.countFreeTextRequestsSince(input.userId, startOfUtcDayIso());
    if (dailyTextUsed >= freeDailyTextLimit) {
      return fail(
        new DomainError(
          "daily_text_limit_exceeded",
          "Бесплатные 7 текстовых запросов на сегодня закончились. Подключите подписку, чтобы продолжить.",
          402
        )
      );
    }

    return ok({ allowed: true });
  }

  private async getSubscriptionAccess(userId: string) {
    if (!this.subscriptions) {
      return {
        hasActiveSubscription: false,
        planId: null as string | null,
      };
    }

    const current = await this.subscriptions.currentSubscription(userId);
    const subscription = current.ok ? current.value.subscription : null;
    const hasActiveSubscription = subscription?.status === "active";

    return {
      hasActiveSubscription,
      planId: hasActiveSubscription ? subscription.planId : null,
    };
  }
}

function startOfUtcDayIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function getSelectedModelAccess(selectedModelId: string | undefined, modality: string) {
  if (!selectedModelId || !isSelectableModality(modality)) return null;
  return getSelectableModelAccess({ selectedModelId, modality });
}

function isSelectableModality(value: string): value is "text" | "code" | "file" {
  return value === "text" || value === "code" || value === "file";
}

function hasPlanAccess(currentPlanId: string | null, requiredPlanId: PlanId) {
  return planRank(currentPlanId) >= planRank(requiredPlanId);
}

function planRank(planId: string | null) {
  if (planId === "base") return 1;
  if (planId === "ultra") return 2;
  if (planId === "pro") return 3;
  if (planId === "business") return 4;
  return 0;
}
