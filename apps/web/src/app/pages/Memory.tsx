import { useState } from "react";
import { motion } from "motion/react";
import { Search, Brain, Trash2, Edit2 } from "lucide-react";
import { useLanguage } from "../i18n";

export default function Memory() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  const memories = t.memory.items.map((item, index) => ({ ...item, id: index + 1 }));

  const filtered = memories.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-8 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-medium text-white mb-2 flex items-center gap-2">
              <Brain className="w-6 h-6 text-gray-400" />
              {t.memory.title}
            </h2>
            <p className="text-gray-400">{t.memory.subtitle}</p>
          </div>
          <button className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-lg transition-colors">
            {t.memory.clear}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder={t.memory.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0D0D0D] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* List */}
        <div className="space-y-3">
          {filtered.length > 0 ? (
            filtered.map((memory, index) => (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="group flex items-start justify-between gap-4 bg-[#0A0A0A] border border-white/5 hover:border-white/10 rounded-xl p-4 transition-colors"
              >
                <div>
                  <p className="text-gray-200 text-[15px]">{memory.text}</p>
                  <span className="text-xs text-gray-600 mt-2 block">{memory.date}</span>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 text-gray-500 hover:text-white transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              {t.memory.empty}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
