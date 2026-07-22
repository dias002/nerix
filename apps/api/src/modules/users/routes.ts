import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ok } from "../../domain/result.js";
import { readBearerToken, resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import { countrySchema, languageSchema } from "../../server/schemas.js";
import type { AuthService } from "../auth/auth.service.js";
import type { UserService } from "./user.service.js";

const deleteAccountSchema = z.object({
  confirmation: z.string(),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  country: countrySchema.optional(),
  language: languageSchema.optional(),
  avatarDataUrl: z.string().max(2_200_000).nullable().optional(),
});

export async function registerUserRoutes(app: FastifyInstance, users: UserService, auth: AuthService) {
  app.get("/users/me", async (request, reply) => {
    const accessToken = readBearerToken(request.headers.authorization);
    if (accessToken) {
      const currentUser = await auth.me(accessToken);
      if (!currentUser.ok) return sendResult(reply, currentUser);

      return sendResult(reply, ok(currentUser.value.user));
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await users.getCurrentUser(user.value.userId));
  });

  app.patch("/users/me", async (request, reply) => {
    const input = updateProfileSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid profile payload.",
        },
      });
    }

    const accessToken = readBearerToken(request.headers.authorization);
    if (accessToken) {
      return sendResult(reply, await auth.updateProfile(accessToken, input.data));
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await users.updateCurrentUserProfile(user.value.userId, input.data));
  });

  app.get("/users/me/export", async (request, reply) => {
    const accessToken = readBearerToken(request.headers.authorization);
    if (accessToken) {
      const currentUser = await auth.me(accessToken);
      if (!currentUser.ok) return sendResult(reply, currentUser);

      return sendResult(
        reply,
        await users.exportCurrentUserData(currentUser.value.user.id, currentUser.value.user)
      );
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await users.exportCurrentUserData(user.value.userId));
  });

  const deleteCurrentAccount = async (request: FastifyRequest, reply: FastifyReply) => {
    const input = deleteAccountSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Confirmation is required.",
        },
      });
    }

    const currentUser = await auth.me(readBearerToken(request.headers.authorization));
    if (!currentUser.ok) return sendResult(reply, currentUser);

    const result = await users.deleteCurrentUser({
      userId: currentUser.value.user.id,
      confirmation: input.data.confirmation,
      fallbackUser: currentUser.value.user,
    });
    if (result.ok) {
      await auth.deleteAccountAccess(currentUser.value.user.id);
    }
    return sendResult(reply, result);
  };

  app.delete("/users/me", deleteCurrentAccount);
  app.post("/users/me/delete", deleteCurrentAccount);
}
