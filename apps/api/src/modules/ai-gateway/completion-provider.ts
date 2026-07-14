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

export type CompletionStreamCallbacks = {
  onDelta: (delta: string) => void | Promise<void>;
};

export interface AiCompletionProvider {
  complete(input: CompletionInput): Promise<CompletionResult>;
  stream?(input: CompletionInput, callbacks: CompletionStreamCallbacks): Promise<CompletionResult>;
}

export type CompletionProviderRegistry = Record<string, AiCompletionProvider>;

export class MockCompletionProvider implements AiCompletionProvider {
  async complete(_input: CompletionInput): Promise<CompletionResult> {
    if (!config.AI_MOCK_PROVIDER_ENABLED) {
      throw new Error("Mock AI provider is disabled.");
    }

    return {
      content:
        "Это локальный mock-ответ nomduchat. Архитектура уже выбирает агента, провайдера, модель и считает примерный расход nomduchat-токенов.",
    };
  }

  async stream(input: CompletionInput, callbacks: CompletionStreamCallbacks): Promise<CompletionResult> {
    const result = await this.complete(input);
    await emitTextDeltas(result.content, callbacks);
    return result;
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

type OpenAiStreamEvent = {
  type?: string;
  delta?: string;
  response?: OpenAiResponse;
  error?: {
    message?: string;
    code?: string;
  };
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

  async stream(input: CompletionInput, callbacks: CompletionStreamCallbacks) {
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
        stream: true,
        stream_options: {
          include_obfuscation: false,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI streaming response failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    if (!response.body) {
      throw new Error("OpenAI streaming response did not include a body.");
    }

    let content = "";
    let completedResponse: OpenAiResponse | undefined;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const event = parseOpenAiStreamEvent(part);
        if (!event) continue;

        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          content += event.delta;
          await callbacks.onDelta(event.delta);
          continue;
        }

        if (event.type === "response.completed") {
          completedResponse = event.response;
          continue;
        }

        if (event.type === "response.failed" || event.type === "error") {
          throw new Error(event.error?.message ?? "OpenAI streaming response failed.");
        }
      }
    }

    if (buffer.trim()) {
      const event = parseOpenAiStreamEvent(buffer);
      if (event?.type === "response.completed") {
        completedResponse = event.response;
      }
    }

    const finalContent = content.trim() || (completedResponse ? extractOpenAiText(completedResponse) : "");
    return {
      content: finalContent || "nomduchat получил пустой ответ от AI-провайдера.",
      rawUsage: completedResponse?.usage,
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
  constructor(
    private readonly providers: CompletionProviderRegistry = createDefaultCompletionProviderRegistry(),
    private readonly fallbackProviderCode = "mock-provider"
  ) {}

  async complete(input: CompletionInput) {
    try {
      return await this.resolveProvider(input.provider).complete(input);
    } catch (error) {
      if (
        input.provider === this.fallbackProviderCode ||
        config.NODE_ENV === "production" ||
        !config.AI_MOCK_PROVIDER_ENABLED
      ) {
        throw error;
      }

      const fallback = await this.resolveProvider(this.fallbackProviderCode).complete({
        ...input,
        provider: this.fallbackProviderCode,
        model: "mock-text",
      });
      const message = error instanceof Error ? error.message : "Unknown provider error.";

      return {
        ...fallback,
        rawUsage: {
          ...(fallback.rawUsage ?? {}),
          fallbackProvider: this.fallbackProviderCode,
          failedProvider: input.provider,
          failedModel: input.model,
          fallbackReason: message.slice(0, 500),
        },
      };
    }
  }

  async stream(input: CompletionInput, callbacks: CompletionStreamCallbacks) {
    try {
      return await streamWithProvider(this.resolveProvider(input.provider), input, callbacks);
    } catch (error) {
      if (
        input.provider === this.fallbackProviderCode ||
        config.NODE_ENV === "production" ||
        !config.AI_MOCK_PROVIDER_ENABLED
      ) {
        throw error;
      }

      const fallbackInput = {
        ...input,
        provider: this.fallbackProviderCode,
        model: "mock-text",
      };
      const fallback = await streamWithProvider(this.resolveProvider(this.fallbackProviderCode), fallbackInput, callbacks);
      const message = error instanceof Error ? error.message : "Unknown provider error.";

      return {
        ...fallback,
        rawUsage: {
          ...(fallback.rawUsage ?? {}),
          fallbackProvider: this.fallbackProviderCode,
          failedProvider: input.provider,
          failedModel: input.model,
          fallbackReason: message.slice(0, 500),
        },
      };
    }
  }

  private resolveProvider(code: string) {
    const provider = this.providers[code];
    if (!provider) {
      throw new Error(`AI provider '${code}' is not supported.`);
    }

    return provider;
  }
}

async function streamWithProvider(
  provider: AiCompletionProvider,
  input: CompletionInput,
  callbacks: CompletionStreamCallbacks
) {
  if (provider.stream) {
    return provider.stream(input, callbacks);
  }

  const result = await provider.complete(input);
  await emitTextDeltas(result.content, callbacks);
  return result;
}

export function createCompletionProvider(): AiCompletionProvider {
  return new BackendAiCompletionProvider();
}

export function createDefaultCompletionProviderRegistry(): CompletionProviderRegistry {
  return {
    "mock-provider": new MockCompletionProvider(),
    openai: new OpenAiCompletionProvider(),
    anthropic: new AnthropicCompletionProvider(),
    gemini: new GeminiCompletionProvider(),
  };
}

function extractOpenAiText(response: OpenAiResponse) {
  if (response.output_text) return response.output_text;

  const parts =
    response.output?.flatMap((item) =>
      item.content?.flatMap((content) => (typeof content.text === "string" ? [content.text] : [])) ?? []
    ) ?? [];

  return parts.join("\n").trim() || "nomduchat получил пустой ответ от AI-провайдера.";
}

function parseOpenAiStreamEvent(rawEvent: string): OpenAiStreamEvent | null {
  const data = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n")
    .trim();

  if (!data || data === "[DONE]") return null;

  try {
    return JSON.parse(data) as OpenAiStreamEvent;
  } catch {
    return null;
  }
}

async function emitTextDeltas(text: string, callbacks: CompletionStreamCallbacks) {
  for (let index = 0; index < text.length; index += 32) {
    const chunk = text.slice(index, index + 32);
    if (chunk) await callbacks.onDelta(chunk);
  }
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
