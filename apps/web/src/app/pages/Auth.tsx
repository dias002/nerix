import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { countryCodes } from "@nomduchat/shared";
import { ArrowLeft, Camera, Eye, EyeOff, Globe, LoaderCircle, Lock, Mail, User, X } from "lucide-react";
import { startOAuth, toPublicApiError } from "../api";
import { useAuth } from "../auth";
import TurnstileBox, { isTurnstileEnabled } from "../components/TurnstileBox";
import { useLanguage } from "../i18n";

type AuthMode = "login" | "register";
type AuthCountry = string;
type OAuthProvider = "google" | "vk" | "yandex";

type SocialAuthProvider = {
  id: "google" | "vk" | "sber" | "yandex" | "mail";
  label: string;
  shortLabel: string;
  oauthProvider?: OAuthProvider;
  status?: string;
};

export default function AuthPage() {
  const { language, t } = useLanguage();
  const { isAuthenticated, isLoading, login, register } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const mode: AuthMode = searchParams.get("mode") === "register" ? "register" : "login";
  const invitedEmail = searchParams.get("email")?.trim() ?? "";
  const inviteType = searchParams.get("invite");
  const invitedRole = searchParams.get("role");
  const returnTo = searchParams.get("returnTo");
  const safeReturnTo = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : null;
  const from = (location.state as { from?: string } | null)?.from ?? safeReturnTo ?? "/workspace";
  const [name, setName] = useState("");
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [registrationAvatar, setRegistrationAvatar] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("nomduchat-registration-avatar");
  });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [authCountry, setAuthCountry] = useState<AuthCountry>(() => readStoredBillingCountry());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const turnstileEnabled = isTurnstileEnabled();
  const authLanguage = useMemo(() => (language === "kk" ? "kz" : language), [language]);
  const normalizedAuthCountry = normalizeAuthCountry(authCountry);
  const socialAuthProviders = useMemo(() => getSocialAuthProviders(normalizedAuthCountry, t.auth), [normalizedAuthCountry, t.auth]);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const switchMode = (nextMode: AuthMode) => {
    setError(null);
    setTurnstileToken(null);
    const nextParams = new URLSearchParams();
    if (nextMode === "register") nextParams.set("mode", "register");
    if (inviteType) nextParams.set("invite", inviteType);
    if (invitedRole) nextParams.set("role", invitedRole);
    if (invitedEmail) nextParams.set("email", invitedEmail);
    if (safeReturnTo) nextParams.set("returnTo", safeReturnTo);
    setSearchParams(nextParams);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (mode === "register") {
        window.localStorage.setItem("nomduchat-country", normalizedAuthCountry);
        await register({
          name: name.trim() || undefined,
          email,
          password,
          country: normalizedAuthCountry,
          language: authLanguage,
          avatarDataUrl: registrationAvatar ?? undefined,
          generateAiAvatar: Boolean(registrationAvatar),
          turnstileToken: turnstileToken ?? undefined,
        });
        if (registrationAvatar) {
          window.localStorage.removeItem("nomduchat-registration-avatar");
        }
      } else {
        await login({ email, password });
      }

      navigate(from, { replace: true });
    } catch (err) {
      setTurnstileToken(null);
      setError(toPublicApiError(err, t.auth.error));
    } finally {
      setPending(false);
    }
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setError(null);
    setPending(true);

    try {
      const response = await startOAuth(provider, from, normalizedAuthCountry === "RU" ? "RU" : "KZ");
      window.location.href = response.authorizationUrl;
    } catch (err) {
      setError(toPublicApiError(err, t.auth.error));
      setPending(false);
    }
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Выберите изображение для аватарки.");
      return;
    }

    if (file.size > 1_500_000) {
      setError("Фото для аватарки должно быть до 1.5 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setRegistrationAvatar(reader.result);
      window.localStorage.setItem("nomduchat-registration-avatar", reader.result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#050505] px-5 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
            {t.auth.back}
          </Link>
          <div className="text-lg font-medium">{t.product}</div>
        </div>

        <main className="flex flex-1 items-center py-8">
          <form onSubmit={handleSubmit} className="w-full rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 shadow-2xl shadow-black/30">
            <div className="mb-6">
              <h1 className="text-2xl font-medium text-white">
                {mode === "register" ? t.auth.registerTitle : t.auth.loginTitle}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {mode === "register" ? t.auth.registerSubtitle : t.auth.loginSubtitle}
              </p>
              {inviteType === "business" && invitedEmail ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-gray-400">
                  Приглашение в Business workspace для <span className="text-white">{invitedEmail}</span>
                  {invitedRole ? <span className="text-gray-500"> · роль: {invitedRole}</span> : null}
                </div>
              ) : null}
            </div>

            <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/10 bg-black p-1">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  mode === "login" ? "bg-white text-black" : "text-gray-400 hover:text-white"
                }`}
              >
                {t.auth.loginTab}
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  mode === "register" ? "bg-white text-black" : "text-gray-400 hover:text-white"
                }`}
              >
                {t.auth.registerTab}
              </button>
            </div>

            <div className={`mb-5 grid grid-cols-1 gap-2 ${socialAuthProviders.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {socialAuthProviders.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => provider.oauthProvider ? handleOAuth(provider.oauthProvider) : undefined}
                  disabled={pending || isLoading || !provider.oauthProvider}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black px-3 text-sm text-gray-200 transition-colors hover:border-white/20 hover:text-white disabled:text-gray-600 disabled:opacity-100"
                >
                  <span className="font-medium">{provider.shortLabel}</span>
                  <span>{provider.label}</span>
                  {provider.status ? (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-gray-600">
                      {provider.status}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {mode === "register" ? (
                <>
                  <div className="rounded-xl border border-white/10 bg-black p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                        {registrationAvatar ? (
                          <img src={registrationAvatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-gray-500" strokeWidth={1.7} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white">AI-аватар</div>
                        <div className="mt-0.5 text-xs text-gray-600">
                          Необязательно. Если добавите фото, мы бесплатно сделаем аватар в фирменном 3D-стиле.
                        </div>
                      </div>
                      {registrationAvatar ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRegistrationAvatar(null);
                            window.localStorage.removeItem("nomduchat-registration-avatar");
                          }}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
                          aria-label="Удалить аватар"
                          title="Удалить аватар"
                        >
                          <X className="h-4 w-4" strokeWidth={1.7} />
                        </button>
                      ) : null}
                    </div>
                    <label className="mt-3 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white">
                      <Camera className="h-4 w-4" strokeWidth={1.7} />
                      Сделать/выбрать фото
                      <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleAvatarChange} />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs text-gray-500">{t.auth.name}</span>
                    <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-black px-3 focus-within:border-white/25">
                      <User className="h-4 w-4 text-gray-500" strokeWidth={1.7} />
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name"
                        className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-700"
                        placeholder={t.auth.namePlaceholder}
                      />
                    </span>
                  </label>
                </>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">{t.auth.country}</span>
                <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-black px-3 focus-within:border-white/25">
                  <Globe className="h-4 w-4 text-gray-500" strokeWidth={1.7} />
                  <input
                    value={authCountry}
                    onChange={(event) => {
                      const nextCountry = event.target.value.toUpperCase().slice(0, 2);
                      setAuthCountry(nextCountry);
                      if (countryCodes.includes(nextCountry as (typeof countryCodes)[number])) {
                        window.localStorage.setItem("nomduchat-country", nextCountry);
                      }
                    }}
                    list="auth-country-options"
                    required
                    className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                    placeholder="KZ"
                  />
                  <datalist id="auth-country-options">
                    {countryCodes.map((code) => (
                      <option key={code} value={code}>
                        {countryLabel(code)}
                      </option>
                    ))}
                  </datalist>
                </span>
                <span className="mt-1.5 block text-xs text-gray-600">{t.auth.countryHint}</span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">{t.auth.email}</span>
                <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-black px-3 focus-within:border-white/25">
                  <Mail className="h-4 w-4 text-gray-500" strokeWidth={1.7} />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                    autoComplete="email"
                    readOnly={inviteType === "business" && Boolean(invitedEmail)}
                    className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-700"
                    placeholder="name@example.com"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">{t.auth.password}</span>
                <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-black px-3 focus-within:border-white/25">
                  <Lock className="h-4 w-4 text-gray-500" strokeWidth={1.7} />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={passwordVisible ? "text" : "password"}
                    required
                    minLength={mode === "register" ? 8 : 1}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-700"
                    placeholder={mode === "register" ? t.auth.passwordPlaceholder : t.auth.password}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((value) => !value)}
                    aria-label={passwordVisible ? t.auth.hidePassword : t.auth.showPassword}
                    className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {passwordVisible ? <EyeOff className="h-4 w-4" strokeWidth={1.7} /> : <Eye className="h-4 w-4" strokeWidth={1.7} />}
                  </button>
                </span>
              </label>
            </div>

            {mode === "login" ? (
              <div className="mt-3 text-right">
                <Link to="/auth/reset" className="text-sm text-gray-500 transition-colors hover:text-white">
                  Забыли пароль?
                </Link>
              </div>
            ) : null}

            {mode === "register" ? <TurnstileBox action="register" onTokenChange={setTurnstileToken} /> : null}

            {error ? (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending || isLoading || (mode === "register" && turnstileEnabled && !turnstileToken)}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
            >
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : null}
              {mode === "register" ? t.auth.createAccount : t.auth.loginAction}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-gray-600">
              Нажимая кнопку входа или регистрации, вы принимаете{" "}
              <Link to="/legal/terms" className="text-gray-400 transition-colors hover:text-white">
                пользовательское соглашение
              </Link>
              ,{" "}
              <Link to="/legal/privacy" className="text-gray-400 transition-colors hover:text-white">
                политику конфиденциальности
              </Link>{" "}
              и{" "}
              <Link to="/legal/cookies" className="text-gray-400 transition-colors hover:text-white">
                cookies
              </Link>
              .
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}

function readStoredBillingCountry(): AuthCountry {
  if (typeof window === "undefined") return "KZ";
  return normalizeAuthCountry(window.localStorage.getItem("nomduchat-country") ?? "KZ");
}

function getSocialAuthProviders(
  country: AuthCountry,
  authLabels: { google: string; vk: string }
): SocialAuthProvider[] {
  if (country === "RU") {
    return [
      { id: "sber", label: "Sber ID", shortLabel: "S", status: "скоро" },
      { id: "yandex", label: "Yandex ID", shortLabel: "Я", oauthProvider: "yandex" },
      { id: "mail", label: "Mail.ru через VK ID", shortLabel: "@", oauthProvider: "vk" },
      { id: "vk", label: formatVkLabel(authLabels.vk), shortLabel: "VK", oauthProvider: "vk" },
    ];
  }

  return [
    { id: "google", label: authLabels.google, shortLabel: "G", oauthProvider: "google" },
    { id: "vk", label: formatVkLabel(authLabels.vk), shortLabel: "VK", oauthProvider: "vk" },
  ];
}

function formatVkLabel(label: string) {
  return label.replace(/^VK\s*/i, "") || label;
}

function normalizeAuthCountry(value: string): AuthCountry {
  const normalized = value.trim().toUpperCase();
  return countryCodes.includes(normalized as (typeof countryCodes)[number]) ? normalized : "KZ";
}

function countryLabel(code: AuthCountry) {
  if (code === "KZ") return "KZ · Казахстан";
  if (code === "RU") return "RU · Россия";
  if (code === "US") return "US · United States";
  if (code === "AE") return "AE · UAE";
  if (code === "TR") return "TR · Türkiye";
  return code;
}
