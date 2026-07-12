import { Link } from "react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, CircleUser, Copy, Globe, Link2, Mail, Shield } from "lucide-react";
import {
  getLinkedAccounts,
  startOAuth,
  toPublicApiError,
  unlinkLinkedAccount,
  type LinkedAccountApiRecord,
} from "../api";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";

type OAuthProvider = "google" | "vk";
type AccountProvider = {
  id: string;
  label: string;
  oauthProvider?: OAuthProvider;
  unavailableCountries?: Array<"KZ" | "RU">;
};

const accountProviders = [
  { id: "google", label: "Google", oauthProvider: "google", unavailableCountries: ["RU"] },
  { id: "vk", label: "VK", oauthProvider: "vk" },
  { id: "yandex", label: "Yandex" },
  { id: "mailru", label: "Mail.ru" },
] satisfies AccountProvider[];

export default function SettingsProfile() {
  const { t } = useLanguage();
  const { accessToken, user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountApiRecord[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const referralLink = useMemo(() => {
    const origin = typeof window === "undefined" ? "https://nomduchat.com" : window.location.origin;
    const ref = user?.id ?? user?.email ?? "guest";
    return `${origin}/auth?mode=register&ref=${encodeURIComponent(ref)}`;
  }, [user?.email, user?.id]);

  useEffect(() => {
    let active = true;

    if (!accessToken) {
      setLinkedAccounts([]);
      setAccountError(null);
      return () => {
        active = false;
      };
    }

    getLinkedAccounts()
      .then((response) => {
        if (!active) return;
        setLinkedAccounts(response.accounts);
        setAccountError(null);
      })
      .catch((error) => {
        if (!active) return;
        setLinkedAccounts([]);
        setAccountError(toPublicApiError(error, "Не удалось загрузить привязанные аккаунты."));
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  const connectAccount = async (provider: AccountProvider) => {
    if (!provider.oauthProvider) return;
    if (!accessToken) {
      setAccountError("Войдите в аккаунт, чтобы управлять привязками.");
      return;
    }
    if (isProviderUnavailable(provider, user?.country)) {
      setAccountError(`${provider.label} недоступен для выбранной страны аккаунта.`);
      return;
    }

    setPendingProvider(provider.id);
    setAccountError(null);
    try {
      const response = await startOAuth(provider.oauthProvider, "/workspace/settings/profile", resolveOAuthCountry(user?.country));
      window.location.href = response.authorizationUrl;
    } catch (error) {
      setAccountError(toPublicApiError(error, "Не удалось открыть привязку аккаунта."));
      setPendingProvider(null);
    }
  };

  const unlinkAccount = async (provider: AccountProvider) => {
    if (!provider.oauthProvider) return;
    if (!accessToken) {
      setAccountError("Войдите в аккаунт, чтобы управлять привязками.");
      return;
    }

    setPendingProvider(provider.id);
    setAccountError(null);
    try {
      const response = await unlinkLinkedAccount(provider.oauthProvider);
      setLinkedAccounts(response.accounts);
    } catch (error) {
      setAccountError(toPublicApiError(error, "Не удалось отвязать аккаунт."));
    } finally {
      setPendingProvider(null);
    }
  };

  const rows = [
    { label: t.settings.profile, value: user?.name || t.auth.guest, icon: CircleUser },
    { label: t.auth.email, value: user?.email ?? "—", icon: Mail },
    { label: t.settings.country, value: user?.country ?? "KZ", icon: Globe },
    { label: t.settings.security, value: user ? t.settings.protected : t.auth.guestHint, icon: Shield },
  ];

  return (
    <SettingsDetailShell title={t.settings.profile} subtitle={t.settings.profileSubtitle}>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0D0D]">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-4 p-4 ${
              index !== rows.length - 1 ? "border-b border-white/5" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <row.icon className="h-5 w-5 shrink-0 text-gray-400" strokeWidth={1.6} />
              <span className="text-gray-200">{row.label}</span>
            </div>
            <span className="truncate text-sm text-gray-500">{row.value}</span>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-4">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" strokeWidth={1.6} />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-medium text-white">Реферальная ссылка</h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              Ссылка для приглашения пользователей. Позже по ней можно начислять бонусы и считать регистрации.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-gray-300">
                <span className="block truncate">{referralLink}</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard?.writeText(referralLink);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
              >
                {copied ? <Check className="h-4 w-4" strokeWidth={1.7} /> : <Copy className="h-4 w-4" strokeWidth={1.7} />}
                {copied ? "Скопировано" : "Скопировать"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-4">
        <h3 className="text-base font-medium text-white">Привязанные аккаунты</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          Управляйте быстрыми входами, которые пользователь видит в личном кабинете.
        </p>
        {accountError ? (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {accountError}
          </div>
        ) : null}
        <div className="mt-4 divide-y divide-white/5">
          {accountProviders.map((provider) => {
            const account = provider.oauthProvider
              ? linkedAccounts.find((item) => item.provider === provider.oauthProvider) ?? null
              : null;
            const unavailable = isProviderUnavailable(provider, user?.country);
            const pending = pendingProvider === provider.id;
            const disabled = pendingProvider !== null || !provider.oauthProvider || !accessToken || unavailable;
            const status = provider.oauthProvider
              ? account
                ? account.email ?? account.displayName ?? "Привязан"
                : !accessToken
                  ? "Войдите для управления"
                  : unavailable
                    ? "Недоступно для этой страны"
                    : "Не привязан"
              : "Скоро";
            const label = !provider.oauthProvider
              ? "Скоро"
              : account
                ? pending
                  ? "Отвязываем"
                  : "Отвязать"
                : pending
                  ? "Открываем"
                  : "Привязать";
            return (
              <div key={provider.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">{provider.label}</div>
                  <div className="mt-0.5 truncate text-xs text-gray-600">{status}</div>
                </div>
                <button
                  type="button"
                  onClick={() => (account ? unlinkAccount(provider) : connectAccount(provider))}
                  disabled={disabled}
                  className="inline-flex h-9 min-w-24 items-center justify-center rounded-lg border border-white/10 px-3 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {label}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </SettingsDetailShell>
  );
}

export function SettingsDetailShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-8 md:p-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-5">
          <Link
            to="/workspace/settings"
            className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
            {t.settings.backToSettings}
          </Link>
          <div>
            <h2 className="text-2xl font-medium text-white">{title}</h2>
            <p className="mt-2 text-gray-400">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function resolveOAuthCountry(country: string | undefined) {
  return country === "RU" ? "RU" : "KZ";
}

function isProviderUnavailable(provider: AccountProvider, country: string | undefined) {
  const normalizedCountry = resolveOAuthCountry(country);
  return provider.unavailableCountries?.includes(normalizedCountry) ?? false;
}
