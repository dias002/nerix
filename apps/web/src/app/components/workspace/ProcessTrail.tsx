export type ProcessTrailStepState = "pending" | "running" | "completed" | "warning" | "failed" | "skipped";

export type ProcessTrailStep = {
  id: string;
  label: string;
  status: ProcessTrailStepState;
  detail?: string;
};

type ProcessTrailProps = {
  steps: ProcessTrailStep[];
  compact?: boolean;
};

export default function ProcessTrail({ steps, compact = false }: ProcessTrailProps) {
  if (steps.length === 0) return null;

  return (
    <div className="ns-process-trail" aria-label="Этапы выполнения задачи">
      {steps.map((step) => (
        <div key={step.id} className="ns-process-step" data-state={step.status}>
          <span className={compact ? "sr-only" : "truncate text-[11px] font-medium"}>{step.label}</span>
          {step.detail && !compact ? <span className="truncate text-[11px] text-[var(--text-tertiary)]">{step.detail}</span> : null}
        </div>
      ))}
    </div>
  );
}
