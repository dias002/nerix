import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendResult } from "../../server/response.js";
import type { BillingService } from "./billing.service.js";

const estimateSchema = z.object({
  prompt: z.string().min(1),
  agentId: z.string().optional(),
});

export async function registerBillingRoutes(app: FastifyInstance, billing: BillingService) {
  app.get("/billing/wallet", async (_request, reply) => {
    return sendResult(reply, await billing.getWallet());
  });

  app.get("/billing/ledger", async (_request, reply) => {
    return sendResult(reply, await billing.ledger());
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
