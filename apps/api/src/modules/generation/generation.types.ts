import type { AiModality, JobStatus } from "@nomduchat/shared";

export type MediaGenerationStatus = Extract<JobStatus, "queued" | "running" | "succeeded" | "failed" | "refunded" | "cancelled">;

export type MediaGenerationJob = {
  id: string;
  userId: string;
  agentId?: string;
  modality: AiModality;
  status: MediaGenerationStatus;
  prompt: string;
  provider?: string;
  model?: string;
  reservationId?: string;
  resultUrl?: string;
  resultMimeType?: string;
  reservedCredits: number;
  finalCredits?: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type UserMediaAsset = {
  id: string;
  userId: string;
  projectId?: string;
  mediaType: AiModality;
  title: string;
  status: string;
  durationSeconds?: number;
  transcript?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateGenerationJobInput = {
  id: string;
  userId: string;
  agentId?: string;
  modality: AiModality;
  prompt: string;
  provider: string;
  model: string;
  reservedCredits: number;
  reservationId?: string;
  metadata?: Record<string, unknown>;
};

export type AvatarVideoGenerationInput = {
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

export type UpdateGenerationJobInput = {
  status?: MediaGenerationStatus;
  reservationId?: string;
  reservedCredits?: number;
  finalCredits?: number;
  resultUrl?: string;
  resultMimeType?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

export type CreateMediaAssetInput = {
  userId: string;
  projectId?: string;
  mediaType: AiModality;
  title: string;
  status?: string;
  durationSeconds?: number;
  transcript?: string;
  metadata?: Record<string, unknown>;
};
