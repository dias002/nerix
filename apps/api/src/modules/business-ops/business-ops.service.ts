import { DomainError, fail, ok } from "../../domain/result.js";
import type { BusinessService } from "../business/business.service.js";
import type {
  BusinessOpsRepository,
  PersistBusinessConversationAnalysisInput,
  PersistBusinessCustomerMessageInput,
} from "./business-ops.repository.js";
import type {
  BusinessConversationAnalysis,
  BusinessConversationRating,
  BusinessConversationStatus,
  BusinessCustomerChannel,
  BusinessCustomerConversationRecord,
  BusinessCustomerMessageRole,
  BusinessOpsMetric,
  CreateBusinessCustomerConversationInput,
  CreateBusinessCustomerMessageInput,
  CreateBusinessTeamMessageInput,
} from "./business-ops.types.js";

const maxConversationMessages = 80;

export class BusinessOpsService {
  constructor(
    private readonly repository: BusinessOpsRepository,
    private readonly business: BusinessService
  ) {}

  async getOverview(userId: string) {
    const workspace = await this.resolveWorkspace(userId);
    if (!workspace.ok) return workspace;

    const [conversations, teamMessages] = await Promise.all([
      this.repository.listConversations(workspace.value.workspace.id),
      this.repository.listTeamMessages(workspace.value.workspace.id),
    ]);

    return ok({
      workspaceId: workspace.value.workspace.id,
      metrics: buildMetrics(conversations),
      conversations,
      teamMessages,
    });
  }

  async createConversation(userId: string, input: CreateBusinessCustomerConversationInput) {
    const workspace = await this.resolveWorkspace(userId);
    if (!workspace.ok) return workspace;

    if (!isBusinessCustomerChannel(input.channel)) {
      return fail(new DomainError("validation_failed", "Customer conversation channel is invalid.", 400));
    }

    const messages = normalizeCustomerMessages(input.messages);
    if (messages.length === 0) {
      return fail(new DomainError("validation_failed", "At least one customer conversation message is required.", 400));
    }

    const analysis = analyzeConversation(messages, {
      channel: input.channel,
      customerContact: input.customerContact ?? "",
      customerName: input.customerName ?? "",
    });
    const conversation = await this.repository.createConversation({
      workspaceId: workspace.value.workspace.id,
      channel: input.channel,
      customerName: input.customerName?.trim() || "Клиент",
      customerContact: input.customerContact?.trim() ?? "",
      source: input.source?.trim() || input.channel,
      status: analysis.status,
      aiRating: analysis.aiRating,
      analysis: analysis.analysis,
      trainingAllowed: Boolean(input.trainingAllowed),
      messages,
    });

    if (!conversation) {
      return fail(new DomainError("internal_error", "Business customer conversation was not created.", 500));
    }

    return ok({ conversation, overview: await this.buildOverview(workspace.value.workspace.id) });
  }

  async addCustomerMessage(userId: string, conversationId: string, input: CreateBusinessCustomerMessageInput) {
    const workspace = await this.resolveWorkspace(userId);
    if (!workspace.ok) return workspace;

    const message = normalizeCustomerMessage(input);
    if (!message) {
      return fail(new DomainError("validation_failed", "Customer message text is required.", 400));
    }

    const existingConversations = await this.repository.listConversations(workspace.value.workspace.id);
    const existingConversation = existingConversations.find((conversation) => conversation.id === conversationId);
    if (!existingConversation) {
      return fail(new DomainError("not_found", `Business conversation '${conversationId}' was not found.`, 404));
    }

    const analysis = analyzeConversation([...existingConversation.messages, message], {
      channel: existingConversation.channel,
      customerContact: existingConversation.customerContact,
      customerName: existingConversation.customerName,
    });
    const updated = await this.repository.addCustomerMessage(workspace.value.workspace.id, conversationId, message, {
      status: analysis.status,
      aiRating: analysis.aiRating,
      analysis: analysis.analysis,
    });
    if (!updated) {
      return fail(new DomainError("not_found", `Business conversation '${conversationId}' was not found.`, 404));
    }

    return ok({ conversation: updated, overview: await this.buildOverview(workspace.value.workspace.id) });
  }

