import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { readBearerToken } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { AbuseGuardService } from "../security/abuse-guard.js";
import type { SupportService } from "./support.service.js";

const supportTicketSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().email(),
  topic: z.enum(["billing", "access", "refund", "technical", "other"]).default("other"),
  message: z.string().trim().min(10).max(4_000),
  pageUrl: z.string().trim().max(1_000).optional(),
});

export async function registerSupportRoutes(
  app: FastifyInstance,
  support: SupportService,
  auth: AuthService,
  abuseGuard: AbuseGuardService
) {
  app.post("/support/tickets", async (request, reply) => {
    const input = supportTicketSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Valid support email and message are required.",
        },
      });
    }

    const allowed = await abuseGuard.assertPublicAiRouteAllowed(request);
    if (!allowed.ok) return sendResult(reply, allowed);

    const currentUser = await auth.me(readBearerToken(request.headers.authorization));
    return sendResult(
      reply,
      await support.createTicket({
        ...input.data,
        userId: currentUser.ok ? currentUser.value.user.id : null,
        name: input.data.name ?? (currentUser.ok ? currentUser.value.user.name : null),
        email: input.data.email || (currentUser.ok ? currentUser.value.user.email ?? "" : ""),
      })
    );
  });
}
