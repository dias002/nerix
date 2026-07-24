import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { ProjectService } from "./project.service.js";

const projectStatusSchema = z.enum(["planned", "active", "done"]);
const projectTypeSchema = z.enum(["general", "content", "marketing", "development", "research"]);

const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2_000).optional(),
  projectType: projectTypeSchema.default("general"),
  status: projectStatusSchema.default("planned"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateProjectSchema = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(2_000).optional(),
  projectType: projectTypeSchema.optional(),
  status: projectStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export async function registerProjectRoutes(app: FastifyInstance, projects: ProjectService, auth: AuthService) {
  app.get("/projects", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await projects.listProjects(user.value.userId));
  });

  app.post("/projects", async (request, reply) => {
    const input = createProjectSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid project payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await projects.createProject({ ...input.data, userId: user.value.userId }));
  });

  app.patch("/projects/:projectId", async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    const input = updateProjectSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid project update payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await projects.updateProject(user.value.userId, params.data.projectId, input.data));
  });

  app.delete("/projects/:projectId", async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid project request.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await projects.deleteProject(user.value.userId, params.data.projectId));
  });
}
