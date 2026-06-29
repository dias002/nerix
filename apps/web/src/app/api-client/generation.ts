import type { MediaGenerationJobApiRecord } from "./index";
import { request, requestBlob } from "./transport";

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
