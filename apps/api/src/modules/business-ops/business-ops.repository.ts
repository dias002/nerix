import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../database/index.js";
import type {
  BusinessConversationAnalysis,
  BusinessConversationRating,
  BusinessConversationStatus,
  BusinessCustomerChannel,
  BusinessCustomerConversationRecord,
  BusinessCustomerMessageRecord,
  BusinessCustomerMessageRole,
  BusinessTeamMessageRecord,
  CreateBusinessCustomerMessageInput,
} from "./business-ops.types.js";

export type PersistBusinessCustomerConversationInput = {
  workspaceId: string;
  channel: BusinessCustomerChannel;
  customerName: string;
  customerContact: string;
  source: string;
  status: BusinessConversationStatus;
  aiRating: BusinessConversationRating;
  analysis: BusinessConversationAnalysis;
  trainingAllowed: boolean;
  messages: CreateBusinessCustomerMessageInput[];
};

export type PersistBusinessCustomerMessageInput = {
  role: BusinessCustomerMessageRole;
  content: string;
  authorName: string;
};

export type PersistBusinessConversationAnalysisInput = {
  status: BusinessConversationStatus;
  aiRating: BusinessConversationRating;
  analysis: BusinessConversationAnalysis;
};

export type PersistBusinessTeamMessageInput = {
  workspaceId: string;
  memberId: string | null;
  authorName: string;
  roleTitle: string;
  text: string;
};

export interface BusinessOpsRepository {
  listConversations(workspaceId: string): Promise<BusinessCustomerConversationRecord[]>;
  createConversation(input: PersistBusinessCustomerConversationInput): Promise<BusinessCustomerConversationRecord | null>;
  addCustomerMessage(
    workspaceId: string,
    conversationId: string,
    message: PersistBusinessCustomerMessageInput,
    analysis: PersistBusinessConversationAnalysisInput
  ): Promise<BusinessCustomerConversationRecord | null>;
  rateConversation(
    workspaceId: string,
    conversationId: string,
    rating: BusinessConversationRating
  ): Promise<BusinessCustomerConversationRecord | null>;
  listTeamMessages(workspaceId: string): Promise<BusinessTeamMessageRecord[]>;
  addTeamMessage(input: PersistBusinessTeamMessageInput): Promise<BusinessTeamMessageRecord | null>;
}

export class InMemoryBusinessOpsRepository implements BusinessOpsRepository {
  private readonly conversations = new Map<string, BusinessCustomerConversationRecord>();
  private readonly teamMessages = new Map<string, BusinessTeamMessageRecord>();

  async listConversations(workspaceId: string) {
    return [...this.conversations.values()]
      .filter((conversation) => conversation.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(cloneConversation);
  }

  async createConversation(input: PersistBusinessCustomerConversationInput) {
    const now = new Date().toISOString();
    const conversation: BusinessCustomerConversationRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      channel: input.channel,
      customerName: input.customerName,
      customerContact: input.customerContact,
      source: input.source,
      status: input.status,
      ownerRating: null,
      aiRating: input.aiRating,
      analysis: cloneAnalysis(input.analysis),
      trainingAllowed: input.trainingAllowed,
      createdAt: now,
      updatedAt: now,
      messages: input.messages.map((message) => ({
        id: randomUUID(),
        conversationId: "",
        role: message.role,
        authorName: message.authorName?.trim() || defaultAuthorName(message.role),
        content: message.content,
        createdAt: now,
      })),
    };
    conversation.messages = conversation.messages.map((message) => ({
      ...message,
      conversationId: conversation.id,
    }));
    this.conversations.set(conversation.id, conversation);
    return cloneConversation(conversation);
  }

