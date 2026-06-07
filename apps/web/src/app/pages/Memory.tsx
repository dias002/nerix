import { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Brain, Search } from "lucide-react";
import { getMemoryItems, type MemoryItemApiRecord } from "../api";
import { useLanguage } from "../i18n";

export default function Memory() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [memories, setMemories] = useState<MemoryItemApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getMemoryItems()
      .then((response) => {
        if (!active) return;
        setMemories(response.items);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить память.");
        setMemories([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = memories.filter((memory) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [memory.title, memory.content, memory.source ?? ""].some((value) => value.toLowerCase().includes(query));
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-8 md:p-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-2xl font-medium text-white">
              <Brain className="h-6 w-6 text-gray-400" />
              {t.memory.title}
            </h2>
            <p className="text-gray-400">{t.memory.subtitle}</p>
          </div>
          <div className="rounded-full border border-white/10 px-3 py-1 text-sm text-gray-500">
            {memories.length} записей
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder={t.memory.search}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] py-3 pl-10 pr-4 text-white placeholder-gray-600 transition-colors focus:border-white/20 focus:outline-none"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>
        ) : null}

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 text-sm text-gray-500">
              Загружаю память...
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((memory, index) => (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="rounded-xl border border-white/5 bg-[#0A0A0A] p-4 transition-colors hover:border-white/10"
              >
                <Link
                  to={`/workspace/chat?prompt=${encodeURIComponent(memory.content)}`}
                  className="block rounded-lg transition-colors hover:text-white"
                >
                  <h3 className="text-base font-medium text-white">{memory.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-gray-300">{memory.content}</p>
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {memory.source ? <span>{memory.source}</span> : null}
                  <span>{formatMemoryDate(memory.updatedAt)}</span>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-12 text-center text-gray-500">Реальных записей памяти пока нет.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMemoryDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
