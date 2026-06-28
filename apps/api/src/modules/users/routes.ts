import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../domain/result.js";
import { readBearerToken, resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { UserService } from "./user.service.js";

const deleteAccountSchema = z.object({
  confirmation: z.string(),
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

  app.post("/users/me/delete", async (request, reply) => {
    const input = deleteAccountSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Confirmation is required.",
        },
      });
    }

    const accessToken = readBearerToken(request.headers.authorization);
    if (accessToken) {
      const currentUser = await auth.me(accessToken);
      if (!currentUser.ok) return sendResult(reply, currentUser);

      return sendResult(
        reply,
        await users.deactivateCurrentUser({
          userId: currentUser.value.user.id,
          confirmation: input.data.confirmation,
          fallbackUser: currentUser.value.user,
        })
      );
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(
      reply,
      await users.deactivateCurrentUser({
        userId: user.value.userId,
        confirmation: input.data.confirmation,
      })
    );
  });
}
