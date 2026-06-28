import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Globe,
  Loader2,
  MessageSquare,
  XCircle,
} from "lucide-react";
import {
  cancelBusinessJob,
  getBusinessJobs,
  getBusinessWorkspace,
  toPublicApiError,
  type BusinessJobApiRecord,
  type BusinessWorkspaceApiResponse,
} from "../api";

export default function BusinessCabinet() {
  const [workspaceData, setWorkspaceData] = useState<BusinessWorkspaceApiResponse | null>(null);
  const [jobs, setJobs] = useState<BusinessJobApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const response = await getBusinessJobs();
      setJobs(response.jobs);
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    getBusinessWorkspace()
      .then((workspace) => {
        if (cancelled) return;
        setWorkspaceData(workspace);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspaceData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void loadJobs();

    return () => {
      cancelled = true;
    };
  }, [loadJobs]);

  const cancelJob = async (jobId: string) => {
    if (cancellingJobId) return;

    setCancellingJobId(jobId);
    setJobMessage(null);
    try {
      const response = await cancelBusinessJob(jobId);
      setJobs((current) => current.map((job) => (job.id === jobId ? response.job : job)));
      setJobMessage("Задача отменена.");
    } catch (error) {
      setJobMessage(toPublicApiError(error, "Не удалось отменить задачу."));
    } finally {
      setCancellingJobId(null);
    }
  };

  const stats = workspaceData?.stats ?? [];
  const members = workspaceData?.members ?? [];
  const reports = workspaceData?.employeeReports ?? [];
  const deals = workspaceData?.deals ?? [];
  const advisorCount = workspaceData?.advisorViews.reduce((sum, view) => sum + view.ideas.length, 0) ?? 0;
  const accessLabel =
    workspaceData?.access.mode === "active"
      ? "Business активен"
      : loading
        ? "Загрузка"
        : "Демо-режим";
  const topStats = useMemo(
    () => [
      {
        label: "Сотрудники",
        value: String(members.length || 0),
        detail: `${members.filter((member) => member.status === "online").length} в сети`,
      },
      {
        label: "Заявки",
        value: String(deals.length || 0),
        detail: "в CRM-воронке",
      },
      {
        label: "Отчеты",
        value: String(reports.reduce((sum, report) => sum + report.clientReportsCount, 0)),
        detail: "по клиентам",
      },
      {
        label: "Идеи",
        value: String(advisorCount),
        detail: "для роста",
      },
    ],
    [advisorCount, deals.length, members, reports]
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-5 text-white md:p-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
              <BriefcaseBusiness className="h-4 w-4" strokeWidth={1.7} />
              B2B-платформа · {accessLabel}
            </div>
            <h1 className="mt-5 text-3xl font-medium md:text-5xl">Бизнес-разделы nomduchat</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-400">
              Это короткая карта продукта. Сайт, Telegram-менеджер, аналитика и идеи роста лежат отдельно, чтобы клиент не разбирался в лишних настройках.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/workspace/business/website"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              <Globe className="h-4 w-4" strokeWidth={1.8} />
              Создать сайт
            </Link>
            <Link
              to="/workspace/business/dialogs"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
              Диалоги клиентов
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {topStats.map((stat) => (
            <article key={stat.label} className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
              <div className="text-3xl font-medium">{stat.value}</div>
              <div className="mt-2 text-sm font-medium text-gray-300">{stat.label}</div>
              <div className="mt-1 text-sm text-gray-500">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <BriefcaseBusiness className="h-4 w-4" strokeWidth={1.7} />
            Навигация Business тарифа
          </div>
          <h2 className="mt-2 text-2xl font-medium">Основные разделы теперь в левом меню</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
            Сайт, ИИ в Telegram, диалоги клиентов, аналитика сотрудников и идеи роста находятся под пунктом «Бизнес» в боковой панели. Главный экран остается обзором, без перегруженной сетки карточек.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Activity className="h-4 w-4" strokeWidth={1.7} />
                Последние задачи
              </div>
              <h2 className="mt-2 text-2xl font-medium">Генерации сайта, Telegram и workspace</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500">
                Здесь видно, что уже завершилось, что упало с ошибкой и что можно отменить до завершения.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadJobs()}
              disabled={jobsLoading}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              {jobsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" strokeWidth={1.7} />}
              Обновить
            </button>
          </div>
          {jobMessage ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-400">
              {jobMessage}
            </div>
          ) : null}
          <div className="mt-5 space-y-3">
            {jobsLoading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500">
                Загружаем задачи.
              </div>
            ) : jobs.length > 0 ? (
              jobs.slice(0, 5).map((job) => {
                const canCancel = job.status === "queued" || job.status === "running";
                return (
                  <article key={job.id} className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${jobStatusClass(job.status)}`}>
                          {job.status === "failed" ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {formatJobStatus(job.status)}
                        </span>
                        <span className="text-xs text-gray-600">{formatJobChannel(job.channel)}</span>
                        <span className="text-xs text-gray-600">{formatDate(job.createdAt)}</span>
                      </div>
                      <h3 className="mt-3 text-base font-medium text-white">{formatJobTitle(job)}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-gray-500">
                        {job.errorMessage || formatJobResult(job) || "Результат появится после завершения задачи."}
                      </p>
                    </div>
                    {canCancel ? (
                      <button
                        type="button"
                        onClick={() => void cancelJob(job.id)}
                        disabled={cancellingJobId === job.id}
                        className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-red-300/20 px-4 py-2 text-sm text-red-100/80 transition-colors hover:border-red-300/35 hover:text-red-50 disabled:opacity-50"
                      >
                        {cancellingJobId === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" strokeWidth={1.7} />}
                        Отменить
                      </button>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-gray-500">
                Задач пока нет. Они появятся после генерации сайта или Telegram mini app.
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.7} />
              Как теперь устроен B2B
            </div>
            <div className="mt-5 space-y-4">
              {[
                "Сайт и ИИ в Telegram создаются на отдельных страницах.",
                "Диалоги клиентов сохраняются отдельно: видны сообщения, возражения, интерес и оценка разговора.",
                "Telegram-менеджер принимает заявки и передает их человеку, когда нужен расчет.",
                "Аналитика сотрудников больше не смешана с созданием продуктов.",
                "Главная B2B-страница показывает только входы и краткое состояние.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.8} />
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <BarChart3 className="h-4 w-4" strokeWidth={1.7} />
              Текущая сводка
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {stats.length > 0 ? (
                stats.slice(0, 4).map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-2xl font-medium">{stat.value}</div>
                    <div className="mt-1 text-sm text-gray-300">{stat.label}</div>
                    <div className="mt-1 text-xs text-gray-500">{stat.detail}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500 md:col-span-2">
                  Сводка появится после загрузки бизнес API.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

function formatJobStatus(status: BusinessJobApiRecord["status"]) {
  const labels: Record<BusinessJobApiRecord["status"], string> = {
    queued: "В очереди",
    running: "В работе",
    succeeded: "Готово",
    failed: "Ошибка",
    cancelled: "Отменено",
  };
  return labels[status];
}

function jobStatusClass(status: BusinessJobApiRecord["status"]) {
  if (status === "succeeded") return "bg-emerald-400/10 text-emerald-100/80";
  if (status === "failed") return "bg-red-400/10 text-red-100/80";
  if (status === "cancelled") return "bg-white/10 text-gray-400";
  return "bg-amber-300/10 text-amber-100/80";
}

function formatJobChannel(channel: BusinessJobApiRecord["channel"]) {
  const labels: Record<BusinessJobApiRecord["channel"], string> = {
    website: "Сайт",
    telegram: "Telegram",
    email: "Email",
    crm: "CRM",
    internal: "Workspace",
  };
  return labels[channel];
}

function formatJobTitle(job: BusinessJobApiRecord) {
  const companyName = typeof job.payload.companyName === "string" ? job.payload.companyName : "";
  const capability: Record<BusinessJobApiRecord["capability"], string> = {
    website_generation: "Генерация сайта",
    bot_setup: "Настройка бота",
    campaign_generation: "Генерация рассылки",
    knowledge_ingest: "Индексация базы знаний",
    workspace_analysis: "Анализ workspace",
  };
  return [capability[job.capability], companyName].filter(Boolean).join(" · ");
}

function formatJobResult(job: BusinessJobApiRecord) {
  if (!job.result) return "";
  const result = job.result.result && typeof job.result.result === "object" ? job.result.result as Record<string, unknown> : job.result;
  const websiteId = typeof result.websiteId === "string" ? result.websiteId : "";
  const botName = typeof result.botName === "string" ? result.botName : "";
  const assistantSummary = typeof result.assistantSummary === "string" ? result.assistantSummary : "";
  if (assistantSummary) return assistantSummary;
  if (botName) return `Подготовлен черновик Telegram-бота: ${botName}.`;
  if (websiteId) return "Сайт собран и доступен в редакторе.";
  return "Задача завершена.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
