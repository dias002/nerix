import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { Globe, LoaderCircle, Lock, Mail, User, X } from "lucide-react";
import { startOAuth, toPublicApiError } from "../api";
import { useAuth } from "../auth";
import TurnstileBox, { isTurnstileEnabled } from "./TurnstileBox";
import { useLanguage } from "../i18n";

type AuthMode = "login" | "register";
type BillingCountry = "KZ" | "RU";

type AuthPromptDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function AuthPromptDialog({ open, onClose }: AuthPromptDialogProps) {
  const { language, t } = useLanguage();
  const { isAuthenticated, isLoading, login, register } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authCountry, setAuthCountry] = useState<BillingCountry>(() => readStoredBillingCountry());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const turnstileEnabled = isTurnstileEnabled();
  const authLanguage = useMemo(() => (language === "kk" ? "kz" : language), [language]);
  const returnTo = `${location.pathname}${location.search}`;

  if (!open || isAuthenticated) return null;

  const switchMode = (nextMode: AuthMode) => {
    setError(null);
    setTurnstileToken(null);
    setMode(nextMode);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (mode === "register") {
        window.localStorage.setItem("nomduchat-country", authCountry);
        await register({
          name: name.trim() || undefined,
          email,
          password,
          country: authCountry,
          language: authLanguage,
          turnstileToken: turnstileToken ?? undefined,
        });
      } else {
        await login({ email, password });
      }

      window.localStorage.removeItem("nomduchat-guest-chat-requests");
      onClose();
    } catch (err) {
      setTurnstileToken(null);
      setError(toPublicApiError(err, t.auth.error));
    } finally {
      setPending(false);
    }
  };

  const handleOAuth = async (provider: "google" | "vk") => {
    setError(null);
    setPending(true);

    try {
      const response = await startOAuth(provider, returnTo);
      window.location.href = response.authorizationUrl;
    } catch (err) {
      setError(toPublicApiError(err, t.auth.error));
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 backdrop-blur-md sm:items-center sm:p-6">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 text-white shadow-2xl shadow-black/50"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.auth.closePrompt}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" strokeWidth={1.8} />
        </button>

        <div className="mb-5 pr-9">
          <div className="mb-3 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-400">
            {t.auth.promptBadge}
          </div>
          <h2 className="text-2xl font-medium text-white">{t.auth.promptTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">{t.auth.promptSubtitle}</p>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-xl border border-white/10 bg-black p-1">
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

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={pending || isLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black px-3 text-sm text-gray-200 transition-colors hover:border-white/20 hover:text-white disabled:opacity-60"
          >
            <span className="font-medium">G</span>
            {t.auth.google}
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("vk")}
            disabled={pending || isLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black px-3 text-sm text-gray-200 transition-colors hover:border-white/20 hover:text-white disabled:opacity-60"
          >
            <span className="font-medium">VK</span>
            {t.auth.vk}
          </button>
        </div>

        <div className="space-y-3">
          {mode === "register" ? (
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
          ) : null}

          {mode === "register" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs text-gray-500">{t.auth.country}</span>
              <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-black px-3 focus-within:border-white/25">
                <Globe className="h-4 w-4 text-gray-500" strokeWidth={1.7} />
                <select
                  value={authCountry}
                  onChange={(event) => setAuthCountry(event.target.value === "RU" ? "RU" : "KZ")}
                  required
                  className="h-11 min-w-0 flex-1 appearance-none bg-transparent text-sm text-white outline-none"
                >
                  <option className="bg-black text-white" value="KZ">
                    {t.auth.countryKazakhstan}
                  </option>
                  <option className="bg-black text-white" value="RU">
                    {t.auth.countryRussia}
                  </option>
                </select>
              </span>
              <span className="mt-1.5 block text-xs text-gray-600">{t.auth.countryHint}</span>
            </label>
          ) : null}

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
                type="password"
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-700"
                placeholder={mode === "register" ? t.auth.passwordPlaceholder : t.auth.password}
              />
            </span>
          </label>
        </div>

        {mode === "register" ? <TurnstileBox action="register-dialog" onTokenChange={setTurnstileToken} /> : null}

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

        <button
          type="button"
          onClick={onClose}
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl text-sm text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
        >
          {t.auth.continueWithoutAccount}
        </button>

        <p className="mt-3 text-center text-xs leading-relaxed text-gray-600">
          <Link to="/auth?mode=register" className="text-gray-400 transition-colors hover:text-white">
            {t.auth.fullAuthPage}
          </Link>
        </p>
      </form>
    </div>
  );
}

function readStoredBillingCountry(): BillingCountry {
  if (typeof window === "undefined") return "KZ";
  return window.localStorage.getItem("nomduchat-country") === "RU" ? "RU" : "KZ";
}
