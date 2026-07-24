import type { AiModality, JobStatus } from "@nomduchat/shared";

export type MediaGenerationStatus = Extract<JobStatus, "queued" | "running" | "succeeded" | "failed" | "refunded" | "cancelled">;

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

export type UploadedReferenceImageInput = {
  dataBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  filename?: string;
  consentConfirmed?: boolean;
};

export type ImageReferenceInput = {
  jobId: string;
  prompt: string;
  resultUrl?: string;
  mimeType: string;
  data: Buffer;
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
