import { isCountryCode, type CountryCode, type Language } from "@nomduchat/shared";
import type { DatabaseClient } from "../../database/index.js";
import { isAdminEmail } from "./admin-access.js";
import { ensureLocalUser, LOCAL_USER_PUBLIC_ID, toDatabaseUserId, toPublicUserId } from "./local-user.js";
import type { SystemRole, UserPermissions, UserRecord, WorkspaceRole } from "./user.types.js";

export type UserDataExportRecord = {
  generatedAt: string;
  user: UserRecord;
  counts: {
    conversations: number;
    messages: number;
    memoryItems: number;
    generationJobs: number;
    businessWorkspaces: number;
    businessMemberships: number;
    telegramBotOrders: number;
    subscriptionCheckouts: number;
    ledgerEntries: number;
  };
  recentConversations: Array<{
    id: string;
    title: string;
    messagesCount: number;
    updatedAt: string;
  }>;
  memoryItems: Array<{
    id: string;
    title: string;
    source: string | null;
    updatedAt: string;
  }>;
  businessMemberships: Array<{
    workspaceName: string;
    roleKey: string;
    roleTitle: string;
    status: string;
  }>;
};

export type UserDeletionResult = {
  userId: string;
  deletedAt: string;
  emailBeforeDeletion: string | null;
  retainedRecords: string[];
};

export type UpdateUserProfileInput = {
  name?: string;
  country?: CountryCode;
  language?: Language;
  avatarUrl?: string | null;
};

export interface UserRepository {
  findById(userId: string): Promise<UserRecord | null>;
  updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserRecord | null>;
  exportData(userId: string, fallbackUser?: UserRecord): Promise<UserDataExportRecord | null>;
  deactivateAccount(userId: string, fallbackUser?: UserRecord): Promise<UserDeletionResult | null>;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>([
    [
      "local-user",
      {
        id: "local-user",
        name: "Local User",
        email: "local@nomduchat.ai",
        phone: null,
        avatarUrl: null,
        country: "KZ",
        language: "ru",
        systemRole: "user",
        workspaceRole: "personal",
        activePlanId: null,
        businessWorkspace: null,
        permissions: permissionsFor("user", "personal"),
      },
    ],
  ]);

