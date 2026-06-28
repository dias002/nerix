import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Copy,
  Clock3,
  Share2,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import ShareSheet, { type SharePayload } from "../components/ShareSheet";
import {
  addBusinessMember,
  getBusinessWorkspace,
  type BusinessRoleApiRecord,
  type BusinessRoleKey,
  type BusinessWorkspaceApiResponse,
  toPublicApiError,
} from "../api";
import { useAuth } from "../auth";

export default function BusinessEmployeeAnalytics() {
  const { user } = useAuth();
  const [workspaceData, setWorkspaceData] = useState<BusinessWorkspaceApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [activeRoleKey, setActiveRoleKey] = useState<BusinessRoleKey>("owner");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkEmail, setInviteLinkEmail] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    roleKey: "sales" as BusinessRoleKey,
    invitedEmail: "",
    roleTitle: "",
    access: "",
  });

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

  const openInvite = () => {
    if (!canManageBusiness) {
      setMessage("Приглашать сотрудников может владелец Business аккаунта или администратор.");
      return;
    }

    const defaultRole = roles.find((role) => role.key !== "owner") ?? roles[0];
    setInviteForm((current) => ({
      ...current,
      roleKey: defaultRole?.key ?? current.roleKey,
      roleTitle: defaultRole?.title ?? current.roleTitle,
      access: defaultRole ? defaultRole.permissions.join(", ") : current.access,
    }));
    setInviteError(null);
    setMessage(null);
    setInviteLink(null);
    setInviteLinkEmail(null);
    setInviteOpen(true);
  };

  const submitInvite = async () => {
    if (!inviteForm.name.trim()) {
      setInviteError("Укажите имя сотрудника.");
      return;
    }

    const invitedEmail = inviteForm.invitedEmail.trim().toLowerCase();
    if (!invitedEmail) {
      setInviteError("Укажите email сотрудника, чтобы он смог зарегистрироваться по invite-ссылке.");
      return;
    }
    if (!isEmailLike(invitedEmail)) {
      setInviteError("Проверьте email сотрудника.");
      return;
    }

    setInviteSubmitting(true);
    setInviteError(null);
    try {
      const updatedWorkspace = await addBusinessMember({
        name: inviteForm.name.trim(),
        roleKey: inviteForm.roleKey,
        invitedEmail,
        roleTitle: inviteForm.roleTitle.trim() || undefined,
        access: inviteForm.access.trim() || undefined,
      });
      const nextInviteLink = buildInviteLink(invitedEmail, inviteForm.roleKey);
      setWorkspaceData(updatedWorkspace);
      setInviteOpen(false);
      setInviteLink(nextInviteLink);
      setInviteLinkEmail(invitedEmail);
      setInviteForm({
        name: "",
        roleKey: "sales",
        invitedEmail: "",
        roleTitle: "",
        access: "",
      });
      setMessage("Сотрудник добавлен. Отправь ему invite-ссылку, чтобы он зарегистрировался сам.");
    } catch (error) {
      setInviteError(toPublicApiError(error, "Не удалось пригласить сотрудника."));
    } finally {
      setInviteSubmitting(false);
    }
  };

  const shareInvite = (link: string | null, email?: string | null) => {
    if (!link) return;
    setSharePayload({
      title: "Приглашение в nomduchat Business",
      text: email
        ? `Приглашение в workspace nomduchat для ${email}. Зарегистрируйтесь по ссылке:`
        : "Приглашение в workspace nomduchat. Зарегистрируйтесь по ссылке:",
      url: link,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-5 text-white md:p-10">
      <ShareSheet
        open={Boolean(sharePayload)}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
        onShared={setMessage}
      />
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
            onClick={openInvite}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            <UserPlus className="h-4 w-4" strokeWidth={1.8} />
            Пригласить сотрудника
          </button>
        </header>

        {inviteOpen ? (
          <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-medium">Новый сотрудник</h2>
                <p className="mt-2 text-sm text-gray-500">Добавим участника в текущий business workspace и назначим роль.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (inviteSubmitting) return;
                  setInviteOpen(false);
                  setInviteError(null);
                }}
                className="inline-flex w-fit items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm text-gray-400 transition-colors hover:border-white/20 hover:text-white"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-gray-400">Имя сотрудника</span>
                <input
                  value={inviteForm.name}
                  onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Например, Алина"
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#050505] px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-400">Email для приглашения</span>
                <input
                  value={inviteForm.invitedEmail}
                  onChange={(event) => setInviteForm((current) => ({ ...current, invitedEmail: event.target.value }))}
                  placeholder="name@company.com"
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#050505] px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-400">Роль</span>
                <select
                  value={inviteForm.roleKey}
                  onChange={(event) => {
                    const nextRoleKey = event.target.value as BusinessRoleKey;
                    const role = roles.find((candidate) => candidate.key === nextRoleKey);
                    setInviteForm((current) => ({
                      ...current,
                      roleKey: nextRoleKey,
                      roleTitle: role?.title ?? current.roleTitle,
                      access: role ? role.permissions.join(", ") : current.access,
                    }));
                  }}
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#050505] px-4 text-sm text-white outline-none transition-colors focus:border-white/25"
                >
                  {roles
                    .filter((role) => role.key !== "owner")
                    .map((role) => (
                      <option key={role.key} value={role.key}>
                        {role.title}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-gray-400">Название роли</span>
                <input
                  value={inviteForm.roleTitle}
                  onChange={(event) => setInviteForm((current) => ({ ...current, roleTitle: event.target.value }))}
                  placeholder="Менеджер продаж"
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#050505] px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-sm text-gray-400">Доступ</span>
              <textarea
                value={inviteForm.access}
                onChange={(event) => setInviteForm((current) => ({ ...current, access: event.target.value }))}
                placeholder="CRM, заявки, отчеты"
                className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-[#050505] px-4 py-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
              />
            </label>

            {inviteError ? (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {inviteError}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                disabled={inviteSubmitting}
                className="inline-flex items-center justify-center rounded-full border border-white/10 px-5 py-3 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void submitInvite()}
                disabled={inviteSubmitting}
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                {inviteSubmitting ? "Добавляем..." : "Добавить сотрудника"}
              </button>
            </div>
          </section>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-3 text-sm text-gray-400">
            {message}
          </div>
        ) : null}

        {inviteLink ? (
          <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-medium text-white">Invite-ссылка для сотрудника</div>
                <div className="mt-1 text-sm text-gray-500">
                  Сотрудник открывает ссылку, регистрируется с этим email и автоматически попадает в workspace.
                  {inviteLinkEmail ? <span className="text-gray-400"> Email: {inviteLinkEmail}</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => shareInvite(inviteLink, inviteLinkEmail)}
                  className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  <Share2 className="h-4 w-4" strokeWidth={1.7} />
                  Поделиться
                </button>
                <button
                  type="button"
                  onClick={() => void copyInviteLink(inviteLink, setMessage)}
                  className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  <Copy className="h-4 w-4" strokeWidth={1.7} />
                  Скопировать
                </button>
              </div>
            </div>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-[#050505] px-4 py-3 text-sm text-gray-400">
              {inviteLink}
            </div>
          </section>
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
                <div className="space-y-2 text-sm text-gray-500">
                  <div>{member.invitedEmail || "Аккаунт подключен"}</div>
                  {member.invitedEmail && !member.userId ? (
                    <button
                      type="button"
                      onClick={() => shareInvite(buildInviteLink(member.invitedEmail, member.roleKey), member.invitedEmail)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                    >
                      <Share2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                      Отправить invite
                    </button>
                  ) : null}
                </div>
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

function buildInviteLink(email: string, roleKey: BusinessRoleKey) {
  if (!email || typeof window === "undefined") return null;

  const url = new URL("/auth", window.location.origin);
  url.searchParams.set("mode", "register");
  url.searchParams.set("invite", "business");
  url.searchParams.set("email", email);
  url.searchParams.set("role", roleKey);
  return url.toString();
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function copyInviteLink(link: string | null, setMessage: (value: string | null) => void) {
  if (!link) return;

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(link);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = link;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setMessage("Invite-ссылка скопирована.");
  } catch {
    setMessage("Не удалось скопировать invite-ссылку.");
  }
}
