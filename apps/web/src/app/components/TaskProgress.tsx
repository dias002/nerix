import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CircleDashed, Clock3 } from "lucide-react";

export type TaskProgressStatus = "pending" | "running" | "completed" | "warning" | "failed" | "skipped";

export type TaskProgressStep = {
  id: string;
  label: string;
  status: TaskProgressStatus;
  detail?: string;
};

type TaskProgressProps = {
  title?: string;
  steps: TaskProgressStep[];
  startedAt?: number;
};

export default function TaskProgress({ title = "Nomdu работает над задачей", steps, startedAt }: TaskProgressProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <section className="nd-card max-w-[38rem] p-4" aria-live="polite" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-[var(--text-primary)]">{title}</div>
        {startedAt ? (
          <div className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
            <Clock3 className="h-3.5 w-3.5" strokeWidth={1.7} />
            {Math.max(0, Math.round((now - startedAt) / 1000))} сек
          </div>
        ) : null}
      </div>
      <div className="mt-3 space-y-2">
        {steps.map((step) => (
          <div key={step.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-[var(--radius-small)] bg-black/20 px-3 py-2">
            <StepIcon status={step.status} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--text-primary)]">{step.label}</span>
                <span className="text-xs text-[var(--text-tertiary)]">{statusLabel(step.status)}</span>
              </div>
              {step.detail ? <div className="mt-0.5 text-xs leading-relaxed text-[var(--text-tertiary)]">{step.detail}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StepIcon({ status }: { status: TaskProgressStatus }) {
  if (status === "completed") return <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--success)]" strokeWidth={1.8} />;
  if (status === "failed" || status === "warning") return <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--warning)]" strokeWidth={1.8} />;
  return (
    <CircleDashed
      className={`mt-0.5 h-4 w-4 ${status === "running" ? "animate-spin text-[var(--accent-primary)]" : "text-[var(--text-disabled)]"}`}
      strokeWidth={1.8}
    />
  );
}

function statusLabel(status: TaskProgressStatus) {
  if (status === "completed") return "готово";
  if (status === "running") return "выполняется";
  if (status === "warning") return "нужно внимание";
  if (status === "failed") return "ошибка";
  if (status === "skipped") return "пропущено";
  return "ожидает";
}
