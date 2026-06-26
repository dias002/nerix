import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, toDatabaseUserId, toPublicUserId, LOCAL_USER_PUBLIC_ID } from "../users/local-user.js";
import type {
  AiErrorEventRecord,
  AnswerVariantRecord,
  ConversationMessage,
  ConversationRecord,
  ConversationSummaryRecord,
  MemoryItemRecord,
  MessageFeedbackRating,
  MessageFeedbackRecord,
} from "./conversation.types.js";

export type RecordAnswerVariantInput = {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  agentId?: string | null;
  provider?: string | null;
  model?: string | null;
  routeMetadata?: Record<string, unknown>;
  providerUsage?: Record<string, unknown>;
  qualityMetadata?: Record<string, unknown>;
};

export type SelectAnswerVariantInput = {
  userId: string;
  conversationId: string;
  assistantMessageId: string;
};

export type AddMessageFeedbackInput = {
  userId: string;
  conversationId: string;
  messageId: string;
  rating: MessageFeedbackRating;
  selectedAsBest?: boolean;
  reasonTags?: string[];
  comment?: string | null;
};

export type RecordAiErrorInput = {
  userId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  answerVariantId?: string | null;
  botId?: string | null;
  stage: string;
  severity?: AiErrorEventRecord["severity"];
  errorCode: string;
  errorMessage: string;
  provider?: string | null;
  model?: string | null;
  agentId?: string | null;
  promptExcerpt?: string | null;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
};