  async rateConversation(userId: string, conversationId: string, rating: BusinessConversationRating) {
    if (!isBusinessConversationRating(rating)) {
      return fail(new DomainError("validation_failed", "Business conversation rating is invalid.", 400));
    }

    const workspace = await this.resolveWorkspace(userId);
    if (!workspace.ok) return workspace;

    const updated = await this.repository.rateConversation(workspace.value.workspace.id, conversationId, rating);
    if (!updated) {
      return fail(new DomainError("not_found", `Business conversation '${conversationId}' was not found.`, 404));
    }

    return ok({ conversation: updated, overview: await this.buildOverview(workspace.value.workspace.id) });
  }

  async addTeamMessage(userId: string, input: CreateBusinessTeamMessageInput) {
    const workspace = await this.resolveWorkspace(userId);
    if (!workspace.ok) return workspace;

    const text = input.text.trim();
    if (!text) {
      return fail(new DomainError("validation_failed", "Team message text is required.", 400));
    }

    const authorName = input.authorName.trim() || "Сотрудник";
    const message = await this.repository.addTeamMessage({
      workspaceId: workspace.value.workspace.id,
      memberId: input.memberId ?? null,
      authorName,
      roleTitle: input.roleTitle?.trim() || "Команда",
      text,
    });
    if (!message) {
      return fail(new DomainError("internal_error", "Business team message was not created.", 500));
    }

    return ok({ message, overview: await this.buildOverview(workspace.value.workspace.id) });
  }

  private async resolveWorkspace(userId: string) {
    const workspace = await this.business.getWorkspace(userId);
    if (!workspace.ok) return fail(workspace.error);
    return ok(workspace.value);
  }

  private async buildOverview(workspaceId: string) {
    const [conversations, teamMessages] = await Promise.all([
      this.repository.listConversations(workspaceId),
      this.repository.listTeamMessages(workspaceId),
    ]);

    return {
      workspaceId,
      metrics: buildMetrics(conversations),
      conversations,
      teamMessages,
    };
  }
}

function normalizeCustomerMessages(messages: CreateBusinessCustomerMessageInput[]) {
  return messages.map(normalizeCustomerMessage).filter((message): message is PersistBusinessCustomerMessageInput => Boolean(message));
}

function normalizeCustomerMessage(input: CreateBusinessCustomerMessageInput): PersistBusinessCustomerMessageInput | null {
  const content = input.content.trim();
  if (!content) return null;
  if (!isBusinessCustomerMessageRole(input.role)) return null;

  return {
    role: input.role,
    authorName: input.authorName?.trim() || defaultAuthorName(input.role),
    content: content.slice(0, 4_000),
  };
}

function analyzeConversation(
  messages: Array<PersistBusinessCustomerMessageInput | { role: BusinessCustomerMessageRole; content: string }>,
  context: { channel: BusinessCustomerChannel; customerName: string; customerContact: string }
): PersistBusinessConversationAnalysisInput {
  const recentMessages = messages.slice(-maxConversationMessages);
  const customerText = recentMessages
    .filter((message) => message.role === "customer")
    .map((message) => message.content)
    .join("\n");
  const fullText = recentMessages.map((message) => message.content).join("\n");
  const normalized = fullText.toLowerCase();
  const customerNormalized = customerText.toLowerCase();
  const objections = detectObjections(normalized);
  const desiredProducts = detectDesiredProducts(customerText);
  const intent = detectIntent(customerNormalized);
  const sentiment = detectSentiment(normalized, objections);
  const score = scoreConversation(normalized, objections, context.customerContact);
  const status = detectStatus(normalized, score, objections);
  const aiRating = ratingFromScore(score);
  const goal = goalFromIntent(intent);
  const nextStep = nextStepFromStatus(status, objections, context.customerContact);
  const summary = summarizeConversation(context.customerName, goal, objections, desiredProducts);
  const tags = [
    context.channel === "telegram" ? "telegram" : context.channel === "website" ? "сайт" : "ручной импорт",
    ...desiredProducts.slice(0, 3),
    objections.length > 0 ? "есть возражения" : "без явных возражений",
  ];

  return {
    status,
    aiRating,
    analysis: {
      summary,
      goal,
      intent,
      objections,
      desiredProducts,
      sentiment,
      outcome: outcomeFromStatus(status),
      nextStep,
      score,
      tags: [...new Set(tags)],
      trainingSignal:
        "Сохранены цель клиента, возражения, интерес и оценка качества диалога. Для обучения использовать только при включенном согласии.",
    },
  };
}