  async addCustomerMessage(
    workspaceId: string,
    conversationId: string,
    message: PersistBusinessCustomerMessageInput,
    analysis: PersistBusinessConversationAnalysisInput
  ) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.workspaceId !== workspaceId) return null;

    const now = new Date().toISOString();
    const updated: BusinessCustomerConversationRecord = {
      ...conversation,
      status: analysis.status,
      aiRating: analysis.aiRating,
      analysis: cloneAnalysis(analysis.analysis),
      updatedAt: now,
      messages: [
        ...conversation.messages,
        {
          id: randomUUID(),
          conversationId,
          role: message.role,
          authorName: message.authorName,
          content: message.content,
          createdAt: now,
        },
      ],
    };
    this.conversations.set(conversation.id, updated);
    return cloneConversation(updated);
  }

  async rateConversation(workspaceId: string, conversationId: string, rating: BusinessConversationRating) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.workspaceId !== workspaceId) return null;

    const updated: BusinessCustomerConversationRecord = {
      ...conversation,
      ownerRating: rating,
      updatedAt: new Date().toISOString(),
    };
    this.conversations.set(conversation.id, updated);
    return cloneConversation(updated);
  }

  async listTeamMessages(workspaceId: string) {
    return [...this.teamMessages.values()]
      .filter((message) => message.workspaceId === workspaceId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(cloneTeamMessage);
  }

  async addTeamMessage(input: PersistBusinessTeamMessageInput) {
    const message: BusinessTeamMessageRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      memberId: input.memberId,
      authorName: input.authorName,
      roleTitle: input.roleTitle,
      text: input.text,
      createdAt: new Date().toISOString(),
    };
    this.teamMessages.set(message.id, message);
    return cloneTeamMessage(message);
  }
}

type ConversationRow = {
  id: string;
  workspace_id: string;
  channel: string;
  customer_name: string;
  customer_contact: string;
  source: string;
  status: string;
  owner_rating: string | null;
  ai_rating: string;
  analysis: BusinessConversationAnalysis | string | null;
  training_allowed: boolean;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  author_name: string;
  content: string;
  created_at: Date | string;
} & Record<string, unknown>;

type TeamMessageRow = {
  id: string;
  workspace_id: string;
  member_id: string | null;
  author_name: string;
  role_title: string;
  text: string;
  created_at: Date | string;
} & Record<string, unknown>;

export class PostgresBusinessOpsRepository implements BusinessOpsRepository {
  constructor(private readonly database: DatabaseClient) {}

  async listConversations(workspaceId: string) {
    const conversationsResult = await this.database.query<ConversationRow>(
      `
        select
          id,
          workspace_id,
          channel,
          customer_name,
          customer_contact,
          source,
          status,
          owner_rating,
          ai_rating,
          analysis,
          training_allowed,
          created_at,
          updated_at
        from business_customer_conversations
        where workspace_id = $1
        order by updated_at desc
      `,
      [workspaceId]
    );
    const conversationIds = conversationsResult.rows.map((conversation) => conversation.id);
    const messagesByConversation = await this.readMessagesByConversationIds(conversationIds);
    return conversationsResult.rows.map((conversation) =>
      mapConversationRow(conversation, messagesByConversation.get(conversation.id) ?? [])
    );
  }

  async createConversation(input: PersistBusinessCustomerConversationInput) {
    const result = await this.database.query<ConversationRow>(
      `
        insert into business_customer_conversations (
          workspace_id,
          channel,
          customer_name,
          customer_contact,
          source,
          status,
          ai_rating,
          analysis,
          training_allowed
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
        returning
          id,
          workspace_id,
          channel,
          customer_name,
          customer_contact,
          source,
          status,
          owner_rating,
          ai_rating,
          analysis,
          training_allowed,
          created_at,
          updated_at
      `,
      [
        input.workspaceId,
        input.channel,
        input.customerName,
        input.customerContact,
        input.source,
        input.status,
        input.aiRating,
        JSON.stringify(input.analysis),
        input.trainingAllowed,
      ]
    );
    const conversation = result.rows[0];
    if (!conversation) return null;

    for (const message of input.messages) {
      await this.database.query(
        `
          insert into business_customer_messages (conversation_id, role, author_name, content)
          values ($1, $2, $3, $4)
        `,
        [conversation.id, message.role, message.authorName?.trim() || defaultAuthorName(message.role), message.content]
      );
    }

    return this.readConversation(input.workspaceId, conversation.id);
  }

