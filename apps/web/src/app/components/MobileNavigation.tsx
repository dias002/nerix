import { Link, useLocation } from "react-router";
import { useState } from "react";
import { FileText, FolderKanban, Home, ImageIcon, MessageSquare, Mic, Plus, UserRound, Video } from "lucide-react";

const createActions = [
  { label: "Новая задача", to: "/workspace/chat?new=1", icon: MessageSquare },
  { label: "Документ", to: "/workspace/chat?agent=documents", icon: FileText },
  { label: "Изображение", to: "/workspace/media/image", icon: ImageIcon },
  { label: "Видео", to: "/workspace/media/video", icon: Video },
  { label: "Голос", to: "/workspace/media/voice", icon: Mic },
];

export default function MobileNavigation({ profileHref }: { profileHref: string }) {
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const nav = [
    { label: "Главная", to: "/workspace", icon: Home, active: location.pathname === "/workspace" || location.pathname === "/workspace/" },
    { label: "Чат", to: "/workspace/chat", icon: MessageSquare, active: location.pathname.startsWith("/workspace/chat") },
    { label: "Создать", to: "", icon: Plus, active: false, create: true },
    { label: "Проекты", to: "/workspace/projects", icon: FolderKanban, active: location.pathname.startsWith("/workspace/projects") },
    { label: "Профиль", to: profileHref, icon: UserRound, active: location.pathname.startsWith("/workspace/settings/profile") },
  ];

  return (
    <>
      <nav
        className="ns-mobile-navigation fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--background-secondary)]/95 px-2 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2 text-[var(--text-tertiary)] backdrop-blur md:hidden"
        aria-label="Основная мобильная навигация"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            if (item.create) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  aria-expanded={sheetOpen}
                  aria-controls="mobile-create-sheet"
                  className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--radius-medium)] text-[var(--text-primary)] transition-colors active:bg-[var(--surface-hover)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--background-primary)]">
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <span className="text-[11px] font-medium">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--radius-medium)] text-[11px] font-medium transition-colors active:bg-[var(--surface-hover)] ${
                  item.active ? "text-[var(--accent-primary)]" : "text-[var(--text-tertiary)]"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {sheetOpen ? (
        <div className="fixed inset-0 z-[75] bg-black/55 md:hidden" onMouseDown={() => setSheetOpen(false)}>
          <section
            id="mobile-create-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Создать"
            className="absolute bottom-0 left-0 right-0 rounded-t-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--background-secondary)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[var(--text-primary)] shadow-2xl shadow-black/60"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-active)]" />
            <h2 className="px-1 text-lg font-medium">Создать</h2>
            <div className="mt-4 grid gap-2">
              {createActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    to={action.to}
                    onClick={() => setSheetOpen(false)}
                    className="flex min-h-12 items-center gap-3 rounded-[var(--radius-medium)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-3 text-sm text-[var(--text-primary)]"
                  >
                    <span className="nd-icon-tile h-8 w-8" data-accent={action.label === "Изображение" ? "blue" : "orange"}>
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    {action.label}
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