export interface ConversationRepository {
  create(input: { userId: string; agentId: string; title: string }): Promise<ConversationRecord | null>;
  findById(conversationId: string): Promise<ConversationRecord | null>;
  listByUser(userId: string, limit?: number): Promise<ConversationSummaryRecord[]>;
  listMemoryItems(userId: string, limit?: number): Promise<MemoryItemRecord[]>;
  countFreeTextRequestsSince(userId: string, sinceIso: string): Promise<number>;
  appendMessage(conversationId: string, message: Omit<ConversationMessage, "id" | "createdAt">): Promise<ConversationMessage | null>;
  recordAnswerVariant(input: RecordAnswerVariantInput): Promise<AnswerVariantRecord | null>;
  selectAnswerVariant(input: SelectAnswerVariantInput): Promise<AnswerVariantRecord | null>;
  addMessageFeedback(input: AddMessageFeedbackInput): Promise<MessageFeedbackRecord | null>;
  recordAiError(input: RecordAiErrorInput): Promise<AiErrorEventRecord | null>;
}

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly conversations = new Map<string, ConversationRecord>();
  private readonly answerVariants = new Map<string, AnswerVariantRecord>();
  private readonly feedback = new Map<string, MessageFeedbackRecord>();
  private readonly errorEvents = new Map<string, AiErrorEventRecord>();

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

  async listByUser(userId: string, limit = 50) {
    return [...this.conversations.values()]
      .filter((conversation) => conversation.userId === userId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit)
      .map((conversation): ConversationSummaryRecord => {
        const preview = [...conversation.messages].reverse().find((message) => message.content.trim())?.content ?? "";
        return {
          id: conversation.id,
          userId: conversation.userId,
          agentId: conversation.agentId,
          title: conversation.title,
          preview,
          messagesCount: conversation.messages.length,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        };
      });
  }

  async listMemoryItems() {
    return [];
  }

  async countFreeTextRequestsSince(userId: string, sinceIso: string) {
    const since = Date.parse(sinceIso);
    if (!Number.isFinite(since)) return 0;

    return [...this.conversations.values()]
      .filter((conversation) => conversation.userId === userId)
      .reduce((count, conversation) => {
        return (
          count +
          conversation.messages.filter(
            (message) =>
              Date.parse(message.createdAt) >= since &&
              (message.role === "user" || typeof message.metadata?.regeneratedFromMessageId === "string")
          ).length
        );
      }, 0);
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

  async recordAnswerVariant(input: RecordAnswerVariantInput) {
    const conversation = this.conversations.get(input.conversationId);
    if (!conversation) return null;

    const existing = [...this.answerVariants.values()].find(
      (variant) => variant.assistantMessageId === input.assistantMessageId
    );
    if (existing) return existing;

    const now = new Date().toISOString();
    const variantIndex =
      [...this.answerVariants.values()].filter(
        (variant) => variant.conversationId === input.conversationId && variant.userMessageId === input.userMessageId
      ).length + 1;
    const variant: AnswerVariantRecord = {
      id: randomUUID(),
      conversationId: input.conversationId,
      userMessageId: input.userMessageId,
      assistantMessageId: input.assistantMessageId,
      agentId: input.agentId ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      variantIndex,
      status: "candidate",
      isSelected: false,
      selectedByUserId: null,
      selectedAt: null,
      routeMetadata: input.routeMetadata ?? {},
      providerUsage: input.providerUsage ?? {},
      qualityMetadata: input.qualityMetadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    this.answerVariants.set(variant.id, variant);
    return variant;
  }

  async selectAnswerVariant(input: SelectAnswerVariantInput) {
    const variant = [...this.answerVariants.values()].find(
      (candidate) =>
        candidate.conversationId === input.conversationId && candidate.assistantMessageId === input.assistantMessageId
    );
    if (!variant) return null;

    const now = new Date().toISOString();
    for (const candidate of this.answerVariants.values()) {
      if (candidate.conversationId === variant.conversationId && candidate.userMessageId === variant.userMessageId) {
        candidate.isSelected = false;
        candidate.status = "candidate";
        candidate.selectedByUserId = null;
        candidate.selectedAt = null;
        candidate.updatedAt = now;
      }
    }

    variant.isSelected = true;
    variant.status = "selected";
    variant.selectedByUserId = input.userId;
    variant.selectedAt = now;
    variant.updatedAt = now;
    return variant;
  }

  async addMessageFeedback(input: AddMessageFeedbackInput) {
    const answerVariant =
      [...this.answerVariants.values()].find(
        (variant) => variant.conversationId === input.conversationId && variant.assistantMessageId === input.messageId
      ) ?? null;
    const feedback: MessageFeedbackRecord = {
      id: randomUUID(),
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      answerVariantId: answerVariant?.id ?? null,
      rating: input.rating,
      selectedAsBest: Boolean(input.selectedAsBest),
      reasonTags: input.reasonTags ?? [],
      comment: input.comment?.trim() || null,
      createdAt: new Date().toISOString(),
    };

    this.feedback.set(feedback.id, feedback);
    return feedback;
  }

  async recordAiError(input: RecordAiErrorInput) {
    const errorEvent: AiErrorEventRecord = {
      id: randomUUID(),
      userId: input.userId ?? null,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      answerVariantId: input.answerVariantId ?? null,
      botId: input.botId ?? null,
      stage: input.stage,
      severity: input.severity ?? "error",
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      provider: input.provider ?? null,
      model: input.model ?? null,
      agentId: input.agentId ?? null,
      promptExcerpt: input.promptExcerpt ?? null,
      requestPayload: input.requestPayload ?? {},
      responsePayload: input.responsePayload ?? {},
      status: "open",
      resolutionNote: null,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };

    this.errorEvents.set(errorEvent.id, errorEvent);
    return errorEvent;
  }
}

type ConversationRow = {
  id: string;
  user_id: string;
  agent_slug: string | null;
  title: string | null;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type ConversationSummaryRow = ConversationRow & {
  preview: string | null;
  messages_count: string | number;
};

type MemoryItemRow = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  source: string | null;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type MessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: unknown;
  created_at: Date | string;
} & Record<string, unknown>;

type AgentIdRow = {
  id: string;
} & Record<string, unknown>;

type AnswerVariantRow = {
  id: string;
  conversation_id: string;
  user_message_id: string;
  assistant_message_id: string;
  agent_slug: string | null;
  provider: string | null;
  model: string | null;
  variant_index: string | number;
  status: "candidate" | "selected" | "rejected";
  is_selected: boolean;
  selected_by_user_id: string | null;
  selected_at: Date | string | null;
  route_metadata: unknown;
  provider_usage: unknown;
  quality_metadata: unknown;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type MessageFeedbackRow = {
  id: string;
  user_id: string;
  conversation_id: string;
  message_id: string;
  answer_variant_id: string | null;
  rating: MessageFeedbackRating;
  selected_as_best: boolean;
  reason_tags: string[];
  comment: string | null;
  created_at: Date | string;
} & Record<string, unknown>;

type AiErrorEventRow = {
  id: string;
  user_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  answer_variant_id: string | null;
  bot_id: string | null;
  stage: string;
  severity: AiErrorEventRecord["severity"];
  error_code: string;
  error_message: string;
  provider: string | null;
  model: string | null;
  agent_slug: string | null;
  prompt_excerpt: string | null;
  request_payload: unknown;
  response_payload: unknown;
  status: AiErrorEventRecord["status"];
  resolution_note: string | null;
  created_at: Date | string;
  resolved_at: Date | string | null;
} & Record<string, unknown>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PostgresConversationRepository implements ConversationRepository {
  constructor(private readonly database: DatabaseClient) {}

  async create(input: { userId: string; agentId: string; title: string }) {
    const databaseUserId = toDatabaseUserId(input.userId);
    if (!databaseUserId) return null;

    if (input.userId === LOCAL_USER_PUBLIC_ID) {
      await ensureLocalUser(this.database);
    }

    const userExists = await this.userExists(databaseUserId);
    if (!userExists) return null;

    const agentDatabaseId = await this.findAgentDatabaseId(input.agentId);
    const result = await this.database.query<ConversationRow>(
      `
        insert into conversations (user_id, agent_id, title)
        values ($1, $2, $3)
        returning id, user_id, $4::text as agent_slug, title, created_at, updated_at
      `,
      [databaseUserId, agentDatabaseId, input.title, input.agentId]
    );

    const row = result.rows[0];
    return row ? mapConversationRow(row, []) : null;
  }

  async findById(conversationId: string) {
    if (!uuidPattern.test(conversationId)) return null;

    const conversationResult = await this.database.query<ConversationRow>(
      `
        select
          c.id,
          c.user_id,
          a.slug as agent_slug,
          c.title,
          c.created_at,
          c.updated_at
        from conversations c
        left join agents a on a.id = c.agent_id
        where c.id = $1
        limit 1
      `,
      [conversationId]
    );

    const conversation = conversationResult.rows[0];
    if (!conversation) return null;

    const messagesResult = await this.database.query<MessageRow>(
      `
        select id, role, content, metadata, created_at
        from messages
        where conversation_id = $1
        order by created_at asc
      `,
      [conversationId]
    );

    return mapConversationRow(conversation, messagesResult.rows.map(mapMessageRow));
  }

  async listByUser(userId: string, limit = 50) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return [];

    if (userId === LOCAL_USER_PUBLIC_ID) {
      await ensureLocalUser(this.database);
    }

    const result = await this.database.query<ConversationSummaryRow>(
      `
        select
          c.id,
          c.user_id,
          a.slug as agent_slug,
          c.title,
          c.created_at,
          c.updated_at,
          coalesce(message_stats.messages_count, 0)::text as messages_count,
          last_message.content as preview
        from conversations c
        left join agents a on a.id = c.agent_id
        left join lateral (
          select count(*)::int as messages_count
          from messages m
          where m.conversation_id = c.id
        ) message_stats on true
        left join lateral (
          select m.content
          from messages m
          where m.conversation_id = c.id
          order by m.created_at desc
          limit 1
        ) last_message on true
        where c.user_id = $1
        order by c.updated_at desc
        limit $2
      `,
      [databaseUserId, Math.max(1, Math.min(limit, 100))]
    );

    return result.rows.map(mapConversationSummaryRow);
  }

  async listMemoryItems(userId: string, limit = 100) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return [];

    if (userId === LOCAL_USER_PUBLIC_ID) {
      await ensureLocalUser(this.database);
    }

    const result = await this.database.query<MemoryItemRow>(
      `
        select id, user_id, title, content, source, created_at, updated_at
        from memory_items
        where user_id = $1
          and enabled = true
        order by updated_at desc
        limit $2
      `,
      [databaseUserId, Math.max(1, Math.min(limit, 200))]
    );

    return result.rows.map(mapMemoryItemRow);
  }

  async countFreeTextRequestsSince(userId: string, sinceIso: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return 0;

    if (userId === LOCAL_USER_PUBLIC_ID) {
      await ensureLocalUser(this.database);
    }

    const result = await this.database.query<{ count: string | number }>(
      `
        select count(*)::text as count
        from messages m
        join conversations c on c.id = m.conversation_id
        where c.user_id = $1
          and (
            m.role = 'user'
            or jsonb_typeof(m.metadata -> 'regeneratedFromMessageId') = 'string'
          )
          and m.created_at >= $2::timestamptz
      `,
      [databaseUserId, sinceIso]
    );

    const value = result.rows[0]?.count ?? 0;
    return typeof value === "number" ? value : Number(value);
  }

  async appendMessage(conversationId: string, message: Omit<ConversationMessage, "id" | "createdAt">) {
    if (!uuidPattern.test(conversationId)) return null;

    const result = await this.database.query<MessageRow>(
      `
        insert into messages (conversation_id, role, content, metadata)
        values ($1, $2, $3, $4::jsonb)
        returning id, role, content, metadata, created_at
      `,
      [conversationId, message.role, message.content, JSON.stringify(message.metadata ?? {})]
    );

    const savedMessage = result.rows[0] ? mapMessageRow(result.rows[0]) : null;
    if (!savedMessage) return null;

    await this.database.query(
      `
        update conversations
        set updated_at = $1
        where id = $2
      `,
      [savedMessage.createdAt, conversationId]
    );

    if (savedMessage.role === "user") {
      await this.recordBusinessEmployeeActivity(conversationId, savedMessage.id, savedMessage.createdAt, savedMessage.content);
    }

    return savedMessage;
  }

  async recordAnswerVariant(input: RecordAnswerVariantInput) {
    if (
      !uuidPattern.test(input.conversationId) ||
      !uuidPattern.test(input.userMessageId) ||
      !uuidPattern.test(input.assistantMessageId)
    ) {
      return null;
    }

    const result = await this.database.query<AnswerVariantRow>(
      `
        insert into message_answer_variants (
          conversation_id,
          user_message_id,
          assistant_message_id,
          agent_slug,
          provider,
          model,
          variant_index,
          route_metadata,
          provider_usage,
          quality_metadata
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          coalesce(
            (
              select max(variant_index) + 1
              from message_answer_variants
              where conversation_id = $1 and user_message_id = $2
            ),
            1
          ),
          $7::jsonb,
          $8::jsonb,
          $9::jsonb
        )
        on conflict (assistant_message_id) do update
          set route_metadata = excluded.route_metadata,
              provider_usage = excluded.provider_usage,
              quality_metadata = excluded.quality_metadata,
              updated_at = now()
        returning
          id,
          conversation_id,
          user_message_id,
          assistant_message_id,
          agent_slug,
          provider,
          model,
          variant_index,
          status,
          is_selected,
          selected_by_user_id,
          selected_at,
          route_metadata,
          provider_usage,
          quality_metadata,
          created_at,
          updated_at
      `,
      [
        input.conversationId,
        input.userMessageId,
        input.assistantMessageId,
        input.agentId ?? null,
        input.provider ?? null,
        input.model ?? null,
        JSON.stringify(input.routeMetadata ?? {}),
        JSON.stringify(input.providerUsage ?? {}),
        JSON.stringify(input.qualityMetadata ?? {}),
      ]
    );

    return result.rows[0] ? mapAnswerVariantRow(result.rows[0]) : null;
  }

  async selectAnswerVariant(input: SelectAnswerVariantInput) {
    if (!uuidPattern.test(input.conversationId) || !uuidPattern.test(input.assistantMessageId)) return null;
    const databaseUserId = toDatabaseUserId(input.userId);
    if (!databaseUserId) return null;

    return this.transaction(async (client) => {
      const variantResult = await client.query<AnswerVariantRow>(
        `
          select
            id,
            conversation_id,
            user_message_id,
            assistant_message_id,
            agent_slug,
            provider,
            model,
            variant_index,
            status,
            is_selected,
            selected_by_user_id,
            selected_at,
            route_metadata,
            provider_usage,
            quality_metadata,
            created_at,
            updated_at
          from message_answer_variants
          where conversation_id = $1 and assistant_message_id = $2
          limit 1
          for update
        `,
        [input.conversationId, input.assistantMessageId]
      );
      const variant = variantResult.rows[0];
      if (!variant) return null;

      await client.query(
        `
          update message_answer_variants
          set is_selected = false,
              status = 'candidate',
              selected_by_user_id = null,
              selected_at = null,
              updated_at = now()
          where conversation_id = $1 and user_message_id = $2
        `,
        [variant.conversation_id, variant.user_message_id]
      );

      const selectedResult = await client.query<AnswerVariantRow>(
        `
          update message_answer_variants
          set is_selected = true,
              status = 'selected',
              selected_by_user_id = $2,
              selected_at = now(),
              updated_at = now()
          where id = $1
          returning
            id,
            conversation_id,
            user_message_id,
            assistant_message_id,
            agent_slug,
            provider,
            model,
            variant_index,
            status,
            is_selected,
            selected_by_user_id,
            selected_at,
            route_metadata,
            provider_usage,
            quality_metadata,
            created_at,
            updated_at
        `,
        [variant.id, databaseUserId]
      );

      const selected = selectedResult.rows[0];
      return selected ? mapAnswerVariantRow(selected) : null;
    });
  }

  async addMessageFeedback(input: AddMessageFeedbackInput) {
    if (!uuidPattern.test(input.conversationId) || !uuidPattern.test(input.messageId)) return null;
    const databaseUserId = toDatabaseUserId(input.userId);
    if (!databaseUserId) return null;

    const result = await this.database.query<MessageFeedbackRow>(
      `
        insert into message_feedback (
          user_id,
          conversation_id,
          message_id,
          answer_variant_id,
          rating,
          selected_as_best,
          reason_tags,
          comment
        )
        values (
          $1,
          $2,
          $3,
          (
            select id
            from message_answer_variants
            where assistant_message_id = $3
            limit 1
          ),
          $4,
          $5,
          $6,
          $7
        )
        returning
          id,
          user_id,
          conversation_id,
          message_id,
          answer_variant_id,
          rating,
          selected_as_best,
          reason_tags,
          comment,
          created_at
      `,
      [
        databaseUserId,
        input.conversationId,
        input.messageId,
        input.rating,
        Boolean(input.selectedAsBest),
        input.reasonTags ?? [],
        input.comment?.trim() || null,
      ]
    );

    return result.rows[0] ? mapMessageFeedbackRow(result.rows[0]) : null;
  }

  async recordAiError(input: RecordAiErrorInput) {
    const databaseUserId = input.userId ? toDatabaseUserId(input.userId) : null;
    const result = await this.database.query<AiErrorEventRow>(
      `
        insert into ai_error_events (
          user_id,
          conversation_id,
          message_id,
          answer_variant_id,
          bot_id,
          stage,
          severity,
          error_code,
          error_message,
          provider,
          model,
          agent_slug,
          prompt_excerpt,
          request_payload,
          response_payload
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb)
        returning
          id,
          user_id,
          conversation_id,
          message_id,
          answer_variant_id,
          bot_id,
          stage,
          severity,
          error_code,
          error_message,
          provider,
          model,
          agent_slug,
          prompt_excerpt,
          request_payload,
          response_payload,
          status,
          resolution_note,
          created_at,
          resolved_at
      `,
      [
        databaseUserId,
        input.conversationId && uuidPattern.test(input.conversationId) ? input.conversationId : null,
        input.messageId && uuidPattern.test(input.messageId) ? input.messageId : null,
        input.answerVariantId && uuidPattern.test(input.answerVariantId) ? input.answerVariantId : null,
        input.botId && uuidPattern.test(input.botId) ? input.botId : null,
        input.stage,
        input.severity ?? "error",
        input.errorCode,
        input.errorMessage,
        input.provider ?? null,
        input.model ?? null,
        input.agentId ?? null,
        input.promptExcerpt ?? null,
        JSON.stringify(input.requestPayload ?? {}),
        JSON.stringify(input.responsePayload ?? {}),
      ]
    );

    return result.rows[0] ? mapAiErrorEventRow(result.rows[0]) : null;
  }

  private async userExists(databaseUserId: string) {
    const result = await this.database.query<{ exists: boolean } & Record<string, unknown>>(
      "select exists(select 1 from users where id = $1) as exists",
      [databaseUserId]
    );
    return result.rows[0]?.exists ?? false;
  }

  private async findAgentDatabaseId(agentId: string) {
    const result = await this.database.query<AgentIdRow>(
      "select id from agents where slug = $1 limit 1",
      [agentId]
    );
    return result.rows[0]?.id ?? null;
  }

  private async recordBusinessEmployeeActivity(
    conversationId: string,
    messageId: string,
    createdAt: string,
    content: string
  ) {
    try {
      await this.database.query(
        `
          with activity as (
            insert into business_employee_activity (
              workspace_id,
              member_id,
              user_id,
              conversation_id,
              message_id,
              activity_type,
              metadata,
              created_at
            )
            select
              bm.workspace_id,
              bm.id,
              c.user_id,
              c.id,
              $2,
              'chat_request',
              jsonb_build_object('messageLength', length($4::text)),
              $3::timestamptz
            from conversations c
            join business_members bm on bm.user_id = c.user_id
            where c.id = $1
            order by bm.created_at desc
            limit 1
            returning workspace_id, member_id, user_id, created_at
          )
          insert into business_employee_daily_reports (
            workspace_id,
            member_id,
            user_id,
            report_date,
            requests_count,
            chats_count,
            client_reports_count,
            last_activity_at,
            summary
          )
          select
            workspace_id,
            member_id,
            user_id,
            current_date,
            1,
            1,
            0,
            created_at,
            'Сотрудник работал через чат nomduchat. Запрос учтен в бизнес-аналитике.'
          from activity
          on conflict (workspace_id, user_id, report_date) do update
            set requests_count = business_employee_daily_reports.requests_count + 1,
                chats_count = business_employee_daily_reports.chats_count + 1,
                last_activity_at = excluded.last_activity_at,
                summary = excluded.summary,
                updated_at = now()
        `,
        [conversationId, messageId, createdAt, content]
      );
    } catch {
      return;
    }
  }

  private async transaction<T>(callback: (client: DatabaseClient) => Promise<T>) {
    if (this.database.transaction) return this.database.transaction(callback);
    return callback(this.database);
  }
}

