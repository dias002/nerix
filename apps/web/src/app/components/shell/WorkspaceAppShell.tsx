import type { ReactNode } from "react";
import { useEffect } from "react";

export default function WorkspaceAppShell({
  sidebar,
  topbar,
  sidebarCollapsed,
  children,
  commandPalette,
  mobileNavigation,
  overlays,
}: {
  sidebar: ReactNode;
  topbar: ReactNode;
  sidebarCollapsed: boolean;
  children: ReactNode;
  commandPalette?: ReactNode;
  mobileNavigation?: ReactNode;
  overlays?: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.dataset.workspaceShell = "true";

    return () => {
      delete document.documentElement.dataset.workspaceShell;
    };
  }, []);

  return (
    <div className="ns-workspace-shell flex min-h-screen relative overflow-hidden">
      {sidebar}
      <main className="ns-shell-main" data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}>
        {topbar}
        <div className="ns-shell-content">{children}</div>
      </main>
      {commandPalette}
      {mobileNavigation}
      {overlays}
    </div>
  );
}
