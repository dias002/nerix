import type { FastifyInstance } from "fastify";
import { sendResult } from "../../server/response.js";
import type { UserService } from "./user.service.js";

export async function registerUserRoutes(app: FastifyInstance, users: UserService) {
  app.get("/users/me", async (_request, reply) => {
    return sendResult(reply, await users.getCurrentUser());
  });
}