  async addCustomerMessage(
    workspaceId: string,
    conversationId: string,
    message: PersistBusinessCustomerMessageInput,
    analysis: PersistBusinessConversationAnalysisInput
  ) {
    const existing = await this.database.query<{ id: string }>(
      `
        select id
        from business_customer_conversations
        where id = $1 and workspace_id = $2
        limit 1
      `,
      [conversationId, workspaceId]
    );
    if (!existing.rows[0]) return null;

    await this.database.query(
      `
        insert into business_customer_messages (conversation_id, role, author_name, content)
        values ($1, $2, $3, $4)
      `,
      [conversationId, message.role, message.authorName, message.content]
    );
    await this.database.query(
      `
        update business_customer_conversations
        set status = $3,
            ai_rating = $4,
            analysis = $5::jsonb,
            updated_at = now()
        where id = $1 and workspace_id = $2
      `,
      [conversationId, workspaceId, analysis.status, analysis.aiRating, JSON.stringify(analysis.analysis)]
    );

    return this.readConversation(workspaceId, conversationId);
  }

  async rateConversation(workspaceId: string, conversationId: string, rating: BusinessConversationRating) {
    const result = await this.database.query<ConversationRow>(
      `
        update business_customer_conversations
        set owner_rating = $3,
            updated_at = now()
        where id = $1 and workspace_id = $2
        returning
          id,
          workspace_id,
          channel,
          customer_name,
          customer_contact,
          source,
          status,
          owner_rating,
          ai_rating,
          analysis,
          training_allowed,
          created_at,
          updated_at
      `,
      [conversationId, workspaceId, rating]
    );
    const conversation = result.rows[0];
    if (!conversation) return null;

    const messagesByConversation = await this.readMessagesByConversationIds([conversation.id]);
    return mapConversationRow(conversation, messagesByConversation.get(conversation.id) ?? []);
  }

  async listTeamMessages(workspaceId: string) {
    const result = await this.database.query<TeamMessageRow>(
      `
        select
          id,
          workspace_id,
          member_id,
          author_name,
          role_title,
          text,
          created_at
        from business_team_messages
        where workspace_id = $1
        order by created_at asc
        limit 100
      `,
      [workspaceId]
    );
    return result.rows.map(mapTeamMessageRow);
  }

  async addTeamMessage(input: PersistBusinessTeamMessageInput) {
    const result = await this.database.query<TeamMessageRow>(
      `
        insert into business_team_messages (workspace_id, member_id, author_name, role_title, text)
        values ($1, $2, $3, $4, $5)
        returning
          id,
          workspace_id,
          member_id,
          author_name,
          role_title,
          text,
          created_at
      `,
      [input.workspaceId, input.memberId, input.authorName, input.roleTitle, input.text]
    );
    return result.rows[0] ? mapTeamMessageRow(result.rows[0]) : null;
  }

  private async readConversation(workspaceId: string, conversationId: string) {
    const result = await this.database.query<ConversationRow>(
      `
        select
          id,
          workspace_id,
          channel,
          customer_name,
          customer_contact,
          source,
          status,
          owner_rating,
          ai_rating,
          analysis,
          training_allowed,
          created_at,
          updated_at
        from business_customer_conversations
        where id = $1 and workspace_id = $2
        limit 1
      `,
      [conversationId, workspaceId]
    );
    const conversation = result.rows[0];
    if (!conversation) return null;

    const messagesByConversation = await this.readMessagesByConversationIds([conversation.id]);
    return mapConversationRow(conversation, messagesByConversation.get(conversation.id) ?? []);
  }

  private async readMessagesByConversationIds(conversationIds: string[]) {
    const messagesByConversation = new Map<string, BusinessCustomerMessageRecord[]>();
    if (conversationIds.length === 0) return messagesByConversation;

    const result = await this.database.query<MessageRow>(
      `
        select
          id,
          conversation_id,
          role,
          author_name,
          content,
          created_at
        from business_customer_messages
        where conversation_id = any($1::uuid[])
        order by created_at asc
      `,
      [conversationIds]
    );

    for (const row of result.rows) {
      const existing = messagesByConversation.get(row.conversation_id) ?? [];
      existing.push(mapMessageRow(row));
      messagesByConversation.set(row.conversation_id, existing);
    }

    return messagesByConversation;
  }
}

