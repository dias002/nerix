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
    if (input.provider !== "openai" || !config.OPENAI_API_KEY) {
      return new MockCompletionProvider().complete(input);
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

export function createCompletionProvider(): AiCompletionProvider {
  return config.OPENAI_API_KEY ? new OpenAiCompletionProvider() : new MockCompletionProvider();
}

function extractOpenAiText(response: OpenAiResponse) {
  if (response.output_text) return response.output_text;

  const parts =
    response.output?.flatMap((item) =>
      item.content?.flatMap((content) => (typeof content.text === "string" ? [content.text] : [])) ?? []
    ) ?? [];

  return parts.join("\n").trim() || "nomduchat получил пустой ответ от AI-провайдера.";
}
