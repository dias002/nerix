import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Bot, Briefcase, Code, GraduationCap, FileText, ArrowRight } from "lucide-react";
import { useLanguage } from "../i18n";

export default function Agents() {
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const icons = [Bot, Briefcase, Code, GraduationCap, FileText];
  const ids = ["general", "business", "code", "study", "docs"];
  const agents = t.agents.items.map((agent, index) => ({
    ...agent,
    id: ids[index],
    icon: icons[index],
  }));
  const selectedAgent = agents[selectedIndex];
  const SelectedIcon = selectedAgent.icon;

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-8 md:p-12">
      <div className="max-w-6xl mx-auto space-y-10">
        <div>
          <h2 className="text-2xl font-medium text-white mb-2">{t.agents.title}</h2>
          <p className="text-gray-400">{t.agents.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {agents.map((agent, index) => (
              <motion.button
                key={agent.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className={`group flex h-full flex-col rounded-2xl border p-6 text-left transition-all ${
                  selectedIndex === index
                    ? "border-white/20 bg-[#121212]"
                    : "border-white/5 bg-[#0D0D0D] hover:border-white/20"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-5 text-gray-300">
                  <agent.icon className="w-5 h-5" />
                </div>
                
                <h3 className="text-lg font-medium text-white mb-2">{agent.title}</h3>
                <p className="text-sm text-gray-500 mb-6 flex-1 leading-relaxed">
                  {agent.description}
                </p>
                
                <span className="flex items-center text-sm font-medium text-gray-400 group-hover:text-white transition-colors mt-auto w-fit">
                  {t.common.choose}
                  <ArrowRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </span>
              </motion.button>
            ))}
          </div>

          <motion.aside
            key={selectedAgent.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-6 lg:sticky lg:top-8 lg:self-start"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                <SelectedIcon className="h-6 w-6" strokeWidth={1.6} />
              </div>
              <div>
                <div className="text-xs text-gray-500">{t.agents.profileTitle}</div>
                <h3 className="mt-1 text-2xl font-medium text-white">{selectedAgent.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{t.agents.profileSubtitle}</p>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <h4 className="mb-3 text-sm font-medium text-gray-400">{t.agents.strengthsTitle}</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.strengths.map((item) => (
                    <span key={item} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-gray-300">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-medium text-gray-400">{t.agents.examplesTitle}</h4>
                <div className="space-y-2">
                  {selectedAgent.examples.map((item) => (
                    <div key={item} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-gray-400">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <Link
                to={`/workspace/chat?agent=${selectedAgent.id}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              >
                {t.agents.openChat}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