function detectIntent(text: string) {
  if (containsAny(text, ["купить", "заказать", "беру", "оформить", "оплатить"])) return "purchase";
  if (containsAny(text, ["цена", "стоимость", "сколько", "прайс", "дорого"])) return "price";
  if (containsAny(text, ["доставка", "срок", "когда", "получить"])) return "delivery";
  if (containsAny(text, ["запис", "бронь", "консультац", "созвон"])) return "booking";
  if (containsAny(text, ["сравнить", "подойдет", "какой выбрать", "посоветуйте"])) return "choice";
  return "consultation";
}

function detectObjections(text: string) {
  const objections: string[] = [];
  if (containsAny(text, ["дорого", "скидк", "дешевле", "цена высокая"])) objections.push("сомнение в цене");
  if (containsAny(text, ["подумаю", "позже", "не сейчас", "надо подумать"])) objections.push("клиент откладывает решение");
  if (containsAny(text, ["не уверен", "сомневаюсь", "отзывы", "гарант", "довер"])) objections.push("нужно больше доверия");
  if (containsAny(text, ["нет времени", "долго", "сроки не подходят"])) objections.push("не подходят сроки");
  return [...new Set(objections)];
}

function detectDesiredProducts(text: string) {
  const normalized = text.toLowerCase();
  const products: string[] = [];
  const dictionary = [
    ["сайт", "сайт"],
    ["бот", "Telegram-бот"],
    ["менеджер", "ИИ-менеджер"],
    ["доставка", "доставка"],
    ["каталог", "каталог"],
    ["запись", "запись"],
    ["консультация", "консультация"],
    ["опт", "оптовый заказ"],
    ["цена", "цена"],
    ["тариф", "тариф"],
  ] as const;

  for (const [needle, label] of dictionary) {
    if (normalized.includes(needle)) products.push(label);
  }

  const match = normalized.match(/(?:хочу|нужен|интересует|заказать|купить)\s+([а-яa-z0-9\s-]{3,42})/iu);
  if (match?.[1]) {
    products.unshift(match[1].trim().replace(/[,.!?].*$/, ""));
  }

  return [...new Set(products)].slice(0, 6);
}

function detectSentiment(text: string, objections: string[]): BusinessConversationAnalysis["sentiment"] {
  if (containsAny(text, ["спасибо", "отлично", "супер", "беру", "подходит", "готов"])) return "positive";
  if (objections.length > 0 || containsAny(text, ["не подходит", "плохо", "не хочу", "отказ"])) return "negative";
  return "neutral";
}

function scoreConversation(text: string, objections: string[], contact: string) {
  let score = 55;
  if (contact.trim()) score += 10;
  if (containsAny(text, ["купить", "заказать", "беру", "оформить", "оплатить", "готов"])) score += 22;
  if (containsAny(text, ["цена", "стоимость", "условия", "срок", "доставка"])) score += 8;
  if (containsAny(text, ["телефон", "whatsapp", "ватсап", "telegram", "@"])) score += 8;
  score -= objections.length * 12;
  if (containsAny(text, ["подумаю", "не сейчас", "позже"])) score -= 10;
  return Math.max(15, Math.min(100, score));
}

function detectStatus(text: string, score: number, objections: string[]): BusinessConversationStatus {
  if (containsAny(text, ["оплатил", "оплатила", "оформили", "беру", "готов оплатить"])) return "won";
  if (containsAny(text, ["отказ", "не подходит", "не интересно"]) || (score < 40 && objections.length > 0)) return "lost";
  if (containsAny(text, ["передайте", "менеджер", "созвон", "расчет", "индивидуальная цена"])) return "waiting_human";
  if (score >= 68) return "qualified";
  return "new";
}

