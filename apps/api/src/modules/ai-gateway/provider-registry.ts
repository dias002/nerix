import type { AiModality } from "@nerix/shared";

export type ProviderCode = "mock-provider" | "openai" | "anthropic" | "gemini";

export type ProviderPolicyMode = "dev_allow_all" | "production_rules";

export type ProviderConfig = {
  code: ProviderCode;
  name: string;
  enabled: boolean;
  modalities: AiModality[];
  modelByModality: Partial<Record<AiModality, string>>;
  reason: string;
};

const allModalities: AiModality[] = ["text", "code", "image", "video", "music", "voice", "file"];

export function getProviderPolicyMode(): ProviderPolicyMode {
  const explicit = process.env.AI_PROVIDER_POLICY;
  if (explicit === "dev_allow_all" || explicit === "production_rules") {
    return explicit;
  }

  return process.env.NODE_ENV === "production" ? "production_rules" : "dev_allow_all";
}

export function getConfiguredProviders(): ProviderConfig[] {
  return [
    {
      code: "mock-provider",
      name: "Local Mock Provider",
      enabled: true,
      modalities: allModalities,
      modelByModality: {
        text: "mock-text",
        code: "mock-code",
        image: "mock-image",
        video: "mock-video",
        music: "mock-music",
        voice: "mock-voice",
        file: "mock-file",
      },
      reason: "Always available for local development and tests.",
    },
    {
      code: "openai",
      name: "OpenAI",
      enabled: Boolean(process.env.OPENAI_API_KEY),
      modalities: ["text", "code", "image", "voice", "file"],
      modelByModality: {
        text: process.env.OPENAI_TEXT_MODEL || "openai-text-configured",
        code: process.env.OPENAI_CODE_MODEL || "openai-code-configured",
        image: process.env.OPENAI_IMAGE_MODEL || "openai-image-configured",
        voice: process.env.OPENAI_VOICE_MODEL || "openai-voice-configured",
        file: process.env.OPENAI_TEXT_MODEL || "openai-text-configured",
      },
      reason: "Enabled only when OPENAI_API_KEY exists on the backend.",
    },
    {
      code: "anthropic",
      name: "Anthropic",
      enabled: Boolean(process.env.ANTHROPIC_API_KEY),
      modalities: ["text", "code", "file"],
      modelByModality: {
        text: process.env.ANTHROPIC_TEXT_MODEL || "anthropic-text-configured",
        code: process.env.ANTHROPIC_CODE_MODEL || "anthropic-code-configured",
        file: process.env.ANTHROPIC_TEXT_MODEL || "anthropic-text-configured",
      },
      reason: "Enabled only when ANTHROPIC_API_KEY exists on the backend.",
    },
    {
      code: "gemini",
      name: "Google Gemini",
      enabled: Boolean(process.env.GOOGLE_AI_API_KEY),
      modalities: ["text", "code", "image", "file"],
      modelByModality: {
        text: process.env.GEMINI_TEXT_MODEL || "gemini-text-configured",
        code: process.env.GEMINI_CODE_MODEL || "gemini-code-configured",
        image: process.env.GEMINI_IMAGE_MODEL || "gemini-image-configured",
        file: process.env.GEMINI_TEXT_MODEL || "gemini-text-configured",
      },
      reason: "Enabled only when GOOGLE_AI_API_KEY exists on the backend.",
    },
  ];
}

export function getEnabledProvidersForModality(modality: AiModality) {
  const providers = getConfiguredProviders().filter(
    (provider) => provider.enabled && provider.modalities.includes(modality)
  );

  return providers.length > 0 ? providers : getConfiguredProviders().filter((provider) => provider.code === "mock-provider");
}

