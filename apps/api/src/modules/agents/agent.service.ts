import { DomainError, fail, ok } from "../../domain/result.js";
import type { AgentRepository } from "./agent.repository.js";

export class AgentService {
  constructor(private readonly repository: AgentRepository) {}

  async listAgents() {
    return ok(await this.repository.listEnabled());
  }

  async requireAgent(agentId: string) {
    const agent = await this.repository.findById(agentId);

    if (!agent || !agent.enabled) {
      return fail(new DomainError("not_found", `Agent '${agentId}' was not found.`, 404));
    }

    return ok(agent);
  }

  async findBestAgent(prompt: string, requestedAgentId?: string) {
    if (requestedAgentId) {
      return this.requireAgent(requestedAgentId);
    }

    const normalized = prompt.toLowerCase();

    if (containsAny(normalized, ["код", "code", "bug", "ошибка", "рефактор", "api"])) {
      return this.requireAgent("code");
    }

    if (containsAny(normalized, ["бизнес", "продажи", "клиент", "заявк", "crm", "support"])) {
      return this.requireAgent("business");
    }

    if (containsAny(normalized, ["учеб", "объясни", "экзамен", "study", "learn"])) {
      return this.requireAgent("study");
    }

    return this.requireAgent("general");
  }
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

