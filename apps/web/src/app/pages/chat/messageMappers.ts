import type {
  ChatApiMessage,
  ChatApiResponse,
  ChatAttachmentInput,
  MediaGenerationJobApiRecord,
} from "../../api";
import { generationStatusText } from "./generation";
import type { AttachedFile, Message } from "./types";

export function toAssistantMessage(response: ChatApiResponse, fallback: string): Message {
  const generationJob = response.generationJob ?? coerceGenerationJob(response.assistantMessage?.metadata?.generationJob);
  return {
    id: response.assistantMessage?.id ?? (Date.now() + 1).toString(),
    text: generationJob ? generationStatusText(generationJob) : response.assistantMessage?.content ?? fallback,
    sender: "ai",
    generationJob,
    selectedBest: Boolean(response.answerVariant?.isSelected),
  };
}

export function toChatMessage(message: ChatApiMessage): Message {
  const generationJob = coerceGenerationJob(message.metadata?.generationJob);
  return {
    id: message.id,
    text: generationJob ? generationStatusText(generationJob) : message.content,
    sender: message.role === "user" ? "user" : "ai",
    generationJob,
  };
}

export function toApiAttachment(file: AttachedFile): ChatAttachmentInput {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    content: file.content,
    truncated: file.truncated,
  };
}

function coerceGenerationJob(value: unknown): MediaGenerationJobApiRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Partial<MediaGenerationJobApiRecord>;
  if (
    typeof record.id !== "string" ||
    typeof record.modality !== "string" ||
    typeof record.status !== "string" ||
    !isGenerationStatus(record.status)
  ) {
    return undefined;
  }

  return {
    id: record.id,
    userId: typeof record.userId === "string" ? record.userId : "",
    agentId: typeof record.agentId === "string" ? record.agentId : undefined,
    modality: record.modality,
    status: record.status,
    prompt: typeof record.prompt === "string" ? record.prompt : "",
    provider: typeof record.provider === "string" ? record.provider : undefined,
    model: typeof record.model === "string" ? record.model : undefined,
    reservationId: typeof record.reservationId === "string" ? record.reservationId : undefined,
    resultUrl: typeof record.resultUrl === "string" ? record.resultUrl : undefined,
    resultMimeType: typeof record.resultMimeType === "string" ? record.resultMimeType : undefined,
    reservedCredits: typeof record.reservedCredits === "number" ? record.reservedCredits : 0,
    finalCredits: typeof record.finalCredits === "number" ? record.finalCredits : undefined,
    errorMessage: typeof record.errorMessage === "string" ? record.errorMessage : undefined,
    metadata: record.metadata && typeof record.metadata === "object" ? record.metadata : {},
    createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
  };
}

function isGenerationStatus(status: string): status is MediaGenerationJobApiRecord["status"] {
  return status === "queued" || status === "running" || status === "succeeded" || status === "failed" || status === "refunded" || status === "cancelled";
}
