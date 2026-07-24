import type { AiModality } from "@nomduchat/shared";
import { config } from "../../config.js";
import type { AvatarVideoGenerationInput, ImageReferenceInput, MediaGenerationOptions } from "./generation.types.js";

export type MediaGenerationProviderInput = {
  jobId: string;
  provider: string;
  model: string;
  modality: AiModality;
  prompt: string;
  systemPrompt?: string;
  avatarVideo?: AvatarVideoGenerationInput;
  imageReference?: ImageReferenceInput;
  imageReferences?: ImageReferenceInput[];
  options?: MediaGenerationOptions;
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

export type MediaGenerationCancelResult = {
  raw?: Record<string, unknown>;
};

export type MediaArtifact = {
  mimeType: string;
  data: Buffer;
};

export interface MediaGenerationProvider {
  generate(input: MediaGenerationProviderInput): Promise<MediaGenerationProviderResult>;
  refresh(operationName: string): Promise<MediaGenerationRefreshResult>;
  cancel(operationName: string): Promise<MediaGenerationCancelResult>;
  fetchArtifact(uri: string): Promise<MediaArtifact>;
}

const heygenBaseUrl = "https://api.heygen.com";
const heygenVideoAgentOperationPrefix = "heygen-video-agent://session/";
const heygenVideoOperationPrefix = "heygen-video://video/";
const defaultGeminiImageModel = "gemini-3.1-flash-image";
const defaultGeminiVideoModel = "veo-3.1-lite-generate-preview";
const defaultGeminiMusicModel = "lyria-3-clip-preview";
const defaultOpenAiImageModel = "gpt-image-1";
const defaultOpenAiVoiceModel = "gpt-4o-mini-tts";

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

  async cancel(_operationName?: string) {
    return {
      raw: {
        mock: true,
        cancelled: true,
      },
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

    const artifact = extractMediaArtifact(body, "video/mp4");
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

  async cancel(operationName: string) {
    if (!config.GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is required for Gemini media generation cancellation.");
    }

    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${operationName}:cancel`);
    url.searchParams.set("key", config.GOOGLE_AI_API_KEY);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const body = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(`Gemini operation cancel failed with ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
    }

    return {
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
    const model =
      input.modality === "image"
        ? normalizeGeminiImageModel(input.model)
        : normalizeGeminiMusicModel(input.model);
    const references = input.imageReferences?.length
      ? input.imageReferences
      : input.imageReference
        ? [input.imageReference]
        : [];
    const interactionInput = input.modality === "music"
      ? input.prompt
      : [
          { type: "text", text: input.prompt },
          ...references.map(toGeminiInlineImage),
        ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: interactionInput,
        ...(input.modality === "image"
          ? {
              response_format: {
                type: "image",
                mime_type: "image/jpeg",
                aspect_ratio: input.options?.aspectRatio ?? "1:1",
                image_size: input.options?.imageSize ?? "1K",
              },
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini ${input.modality} generation failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    const artifact = extractMediaArtifact(body, defaultMimeTypeForModality(input.modality));
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
    const model = normalizeGeminiVideoModel(input.model);
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predictLongRunning`
    );
    url.searchParams.set("key", config.GOOGLE_AI_API_KEY ?? "");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          compactObject({
            prompt: input.prompt,
            image: input.imageReference
              ? {
                  inlineData: {
                    mimeType: input.imageReference.mimeType,
                    data: input.imageReference.data.toString("base64"),
                  },
                }
              : undefined,
          }),
        ],
        parameters: {
          numberOfVideos: 1,
          aspectRatio: normalizeVideoAspectRatio(input.options?.aspectRatio),
          resolution: input.options?.videoResolution ?? "720p",
          durationSeconds: normalizeVideoDuration(input.options, Boolean(input.imageReference)),
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

export class HeyGenMediaGenerationProvider implements MediaGenerationProvider {
  async generate(input: MediaGenerationProviderInput) {
    const apiKey = requireHeyGenApiKey("HeyGen avatar video generation");
    if (input.modality !== "avatar_video" && input.modality !== "video") {
      throw new Error(`HeyGen video agent does not support '${input.modality}'.`);
    }

    if (input.modality === "avatar_video" && input.avatarVideo?.referenceImage) {
      return this.generateImageAvatarVideo(input, apiKey);
    }

    const requestBody = compactObject({
      prompt: input.prompt,
      mode: "generate",
      avatar_id: nonEmptyString(config.HEYGEN_AVATAR_ID),
      voice_id: nonEmptyString(config.HEYGEN_VOICE_ID),
      style_id: nonEmptyString(config.HEYGEN_STYLE_ID),
      brand_kit_id: nonEmptyString(config.HEYGEN_BRAND_KIT_ID),
      orientation: config.HEYGEN_ORIENTATION,
      callback_url: nonEmptyString(config.HEYGEN_CALLBACK_URL),
      callback_id: input.jobId,
      incognito_mode: true,
    });

    const body = await this.fetchJson(
      "/v3/video-agents",
      {
        method: "POST",
        headers: heygenJsonHeaders(apiKey),
        body: JSON.stringify(requestBody),
      },
      "HeyGen video agent generation"
    );
    const data = dataRecord(body);
    const status = firstString(data, ["status", "state"]);
    if (isHeyGenFailedStatus(status)) {
      throw new Error(`HeyGen video agent generation failed: ${extractFirstString(data, heygenErrorKeys) ?? status}`);
    }

    const sessionId = firstString(data, ["session_id", "sessionId", "id"]);
    if (!sessionId) {
      throw new Error("HeyGen video agent generation did not return a session id.");
    }

    return {
      status: "running" as const,
      operationName: makeHeyGenVideoAgentOperationName(sessionId),
      raw: body,
    };
  }

  async refresh(operationName: string) {
    const apiKey = requireHeyGenApiKey("HeyGen avatar video refresh");
    const directVideoId = parseHeyGenVideoOperationName(operationName);
    if (directVideoId) return this.refreshVideo(apiKey, directVideoId);

    const sessionId = parseHeyGenVideoAgentOperationName(operationName);
    if (!sessionId) {
      throw new Error("HeyGen operation name is invalid.");
    }

    const sessionBody = await this.fetchJson(
      `/v3/video-agents/${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        headers: heygenJsonHeaders(apiKey),
      },
      "HeyGen video agent refresh"
    );
    const sessionData = dataRecord(sessionBody);
    const sessionStatus = firstString(sessionData, ["status", "state"]);
    if (isHeyGenFailedStatus(sessionStatus)) {
      return {
        status: "failed" as const,
        errorMessage: extractFirstString(sessionData, heygenErrorKeys) ?? "HeyGen video agent session failed.",
        raw: sessionBody,
      };
    }

    const videoId = firstString(sessionData, ["video_id", "videoId"]);
    if (!videoId) {
      return {
        status: "running" as const,
        raw: sessionBody,
      };
    }

    const videoBody = await this.fetchJson(
      `/v3/videos/${encodeURIComponent(videoId)}`,
      {
        method: "GET",
        headers: heygenJsonHeaders(apiKey),
      },
      "HeyGen video status"
    );
    const videoData = dataRecord(videoBody);
    const videoStatus = firstString(videoData, ["status", "state"]);
    if (isHeyGenFailedStatus(videoStatus)) {
      return {
        status: "failed" as const,
        errorMessage: extractFirstString(videoData, heygenErrorKeys) ?? "HeyGen video rendering failed.",
        raw: {
          session: sessionBody,
          video: videoBody,
        },
      };
    }

    const videoUrl = firstString(videoData, ["video_url", "videoUrl", "url", "download_url", "downloadUrl"]);
    if (isHeyGenCompletedStatus(videoStatus) && videoUrl) {
      return {
        status: "succeeded" as const,
        mimeType: inferMimeTypeFromUri(videoUrl) ?? "video/mp4",
        providerUri: videoUrl,
        raw: {
          session: sessionBody,
          video: videoBody,
        },
      };
    }

    if (isHeyGenCompletedStatus(videoStatus)) {
      return {
        status: "failed" as const,
        errorMessage: "HeyGen video completed without a downloadable video URL.",
        raw: {
          session: sessionBody,
          video: videoBody,
        },
      };
    }

    return {
      status: "running" as const,
      raw: {
        session: sessionBody,
        video: videoBody,
      },
    };
  }

  async cancel(operationName: string) {
    const sessionId = parseHeyGenVideoAgentOperationName(operationName);
    const videoId = parseHeyGenVideoOperationName(operationName);
    return {
      raw: compactObject({
        provider: "heygen",
        sessionId,
        videoId,
        cancellation: "local_job_cancelled",
      }),
    };
  }

  async fetchArtifact(uri: string) {
    const response = await fetch(uri);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HeyGen artifact fetch failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      mimeType: response.headers.get("content-type") ?? inferMimeTypeFromUri(uri) ?? "video/mp4",
      data: Buffer.from(arrayBuffer),
    };
  }

  private async fetchJson(path: string, init: RequestInit, label: string) {
    const response = await fetch(`${heygenBaseUrl}${path}`, init);
    const body = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
    }

    return body;
  }

  private async generateImageAvatarVideo(input: MediaGenerationProviderInput, apiKey: string) {
    const avatarVideo = input.avatarVideo;
    const referenceImage = avatarVideo?.referenceImage;
    if (!avatarVideo?.consentConfirmed) {
      throw new Error("Consent is required before sending a face image to HeyGen.");
    }
    if (!referenceImage) {
      throw new Error("A reference face image is required for personal avatar video generation.");
    }

    const script = nonEmptyString(avatarVideo.script) ?? input.prompt;
    const voiceId = nonEmptyString(avatarVideo.voiceId) ?? nonEmptyString(config.HEYGEN_VOICE_ID);
    if (!voiceId) {
      throw new Error("HEYGEN_VOICE_ID is required for HeyGen image-to-video generation.");
    }

    const asset = await this.uploadAsset(apiKey, referenceImage);
    const requestBody = compactObject({
      type: "image",
      image: {
        type: "asset_id",
        asset_id: asset.assetId,
      },
      script,
      voice_id: voiceId,
      title: createHeyGenTitle(avatarVideo.avatarName, input.jobId),
      resolution: "1080p",
      aspect_ratio: avatarVideo.aspectRatio ?? "auto",
      callback_url: nonEmptyString(config.HEYGEN_CALLBACK_URL),
      callback_id: input.jobId,
      output_format: "mp4",
    });

    const body = await this.fetchJson(
      "/v3/videos",
      {
        method: "POST",
        headers: heygenJsonHeaders(apiKey),
        body: JSON.stringify(requestBody),
      },
      "HeyGen image avatar video generation"
    );
    const data = dataRecord(body);
    const status = firstString(data, ["status", "state"]);
    if (isHeyGenFailedStatus(status)) {
      throw new Error(`HeyGen image avatar video generation failed: ${extractFirstString(data, heygenErrorKeys) ?? status}`);
    }

    const videoId = firstString(data, ["video_id", "videoId", "id"]);
    if (!videoId) {
      throw new Error("HeyGen image avatar video generation did not return a video id.");
    }

    return {
      status: "running" as const,
      operationName: makeHeyGenVideoOperationName(videoId),
      raw: compactObject({
        provider: "heygen",
        flow: "image_to_video",
        assetId: asset.assetId,
        assetMimeType: asset.mimeType,
        assetSizeBytes: asset.sizeBytes,
        videoId,
        videoStatus: status,
      }),
    };
  }

  private async uploadAsset(apiKey: string, referenceImage: NonNullable<AvatarVideoGenerationInput["referenceImage"]>) {
    const form = new FormData();
    const bytes = Buffer.from(referenceImage.dataBase64, "base64");
    form.append(
      "file",
      new Blob([new Uint8Array(bytes)], { type: referenceImage.mimeType }),
      referenceImage.filename ?? `nomduchat-avatar-${Date.now()}.${extensionForMimeType(referenceImage.mimeType)}`
    );

    const body = await this.fetchJson(
      "/v3/assets",
      {
        method: "POST",
        headers: heygenUploadHeaders(apiKey),
        body: form,
      },
      "HeyGen avatar image upload"
    );
    const data = dataRecord(body);
    const assetId = firstString(data, ["asset_id", "assetId", "id"]);
    if (!assetId) {
      throw new Error("HeyGen avatar image upload did not return an asset id.");
    }

    return {
      assetId,
      mimeType: firstString(data, ["mime_type", "mimeType"]) ?? referenceImage.mimeType,
      sizeBytes: typeof data.size_bytes === "number" ? data.size_bytes : bytes.byteLength,
    };
  }

  private async refreshVideo(apiKey: string, videoId: string) {
    const videoBody = await this.fetchJson(
      `/v3/videos/${encodeURIComponent(videoId)}`,
      {
        method: "GET",
        headers: heygenJsonHeaders(apiKey),
      },
      "HeyGen video status"
    );
    const videoData = dataRecord(videoBody);
    const videoStatus = firstString(videoData, ["status", "state"]);
    if (isHeyGenFailedStatus(videoStatus)) {
      return {
        status: "failed" as const,
        errorMessage: extractFirstString(videoData, heygenErrorKeys) ?? "HeyGen video rendering failed.",
        raw: videoBody,
      };
    }

    const videoUrl = firstString(videoData, ["video_url", "videoUrl", "url", "download_url", "downloadUrl"]);
    if (isHeyGenCompletedStatus(videoStatus) && videoUrl) {
      return {
        status: "succeeded" as const,
        mimeType: inferMimeTypeFromUri(videoUrl) ?? "video/mp4",
        providerUri: videoUrl,
        raw: videoBody,
      };
    }

    if (isHeyGenCompletedStatus(videoStatus)) {
      return {
        status: "failed" as const,
        errorMessage: "HeyGen video completed without a downloadable video URL.",
        raw: videoBody,
      };
    }

    return {
      status: "running" as const,
      raw: videoBody,
    };
  }
}

export class OpenAiMediaGenerationProvider implements MediaGenerationProvider {
  async generate(input: MediaGenerationProviderInput) {
    if (!config.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for OpenAI media generation.");
    }

    if (input.modality === "image") {
      return input.imageReference || input.imageReferences?.length ? this.editImage(input) : this.generateImage(input);
    }

    if (input.modality === "voice") {
      return this.generateSpeech(input);
    }

    throw new Error(`OpenAI media generation does not support '${input.modality}'.`);
  }

  async refresh() {
    return {
      status: "failed" as const,
      errorMessage: "OpenAI media generations complete synchronously.",
    };
  }

  async cancel(_operationName?: string) {
    return {
      raw: {
        provider: "openai",
        cancelled: true,
      },
    };
  }

  async fetchArtifact(uri: string) {
    const response = await fetch(uri);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI artifact fetch failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      mimeType: response.headers.get("content-type") ?? inferMimeTypeFromUri(uri) ?? "application/octet-stream",
      data: Buffer.from(arrayBuffer),
    };
  }

  private async generateImage(input: MediaGenerationProviderInput) {
    const body = await this.fetchJson(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: openAiJsonHeaders(),
        body: JSON.stringify({
          model: normalizeOpenAiImageModel(input.model),
          prompt: input.prompt,
          size: openAiImageSize(input.options?.aspectRatio),
        }),
      },
      "OpenAI image generation"
    );

    const artifact = extractOpenAiImageArtifact(body);
    if (!artifact) {
      throw new Error("OpenAI image generation completed without an image artifact.");
    }

    return {
      status: "succeeded" as const,
      mimeType: artifact.mimeType,
      base64Data: artifact.base64Data,
      providerUri: artifact.uri,
      raw: body,
    };
  }

  private async editImage(input: MediaGenerationProviderInput) {
    const references = input.imageReferences?.length ? input.imageReferences : input.imageReference ? [input.imageReference] : [];
    if (references.length === 0) {
      throw new Error("An image reference is required for OpenAI image edits.");
    }

    const form = new FormData();
    form.append("model", normalizeOpenAiImageModel(input.model));
    form.append("prompt", [
      "Edit the provided source image or images. Preserve the main subject, composition, and recognizable style unless the user explicitly asks to change them.",
      "If the user says an image is an identity reference, preserve the recognizable person. If the user says an image is a style reference only, use it only for style, lighting, crop, and quality.",
      "Apply only the requested change.",
      "",
      "Source image prompts:",
      ...references.map((reference, index) => `${index + 1}. ${reference.prompt}`),
      "",
      "User edit request:",
      input.prompt,
    ].join("\n"));
    const imageFieldName = references.length > 1 ? "image[]" : "image";
    for (const reference of references) {
      form.append(
        imageFieldName,
        new Blob([new Uint8Array(reference.data)], { type: reference.mimeType }),
        `nomduchat-source-${reference.jobId}.${extensionForMimeType(reference.mimeType)}`
      );
    }
    form.append("size", openAiImageSize(input.options?.aspectRatio));

    const body = await this.fetchJson(
      "https://api.openai.com/v1/images/edits",
      {
        method: "POST",
        headers: openAiFormHeaders(),
        body: form,
      },
      "OpenAI image edit"
    );

    const artifact = extractOpenAiImageArtifact(body);
    if (!artifact) {
      throw new Error("OpenAI image edit completed without an image artifact.");
    }

    return {
      status: "succeeded" as const,
      mimeType: artifact.mimeType,
      base64Data: artifact.base64Data,
      providerUri: artifact.uri,
      raw: body,
    };
  }

  async generateSpeech(input: MediaGenerationProviderInput) {
    const format = input.options?.audioFormat ?? "mp3";
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: openAiJsonHeaders(),
      body: JSON.stringify({
        model: normalizeOpenAiVoiceModel(input.model),
        voice: input.options?.voice ?? inferOpenAiVoice(input.prompt),
        input: cleanSpeechInput(input.prompt),
        response_format: format,
        speed: input.options?.speechSpeed ?? 1,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI speech generation failed with ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      status: "succeeded" as const,
      mimeType: response.headers.get("content-type") ?? (format === "wav" ? "audio/wav" : "audio/mpeg"),
      base64Data: Buffer.from(arrayBuffer).toString("base64"),
      raw: {
        provider: "openai",
        model: normalizeOpenAiVoiceModel(input.model),
      },
    };
  }

  private async fetchJson(url: string, init: RequestInit, label: string) {
    const response = await fetch(url, init);
    const body = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
    }

    return body;
  }
}

