import type { ReactNode } from "react";

type PageHeaderProps = {
  overline?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export default function PageHeader({ overline, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="ns-page-header">
      <div className="ns-page-header-copy">
        {overline ? <p className="ns-overline">{overline}</p> : null}
        <h1 className="ns-page-title mt-2">{title}</h1>
        {subtitle ? <p className="ns-body mt-3 max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ns-page-header-actions">{actions}</div> : null}
    </header>
  );
}
