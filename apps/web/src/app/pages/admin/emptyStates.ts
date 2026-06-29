import type {
  AdminAiBudgetApiResponse,
  AdminControlStateApiResponse,
  AdminOverviewApiResponse,
  AdminUsersApiResponse,
} from "../../api";

export function createEmptyAdminOverview(): AdminOverviewApiResponse {
  return {
    businessDirection: {
      metrics: [],
      signals: [],
      nextSteps: [],
    },
    memory: {
      totalChats: 0,
      totalMessages: 0,
      summarizedChats: 0,
      memoryItems: 0,
      memoryTokens: 0,
      memoryLimitTokens: 2_000_000,
      fillPercent: 0,
      privateNote:
        "Реальные агрегаты памяти загрузятся из API. Содержимое чатов и сообщений не выводится.",
    },
    paymentReport: {
      providers: [],
      note: "Отчет по оплатам загрузится из API.",
    },
    pricing: {
      exchangeRates: [],
      plans: [],
    },
  };
}

export function createEmptyAdminControlState(): AdminControlStateApiResponse {
  return {
    featureFlags: [],
    aiProviders: [],
    agents: [],
    promotions: [],
    contentBlocks: [],
    auditLog: [],
    policyMode: "local",
    note: "Реальное состояние запуска загрузится из API. Демо-значения здесь не подставляются.",
  };
}

export function createEmptyAdminAiBudget(): AdminAiBudgetApiResponse {
  return {
    providers: [],
    totals: {
      budgetUsd: null,
      balanceUsd: null,
      estimatedCreditsRemaining: null,
      spentCredits30d: 0,
      spentUsd30d: 0,
      avgUsdPerDay30d: 0,
      daysRemaining: null,
      activeProviders: 0,
      configuredProviders: 0,
    },
    creditsPerUsd: 1_000,
    generatedAt: new Date(0).toISOString(),
    note:
      "AI бюджет загрузится из API. Реальные внешние кабинеты провайдеров не опрашиваются напрямую.",
  };
}

export function createEmptyAdminUsers(query: string): AdminUsersApiResponse {
  return {
    query,
    users: [],
    privacyNote:
      "Реальные пользователи загрузятся из API. Содержимое чатов, файлов и проектов не выводится.",
  };
}
