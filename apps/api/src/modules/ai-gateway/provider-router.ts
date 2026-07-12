import type { AiModality, AiTaskType, CountryCode } from "@nomduchat/shared";
import {
  getEnabledProvidersForModality,
  getProviderPolicyMode,
  resolveSelectableModel,
  supportsManualModelSelection,
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
  taskType?: AiTaskType;
  selectedModelId?: string;
}): ProviderDecision | null {
  const policyMode = getProviderPolicyMode();

  const selectedModel = resolveSelectableModel({
    selectedModelId: input.selectedModelId,
    modality: input.modality,
  });
  if (selectedModel) {
    return {
      provider: selectedModel.provider.code,
      model: selectedModel.model,
      policyMode,
      reason: `User selected ${selectedModel.option.label}.`,
    };
  }

  if (input.selectedModelId && supportsManualModelSelection(input.modality)) {
    return null;
  }

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
  taskType?: AiTaskType;
}): ProviderCode[] {
  if (input.taskType === "code_generation") {
    return ["anthropic", "openai", "gemini", "mock-provider"];
  }

  if (input.modality === "avatar_video" || input.agentId === "avatar") {
    return ["heygen", "mock-provider"];
  }

  if (input.taskType === "media_generation") {
    return ["gemini", "openai", "anthropic", "mock-provider"];
  }

  if (
    input.taskType === "website_copy" ||
    input.taskType === "campaign_copy" ||
    input.taskType === "bot_policy" ||
    input.taskType === "deal_summary" ||
    input.taskType === "knowledge_search" ||
    input.taskType === "internal_analysis"
  ) {
    return ["anthropic", "openai", "gemini", "mock-provider"];
  }

  if (input.taskType === "chat_reply" || input.taskType === "customer_support") {
    return ["openai", "anthropic", "gemini", "mock-provider"];
  }

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