export class OpenAiVoiceGenerationProvider implements MediaGenerationProvider {
  private readonly openai = new OpenAiMediaGenerationProvider();

  async generate(input: MediaGenerationProviderInput) {
    if (!config.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for OpenAI voice generation.");
    }
    if (input.modality !== "voice") {
      throw new Error(`OpenAI voice generation does not support '${input.modality}'.`);
    }

    return this.openai.generateSpeech(input);
  }

  async refresh() {
    return {
      status: "failed" as const,
      errorMessage: "OpenAI voice generations complete synchronously.",
    };
  }

  async cancel(operationName?: string) {
    return this.openai.cancel(operationName);
  }

  async fetchArtifact(uri: string) {
    return this.openai.fetchArtifact(uri);
  }
}

export class BackendMediaGenerationProvider implements MediaGenerationProvider {
  private readonly mock = new MockMediaGenerationProvider();
  private readonly openai = new OpenAiMediaGenerationProvider();
  private readonly gemini = new GeminiMediaGenerationProvider();
  private readonly heygen = new HeyGenMediaGenerationProvider();

  async generate(input: MediaGenerationProviderInput) {
    if (input.provider === "mock-provider") return this.mock.generate(input);
    if (input.provider === "openai") return this.openai.generate(input);
    if (input.provider === "gemini") return this.gemini.generate(input);
    if (input.provider === "heygen") return this.heygen.generate(input);

    throw new Error(`Media provider '${input.provider}' is not supported yet.`);
  }

