import { Link } from "react-router";
import { MessageSquare, MessageSquarePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n";
import type { ChatConversationSummaryApiRecord } from "../api-client";
import { getChatConversations } from "../api-client/chat";
import { useAuth } from "../auth";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/workspace/PageHeader";
import SearchField from "../components/workspace/SearchField";
import TimelineItem from "../components/workspace/TimelineItem";

export default function History() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<ChatConversationSummaryApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setItems([]);
      setError(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    getChatConversations()
      .then((response) => {
        if (!active) return;
        setItems(response.conversations);
      })
      .catch(() => {
        if (!active) return;
        setError("Не удалось загрузить историю. Попробуйте обновить страницу.");
        setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);

    return items.filter((item) => {
      if (!normalizedQuery) return true;

      const haystack = normalizeSearchText([item.title, item.preview, item.agentId, formatHistoryDate(item.updatedAt)].join(" "));
      return normalizedQuery.split(" ").every((word) => haystack.includes(word));
    });
  }, [items, searchQuery]);

  const groups = useMemo(() => groupHistory(filteredItems), [filteredItems]);
  const isSearching = Boolean(normalizeSearchText(searchQuery));

  return (
    <div className="ns-page-scroll">
      <main className="ns-page-text space-y-8">
        <PageHeader
          overline="История"
          title={t.history.title}
          subtitle={t.history.subtitle}
          actions={
            <Link to="/workspace/chat?new=1" className="nd-primary-action inline-flex h-11 items-center gap-2 px-5 text-sm font-medium">
              <MessageSquarePlus className="h-4 w-4" strokeWidth={1.8} />
              {t.history.newChat}
            </Link>
          }
        />

        <section>
          <SearchField value={searchQuery} onChange={setSearchQuery} placeholder={t.history.search} />
        </section>

        {error ? <div className="rounded-[var(--radius-card)] border border-[rgba(255,123,146,0.22)] bg-[rgba(255,123,146,0.08)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div> : null}

        {loading ? (
          <section className="space-y-3" aria-label="Загрузка истории">
            {[0, 1, 2].map((item) => (
              <div key={item} className="ns-timeline-item p-4">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-[var(--radius-input)] bg-[var(--surface-2)]" />
                  <div className="flex-1 space-y-3">
                    <div className="h-3 w-2/5 rounded-full bg-[var(--surface-3)]" />
                    <div className="h-3 w-4/5 rounded-full bg-[var(--surface-2)]" />
                    <div className="h-3 w-1/3 rounded-full bg-[var(--surface-2)]" />
                  </div>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {!loading && groups.length > 0 ? (
          <section className="space-y-7">
            {groups.map((group) => (
              <div key={group.label} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--line-subtle)]" />
                  <p className="ns-caption uppercase tracking-[0.12em]">{group.label}</p>
                  <div className="h-px flex-1 bg-[var(--line-subtle)]" />
                </div>
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <TimelineItem
                      key={item.id}
                      to={`/workspace/chat?conversationId=${encodeURIComponent(item.id)}`}
                      icon={MessageSquare}
                      title={item.title}
                      preview={item.preview || "В чате пока нет сообщений."}
                      meta={`${formatHistoryDate(item.updatedAt)} · ${item.messagesCount} сообщений`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {!loading && filteredItems.length === 0 ? (
          <EmptyState
            icon={MessageSquarePlus}
            title={isSearching ? "Ничего не найдено" : "Здесь появятся ваши задачи"}
            text={
              isSearching
                ? "Измените запрос. Поиск работает по названию, тексту и дате сохраненных чатов."
                : "Начните с одного рабочего сценария. После ответа чат сохранится здесь, и к нему можно будет вернуться."
            }
            examples={isSearching ? ["документ", "презентация", "проект"] : ["Проверить документ", "Создать изображение", "Изучить тему"]}
            actions={isSearching ? [] : [{ label: t.history.newChat, href: "/workspace/chat?new=1" }]}
          />
        ) : null}
      </main>
    </div>
  );
}

function groupHistory(items: ChatConversationSummaryApiRecord[]) {
  const groups = new Map<string, ChatConversationSummaryApiRecord[]>();

  items.forEach((item) => {
    const label = formatGroupDate(item.updatedAt);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  });

  return Array.from(groups.entries()).map(([label, groupItems]) => ({
    label,
    items: groupItems,
  }));
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatGroupDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(date, today)) return "Сегодня";
  if (sameDay(date, yesterday)) return "Вчера";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
  }).format(date);
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}