function ratingFromScore(score: number): BusinessConversationRating {
  if (score >= 80) return "excellent";
  if (score < 50) return "bad";
  return "good";
}

function goalFromIntent(intent: string) {
  if (intent === "purchase") return "Клиент близок к покупке или оформлению заявки.";
  if (intent === "price") return "Клиент уточняет цену и условия.";
  if (intent === "delivery") return "Клиента интересуют сроки и доставка.";
  if (intent === "booking") return "Клиент хочет записаться или договориться о следующем контакте.";
  if (intent === "choice") return "Клиент выбирает подходящий вариант.";
  return "Клиент пришел за консультацией.";
}

function nextStepFromStatus(status: BusinessConversationStatus, objections: string[], contact: string) {
  if (status === "won") return "Зафиксировать оплату или следующий операционный шаг.";
  if (status === "lost") return "Сохранить причину отказа и вернуться с более точным предложением позже.";
  if (status === "waiting_human") return "Передать разговор менеджеру с кратким итогом и контактом клиента.";
  if (!contact.trim()) return "Попросить телефон, Telegram или WhatsApp, чтобы заявка не потерялась.";
  if (objections.length > 0) return "Закрыть главное возражение и предложить простой следующий шаг.";
  return "Подтвердить интерес и довести клиента до заявки.";
}

function outcomeFromStatus(status: BusinessConversationStatus) {
  if (status === "won") return "Покупка или оплата почти завершена.";
  if (status === "lost") return "Диалог похож на отказ.";
  if (status === "waiting_human") return "Нужен человек: расчет, оплата или индивидуальные условия.";
  if (status === "qualified") return "Клиент выглядит перспективным.";
  return "Диалог требует уточнения.";
}

function summarizeConversation(customerName: string, goal: string, objections: string[], desiredProducts: string[]) {
  const who = customerName.trim() || "Клиент";
  const products = desiredProducts.length > 0 ? ` Интерес: ${desiredProducts.join(", ")}.` : "";
  const objectionText = objections.length > 0 ? ` Возражения: ${objections.join(", ")}.` : "";
  return `${who}: ${goal}${products}${objectionText}`;
}

function buildMetrics(conversations: BusinessCustomerConversationRecord[]): BusinessOpsMetric[] {
  const hotLeads = conversations.filter(
    (conversation) =>
      conversation.status === "qualified" || conversation.status === "waiting_human" || conversation.status === "won"
  ).length;
  const objections = conversations.reduce((sum, conversation) => sum + conversation.analysis.objections.length, 0);
  const averageScore =
    conversations.length === 0
      ? 0
      : Math.round(conversations.reduce((sum, conversation) => sum + conversation.analysis.score, 0) / conversations.length);
  const ratedExcellent = conversations.filter((conversation) => conversation.ownerRating === "excellent").length;

  return [
    { label: "Диалоги", value: String(conversations.length), detail: "с сайта, Telegram и ручного импорта" },
    { label: "Горячие", value: String(hotLeads), detail: "можно передавать менеджеру" },
    { label: "Средний балл", value: String(averageScore), detail: "качество по анализу диалогов" },
    { label: "Возражения", value: String(objections), detail: "зафиксировано системой" },
    { label: "Отличные", value: String(ratedExcellent), detail: "оценены владельцем" },
  ];
}

function containsAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function isBusinessCustomerChannel(value: string): value is BusinessCustomerChannel {
  return value === "telegram" || value === "website" || value === "manual";
}

function isBusinessCustomerMessageRole(value: string): value is BusinessCustomerMessageRole {
  return value === "customer" || value === "bot" || value === "employee" || value === "system";
}

function isBusinessConversationRating(value: string): value is BusinessConversationRating {
  return value === "bad" || value === "good" || value === "excellent";
}

function defaultAuthorName(role: BusinessCustomerMessageRole) {
  if (role === "customer") return "Клиент";
  if (role === "bot") return "ИИ-менеджер";
  if (role === "employee") return "Сотрудник";
  return "Система";
}
