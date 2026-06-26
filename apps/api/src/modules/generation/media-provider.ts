import type { AiModality } from "@nomduchat/shared";
import { config } from "../../config.js";

export type MediaGenerationProviderInput = {
  jobId: string;
  provider: string;
  model: string;
  modality: AiModality;
  prompt: string;
  systemPrompt?: string;
};

export type MediaGenerationProviderResult = {
  status: "running" | "succeeded";
  mimeType?: string;
  base64Data?: string;
  text?: string;
  operationName?: string;
  providerUri?: string;
  raw?: Record<string, unknown>;
};

export type MediaGenerationRefreshResult = {
  status: "running" | "succeeded" | "failed";
  mimeType?: string;
  base64Data?: string;
  providerUri?: string;
  errorMessage?: string;
  raw?: Record<string, unknown>;
};

export type MediaArtifact = {
  mimeType: string;
  data: Buffer;
};

export interface MediaGenerationProvider {
  generate(input: MediaGenerationProviderInput): Promise<MediaGenerationProviderResult>;
  refresh(operationName: string): Promise<MediaGenerationRefreshResult>;
  fetchArtifact(uri: string): Promise<MediaArtifact>;
}

export class MockMediaGenerationProvider implements MediaGenerationProvider {
  async generate(input: MediaGenerationProviderInput) {
    const text = [
      `nomduchat mock ${input.modality} artifact`,
      `provider=${input.provider}`,
      `model=${input.model}`,
      `prompt=${input.prompt}`,
    ].join("\n");

    return {
      status: "succeeded" as const,
      mimeType: "text/plain; charset=utf-8",
      base64Data: Buffer.from(text, "utf8").toString("base64"),
      text,
      raw: {
        mock: true,
      },
    };
  }

  async refresh() {
    return {
      status: "failed" as const,
      errorMessage: "Mock media generations complete synchronously.",
    };
  }

  async fetchArtifact(uri: string) {
    return {
      mimeType: "text/plain; charset=utf-8",
      data: Buffer.from(`Mock provider URI: ${uri}`, "utf8"),
    };
  }
}

export class GeminiMediaGenerationProvider implements MediaGenerationProvider {
  async generate(input: MediaGenerationProviderInput) {
    if (!config.GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is required for Gemini media generation.");
    }

    if (input.modality === "video") {
      return this.startVideo(input);
    }

    if (input.modality === "image" || input.modality === "music") {
      return this.startInteraction(input);
    }

    throw new Error(`Gemini media generation does not support '${input.modality}'.`);
  }

  async refresh(operationName: string) {
    if (!config.GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is required for Gemini media generation.");
    }

    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${operationName}`);
    url.searchParams.set("key", config.GOOGLE_AI_API_KEY);

    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini operation refresh failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    if (body.error && typeof body.error === "object") {
      return {
        status: "failed" as const,
        errorMessage: extractErrorMessage(body.error) ?? "Gemini operation failed.",
        raw: body,
      };
    }

    if (body.done !== true) {
      return {
        status: "running" as const,
        raw: body,
      };
    }

    const artifact = extractMediaArtifact(body);
    if (!artifact) {
      return {
        status: "failed" as const,
        errorMessage: "Gemini operation completed without a media artifact.",
        raw: body,
      };
    }

    return {
      status: "succeeded" as const,
      mimeType: artifact.mimeType,
      base64Data: artifact.base64Data,
      providerUri: artifact.uri,
      raw: body,
    };
  }

  async fetchArtifact(uri: string) {
    if (!config.GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is required for Gemini media artifact download.");
    }

    const url = new URL(uri);
    url.searchParams.set("key", config.GOOGLE_AI_API_KEY);
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini artifact fetch failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      mimeType: response.headers.get("content-type") ?? "application/octet-stream",
      data: Buffer.from(arrayBuffer),
    };
  }

  private async startInteraction(input: MediaGenerationProviderInput) {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/interactions");
    url.searchParams.set("key", config.GOOGLE_AI_API_KEY ?? "");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: `models/${input.model}`,
        input: input.prompt,
        config: {
          outputModalities: [input.modality === "image" ? "IMAGE" : "AUDIO"],
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini ${input.modality} generation failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    const artifact = extractMediaArtifact(body);
    if (!artifact?.base64Data) {
      throw new Error(`Gemini ${input.modality} generation completed without inline media data.`);
    }

    return {
      status: "succeeded" as const,
      mimeType: artifact.mimeType,
      base64Data: artifact.base64Data,
      text: extractFirstString(body, ["text", "caption", "description"]),
      raw: body,
    };
  }

  private async startVideo(input: MediaGenerationProviderInput) {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:predictLongRunning`
    );
    url.searchParams.set("key", config.GOOGLE_AI_API_KEY ?? "");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: input.prompt,
          },
        ],
        parameters: {
          numberOfVideos: 1,
          resolution: "720p",
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini video generation failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    const operationName = typeof body.name === "string" ? body.name : undefined;
    if (!operationName) {
      throw new Error("Gemini video generation did not return an operation name.");
    }

    return {
      status: "running" as const,
      operationName,
      raw: body,
    };
  }
}

export class BackendMediaGenerationProvider implements MediaGenerationProvider {
  private readonly mock = new MockMediaGenerationProvider();
  private readonly gemini = new GeminiMediaGenerationProvider();

  async generate(input: MediaGenerationProviderInput) {
    if (input.provider === "mock-provider") return this.mock.generate(input);
    if (input.provider === "gemini") return this.gemini.generate(input);

    throw new Error(`Media provider '${input.provider}' is not supported yet.`);
  }

  async refresh(operationName: string) {
    return this.gemini.refresh(operationName);
  }

  async fetchArtifact(uri: string) {
    if (uri.startsWith("mock://")) return this.mock.fetchArtifact(uri);
    return this.gemini.fetchArtifact(uri);
  }
}

export function createMediaGenerationProvider(): MediaGenerationProvider {
  return new BackendMediaGenerationProvider();
}

function extractMediaArtifact(input: unknown): { mimeType: string; base64Data?: string; uri?: string } | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const mimeType = firstString(record, ["mimeType", "mime_type", "contentType", "content_type"]) ?? inferMimeType(record);
  const base64Data = firstString(record, ["data", "bytesBase64Encoded", "base64Data", "base64_data"]);
  const uri = firstString(record, ["uri", "gcsUri", "videoUri", "downloadUri"]);

  if ((base64Data || uri) && mimeType) {
    return {
      mimeType,
      base64Data,
      uri,
    };
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const artifact = extractMediaArtifact(item);
        if (artifact) return artifact;
      }
      continue;
    }

    const artifact = extractMediaArtifact(value);
    if (artifact) return artifact;
  }

  return null;
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return undefined;
}

function extractFirstString(input: unknown, keys: string[]): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  const direct = firstString(record, keys);
  if (direct) return direct;

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = extractFirstString(item, keys);
        if (nested) return nested;
      }
      continue;
    }

    const nested = extractFirstString(value, keys);
    if (nested) return nested;
  }

  return undefined;
}

function inferMimeType(record: Record<string, unknown>) {
  const type = firstString(record, ["type", "mediaType", "media_type"]);
  if (!type) return undefined;
  const normalized = type.toLowerCase();
  if (normalized.includes("image")) return "image/png";
  if (normalized.includes("audio") || normalized.includes("music")) return "audio/wav";
  if (normalized.includes("video")) return "video/mp4";
  return undefined;
}

function extractErrorMessage(error: object) {
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : undefined;
}
