import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

type TimelineItemProps = {
  to: string;
  icon: LucideIcon;
  title: string;
  preview: string;
  meta: string;
};

export default function TimelineItem({ to, icon: Icon, title, preview, meta }: TimelineItemProps) {
  return (
    <Link to={to} className="ns-timeline-item group block p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-input)] bg-[var(--surface-2)] text-[var(--signal-blue)]">
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="truncate text-sm font-medium text-[var(--text-primary)]">{title}</h3>
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)] opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100" strokeWidth={1.8} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--text-secondary)]">{preview}</p>
          <p className="ns-caption mt-3">{meta}</p>
        </div>
      </div>
    </Link>
  );
}
