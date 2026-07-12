import type { AiModality } from "@nomduchat/shared";
import { config } from "../../config.js";

export type ProviderCode = "mock-provider" | "openai" | "anthropic" | "gemini" | "heygen";

export type ProviderPolicyMode = "dev_allow_all" | "production_rules";

export type ProviderConfig = {
  code: ProviderCode;
  name: string;
  enabled: boolean;
  modalities: AiModality[];
  modelByModality: Partial<Record<AiModality, string>>;
  reason: string;
};

export type SelectableAiModel = {
  id: string;
  providerCode: ProviderCode;
  providerName: string;
  label: string;
  description: string;
  tier: "fast" | "balanced" | "pro";
  modalities: AiModality[];
  modelByModality: Partial<Record<AiModality, string>>;
};

const allModalities: AiModality[] = ["text", "code", "image", "video", "avatar_video", "music", "voice", "file"];
const selectableTextModalities: AiModality[] = ["text", "code", "file"];

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
        avatar_video: "mock-avatar-video",
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
        text: config.ANTHROPIC_TEXT_MODEL || "claude-sonnet-4-20250514",
        code: config.ANTHROPIC_CODE_MODEL || config.ANTHROPIC_TEXT_MODEL || "claude-sonnet-4-20250514",
        file: config.ANTHROPIC_TEXT_MODEL || "claude-sonnet-4-20250514",
      },
      reason: "Enabled only when ANTHROPIC_API_KEY exists on the backend.",
    },
    {
      code: "gemini",
      name: "Google Gemini",
      enabled: Boolean(config.GOOGLE_AI_API_KEY),
      modalities: ["text", "code", "image", "video", "music", "file"],
      modelByModality: {
        text: config.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
        code: config.GEMINI_CODE_MODEL || config.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
        image: config.GEMINI_IMAGE_MODEL || "gemini-image-configured",
        video: config.GEMINI_VIDEO_MODEL || "gemini-video-configured",
        music: config.GEMINI_MUSIC_MODEL || "gemini-music-configured",
        file: config.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
      },
      reason: "Enabled only when GOOGLE_AI_API_KEY exists on the backend.",
    },
    {
      code: "heygen",
      name: "HeyGen Video Agent",
      enabled: Boolean(config.HEYGEN_API_KEY),
      modalities: ["avatar_video", "video"],
      modelByModality: {
        avatar_video: config.HEYGEN_AVATAR_VIDEO_MODEL || "heygen-video-agent-v3",
        video: config.HEYGEN_VIDEO_MODEL || config.HEYGEN_AVATAR_VIDEO_MODEL || "heygen-video-agent-v3",
      },
      reason: "Enabled only when HEYGEN_API_KEY exists on the backend.",
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

export function getSelectableModels(modality?: AiModality): SelectableAiModel[] {
  const providers = new Map(getConfiguredProviders().map((provider) => [provider.code, provider]));

  return buildSelectableModelCatalog()
    .map((model) => {
      const provider = providers.get(model.providerCode);
      if (!provider?.enabled) return null;
      if (!model.modalities.every((modelModality) => provider.modalities.includes(modelModality))) return null;
      if (modality && !model.modalities.includes(modality)) return null;

      return {
        ...model,
        providerName: provider.name,
      };
    })
    .filter((model): model is SelectableAiModel => Boolean(model));
}

export function resolveSelectableModel(input: {
  selectedModelId?: string;
  modality: AiModality;
}): { provider: ProviderConfig; model: string; option: SelectableAiModel } | null {
  if (!input.selectedModelId || !selectableTextModalities.includes(input.modality)) {
    return null;
  }

  const option = getSelectableModels(input.modality).find((model) => model.id === input.selectedModelId);
  if (!option) return null;

  const provider = getConfiguredProviders().find((candidate) => candidate.code === option.providerCode);
  const model = option.modelByModality[input.modality] ?? option.modelByModality.text;
  if (!provider?.enabled || !model) return null;

  return {
    provider,
    model,
    option,
  };
}

export function supportsManualModelSelection(modality: AiModality) {
  return selectableTextModalities.includes(modality);
}

function buildSelectableModelCatalog(): Array<Omit<SelectableAiModel, "providerName">> {
  return [
    {
      id: "mock-provider:configured",
      providerCode: "mock-provider",
      label: "Local Mock",
      description: "Локальный тестовый ответ без внешних AI API.",
      tier: "fast",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "mock-text",
        code: "mock-code",
        file: "mock-file",
      },
    },
    {
      id: "openai:configured",
      providerCode: "openai",
      label: `OpenAI default (${config.OPENAI_TEXT_MODEL || "backend"})`,
      description: "Модель OpenAI из backend-настроек Render.",
      tier: "balanced",
      modalities: selectableTextModalities,
      modelByModality: {
        text: config.OPENAI_TEXT_MODEL,
        code: config.OPENAI_CODE_MODEL,
        file: config.OPENAI_TEXT_MODEL,
      },
    },
    {
      id: "openai:gpt-4.1",
      providerCode: "openai",
      label: "OpenAI GPT-4.1",
      description: "Сильная универсальная модель для текста, файлов и кода.",
      tier: "pro",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "gpt-4.1",
        code: "gpt-4.1",
        file: "gpt-4.1",
      },
    },
    {
      id: "openai:gpt-4.1-mini",
      providerCode: "openai",
      label: "OpenAI GPT-4.1 mini",
      description: "Быстрый режим OpenAI для повседневных рабочих запросов.",
      tier: "balanced",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "gpt-4.1-mini",
        code: "gpt-4.1-mini",
        file: "gpt-4.1-mini",
      },
    },
    {
      id: "openai:gpt-4o",
      providerCode: "openai",
      label: "OpenAI GPT-4o",
      description: "Мультимодальная модель OpenAI для текста и файлов.",
      tier: "balanced",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "gpt-4o",
        code: "gpt-4o",
        file: "gpt-4o",
      },
    },
    {
      id: "openai:gpt-4o-mini",
      providerCode: "openai",
      label: "OpenAI GPT-4o mini",
      description: "Экономичный режим OpenAI для быстрых ответов.",
      tier: "fast",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "gpt-4o-mini",
        code: "gpt-4o-mini",
        file: "gpt-4o-mini",
      },
    },
    {
      id: "openai:o3",
      providerCode: "openai",
      label: "OpenAI o3",
      description: "Режим рассуждений для сложного анализа и задач с логикой.",
      tier: "pro",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "o3",
        code: "o3",
        file: "o3",
      },
    },
    {
      id: "openai:o4-mini",
      providerCode: "openai",
      label: "OpenAI o4-mini",
      description: "Быстрый reasoning-режим для кода, анализа и рабочих задач.",
      tier: "fast",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "o4-mini",
        code: "o4-mini",
        file: "o4-mini",
      },
    },
    {
      id: "anthropic:configured",
      providerCode: "anthropic",
      label: `Claude default (${config.ANTHROPIC_TEXT_MODEL || "backend"})`,
      description: "Модель Claude из backend-настроек Render.",
      tier: "balanced",
      modalities: selectableTextModalities,
      modelByModality: {
        text: config.ANTHROPIC_TEXT_MODEL || "claude-sonnet-4-20250514",
        code: config.ANTHROPIC_CODE_MODEL || config.ANTHROPIC_TEXT_MODEL || "claude-sonnet-4-20250514",
        file: config.ANTHROPIC_TEXT_MODEL || "claude-sonnet-4-20250514",
      },
    },
    {
      id: "anthropic:claude-opus-4-20250514",
      providerCode: "anthropic",
      label: "Claude Opus 4",
      description: "Самый сильный режим Claude для сложных рассуждений и кода.",
      tier: "pro",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "claude-opus-4-20250514",
        code: "claude-opus-4-20250514",
        file: "claude-opus-4-20250514",
      },
    },
    {
      id: "anthropic:claude-sonnet-4-20250514",
      providerCode: "anthropic",
      label: "Claude Sonnet 4",
      description: "Баланс качества, скорости и цены для рабочих запросов.",
      tier: "balanced",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "claude-sonnet-4-20250514",
        code: "claude-sonnet-4-20250514",
        file: "claude-sonnet-4-20250514",
      },
    },
    {
      id: "anthropic:claude-3-7-sonnet-20250219",
      providerCode: "anthropic",
      label: "Claude 3.7 Sonnet",
      description: "Сильный режим Claude для кода, анализа и документов.",
      tier: "balanced",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "claude-3-7-sonnet-20250219",
        code: "claude-3-7-sonnet-20250219",
        file: "claude-3-7-sonnet-20250219",
      },
    },
    {
      id: "anthropic:claude-3-5-haiku-20241022",
      providerCode: "anthropic",
      label: "Claude 3.5 Haiku",
      description: "Быстрый и экономичный режим Claude для коротких ответов.",
      tier: "fast",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "claude-3-5-haiku-20241022",
        code: "claude-3-5-haiku-20241022",
        file: "claude-3-5-haiku-20241022",
      },
    },
    {
      id: "gemini:configured",
      providerCode: "gemini",
      label: `Gemini default (${config.GEMINI_TEXT_MODEL || "backend"})`,
      description: "Модель Gemini из backend-настроек Render.",
      tier: "balanced",
      modalities: selectableTextModalities,
      modelByModality: {
        text: config.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
        code: config.GEMINI_CODE_MODEL || config.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
        file: config.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
      },
    },
    {
      id: "gemini:gemini-2.5-pro",
      providerCode: "gemini",
      label: "Gemini 2.5 Pro",
      description: "Pro-режим Gemini для сложного анализа, текста и кода.",
      tier: "pro",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "gemini-2.5-pro",
        code: "gemini-2.5-pro",
        file: "gemini-2.5-pro",
      },
    },
    {
      id: "gemini:gemini-2.5-flash",
      providerCode: "gemini",
      label: "Gemini 2.5 Flash",
      description: "Быстрый мультимодальный режим Gemini для повседневных задач.",
      tier: "balanced",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "gemini-2.5-flash",
        code: "gemini-2.5-flash",
        file: "gemini-2.5-flash",
      },
    },
    {
      id: "gemini:gemini-2.5-flash-lite",
      providerCode: "gemini",
      label: "Gemini 2.5 Flash-Lite",
      description: "Экономичный режим Gemini для массовых коротких запросов.",
      tier: "fast",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "gemini-2.5-flash-lite",
        code: "gemini-2.5-flash-lite",
        file: "gemini-2.5-flash-lite",
      },
    },
    {
      id: "gemini:gemini-2.0-flash",
      providerCode: "gemini",
      label: "Gemini 2.0 Flash",
      description: "Стабильный быстрый режим Gemini для текста и файлов.",
      tier: "fast",
      modalities: selectableTextModalities,
      modelByModality: {
        text: "gemini-2.0-flash",
        code: "gemini-2.0-flash",
        file: "gemini-2.0-flash",
      },
    },
  ];
}
