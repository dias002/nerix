import type {
  AdminAgentApiRecord,
  AdminAiBudgetApiResponse,
  AdminAiProviderSettingApiRecord,
  AdminContentBlockApiRecord,
  AdminControlStateApiResponse,
  AdminFeatureFlagApiRecord,
  AdminOverviewApiResponse,
  AdminPricingApiRecord,
  AdminPromotionApiRecord,
  AdminUsersApiResponse,
  PlanId,
} from "./index";
import { request } from "./transport";

export async function getAdminOverview() {
  return request<AdminOverviewApiResponse>("/admin/overview");
}

export async function getAdminControlState() {
  return request<AdminControlStateApiResponse>("/admin/control");
}

export async function getAdminAiBudget() {
  return request<AdminAiBudgetApiResponse>("/admin/ai-budget");
}

export async function updateAdminFeatureFlag(
  key: string,
  input: Partial<Pick<AdminFeatureFlagApiRecord, "enabled" | "label" | "description" | "audience" | "rolloutPercent">>
) {
  return request<AdminControlStateApiResponse>(`/admin/control/feature-flags/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateAdminAiProvider(
  code: string,
  input: Partial<Pick<AdminAiProviderSettingApiRecord, "enabled" | "model" | "trafficMode">>
) {
  return request<AdminControlStateApiResponse>(`/admin/control/ai-providers/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateAdminAgent(id: string, input: Partial<Pick<AdminAgentApiRecord, "enabled">>) {
  return request<AdminControlStateApiResponse>(`/admin/control/agents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateAdminPromotion(
  slug: string,
  input: Partial<
    Pick<
      AdminPromotionApiRecord,
      "title" | "body" | "placement" | "audience" | "active" | "startsAt" | "endsAt" | "priority"
    >
  >
) {
  return request<AdminControlStateApiResponse>(`/admin/control/promotions/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateAdminContentBlock(
  key: string,
  input: Partial<Pick<AdminContentBlockApiRecord, "locale" | "title" | "body" | "placement" | "active">>
) {
  return request<AdminControlStateApiResponse>(`/admin/control/content-blocks/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function getAdminUsers(query = "") {
  const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return request<AdminUsersApiResponse>(`/admin/users${params}`);
}

export async function updateAdminPlanPrice(input: {
  planId: PlanId;
  country: "KZ" | "RU";
  amountMinor: number;
}) {
  return request<{ pricing: AdminPricingApiRecord }>("/admin/pricing", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
