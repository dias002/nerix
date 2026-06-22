import { config } from "../../config.js";

export type CompletionInput = {
  provider: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
};

export type CompletionResult = {
  content: string;
  rawUsage?: Record<string, unknown>;
};

export interface AiCompletionProvider {
  complete(input: CompletionInput): Promise<CompletionResult>;
}

export class MockCompletionProvider implements AiCompletionProvider {
  async complete(_input: CompletionInput) {
    if (!config.AI_MOCK_PROVIDER_ENABLED) {
      throw new Error("Mock AI provider is disabled.");
    }

    return {
      content:
        "Это локальный mock-ответ nomduchat. Архитектура уже выбирает агента, провайдера, модель и считает примерный расход nomduchat-токенов.",
    };
  }
}

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: Record<string, unknown>;
};

export class OpenAiCompletionProvider implements AiCompletionProvider {
  async complete(input: CompletionInput) {
    if (!config.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for OpenAI completions.");
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        instructions: input.systemPrompt || undefined,
        input: input.prompt,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI response failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const body = (await response.json()) as OpenAiResponse;
    return {
      content: extractOpenAiText(body),
      rawUsage: body.usage,
    };
  }
}

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  usage?: Record<string, unknown>;
};

export class AnthropicCompletionProvider implements AiCompletionProvider {
  async complete(input: CompletionInput) {
    if (!config.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is required for Anthropic completions.");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": config.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 2048,
        system: input.systemPrompt || undefined,
        messages: [
          {
            role: "user",
            content: input.prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic response failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const body = (await response.json()) as AnthropicResponse;
    return {
      content: extractAnthropicText(body),
      rawUsage: body.usage,
    };
  }
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: Record<string, unknown>;
};

export class GeminiCompletionProvider implements AiCompletionProvider {
  async complete(input: CompletionInput) {
    if (!config.GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is required for Gemini completions.");
    }

    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`
    );
    url.searchParams.set("key", config.GOOGLE_AI_API_KEY);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: input.systemPrompt
          ? {
              parts: [{ text: input.systemPrompt }],
            }
          : undefined,
        contents: [
          {
            role: "user",
            parts: [{ text: input.prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini response failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const body = (await response.json()) as GeminiResponse;
    return {
      content: extractGeminiText(body),
      rawUsage: body.usageMetadata,
    };
  }
}

export class BackendAiCompletionProvider implements AiCompletionProvider {
  private readonly mock = new MockCompletionProvider();
  private readonly openai = new OpenAiCompletionProvider();
  private readonly anthropic = new AnthropicCompletionProvider();
  private readonly gemini = new GeminiCompletionProvider();

  async complete(input: CompletionInput) {
    if (input.provider === "mock-provider") return this.mock.complete(input);
    if (input.provider === "openai") return this.openai.complete(input);
    if (input.provider === "anthropic") return this.anthropic.complete(input);
    if (input.provider === "gemini") return this.gemini.complete(input);

    throw new Error(`AI provider '${input.provider}' is not supported.`);
  }
}

export function createCompletionProvider(): AiCompletionProvider {
  return new BackendAiCompletionProvider();
}

function extractOpenAiText(response: OpenAiResponse) {
  if (response.output_text) return response.output_text;

  const parts =
    response.output?.flatMap((item) =>
      item.content?.flatMap((content) => (typeof content.text === "string" ? [content.text] : [])) ?? []
    ) ?? [];

  return parts.join("\n").trim() || "nomduchat получил пустой ответ от AI-провайдера.";
}

function extractAnthropicText(response: AnthropicResponse) {
  const parts = response.content?.flatMap((content) => (typeof content.text === "string" ? [content.text] : [])) ?? [];

  return parts.join("\n").trim() || "nomduchat получил пустой ответ от Anthropic.";
}

function extractGeminiText(response: GeminiResponse) {
  const parts =
    response.candidates?.flatMap((candidate) =>
      candidate.content?.parts?.flatMap((part) => (typeof part.text === "string" ? [part.text] : [])) ?? []
    ) ?? [];

  return parts.join("\n").trim() || "nomduchat получил пустой ответ от Gemini.";
}
