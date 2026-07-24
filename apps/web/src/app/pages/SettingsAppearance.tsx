import { Moon, Sun, Type } from "lucide-react";
import { useLanguage } from "../i18n";
import { SettingsDetailShell } from "./SettingsProfile";
import { useTheme, type AppearanceMode, type FontSizeMode } from "../theme";

export default function SettingsAppearance() {
  const { t } = useLanguage();
  const { theme, setTheme, fontSize, setFontSize } = useTheme();

  const modes = [
    { id: "dark" as const, label: t.settings.dark, icon: Moon },
    { id: "light" as const, label: t.settings.light, icon: Sun },
  ];
  const fontSizes = [
    { id: "compact" as const, label: t.settings.compact, description: t.settings.compactHint },
    { id: "comfortable" as const, label: t.settings.comfortable, description: t.settings.comfortableHint },
    { id: "large" as const, label: t.settings.large, description: t.settings.largeHint },
  ];

  const selectMode = (nextMode: AppearanceMode) => {
    setTheme(nextMode);
  };

  const selectFontSize = (nextFontSize: FontSizeMode) => {
    setFontSize(nextFontSize);
  };

  return (
    <SettingsDetailShell title={t.settings.appearance} subtitle={t.settings.appearanceSubtitle}>
      <section>
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
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
          <Type className="h-4 w-4" strokeWidth={1.7} />
          {t.settings.fontSize}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {fontSizes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectFontSize(item.id)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                fontSize === item.id
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/10 bg-[#0D0D0D] text-gray-400 hover:border-white/20 hover:text-white"
              }`}
              aria-pressed={fontSize === item.id}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-500">{item.description}</span>
            </button>
          ))}
        </div>
      </section>

    </SettingsDetailShell>
  );
}
