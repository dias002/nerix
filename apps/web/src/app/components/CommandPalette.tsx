import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { LucideIcon } from "lucide-react";
import { CreditCard, FileText, FolderKanban, ImageIcon, MessageSquarePlus, Moon, Search, Settings, Sparkles, Sun, Video } from "lucide-react";
import { useTheme } from "../theme";

type CommandItem = {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  run: () => void;
};

export default function CommandPalette() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: "new-task",
        label: "Новая задача",
        hint: "Открыть чистый чат",
        icon: MessageSquarePlus,
        run: () => navigate("/workspace/chat?new=1"),
      },
      {
        id: "project",
        label: "Открыть проекты",
        hint: "Чаты, файлы и контекст в одном месте",
        icon: FolderKanban,
        run: () => navigate("/workspace/projects"),
      },
      {
        id: "apps",
        label: "Готовые инструменты",
        hint: "Перевод, промпты, SEO, озвучка",
        icon: Sparkles,
        run: () => navigate("/workspace/apps"),
      },
      {
        id: "image",
        label: "Создать изображение",
        hint: "Перейти к медиа-сценарию",
        icon: ImageIcon,
        run: () => navigate("/workspace/media/image"),
      },
      {
        id: "video",
        label: "Создать видео",
        hint: "Сценарий, кадры и промпт",
        icon: Video,
        run: () => navigate("/workspace/media/video"),
      },
      {
        id: "document",
        label: "Загрузить документ",
        hint: "Открыть чат с вложением",
        icon: FileText,
        run: () => navigate("/workspace/chat?agent=documents"),
      },
      {
        id: "billing",
        label: "Открыть подписку",
        hint: "Тарифы, баланс и операции",
        icon: CreditCard,
        run: () => navigate("/workspace/balance"),
      },
      {
        id: "theme",
        label: theme === "dark" ? "Включить светлую тему" : "Включить темную тему",
        hint: "Переключить оформление интерфейса",
        icon: theme === "dark" ? Sun : Moon,
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
      {
        id: "settings",
        label: "Открыть настройки",
        hint: "Профиль, страна, язык и уведомления",
        icon: Settings,
        run: () => navigate("/workspace/settings"),
      },
    ],
    [navigate, setTheme, theme],
  );

  const visibleCommands = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return commands;
    return commands.filter((command) => normalize(`${command.label} ${command.hint}`).includes(normalized));
  }, [commands, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/65 px-3 pt-20 backdrop-blur-sm sm:px-6" role="presentation" onMouseDown={() => setOpen(false)}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Командная палитра"
        className="mx-auto w-full max-w-2xl overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-active)] bg-[var(--background-secondary)] text-[var(--text-primary)] shadow-2xl shadow-black/60"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.8} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
            placeholder="Найти команду, страницу или инструмент"
          />
          <kbd className="hidden rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-tertiary)] sm:block">
            Esc
          </kbd>
        </div>

        <div className="custom-scrollbar max-h-[22rem] overflow-y-auto p-2">
          {visibleCommands.map((command) => {
            const Icon = command.icon;
            return (
              <button
                key={command.id}
                type="button"
                onClick={() => {
                  command.run();
                  setOpen(false);
                }}
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[var(--radius-medium)] px-3 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)]"
              >
                <span className="nd-icon-tile h-9 w-9" data-accent={command.id === "image" || command.id === "theme" ? "blue" : "orange"}>
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--text-primary)]">{command.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--text-tertiary)]">{command.hint}</span>
                </span>
                <span className="text-xs text-[var(--text-disabled)]">Enter</span>
              </button>
            );
          })}
          {visibleCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">Команда не найдена</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function normalize(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}