  async refresh(operationName: string) {
    if (operationName.startsWith("mock://")) return this.mock.refresh();
    if (isHeyGenOperationName(operationName)) return this.heygen.refresh(operationName);
    return this.gemini.refresh(operationName);
  }

  async cancel(operationName: string) {
    if (operationName.startsWith("mock://")) return this.mock.cancel(operationName);
    if (isHeyGenOperationName(operationName)) return this.heygen.cancel(operationName);
    return this.gemini.cancel(operationName);
  }

  async fetchArtifact(uri: string) {
    if (uri.startsWith("mock://")) return this.mock.fetchArtifact(uri);
    if (isOpenAiArtifactUri(uri)) return this.openai.fetchArtifact(uri);
    if (isHttpUri(uri) && !isGeminiArtifactUri(uri)) return this.heygen.fetchArtifact(uri);
    return this.gemini.fetchArtifact(uri);
  }
}

export function createMediaGenerationProvider(): MediaGenerationProvider {
  return new BackendMediaGenerationProvider();
}

const geminiImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function toGeminiInlineImage(reference: ImageReferenceInput) {
  const mimeType = reference.mimeType.trim().toLowerCase();
  if (!geminiImageMimeTypes.has(mimeType)) {
    throw new Error("Gemini image references must use JPEG, PNG, or WebP.");
  }
  if (reference.data.length === 0) {
    throw new Error("Gemini image references cannot be empty.");
  }

  return {
    type: "image",
    mime_type: mimeType,
    data: reference.data.toString("base64"),
  };
}

