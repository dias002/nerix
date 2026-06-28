import { DomainError, fail, ok } from "../../domain/result.js";
import { config } from "../../config.js";
import type { TelegramBotOrderRepository } from "./telegram-bot.repository.js";
import type {
  CreateTelegramBotOrderInput,
  CreateTelegramBotOrderRepositoryInput,
  TelegramBotCountry,
  TelegramMiniAppDraftInput,
  TelegramBotPrice,
  TelegramBotTestReply,
  TelegramBotTone,
} from "./telegram-bot.types.js";

const telegramBotPrices: Record<TelegramBotCountry, TelegramBotPrice> = {
  KZ: {
    country: "KZ",
    currency: "KZT",
    amountMinor: 3_500_000,
    label: "35 000 ₸",
  },
  RU: {
    country: "RU",
    currency: "RUB",
    amountMinor: 700_000,
    label: "7 000 ₽",
  },
};

const toneLabels: Record<TelegramBotTone, string> = {
  friendly: "дружелюбный и простой",
  expert: "экспертный и уверенный",
  sales: "продающий, но без давления",
  strict: "строгий, короткий и по правилам",
};

export class TelegramBotOrderService {
  constructor(private readonly repository: TelegramBotOrderRepository) {}

  getProduct() {
    return ok({
      product: {
        title: "Telegram-бот под ключ",
        description:
          "Быстрый опрос собирает данные компании, услуги, правила ответа и контакты для передачи человеку. После согласования запуска бот подключается к Telegram и получает готовую инструкцию поведения.",
        prices: Object.values(telegramBotPrices),
        steps: [
          "Заполнить короткий опрос по компании и услугам.",
          "Получить готовые правила ответа и техническое задание.",
          "Согласовать запуск и следующий шаг подключения.",
          "Передать username/token из BotFather для подключения.",
        ],
      },
    });
  }

  async listOrders(userId: string) {
    return ok({
      orders: await this.repository.listByUser(userId),
    });
  }

  async testOrderReply(userId: string, input: { orderId: string; message: string }) {
    const order = await this.repository.findById(userId, input.orderId);
    if (!order) {
      return fail(new DomainError("not_found", "Telegram bot order was not found.", 404));
    }

    const customerMessage = clean(input.message).slice(0, 2_000);
    if (!customerMessage) {
      return fail(new DomainError("validation_failed", "Customer message is required.", 400));
    }

    return ok(buildTestReply(order, customerMessage));
  }

