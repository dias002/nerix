import { randomUUID } from "node:crypto";
import { isCountryCode, type CountryCode, type Language } from "@nomduchat/shared";
import type { DatabaseClient } from "../../database/index.js";
import { ensureOwnerAccountEntitlements, isAdminEmail } from "../users/admin-access.js";
import { toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import type { SystemRole, UserPermissions, UserRecord, WorkspaceRole } from "../users/user.types.js";

export type AuthUserRecord = UserRecord & {
  passwordHash: string;
};

export type OAuthProviderCode = "google" | "vk";

export type OAuthUserProfile = {
  provider: OAuthProviderCode;
  providerUserId: string;
  email: string | null;
  name: string;
  country: CountryCode;
  language: Language;
  rawProfile?: Record<string, unknown>;
};

export type OAuthAccountRecord = {
  provider: OAuthProviderCode;
  providerUserId: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OAuthUnlinkResult = "unlinked" | "not_found" | "last_sign_in_method";

export type PasswordResetTokenTarget = {
  userId: string;
  email: string;
  name: string;
};

export interface AuthRepository {
  createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
    country: CountryCode;
    language: Language;
  }): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(userId: string): Promise<UserRecord | null>;
  findOrCreateOAuthUser(input: OAuthUserProfile): Promise<UserRecord>;
  listOAuthAccounts(userId: string): Promise<OAuthAccountRecord[]>;
  unlinkOAuthAccount(userId: string, provider: OAuthProviderCode): Promise<OAuthUnlinkResult>;
  createPasswordResetToken(input: {
    email: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<PasswordResetTokenTarget | null>;
  resetPasswordWithToken(input: {
    tokenHash: string;
    passwordHash: string;
  }): Promise<UserRecord | null>;
}

export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly emailIndex = new Map<string, string>();
  private readonly oauthIndex = new Map<string, OAuthAccountRecord & { userId: string }>();
  private readonly passwordResetTokens = new Map<
    string,
    { userId: string; expiresAt: string; usedAt: string | null }
  >();

  async createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
    country: CountryCode;
    language: Language;
  }) {
    const email = normalizeEmail(input.email);
    if (this.emailIndex.has(email)) return null;

    const systemRole = resolveSystemRole("user", email);
    const user: AuthUserRecord = {
      id: randomUUID(),
      email,
      phone: null,
      name: input.name,
      country: input.country,
      language: input.language,
      systemRole,
      workspaceRole: "personal",
      activePlanId: null,
      businessWorkspace: null,
      permissions: permissionsFor(systemRole, "personal"),
      passwordHash: input.passwordHash,
    };

    this.users.set(user.id, user);
    this.emailIndex.set(email, user.id);
    return publicUser(user);
  }

  async findByEmail(email: string) {
    const userId = this.emailIndex.get(normalizeEmail(email));
    return userId ? this.users.get(userId) ?? null : null;
  }

  async findById(userId: string) {
    const user = this.users.get(userId);
    return user ? publicUser(user) : null;
  }

  async findOrCreateOAuthUser(input: OAuthUserProfile) {
    const oauthKey = `${input.provider}:${input.providerUserId}`;
    const existingOAuth = this.oauthIndex.get(oauthKey);
    if (existingOAuth) {
      const existingUser = this.users.get(existingOAuth.userId);
      if (existingUser) return publicUser(existingUser);
    }

    const email = input.email ? normalizeEmail(input.email) : null;
    const existingEmailUserId = email ? this.emailIndex.get(email) : null;
    if (existingEmailUserId) {
      this.oauthIndex.set(oauthKey, createInMemoryOAuthAccount(existingEmailUserId, input));
      return publicUser(this.users.get(existingEmailUserId)!);
    }

    const systemRole = resolveSystemRole("user", email);
    const user: AuthUserRecord = {
      id: randomUUID(),
      email,
      phone: null,
      name: input.name,
      country: input.country,
      language: input.language,
      systemRole,
      workspaceRole: "personal",
      activePlanId: null,
      businessWorkspace: null,
      permissions: permissionsFor(systemRole, "personal"),
      passwordHash: "",
    };

    this.users.set(user.id, user);
    if (email) this.emailIndex.set(email, user.id);
    this.oauthIndex.set(oauthKey, createInMemoryOAuthAccount(user.id, input));
    return publicUser(user);
  }

  async listOAuthAccounts(userId: string) {
    return Array.from(this.oauthIndex.values())
      .filter((account) => account.userId === userId)
      .map(({ userId: _userId, ...account }) => account)
      .sort((left, right) => left.provider.localeCompare(right.provider) || left.createdAt.localeCompare(right.createdAt));
  }

  async unlinkOAuthAccount(userId: string, provider: OAuthProviderCode): Promise<OAuthUnlinkResult> {
    const user = this.users.get(userId);
    if (!user) return "not_found";

    const entries = Array.from(this.oauthIndex.entries()).filter(
      ([, account]) => account.userId === userId && account.provider === provider
    );
    if (entries.length === 0) return "not_found";

    const accountCount = Array.from(this.oauthIndex.values()).filter((account) => account.userId === userId).length;
    if (!user.passwordHash && accountCount <= entries.length) {
      return "last_sign_in_method";
    }

    for (const [key] of entries) {
      this.oauthIndex.delete(key);
    }
    return "unlinked";
  }

  async createPasswordResetToken(input: { email: string; tokenHash: string; expiresAt: string }) {
    const userId = this.emailIndex.get(normalizeEmail(input.email));
    const user = userId ? this.users.get(userId) : null;
    if (!user || !user.email) return null;

    for (const token of this.passwordResetTokens.values()) {
      if (token.userId === user.id && !token.usedAt) {
        token.usedAt = new Date().toISOString();
      }
    }

    this.passwordResetTokens.set(input.tokenHash, {
      userId: user.id,
      expiresAt: input.expiresAt,
      usedAt: null,
    });

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
    };
  }

  async resetPasswordWithToken(input: { tokenHash: string; passwordHash: string }) {
    const token = this.passwordResetTokens.get(input.tokenHash);
    if (!token || token.usedAt || new Date(token.expiresAt).getTime() < Date.now()) return null;

    const user = this.users.get(token.userId);
    if (!user) return null;

    token.usedAt = new Date().toISOString();
    user.passwordHash = input.passwordHash;
    this.users.set(user.id, user);
    return publicUser(user);
  }
}

type AuthUserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string;
  language: string;
  system_role: string | null;
  active_plan_id?: string | null;
  business_workspace_id?: string | null;
  business_workspace_name?: string | null;
  business_member_id?: string | null;
  business_member_role_key?: string | null;
  business_group_id?: string | null;
  business_group_name?: string | null;
  password_hash: string | null;
} & Record<string, unknown>;

type OAuthAccountRow = {
  provider: string;
  provider_user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly database: DatabaseClient) {}

  async createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
    country: CountryCode;
    language: Language;
  }) {
    const result = await this.database.query<AuthUserRow>(
      `
        insert into users (email, display_name, country_code, language, password_hash)
        values ($1, $2, $3, $4, $5)
        on conflict (email) do nothing
        returning
          id,
          display_name,
          email,
          phone,
          country_code,
          language,
          system_role,
          null::text as active_plan_id,
          null::text as business_workspace_id,
          null::text as business_workspace_name,
          null::text as business_member_id,
          null::text as business_member_role_key,
          null::text as business_group_id,
          null::text as business_group_name,
          password_hash
      `,
      [normalizeEmail(input.email), input.name, input.country, input.language, input.passwordHash]
    );

    const row = result.rows[0];
    if (!row) return null;

    await this.linkPendingBusinessInvites(row.id, normalizeEmail(input.email));
    return (await this.findById(toPublicUserId(row.id))) ?? publicUser(mapRow(row));
  }

  async findByEmail(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const result = await this.database.query<AuthUserRow>(
      `
        select
          u.id,
          u.display_name,
          u.email,
          u.phone,
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
          coalesce(owner_ws.id, employee_ws.id)::text as business_workspace_id,
          coalesce(owner_ws.name, employee_ws.name) as business_workspace_name,
          bm.id::text as business_member_id,
          bm.role_key as business_member_role_key,
          bg.id::text as business_group_id,
          bg.name as business_group_name,
          u.password_hash
        from users u
        left join business_workspaces owner_ws on owner_ws.user_id = u.id
        left join business_members bm on bm.user_id = u.id
        left join business_workspaces employee_ws on employee_ws.id = bm.workspace_id
        left join business_group_members bgm on bgm.member_id = bm.id
        left join business_groups bg on bg.id = bgm.group_id
        where u.email = $1 and u.password_hash is not null
        limit 1
      `,
      [normalizedEmail]
    );

    const row = result.rows[0];
    if (!row) return null;

    await this.linkPendingBusinessInvites(row.id, normalizedEmail);
    await ensureOwnerAccountEntitlements(this.database, row.id);
    return mapRow((await this.findAuthRowByDatabaseId(row.id)) ?? row);
  }

  async findById(userId: string) {
    const result = await this.database.query<AuthUserRow>(
      `
        select
          u.id,
          u.display_name,
          u.email,
          u.phone,
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
          coalesce(owner_ws.id, employee_ws.id)::text as business_workspace_id,
          coalesce(owner_ws.name, employee_ws.name) as business_workspace_name,
          bm.id::text as business_member_id,
          bm.role_key as business_member_role_key,
          bg.id::text as business_group_id,
          bg.name as business_group_name,
          u.password_hash
        from users u
        left join business_workspaces owner_ws on owner_ws.user_id = u.id
        left join business_members bm on bm.user_id = u.id
        left join business_workspaces employee_ws on employee_ws.id = bm.workspace_id
        left join business_group_members bgm on bgm.member_id = bm.id
        left join business_groups bg on bg.id = bgm.group_id
        where u.id = $1
        limit 1
      `,
      [userId]
    );

    const row = result.rows[0];
    if (!row) return null;

    await ensureOwnerAccountEntitlements(this.database, row.id);
    return publicUser(mapRow((await this.findAuthRowByDatabaseId(row.id)) ?? row));
  }

  async createPasswordResetToken(input: { email: string; tokenHash: string; expiresAt: string }) {
    const normalizedEmail = normalizeEmail(input.email);
    const result = await this.database.query<{
      id: string;
      email: string | null;
      display_name: string | null;
    }>(
      `
        select id, email, display_name
        from users
        where email = $1
        limit 1
      `,
      [normalizedEmail]
    );

    const user = result.rows[0];
    if (!user?.email) return null;

    await this.database.query(
      `
        update password_reset_tokens
        set used_at = now()
        where user_id = $1 and used_at is null
      `,
      [user.id]
    );

    await this.database.query(
      `
        insert into password_reset_tokens (user_id, token_hash, expires_at)
        values ($1, $2, $3)
      `,
      [user.id, input.tokenHash, input.expiresAt]
    );

    return {
      userId: toPublicUserId(user.id),
      email: user.email,
      name: user.display_name ?? "nomduchat User",
    };
  }

  async resetPasswordWithToken(input: { tokenHash: string; passwordHash: string }) {
    return this.transaction(async (client) => {
      const tokenResult = await client.query<{ id: string; user_id: string }>(
        `
          select id, user_id
          from password_reset_tokens
          where token_hash = $1
            and used_at is null
            and expires_at > now()
          limit 1
          for update
        `,
        [input.tokenHash]
      );

      const token = tokenResult.rows[0];
      if (!token) return null;

      await client.query(
        `
          update users
          set password_hash = $1,
              updated_at = now()
          where id = $2
        `,
        [input.passwordHash, token.user_id]
      );

      await client.query(
        `
          update password_reset_tokens
          set used_at = now()
          where id = $1
        `,
        [token.id]
      );

      const row = await this.findAuthRowByDatabaseId(token.user_id, client);
      if (!row) return null;

      await ensureOwnerAccountEntitlements(client, row.id);
      return publicUser(mapRow((await this.findAuthRowByDatabaseId(row.id, client)) ?? row));
    });
  }

  async findOrCreateOAuthUser(input: OAuthUserProfile) {
    return this.transaction(async (client) => {
      const linkedUser = await client.query<AuthUserRow>(
        `
          select
            u.id,
            u.display_name,
            u.email,
            u.phone,
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
            coalesce(owner_ws.id, employee_ws.id)::text as business_workspace_id,
            coalesce(owner_ws.name, employee_ws.name) as business_workspace_name,
            bm.id::text as business_member_id,
            bm.role_key as business_member_role_key,
            bg.id::text as business_group_id,
            bg.name as business_group_name,
            u.password_hash
          from oauth_accounts oa
          join users u on u.id = oa.user_id
          left join business_workspaces owner_ws on owner_ws.user_id = u.id
          left join business_members bm on bm.user_id = u.id
          left join business_workspaces employee_ws on employee_ws.id = bm.workspace_id
          left join business_group_members bgm on bgm.member_id = bm.id
          left join business_groups bg on bg.id = bgm.group_id
          where oa.provider = $1 and oa.provider_user_id = $2
          limit 1
        `,
        [input.provider, input.providerUserId]
      );

      if (linkedUser.rows[0]) {
        const row = linkedUser.rows[0];
        const normalizedEmail = row.email ? normalizeEmail(row.email) : null;
        if (normalizedEmail) {
          await this.linkPendingBusinessInvites(row.id, normalizedEmail, client);
        }
        await ensureOwnerAccountEntitlements(client, row.id);
        return publicUser(mapRow((await this.findAuthRowByDatabaseId(row.id, client)) ?? row));
      }

      const normalizedEmail = input.email ? normalizeEmail(input.email) : null;
      let userRow: AuthUserRow | undefined;

      if (normalizedEmail) {
        const existingUser = await client.query<AuthUserRow>(
          `
            select
              u.id,
              u.display_name,
              u.email,
              u.phone,
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
              coalesce(owner_ws.id, employee_ws.id)::text as business_workspace_id,
              coalesce(owner_ws.name, employee_ws.name) as business_workspace_name,
              bm.id::text as business_member_id,
              bm.role_key as business_member_role_key,
              bg.id::text as business_group_id,
              bg.name as business_group_name,
              u.password_hash
            from users u
            left join business_workspaces owner_ws on owner_ws.user_id = u.id
            left join business_members bm on bm.user_id = u.id
            left join business_workspaces employee_ws on employee_ws.id = bm.workspace_id
            left join business_group_members bgm on bgm.member_id = bm.id
            left join business_groups bg on bg.id = bgm.group_id
            where u.email = $1
            limit 1
          `,
          [normalizedEmail]
        );
        userRow = existingUser.rows[0];
      }

      if (!userRow) {
        const createdUser = await client.query<AuthUserRow>(
          `
            insert into users (email, display_name, country_code, language, password_hash)
            values ($1, $2, $3, $4, null)
            returning
              id,
              display_name,
              email,
              phone,
              country_code,
              language,
              system_role,
              null::text as active_plan_id,
              null::text as business_workspace_id,
              null::text as business_workspace_name,
              null::text as business_member_id,
              null::text as business_member_role_key,
              null::text as business_group_id,
              null::text as business_group_name,
              password_hash
          `,
          [normalizedEmail, input.name, input.country, input.language]
        );
        userRow = createdUser.rows[0];
      }

      if (normalizedEmail) {
        await this.linkPendingBusinessInvites(userRow.id, normalizedEmail, client);
      }
      await ensureOwnerAccountEntitlements(client, userRow.id);

      await client.query(
        `
          insert into oauth_accounts (user_id, provider, provider_user_id, email, display_name, raw_profile)
          values ($1, $2, $3, $4, $5, $6::jsonb)
          on conflict (provider, provider_user_id) do update set
            user_id = excluded.user_id,
            email = excluded.email,
            display_name = excluded.display_name,
            raw_profile = excluded.raw_profile,
            updated_at = now()
        `,
        [
          userRow.id,
          input.provider,
          input.providerUserId,
          normalizedEmail,
          input.name,
          JSON.stringify(input.rawProfile ?? {}),
        ]
      );

      return publicUser(mapRow((await this.findAuthRowByDatabaseId(userRow.id, client)) ?? userRow));
    });
  }

  async listOAuthAccounts(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return [];

    const result = await this.database.query<OAuthAccountRow>(
      `
        select provider, provider_user_id, email, display_name, created_at, updated_at
        from oauth_accounts
        where user_id = $1 and provider in ('google', 'vk')
        order by provider asc, created_at asc
      `,
      [databaseUserId]
    );

    return result.rows.map(mapOAuthAccountRow);
  }

  async unlinkOAuthAccount(userId: string, provider: OAuthProviderCode): Promise<OAuthUnlinkResult> {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return "not_found";

    return this.transaction(async (client) => {
      const accountResult = await client.query<{ id: string; password_hash: string | null }>(
        `
          select oa.id, u.password_hash
          from oauth_accounts oa
          join users u on u.id = oa.user_id
          where oa.user_id = $1 and oa.provider = $2
          for update
        `,
        [databaseUserId, provider]
      );
      const accounts = accountResult.rows;
      if (accounts.length === 0) return "not_found";

      const countResult = await client.query<{ count: string | number }>(
        `
          select count(*) as count
          from oauth_accounts
          where user_id = $1
        `,
        [databaseUserId]
      );
      const oauthCount = Number(countResult.rows[0]?.count ?? 0);
      const hasPassword = Boolean(accounts[0]?.password_hash);
      if (!hasPassword && oauthCount <= accounts.length) {
        return "last_sign_in_method";
      }

      await client.query(
        `
          delete from oauth_accounts
          where user_id = $1 and provider = $2
        `,
        [databaseUserId, provider]
      );
      return "unlinked";
    });
  }

  private async transaction<T>(callback: (client: DatabaseClient) => Promise<T>) {
    if (!this.database.transaction) {
      return callback(this.database);
    }

    return this.database.transaction(callback);
  }

  private async linkPendingBusinessInvites(
    userId: string,
    email: string,
    client: DatabaseClient = this.database
  ) {
    await client.query(
      `
        update business_members
        set user_id = $1,
            updated_at = now()
        where user_id is null
          and lower(invited_email) = $2
      `,
      [userId, email]
    );
  }

  private async findAuthRowByDatabaseId(userId: string, client: DatabaseClient = this.database) {
    const result = await client.query<AuthUserRow>(
      `
        select
          u.id,
          u.display_name,
          u.email,
          u.phone,
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
          coalesce(owner_ws.id, employee_ws.id)::text as business_workspace_id,
          coalesce(owner_ws.name, employee_ws.name) as business_workspace_name,
          bm.id::text as business_member_id,
          bm.role_key as business_member_role_key,
          bg.id::text as business_group_id,
          bg.name as business_group_name,
          u.password_hash
        from users u
        left join business_workspaces owner_ws on owner_ws.user_id = u.id
        left join business_members bm on bm.user_id = u.id
        left join business_workspaces employee_ws on employee_ws.id = bm.workspace_id
        left join business_group_members bgm on bgm.member_id = bm.id
        left join business_groups bg on bg.id = bgm.group_id
        where u.id = $1
        limit 1
      `,
      [userId]
    );

    return result.rows[0] ?? null;
  }
}