  async findById(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async updateProfile(userId: string, input: UpdateUserProfileInput) {
    const existing = this.users.get(userId);
    if (!existing) return null;

    const updated: UserRecord = {
      ...existing,
      name: input.name ?? existing.name,
      country: input.country ?? existing.country,
      language: input.language ?? existing.language,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existing.avatarUrl,
    };
    this.users.set(userId, updated);
    return updated;
  }

  async exportData(userId: string, fallbackUser?: UserRecord) {
    const user = this.users.get(userId) ?? fallbackUser ?? null;
    if (!user) return null;

    return emptyExport(user);
  }

  async deactivateAccount(userId: string, fallbackUser?: UserRecord) {
    const existing = this.users.get(userId) ?? fallbackUser ?? null;
    if (!existing) return null;

    const deletedAt = new Date().toISOString();
    const anonymized: UserRecord = {
      ...existing,
      name: "Deleted user",
      email: null,
      phone: null,
      avatarUrl: null,
      businessWorkspace: null,
      permissions: permissionsFor("user", "personal"),
      workspaceRole: "personal",
      activePlanId: null,
    };
    this.users.set(userId, anonymized);

    return {
      userId,
      deletedAt,
      emailBeforeDeletion: existing.email,
      retainedRecords: ["billing_ledger", "subscription_checkouts"],
    };
  }
}

type UserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  country_code: string;
  language: string;
  system_role: string | null;
  active_plan_id: string | null;
  business_workspace_id: string | null;
  business_workspace_name: string | null;
  business_member_id: string | null;
  business_member_role_key: string | null;
  business_group_id: string | null;
  business_group_name: string | null;
} & Record<string, unknown>;

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly database: DatabaseClient) {}

  async findById(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    if (userId === LOCAL_USER_PUBLIC_ID) {
      await ensureLocalUser(this.database);
    }

    const result = await this.database.query<UserRow>(
      `
        select
          u.id,
          u.display_name,
          u.email,
          u.phone,
          u.avatar_url,
          u.country_code,
          u.language,
          u.system_role,
          (
            select s.plan_slug
            from subscriptions s
            where s.user_id = u.id and s.status = 'active'
            order by s.created_at desc
            limit 1
          ) as active_plan_id,
          coalesce(owner_ws.id, employee_ws.id) as business_workspace_id,
          coalesce(owner_ws.name, employee_ws.name) as business_workspace_name,
          bm.id as business_member_id,
          bm.role_key as business_member_role_key,
          bg.id as business_group_id,
          bg.name as business_group_name
        from users u
        left join business_workspaces owner_ws on owner_ws.user_id = u.id
        left join business_members bm on bm.user_id = u.id
        left join business_workspaces employee_ws on employee_ws.id = bm.workspace_id
        left join business_group_members bgm on bgm.member_id = bm.id
        left join business_groups bg on bg.id = bgm.group_id
        where u.id = $1
        limit 1
      `,
      [databaseUserId]
    );

    const row = result.rows[0];
    return row ? mapUserRow(row) : null;
  }

  async updateProfile(userId: string, input: UpdateUserProfileInput) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    if (userId === LOCAL_USER_PUBLIC_ID) {
      await ensureLocalUser(this.database);
    }

    await this.database.query(
      `
        update users
        set display_name = coalesce($2, display_name),
            country_code = coalesce($3, country_code),
            language = coalesce($4, language),
            avatar_url = case when $5::boolean then $6 else avatar_url end,
            updated_at = now()
        where id = $1
      `,
      [
        databaseUserId,
        input.name ?? null,
        input.country ?? null,
        input.language ?? null,
        input.avatarUrl !== undefined,
        input.avatarUrl ?? null,
      ]
    );

    return this.findById(userId);
  }

  async exportData(userId: string, fallbackUser?: UserRecord) {
    const user = await this.findById(userId);
    if (!user && !fallbackUser) return null;

    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return fallbackUser ? emptyExport(fallbackUser) : null;

    const [
      conversationCount,
      messageCount,
      memoryCount,
      generationCount,
      workspaceCount,
      membershipCount,
      telegramOrderCount,
      checkoutCount,
      ledgerCount,
      conversations,
      memoryItems,
      memberships,
    ] = await Promise.all([
      this.count("conversations", "user_id", databaseUserId),
      this.countMessages(databaseUserId),
      this.count("memory_items", "user_id", databaseUserId),
      this.count("generation_jobs", "user_id", databaseUserId),
      this.count("business_workspaces", "user_id", databaseUserId),
      this.count("business_members", "user_id", databaseUserId),
      this.count("telegram_bot_orders", "user_id", databaseUserId),
      this.count("subscription_checkouts", "user_id", databaseUserId),
      this.countLedgerEntries(databaseUserId),
      this.listRecentConversations(databaseUserId),
      this.listMemoryItems(databaseUserId),
      this.listBusinessMemberships(databaseUserId),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      user: user ?? fallbackUser!,
      counts: {
        conversations: conversationCount,
        messages: messageCount,
        memoryItems: memoryCount,
        generationJobs: generationCount,
        businessWorkspaces: workspaceCount,
        businessMemberships: membershipCount,
        telegramBotOrders: telegramOrderCount,
        subscriptionCheckouts: checkoutCount,
        ledgerEntries: ledgerCount,
      },
      recentConversations: conversations,
      memoryItems,
      businessMemberships: memberships,
    };
  }

  async deactivateAccount(userId: string, fallbackUser?: UserRecord) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    const existingUser = await this.findById(userId);
    if (!existingUser && !fallbackUser) return null;

    const deletedAt = new Date().toISOString();
    const anonymizedEmail = `deleted+${databaseUserId}@nomduchat.local`;

    await this.database.query(
      `
        update messages
        set content = '[deleted]',
            metadata = '{}'::jsonb
        where conversation_id in (
          select id from conversations where user_id = $1
        )
      `,
      [databaseUserId]
    );

    await this.database.query(
      `
        update conversations
        set title = 'Deleted conversation',
            updated_at = now()
        where user_id = $1
      `,
      [databaseUserId]
    );

    await this.database.query(
      `
        update memory_items
        set title = 'Deleted memory',
            content = '[deleted]',
            source = null,
            enabled = false,
            updated_at = now()
        where user_id = $1
      `,
      [databaseUserId]
    );

    await this.database.query(
      `
        update generation_jobs
        set prompt = '[deleted]',
            error_message = null,
            metadata = '{}'::jsonb,
            updated_at = now()
        where user_id = $1
      `,
      [databaseUserId]
    );

    await this.database.query(
      `
        update telegram_bot_orders
        set owner_name = '',
            contact = '[deleted]',
            business_description = '[deleted]',
            services = '[deleted]',
            audience = '',
            bot_purpose = '[deleted]',
            response_rules = '[deleted]',
            escalation_contact = '[deleted]',
            faq = '',
            source_links = '',
            bot_username = null,
            bot_token_provided = false,
            bot_token_hint = null,
            setup_summary = '[deleted]',
            system_prompt = '[deleted]',
            updated_at = now()
        where user_id = $1
      `,
      [databaseUserId]
    );

    await this.database.query(
      `
        update business_members
        set user_id = null,
            invited_email = null,
            status = 'offline',
            updated_at = now()
        where user_id = $1
      `,
      [databaseUserId]
    );

    await this.database.query(
      `
        update oauth_accounts
        set email = null,
            display_name = 'Deleted user',
            raw_profile = '{}'::jsonb,
            updated_at = now()
        where user_id = $1
      `,
      [databaseUserId]
    );

    await this.database.query(
      `
        update users
        set email = $2,
            phone = null,
            avatar_url = null,
            password_hash = null,
            display_name = 'Deleted user',
            updated_at = now()
        where id = $1
      `,
      [databaseUserId, anonymizedEmail]
    );

    return {
      userId,
      deletedAt,
      emailBeforeDeletion: existingUser?.email ?? fallbackUser?.email ?? null,
      retainedRecords: ["billing_ledger", "subscription_checkouts", "subscription_events", "audit_logs"],
    };
  }

  private async count(table: string, column: string, databaseUserId: string) {
    const result = await this.database.query<{ count: string }>(
      `select count(*)::text as count from ${table} where ${column} = $1`,
      [databaseUserId]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async countMessages(databaseUserId: string) {
    const result = await this.database.query<{ count: string }>(
      `
        select count(*)::text as count
        from messages m
        join conversations c on c.id = m.conversation_id
        where c.user_id = $1
      `,
      [databaseUserId]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async countLedgerEntries(databaseUserId: string) {
    const result = await this.database.query<{ count: string }>(
      `
        select count(*)::text as count
        from ledger_entries e
        join wallets w on w.id = e.wallet_id
        where w.user_id = $1
      `,
      [databaseUserId]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async listRecentConversations(databaseUserId: string) {
    const result = await this.database.query<{
      id: string;
      title: string | null;
      messages_count: string;
      updated_at: Date | string;
    }>(
      `
        select
          c.id::text as id,
          c.title,
          count(m.id)::text as messages_count,
          c.updated_at
        from conversations c
        left join messages m on m.conversation_id = c.id
        where c.user_id = $1
        group by c.id
        order by c.updated_at desc
        limit 20
      `,
      [databaseUserId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title ?? "Conversation",
      messagesCount: Number(row.messages_count),
      updatedAt: toIso(row.updated_at),
    }));
  }

  private async listMemoryItems(databaseUserId: string) {
    const result = await this.database.query<{
      id: string;
      title: string;
      source: string | null;
      updated_at: Date | string;
    }>(
      `
        select id::text as id, title, source, updated_at
        from memory_items
        where user_id = $1
        order by updated_at desc
        limit 50
      `,
      [databaseUserId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      updatedAt: toIso(row.updated_at),
    }));
  }

  private async listBusinessMemberships(databaseUserId: string) {
    const result = await this.database.query<{
      workspace_name: string;
      role_key: string;
      role_title: string;
      status: string;
    }>(
      `
        select w.name as workspace_name, m.role_key, m.role_title, m.status
        from business_members m
        join business_workspaces w on w.id = m.workspace_id
        where m.user_id = $1
        order by m.created_at desc
      `,
      [databaseUserId]
    );

    return result.rows.map((row) => ({
      workspaceName: row.workspace_name,
      roleKey: row.role_key,
      roleTitle: row.role_title,
      status: row.status,
    }));
  }
}

function emptyExport(user: UserRecord): UserDataExportRecord {
  return {
    generatedAt: new Date().toISOString(),
    user,
    counts: {
      conversations: 0,
      messages: 0,
      memoryItems: 0,
      generationJobs: 0,
      businessWorkspaces: 0,
      businessMemberships: 0,
      telegramBotOrders: 0,
      subscriptionCheckouts: 0,
      ledgerEntries: 0,
    },
    recentConversations: [],
    memoryItems: [],
    businessMemberships: [],
  };
}

function mapUserRow(row: UserRow): UserRecord {
  const systemRole = resolveSystemRole(row.system_role, row.email);
  const workspaceRole = resolveWorkspaceRole(row, systemRole);

  return {
    id: toPublicUserId(row.id),
    name: row.display_name ?? "nomduchat User",
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    country: isCountryCode(row.country_code) ? row.country_code : "KZ",
    language: isLanguage(row.language) ? row.language : "ru",
    systemRole,
    workspaceRole,
    activePlanId: row.active_plan_id,
    businessWorkspace: row.business_workspace_id
      ? {
          id: row.business_workspace_id,
          name: row.business_workspace_name ?? "Business workspace",
          memberId: row.business_member_id,
          memberRoleKey: row.business_member_role_key,
          groupId: row.business_group_id,
          groupName: row.business_group_name,
        }
      : null,
    permissions: permissionsFor(systemRole, workspaceRole),
  };
}

function resolveSystemRole(value: string | null, email: string | null): SystemRole {
  if (value === "admin") return "admin";
  if (isAdminEmail(email)) return "admin";
  return "user";
}

function resolveWorkspaceRole(row: UserRow, systemRole: SystemRole): WorkspaceRole {
  if (systemRole === "admin") return "personal";
  if (row.active_plan_id === "business" || (row.business_workspace_id && !row.business_member_id)) {
    return "business_owner";
  }
  if (row.business_member_id) return "business_employee";
  return "personal";
}

function permissionsFor(systemRole: SystemRole, workspaceRole: WorkspaceRole): UserPermissions {
  if (systemRole === "admin") {
    return {
      adminPanel: true,
      globalMetrics: true,
      mailings: true,
      business: true,
      businessSettings: true,
      employeeReports: true,
    };
  }

  if (workspaceRole === "business_owner") {
    return {
      adminPanel: false,
      globalMetrics: false,
      mailings: false,
      business: true,
      businessSettings: true,
      employeeReports: true,
    };
  }

  if (workspaceRole === "business_employee") {
    return {
      adminPanel: false,
      globalMetrics: false,
      mailings: false,
      business: true,
      businessSettings: false,
      employeeReports: true,
    };
  }

  return {
    adminPanel: false,
    globalMetrics: false,
    mailings: false,
    business: false,
    businessSettings: false,
    employeeReports: false,
  };
}

function isLanguage(value: string): value is Language {
  return value === "ru" || value === "kz" || value === "en";
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
