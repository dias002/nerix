import { languageOptions, useLanguage } from "../i18n";

type LanguageSwitchProps = {
  className?: string;
};

export default function LanguageSwitch({ className = "" }: LanguageSwitchProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur-md ${className}`}
      aria-label="Language"
    >
      {languageOptions.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLanguage(option.code)}
          className={`h-8 min-w-10 rounded-full px-3 text-xs font-medium transition-colors ${
            language === option.code
              ? "bg-white text-black"
              : "text-gray-400 hover:text-white"
          }`}
          aria-pressed={language === option.code}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
