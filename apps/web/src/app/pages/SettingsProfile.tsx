import { Link } from "react-router";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { countryCodes, type Language } from "@nomduchat/shared";
import { ArrowLeft, Camera, Check, CircleUser, Copy, Globe, Link2, LoaderCircle, Mail, Save, Shield, Trash2 } from "lucide-react";
import {
  getLinkedAccounts,
  startOAuth,
  toPublicApiError,
  unlinkLinkedAccount,
  type LinkedAccountApiRecord,
} from "../api";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";

type OAuthProvider = "google" | "vk" | "yandex";
type AccountProvider = {
  id: string;
  label: string;
  oauthProvider?: OAuthProvider;
  unavailableCountries?: Array<"KZ" | "RU">;
};

const accountProviders = [
  { id: "google", label: "Google", oauthProvider: "google", unavailableCountries: ["RU"] },
  { id: "vk", label: "VK", oauthProvider: "vk" },
  { id: "yandex", label: "Yandex", oauthProvider: "yandex" },
  { id: "mailru", label: "Mail.ru через VK ID", oauthProvider: "vk" },
] satisfies AccountProvider[];

export default function SettingsProfile() {
  const { t } = useLanguage();
  const { accessToken, updateProfile, user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountApiRecord[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [profileCountry, setProfileCountry] = useState((user?.country ?? "KZ").toUpperCase());
  const [profileLanguage, setProfileLanguage] = useState<Language>(normalizeApiLanguage(user?.language));
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profilePending, setProfilePending] = useState(false);
  const referralLink = useMemo(() => {
    const origin = typeof window === "undefined" ? "https://nomduchat.com" : window.location.origin;
    const ref = user?.id ?? user?.email ?? "guest";
    return `${origin}/auth?mode=register&ref=${encodeURIComponent(ref)}`;
  }, [user?.email, user?.id]);

  useEffect(() => {
    setProfileName(user?.name ?? "");
    setProfileCountry((user?.country ?? "KZ").toUpperCase());
    setProfileLanguage(normalizeApiLanguage(user?.language));
    setAvatarPreview(user?.avatarUrl ?? null);
    setAvatarDirty(false);
    setProfileError(null);
    setProfileSaved(false);
  }, [user?.avatarUrl, user?.country, user?.id, user?.language, user?.name]);

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

  const saveProfile = async () => {
    if (!accessToken) {
      setProfileError("Войдите в аккаунт, чтобы сохранить профиль.");
      return;
    }

    const country = profileCountry.trim().toUpperCase();
    if (!countryCodes.includes(country as (typeof countryCodes)[number])) {
      setProfileError("Укажите страну двухбуквенным ISO-кодом, например KZ, RU, US.");
      return;
    }

    setProfilePending(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      await updateProfile({
        name: profileName.trim() || undefined,
        country,
        language: profileLanguage,
        avatarDataUrl: avatarDirty ? avatarPreview : undefined,
      });
      setAvatarDirty(false);
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 1600);
    } catch (error) {
      setProfileError(toPublicApiError(error, "Не удалось сохранить профиль."));
    } finally {
      setProfilePending(false);
    }
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Выберите изображение для аватарки.");
      return;
    }

    if (file.size > 1_500_000) {
      setProfileError("Фото для аватарки должно быть до 1.5 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setAvatarPreview(reader.result);
      setAvatarDirty(true);
      setProfileError(null);
    };
    reader.readAsDataURL(file);
  };

  const rows = [
    { label: t.settings.profile, value: user?.name || t.auth.guest, icon: CircleUser },
    { label: t.auth.email, value: user?.email ?? "—", icon: Mail },
    { label: t.settings.country, value: user?.country ?? "KZ", icon: Globe },
    { label: t.settings.security, value: user ? t.settings.protected : t.auth.guestHint, icon: Shield },
  ];

  if (!user) {
    return (
      <div className="ns-page-scroll">
        <main className="ns-page-text flex min-h-[70vh] items-center justify-center">
          <section className="flex max-w-sm flex-col items-center text-center">
            <CircleUser className="h-16 w-16 text-[var(--text-tertiary)]" strokeWidth={1.35} />
            <h1 className="mt-5 text-3xl font-medium text-[var(--text-primary)]">Профиль гостя</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Войдите, чтобы сохранить имя, фото и настройки.
            </p>
            <Link
              to="/auth?mode=login&returnTo=%2Fworkspace%2Fsettings%2Fprofile"
              className="nd-primary-action mt-6 inline-flex h-11 items-center justify-center px-6 text-sm font-semibold"
            >
              Войти
            </Link>
          </section>
        </main>
      </div>
    );
  }

  return (
    <SettingsDetailShell title={t.settings.profile} subtitle={t.settings.profileSubtitle}>
      <section className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex items-center gap-3 sm:w-48 sm:flex-col sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <CircleUser className="h-10 w-10 text-gray-500" strokeWidth={1.5} />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white">
                <Camera className="h-4 w-4" strokeWidth={1.7} />
                Фото
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
              {avatarPreview ? (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarPreview(null);
                    setAvatarDirty(true);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-400/10 hover:text-red-200"
                  aria-label="Удалить аватар"
                  title="Удалить аватар"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs text-gray-500">Имя пользователя</span>
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                placeholder="Как вас показывать в профиле"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-gray-500">Страна</span>
              <input
                value={profileCountry}
                onChange={(event) => setProfileCountry(event.target.value.toUpperCase().slice(0, 2))}
                list="profile-country-options"
                className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                placeholder="KZ"
              />
              <datalist id="profile-country-options">
                {countryCodes.map((code) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-gray-500">Язык аккаунта</span>
              <select
                value={profileLanguage}
                onChange={(event) => setProfileLanguage(event.target.value as Language)}
                className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
              >
                <option className="bg-black text-white" value="ru">Русский</option>
                <option className="bg-black text-white" value="kz">Қазақша</option>
                <option className="bg-black text-white" value="en">English</option>
              </select>
            </label>
            {profileError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200 md:col-span-2">
                {profileError}
              </div>
            ) : null}
            {profileSaved ? (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 md:col-span-2">
                Профиль сохранен.
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={profilePending || !accessToken}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-55 md:col-span-2"
            >
              {profilePending ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : <Save className="h-4 w-4" strokeWidth={1.8} />}
              Сохранить профиль
            </button>
          </div>
        </div>
      </section>

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
    <div className="ns-page-scroll">
      <div className="ns-page-text space-y-8">
        <div className="space-y-5">
          <Link
            to="/workspace/settings"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
            {t.settings.backToSettings}
          </Link>
          <div>
            <h2 className="ns-page-title text-[var(--text-primary)]">{title}</h2>
            <p className="mt-2 text-[var(--text-secondary)]">{subtitle}</p>
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

function normalizeApiLanguage(language: string | undefined): Language {
  if (language === "kz" || language === "en") return language;
  return "ru";
}