function extractMediaArtifact(
  input: unknown,
  fallbackMimeType?: string
): { mimeType: string; base64Data?: string; uri?: string } | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const uri = firstString(record, [
    "uri",
    "gcsUri",
    "gcs_uri",
    "url",
    "videoUri",
    "video_uri",
    "videoUrl",
    "video_url",
    "audioUri",
    "audio_uri",
    "audioUrl",
    "audio_url",
    "imageUri",
    "image_uri",
    "imageUrl",
    "image_url",
    "downloadUri",
    "download_uri",
    "fileUri",
    "file_uri",
    "mediaUri",
    "media_uri",
    "outputUri",
    "output_uri",
    "downloadUrl",
    "download_url",
  ]);
  const mimeType =
    firstString(record, ["mimeType", "mime_type", "contentType", "content_type"]) ??
    inferMimeType(record) ??
    inferMimeTypeFromUri(uri) ??
    fallbackMimeType;
  const base64Data = firstString(record, ["data", "bytesBase64Encoded", "base64Data", "base64_data"]);

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
        const artifact = extractMediaArtifact(item, fallbackMimeType);
        if (artifact) return artifact;
      }
      continue;
    }

    const artifact = extractMediaArtifact(value, fallbackMimeType);
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

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      body: text,
    };
  }
}

