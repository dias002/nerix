import { randomUUID } from "node:crypto";
import type { ConversationMessage, ConversationRecord } from "./conversation.types.js";

export interface ConversationRepository {
  create(input: { userId: string; agentId: string; title: string }): Promise<ConversationRecord>;
  findById(conversationId: string): Promise<ConversationRecord | null>;
  appendMessage(conversationId: string, message: Omit<ConversationMessage, "id" | "createdAt">): Promise<ConversationMessage | null>;
}

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly conversations = new Map<string, ConversationRecord>();

  async create(input: { userId: string; agentId: string; title: string }) {
    const now = new Date().toISOString();
    const conversation: ConversationRecord = {
      id: randomUUID(),
      userId: input.userId,
      agentId: input.agentId,
      title: input.title,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async findById(conversationId: string) {
    return this.conversations.get(conversationId) ?? null;
  }

  async appendMessage(conversationId: string, message: Omit<ConversationMessage, "id" | "createdAt">) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    const savedMessage: ConversationMessage = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...message,
    };

    conversation.messages.push(savedMessage);
    conversation.updatedAt = savedMessage.createdAt;
    return savedMessage;
  }
}

