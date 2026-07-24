import { Gauge, Info, SlidersHorizontal, Zap } from "lucide-react";

type ModelReasonProps = {
  label: string;
  reason: string;
  speed: string;
  cost: string;
  bestFor: string;
  isAuto: boolean;
  onChange: () => void;
};

export default function ModelReason({ label, reason, speed, cost, bestFor, isAuto, onChange }: ModelReasonProps) {
  return (
    <section className="nd-model-reason rounded-[var(--radius-large)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3 text-left shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="nd-pill nd-pill-blue px-2.5 py-1 text-xs">
              <Zap className="h-3.5 w-3.5" strokeWidth={1.8} />
              {isAuto ? "Auto-подбор" : "Выбрана модель"}
            </span>
            <span className="truncate text-sm font-medium text-[var(--text-primary)]">{label}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{reason}</p>
        </div>
        <button
          type="button"
          onClick={onChange}
          className="nd-secondary-action inline-flex h-10 shrink-0 items-center justify-center gap-2 px-3 text-sm"
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
          Изменить
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <ReasonStat icon={Gauge} label="Скорость" value={speed} />
        <ReasonStat icon={Info} label="Расход" value={cost} />
        <ReasonStat icon={Zap} label="Лучше всего" value={bestFor} />
      </div>
    </section>
  );
}

function ReasonStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-small)] border border-[var(--border-subtle)] bg-black/20 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
        {label}
      </div>
      <div className="mt-1 truncate text-sm text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
