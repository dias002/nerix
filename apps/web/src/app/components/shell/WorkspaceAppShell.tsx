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
    const viewport = window.visualViewport;
    const updateHeight = () => {
      const height = Math.round(viewport?.height ?? window.innerHeight);
      document.documentElement.style.setProperty("--app-height", `${height}px`);
    };

    updateHeight();
    viewport?.addEventListener("resize", updateHeight);
    window.addEventListener("resize", updateHeight);

    return () => {
      delete document.documentElement.dataset.workspaceShell;
      document.documentElement.style.removeProperty("--app-height");
      viewport?.removeEventListener("resize", updateHeight);
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <div className="ns-workspace-shell relative flex overflow-hidden">
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
