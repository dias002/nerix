import type { ConversationMessage } from "./conversation.types.js";

export type ChatAttachment = {
  name: string;
  type?: string;
  size: number;
  content?: string;
  truncated?: boolean;
};

export type ResponseStyle = "auto" | "business" | "business_visual" | "conversational" | "brief" | "detailed";

export function createConversationTitle(message: string) {
  const title = message.replace(/\s+/g, " ").trim();
  return title.length > 48 ? `${title.slice(0, 45)}...` : title;
}

export function createPromptExcerpt(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized.length > 500 ? `${normalized.slice(0, 497)}...` : normalized;
}

export function buildConversationPrompt(previousMessages: ConversationMessage[], currentPrompt: string) {
  const contextMessages = collectContextMessages(previousMessages, 12);

  if (contextMessages.length === 0) return currentPrompt;

  return [
    "Используй контекст текущего диалога. Учитывай имена, просьбы, уточнения и ограничения, которые уже были сказаны.",
    "Не начинай разговор заново, если пользователь пишет короткое уточнение.",
    "Если последнее сообщение пользователя спрашивает \"какие детали?\", \"что именно?\" или \"каких?\", отвечай относительно последней просьбы из контекста. Не спрашивай, какие детали пользователь имеет в виду.",
    "Если запрос достаточно понятен, дай готовый результат и только потом предложи, что можно уточнить.",
    "",
    "Контекст диалога:",
    formatContext(contextMessages),
    "",
    "Последнее сообщение пользователя:",
    currentPrompt,
  ].join("\n");
}

export function applyResponseStyle(prompt: string, style: ResponseStyle | undefined) {
  if (!style || style === "auto") return prompt;

  return [responseStyleInstruction(style), "", "Запрос пользователя:", prompt].join("\n");
}

export function buildRoutingPrompt(previousMessages: ConversationMessage[], currentPrompt: string) {
  if (!isContextualMediaFollowUp(currentPrompt)) return currentPrompt;

  const contextMessages = collectContextMessages(previousMessages, 6);
  if (contextMessages.length === 0) return currentPrompt;

  return [
    "Контекст нужен только для выбора типа запроса и агента.",
    "",
    "Контекст диалога:",
    formatContext(contextMessages),
    "",
    "Последняя просьба пользователя:",
    currentPrompt,
  ].join("\n");
}

export function buildMediaGenerationPrompt(previousMessages: ConversationMessage[], currentPrompt: string) {
  const contextMessages = collectContextMessages(previousMessages, 8);

  if (contextMessages.length === 0) return currentPrompt;

  return [
    "Создай медиа по последней просьбе пользователя.",
    "Если пользователь ссылается на прошлый текст, песню, идею или описание словами вроде \"это\", \"этот текст\", \"который ты скинул\", используй контекст ниже.",
    "",
    "Контекст диалога:",
    formatContext(contextMessages),
    "",
    "Последняя просьба пользователя:",
    currentPrompt,
  ].join("\n");
}

export function normalizeAttachments(attachments: ChatAttachment[] | undefined) {
  return (attachments ?? []).slice(0, 5).map((attachment) => ({
    name: attachment.name.slice(0, 180),
    type: attachment.type?.slice(0, 120) || "application/octet-stream",
    size: attachment.size,
    content: attachment.content?.slice(0, 20_000),
    truncated: Boolean(attachment.truncated),
  }));
}

export function buildPrompt(message: string, attachments: ChatAttachment[]) {
  if (attachments.length === 0) return message;

  const files = attachments
    .map((attachment, index) => {
      const header = [
        `File ${index + 1}: ${attachment.name}`,
        `type: ${attachment.type || "unknown"}`,
        `size: ${attachment.size} bytes`,
        attachment.truncated ? "content: truncated" : null,
      ]
        .filter(Boolean)
        .join(", ");

      if (!attachment.content?.trim()) {
        return `${header}\nContent was not extracted. Use the file name and metadata only.`;
      }

      return `${header}\nContent:\n${attachment.content}`;
    })
    .join("\n\n");

  return `${message}\n\nAttached files:\n${files}`;
}

export function readAttachmentsFromMetadata(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isAttachmentLike)
    .map((attachment) => ({
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      content: attachment.content,
      truncated: attachment.truncated,
    }));
}

function collectContextMessages(previousMessages: ConversationMessage[], limit: number) {
  return previousMessages
    .filter((message) => message.content.trim() && ["system", "user", "assistant"].includes(message.role))
    .slice(-limit);
}

function formatContext(messages: ConversationMessage[]) {
  return messages
    .map((message) => `${conversationRoleLabel(message.role)}: ${trimContextContent(message.content)}`)
    .join("\n");
}

function conversationRoleLabel(role: ConversationMessage["role"]) {
  if (role === "assistant") return "Ассистент";
  if (role === "system") return "Система";
  return "Пользователь";
}

function trimContextContent(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 1_200 ? `${normalized.slice(0, 1_197)}...` : normalized;
}

function isContextualMediaFollowUp(prompt: string) {
  const normalized = prompt.toLowerCase();
  return containsAny(normalized, [
    "аудио",
    "audio",
    "голос",
    "озвуч",
    "спой",
    "вокал",
    "картин",
    "изображ",
    "фото",
    "image",
    "video",
    "видео",
    "ролик",
    "по этому",
    "по этому тексту",
    "который ты",
  ]);
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function responseStyleInstruction(style: ResponseStyle) {
  switch (style) {
    case "business":
      return "Настройка ответа: деловой стиль. Отвечай структурно, конкретно, без лишней эмоциональности. Используй короткие абзацы и списки.";
    case "business_visual":
      return "Настройка ответа: деловой стиль с визуальными подсказками. Дай структурный ответ и отдельно предложи идеи картинок, схем, таблиц или визуальных блоков, если это уместно.";
    case "conversational":
      return "Настройка ответа: разговорный стиль. Пиши проще и живее, без канцелярита, но сохраняй точность.";
    case "brief":
      return "Настройка ответа: краткий стиль. Сначала главный вывод, затем короткий список действий. Не растягивай ответ.";
    case "detailed":
      return "Настройка ответа: подробный стиль. Дай контекст, шаги, нюансы и практические рекомендации, но не добавляй воду.";
    default:
      return "Настройка ответа: авто.";
  }
}

function isAttachmentLike(value: unknown): value is ChatAttachment {
  if (!value || typeof value !== "object") return false;
  const attachment = value as Partial<ChatAttachment>;
  return typeof attachment.name === "string" && typeof attachment.size === "number";
}
