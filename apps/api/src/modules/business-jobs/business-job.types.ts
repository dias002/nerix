import type { AiTaskType, JobStatus } from "@nomduchat/shared";

export type BusinessJobChannel = "website" | "telegram" | "email" | "crm" | "internal";
export type BusinessJobCapability =
  | "website_generation"
  | "bot_setup"
  | "campaign_generation"
  | "knowledge_ingest"
  | "workspace_analysis";

export type BusinessJobRecord = {
  id: string;
  workspaceId: string;
  createdByUserId: string | null;
  channel: BusinessJobChannel;
  capability: BusinessJobCapability;
  taskType: AiTaskType;
  status: Extract<JobStatus, "queued" | "running" | "succeeded" | "failed" | "cancelled">;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  provider: string | null;
  model: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};
