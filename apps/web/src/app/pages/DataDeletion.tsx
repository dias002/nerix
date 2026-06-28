import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Download, Mail, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import StarsBackground from "../components/StarsBackground";
import { deleteCurrentUser, exportCurrentUserData, toPublicApiError } from "../api";
import { useAuth } from "../auth";

const supportEmail = "admin@nomduchat.com";

export default function DataDeletion() {
  const { isAuthenticated, logout, user } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);

  const handleExport = async () => {
    setBusy("export");
    setError(null);
    setStatus(null);

    try {
      const data = await exportCurrentUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nomduchat-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Выгрузка данных подготовлена.");
    } catch (exportError) {
      setError(toPublicApiError(exportError, "Не удалось подготовить выгрузку данных."));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy("delete");
    setError(null);
    setStatus(null);

    try {
      await deleteCurrentUser(confirmation);
      logout();
      setStatus("Аккаунт деактивирован, личные поля и контент очищены.");
      setConfirmation("");
    } catch (deleteError) {
      setError(toPublicApiError(deleteError, "Не удалось деактивировать аккаунт."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <StarsBackground />

      <header className="fixed left-6 right-6 top-6 z-20 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-medium text-white transition-colors hover:text-gray-300">
          nomduchat
        </Link>
        <Link
          to="/privacy"
          className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
        >
          Конфиденциальность
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-28 md:py-32">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          На главную
        </Link>

        <section className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            <Trash2 className="h-4 w-4" strokeWidth={1.7} />
            Данные аккаунта
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold md:text-6xl">Удаление аккаунта и данных</h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-gray-400 md:text-lg">
            Пользователь может запросить удаление аккаунта, истории чатов, файлов и бизнес-данных workspace. Финансовые записи могут храниться дольше, если это требуется для учета и безопасности платежей.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoCard
            icon={Mail}
            title="Запрос"
            text={`Напишите на ${supportEmail} с email аккаунта и темой «Удаление данных».`}
          />
          <InfoCard
            icon={ShieldCheck}
            title="Проверка"
            text="Мы подтверждаем владельца аккаунта, чтобы не удалить данные по чужому запросу."
          />
          <InfoCard
            icon={Download}
            title="Выгрузка"
            text="До удаления можно запросить выгрузку основных данных аккаунта."
          />
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md md:p-6">
          <h2 className="text-2xl font-medium">{isAuthenticated ? "Управление данными" : "Отправить запрос"}</h2>
          {isAuthenticated ? (
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-medium text-white">Выгрузка данных</div>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  JSON-файл содержит профиль, счетчики данных, последние диалоги, память и рабочие связи аккаунта.
                </p>
                <button
                  type="button"
                  onClick={() => void handleExport()}
                  disabled={busy !== null}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50"
                >
                  <Download className="h-4 w-4" strokeWidth={1.8} />
                  {busy === "export" ? "Готовим" : "Скачать JSON"}
                </button>
              </div>

              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
                <div className="text-sm font-medium text-red-100">Деактивация аккаунта</div>
                <p className="mt-2 text-sm leading-relaxed text-red-100/70">
                  Будут очищены email, телефон, пароль, контент чатов, память и заявки. Финансовые записи сохраняются как технические записи операций.
                </p>
                <label className="mt-4 block">
                  <span className="text-sm text-red-100/80">Введите DELETE для подтверждения</span>
                  <input
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="DELETE"
                    className="mt-2 h-12 w-full rounded-2xl border border-red-200/20 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-red-100/30 focus:border-red-100/40"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={busy !== null || confirmation !== "DELETE"}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-red-100 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  {busy === "delete" ? "Удаляем" : "Деактивировать аккаунт"}
                </button>
              </div>
              {user?.email ? <div className="text-xs text-gray-600">Текущий аккаунт: {user.email}</div> : null}
            </div>
          ) : (
            <>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                Войдите в аккаунт для автоматической выгрузки и деактивации. Без входа можно отправить запрос вручную.
              </p>
              <a
                href={`mailto:${supportEmail}?subject=${encodeURIComponent("Удаление данных nomduchat")}&body=${encodeURIComponent(
                  "Здравствуйте. Прошу удалить мой аккаунт и связанные данные nomduchat. Email аккаунта: "
                )}`}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              >
                <Mail className="h-4 w-4" strokeWidth={1.8} />
                Написать запрос
              </a>
            </>
          )}
          {status ? <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100/80">{status}</div> : null}
          {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100/80">{error}</div> : null}
        </section>
      </main>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md">
      <Icon className="h-5 w-5 text-gray-400" strokeWidth={1.7} />
      <h2 className="mt-4 text-xl font-medium">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-gray-500">{text}</p>
    </article>
  );
}
