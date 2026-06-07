import { Moon, Sun } from "lucide-react";
import { useLanguage } from "../i18n";
import { SettingsDetailShell } from "./SettingsProfile";
import { useTheme, type AppearanceMode } from "../theme";

export default function SettingsAppearance() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();

  const modes = [
    { id: "dark" as const, label: t.settings.dark, icon: Moon },
    { id: "light" as const, label: t.settings.light, icon: Sun },
  ];

  const selectMode = (nextMode: AppearanceMode) => {
    setTheme(nextMode);
  };

  return (
    <SettingsDetailShell title={t.settings.appearance} subtitle={t.settings.appearanceSubtitle}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectMode(item.id)}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
              theme === item.id
                ? "border-white/25 bg-white/10 text-white"
                : "border-white/10 bg-[#0D0D0D] text-gray-400 hover:border-white/20 hover:text-white"
            }`}
            aria-pressed={theme === item.id}
          >
            <item.icon className="h-5 w-5" strokeWidth={1.6} />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </SettingsDetailShell>
  );
}
