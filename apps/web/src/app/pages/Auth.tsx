import { useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, LoaderCircle, Lock, Mail, User } from "lucide-react";
import { startOAuth, toPublicApiError } from "../api";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const { language, t } = useLanguage();
  const { isAuthenticated, isLoading, login, register } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const mode: AuthMode = searchParams.get("mode") === "register" ? "register" : "login";
  const from = (location.state as { from?: string } | null)?.from ?? "/workspace";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const authLanguage = useMemo(() => (language === "kk" ? "kz" : language), [language]);
  const authCountry = useMemo(() => {
    if (typeof window === "undefined") return "KZ";
    return window.localStorage.getItem("nomduchat-country") === "RU" ? "RU" : "KZ";
  }, []);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const switchMode = (nextMode: AuthMode) => {
    setError(null);
    setSearchParams(nextMode === "register" ? { mode: "register" } : {});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (mode === "register") {
        await register({
          name: name.trim() || undefined,
          email,
          password,
          country: authCountry,
          language: authLanguage,
        });
      } else {
        await login({ email, password });
      }

      navigate(from, { replace: true });
    } catch (err) {
      setError(toPublicApiError(err, t.auth.error));
    } finally {
      setPending(false);
    }
  };

  const handleOAuth = async (provider: "google" | "vk") => {
    setError(null);
    setPending(true);

    try {
      const response = await startOAuth(provider, from);
      window.location.href = response.authorizationUrl;
    } catch (err) {
      setError(toPublicApiError(err, t.auth.error));
      setPending(false);
    }
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

            <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
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

            {error ? (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending || isLoading}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
            >
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : null}
              {mode === "register" ? t.auth.createAccount : t.auth.loginAction}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
