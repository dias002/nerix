import { CheckCircle2, CircleDot, MessageSquare, Trash2 } from "lucide-react";
import type { UserProjectStatus } from "../../api";

type ProjectCardProps = {
  title: string;
  description: string;
  typeLabel: string;
  status: UserProjectStatus;
  updatedAt: string;
  compact?: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onStatusChange: (status: UserProjectStatus) => void;
};

export default function ProjectCard({
  title,
  description,
  typeLabel,
  status,
  updatedAt,
  compact = false,
  onOpen,
  onDelete,
  onStatusChange,
}: ProjectCardProps) {
  const done = status === "done";

  return (
    <article className={`ns-project-card ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--positive)]" strokeWidth={1.8} />
            ) : (
              <CircleDot className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.8} />
            )}
            <h3 className="truncate text-[17px] font-medium leading-snug text-[var(--text-primary)]">{title}</h3>
          </div>
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a href={`/workspace/search?tag=${encodeURIComponent(typeLabel)}`} className="ns-search-tag min-h-11 min-w-11 justify-center">
          #{typeLabel}
        </a>
        <span className="ns-caption ml-auto">Обновлено: {updatedAt}</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`project-status-${title}`}>
          Статус проекта
        </label>
        <select
          id={`project-status-${title}`}
          value={status}
          onChange={(event) => onStatusChange(event.target.value as UserProjectStatus)}
          className="h-10 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text-primary)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--signal-mint)] focus-visible:outline-offset-2"
        >
          <option value="planned">Запланировано</option>
          <option value="active">В работе</option>
          <option value="done">Готово</option>
        </select>
        <button type="button" onClick={onOpen} className="ns-shell-button h-11 px-3">
          <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
          В чат
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ns-shell-button ml-auto h-11 w-11 hover:text-[var(--danger)]"
          aria-label="Удалить проект"
          title="Удалить проект"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>
    </article>
  );
}
