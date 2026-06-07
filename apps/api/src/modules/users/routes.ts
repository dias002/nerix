import type { FastifyInstance } from "fastify";
import { ok } from "../../domain/result.js";
import { readBearerToken, resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { UserService } from "./user.service.js";

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
}