function mapConversationRow(
  row: ConversationRow,
  messages: BusinessCustomerMessageRecord[]
): BusinessCustomerConversationRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    channel: isBusinessCustomerChannel(row.channel) ? row.channel : "manual",
    customerName: row.customer_name,
    customerContact: row.customer_contact,
    source: row.source,
    status: isBusinessConversationStatus(row.status) ? row.status : "new",
    ownerRating: isBusinessConversationRating(row.owner_rating) ? row.owner_rating : null,
    aiRating: isBusinessConversationRating(row.ai_rating) ? row.ai_rating : "good",
    analysis: parseAnalysis(row.analysis),
    trainingAllowed: row.training_allowed,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    messages,
  };
}

function mapMessageRow(row: MessageRow): BusinessCustomerMessageRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: isBusinessCustomerMessageRole(row.role) ? row.role : "system",
    authorName: row.author_name,
    content: row.content,
    createdAt: toIso(row.created_at),
  };
}

function mapTeamMessageRow(row: TeamMessageRow): BusinessTeamMessageRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    memberId: row.member_id,
    authorName: row.author_name,
    roleTitle: row.role_title,
    text: row.text,
    createdAt: toIso(row.created_at),
  };
}

function cloneConversation(conversation: BusinessCustomerConversationRecord) {
  return JSON.parse(JSON.stringify(conversation)) as BusinessCustomerConversationRecord;
}

function cloneTeamMessage(message: BusinessTeamMessageRecord) {
  return { ...message };
}

function cloneAnalysis(analysis: BusinessConversationAnalysis) {
  return JSON.parse(JSON.stringify(analysis)) as BusinessConversationAnalysis;
}

function parseAnalysis(value: BusinessConversationAnalysis | string | null): BusinessConversationAnalysis {
  if (!value) return fallbackAnalysis();
  if (typeof value === "string") {
    try {
      return normalizeAnalysis(JSON.parse(value));
    } catch {
      return fallbackAnalysis();
    }
  }
  return normalizeAnalysis(value);
}

function normalizeAnalysis(value: Partial<BusinessConversationAnalysis>): BusinessConversationAnalysis {
  const fallback = fallbackAnalysis();
  return {
    summary: typeof value.summary === "string" ? value.summary : fallback.summary,
    goal: typeof value.goal === "string" ? value.goal : fallback.goal,
    intent: typeof value.intent === "string" ? value.intent : fallback.intent,
    objections: Array.isArray(value.objections) ? value.objections.filter(isString) : [],
    desiredProducts: Array.isArray(value.desiredProducts) ? value.desiredProducts.filter(isString) : [],
    sentiment: value.sentiment === "positive" || value.sentiment === "negative" ? value.sentiment : "neutral",
    outcome: typeof value.outcome === "string" ? value.outcome : fallback.outcome,
    nextStep: typeof value.nextStep === "string" ? value.nextStep : fallback.nextStep,
    score: typeof value.score === "number" ? value.score : fallback.score,
    tags: Array.isArray(value.tags) ? value.tags.filter(isString) : [],
    trainingSignal: typeof value.trainingSignal === "string" ? value.trainingSignal : fallback.trainingSignal,
  };
}

function fallbackAnalysis(): BusinessConversationAnalysis {
  return {
    summary: "Диалог сохранен. Анализ обновится после новых сообщений.",
    goal: "Понять запрос клиента",
    intent: "consultation",
    objections: [],
    desiredProducts: [],
    sentiment: "neutral",
    outcome: "Нужен следующий контакт с клиентом.",
    nextStep: "Уточнить задачу, контакт и срок принятия решения.",
    score: 50,
    tags: ["новый диалог"],
    trainingSignal: "Недостаточно данных для уверенного вывода.",
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isBusinessCustomerChannel(value: string): value is BusinessCustomerChannel {
  return value === "telegram" || value === "website" || value === "manual";
}

function isBusinessCustomerMessageRole(value: string): value is BusinessCustomerMessageRole {
  return value === "customer" || value === "bot" || value === "employee" || value === "system";
}

function isBusinessConversationRating(value: string | null): value is BusinessConversationRating {
  return value === "bad" || value === "good" || value === "excellent";
}

function isBusinessConversationStatus(value: string): value is BusinessConversationStatus {
  return value === "new" || value === "qualified" || value === "waiting_human" || value === "won" || value === "lost";
}

function defaultAuthorName(role: BusinessCustomerMessageRole) {
  if (role === "customer") return "Клиент";
  if (role === "bot") return "ИИ-менеджер";
  if (role === "employee") return "Сотрудник";
  return "Система";
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
