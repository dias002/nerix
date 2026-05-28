import { motion } from "motion/react";
import { User, Palette, Bell, Globe, Shield, ChevronRight } from "lucide-react";
import LanguageSwitch from "../components/LanguageSwitch";
import { useLanguage } from "../i18n";

export default function Settings() {
  const { t } = useLanguage();
  const settingsGroups = [
    {
      title: t.settings.main,
      items: [
        { id: "profile", label: t.settings.profile, icon: User },
        { id: "appearance", label: t.settings.appearance, icon: Palette },
        { id: "notifications", label: t.settings.notifications, icon: Bell },
      ]
    },
    {
      title: t.settings.extra,
      items: [
        { id: "language", label: t.settings.language, icon: Globe },
        { id: "security", label: t.settings.security, icon: Shield },
      ]
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-8 md:p-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <h2 className="text-2xl font-medium text-white mb-2">{t.settings.title}</h2>
          <p className="text-gray-400">{t.settings.subtitle}</p>
        </div>

        <div className="space-y-8">
          {settingsGroups.map((group, groupIdx) => (
            <div key={group.title}>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-3 px-2">
                {group.title}
              </h3>
              <div className="bg-[#0D0D0D] border border-white/10 rounded-2xl overflow-hidden">
                {group.items.map((item, itemIdx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: (groupIdx * 3 + itemIdx) * 0.05 }}
                    className={`w-full flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-white/5 transition-colors text-left ${
                      itemIdx !== group.items.length - 1 ? "border-b border-white/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-200">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.id === "language" ? (
                        <LanguageSwitch />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
