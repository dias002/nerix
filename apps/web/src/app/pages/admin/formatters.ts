import type { AdminAiBudgetApiResponse, AdminAiProviderSettingApiRecord } from "../../api";

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function formatRate(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: currency === "RUB" || currency === "KZT" ? currency : "KZT",
  }).format(amountMinor / 100);
}

export function formatUsdNullable(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "не задано";
  return new Intl.NumberFormat("ru-RU", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function formatCompactCredits(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "не задано";
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

export function formatDaysRemaining(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "нет прогноза";
  if (value <= 0) return "закончился";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value)} дн.`;
}

export function aiBudgetStatusLabel(value: AdminAiBudgetApiResponse["providers"][number]["status"]) {
  const labels = {
    ok: "норма",
    attention: "внимание",
    risk: "риск",
    unknown: "нет данных",
  };
  return labels[value];
}

export function balanceSourceLabel(value: AdminAiBudgetApiResponse["providers"][number]["balanceSource"]) {
  const labels = {
    manual_env: "точный env-остаток",
    estimated_from_budget: "расчет от бюджета",
    not_configured: "env не задан",
  };
  return labels[value];
}

export function trafficModeLabel(value: AdminAiProviderSettingApiRecord["trafficMode"]) {
  const labels = {
    primary: "основной",
    reserve: "резерв",
    paused: "не используется",
  };
  return labels[value];
}

export function modalityLabel(value: string) {
  const labels: Record<string, string> = {
    code: "код",
    file: "файлы",
    image: "изображения",
    music: "музыка",
    text: "текст",
    video: "видео",
    voice: "голос",
  };
  return labels[value] ?? value;
}

export function agentCategoryLabel(value: string) {
  const labels: Record<string, string> = {
    business: "бизнес",
    code: "код",
    documents: "документы",
    general: "общий",
    image: "изображения",
    marketing: "маркетинг",
    music: "музыка",
    study: "учеба",
    support: "поддержка",
    video: "видео",
    voice: "голос",
  };
  return labels[value] ?? value;
}
