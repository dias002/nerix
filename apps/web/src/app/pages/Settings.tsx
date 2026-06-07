import { motion } from "motion/react";
import { Link } from "react-router";
import { User, Bell, Globe, Shield, LogIn, LogOut, ChevronDown, ChevronRight, Check, Moon, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import { countryCodes, normalizeCountryCode, type CountryCode } from "@nerix/shared";
import { useAuth } from "../auth";
import LanguageSwitch from "../components/LanguageSwitch";
import { useLanguage } from "../i18n";
import { useTheme } from "../theme";

export default function Settings() {
  const { language, t } = useLanguage();
  const { isAuthenticated, logout, user } = useAuth();
  const { theme } = useTheme();
  const [countryOpen, setCountryOpen] = useState(false);
  const [country, setCountry] = useState<CountryCode>(() => {
    if (typeof window === "undefined") return "KZ";
    return normalizeCountryCode(window.localStorage.getItem("nerix-country") ?? "KZ");
  });
  const displayNames = useMemo(() => {
    const locale = language === "kk" ? "kk" : language;
    const IntlDisplayNames = (Intl as typeof Intl & {
      DisplayNames?: new (locales: string[], options: { type: "region" }) => { of: (code: string) => string | undefined };
    }).DisplayNames;

    return IntlDisplayNames ? new IntlDisplayNames([locale], { type: "region" }) : null;
  }, [language]);
  const countryOptions = useMemo(
    () =>
      countryCodes
        .map((code) => ({
          code,
          name: displayNames?.of(code) ?? code,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, language === "kk" ? "kk" : language)),
    [displayNames, language]
  );

  const handleCountryChange = (value: string) => {
    const nextCountry = normalizeCountryCode(value);
    setCountry(nextCountry);
    window.localStorage.setItem("nerix-country", nextCountry);
    setCountryOpen(false);
  };

  const selectedCountry = countryOptions.find((option) => option.code === country);

  const settingsGroups = [
    {
      title: t.settings.main,
      items: [
        { id: "profile", label: t.settings.profile, icon: User, value: user?.email ?? user?.name ?? t.auth.guest, path: "/workspace/settings/profile" },
        {
          id: "appearance",
          label: t.settings.appearance,
          icon: theme === "light" ? Sun : Moon,
          value: theme === "light" ? t.settings.light : t.settings.dark,
          path: "/workspace/settings/appearance",
        },
        { id: "notifications", label: t.settings.notifications, icon: Bell, value: t.settings.off, path: "/workspace/settings/notifications" },
      ]
    },
    {
      title: t.settings.extra,
      items: [
        { id: "language", label: t.settings.language, icon: Globe },
        { id: "country", label: t.settings.country, icon: Globe },
        { id: "security", label: t.settings.security, icon: Shield, value: isAuthenticated ? t.settings.protected : t.auth.guestHint },
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
              <div className="bg-[#0D0D0D] border border-white/10 rounded-2xl">
                {group.items.map((item, itemIdx) => {
                  const rowClassName = `relative w-full p-4 text-left transition-colors ${
                    itemIdx !== group.items.length - 1 ? "border-b border-white/5" : ""
                  }`;
                  const leftContent = (
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-200">{item.label}</span>
                    </div>
                  );

                  if (item.path) {
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: (groupIdx * 3 + itemIdx) * 0.05 }}
                      >
                        <Link
                          to={item.path}
                          className={`${rowClassName} flex flex-wrap items-center justify-between gap-3 hover:bg-white/[0.03]`}
                        >
                          {leftContent}
                          <span className="inline-flex min-w-0 max-w-[260px] items-center gap-2 text-sm text-gray-500">
                            <span className="truncate">{item.value}</span>
                            <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                          </span>
                        </Link>
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: (groupIdx * 3 + itemIdx) * 0.05 }}
                      className={rowClassName}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {leftContent}
                        {item.id === "language" ? (
                          <LanguageSwitch />
                        ) : item.id === "country" ? (
                          <div className="relative flex max-w-full flex-col items-end gap-1">
                            <button
                              type="button"
                              onClick={() => setCountryOpen((open) => !open)}
                              className="inline-flex max-w-[260px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition-colors hover:border-white/20 focus:border-white/30"
                            >
                              <span className="truncate">
                                {selectedCountry?.name ?? country} ({country})
                              </span>
                              <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${countryOpen ? "rotate-180" : ""}`} />
                            </button>
                            {countryOpen ? (
                              <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-xl border border-white/10 bg-[#080808] shadow-2xl shadow-black/60">
                                <div className="max-h-72 overflow-y-auto py-1 custom-scrollbar">
                                  {countryOptions.map((option) => (
                                    <button
                                      key={option.code}
                                      type="button"
                                      onClick={() => handleCountryChange(option.code)}
                                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                      <span className="truncate">{option.name} ({option.code})</span>
                                      {option.code === country ? (
                                        <Check className="h-4 w-4 shrink-0 text-white" strokeWidth={1.8} />
                                      ) : null}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            <span className="hidden max-w-[220px] text-right text-xs text-gray-600 sm:block">
                              {t.settings.countryHint}
                            </span>
                          </div>
                        ) : item.id === "security" && isAuthenticated ? (
                          <button
                            type="button"
                            onClick={logout}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                          >
                            <LogOut className="h-4 w-4" strokeWidth={1.6} />
                            {t.auth.logout}
                          </button>
                        ) : item.id === "security" ? (
                          <Link
                            to="/auth?mode=register"
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                          >
                            <LogIn className="h-4 w-4" strokeWidth={1.6} />
                            {t.auth.createAccount}
                          </Link>
                        ) : (
                          <span className="max-w-[220px] truncate text-sm text-gray-500">{item.value}</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
