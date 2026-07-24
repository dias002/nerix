import { Link } from "react-router";
import {
  Bell,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Globe,
  LogIn,
  LogOut,
  LifeBuoy,
  Moon,
  Shield,
  Sun,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { countryCodes, normalizeCountryCode, type CountryCode } from "@nomduchat/shared";
import { useAuth } from "../auth";
import PageHeader from "../components/workspace/PageHeader";
import { useLanguage } from "../i18n";
import { useTheme } from "../theme";

export default function Settings() {
  const { language, t } = useLanguage();
  const { isAuthenticated, logout, user } = useAuth();
  const { theme } = useTheme();
  const [countryOpen, setCountryOpen] = useState(false);
  const [country, setCountry] = useState<CountryCode>(() => {
    if (typeof window === "undefined") return "KZ";
    return normalizeCountryCode(window.localStorage.getItem("nomduchat-country") ?? "KZ");
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

  const selectedCountry = countryOptions.find((option) => option.code === country);

  const handleCountryChange = (value: string) => {
    const nextCountry = normalizeCountryCode(value);
    setCountry(nextCountry);
    window.localStorage.setItem("nomduchat-country", nextCountry);
    setCountryOpen(false);
  };

  const nav = [
    { id: "profile", label: t.settings.profile, icon: User, path: "/workspace/settings/profile" },
    { id: "appearance", label: t.settings.appearance, icon: theme === "light" ? Sun : Moon, path: "/workspace/settings/appearance" },
    { id: "notifications", label: t.settings.notifications, icon: Bell, path: "/workspace/settings/notifications" },
    { id: "memory", label: t.memory.title, icon: Brain, path: "/workspace/settings/memory" },
    { id: "language", label: "Язык и регион", icon: Globe, hash: "#region" },
    { id: "security", label: t.settings.security, icon: Shield, hash: "#security" },
    { id: "support", label: "Поддержка", icon: LifeBuoy, path: "/support" },
    { id: "tokens", label: "История токенов", icon: Wallet, path: "/workspace/balance#token-history" },
    { id: "data", label: "Данные и удаление", icon: Trash2, path: "/data-deletion" },
  ];

  return (
    <div className="ns-page-scroll">
      <div className="ns-page space-y-8">
        <PageHeader
          overline="Настройки"
          title={t.settings.title}
          subtitle="Профиль, внешний вид, уведомления, регион, безопасность и управление данными в одном месте."
        />

        <div className="ns-settings-layout">
          <nav className="ns-settings-nav" aria-label="Разделы настроек">
            <div className="space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const target = item.path ?? item.hash ?? "#";
                return (
                  <Link key={item.id} to={target}>
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <main className="ns-settings-content p-5">
            <section id="profile" className="space-y-1">
              <h2 className="text-xl font-medium text-[var(--text-primary)]">{t.settings.main}</h2>
              <SettingsLinkRow
                icon={User}
                label={t.settings.profile}
                value={user?.email ?? user?.name ?? t.auth.guest}
                to="/workspace/settings/profile"
              />
              <SettingsLinkRow
                icon={theme === "light" ? Sun : Moon}
                label={t.settings.appearance}
                value={theme === "light" ? t.settings.light : t.settings.dark}
                to="/workspace/settings/appearance"
              />
              <SettingsLinkRow
                icon={Bell}
                label={t.settings.notifications}
                value="Ответы, платежи и новости"
                to="/workspace/settings/notifications"
              />
              <SettingsLinkRow
                icon={Brain}
                label={t.memory.title}
                value={t.memory.subtitle}
                to="/workspace/settings/memory"
              />
            </section>

            <section id="region" className="mt-8 space-y-1">
              <h2 className="text-xl font-medium text-[var(--text-primary)]">Язык и регион</h2>
              <div className="ns-settings-row">
                <div className="flex min-w-0 items-start gap-3">
                  <Globe className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.7} />
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{t.settings.language}</div>
                    <div className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                      Язык интерфейса меняется в верхней панели workspace.
                    </div>
                  </div>
                </div>
                <span className="text-sm text-[var(--text-secondary)]">{language.toUpperCase()}</span>
              </div>

              <div className="ns-settings-row">
                <div className="flex min-w-0 items-start gap-3">
                  <Globe className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.7} />
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{t.settings.country}</div>
                    <div className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{t.settings.countryHint}</div>
                  </div>
                </div>
                <div className="relative flex max-w-full flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => setCountryOpen((open) => !open)}
                    className="nd-secondary-action inline-flex h-11 max-w-[280px] items-center justify-between gap-3 px-3 text-sm"
                    aria-expanded={countryOpen}
                  >
                    <span className="truncate">
                      {selectedCountry?.name ?? country} ({country})
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform ${countryOpen ? "rotate-180" : ""}`} />
                  </button>
                  {countryOpen ? (
                    <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-[var(--radius-input)] border border-[var(--line-default)] bg-[var(--surface-2)] shadow-[var(--shadow-popover)]">
                      <div className="custom-scrollbar max-h-72 overflow-y-auto py-1">
                        {countryOptions.map((option) => (
                          <button
                            key={option.code}
                            type="button"
                            onClick={() => handleCountryChange(option.code)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                          >
                            <span className="truncate">
                              {option.name} ({option.code})
                            </span>
                            {option.code === country ? <Check className="h-4 w-4 shrink-0 text-[var(--text-primary)]" strokeWidth={1.8} /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section id="security" className="mt-8 space-y-1">
              <h2 className="text-xl font-medium text-[var(--text-primary)]">{t.settings.extra}</h2>
              <div className="ns-settings-row">
                <div className="flex min-w-0 items-start gap-3">
                  <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.7} />
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{t.settings.security}</div>
                    <div className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {isAuthenticated ? t.settings.protected : t.auth.guestHint}
                    </div>
                  </div>
                </div>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={logout}
                    className="nd-secondary-action inline-flex h-10 items-center justify-center gap-2 px-4 text-sm"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.6} />
                    {t.auth.logout}
                  </button>
                ) : (
                  <Link to="/auth?mode=register" className="nd-primary-action inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-medium">
                    <LogIn className="h-4 w-4" strokeWidth={1.6} />
                    {t.auth.createAccount}
                  </Link>
                )}
              </div>
              <SettingsLinkRow icon={LifeBuoy} label="Поддержка" value="Оплата, доступ и возвраты" to="/support" />
              <SettingsLinkRow icon={Wallet} label="История токенов" value="Списания, резервы, возвраты" to="/workspace/balance#token-history" />
              <SettingsLinkRow icon={Trash2} label="Удаление аккаунта и чатов" value="Выгрузка и деактивация" to="/data-deletion" danger />
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function SettingsLinkRow({
  danger,
  icon: Icon,
  label,
  to,
  value,
}: {
  danger?: boolean;
  icon: typeof User;
  label: string;
  to: string;
  value: string;
}) {
  return (
    <Link to={to} className="ns-settings-row group">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${danger ? "text-[var(--danger)]" : "text-[var(--text-tertiary)]"}`} strokeWidth={1.7} />
        <div>
          <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
          <div className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">{value}</div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 justify-self-end text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5" strokeWidth={1.7} />
    </Link>
  );
}
