import type { UserApiRecord } from "./api";

export type WorkspaceAccess = {
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

export function getWorkspaceAccess(user: UserApiRecord | null): WorkspaceAccess {
  const isGuest = !user;
  const isOwner = user?.email?.trim().toLowerCase() === "dias.sunnatilla@gmail.com";
  const isAdmin = Boolean(user?.permissions.adminPanel || isOwner);
  const hasBusinessIdentity =
    isOwner ||
    user?.workspaceRole === "business_owner" ||
    user?.workspaceRole === "business_employee" ||
    user?.activePlanId === "business" ||
    Boolean(user?.businessWorkspace);
  const canUseBusiness = Boolean(user?.permissions.business && hasBusinessIdentity && (!isAdmin || isOwner));
  const canManageBusiness = Boolean(canUseBusiness && user?.permissions.businessSettings);
  const canSeeEmployeeReports = Boolean(canUseBusiness && user?.permissions.employeeReports);

  return {
    isGuest,
    isAdmin,
    isOwner,
    canUseChat: !isAdmin || isOwner,
    canUseHistory: !isAdmin || isOwner,
    canUseBalance: !isAdmin || isOwner,
    canUseSettings: Boolean(user),
    canUseMailings: Boolean(isAdmin && user?.permissions.mailings),
    canUseBusiness,
    canUseBusinessOverview: canUseBusiness,
    canUseBusinessDialogs: canUseBusiness,
    canUseBusinessAnalytics: canSeeEmployeeReports,
    canUseBusinessWebsite: canManageBusiness,
    canUseBusinessTelegramBot: canManageBusiness,
    canUseBusinessIdeas: canManageBusiness,
  };
}

export function getUnauthorizedWorkspaceRedirect(pathname: string, access: WorkspaceAccess) {
  if (access.isAdmin && !access.isOwner) {
    if (isWorkspacePath(pathname, "/workspace/mailings") && !access.canUseMailings) {
      return "/workspace/admin";
    }

    const adminPathAllowed =
      isWorkspacePath(pathname, "/workspace/admin") ||
      isWorkspacePath(pathname, "/workspace/mailings") ||
      isWorkspacePath(pathname, "/workspace/settings");

    return adminPathAllowed ? null : "/workspace/admin";
  }

  if (isWorkspacePath(pathname, "/workspace/admin")) {
    return access.isAdmin ? null : "/workspace/chat";
  }

  if (isWorkspacePath(pathname, "/workspace/mailings")) {
    if (!access.isAdmin) return "/workspace/chat";
    return access.canUseMailings ? null : "/workspace/admin";
  }

  if (isWorkspacePath(pathname, "/workspace/business")) {
    return getBusinessRedirect(pathname, access);
  }

  if (isWorkspacePath(pathname, "/workspace/balance") && !access.canUseBalance) {
    return "/workspace/chat";
  }

  if ((isWorkspacePath(pathname, "/workspace/settings") || isWorkspacePath(pathname, "/workspace/memory")) && !access.canUseSettings) {
    return "/workspace/chat";
  }

  return null;
}

function getBusinessRedirect(pathname: string, access: WorkspaceAccess) {
  if (!access.canUseBusiness) return "/workspace/chat";

  if (isWorkspacePath(pathname, "/workspace/business/website") && !access.canUseBusinessWebsite) {
    return businessFallback(access);
  }

  if (isWorkspacePath(pathname, "/workspace/business/telegram-bot") && !access.canUseBusinessTelegramBot) {
    return businessFallback(access);
  }

  if (isWorkspacePath(pathname, "/workspace/business/ideas") && !access.canUseBusinessIdeas) {
    return businessFallback(access);
  }

  if (isWorkspacePath(pathname, "/workspace/business/analytics") && !access.canUseBusinessAnalytics) {
    return businessFallback(access);
  }

  return null;
}

function businessFallback(access: WorkspaceAccess) {
  if (access.canUseBusinessDialogs) return "/workspace/business/dialogs";
  if (access.canUseBusinessOverview) return "/workspace/business";
  return "/workspace/chat";
}

function isWorkspacePath(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}
