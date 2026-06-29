import type { Agent } from "@nomduchat/shared";
import type { AiProvidersApiResponse } from "./index";
import { request } from "./transport";

export async function getAgents() {
  return request<{ agents: Agent[] }>("/agents");
}

export async function getAiProviders() {
  return request<AiProvidersApiResponse>("/ai/providers");
}
