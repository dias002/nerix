const preloadWorkspaceLayout = () => import("./components/WorkspaceLayout");
const preloadChat = () => import("./pages/Chat");
const preloadApps = () => import("./pages/Apps");
const preloadMedia = () => import("./pages/Media");
const preloadProjects = () => import("./pages/Projects");
const preloadHistory = () => import("./pages/History");
const preloadBalance = () => import("./pages/Balance");
const preloadSettings = () => import("./pages/Settings");

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export function preloadWorkspaceChat() {
  void preloadWorkspaceLayout();
  void preloadChat();
}

export function preloadWorkspaceCommon() {
  stagger([
    preloadChat,
    preloadApps,
    preloadMedia,
    preloadProjects,
    preloadHistory,
    preloadBalance,
    preloadSettings,
  ]);
}

export function preloadWorkspaceRoute(path: string) {
  if (path.startsWith("/workspace/chat")) return void preloadChat();
  if (path.startsWith("/workspace/apps")) return void preloadApps();
  if (path.startsWith("/workspace/media")) return void preloadMedia();
  if (path.startsWith("/workspace/projects")) return void preloadProjects();
  if (path.startsWith("/workspace/history")) return void preloadHistory();
  if (path.startsWith("/workspace/balance")) return void preloadBalance();
  if (path.startsWith("/workspace/settings")) return void preloadSettings();
}

export function runWhenIdle(callback: () => void, timeout = 1800) {
  if (typeof window === "undefined") return () => undefined;

  const idleWindow = window as IdleWindow;
  let cancelled = false;
  const run = () => {
    if (!cancelled) callback();
  };

  if (typeof idleWindow.requestIdleCallback === "function") {
    const id = idleWindow.requestIdleCallback(run, { timeout });
    return () => {
      cancelled = true;
      idleWindow.cancelIdleCallback?.(id);
    };
  }

  const id = window.setTimeout(run, timeout);
  return () => {
    cancelled = true;
    window.clearTimeout(id);
  };
}

function stagger(loaders: Array<() => Promise<unknown>>) {
  loaders.forEach((loader, index) => {
    window.setTimeout(() => {
      void loader();
    }, index * 220);
  });
}
