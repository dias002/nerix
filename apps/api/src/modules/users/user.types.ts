import type { CountryCode, Language } from "@nerix/shared";

export type SystemRole = "user" | "admin";
export type WorkspaceRole = "personal" | "business_owner" | "business_employee";

export type UserPermissions = {
  adminPanel: boolean;
  globalMetrics: boolean;
  mailings: boolean;
  business: boolean;
  businessSettings: boolean;
  employeeReports: boolean;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: CountryCode;
  language: Language;
  systemRole: SystemRole;
  workspaceRole: WorkspaceRole;
  activePlanId: string | null;
  businessWorkspace: {
    id: string;
    name: string;
    memberId: string | null;
    memberRoleKey: string | null;
    groupId: string | null;
    groupName: string | null;
  } | null;
  permissions: UserPermissions;
};
