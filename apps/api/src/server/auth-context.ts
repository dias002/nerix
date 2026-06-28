import type { FastifyRequest } from "fastify";
import { DomainError, fail, ok, type Result } from "../domain/result.js";
import type { AuthService } from "../modules/auth/auth.service.js";

export type LocalRoleOverride = "user" | "business_owner" | "business_employee" | "admin";

export async function resolveRequestUserId(
  request: FastifyRequest,
  auth: AuthService,
  fallbackUserId = "local-user"
): Promise<Result<{ userId: string; email?: string | null }>> {
  const accessToken = readBearerToken(request.headers.authorization);
  if (!accessToken) {
    if (process.env.NODE_ENV === "production") {
      return fail(new DomainError("unauthorized", "Authentication is required.", 401));
    }

    return ok({ userId: fallbackUserId });
  }

  const currentUser = await auth.me(accessToken);
  if (!currentUser.ok) return currentUser;

  return ok({ userId: currentUser.value.user.id, email: currentUser.value.user.email });
}

export function readBearerToken(authorization: string | undefined) {
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim();
}

export function readLocalRoleOverride(request: FastifyRequest): LocalRoleOverride | null {
  if (!isLocalRoleBypassAllowed(request)) return null;

  const rawRole = request.headers["x-nomduchat-local-role"];
  const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
  if (role === "user" || role === "business_owner" || role === "business_employee" || role === "admin") {
    return role;
  }

  return null;
}

function isLocalRoleBypassAllowed(request: FastifyRequest) {
  if (process.env.NODE_ENV === "production") return false;

  const ip = request.ip;
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}
