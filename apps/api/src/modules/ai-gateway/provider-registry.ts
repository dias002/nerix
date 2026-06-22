import type { AiModality } from "@nomduchat/shared";
import { config } from "../../config.js";

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
  const explicit = config.AI_PROVIDER_POLICY;
  if (explicit === "dev_allow_all" || explicit === "production_rules") {
    return explicit;
  }

  return config.NODE_ENV === "production" ? "production_rules" : "dev_allow_all";
}

export function getConfiguredProviders(): ProviderConfig[] {
  return [
    {
      code: "mock-provider",
      name: "Local Mock Provider",
      enabled: config.AI_MOCK_PROVIDER_ENABLED,
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
      enabled: Boolean(config.OPENAI_API_KEY),
      modalities: ["text", "code", "image", "voice", "file"],
      modelByModality: {
        text: config.OPENAI_TEXT_MODEL,
        code: config.OPENAI_CODE_MODEL,
        image: config.OPENAI_IMAGE_MODEL || "openai-image-configured",
        voice: config.OPENAI_VOICE_MODEL || "openai-voice-configured",
        file: config.OPENAI_TEXT_MODEL,
      },
      reason: "Enabled only when OPENAI_API_KEY exists on the backend.",
    },
    {
      code: "anthropic",
      name: "Anthropic",
      enabled: Boolean(config.ANTHROPIC_API_KEY),
      modalities: ["text", "code", "file"],
      modelByModality: {
        text: config.ANTHROPIC_TEXT_MODEL || "anthropic-text-configured",
        code: config.ANTHROPIC_CODE_MODEL || "anthropic-code-configured",
        file: config.ANTHROPIC_TEXT_MODEL || "anthropic-text-configured",
      },
      reason: "Enabled only when ANTHROPIC_API_KEY exists on the backend.",
    },
    {
      code: "gemini",
      name: "Google Gemini",
      enabled: Boolean(config.GOOGLE_AI_API_KEY),
      modalities: ["text", "code", "image", "file"],
      modelByModality: {
        text: config.GEMINI_TEXT_MODEL || "gemini-text-configured",
        code: config.GEMINI_CODE_MODEL || "gemini-code-configured",
        image: config.GEMINI_IMAGE_MODEL || "gemini-image-configured",
        file: config.GEMINI_TEXT_MODEL || "gemini-text-configured",
      },
      reason: "Enabled only when GOOGLE_AI_API_KEY exists on the backend.",
    },
  ];
}

export function getEnabledProvidersForModality(modality: AiModality) {
  const providers = getConfiguredProviders().filter(
    (provider) => provider.enabled && provider.modalities.includes(modality)
  );

  return providers.length > 0 ? providers : getConfiguredProviders().filter(
    (provider) => provider.enabled && provider.code === "mock-provider"
  );
}
