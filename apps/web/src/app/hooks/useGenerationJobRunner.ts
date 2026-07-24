import { useEffect, useRef, useState } from "react";
import type { MediaGenerationJobApiRecord } from "../api";
import {
  cancelGenerationJob,
  createGenerationJob,
  fetchGenerationArtifact,
  refreshGenerationJob,
} from "../api-client/generation";
import { toPublicApiError } from "../api-client/transport";

type GenerationJobInput = Parameters<typeof createGenerationJob>[0];

const activeStatuses = new Set<MediaGenerationJobApiRecord["status"]>(["queued", "running"]);

export function useGenerationJobRunner() {
  const [job, setJob] = useState<MediaGenerationJobApiRecord | null>(null);
  const [artifactUrl, setArtifactUrl] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState("");
  const objectUrlRef = useRef("");
  const loadingArtifactRef = useRef("");

  const revokeArtifactUrl = () => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = "";
  };

  const loadArtifact = async (nextJob: MediaGenerationJobApiRecord) => {
    if (nextJob.status !== "succeeded" || loadingArtifactRef.current === nextJob.id) return;
    loadingArtifactRef.current = nextJob.id;

    try {
      const blob = await fetchGenerationArtifact(nextJob.id);
      revokeArtifactUrl();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setArtifactUrl(url);
    } catch (artifactError) {
      setError(toPublicApiError(artifactError, "Результат готов, но файл не удалось загрузить."));
    } finally {
      loadingArtifactRef.current = "";
    }
  };

  const start = async (input: GenerationJobInput) => {
    setIsStarting(true);
    setError("");
    setArtifactUrl("");
    revokeArtifactUrl();
    loadingArtifactRef.current = "";

    try {
      const response = await createGenerationJob(input);
      setJob(response.job);
      if (response.job.status === "succeeded") {
        await loadArtifact(response.job);
      }
      return response.job;
    } catch (startError) {
      setError(toPublicApiError(startError, "Не удалось запустить генерацию."));
      return null;
    } finally {
      setIsStarting(false);
    }
  };

  const refresh = async () => {
    if (!job || !activeStatuses.has(job.status)) return job;

    try {
      const response = await refreshGenerationJob(job.id);
      setJob(response.job);
      if (response.job.status === "succeeded") {
        await loadArtifact(response.job);
      }
      return response.job;
    } catch (refreshError) {
      setError(toPublicApiError(refreshError, "Не удалось обновить статус генерации."));
      return job;
    }
  };

  const cancel = async () => {
    if (!job || !activeStatuses.has(job.status)) return;

    setIsCancelling(true);
    setError("");
    try {
      const response = await cancelGenerationJob(job.id);
      setJob(response.job);
    } catch (cancelError) {
      setError(toPublicApiError(cancelError, "Не удалось остановить генерацию."));
    } finally {
      setIsCancelling(false);
    }
  };

  const reset = () => {
    setJob(null);
    setArtifactUrl("");
    setError("");
    loadingArtifactRef.current = "";
    revokeArtifactUrl();
  };

  useEffect(() => {
    if (!job || !activeStatuses.has(job.status)) return undefined;

    const interval = window.setInterval(() => {
      void refresh();
    }, 4_000);

    return () => window.clearInterval(interval);
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (job?.status === "succeeded" && !artifactUrl) {
      void loadArtifact(job);
    }
  }, [job?.id, job?.status, artifactUrl]);

  useEffect(() => () => revokeArtifactUrl(), []);

  return {
    job,
    artifactUrl,
    isStarting,
    isCancelling,
    error,
    start,
    refresh,
    cancel,
    reset,
  };
}
