import type {
  AdvisorKey,
  BusinessAdvisorView,
  BusinessDealRecord,
  BusinessIdeaRecord,
  BusinessIdeaStatus,
  BusinessMemberRecord,
  BusinessMemberStatus,
  BusinessMetric,
  BusinessPipelineStage,
  BusinessRoleDefinition,
  BusinessRoleKey,
  BusinessSignal,
  BusinessStaticCard,
  BusinessTrafficSource,
  BusinessWorkspaceRecord,
  BusinessWorkspaceSnapshot,
} from "./business.types.js";

export type SeedBusinessDeal = Omit<BusinessDealRecord, "id" | "workspaceId" | "createdAt" | "updatedAt"> & {
  slug: string;
};

export type SeedBusinessIdea = Omit<BusinessIdeaRecord, "id" | "workspaceId" | "createdAt" | "updatedAt"> & {
  slug: string;
};

export type BusinessWorkspaceSeed = {
  workspaceName: string;
  roles: BusinessRoleDefinition[];
  members: Array<
    Omit<BusinessMemberRecord, "id" | "workspaceId" | "userId" | "invitedEmail" | "createdAt" | "updatedAt"> & {
      id: string;
    }
  >;
  stats: BusinessMetric[];
  knowledgeSources: string[];
  paidServices: BusinessStaticCard[];
  pipeline: BusinessPipelineStage[];
  deals: SeedBusinessDeal[];
  customerSignals: BusinessSignal[];
  trafficSources: BusinessTrafficSource[];
  advisors: Array<Omit<BusinessAdvisorView, "ideas"> & { ideas: SeedBusinessIdea[] }>;
};

