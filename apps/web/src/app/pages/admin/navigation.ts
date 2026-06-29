import type { AdminTab } from "./types";

export function readAdminPathTab(pathname: string): AdminTab | null {
  const section = pathname.match(/\/workspace\/admin\/([^/?#]+)/)?.[1] ?? null;
  return isAdminSection(section) ? section : null;
}

export function readAdminTab(value: string | null): AdminTab {
  return isAdminSection(value) ? value : "direction";
}

export function isAdminSection(value: string | null): value is Exclude<AdminTab, "direction"> {
  return value === "users" || value === "memory" || value === "pricing" || value === "control" || value === "ai-budget";
}

export function adminHeader(tab: AdminTab) {
  const headers: Record<AdminTab, { title: string; subtitle: string }> = {
    "ai-budget": {
      title: "AI бюджет и провайдеры",
      subtitle: "Остатки, расход и прогноз по OpenAI, Anthropic, Gemini и локальному mock.",
    },
    control: {
      title: "Центр управления",
      subtitle: "Флаги, провайдеры, агенты, промо и контент без деплоя.",
    },
    direction: {
      title: "Админ панель nomduchat",
      subtitle: "Направление бизнеса, память, платежи, тарифы и контроль запуска.",
    },
    memory: {
      title: "Память продукта",
      subtitle: "Агрегаты по чатам, сообщениям и приватным заметкам без вывода пользовательского содержимого.",
    },
    pricing: {
      title: "Тарифы и цены",
      subtitle: "Планы, локальные цены, источники курсов и ручная корректировка.",
    },
    users: {
      title: "Пользователи",
      subtitle: "Аккаунты, подписки, платежи, проекты и агрегированная активность без содержимого приватных данных.",
    },
  };

  return headers[tab];
}