function mapConversationRow(row: ConversationRow, messages: ConversationMessage[]): ConversationRecord {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    agentId: row.agent_slug ?? "general",
    title: row.title ?? "nomduchat conversation",
    messages,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapConversationSummaryRow(row: ConversationSummaryRow): ConversationSummaryRecord {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    agentId: row.agent_slug ?? "general",
    title: row.title ?? "nomduchat conversation",
    preview: row.preview ?? "",
    messagesCount: Number(row.messages_count ?? 0),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapMemoryItemRow(row: MemoryItemRow): MemoryItemRecord {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    title: row.title,
    content: row.content,
    source: row.source,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapMessageRow(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    metadata: toMetadata(row.metadata),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapAnswerVariantRow(row: AnswerVariantRow): AnswerVariantRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userMessageId: row.user_message_id,
    assistantMessageId: row.assistant_message_id,
    agentId: row.agent_slug,
    provider: row.provider,
    model: row.model,
    variantIndex: Number(row.variant_index),
    status: row.status,
    isSelected: row.is_selected,
    selectedByUserId: row.selected_by_user_id ? toPublicUserId(row.selected_by_user_id) : null,
    selectedAt: row.selected_at ? new Date(row.selected_at).toISOString() : null,
    routeMetadata: toMetadata(row.route_metadata),
    providerUsage: toMetadata(row.provider_usage),
    qualityMetadata: toMetadata(row.quality_metadata),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapMessageFeedbackRow(row: MessageFeedbackRow): MessageFeedbackRecord {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    conversationId: row.conversation_id,
    messageId: row.message_id,
    answerVariantId: row.answer_variant_id,
    rating: row.rating,
    selectedAsBest: row.selected_as_best,
    reasonTags: row.reason_tags,
    comment: row.comment,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapAiErrorEventRow(row: AiErrorEventRow): AiErrorEventRecord {
  return {
    id: row.id,
    userId: row.user_id ? toPublicUserId(row.user_id) : null,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    answerVariantId: row.answer_variant_id,
    botId: row.bot_id,
    stage: row.stage,
    severity: row.severity,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    provider: row.provider,
    model: row.model,
    agentId: row.agent_slug,
    promptExcerpt: row.prompt_excerpt,
    requestPayload: toMetadata(row.request_payload),
    responsePayload: toMetadata(row.response_payload),
    status: row.status,
    resolutionNote: row.resolution_note,
    createdAt: new Date(row.created_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
  };
}

function toMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