export const businessWorkspaceSeed: BusinessWorkspaceSeed = {
  workspaceName: "nomduchat Business Demo",
  roles: [
    {
      key: "owner",
      title: "Владелец",
      description: "Видит весь кабинет, подписку, роли, CRM и решения по росту.",
      permissions: ["Оплата", "Команда", "CRM", "Аналитика", "ИИ-агент"],
    },
    {
      key: "sales",
      title: "Отдел продаж",
      description: "Работает с лидами, воронкой, скриптами и следующими шагами по сделкам.",
      permissions: ["CRM", "Сделки", "Скрипты", "Пометки клиентов"],
    },
    {
      key: "support",
      title: "Поддержка",
      description: "Разбирает обращения клиентов и быстро находит ответы в базе знаний.",
      permissions: ["Чат", "База знаний", "Проблемы клиентов"],
    },
    {
      key: "marketing",
      title: "Маркетолог",
      description: "Следит за каналами, посадочными страницами и идеями для продвижения.",
      permissions: ["Метрики", "Кампании", "Идеи роста"],
    },
    {
      key: "developer",
      title: "Разработчик",
      description: "Получает задачи по сайту, интеграциям, боту и техническим улучшениям.",
      permissions: ["Сайт", "Интеграции", "ИИ-бот", "API"],
    },
  ],
  members: [
    {
      id: "owner-seat",
      name: "Владелец",
      roleKey: "owner",
      roleTitle: "Владелец",
      access: "Полный доступ",
      status: "online",
    },
    {
      id: "sales-seat",
      name: "Менеджер продаж",
      roleKey: "sales",
      roleTitle: "Отдел продаж",
      access: "CRM и сделки",
      status: "online",
    },
    {
      id: "support-seat",
      name: "Оператор поддержки",
      roleKey: "support",
      roleTitle: "Поддержка",
      access: "Чаты и база знаний",
      status: "away",
    },
    {
      id: "marketing-seat",
      name: "Маркетолог",
      roleKey: "marketing",
      roleTitle: "Маркетинг",
      access: "Аналитика и идеи",
      status: "online",
    },
    {
      id: "developer-seat",
      name: "Разработчик",
      roleKey: "developer",
      roleTitle: "Разработка",
      access: "Сайт и интеграции",
      status: "offline",
    },
  ],
  stats: [
    { label: "Команда", value: "5", detail: "сотрудников и ролей" },
    { label: "CRM", value: "12", detail: "активных обращений" },
    { label: "ИИ-агент", value: "24/7", detail: "знает контекст бизнеса" },
    { label: "Сайт", value: "1 240", detail: "визитов за неделю" },
  ],
  knowledgeSources: [
    "Описание услуг, цены и условия подписки",
    "FAQ, регламенты и типовые ответы клиентам",
    "История обращений, возражения и причины отказов",
    "Метрики сайта, источники трафика и конверсия",
  ],
  paidServices: [
    {
      title: "ИИ-бот для сайта",
      text: "Отвечает на вопросы, собирает контакты и передает горячие заявки в CRM.",
      price: "отдельная услуга",
      icon: "bot",
    },
    {
      title: "ИИ-менеджер продаж",
      text: "Ведет клиента по воронке, подсказывает следующий шаг и фиксирует слабые места сделки.",
      price: "подписка",
      icon: "sales",
    },
    {
      title: "Сайт под ключ",
      text: "Страница, формы, аналитика и связка с бизнес-кабинетом nomduchat.",
      price: "проектно",
      icon: "site",
    },
  ],
  pipeline: [
    { title: "Новые заявки", count: 5, amount: "680 000 KZT" },
    { title: "В работе", count: 4, amount: "1 150 000 KZT" },
    { title: "Нужен ответ", count: 2, amount: "420 000 KZT" },
    { title: "Готовы к оплате", count: 1, amount: "250 000 KZT" },
  ],
  deals: [
    {
      slug: "alem-beauty",
      client: "Alem Beauty",
      request: "Нужен бот для записи клиентов и ответы по услугам.",
      stage: "Нужен ответ",
      amount: "350 000 KZT",
      source: "Сайт",
      nextStep: "Показать пример сценария записи и уточнить список услуг.",
      problem: "Клиент теряет заявки вечером, когда администратор не отвечает.",
      notes: [
        {
          id: "alem-note-1",
          dealId: "alem-beauty",
          text: "Частый вопрос: свободные окна и цена окрашивания.",
          createdAt: "2026-06-07T09:00:00.000Z",
        },
      ],
    },
    {
      slug: "prime-study",
      client: "Prime Study",
      request: "Лендинг и ИИ-консультант для курсов.",
      stage: "В работе",
      amount: "520 000 KZT",
      source: "Instagram",
      nextStep: "Собрать программу курсов и частые возражения родителей.",
      problem: "Заявки приходят, но менеджеры отвечают разным тоном.",
      notes: [
        {
          id: "prime-note-1",
          dealId: "prime-study",
          text: "Нужен отдельный скрипт для родителей и студентов.",
          createdAt: "2026-06-07T09:05:00.000Z",
        },
      ],
    },
    {
      slug: "auto-line",
      client: "Auto Line",
      request: "Аналитика обращений и автоответы по наличию машин.",
      stage: "Новые заявки",
      amount: "780 000 KZT",
      source: "Реклама",
      nextStep: "Подключить таблицу наличия и проверить частые вопросы.",
      problem: "Менеджеры тратят много времени на одинаковые уточнения.",
      notes: [],
    },
  ],
  customerSignals: [
    {
      tag: "Повторяется",
      title: "Клиенты спрашивают цену до объяснения ценности",
      detail: "Нужен короткий блок, который показывает результат услуги перед стоимостью.",
      tone: "warning",
    },
    {
      tag: "Рост",
      title: "С сайта приходит больше теплых заявок",
      detail: "Форма консультации дает лучшие обращения, чем общий чат.",
      tone: "positive",
    },
    {
      tag: "Риск",
      title: "После 18:00 ответы задерживаются",
      detail: "ИИ-бот может закрыть первичный диалог и передать менеджеру подготовленную карточку.",
      tone: "critical",
    },
  ],
  trafficSources: [
    { source: "Сайт", value: 46 },
    { source: "Instagram", value: 28 },
    { source: "Реклама", value: 18 },
    { source: "Рекомендации", value: 8 },
  ],
  advisors: [
    {
      key: "growth",
      title: "Идеи роста",
      short: "Что усилить в первую очередь",
      summary: "nomduchat видит, где бизнес уже получает интерес, и предлагает шаги, которые можно проверить без долгой подготовки.",
      basedOn: ["источники заявок", "этапы CRM", "типовые вопросы"],
      ideas: [
        {
          slug: "growth-landing",
          advisorKey: "growth",
          title: "Сделать отдельную страницу под самую частую услугу",
          effort: "2-3 дня",
          effect: "+12-18% к заявкам",
          text: "Клиенты чаще спрашивают про одну услугу. Отдельная страница с примерами, ценой от и быстрым вопросом в чат снимет лишние сомнения.",
          next: "Собрать 5 частых вопросов и 3 результата клиентов.",
          status: "planned",
        },
        {
          slug: "growth-evening-bot",
          advisorKey: "growth",
          title: "Закрыть вечерние заявки ИИ-ботом",
          effort: "1 день",
          effect: "меньше потерянных диалогов",
          text: "После 18:00 обращения ждут ответа. Бот может уточнить задачу, бюджет и срок, а утром менеджер получит готовую карточку.",
          next: "Подключить сценарий первичного брифа.",
          status: "suggested",
        },
      ],
    },
    {
      key: "sales",
      title: "Продажи",
      short: "Как быстрее доводить до оплаты",
      summary: "Система подсвечивает слабые места в сделках: где клиенту не хватает аргумента, примера или следующего шага.",
      basedOn: ["заметки менеджеров", "статусы сделок", "причины пауз"],
      ideas: [
        {
          slug: "sales-script",
          advisorKey: "sales",
          title: "Собрать короткий скрипт против вопроса «сколько стоит?»",
          effort: "40 минут",
          effect: "выше конверсия в консультацию",
          text: "Цена звучит убедительнее, когда рядом есть сценарий, результат и понятный следующий шаг.",
          next: "Добавить 3 варианта ответа для разных бюджетов.",
          status: "suggested",
        },
        {
          slug: "sales-next-step",
          advisorKey: "sales",
          title: "Добавить обязательное поле «следующий шаг»",
          effort: "20 минут",
          effect: "меньше забытых лидов",
          text: "У части сделок нет ясного действия. nomduchat будет напоминать, что именно нужно отправить клиенту дальше.",
          next: "Включить проверку сделок без следующего шага.",
          status: "suggested",
        },
      ],
    },
    {
      key: "site",
      title: "Сайт и метрики",
      short: "Что улучшить на странице",
      summary: "nomduchat связывает посещения сайта с вопросами клиентов, чтобы улучшения были не на вкус, а по реальным сигналам.",
      basedOn: ["визиты", "формы", "частые вопросы"],
      ideas: [
        {
          slug: "site-proof",
          advisorKey: "site",
          title: "Поставить блок с живыми примерами перед формой",
          effort: "1 день",
          effect: "больше доверия",
          text: "Пользователь до формы должен увидеть, что именно он получит: пример бота, сайта или ответа менеджера.",
          next: "Выбрать 3 примера и добавить короткие подписи.",
          status: "suggested",
        },
        {
          slug: "site-metric",
          advisorKey: "site",
          title: "Отделить метрику консультаций от общих сообщений",
          effort: "1-2 часа",
          effect: "понятнее эффективность сайта",
          text: "Сейчас все обращения выглядят одинаково. Разделение покажет, какие блоки приводят клиентов с намерением купить.",
          next: "Разметить формы и кнопки по источникам.",
          status: "suggested",
        },
      ],
    },
    {
      key: "support",
      title: "Поддержка",
      short: "Где клиенты спотыкаются",
      summary: "Подсказки показывают повторяющиеся вопросы и помогают превратить их в понятные ответы, инструкции и автоматизацию.",
      basedOn: ["обращения", "FAQ", "паузы в ответах"],
      ideas: [
        {
          slug: "support-faq",
          advisorKey: "support",
          title: "Собрать ответы на 10 повторяющихся вопросов",
          effort: "1 час",
          effect: "быстрее первая линия",
          text: "Если ответ уже готов, поддержка не импровизирует, а клиент быстрее получает ясность.",
          next: "Выгрузить вопросы из последних обращений.",
          status: "suggested",
        },
        {
          slug: "support-tags",
          advisorKey: "support",
          title: "Помечать обращения по проблеме клиента",
          effort: "30 минут",
          effect: "видно, что мешает покупке",
          text: "Теги вроде «нет цены», «сомневается», «не понял услугу» покажут, что нужно исправить в продажах и на сайте.",
          next: "Добавить 5 базовых тегов в CRM.",
          status: "suggested",
        },
      ],
    },
  ],
};

