import type { ReactNode } from "react";
import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  text: string;
  actions?: EmptyStateAction[];
  examples?: string[];
  children?: ReactNode;
};

export default function EmptyState({
  icon: Icon,
  title,
  text,
  actions = [],
  examples = [],
  children,
}: EmptyStateProps) {
  return (
    <section className="nd-empty-state mx-auto w-full max-w-2xl rounded-[var(--radius-large)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5 text-center shadow-[var(--shadow-soft)] sm:p-6">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radius-medium)] border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--accent-primary)]">
        <Icon className="h-5 w-5" strokeWidth={1.7} />
      </div>
      <h2 className="mt-4 text-xl font-medium tracking-normal text-[var(--text-primary)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{text}</p>

      {examples.length > 0 ? (
        <div className="mt-5 grid gap-2 text-left sm:grid-cols-3">
          {examples.map((example) => (
            <div
              key={example}
              className="rounded-[var(--radius-small)] border border-[var(--border-subtle)] bg-black/20 px-3 py-2 text-sm leading-snug text-[var(--text-secondary)]"
            >
              {example}
            </div>
          ))}
        </div>
      ) : null}

      {children}

      {actions.length > 0 ? (
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          {actions.map((action, index) => {
            const className =
              index === 0
                ? "nd-primary-action inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-medium"
                : "nd-secondary-action inline-flex h-11 items-center justify-center gap-2 px-4 text-sm";

            if (action.href) {
              return (
                <Link key={action.label} to={action.href} className={className}>
                  {action.label}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </Link>
              );
            }

            return (
              <button key={action.label} type="button" onClick={action.onClick} className={className}>
                {action.label}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
