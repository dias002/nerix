import type { FastifyRequest } from "fastify";
import { DomainError, fail, ok, type Result } from "../../domain/result.js";
import { readBearerToken, readLocalRoleOverride, type LocalRoleOverride } from "../../server/auth-context.js";
import type { AuthService } from "../auth/auth.service.js";
import type { UserRecord } from "../users/user.types.js";

export type BusinessPermission = "business" | "businessSettings" | "employeeReports";

export async function ensureBusinessPermission(
  request: FastifyRequest,
  auth: AuthService,
  permission: BusinessPermission = "business"
): Promise<Result<UserRecord | null>> {
  const localRole = readLocalRoleOverride(request);
  if (localRole) {
    return localRoleHasBusinessPermission(localRole, permission)
      ? ok(null)
      : fail(new DomainError("unauthorized", unauthorizedMessage(permission), 403));
  }

  const accessToken = readBearerToken(request.headers.authorization);
  if (!accessToken) {
    return fail(new DomainError("unauthorized", "Authentication is required.", 401));
  }

  const currentUser = await auth.me(accessToken);
  if (!currentUser.ok) return fail(currentUser.error);

  const user = currentUser.value.user;
  const hasBusinessIdentity =
    user.workspaceRole === "business_owner" ||
    user.workspaceRole === "business_employee" ||
    user.activePlanId === "business" ||
    Boolean(user.businessWorkspace);

  if (!hasBusinessIdentity || !user.permissions.business || !user.permissions[permission]) {
    return fail(new DomainError("unauthorized", unauthorizedMessage(permission), 403));
  }

  return ok(user);
}

function localRoleHasBusinessPermission(role: LocalRoleOverride, permission: BusinessPermission) {
  if (role === "business_owner") return true;
  if (role === "business_employee") return permission === "business" || permission === "employeeReports";
  return false;
}

function unauthorizedMessage(permission: BusinessPermission) {
  if (permission === "businessSettings") {
    return "Only the Business owner can manage this Business section.";
  }

  if (permission === "employeeReports") {
    return "Employee reports are available only inside a Business workspace.";
  }

  return "Business workspace access is required.";
}