export function createSeedSnapshot(userId: string, access: BusinessWorkspaceSnapshot["access"]): BusinessWorkspaceSnapshot {
  const now = new Date().toISOString();
  const workspace: BusinessWorkspaceRecord = {
    id: `${userId}-business-workspace`,
    userId,
    name: businessWorkspaceSeed.workspaceName,
    createdAt: now,
    updatedAt: now,
  };

  const deals = businessWorkspaceSeed.deals.map((deal) => ({
    id: deal.slug,
    workspaceId: workspace.id,
    client: deal.client,
    request: deal.request,
    stage: deal.stage,
    amount: deal.amount,
    source: deal.source,
    nextStep: deal.nextStep,
    problem: deal.problem,
    createdAt: now,
    updatedAt: now,
    notes: deal.notes.map((note) => ({
      ...note,
      dealId: deal.slug,
    })),
  }));

  return {
    workspace,
    access,
    roles: [...businessWorkspaceSeed.roles],
    members: businessWorkspaceSeed.members.map((member) => ({
      ...member,
      workspaceId: workspace.id,
      userId: member.roleKey === "owner" ? userId : null,
      invitedEmail: null,
      createdAt: now,
      updatedAt: now,
    })),
    groups: [
      {
        id: `${workspace.id}-main-group`,
        workspaceId: workspace.id,
        name: `${workspace.name}: общая группа`,
        purpose: "Рабочее пространство, которое автоматически создается после подключения Business.",
        memberIds: businessWorkspaceSeed.members.map((member) => member.id),
        createdAt: now,
        updatedAt: now,
      },
    ],
    employeeReports: businessWorkspaceSeed.members.map((member, index) => ({
      id: `${workspace.id}-${member.id}-report`,
      workspaceId: workspace.id,
      memberId: member.id,
      userId: member.roleKey === "owner" ? userId : null,
      employeeName: member.name,
      roleTitle: member.roleTitle,
      reportDate: now.slice(0, 10),
      requestsCount: [14, 27, 22, 11, 8][index] ?? 0,
      chatsCount: [4, 9, 12, 3, 2][index] ?? 0,
      clientReportsCount: [2, 5, 7, 1, 1][index] ?? 0,
      lastActivityAt: now,
      summary:
        member.roleKey === "owner"
          ? "Контролирует кабинет, подписку и решения по росту."
          : "Активность сотрудника попадает в дневной отчет бизнеса.",
    })),
    stats: [...businessWorkspaceSeed.stats],
    knowledgeSources: [...businessWorkspaceSeed.knowledgeSources],
    paidServices: [...businessWorkspaceSeed.paidServices],
    pipeline: [...businessWorkspaceSeed.pipeline],
    deals,
    customerSignals: [...businessWorkspaceSeed.customerSignals],
    trafficSources: [...businessWorkspaceSeed.trafficSources],
    advisorViews: businessWorkspaceSeed.advisors.map((advisor) => ({
      key: advisor.key,
      title: advisor.title,
      short: advisor.short,
      summary: advisor.summary,
      basedOn: [...advisor.basedOn],
      ideas: advisor.ideas.map((idea) => ({
        id: idea.slug,
        workspaceId: workspace.id,
        advisorKey: idea.advisorKey,
        title: idea.title,
        effort: idea.effort,
        effect: idea.effect,
        text: idea.text,
        next: idea.next,
        status: idea.status,
        createdAt: now,
        updatedAt: now,
      })),
    })),
  };
}

export function isBusinessRoleKey(value: string): value is BusinessRoleKey {
  return ["owner", "sales", "support", "marketing", "developer"].includes(value);
}

export function isBusinessMemberStatus(value: string): value is BusinessMemberStatus {
  return ["online", "away", "offline"].includes(value);
}

export function isBusinessIdeaStatus(value: string): value is BusinessIdeaStatus {
  return ["suggested", "planned", "in_progress", "done"].includes(value);
}

export function isAdvisorKey(value: string): value is AdvisorKey {
  return ["growth", "sales", "site", "support"].includes(value);
}
