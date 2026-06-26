import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import {
  getBusinessWorkspace,
  type BusinessRoleApiRecord,
  type BusinessRoleKey,
  type BusinessWorkspaceApiResponse,
} from "../api";
import { useAuth } from "../auth";

export default function BusinessEmployeeAnalytics() {
  const { user } = useAuth();
  const [workspaceData, setWorkspaceData] = useState<BusinessWorkspaceApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [activeRoleKey, setActiveRoleKey] = useState<BusinessRoleKey>("owner");

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

    return () => {
      cancelled = true;
    };
  }, []);

  const members = workspaceData?.members ?? [];
  const reports = workspaceData?.employeeReports ?? [];
  const roles = workspaceData?.roles ?? [];
  const groups = workspaceData?.groups ?? [];
  const canManageBusiness = !user || user.permissions.businessSettings;
  const activeRole = useMemo(
    () => roles.find((role) => role.key === activeRoleKey) ?? roles[0],
    [activeRoleKey, roles]
  );
  const totalRequests = reports.reduce((sum, report) => sum + report.requestsCount, 0);
  const totalChats = reports.reduce((sum, report) => sum + report.chatsCount, 0);
  const totalClientReports = reports.reduce((sum, report) => sum + report.clientReportsCount, 0);
  const onlineCount = members.filter((member) => member.status === "online").length;

  const invite = () => {
    setMessage(
      canManageBusiness
        ? "Приглашение будет доступно владельцу Business аккаунта. Сейчас экран показывает структуру доступа и аналитику."
        : "Приглашать сотрудников может владелец Business аккаунта или администратор."
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-5 text-white md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              to="/workspace/business"
              className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              Назад в B2B
            </Link>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
              <Users className="h-4 w-4" strokeWidth={1.7} />
              Команда, роли и эффективность
            </div>
            <h1 className="mt-4 text-3xl font-medium md:text-5xl">Аналитика сотрудников</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-400">
              Отдельный экран для контроля работы команды: кто в сети, сколько обработано запросов, какие роли выданы и какие отчеты появились за день.
            </p>
          </div>
          <button
            type="button"
            onClick={invite}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            <UserPlus className="h-4 w-4" strokeWidth={1.8} />
            Пригласить сотрудника
          </button>
        </header>

        {message ? (
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-3 text-sm text-gray-400">
            {message}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Users} label="Сотрудники" value={String(members.length || 0)} detail={`${onlineCount} сейчас в сети`} />
          <Metric icon={BarChart3} label="Запросы" value={String(totalRequests)} detail="за текущий день" />
          <Metric icon={Clock3} label="Чаты" value={String(totalChats)} detail="диалоги в работе" />
          <Metric icon={CheckCircle2} label="Отчеты" value={String(totalClientReports)} detail="клиентские итоги" />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]">
            <div className="border-b border-white/10 p-5">
              <h2 className="text-2xl font-medium">Отчеты сотрудников</h2>
              <p className="mt-2 text-sm text-gray-500">Сводка по действиям, чатам и клиентским отчетам.</p>
            </div>
            {loading ? (
              <div className="p-5 text-sm text-gray-500">Загружаем аналитику...</div>
            ) : reports.length > 0 ? (
              reports.map((report, index) => (
                <div
                  key={report.id}
                  className={`grid grid-cols-1 gap-4 p-5 md:grid-cols-[1fr_auto] ${
                    index !== reports.length - 1 ? "border-b border-white/10" : ""
                  }`}
                >
                  <div>
                    <div className="text-lg font-medium">{report.employeeName}</div>
                    <div className="mt-1 text-sm text-gray-500">{report.roleTitle}</div>
                    <p className="mt-3 text-sm leading-relaxed text-gray-400">{report.summary}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center md:w-72">
                    <MiniMetric label="Запросы" value={report.requestsCount} />
                    <MiniMetric label="Чаты" value={report.chatsCount} />
                    <MiniMetric label="Отчеты" value={report.clientReportsCount} />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-5 text-sm text-gray-500">Отчеты появятся после рабочих действий сотрудников.</div>
            )}
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.7} />
              Роли и доступы
            </div>
            <h2 className="mt-2 text-2xl font-medium">Кто что может делать</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {roles.length > 0 ? (
                roles.map((role) => (
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
                ))
              ) : (
                <div className="col-span-2 text-sm text-gray-500">Роли загрузятся из API.</div>
              )}
            </div>
            {activeRole ? <RoleDetails role={activeRole} /> : null}

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-gray-500">Группа</div>
              <div className="mt-2 text-lg font-medium">{groups[0]?.name ?? "Общая группа"}</div>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {groups[0]?.purpose ?? "Сюда попадает команда, которая работает с заявками, CRM и AI-агентом компании."}
              </p>
            </div>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-2xl font-medium">Команда</h2>
          </div>
          {members.length > 0 ? (
            members.map((member, index) => (
              <div
                key={member.id}
                className={`grid grid-cols-1 gap-3 p-5 md:grid-cols-[1fr_0.8fr_1fr_auto] md:items-center ${
                  index !== members.length - 1 ? "border-b border-white/10" : ""
                }`}
              >
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="mt-1 text-sm text-gray-500">{member.roleTitle}</div>
                </div>
                <div className="text-sm text-gray-400">{member.access}</div>
                <div className="text-sm text-gray-500">{member.invitedEmail || "Аккаунт подключен"}</div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusColor(member.status)}`} />
                  {member.status === "online" ? "в сети" : member.status === "away" ? "занят" : "офлайн"}
                </div>
              </div>
            ))
          ) : (
            <div className="p-5 text-sm text-gray-500">Список сотрудников загрузится из API.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <div className="text-3xl font-medium">{value}</div>
      <div className="mt-2 text-sm font-medium text-gray-300">{label}</div>
      <div className="mt-1 text-sm text-gray-500">{detail}</div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="text-xl font-medium">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{label}</div>
    </div>
  );
}

function RoleDetails({ role }: { role: BusinessRoleApiRecord }) {
  return (
    <div className="mt-5">
      <h3 className="text-lg font-medium">{role.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">{role.description}</p>
      <div className="mt-5 space-y-3">
        {role.permissions.map((permission) => (
          <div key={permission} className="flex items-start gap-3 text-sm text-gray-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.8} />
            <span>{permission}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusColor(status: string) {
  if (status === "online") return "bg-emerald-400";
  if (status === "away") return "bg-amber-400";
  return "bg-gray-600";
}
