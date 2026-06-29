export type AdminTab = "direction" | "users" | "memory" | "pricing" | "control" | "ai-budget";

export type FeatureFlagDraft = {
  label: string;
  description: string;
  audience: string;
  rolloutPercent: string;
};

export type PromotionDraft = {
  title: string;
  body: string;
  placement: string;
  audience: string;
  priority: string;
};

export type ContentBlockDraft = {
  title: string;
  body: string;
  placement: string;
};
