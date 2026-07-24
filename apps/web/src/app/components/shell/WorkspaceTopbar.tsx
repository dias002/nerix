import { Activity, CircleHelp, Sparkles, UserRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import LanguageSwitch from "../LanguageSwitch";

export default function WorkspaceTopbar({
  title,
  section,
  showModelContext,
  profileAvatar,
  profileLabel,
  profileHref,
  showProfileButton,
}: {
  title: string;
  section: string;
  showModelContext: boolean;
  profileAvatar: string | null;
  profileLabel: string;
  profileHref: string;
  showProfileButton: boolean;
}) {
  const [tasksNoticeOpen, setTasksNoticeOpen] = useState(false);

  return (
    <header className="ns-topbar" aria-label="Верхняя панель рабочего пространства">
      <div className="ns-topbar-context">
        <div className="ns-overline truncate">{section}</div>
        <div className="mt-1 truncate text-sm font-medium text-[var(--text-primary)]">{title}</div>
      </div>

      <div className="ns-topbar-actions">
        {showModelContext ? (
          <Link to="/workspace/chat" className="ns-shell-button ns-desktop-only" aria-label="Контекст модели Nomdu Auto">
            <Sparkles className="h-4 w-4 text-[var(--signal-mint)]" strokeWidth={1.8} />
            <span className="hidden lg:inline">Nomdu Auto</span>
          </Link>
        ) : null}
        <div
          className="relative hidden md:block"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTasksNoticeOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setTasksNoticeOpen(false);
          }}
        >
          <button
            type="button"
            className="ns-shell-button"
            aria-label="Активные задачи"
            aria-expanded={tasksNoticeOpen}
            aria-controls="active-tasks-notice"
            title="Активные задачи"
            onClick={() => setTasksNoticeOpen((open) => !open)}
          >
            <span className="ns-signal-dot" aria-hidden="true" />
            <Activity className="h-4 w-4" strokeWidth={1.8} />
          </button>
          {tasksNoticeOpen ? (
            <div
              id="active-tasks-notice"
              role="status"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 whitespace-nowrap rounded-[var(--radius-control)] border border-[var(--line-default)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)] shadow-[var(--shadow-popover)]"
            >
              Активные задачи · Скоро
            </div>
          ) : null}
        </div>
        <Link to="/support" className="ns-shell-button ns-desktop-only" aria-label="Поддержка" title="Поддержка">
          <CircleHelp className="h-4 w-4" strokeWidth={1.8} />
        </Link>
        <LanguageSwitch />
        {showProfileButton ? (
          <Link to={profileHref} className="ns-shell-button px-2" aria-label="Профиль">
            {profileAvatar ? (
              <img src={profileAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <UserRound className="h-4 w-4" strokeWidth={1.8} />
            )}
            <span className="hidden max-w-36 truncate text-sm lg:inline">{profileLabel}</span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
