import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  getWorkspaceFeaturePaths,
  getWorkspaceFeatureStatus,
  type WorkspaceFeatureAccess,
  type WorkspaceFeatureStatus,
  resolveWorkspaceFeatureAccess,
} from "@nomduchat/shared";
import { isAdminEmail } from "../users/admin-access.js";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { UserService } from "../users/user.service.js";
import { ok } from "../../domain/result.js";

const querySchema = z.object({
  pathname: z.string().trim().min(1).max(240).optional(),
});

type FeatureStatusRecord = {
  path: string;
  status: WorkspaceFeatureStatus;
};

export async function registerWorkspaceFeatureRoutes(
  app: FastifyInstance,
  auth: AuthService,
  users: UserService,
) {
  app.get("/workspace/features", async (request, reply) => {
    const input = querySchema.safeParse(request.query);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid workspace feature query.",
        },
      });
    }

    const access = await resolveWorkspaceFeatureAccessForRequest(request, auth, users);
  const features = getWorkspaceFeaturePaths().map<FeatureStatusRecord>((path) => ({
    path,
    status: getWorkspaceFeatureStatus(path, access),
  }));
  const currentPath = input.data.pathname ?? "";
    const currentStatus = currentPath ? getWorkspaceFeatureStatus(currentPath, access) : null;

    return sendResult(reply, ok({
      access,
      features,
      currentPath: currentPath || null,
      currentStatus,
    }));
  });
}

async function resolveWorkspaceFeatureAccessForRequest(
  request: FastifyRequest,
  auth: AuthService,
  users: UserService,
): Promise<WorkspaceFeatureAccess> {
  const requestUser = await resolveRequestUserId(request, auth);
  if (!requestUser.ok) {
    return resolveWorkspaceFeatureAccess({
      isGuest: true,
      isAdmin: false,
      isOwner: false,
    });
  }

  const userResult = await users.getCurrentUser(requestUser.value.userId);
  if (!userResult.ok) {
    return resolveWorkspaceFeatureAccess({
      isGuest: false,
      isAdmin: requestUser.value.isAdmin,
      isOwner: isAdminEmail(requestUser.value.email),
      workspaceRole: "personal",
    });
  }

  const user = userResult.value;

  return resolveWorkspaceFeatureAccess({
    isGuest: false,
    isAdmin: requestUser.value.isAdmin,
    isOwner: isAdminEmail(user.email),
    workspaceRole: user.workspaceRole,
    activePlanId: user.activePlanId,
    hasBusinessWorkspace: Boolean(user.businessWorkspace),
    permissions: {
      business: user.permissions.business,
      businessSettings: user.permissions.businessSettings,
      employeeReports: user.permissions.employeeReports,
      mailings: user.permissions.mailings,
    },
  });
}
