import { Link } from "react-router";
import { motion } from "motion/react";
import { MessageSquarePlus, Pin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../i18n";
import { getChatConversations, type ChatConversationSummaryApiRecord } from "../api";

export default function History() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<ChatConversationSummaryApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filteredItems = items.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [item.title, item.preview, item.agentId].some((value) => value.toLowerCase().includes(query));
  });
  const pinned = filteredItems.slice(0, 1);
  const recent = filteredItems.slice(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getChatConversations()
      .then((response) => {
        if (!active) return;
        setItems(response.conversations);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить историю.");
        setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const renderItem = (item: ChatConversationSummaryApiRecord, index: number) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        to={`/workspace/chat?conversationId=${encodeURIComponent(item.id)}`}
        className="block rounded-2xl border border-white/5 bg-[#0A0A0A] p-4 transition-colors hover:border-white/15 hover:bg-[#101010]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-medium text-white">{item.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-500">{item.preview || "В чате пока нет сообщений."}</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-500">
            {item.agentId}
          </span>
        </div>
        <div className="mt-4 text-xs text-gray-600">
          {formatHistoryDate(item.updatedAt)} · {item.messagesCount} сообщений
        </div>
      </Link>
    </motion.div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-6 md:p-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-medium text-white">{t.history.title}</h2>
            <p className="mt-2 text-gray-400">{t.history.subtitle}</p>
          </div>
          <Link
            to="/workspace/chat?new=1"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            <MessageSquarePlus className="h-4 w-4" strokeWidth={1.8} />
            {t.history.newChat}
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder={t.history.search}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] py-3 pl-10 pr-4 text-white placeholder-gray-600 transition-colors focus:border-white/20 focus:outline-none"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>
        ) : null}

        {loading ? <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 text-sm text-gray-500">Загружаю историю...</div> : null}

        {pinned.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1 text-sm font-medium text-gray-500">
              <Pin className="h-4 w-4" strokeWidth={1.6} />
              {t.history.pinned}
            </div>
            {pinned.map(renderItem)}
          </section>
        ) : null}

        {recent.length > 0 ? (
          <section className="space-y-3">
            <div className="px-1 text-sm font-medium text-gray-500">{t.history.recent}</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {recent.map(renderItem)}
            </div>
          </section>
        ) : null}

        {!loading && filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-6 text-center text-sm text-gray-500">
            Реальных чатов пока нет.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}