function mapRow(row: AuthUserRow): AuthUserRecord {
  const systemRole = resolveSystemRole(row.system_role, row.email);
  const workspaceRole = resolveWorkspaceRole(row, systemRole);

  return {
    id: toPublicUserId(row.id),
    name: row.display_name ?? "nomduchat User",
    email: row.email,
    phone: row.phone,
    country: isCountryCode(row.country_code) ? row.country_code : "KZ",
    language: isLanguage(row.language) ? row.language : "ru",
    systemRole,
    workspaceRole,
    activePlanId: row.active_plan_id ?? null,
    businessWorkspace: row.business_workspace_id
      ? {
          id: row.business_workspace_id,
          name: row.business_workspace_name ?? "Business workspace",
          memberId: row.business_member_id ?? null,
          memberRoleKey: row.business_member_role_key ?? null,
          groupId: row.business_group_id ?? null,
          groupName: row.business_group_name ?? null,
        }
      : null,
    permissions: permissionsFor(systemRole, workspaceRole),
    passwordHash: row.password_hash ?? "",
  };
}

function publicUser(user: AuthUserRecord): UserRecord {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    country: user.country,
    language: user.language,
    systemRole: user.systemRole,
    workspaceRole: user.workspaceRole,
    activePlanId: user.activePlanId,
    businessWorkspace: user.businessWorkspace,
    permissions: user.permissions,
  };
}

function createInMemoryOAuthAccount(
  userId: string,
  input: OAuthUserProfile
): OAuthAccountRecord & { userId: string } {
  const now = new Date().toISOString();
  return {
    userId,
    provider: input.provider,
    providerUserId: input.providerUserId,
    email: input.email ? normalizeEmail(input.email) : null,
    displayName: input.name,
    createdAt: now,
    updatedAt: now,
  };
}

function mapOAuthAccountRow(row: OAuthAccountRow): OAuthAccountRecord {
  return {
    provider: row.provider === "vk" ? "vk" : "google",
    providerUserId: row.provider_user_id,
    email: row.email,
    displayName: row.display_name,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function resolveSystemRole(value: string | null, email: string | null): SystemRole {
  if (value === "admin") return "admin";
  if (isAdminEmail(email)) return "admin";
  return "user";
}

function resolveWorkspaceRole(row: AuthUserRow, systemRole: SystemRole): WorkspaceRole {
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isLanguage(value: string): value is Language {
  return value === "ru" || value === "kz" || value === "en";
}
