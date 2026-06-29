import type {
  AdminAiProviderSettingApiRecord,
  AdminContentBlockApiRecord,
  AdminFeatureFlagApiRecord,
  AdminPricingApiRecord,
  AdminPromotionApiRecord,
  PlanId,
} from "../../api";
import type { ContentBlockDraft, FeatureFlagDraft, PromotionDraft } from "./types";

export function priceDrafts(pricing: AdminPricingApiRecord) {
  const drafts: Record<string, string> = {};
  pricing.plans.forEach((plan) => {
    plan.prices.forEach((price) => {
      drafts[priceKey(plan.id, price.country)] = String(price.amountMinor);
    });
  });
  return drafts;
}

export function providerModelDraftsFromControl(providers: AdminAiProviderSettingApiRecord[]) {
  const drafts: Record<string, string> = {};
  providers.forEach((provider) => {
    drafts[provider.code] = provider.model;
  });
  return drafts;
}

export function featureFlagDraftsFromControl(flags: AdminFeatureFlagApiRecord[]) {
  const drafts: Record<string, FeatureFlagDraft> = {};
  flags.forEach((flag) => {
    drafts[flag.key] = featureFlagDraftFromRecord(flag);
  });
  return drafts;
}

export function featureFlagDraftFromRecord(flag: AdminFeatureFlagApiRecord): FeatureFlagDraft {
  return {
    label: flag.label,
    description: flag.description,
    audience: flag.audience,
    rolloutPercent: String(flag.rolloutPercent),
  };
}

export function promotionDraftsFromControl(promotions: AdminPromotionApiRecord[]) {
  const drafts: Record<string, PromotionDraft> = {};
  promotions.forEach((promotion) => {
    drafts[promotion.slug] = promotionDraftFromRecord(promotion);
  });
  return drafts;
}

export function promotionDraftFromRecord(promotion: AdminPromotionApiRecord): PromotionDraft {
  return {
    title: promotion.title,
    body: promotion.body,
    placement: promotion.placement,
    audience: promotion.audience,
    priority: String(promotion.priority),
  };
}

export function contentBlockDraftsFromControl(blocks: AdminContentBlockApiRecord[]) {
  const drafts: Record<string, ContentBlockDraft> = {};
  blocks.forEach((block) => {
    drafts[contentBlockKey(block)] = contentBlockDraftFromRecord(block);
  });
  return drafts;
}

export function contentBlockDraftFromRecord(block: AdminContentBlockApiRecord): ContentBlockDraft {
  return {
    title: block.title,
    body: block.body,
    placement: block.placement,
  };
}

export function contentBlockKey(block: Pick<AdminContentBlockApiRecord, "key" | "locale">) {
  return `${block.key}:${block.locale}`;
}

export function priceKey(planId: PlanId, country: "KZ" | "RU") {
  return `${planId}:${country}`;
}
