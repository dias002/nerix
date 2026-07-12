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

export async function createGenerationJob(input: {
  country?: "KZ" | "RU";
  language?: Language;
  agentId?: string;
  modality?: AiModality;
  prompt: string;
  avatarVideo?: AvatarVideoJobInput;
}) {
  return request<{ job: MediaGenerationJobApiRecord }>("/generation/jobs", {
    method: "POST",
    body: JSON.stringify({
      country: input.country ?? "KZ",
      language: input.language ?? "ru",
      agentId: input.agentId,
      modality: input.modality,
      prompt: input.prompt,
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
