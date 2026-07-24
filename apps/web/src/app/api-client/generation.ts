import type { AiModality, Language } from "@nomduchat/shared";
import type { MediaGenerationJobApiRecord } from "./index";
import { request, requestBlob } from "./transport";

export type AvatarVideoJobInput = {
  referenceImage?: {
    dataBase64: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    filename?: string;
  };
  script?: string;
  avatarName?: string;
  consentConfirmed?: boolean;
  voiceId?: string;
  aspectRatio?: "auto" | "16:9" | "9:16" | "4:5" | "5:4" | "1:1";
  expressiveness?: "low" | "medium" | "high";
  motionPrompt?: string;
};

export type ReferenceImageJobInput = {
  dataBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  filename?: string;
  consentConfirmed?: boolean;
};

export type GenerationPurpose = "avatar_profile" | "application_cover" | "title_video";

export type MediaGenerationOptions = {
  aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
  imageSize?: "1K" | "2K" | "4K";
  videoResolution?: "720p" | "1080p" | "4k";
  durationSeconds?: 4 | 6 | 8;
  voice?: "alloy" | "onyx" | "nova" | "fable" | "shimmer";
  speechSpeed?: number;
  audioFormat?: "mp3" | "wav";
  camera?: {
    yaw: number;
    pitch: number;
    distance: "macro" | "close" | "medium" | "wide";
    lens: 24 | 35 | 50 | 85;
    movement: "static" | "push_in" | "pull_out" | "orbit" | "tracking" | "crane";
  };
};

export async function createGenerationJob(input: {
  country?: "KZ" | "RU";
  language?: Language;
  agentId?: string;
  modality?: AiModality;
  purpose?: GenerationPurpose;
  prompt: string;
  options?: MediaGenerationOptions;
  imageReferenceJobId?: string;
  referenceImage?: ReferenceImageJobInput;
  referenceImages?: ReferenceImageJobInput[];
  avatarVideo?: AvatarVideoJobInput;
}) {
  return request<{ job: MediaGenerationJobApiRecord }>("/generation/jobs", {
    method: "POST",
    body: JSON.stringify({
      country: input.country ?? "KZ",
      language: input.language ?? "ru",
      agentId: input.agentId,
      modality: input.modality,
      purpose: input.purpose,
      prompt: input.prompt,
      options: input.options,
      imageReferenceJobId: input.imageReferenceJobId,
      referenceImage: input.referenceImage,
      referenceImages: input.referenceImages,
      avatarVideo: input.avatarVideo,
    }),
  });
}

export async function refreshGenerationJob(jobId: string) {
  return request<{ job: MediaGenerationJobApiRecord }>(`/generation/jobs/${encodeURIComponent(jobId)}/refresh`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function cancelGenerationJob(jobId: string) {
  return request<{ job: MediaGenerationJobApiRecord }>(`/generation/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchGenerationArtifact(jobId: string) {
  return requestBlob(`/generation/jobs/${encodeURIComponent(jobId)}/artifact`);
}
