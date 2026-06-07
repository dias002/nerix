import { isCountryCode, type Language } from "@nerix/shared";
import { config } from "../../config.js";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, LOCAL_USER_PUBLIC_ID, toDatabaseUserId, toPublicUserId } from "./local-user.js";
import type { SystemRole, UserPermissions, UserRecord, WorkspaceRole } from "./user.types.js";

export interface UserRepository {
  findById(userId: string): Promise<UserRecord | null>;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>([
    [
      "local-user",
      {
        id: "local-user",
        name: "Local User",
        email: "local@nerix.ai",
        phone: null,
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
}

type UserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
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
}

function mapUserRow(row: UserRow): UserRecord {
  const systemRole = resolveSystemRole(row.system_role, row.email);
  const workspaceRole = resolveWorkspaceRole(row, systemRole);

  return {
    id: toPublicUserId(row.id),
    name: row.display_name ?? "Nerix User",
    email: row.email,
    phone: row.phone,
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
  const adminEmails = config.ADMIN_EMAILS.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (email && adminEmails.includes(email.toLowerCase())) return "admin";
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
