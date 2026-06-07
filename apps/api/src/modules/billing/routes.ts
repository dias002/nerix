import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { BillingService } from "./billing.service.js";

const estimateSchema = z.object({
  prompt: z.string().min(1),
  agentId: z.string().optional(),
});

export async function registerBillingRoutes(app: FastifyInstance, billing: BillingService, auth: AuthService) {
  app.get("/billing/wallet", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await billing.getWallet(user.value.userId));
  });

  app.get("/billing/ledger", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await billing.ledger(user.value.userId));
  });

  app.post("/billing/estimate", async (request, reply) => {
    const input = estimateSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Prompt is required.",
        },
      });
    }

    return sendResult(reply, await billing.estimate(input.data));
  });
}
