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
import { useAuth } from "../auth";
import PageHeader from "../components/workspace/PageHeader";
import { getWorkspaceAccess } from "../roleAccess";

export default function BusinessCabinet() {
  const { user } = useAuth();
  const access = useMemo(() => getWorkspaceAccess(user), [user]);
  const canManageBusiness = access.canUseBusinessWebsite || access.canUseBusinessTelegramBot || access.canUseBusinessIdeas;
  const [workspaceData, setWorkspaceData] = useState<BusinessWorkspaceApiResponse | null>(null);
  const [jobs, setJobs] = useState<BusinessJobApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (!canManageBusiness) {
      setJobs([]);
      setJobsLoading(false);
      return;
    }

    setJobsLoading(true);
    try {
      const response = await getBusinessJobs();
      setJobs(response.jobs);
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [canManageBusiness]);

  useEffect(() => {
    let cancelled = false;

    if (!access.canUseBusiness) {
      setWorkspaceData(null);
      setLoading(false);
      void loadJobs();
      return () => {
        cancelled = true;
      };
    }

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
  }, [access.canUseBusiness, loadJobs]);

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
  const advisorCount = access.canUseBusinessIdeas
    ? workspaceData?.advisorViews.reduce((sum, view) => sum + view.ideas.length, 0) ?? 0
    : 0;
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
      access.canUseBusinessIdeas ? {
        label: "Идеи",
        value: String(advisorCount),
        detail: "для роста",
      } : {
        label: "Чаты",
        value: String(reports.reduce((sum, report) => sum + report.chatsCount, 0)),
        detail: "в работе команды",
      },
    ],
    [access.canUseBusinessIdeas, advisorCount, deals.length, members, reports]
  );
  const visibleFeatureNotes = [
    access.canUseBusinessWebsite ? "Сайт создается на отдельной странице." : null,
    access.canUseBusinessTelegramBot ? "ИИ в Telegram создается и настраивается владельцем." : null,
    access.canUseBusinessDialogs ? "Диалоги клиентов сохраняются отдельно: видны сообщения, возражения, интерес и следующий шаг." : null,
    access.canUseBusinessAnalytics ? "Аналитика сотрудников показывает отчеты и состояние команды." : null,
    access.canUseBusinessIdeas ? "Идеи роста доступны владельцу для планирования изменений." : null,
  ].filter(Boolean) as string[];
  const visibleSectionNames = [
    access.canUseBusinessWebsite ? "сайт" : null,
    access.canUseBusinessTelegramBot ? "ИИ в Telegram" : null,
    access.canUseBusinessDialogs ? "диалоги клиентов" : null,
    access.canUseBusinessAnalytics ? "аналитика сотрудников" : null,
    access.canUseBusinessIdeas ? "идеи роста" : null,
  ].filter(Boolean).join(", ");
  const b2bReadiness = [
    {
      title: "AI-сайт внутри nomduchat",
      status: "works" as const,
      text: "Черновик, редактор, публикация и публичный адрес /site/slug уже работают. Клиент не ищет хостинг.",
      path: "/workspace/business/website",
      action: "Открыть сайты",
      visible: access.canUseBusinessWebsite,
    },
    {
      title: "Свои домены и автопокупка",
      status: "setup" as const,
      text: "Внутренний адрес работает. Для автоматической покупки домена нужен подключенный регистратор, оплата и подтверждение владельца.",
      visible: access.canUseBusinessWebsite,
    },
    {
      title: "Telegram-менеджер",
      status: "partial" as const,
      text: "Опрос, заявка, prompt и тест ответа готовы. Автоподключение живого бота к Telegram пока отдельный этап.",
      path: "/workspace/business/telegram-bot",
      action: "Открыть Telegram",
      visible: access.canUseBusinessTelegramBot,
    },
    {
      title: "Диалоги и обучение команды",
      status: "works" as const,
      text: "Диалоги клиентов, сообщения, оценка качества и сигналы для обучения сохраняются в business workspace.",
      path: "/workspace/business/dialogs",
      action: "Открыть диалоги",
      visible: access.canUseBusinessDialogs,
    },
    {
      title: "Аналитика сайта",
      status: "setup" as const,
      text: "Страница аналитики есть. Для реальных визитов, UTM и конверсий нужен tracker на публичных сайтах.",
      path: "/workspace/business/analytics",
      action: "Открыть аналитику",
      visible: access.canUseBusinessAnalytics,
    },
  ].filter((item) => item.visible);

  return (
    <div className="ns-page-scroll">
      <div className="ns-page space-y-8">
        <PageHeader
          overline={`Business · ${accessLabel}`}
          title="Бизнес-кабинет"
          subtitle="Операционный центр для сайтов, Telegram, диалогов клиентов, аналитики и AI-задач команды."
          actions={
            <div className="flex flex-wrap gap-2">
              {access.canUseBusinessWebsite ? (
                <Link to="/workspace/business/website" className="nd-primary-action inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-medium">
                  <Globe className="h-4 w-4" strokeWidth={1.8} />
                  Создать сайт
                </Link>
              ) : null}
              {access.canUseBusinessDialogs ? (
                <Link to="/workspace/business/dialogs" className="nd-secondary-action inline-flex h-11 items-center justify-center gap-2 px-5 text-sm">
                  <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
                  Диалоги
                </Link>
              ) : null}
            </div>
          }
        />

        <section className="ns-kpi-grid">
          {topStats.map((stat, index) => (
            <article key={stat.label} className="ns-metric-card p-5" data-primary={index === 0}>
              <div className="text-4xl font-medium text-[var(--text-primary)]">{stat.value}</div>
              <div className="mt-3 text-sm font-medium text-[var(--text-primary)]">{stat.label}</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="ns-business-panel p-5">
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <BriefcaseBusiness className="h-4 w-4" strokeWidth={1.7} />
              Навигация Business тарифа
            </div>
            <h2 className="mt-3 text-2xl font-medium text-[var(--text-primary)]">Разделы вынесены в левое меню</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
              Доступные разделы: {visibleSectionNames || "business-обзор"}. Главный экран остается обзором состояния, задач и ограничений.
            </p>
            <div className="mt-5 space-y-3">
              {visibleFeatureNotes.length > 0 ? visibleFeatureNotes.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                  <span className="ns-signal-dot mt-1.5" />
                  {item}
                </div>
              )) : (
                <div className="rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-secondary)]">
                  Business-функции откроются после подключения тарифа и роли.
                </div>
              )}
            </div>
          </article>

          <article className="ns-business-panel p-5">
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <BarChart3 className="h-4 w-4" strokeWidth={1.7} />
              Текущая сводка
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {stats.length > 0 ? (
                stats.slice(0, 4).map((stat) => (
                  <div key={stat.label} className="rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-2)] p-4">
                    <div className="text-2xl font-medium text-[var(--text-primary)]">{stat.value}</div>
                    <div className="mt-1 text-sm text-[var(--text-primary)]">{stat.label}</div>
                    <div className="mt-1 text-xs text-[var(--text-tertiary)]">{stat.detail}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-secondary)] md:col-span-2">
                  Сводка появится после загрузки бизнес API.
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="ns-business-panel p-5">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <AlertCircle className="h-4 w-4" strokeWidth={1.7} />
            Карта B2B-запуска
          </div>
          <h2 className="mt-3 text-2xl font-medium text-[var(--text-primary)]">Что работает и что нужно настроить</h2>
          <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {b2bReadiness.map((item) => (
              <article key={item.title} className="ns-readiness-card p-4" data-active={item.status === "works"}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${readinessClass(item.status)}`}>
                      {readinessLabel(item.status)}
                    </span>
                    <h3 className="mt-3 text-base font-medium text-[var(--text-primary)]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.text}</p>
                  </div>
                  {item.path && item.action ? (
                    <Link to={item.path} className="nd-secondary-action inline-flex h-10 shrink-0 items-center justify-center px-4 text-sm">
                      {item.action}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        {canManageBusiness ? (
          <section className="ns-business-panel p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                  <Activity className="h-4 w-4" strokeWidth={1.7} />
                  Последние задачи
                </div>
                <h2 className="mt-3 text-2xl font-medium text-[var(--text-primary)]">Генерации сайта, Telegram и workspace</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
                  Видно, что завершилось, что упало с ошибкой и что можно отменить до завершения.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadJobs()}
                disabled={jobsLoading}
                className="nd-secondary-action inline-flex h-10 w-fit items-center justify-center gap-2 px-4 text-sm disabled:opacity-50"
              >
                {jobsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" strokeWidth={1.7} />}
                Обновить
              </button>
            </div>
            {jobMessage ? (
              <div className="mt-4 rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                {jobMessage}
              </div>
            ) : null}
            <div className="mt-5 space-y-3">
              {jobsLoading ? (
                <div className="rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-secondary)]">
                  Загружаем задачи.
                </div>
              ) : jobs.length > 0 ? (
                jobs.slice(0, 5).map((job) => {
                  const canCancel = job.status === "queued" || job.status === "running";
                  return (
                    <article key={job.id} className="grid grid-cols-1 gap-4 rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-2)] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${jobStatusClass(job.status)}`}>
                            {job.status === "failed" ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            {formatJobStatus(job.status)}
                          </span>
                          <span className="text-xs text-[var(--text-tertiary)]">{formatJobChannel(job.channel)}</span>
                          <span className="text-xs text-[var(--text-tertiary)]">{formatDate(job.createdAt)}</span>
                        </div>
                        <h3 className="mt-3 text-base font-medium text-[var(--text-primary)]">{formatJobTitle(job)}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                          {job.errorMessage || formatJobResult(job) || "Результат появится после завершения задачи."}
                        </p>
                      </div>
                      {canCancel ? (
                        <button
                          type="button"
                          onClick={() => void cancelJob(job.id)}
                          disabled={cancellingJobId === job.id}
                          className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius-control)] border border-red-300/20 px-4 text-sm text-red-100/80 transition-colors hover:border-red-300/35 hover:text-red-50 disabled:opacity-50"
                        >
                          {cancellingJobId === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" strokeWidth={1.7} />}
                          Отменить
                        </button>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="rounded-[var(--radius-input)] border border-dashed border-[var(--line-default)] p-4 text-sm text-[var(--text-secondary)]">
                  Задач пока нет. Они появятся после генерации сайта или Telegram mini app.
                </div>
              )}
            </div>
          </section>
        ) : null}
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

function readinessLabel(status: "works" | "partial" | "setup") {
  const labels = {
    works: "Работает",
    partial: "Частично",
    setup: "Нужно настроить",
  };
  return labels[status];
}

function readinessClass(status: "works" | "partial" | "setup") {
  if (status === "works") return "bg-emerald-400/10 text-emerald-100/80";
  if (status === "partial") return "bg-amber-300/10 text-amber-100/80";
  return "bg-white/10 text-gray-400";
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
