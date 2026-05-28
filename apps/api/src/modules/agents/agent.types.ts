import type { Agent, AgentCategory, AiModality } from "@nerix/shared";

export type AgentRecord = Agent & {
  systemPrompt: string;
  countryDenylist: string[];
};

export type CreateAgentInput = {
  id: string;
  name: string;
  category: AgentCategory;
  description: string;
  inputTypes: AiModality[];
  outputTypes: AiModality[];
  defaultModel: string;
  fallbackModels?: string[];
  priceMultiplier?: number;
  systemPrompt?: string;
  countryDenylist?: string[];
};

