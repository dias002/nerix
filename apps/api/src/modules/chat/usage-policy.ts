import { DomainError, fail, ok } from "../../domain/result.js";
import type { ConversationRepository } from "./conversation.repository.js";

const freeDailyTextLimit = 7;
const paidOnlyAgentIds = new Set(["image", "video", "music", "voice"]);
const paidOnlyModalities = new Set(["image", "video", "music", "voice"]);

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

  async getUsageLimits(userId: string) {
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
        music: access.hasActiveSubscription,
        voice: access.hasActiveSubscription,
      },
    });
  }

  async assertRequestAllowed(input: { userId: string; route: { agentId: string; modality: string } }) {
    const access = await this.getSubscriptionAccess(input.userId);
    if (access.hasActiveSubscription) return ok({ allowed: true });

    if (paidOnlyModalities.has(input.route.modality) || paidOnlyAgentIds.has(input.route.agentId)) {
      return fail(
        new DomainError(
          "subscription_required",
          "Картинки, видео, песни и голос доступны после подписки. В бесплатном режиме доступно 7 обычных текстовых запросов в день.",
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
