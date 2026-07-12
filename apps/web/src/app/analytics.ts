type AnalyticsGoal =
  | "registration"
  | "subscription_checkout"
  | "subscription_paid"
  | "pricing_open";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

const yandexMetrikaId = import.meta.env.VITE_YANDEX_METRIKA_ID?.trim();

export function reachAnalyticsGoal(goal: AnalyticsGoal, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("nomduchat-analytics-goal", {
      detail: {
        provider: "yandex",
        goal,
        params,
      },
    })
  );

  if (!yandexMetrikaId || !/^\d+$/.test(yandexMetrikaId) || typeof window.ym !== "function") {
    return;
  }

  window.ym(Number(yandexMetrikaId), "reachGoal", goal, cleanAnalyticsParams(params));
}

function cleanAnalyticsParams(params: AnalyticsParams) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
}
