import type { UserApiRecord } from "./api";
import {
  getWorkspaceFeatureStatus as getWorkspaceFeatureStatusFromShared,
  resolveWorkspaceFeatureAccess,
  type WorkspaceFeatureAccess,
  type WorkspaceFeatureStatus,
} from "@nomduchat/shared";

export type WorkspaceAccess = WorkspaceFeatureAccess;

export function getWorkspaceAccess(user: UserApiRecord | null): WorkspaceAccess {
  const isGuest = !user;
  const isOwner = user?.email?.trim().toLowerCase() === "dias.sunnatilla@gmail.com";
  const isAdmin = Boolean(user?.permissions.adminPanel || isOwner);

  return resolveWorkspaceFeatureAccess({
    isGuest,
    isAdmin,
    isOwner,
    workspaceRole: user?.workspaceRole,
    activePlanId: user?.activePlanId,
    hasBusinessWorkspace: Boolean(user?.businessWorkspace),
    permissions: user?.permissions,
  });
}

export function getUnauthorizedWorkspaceRedirect(pathname: string, access: WorkspaceAccess) {
  const featureStatus = getWorkspaceFeatureStatus(pathname, access);
  if (featureStatus === "hidden") {
    if (isWorkspacePath(pathname, "/workspace/admin")) {
      return access.isAdmin ? "/workspace/admin" : "/workspace/chat";
    }
    if (isWorkspacePath(pathname, "/workspace/business")) {
      return access.canUseBusiness ? "/workspace/business" : "/workspace/chat";
    }
    if (isWorkspacePath(pathname, "/workspace/settings")) {
      return access.canUseSettings ? "/workspace/settings" : "/workspace/chat";
    }
    if (isWorkspacePath(pathname, "/workspace/balance")) {
      return access.canUseBalance ? "/workspace/balance" : "/workspace/chat";
    }
    if (isWorkspacePath(pathname, "/workspace/mailings")) {
      return access.canUseMailings ? "/workspace/mailings" : "/workspace/admin";
    }
    if (isWorkspacePath(pathname, "/workspace")) {
      return "/workspace";
    }
    return "/workspace";
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

  const isPublicProfile = isWorkspacePath(pathname, "/workspace/settings/profile");
  if (
    (isWorkspacePath(pathname, "/workspace/settings") || isWorkspacePath(pathname, "/workspace/memory")) &&
    !isPublicProfile &&
    !access.canUseSettings
  ) {
    return "/workspace/chat";
  }

  return null;
}

export function getWorkspaceFeatureStatus(pathname: string, access: WorkspaceAccess): WorkspaceFeatureStatus {
  return getWorkspaceFeatureStatusFromShared(pathname, access);
}

export type { WorkspaceFeatureStatus };

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
