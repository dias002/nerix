import type { AiModality, CountryCode } from "@nomduchat/shared";
import {
  getEnabledProvidersForModality,
  getProviderPolicyMode,
  type ProviderCode,
  type ProviderPolicyMode,
} from "./provider-registry.js";

export type ProviderDecision = {
  provider: string;
  model: string;
  reason: string;
  policyMode: ProviderPolicyMode;
};

export function chooseProvider(input: {
  country: CountryCode;
  modality: AiModality;
  preferredModel: string;
  agentId?: string;
}): ProviderDecision | null {
  const policyMode = getProviderPolicyMode();
  const providers = getEnabledProvidersForModality(input.modality);
  if (providers.length === 0) return null;

  const provider =
    preferredProviderOrder(input)
      .map((code) => providers.find((candidate) => candidate.code === code))
      .find(Boolean) ??
    providers.find((candidate) => candidate.code !== "mock-provider") ??
    providers[0];
  const model = provider.modelByModality[input.modality] ?? input.preferredModel;

  return {
    provider: provider.code,
    model,
    policyMode,
    reason:
      policyMode === "dev_allow_all"
        ? `Dev policy: ${provider.name} is available for ${input.country}.`
        : `Production policy hook selected ${provider.name} for ${input.country}.`,
  };
}

function preferredProviderOrder(input: {
  modality: AiModality;
  preferredModel: string;
  agentId?: string;
}): ProviderCode[] {
  if (input.modality === "code") return ["anthropic", "openai", "gemini", "mock-provider"];
  if (input.modality === "image") return ["gemini", "openai", "mock-provider"];
  if (input.modality === "voice") return ["openai", "mock-provider"];
  if (input.modality === "file") return ["openai", "anthropic", "gemini", "mock-provider"];
  if (input.modality === "video") return ["gemini", "mock-provider"];
  if (input.modality === "music") return ["gemini", "mock-provider"];

  if (input.agentId === "music" || input.agentId === "video") {
    return ["gemini", "openai", "anthropic", "mock-provider"];
  }

  if (isBusinessRoute(input)) {
    return ["anthropic", "openai", "gemini", "mock-provider"];
  }

  return ["openai", "anthropic", "gemini", "mock-provider"];
}

function isBusinessRoute(input: { preferredModel: string; agentId?: string }) {
  return input.agentId === "business" || input.preferredModel === "business-primary";
}
