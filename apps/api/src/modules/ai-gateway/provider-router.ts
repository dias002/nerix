import type { AiModality, CountryCode } from "@nomduchat/shared";
import { getEnabledProvidersForModality, getProviderPolicyMode, type ProviderPolicyMode } from "./provider-registry.js";

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
}): ProviderDecision | null {
  const policyMode = getProviderPolicyMode();
  const providers = getEnabledProvidersForModality(input.modality);
  if (providers.length === 0) return null;

  const provider = providers.find((candidate) => candidate.code !== "mock-provider") ?? providers[0];
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
