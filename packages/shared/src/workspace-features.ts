export type WorkspaceFeatureStatus = "ready" | "beta" | "hidden";

export type WorkspaceFeatureAccess = {
  isGuest: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  canUseChat: boolean;
  canUseHistory: boolean;
  canUseBalance: boolean;
  canUseSettings: boolean;
  canUseMailings: boolean;
  canUseBusiness: boolean;
  canUseBusinessOverview: boolean;
  canUseBusinessDialogs: boolean;
  canUseBusinessAnalytics: boolean;
  canUseBusinessWebsite: boolean;
  canUseBusinessTelegramBot: boolean;
  canUseBusinessIdeas: boolean;
};

export type WorkspaceFeaturePermissionsInput = {
  business?: boolean;
  businessSettings?: boolean;
  employeeReports?: boolean;
  mailings?: boolean;
};

export type WorkspaceFeatureAccessInput = {
  isGuest: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  workspaceRole?: string | null;
  activePlanId?: string | null;
  permissions?: WorkspaceFeaturePermissionsInput;
  hasBusinessWorkspace?: boolean;
};

export function resolveWorkspaceFeatureAccess(input: WorkspaceFeatureAccessInput): WorkspaceFeatureAccess {
  const workspaceRole = input.workspaceRole?.trim().toLowerCase() ?? "";
  const hasBusinessWorkspace = Boolean(input.hasBusinessWorkspace);
  const permissions = input.permissions ?? {};
  const hasBusinessIdentity =
    input.isOwner ||
    workspaceRole === "business_owner" ||
    workspaceRole === "business_employee" ||
    input.activePlanId === "business" ||
    hasBusinessWorkspace;
  const canUseBusiness = Boolean(permissions.business && hasBusinessIdentity && (!input.isAdmin || input.isOwner));
  const canManageBusiness = Boolean(canUseBusiness && permissions.businessSettings);
  const canSeeEmployeeReports = Boolean(canUseBusiness && permissions.employeeReports);

  return {
    isGuest: input.isGuest,
    isAdmin: input.isAdmin,
    isOwner: input.isOwner,
    canUseChat: true,
    canUseHistory: !input.isAdmin || input.isOwner,
    canUseBalance: !input.isAdmin || input.isOwner,
    canUseSettings: !input.isGuest,
    canUseMailings: Boolean(input.isAdmin && permissions.mailings),
    canUseBusiness: canUseBusiness,
    canUseBusinessOverview: canUseBusiness,
    canUseBusinessDialogs: canUseBusiness,
    canUseBusinessAnalytics: canSeeEmployeeReports,
    canUseBusinessWebsite: canManageBusiness,
    canUseBusinessTelegramBot: canManageBusiness,
    canUseBusinessIdeas: canManageBusiness,
  };
}

export function getWorkspaceFeaturePaths() {
  return featureRulePaths.slice();
}

type WorkspaceFeatureRule = WorkspaceFeatureStatus | ((access: WorkspaceFeatureAccess) => WorkspaceFeatureStatus);

const workspaceFeatureRules: Record<string, WorkspaceFeatureRule> = {
  "/workspace": "ready",
  "/workspace/home": "ready",
  "/workspace/chat": "ready",
  "/workspace/apps": "ready",
  "/workspace/media": "ready",
  "/workspace/projects": "ready",
  "/workspace/history": "ready",
  "/workspace/avatar": "ready",
  "/workspace/balance": (access) => (access.canUseBalance ? "ready" : "hidden"),
  "/workspace/business": (access) => (access.canUseBusiness ? "ready" : "hidden"),
  "/workspace/business/website": (access) => (access.canUseBusinessWebsite ? "ready" : "hidden"),
  "/workspace/business/telegram-bot": (access) => (access.canUseBusinessTelegramBot ? "ready" : "hidden"),
  "/workspace/business/dialogs": (access) => (access.canUseBusinessDialogs ? "ready" : "hidden"),
  "/workspace/business/analytics": (access) => (access.canUseBusinessAnalytics ? "ready" : "hidden"),
  "/workspace/business/ideas": (access) => (access.canUseBusinessIdeas ? "ready" : "hidden"),
  "/workspace/admin": (access) => (access.isAdmin ? "ready" : "hidden"),
  "/workspace/admin/users": (access) => (access.isAdmin ? "ready" : "hidden"),
  "/workspace/admin/control": (access) => (access.isAdmin ? "ready" : "hidden"),
  "/workspace/admin/pricing": (access) => (access.isAdmin ? "ready" : "hidden"),
  "/workspace/admin/ai-budget": (access) => (access.isAdmin ? "ready" : "hidden"),
  "/workspace/admin/memory": (access) => (access.isAdmin ? "ready" : "hidden"),
  "/workspace/settings": (access) => (access.canUseSettings ? "ready" : "hidden"),
  "/workspace/settings/profile": (access) => (access.canUseSettings ? "ready" : "hidden"),
  "/workspace/settings/memory": (access) => (access.canUseSettings ? "ready" : "hidden"),
  "/workspace/settings/appearance": (access) => (access.canUseSettings ? "ready" : "hidden"),
  "/workspace/settings/notifications": (access) => (access.canUseSettings ? "ready" : "hidden"),
  "/workspace/mailings": (access) => (access.canUseMailings ? "ready" : "hidden"),
  "/workspace/agents": "ready",
};

const featureRulePaths = Object.keys(workspaceFeatureRules).sort((left, right) => right.length - left.length);

export function getWorkspaceFeatureStatus(
  pathname: string,
  access: WorkspaceFeatureAccess,
): WorkspaceFeatureStatus {
  const normalized = normalizeWorkspacePath(pathname);
  const matchedFeaturePath = featureRulePaths.find((path) => isWorkspacePath(normalized, path));
  const rule = matchedFeaturePath ? workspaceFeatureRules[matchedFeaturePath] : "ready";
  return typeof rule === "function" ? rule(access) : rule;
}

function normalizeWorkspacePath(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function isWorkspacePath(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}