  createMiniAppDraft(input: TelegramMiniAppDraftInput) {
    const normalized = normalizeMiniAppInput(input);
    if (!normalized.companyName || !normalized.businessCategory || !normalized.contact || !normalized.mainOffer) {
      return fail(new DomainError("validation_failed", "Заполните компанию, нишу, контакт и основной оффер.", 400));
    }

    const price = telegramBotPrices[normalized.country];
    const botName = buildBotName(normalized.companyName);
    const usernameSuggestions = buildUsernameSuggestions(normalized.companyName, normalized.businessCategory);
    const goals = normalized.goals.length ? normalized.goals : ["answers", "leads"];
    const tone = goals.includes("sales") || goals.includes("leads") ? "sales" : "friendly";
    const audience =
      normalized.audience ||
      (normalized.city
        ? `Клиенты из ${normalized.city}, которые интересуются услугами компании.`
        : "Клиенты, которые пишут в Telegram и хотят быстро получить консультацию.");
    const services = buildServices(normalized.mainOffer, normalized.priceInfo);
    const botPurpose = buildBotPurpose(goals, normalized.businessCategory);
    const responseRules = buildResponseRules(normalized.contact, normalized.priceInfo, normalized.knowledgeContext);
    const escalationContact = `Передавать человеку через ${normalized.contact}, если клиент просит индивидуальный расчет, спорит по условиям, хочет оплатить или задает вопрос вне базы знаний.`;
    const faq = buildFaq(
      normalized.companyName,
      services,
      normalized.priceInfo,
      normalized.contact,
      normalized.knowledgeContext
    );
    const sourceLinks = [normalized.website, normalized.knowledgeContext ? "workspace://knowledge-base" : ""]
      .filter(Boolean)
      .join("\n");
    const businessDescription = [
      `${normalized.companyName} работает в нише: ${normalized.businessCategory}.`,
      normalized.city ? `Город/регион: ${normalized.city}.` : "",
      `Основной оффер: ${asSentence(normalized.mainOffer)}`,
      normalized.knowledgeContext ? `Дополнительные знания компании:\n${normalized.knowledgeContext}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const orderPayload: Omit<CreateTelegramBotOrderInput, "botToken"> = {
      userId: normalized.userId || "local-user",
      country: normalized.country,
      companyName: normalized.companyName,
      ownerName: "",
      contact: normalized.contact,
      businessDescription,
      services,
      audience,
      botPurpose,
      tone,
      responseRules,
      escalationContact,
      faq,
      sourceLinks,
      botUsername: usernameSuggestions[0] ? `@${usernameSuggestions[0]}` : "",
    };
    const setupSummary = buildSetupSummary(orderPayload, price);
    const systemPrompt = buildSystemPrompt(orderPayload);

    return ok({
      draft: {
        country: normalized.country,
        currency: price.currency,
        amountMinor: price.amountMinor,
        priceLabel: price.label,
        companyName: normalized.companyName,
        botName,
        botUsernameSuggestions: usernameSuggestions,
        managedBotUrl: buildManagedBotUrl(usernameSuggestions[0], botName),
        audience,
        botPurpose,
        tone,
        businessDescription,
        services,
        responseRules,
        escalationContact,
        faq,
        sourceLinks,
        welcomeMessage: buildWelcomeMessage(normalized.companyName, normalized.businessCategory),
        menuButtons: buildMenuButtons(goals),
        commands: [
          { command: "start", description: "Запустить бота и показать меню" },
          { command: "services", description: "Показать услуги и условия" },
          { command: "manager", description: "Передать диалог менеджеру" },
        ],
        setupSummary,
        systemPrompt,
        orderPayload,
      },
    });
  }

  async createOrder(input: CreateTelegramBotOrderInput) {
    const normalized = normalizeOrderInput(input);
    const missingField = requiredFields.find((field) => !normalized[field]);
    if (missingField) {
      return fail(new DomainError("validation_failed", "Заполните обязательные поля Telegram-бота.", 400));
    }

    const price = telegramBotPrices[normalized.country];
    const setupSummary = buildSetupSummary(normalized, price);
    const systemPrompt = buildSystemPrompt(normalized);
    const botToken = input.botToken?.trim() ?? "";
    const repositoryInput: CreateTelegramBotOrderRepositoryInput = {
      ...normalized,
      workspaceId: null,
      currency: price.currency,
      amountMinor: price.amountMinor,
      status: "ready_for_payment",
      botTokenProvided: Boolean(botToken),
      botTokenHint: botToken ? maskTelegramToken(botToken) : null,
      setupSummary,
      systemPrompt,
    };

    const order = await this.repository.create(repositoryInput);
    if (!order) {
      return fail(new DomainError("not_found", `User '${input.userId}' was not found.`, 404));
    }

    return ok({ order });
  }
}

function buildTestReply(
  order: {
    id: string;
    companyName: string;
    services: string;
    faq: string;
    responseRules: string;
    escalationContact: string;
    botPurpose: string;
    tone: TelegramBotTone;
  },
  customerMessage: string
): TelegramBotTestReply {
  const normalized = customerMessage.toLowerCase();
  const matchedKnowledge = selectRelevantKnowledge([order.services, order.faq, order.responseRules], normalized);
  const shouldEscalate = shouldEscalateMessage(normalized);
  const tonePrefix =
    order.tone === "strict"
      ? ""
      : order.tone === "expert"
        ? "Отвечаю по доступным данным. "
        : order.tone === "sales"
          ? "Спасибо за интерес. "
          : "Здравствуйте. ";
  const knowledgeText = matchedKnowledge[0] ?? order.services.split("\n").find(Boolean) ?? order.botPurpose;
  const nextStep = shouldEscalate
    ? `Передам вопрос человеку: ${order.escalationContact}.`
    : `Могу уточнить детали и передать заявку менеджеру: ${order.escalationContact}.`;

  return {
    orderId: order.id,
    customerMessage,
    shouldEscalate,
    escalationContact: order.escalationContact,
    matchedKnowledge,
    reply: `${tonePrefix}${knowledgeText}\n\n${nextStep}`.trim(),
  };
}

function selectRelevantKnowledge(sources: string[], normalizedMessage: string) {
  const keywords = normalizedMessage
    .split(/[^a-zа-яё0-9]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4)
    .slice(0, 12);

  return sources
    .flatMap((source) => source.split(/\n+/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const normalizedLine = line.toLowerCase();
      return keywords.length === 0 || keywords.some((keyword) => normalizedLine.includes(keyword));
    })
    .slice(0, 3);
}

function shouldEscalateMessage(normalizedMessage: string) {
  return [
    "скид",
    "договор",
    "оплат",
    "счет",
    "счёт",
    "индивидуаль",
    "руковод",
    "менедж",
    "жалоб",
    "возврат",
    "срочно",
  ].some((needle) => normalizedMessage.includes(needle));
}

function normalizeMiniAppInput(input: TelegramMiniAppDraftInput) {
  return {
    userId: input.userId?.trim() || "",
    country: input.country === "RU" ? "RU" as const : "KZ" as const,
    companyName: clean(input.companyName),
    businessCategory: clean(input.businessCategory),
    city: clean(input.city ?? ""),
    contact: clean(input.contact),
    website: clean(input.website ?? ""),
    mainOffer: clean(input.mainOffer),
    priceInfo: clean(input.priceInfo ?? ""),
    audience: clean(input.audience ?? ""),
    knowledgeContext: clean(input.knowledgeContext ?? ""),
    goals: input.goals.map((goal) => clean(goal)).filter(Boolean).slice(0, 8),
    language: input.language ?? "ru",
    telegramInitData: input.telegramInitData ?? "",
  };
}

const requiredFields = [
  "companyName",
  "contact",
  "businessDescription",
  "services",
  "botPurpose",
  "responseRules",
  "escalationContact",
] as const;

function normalizeOrderInput(input: CreateTelegramBotOrderInput): Omit<CreateTelegramBotOrderInput, "botToken"> {
  return {
    userId: input.userId,
    country: input.country === "RU" ? "RU" : "KZ",
    companyName: clean(input.companyName),
    ownerName: clean(input.ownerName ?? ""),
    contact: clean(input.contact),
    businessDescription: clean(input.businessDescription),
    services: clean(input.services),
    audience: clean(input.audience ?? ""),
    botPurpose: clean(input.botPurpose),
    tone: normalizeTone(input.tone),
    responseRules: clean(input.responseRules),
    escalationContact: clean(input.escalationContact),
    faq: clean(input.faq ?? ""),
    sourceLinks: clean(input.sourceLinks ?? ""),
    botUsername: clean(input.botUsername ?? ""),
  };
}

function buildSetupSummary(input: Omit<CreateTelegramBotOrderInput, "botToken">, price: TelegramBotPrice) {
  return [
    `Стоимость: ${price.label}.`,
    `Компания: ${input.companyName}.`,
    input.ownerName ? `Владелец/ответственный: ${input.ownerName}.` : "",
    `Контакт для запуска: ${input.contact}.`,
    `Что делает бот: ${input.botPurpose}.`,
    `Услуги и офферы: ${input.services}.`,
    input.audience ? `Кому отвечает: ${input.audience}.` : "",
    `Тон общения: ${toneLabels[input.tone]}.`,
    `Правила ответа: ${input.responseRules}.`,
    `Когда передать человеку: ${input.escalationContact}.`,
    input.faq ? `FAQ/готовые ответы: ${input.faq}.` : "",
    input.sourceLinks ? `Источники знаний: ${input.sourceLinks}.` : "",
    input.botUsername ? `Telegram username бота: ${input.botUsername}.` : "Telegram username бота нужно добавить после BotFather.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSystemPrompt(input: Omit<CreateTelegramBotOrderInput, "botToken">) {
  return [
    `Ты Telegram-ассистент компании "${input.companyName}".`,
    `Описание бизнеса: ${input.businessDescription}.`,
    `Главная задача бота: ${input.botPurpose}.`,
    `Тон общения: ${toneLabels[input.tone]}.`,
    `Услуги, цены и офферы, на которые можно опираться: ${input.services}.`,
    input.audience ? `Типовая аудитория: ${input.audience}.` : "",
    input.faq ? `FAQ и готовые ответы: ${input.faq}.` : "",
    input.sourceLinks ? `Дополнительные источники знаний: ${input.sourceLinks}.` : "",
    `Правила ответа: ${input.responseRules}.`,
    `Если вопрос выходит за рамки данных, не придумывай. Уточни детали или передай человеку: ${input.escalationContact}.`,
    "В каждом диалоге помогай клиенту быстро понять услугу, собрать нужные данные и оставить контакт для менеджера.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildBotName(companyName: string) {
  return `${companyName} assistant`.slice(0, 64);
}

function buildUsernameSuggestions(companyName: string, businessCategory: string) {
  const base = slugify(companyName) || "nomduchat";
  const category = slugify(businessCategory).split("_")[0] || "bot";
  return [...new Set([`${base}_bot`, `${base}_${category}_bot`, `${base}_support_bot`])]
    .map((item) => item.slice(0, 32).replace(/_+$/g, ""))
    .filter((item) => item.length >= 5);
}

function buildManagedBotUrl(username: string | undefined, botName: string) {
  const managerUsername = config.TELEGRAM_MANAGER_BOT_USERNAME?.replace(/^@/, "").trim();
  if (!managerUsername || !username) return null;

  const url = new URL(`https://t.me/newbot/${managerUsername}/${username}`);
  url.searchParams.set("name", botName);
  return url.toString();
}

function buildServices(mainOffer: string, priceInfo: string) {
  return [
    "Основной оффер:",
    mainOffer,
    priceInfo ? `\nЦены и условия:\n${priceInfo}` : "\nЕсли точной цены нет, бот должен собрать данные и передать менеджеру.",
  ].join("\n");
}

function buildBotPurpose(goals: string[], category: string) {
  const parts = [];
  if (goals.includes("answers")) parts.push("отвечать на частые вопросы");
  if (goals.includes("leads")) parts.push("собирать заявки и контакты");
  if (goals.includes("sales")) parts.push("подводить клиента к покупке или консультации");
  if (goals.includes("support")) parts.push("снимать нагрузку с поддержки");
  if (goals.includes("booking")) parts.push("помогать с записью или бронированием");

  const purpose = parts.length ? parts.join(", ") : "консультировать клиентов и передавать заявки менеджеру";
  return `Бот для ниши "${category}": ${purpose}.`;
}

function buildResponseRules(contact: string, priceInfo: string, knowledgeContext: string) {
  return [
    "Отвечать коротко, понятно и по делу.",
    "Не придумывать цены, сроки, скидки и наличие, если этих данных нет в оффере.",
    priceInfo ? "Если клиент спрашивает цену, опираться только на указанный прайс." : "Если клиент спрашивает цену, собрать задачу и передать менеджеру.",
    knowledgeContext ? "Если есть факты из базы знаний workspace, опираться на них как на источник правды." : "",
    "В каждом диалоге стараться получить имя, телефон или Telegram username клиента.",
    `Когда нужен человек, передавать контакт: ${contact}.`,
  ].join("\n");
}

function buildFaq(companyName: string, services: string, priceInfo: string, contact: string, knowledgeContext: string) {
  return [
    `Вопрос: Чем занимается ${companyName}?`,
    `Ответ: ${services.split("\n").slice(0, 3).join(" ")}`,
    "",
    "Вопрос: Сколько стоит?",
    `Ответ: ${priceInfo || "Цена зависит от задачи. Напишите детали, и менеджер подготовит расчет."}`,
    "",
    "Вопрос: Как оставить заявку?",
    "Ответ: Напишите, что вам нужно, город/объем/сроки и контакт для связи.",
    knowledgeContext ? `\n\nДополнительные знания:\n${knowledgeContext}` : "",
    "",
    "Вопрос: Как связаться с человеком?",
    `Ответ: Я передам диалог менеджеру: ${contact}.`,
  ].join("\n");
}

function buildWelcomeMessage(companyName: string, category: string) {
  return `Здравствуйте. Я помощник ${companyName}. Помогу с вопросами по направлению "${category}", подскажу условия и передам заявку менеджеру.`;
}

function buildMenuButtons(goals: string[]) {
  const buttons = ["Услуги", "Оставить заявку", "Связаться с менеджером"];
  if (goals.includes("booking")) buttons.splice(1, 0, "Записаться");
  if (goals.includes("support")) buttons.push("Вопрос в поддержку");
  return buttons;
}

function slugify(value: string) {
  const translit = value
    .toLowerCase()
    .replace(/а/g, "a")
    .replace(/б/g, "b")
    .replace(/в/g, "v")
    .replace(/г/g, "g")
    .replace(/д/g, "d")
    .replace(/е/g, "e")
    .replace(/ё/g, "e")
    .replace(/ж/g, "zh")
    .replace(/з/g, "z")
    .replace(/и/g, "i")
    .replace(/й/g, "y")
    .replace(/к/g, "k")
    .replace(/л/g, "l")
    .replace(/м/g, "m")
    .replace(/н/g, "n")
    .replace(/о/g, "o")
    .replace(/п/g, "p")
    .replace(/р/g, "r")
    .replace(/с/g, "s")
    .replace(/т/g, "t")
    .replace(/у/g, "u")
    .replace(/ф/g, "f")
    .replace(/х/g, "h")
    .replace(/ц/g, "c")
    .replace(/ч/g, "ch")
    .replace(/ш/g, "sh")
    .replace(/щ/g, "sch")
    .replace(/ы/g, "y")
    .replace(/э/g, "e")
    .replace(/ю/g, "yu")
    .replace(/я/g, "ya");

  return translit.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function maskTelegramToken(token: string) {
  return `***${token.slice(-6)}`;
}

function normalizeTone(value: TelegramBotTone): TelegramBotTone {
  if (value === "expert" || value === "sales" || value === "strict") return value;
  return "friendly";
}

function clean(value: string) {
  return value.trim().replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

function asSentence(value: string) {
  const cleaned = clean(value);
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}
