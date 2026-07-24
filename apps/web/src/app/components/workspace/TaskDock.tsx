import { PauseCircle } from "lucide-react";
import ProcessTrail, { type ProcessTrailStep } from "./ProcessTrail";

export type TaskDockItem = {
  id: string;
  title: string;
  subtitle?: string;
  status: "queued" | "running" | "completed" | "failed";
  model?: string;
  progress?: number;
  steps?: ProcessTrailStep[];
  onOpen?: () => void;
  onCancel?: () => void;
};

type TaskDockProps = {
  items: TaskDockItem[];
};

export default function TaskDock({ items }: TaskDockProps) {
  const item = items[0];
  if (!item) return null;

  return (
    <aside className="ns-task-dock" role="status" aria-live="polite">
      <div className="flex items-center gap-3 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-input)] bg-[var(--surface-3)]">
          <span className="ns-signal-dot" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-medium">{item.title}</p>
            {item.model ? <span className="ns-caption shrink-0">{item.model}</span> : null}
          </div>
          {item.subtitle ? <p className="ns-caption mt-0.5 truncate">{item.subtitle}</p> : null}
        </div>

        {item.onOpen ? (
          <button type="button" onClick={item.onOpen} className="ns-shell-button h-9 px-3 text-xs">
            Открыть
          </button>
        ) : null}
        {item.onCancel ? (
          <button
            type="button"
            onClick={item.onCancel}
            className="ns-shell-button h-9 w-9"
            aria-label="Остановить задачу"
            title="Остановить задачу"
          >
            <PauseCircle className="h-4 w-4" strokeWidth={1.8} />
          </button>
        ) : null}
      </div>

      {item.progress !== undefined ? (
        <div className="px-3 pb-2">
          <div className="ns-usage-progress">
            <span style={{ width: `${Math.max(4, Math.min(100, item.progress))}%` }} />
          </div>
        </div>
      ) : null}

      {item.steps?.length ? (
        <div className="border-t border-[var(--line-subtle)] px-3 py-3">
          <ProcessTrail steps={item.steps} compact />
        </div>
      ) : null}
    </aside>
  );
}
