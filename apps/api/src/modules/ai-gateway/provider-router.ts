import type { AiModality, CountryCode } from "@nerix/shared";

export type ProviderDecision = {
  provider: string;
  model: string;
  reason: string;
};

const unsupportedInternationalProviderCountries = new Set<CountryCode>(["RU", "BY"]);

export function chooseProvider(input: {
  country: CountryCode;
  modality: AiModality;
  preferredModel: string;
}): ProviderDecision {
  if (unsupportedInternationalProviderCountries.has(input.country)) {
    return {
      provider: "regional-mock-provider",
      model: regionalModelFor(input.modality),
      reason: "Country routing selected a regional-compatible provider.",
    };
  }

  return {
    provider: "mock-provider",
    model: input.modality === "code" ? "code-primary" : input.preferredModel,
    reason: "Default provider for supported country route.",
  };
}

function regionalModelFor(modality: AiModality) {
  if (modality === "code") return "regional-code";
  if (["image", "video", "music", "voice"].includes(modality)) return `regional-${modality}`;
  return "regional-text";
}

