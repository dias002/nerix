import type { FastifyInstance } from "fastify";
import { ok } from "../../domain/result.js";
import { sendResult } from "../../server/response.js";
import type { AgentService } from "./agent.service.js";

export async function registerAgentRoutes(app: FastifyInstance, agents: AgentService) {
  app.get("/agents", async (_request, reply) => {
    const result = await agents.listAgents();
    return sendResult(reply, result.ok ? ok({ agents: result.value }) : result);
  });

  app.get("/agents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    return sendResult(reply, await agents.requireAgent(id));
  });
}
