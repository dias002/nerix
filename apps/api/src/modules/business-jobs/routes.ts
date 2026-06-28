import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { BusinessJobService } from "./business-job.service.js";

export async function registerBusinessJobRoutes(
  app: FastifyInstance,
  businessJobs: BusinessJobService,
  auth: AuthService
) {
  app.get("/business/jobs", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await businessJobs.listJobs(user.value.userId));
  });

  app.get("/business/jobs/:jobId", async (request, reply) => {
    const params = z.object({ jobId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Business job id is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await businessJobs.getJob(user.value.userId, params.data.jobId));
  });

  app.post("/business/jobs/:jobId/cancel", async (request, reply) => {
    const params = z.object({ jobId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Business job id is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await businessJobs.cancelJob(user.value.userId, params.data.jobId));
  });
}
