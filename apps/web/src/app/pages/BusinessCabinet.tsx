import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  FileText,
  Globe,
  Lightbulb,
  LineChart,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";
import {
  addBusinessDealNote,
  getBusinessWorkspace,
  type BusinessRoleKey,
  type BusinessWorkspaceApiResponse,
} from "../api";
import { useAuth } from "../auth";

type RoleKey = BusinessRoleKey;

const statIcons = [Users, MessageSquare, LineChart, Clock3];
const paidServiceIcons = [Bot, Workflow, Globe, BarChart3];
const paidServiceIconMap = {
  bot: Bot,
  sales: Workflow,
  site: Globe,
  analytics: BarChart3,
};

export default function BusinessCabinet() {
  const { user } = useAuth();
  const [workspaceData, setWorkspaceData] = useState<BusinessWorkspaceApiResponse | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activeRoleKey, setActiveRoleKey] = useState<RoleKey>("owner");
  const [selectedDealId, setSelectedDealId] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getBusinessWorkspace()
      .then((workspace) => {
        if (cancelled) return;
        setWorkspaceData(workspace);
        setWorkspaceError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspaceError("Не удалось загрузить реальные данные бизнес-кабинета из API.");
      })
      .finally(() => {
        if (!cancelled) setWorkspaceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const rolesData = workspaceData?.roles ?? [];
  const employeesData =
    workspaceData?.members.map((employee) => ({
      name: employee.name,
      role: employee.roleTitle,
      access: employee.access,
      status: employee.status,
    })) ?? [];
  const statsData =
    workspaceData?.stats.map((item, index) => ({
      ...item,
      icon: statIcons[index] ?? Activity,
    })) ?? [];
  const knowledgeSourcesData = workspaceData?.knowledgeSources ?? [];
  const paidServicesData =
    workspaceData?.paidServices.map((service, index) => ({
      ...service,
      icon:
        paidServiceIconMap[service.icon as keyof typeof paidServiceIconMap] ??
        paidServiceIcons[index] ??
        Bot,
    })) ?? [];
  const pipelineData = workspaceData?.pipeline ?? [];
  const dealsData = workspaceData?.deals ?? [];
  const customerSignalsData = workspaceData?.customerSignals ?? [];
  const trafficSourcesData = workspaceData?.trafficSources ?? [];
  const advisorViewsData = workspaceData?.advisorViews ?? [];
  const groupsData = workspaceData?.groups ?? [];
  const employeeReportsData = workspaceData?.employeeReports ?? [];
  const accessLabel =
    workspaceData?.access.mode === "active"
      ? "кабинет активен"
      : workspaceLoading
        ? "загрузка API"
        : "данные не загружены";
  const canManageBusiness = !user || user.permissions.businessSettings;

  useEffect(() => {
    if (!selectedDealId && dealsData[0]) {
      setSelectedDealId(dealsData[0].id);
    }
  }, [dealsData, selectedDealId]);

  const activeRole = useMemo(
    () => rolesData.find((role) => role.key === activeRoleKey) ?? rolesData[0],
    [activeRoleKey, rolesData]
  );
  const selectedDeal = useMemo(
    () => dealsData.find((deal) => deal.id === selectedDealId) ?? dealsData[0],
    [dealsData, selectedDealId]
  );
  const selectedNotes = selectedDeal?.notes.map((note) => note.text) ?? [];

  const addNote = async () => {
    const trimmed = noteDraft.trim();
    if (!trimmed) return;

    if (!workspaceData || !selectedDeal) {
      setWorkspaceError("Сначала загрузите реальные данные CRM из API.");
      return;
    }

    setNoteSaving(true);
    try {
      const updatedWorkspace = await addBusinessDealNote(selectedDeal.id, trimmed);
      setWorkspaceData(updatedWorkspace);
      setWorkspaceError(null);
    } catch {
      setWorkspaceError("Не удалось сохранить пометку в API.");
    } finally {
      setNoteSaving(false);
      setNoteDraft("");
    }
  };

  const handleInviteClick = () => {
    if (!canManageBusiness) {
      setInviteMessage("Приглашать сотрудников может владелец Business аккаунта или администратор.");
      return;
    }

    setInviteMessage(
      employeesData.length >= 5
        ? "В Business уже заняты все 5 мест. Для следующего тарифа нужно расширение лимита."
        : "Приглашение сотрудника будет отправлено с главного аккаунта, где оформлена подписка."
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-5 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
                <BriefcaseBusiness className="h-4 w-4" strokeWidth={1.7} />
                Business тариф: кабинет, роли, CRM и агент компании · {accessLabel}
              </div>
              <h1 className="text-3xl font-medium text-white md:text-5xl">Бизнес-кабинет Nerix</h1>
              <p className="mt-4 text-base leading-relaxed text-gray-400 md:text-lg">
                Кабинет, который открывается после оформления Business тарифа. Внутри команда до 5 сотрудников, рабочий чат по данным компании, CRM-воронка, аналитика сайта и заметки по клиентским обращениям.
              </p>
              {workspaceError ? <p className="mt-3 text-sm text-gray-500">{workspaceError}</p> : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/workspace/balance"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 sm:whitespace-nowrap"
              >
                Оформить Business
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
              <Link
                to="/workspace/chat"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white sm:whitespace-nowrap"
              >
                Открыть бизнес-чат
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statsData.length > 0 ? statsData.map((item, index) => (
              <motion.article
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
                className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5"
              >
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                  <item.icon className="h-5 w-5" strokeWidth={1.6} />
                </div>
                <div className="text-3xl font-medium text-white">{item.value}</div>
                <div className="mt-2 text-sm font-medium text-gray-300">{item.label}</div>
                <div className="mt-1 text-sm text-gray-500">{item.detail}</div>
              </motion.article>
            )) : (
              <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 text-sm text-gray-500 sm:col-span-2 xl:col-span-4">
                Показатели кабинета загрузятся из бизнес API.
              </div>
            )}
          </div>
        </motion.header>

        <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black shadow-[0_0_34px_rgba(255,255,255,0.34)]">
              <Lightbulb className="h-7 w-7 text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.85)]" strokeWidth={1.7} />
            </div>
            <div>
              <div className="text-sm text-gray-500">Отдельная страница без пункта в левом меню</div>
              <h2 className="mt-2 text-2xl font-medium text-white">Идеи и подсказки для роста</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
                Разбор заявок, сайта, CRM и диалогов вынесен на отдельный экран. Там удобнее смотреть направления, выбирать идеи и собирать план действий.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {advisorViewsData.map((view) => (
                  <span key={view.key} className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-400">
                    {view.title}
                  </span>
                ))}
              </div>
            </div>
            <Link
              to="/workspace/business/ideas"
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              Открыть идеи
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.95fr]">
          <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="h-4 w-4" strokeWidth={1.7} />
                  Доступ выдается с аккаунта, где оформлена подписка
                </div>
                <h2 className="mt-2 text-2xl font-medium text-white">Команда и сотрудники</h2>
              </div>
              <button
                type="button"
                onClick={handleInviteClick}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
              >
                <UserPlus className="h-4 w-4" strokeWidth={1.7} />
                Пригласить
              </button>
            </div>
            {inviteMessage ? <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-400">{inviteMessage}</div> : null}
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {employeesData.length > 0 ? employeesData.map((employee, index) => (
                <div
                  key={employee.name}
                  className={`grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_0.8fr_1fr_auto] sm:items-center ${
                    index !== employeesData.length - 1 ? "border-b border-white/10" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium text-white">{employee.name}</div>
                    <div className="mt-1 text-sm text-gray-500">{employee.role}</div>
                  </div>
                  <div className="text-sm text-gray-400">{employee.access}</div>
                  <div className="text-sm text-gray-500">Рабочий чат и CRM</div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        employee.status === "online"
                          ? "bg-emerald-400"
                          : employee.status === "away"
                            ? "bg-amber-400"
                            : "bg-gray-600"
                      }`}
                    />
                    {employee.status === "online" ? "в сети" : employee.status === "away" ? "занят" : "офлайн"}
                  </div>
                </div>
              )) : (
                <div className="p-4 text-sm text-gray-500">Сотрудники загрузятся из бизнес API.</div>
              )}
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm text-gray-500">Автоматическая группа</div>
                <h3 className="mt-2 text-lg font-medium text-white">{groupsData[0]?.name ?? "Общая группа"}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {groupsData[0]?.purpose ?? "Владелец задает название, а сотрудники получают общий контекст компании."}
                </p>
                <div className="mt-4 text-sm text-gray-400">
                  Участников: {groupsData[0]?.memberIds.length ?? employeesData.length}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm text-gray-500">Отчеты за сегодня</div>
                <div className="mt-3 space-y-3">
                  {employeeReportsData.length > 0 ? employeeReportsData.slice(0, 3).map((report) => (
                    <div key={report.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-white/10 bg-black px-3 py-3 text-sm">
                      <div>
                        <div className="font-medium text-white">{report.employeeName}</div>
                        <div className="mt-1 text-gray-500">{report.roleTitle}</div>
                      </div>
                      <div className="text-right text-gray-400">
                        <div>{report.requestsCount} запросов</div>
                        <div className="mt-1 text-gray-600">{report.clientReportsCount} отчетов</div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-gray-500">
                      Отчеты сотрудников появятся после рабочих действий.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.7} />
              Роли можно показать клиенту как будущую структуру доступа
            </div>
            <h2 className="text-2xl font-medium text-white">Роли и права</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {rolesData.map((role) => (
                <button
                  key={role.key}
                  type="button"
                  onClick={() => setActiveRoleKey(role.key)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    activeRole?.key === role.key
                      ? "border-white/30 bg-white text-black"
                      : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {role.title}
                </button>
              ))}
            </div>
            {activeRole ? (
              <div className="mt-5">
                <h3 className="text-lg font-medium text-white">{activeRole.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{activeRole.description}</p>
                <div className="mt-5 space-y-3">
                  {activeRole.permissions.map((permission) => (
                    <div key={permission} className="flex items-start gap-3 text-sm text-gray-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.8} />
                      <span>{permission}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500">
                Роли загрузятся из бизнес API.
              </div>
            )}
          </article>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
              <Sparkles className="h-5 w-5" strokeWidth={1.7} />
            </div>
            <h2 className="text-2xl font-medium text-white">Агент по данным компании</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              Агент работает с сайтом, услугами, прайсом, CRM-статусами и прошлым общением с клиентами. Команда подключает его к базе знаний и развивает до бота или ассистента продаж.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {knowledgeSourcesData.length > 0 ? knowledgeSourcesData.map((source) => (
                <div key={source} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-gray-300">
                  <Database className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.7} />
                  {source}
                </div>
              )) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-gray-500 sm:col-span-2">
                  Источники знаний загрузятся из бизнес API.
                </div>
              )}
            </div>
          </article>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-gray-400" strokeWidth={1.7} />
              <h2 className="text-2xl font-medium text-white">Что можно подключить за плату</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {paidServicesData.length > 0 ? paidServicesData.map((service) => (
                <article key={service.title} className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                    <service.icon className="h-5 w-5" strokeWidth={1.6} />
                  </div>
                  <h3 className="text-lg font-medium text-white">{service.title}</h3>
                  <div className="mt-2 text-sm text-gray-400">{service.price}</div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">{service.text}</p>
                </article>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 text-sm text-gray-500 md:col-span-2">
                  Платные подключения загрузятся из бизнес API.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Workflow className="h-4 w-4" strokeWidth={1.7} />
                Пример CRM для заявок из сайта, бота и рекламы
              </div>
              <h2 className="mt-2 text-2xl font-medium text-white">Воронка продаж</h2>
            </div>
            <Link
              to="/workspace/chat"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              Спросить по сделкам
              <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {pipelineData.length > 0 ? pipelineData.map((stage, index) => (
              <article key={stage.title} className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4">
                <div className="text-sm text-gray-500">0{index + 1}</div>
                <h3 className="mt-3 text-base font-medium text-white">{stage.title}</h3>
                <div className="mt-4 text-2xl font-medium text-white">{stage.count}</div>
                <div className="mt-1 text-sm text-gray-500">{stage.amount}</div>
              </article>
            )) : (
              <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 text-sm text-gray-500 md:col-span-2 xl:col-span-4">
                Воронка продаж загрузится из бизнес API.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.85fr]">
            <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]">
              {dealsData.length > 0 ? dealsData.map((deal, index) => {
                const selected = selectedDeal?.id === deal.id;
                return (
                  <button
                    key={deal.id}
                    type="button"
                    onClick={() => setSelectedDealId(deal.id)}
                    className={`block w-full p-5 text-left transition-colors ${
                      selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    } ${index !== dealsData.length - 1 ? "border-b border-white/10" : ""}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-lg font-medium text-white">{deal.client}</div>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500">{deal.request}</p>
                      </div>
                      <div className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-sm text-gray-300">
                        {deal.stage}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-400 sm:grid-cols-3">
                      <span>{deal.amount}</span>
                      <span>Источник: {deal.source}</span>
                      <span>{selected ? "Открыто" : "Открыть карточку"}</span>
                    </div>
                  </button>
                );
              }) : (
                <div className="p-5 text-sm text-gray-500">CRM-сделки загрузятся из бизнес API.</div>
              )}
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileText className="h-4 w-4" strokeWidth={1.7} />
                Карточка клиента
              </div>
              {selectedDeal ? (
                <>
                  <h3 className="mt-3 text-2xl font-medium text-white">{selectedDeal.client}</h3>
                  <div className="mt-4 space-y-3 text-sm leading-relaxed">
                    <p className="text-gray-400">
                      <span className="text-gray-500">Следующий шаг: </span>
                      {selectedDeal.nextStep}
                    </p>
                    <p className="text-gray-400">
                      <span className="text-gray-500">Проблема: </span>
                      {selectedDeal.problem}
                    </p>
                  </div>
                  <div className="mt-5 space-y-3">
                    {selectedNotes.map((note) => (
                      <div key={note} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm leading-relaxed text-gray-300">
                        {note}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500">
                  Выберите сделку после загрузки CRM из API.
                </div>
              )}
              <div className="mt-5 space-y-3">
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  disabled={!selectedDeal || !workspaceData}
                  placeholder="Добавьте проблему, договоренность или пометку по клиенту"
                  className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-white/25"
                />
                <button
                  type="button"
                  onClick={addNote}
                  disabled={!noteDraft.trim() || noteSaving || !selectedDeal || !workspaceData}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.8} />
                  {noteSaving ? "Сохраняю" : "Добавить пометку"}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
              <Activity className="h-4 w-4" strokeWidth={1.7} />
              Метрики сайта и созданного бота
            </div>
            <h2 className="text-2xl font-medium text-white">Аналитика</h2>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {statsData.length > 0 ? (
                statsData.slice(0, 4).map((item) => (
                  <div key={item.label}>
                    <div className="text-3xl font-medium text-white">{item.value}</div>
                    <div className="mt-1 text-sm text-gray-500">{item.label}</div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500">
                  Аналитика сайта и бота загрузится из бизнес API.
                </div>
              )}
            </div>
            <div className="mt-6 space-y-4">
              {trafficSourcesData.length > 0 ? trafficSourcesData.map((item) => (
                <div key={item.source}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-gray-400">{item.source}</span>
                    <span className="text-gray-500">{item.value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-white" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500">
                  Источники трафика загрузятся из бизнес API.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
              <Tags className="h-4 w-4" strokeWidth={1.7} />
              Система отмечает проблемы и повторяющиеся темы
            </div>
            <h2 className="text-2xl font-medium text-white">Сигналы по клиентам</h2>
            <div className="mt-6 space-y-4">
              {customerSignalsData.length > 0 ? customerSignalsData.map((signal) => (
                <div key={signal.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs text-gray-400">
                    {signal.tag}
                  </div>
                  <h3 className="text-base font-medium text-white">{signal.title}</h3>
                  <p className="mt-2 text-sm text-gray-500">{signal.detail}</p>
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-300">
                    <Sparkles className="h-4 w-4 text-gray-500" strokeWidth={1.7} />
                    {signal.tone}
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500">
                  Сигналы по клиентам загрузятся из бизнес API.
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Building2 className="h-4 w-4" strokeWidth={1.7} />
                Как это выглядит для клиента после подписки
              </div>
              <h2 className="mt-3 text-2xl font-medium text-white">Business открывает рабочий кабинет</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
                Главный аккаунт оформляет тариф, приглашает сотрудников, выдает роли и подключает агента компании. После этого команда работает с заявками, чатом, аналитикой и заметками в одном месте.
              </p>
            </div>
            <Link
              to="/workspace/chat"
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              <Send className="h-4 w-4" strokeWidth={1.8} />
              Запросить настройку
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function appendWorkspaceNote(
  workspace: BusinessWorkspaceApiResponse,
  dealId: string,
  text: string
): BusinessWorkspaceApiResponse {
  const now = new Date().toISOString();

  return {
    ...workspace,
    workspace: {
      ...workspace.workspace,
      updatedAt: now,
    },
    deals: workspace.deals.map((deal) =>
      deal.id === dealId
        ? {
            ...deal,
            updatedAt: now,
            notes: [
              ...deal.notes,
              {
                id: `local-${Date.now()}`,
                dealId,
                text,
                createdAt: now,
              },
            ],
          }
        : deal
    ),
  };
}
