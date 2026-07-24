import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaGenerationJobApiRecord } from "../api-client";
import {
  cancelGenerationJob,
  createGenerationJob,
  fetchGenerationArtifact,
  refreshGenerationJob,
} from "../api-client/generation";
import { toPublicApiError } from "../api-client/transport";

type GenerationInput = Parameters<typeof createGenerationJob>[0];

export type MediaTurn = {
  id: string;
  prompt: string;
  job: MediaGenerationJobApiRecord;
  artifactUrl?: string;
  isCancelling?: boolean;
};

const activeStatuses = new Set<MediaGenerationJobApiRecord["status"]>(["queued", "running"]);

export function useMediaConversation() {
  const [turns, setTurns] = useState<MediaTurn[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const objectUrls = useRef(new Map<string, string>());
  const loadingArtifacts = useRef(new Set<string>());
  const activeIds = useMemo(
    () => turns.filter((turn) => activeStatuses.has(turn.job.status)).map((turn) => turn.job.id),
    [turns],
  );
  const activeKey = activeIds.join(",");

  const loadArtifact = async (job: MediaGenerationJobApiRecord) => {
    if (job.status !== "succeeded" || objectUrls.current.has(job.id) || loadingArtifacts.current.has(job.id)) return;
    loadingArtifacts.current.add(job.id);

    try {
      const blob = await fetchGenerationArtifact(job.id);
      const url = URL.createObjectURL(blob);
      objectUrls.current.set(job.id, url);
      setTurns((current) => current.map((turn) => turn.job.id === job.id ? { ...turn, artifactUrl: url } : turn));
    } catch (artifactError) {
      setError(toPublicApiError(artifactError, "Результат готов, но файл не удалось загрузить."));
    } finally {
      loadingArtifacts.current.delete(job.id);
    }
  };

  const start = async (input: GenerationInput, visiblePrompt: string) => {
    setIsStarting(true);
    setError("");
    try {
      const response = await createGenerationJob(input);
      const turn: MediaTurn = { id: response.job.id, prompt: visiblePrompt, job: response.job };
      setTurns((current) => [...current, turn]);
      await loadArtifact(response.job);
      return response.job;
    } catch (startError) {
      setError(toPublicApiError(startError, "Не удалось запустить генерацию."));
      return null;
    } finally {
      setIsStarting(false);
    }
  };

  const cancel = async (jobId: string) => {
    setTurns((current) => current.map((turn) => turn.job.id === jobId ? { ...turn, isCancelling: true } : turn));
    try {
      const response = await cancelGenerationJob(jobId);
      setTurns((current) => current.map((turn) => turn.job.id === jobId
        ? { ...turn, job: response.job, isCancelling: false }
        : turn));
    } catch (cancelError) {
      setError(toPublicApiError(cancelError, "Не удалось остановить генерацию."));
      setTurns((current) => current.map((turn) => turn.job.id === jobId ? { ...turn, isCancelling: false } : turn));
    }
  };

  useEffect(() => {
    if (!activeKey) return undefined;

    const refresh = async () => {
      const ids = activeKey.split(",").filter(Boolean);
      await Promise.all(ids.map(async (jobId) => {
        try {
          const response = await refreshGenerationJob(jobId);
          setTurns((current) => current.map((turn) => turn.job.id === jobId ? { ...turn, job: response.job } : turn));
          await loadArtifact(response.job);
        } catch (refreshError) {
          setError(toPublicApiError(refreshError, "Не удалось обновить статус генерации."));
        }
      }));
    };

    const interval = window.setInterval(() => void refresh(), 4_000);
    return () => window.clearInterval(interval);
  }, [activeKey]);

  useEffect(() => () => {
    for (const url of objectUrls.current.values()) URL.revokeObjectURL(url);
    objectUrls.current.clear();
  }, []);

  return {
    turns,
    isStarting,
    hasActiveJob: activeIds.length > 0,
    error,
    start,
    cancel,
  };
}
