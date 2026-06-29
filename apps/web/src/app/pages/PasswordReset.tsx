import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, LoaderCircle, Lock, Mail } from "lucide-react";
import { toPublicApiError } from "../api";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";

export default function PasswordReset() {
  const { t } = useLanguage();
  const { confirmPasswordReset, isAuthenticated, isLoading, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!isLoading && isAuthenticated && !token) {
    return <Navigate to="/workspace/chat" replace />;
  }

  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    setDevResetUrl(null);

    try {
      const response = await requestPasswordReset({ email });
      setDone(true);
      setDevResetUrl(response.resetUrl ?? null);
    } catch (err) {
      setError(toPublicApiError(err, "Не удалось отправить письмо для сброса пароля."));
    } finally {
      setPending(false);
    }
  };

  const handleConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await confirmPasswordReset({ token, password });
      navigate("/workspace/chat", { replace: true });
    } catch (err) {
      setError(toPublicApiError(err, "Не удалось сменить пароль."));
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] px-5 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col">
        <div className="flex items-center justify-between">
          <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
            Войти
          </Link>
          <div className="text-lg font-medium">{t.product}</div>
        </div>

        <main className="flex flex-1 items-center py-8">
          {token ? (
            <form onSubmit={handleConfirm} className="w-full rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 shadow-2xl shadow-black/30">
              <div className="mb-6">
                <h1 className="text-2xl font-medium text-white">Новый пароль</h1>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  Придумайте новый пароль. После сохранения вы сразу войдете в аккаунт.
                </p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">Пароль</span>
                <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-black px-3 focus-within:border-white/25">
                  <Lock className="h-4 w-4 text-gray-500" strokeWidth={1.7} />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-700"
                    placeholder="Минимум 8 символов"
                  />
                </span>
              </label>

              {error ? (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={pending || password.length < 8}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
              >
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : null}
                Сохранить пароль
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequest} className="w-full rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 shadow-2xl shadow-black/30">
              <div className="mb-6">
                <h1 className="text-2xl font-medium text-white">Восстановить пароль</h1>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  Укажите email аккаунта. Если аккаунт есть, мы отправим ссылку для смены пароля.
                </p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">Email</span>
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

              {done ? (
                <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm leading-relaxed text-emerald-100/80">
                  Если такой email есть в nomduchat, ссылка для сброса уже отправлена.
                  {devResetUrl ? (
                    <a href={devResetUrl} className="mt-2 block text-white underline-offset-4 hover:underline">
                      Открыть dev-ссылку
                    </a>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
              >
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : null}
                Отправить ссылку
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