function inferMimeType(record: Record<string, unknown>) {
  const type = firstString(record, ["type", "mediaType", "media_type"]);
  if (!type) return undefined;
  const normalized = type.toLowerCase();
  if (normalized.includes("image")) return "image/png";
  if (normalized.includes("audio") || normalized.includes("music")) return "audio/mpeg";
  if (normalized.includes("video")) return "video/mp4";
  return undefined;
}

function inferMimeTypeFromUri(uri?: string) {
  if (!uri) return undefined;
  const normalized = uri.split("?")[0]?.toLowerCase() ?? "";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".mp3")) return "audio/mpeg";
  if (normalized.endsWith(".wav")) return "audio/wav";
  if (normalized.endsWith(".m4a")) return "audio/mp4";
  if (normalized.endsWith(".mp4")) return "video/mp4";
  if (normalized.endsWith(".webm")) return "video/webm";
  return undefined;
}

function defaultMimeTypeForModality(modality: AiModality) {
  if (modality === "image") return "image/png";
  if (modality === "music") return "audio/mpeg";
  if (modality === "voice") return "audio/wav";
  if (modality === "video" || modality === "avatar_video") return "video/mp4";
  return undefined;
}

function normalizeGeminiVideoModel(value: string | undefined) {
  const model = value?.trim().replace(/^models\//, "");
  if (!model || model === "gemini-video-configured" || model === "video-primary") {
    return defaultGeminiVideoModel;
  }

  return model;
}

function normalizeGeminiImageModel(value: string | undefined) {
  const model = value?.trim().replace(/^models\//, "");
  if (!model || model === "gemini-image-configured" || model === "image-primary") {
    return defaultGeminiImageModel;
  }

  return model;
}

function normalizeGeminiMusicModel(value: string | undefined) {
  const model = value?.trim().replace(/^models\//, "");
  if (!model || model === "gemini-music-configured" || model === "music-primary") {
    return defaultGeminiMusicModel;
  }

  return model;
}

function normalizeOpenAiImageModel(value: string | undefined) {
  const model = value?.trim();
  if (!model || model === "openai-image-configured" || model === "image-primary") return defaultOpenAiImageModel;
  return model;
}

function normalizeOpenAiVoiceModel(value: string | undefined) {
  const model = value?.trim();
  if (!model || model === "openai-voice-configured" || model === "voice-primary") return defaultOpenAiVoiceModel;
  return model;
}

function inferOpenAiVoice(prompt: string) {
  const normalized = prompt.toLowerCase();
  if (containsAny(normalized, ["муж", "низк", "бас", "male", "deep"])) return "onyx";
  if (containsAny(normalized, ["жен", "female", "мягк", "тепл"])) return "nova";
  if (containsAny(normalized, ["детск", "ребен", "child", "young", "игрив"])) return "fable";
  if (containsAny(normalized, ["энерг", "ярк", "реклам", "promo"])) return "shimmer";
  return "alloy";
}

function cleanSpeechInput(prompt: string) {
  return (
    prompt
      .replace(/^(озвучь|сделай озвучку|создай озвучку|прочитай вслух|voice over|text to speech)[:\s-]*/i, "")
      .trim()
      .slice(0, 4_000) || prompt.slice(0, 4_000)
  );
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function extractErrorMessage(error: object) {
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : undefined;
}

const heygenErrorKeys = ["message", "error", "error_message", "failure_message", "fail_reason", "details"];

function requireHeyGenApiKey(scope: string) {
  if (!config.HEYGEN_API_KEY) {
    throw new Error(`HEYGEN_API_KEY is required for ${scope}.`);
  }

  return config.HEYGEN_API_KEY;
}

function heygenJsonHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "X-Api-Key": apiKey,
  };
}

function openAiJsonHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.OPENAI_API_KEY}`,
  };
}

function openAiFormHeaders() {
  return {
    Authorization: `Bearer ${config.OPENAI_API_KEY}`,
  };
}

function heygenUploadHeaders(apiKey: string) {
  return {
    "X-Api-Key": apiKey,
  };
}

function dataRecord(input: Record<string, unknown>) {
  const data = input.data;
  if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  return input;
}

function makeHeyGenVideoAgentOperationName(sessionId: string) {
  return `${heygenVideoAgentOperationPrefix}${encodeURIComponent(sessionId)}`;
}

function isHeyGenVideoAgentOperationName(operationName: string) {
  return operationName.startsWith(heygenVideoAgentOperationPrefix);
}

function makeHeyGenVideoOperationName(videoId: string) {
  return `${heygenVideoOperationPrefix}${encodeURIComponent(videoId)}`;
}

function isHeyGenVideoOperationName(operationName: string) {
  return operationName.startsWith(heygenVideoOperationPrefix);
}

function isHeyGenOperationName(operationName: string) {
  return isHeyGenVideoAgentOperationName(operationName) || isHeyGenVideoOperationName(operationName);
}

function parseHeyGenVideoAgentOperationName(operationName: string) {
  if (!isHeyGenVideoAgentOperationName(operationName)) return undefined;
  const rawSessionId = operationName.slice(heygenVideoAgentOperationPrefix.length);
  try {
    return decodeURIComponent(rawSessionId);
  } catch {
    return rawSessionId;
  }
}

function parseHeyGenVideoOperationName(operationName: string) {
  if (!isHeyGenVideoOperationName(operationName)) return undefined;
  const rawVideoId = operationName.slice(heygenVideoOperationPrefix.length);
  try {
    return decodeURIComponent(rawVideoId);
  } catch {
    return rawVideoId;
  }
}

function isHeyGenFailedStatus(status?: string) {
  if (!status) return false;
  return ["failed", "failure", "error", "canceled", "cancelled"].includes(status.toLowerCase());
}

function isHeyGenCompletedStatus(status?: string) {
  if (!status) return false;
  return ["completed", "complete", "succeeded", "success", "done"].includes(status.toLowerCase());
}

function nonEmptyString(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function createHeyGenTitle(name: string | undefined, jobId: string) {
  const cleanName = nonEmptyString(name)?.replace(/\s+/g, " ").slice(0, 60);
  return cleanName ? `${cleanName} · nomduchat` : `nomduchat avatar ${jobId.slice(0, 8)}`;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/wav") return "wav";
  return "jpg";
}

function isHttpUri(uri: string) {
  return uri.startsWith("http://") || uri.startsWith("https://");
}

function isGeminiArtifactUri(uri: string) {
  try {
    return new URL(uri).hostname === "generativelanguage.googleapis.com";
  } catch {
    return false;
  }
}

function normalizeVideoAspectRatio(aspectRatio?: MediaGenerationOptions["aspectRatio"]) {
  return aspectRatio === "9:16" ? "9:16" : "16:9";
}

function normalizeVideoDuration(options?: MediaGenerationOptions, hasStartingFrame = false) {
  if (hasStartingFrame || options?.videoResolution === "1080p" || options?.videoResolution === "4k") return 8;
  return options?.durationSeconds ?? 8;
}

function openAiImageSize(aspectRatio?: MediaGenerationOptions["aspectRatio"]) {
  if (["2:3", "3:4", "4:5", "9:16"].includes(aspectRatio ?? "")) return "1024x1536";
  if (["3:2", "4:3", "5:4", "16:9", "21:9"].includes(aspectRatio ?? "")) return "1536x1024";
  return "1024x1024";
}

function compactObject(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function extractOpenAiImageArtifact(input: unknown) {
  const data = input && typeof input === "object" ? (input as Record<string, unknown>).data : null;
  if (!Array.isArray(data)) return null;

  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const base64Data = typeof record.b64_json === "string" ? record.b64_json : undefined;
    const uri = typeof record.url === "string" ? record.url : undefined;
    if (base64Data || uri) {
      return {
        mimeType: inferMimeTypeFromUri(uri) ?? "image/png",
        base64Data,
        uri,
      };
    }
  }

  return null;
}

function inferOpenAiVoice(prompt: string) {
  const normalized = prompt.toLowerCase();
  if (containsAny(normalized, ["муж", "низк", "бас", "male", "deep"])) return "onyx";
  if (containsAny(normalized, ["жен", "female", "мягк", "тепл"])) return "nova";
  if (containsAny(normalized, ["детск", "ребен", "child", "young", "игрив"])) return "fable";
  if (containsAny(normalized, ["энерг", "ярк", "реклам", "promo"])) return "shimmer";
  if (containsAny(normalized, ["спокой", "делов", "нейтрал"])) return "alloy";
  return "alloy";
}

function cleanSpeechInput(prompt: string) {
  return prompt
    .replace(/^(озвучь|сделай озвучку|создай озвучку|прочитай вслух|voice over|text to speech)[:\s-]*/i, "")
    .trim()
    .slice(0, 4_000) || prompt.slice(0, 4_000);
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function isOpenAiArtifactUri(uri: string) {
  try {
    const { hostname } = new URL(uri);
    return hostname.endsWith("openai.com") || hostname.endsWith("oaidalleapiprodscus.blob.core.windows.net");
  } catch {
    return false;
  }
}
