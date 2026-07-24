import { Check, Circle, Loader2, X } from "lucide-react";
import type { MediaGenerationJobApiRecord } from "../../api-client";

const labels = ["Подготовка", "Генерация", "Сохранение", "Готово"];

export default function VerticalProcessRail({ job }: { job: MediaGenerationJobApiRecord }) {
  const failed = job.status === "failed" || job.status === "refunded" || job.status === "cancelled";
  const activeIndex = job.status === "queued" ? 0 : job.status === "running" ? 1 : job.status === "succeeded" ? 4 : 1;

  return (
    <ol className="ns-process-rail" aria-live="polite" aria-label="Ход генерации">
      {labels.map((label, index) => {
        const state = failed && index === activeIndex
          ? "failed"
          : index < activeIndex
            ? "complete"
            : index === activeIndex
              ? "active"
              : "pending";

        return (
          <li key={label} className="ns-process-step" data-state={state}>
            <span className="ns-process-marker">
              {state === "complete" ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : null}
              {state === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : null}
              {state === "failed" ? <X className="h-3.5 w-3.5" strokeWidth={2} /> : null}
              {state === "pending" ? <Circle className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} /> : null}
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
