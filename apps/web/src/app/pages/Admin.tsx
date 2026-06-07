import { useEffect, useMemo, useState, type ComponentType, type FormEvent } from "react";
import {
  Activity,
  Brain,
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  DollarSign,
  FileText,
  FolderKanban,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Save,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  getAdminUsers,
  getAdminOverview,
  toPublicApiError,
  updateAdminPlanPrice,
  type AdminOverviewApiResponse,
  type AdminPricingApiRecord,
  type AdminUsersApiResponse,
  type PlanId,
} from "../api";
import { useAuth } from "../auth";
import { useSearchParams } from "react-router";

type AdminTab = "direction" | "users" | "memory" | "pricing";

const statusClass = {
  good: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  attention: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  risk: "border-red-400/20 bg-red-400/10 text-red-100",
};

export default function Admin() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tabFromUrl = readAdminTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<AdminTab>(tabFromUrl);
  const [overview, setOverview] = useState<AdminOverviewApiResponse | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUsersApiResponse | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [savingPrice, setSavingPrice] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const emptyOverview = useMemo(createEmptyAdminOverview, []);
  const emptyUsers = useMemo(() => createEmptyAdminUsers(userSearch), [userSearch]);
  const effectiveOverview = overview ?? emptyOverview;
  const effectiveUsers = adminUsers ?? emptyUsers;

  const pricing = effectiveOverview.pricing;
  const memory = effectiveOverview.memory;
  const direction = effectiveOverview.businessDirection;
  const paymentReport = effectiveOverview.paymentReport;
  const header = adminHeader(activeTab);

  const memoryStats = useMemo(
    () => [
      { label: "Чатов в базе", value: formatNumber(memory.totalChats), detail: "Содержимое не раскрывается", icon: Database },
      { label: "Сообщений", value: formatNumber(memory.totalMessages), detail: "Только количество", icon: Activity },
      { label: "Сжатых summary", value: formatNumber(memory.summarizedChats), detail: "Подготовлено для памяти", icon: Brain },
      { label: "Элементов памяти", value: formatNumber(memory.memoryItems), detail: "Факты и контекст", icon: Lock },
    ],
    [memory]
  );

  useEffect(() => {
    void loadOverview();
  }, [user?.permissions.adminPanel]);

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    if (activeTab === "users") {
      void loadUsers(userSearch);
    }
  }, [activeTab, user?.permissions.adminPanel]);

  useEffect(() => {
    setDraftPrices(priceDrafts(pricing));
  }, [pricing]);

  const loadOverview = async () => {
    if (!user?.permissions.adminPanel) {
      setOverview(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setOverview(await getAdminOverview());
    } catch {
      setOverview(null);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (query = userSearch) => {
    if (!user?.permissions.adminPanel) {
      setAdminUsers(null);
      setUsersLoading(false);
      return;
    }

    setUsersLoading(true);
    setUsersError(null);
    try {
      setAdminUsers(await getAdminUsers(query));
    } catch {
      setAdminUsers(null);
      setUsersError(null);
    } finally {
      setUsersLoading(false);
    }
  };

  const submitUserSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadUsers(userSearch);
  };

  const savePrice = async (planId: PlanId, country: "KZ" | "RU") => {
    const key = priceKey(planId, country);
    const amount = Number(draftPrices[key]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Цена должна быть положительным числом.");
      return;
    }

    setSavingPrice(key);
    setError(null);
    setNotice(null);

    try {
      const amountMinor = Math.round(amount * 100);
      const response = await updateAdminPlanPrice({ planId, country, amountMinor });
      setOverview((current) => ({ ...(current ?? emptyOverview), pricing: response.pricing }));
      setNotice("Прайс обновлен.");
    } catch (saveError) {
      setError(toPublicApiError(saveError, "Не удалось сохранить цену."));
    } finally {
      setSavingPrice(null);
    }
  };

  if (!user?.permissions.adminPanel) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#050505] p-6 text-white md:p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <ShieldCheck className="h-9 w-9 text-gray-500" strokeWidth={1.5} />
          <h1 className="mt-5 text-3xl font-medium">Админ-панель закрыта</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Управление направлением проекта, памятью и прайсом доступно только роли администратора.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-6 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-gray-600">Администрирование</p>
            <h1 className="mt-2 text-4xl font-medium">{header.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500">
              {header.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (activeTab === "users") {
                void loadUsers(userSearch);
              } else {
                void loadOverview();
              }
            }}
            disabled={loading || usersLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading || usersLoading ? "animate-spin" : ""}`} strokeWidth={1.7} />
            Обновить
          </button>
        </header>

        {notice ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        ) : null}

        {activeTab === "direction" ? (
          <section className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {direction.metrics.map((metric) => (
                <article key={metric.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <TrendingUp className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <p className="mt-6 text-3xl font-medium">{loading ? "..." : metric.value}</p>
                  <h2 className="mt-2 text-sm font-medium text-gray-200">{metric.label}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{metric.detail}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <h2 className="text-xl font-medium">Что происходит с направлением</h2>
                </div>
                <div className="mt-5 space-y-3">
                  {direction.signals.map((signal) => (
                    <div key={signal.title} className={`rounded-2xl border p-4 ${statusClass[signal.status]}`}>
                      <h3 className="text-sm font-medium">{signal.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed opacity-80">{signal.detail}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <div>
                    <h2 className="text-xl font-medium">Приоритеты админа</h2>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">
                      Это не кнопки и не пользовательские функции, а список решений, которые сейчас стоит держать в фокусе по продукту.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {direction.nextSteps.map((step) => (
                    <div key={step} className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-black p-4 text-sm text-gray-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.7} />
                      <span className="min-w-0 break-words">{step}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                    <h2 className="text-xl font-medium">Отчет по оплатам</h2>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                    Kaspi и YooKassa считаются отдельно. В оплаченные попадают только платежи со статусом completed.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {paymentReport.providers.map((provider) => (
                  <div key={provider.provider} className="rounded-2xl border border-white/10 bg-black p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-medium text-white">{provider.label}</h3>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-700">{provider.provider}</p>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-gray-400">
                        {provider.currency}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      <PaymentStat label="Оплачено" stat={provider.paid} currency={provider.currency} tone="good" />
                      <PaymentStat label="Ожидает" stat={provider.pending} currency={provider.currency} />
                      <PaymentStat label="Отменено" stat={provider.cancelled} currency={provider.currency} />
                      <PaymentStat label="Ошибка" stat={provider.failed} currency={provider.currency} tone="risk" />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Всего платежей: {formatNumber(provider.total.count)}
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Кредиты выданы: {formatNumber(provider.creditsGrantedCount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-gray-600">{paymentReport.note}</p>
            </article>
          </section>
        ) : null}

        {activeTab === "users" ? (
          <section className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <UserRound className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                    <h2 className="text-xl font-medium">Поиск пользователей</h2>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
                    Поиск идет по имени, email, телефону или id. В карточке видны платежи, активность, расход кредитов и папки проектов без доступа к содержимому.
                  </p>
                </div>
                <form onSubmit={submitUserSearch} className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-xl">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" strokeWidth={1.7} />
                    <input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Имя, email, телефон или id"
                      className="h-11 w-full rounded-xl border border-white/10 bg-black pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={usersLoading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                  >
                    <Search className="h-4 w-4" strokeWidth={1.8} />
                    Найти
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black p-5">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" strokeWidth={1.5} />
                <p className="text-sm leading-relaxed text-gray-400">{effectiveUsers.privacyNote}</p>
              </div>
            </div>

            {usersError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {usersError}
              </div>
            ) : null}

            {usersLoading ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-sm text-gray-500">
                Загружаю пользователей...
              </div>
            ) : effectiveUsers.users.length > 0 ? (
              <div className="space-y-4">
                {effectiveUsers.users.map((adminUser) => (
                  <article key={adminUser.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black">
                            <UserRound className="h-5 w-5 text-gray-400" strokeWidth={1.5} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-medium text-white">{adminUser.name}</h3>
                            <p className="truncate text-sm text-gray-500">{adminUser.email ?? adminUser.phone ?? adminUser.id}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                          <span className="rounded-full border border-white/10 bg-black px-3 py-1">id: {adminUser.id}</span>
                          <span className="rounded-full border border-white/10 bg-black px-3 py-1">{adminUser.country}</span>
                          <span className="rounded-full border border-white/10 bg-black px-3 py-1">{adminUser.systemRole}</span>
                          <span className="rounded-full border border-white/10 bg-black px-3 py-1">
                            {adminUser.activePlanId ?? "без подписки"}
                            {adminUser.subscriptionStatus ? ` · ${adminUser.subscriptionStatus}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <CalendarDays className="h-4 w-4" strokeWidth={1.6} />
                          С нами
                        </div>
                        <div className="mt-1 text-sm text-white">{formatDate(adminUser.createdAt)}</div>
                        <div className="mt-1 text-xs text-gray-600">
                          Последняя активность: {adminUser.activity.lastActivityAt ? formatDate(adminUser.activity.lastActivityAt) : "нет данных"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <UserStat icon={MessageSquare} label="Чаты / сообщения" value={`${formatNumber(adminUser.activity.chatsCount)} / ${formatNumber(adminUser.activity.messagesCount)}`} />
                      <UserStat icon={Wallet} label="Кредиты в кошельке" value={formatNumber(adminUser.wallet.availableCredits)} detail={`${formatNumber(adminUser.wallet.reservedCredits)} зарезервировано`} />
                      <UserStat icon={Activity} label="Потрачено кредитов" value={formatNumber(adminUser.activity.totalCreditsSpent)} detail={`${formatNumber(adminUser.activity.freeCreditsSpent)} бесплатных`} />
                      <UserStat icon={FolderKanban} label="Проекты / файлы" value={`${formatNumber(adminUser.activity.projectsCount)} / ${formatNumber(adminUser.activity.filesCount)}`} detail={`${formatNumber(adminUser.activity.mediaAssetsCount)} медиа`} />
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black p-4">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-gray-500" strokeWidth={1.6} />
                          <h4 className="text-sm font-medium text-gray-200">История платежей</h4>
                        </div>
                        <div className="mt-4 space-y-2">
                          {adminUser.payments.length > 0 ? (
                            adminUser.payments.map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                                <div className="min-w-0">
                                  <div className="truncate text-gray-200">{payment.planId} · {payment.provider}</div>
                                  <div className="text-xs text-gray-600">{formatDate(payment.createdAt)} · {payment.status}</div>
                                </div>
                                <div className="shrink-0 text-gray-400">{formatMoney(payment.amountMinor, payment.currency)}</div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-600">Платежей пока нет.</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black p-4">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="h-4 w-4 text-gray-500" strokeWidth={1.6} />
                          <h4 className="text-sm font-medium text-gray-200">Папки проектов</h4>
                        </div>
                        <div className="mt-4 space-y-2">
                          {adminUser.projects.length > 0 ? (
                            adminUser.projects.map((project) => (
                              <div key={project.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                                <div className="min-w-0">
                                  <div className="truncate text-gray-200">{project.name}</div>
                                  <div className="text-xs text-gray-600">
                                    {project.type} · {project.status} · обновлено {formatDate(project.updatedAt)}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                                  <FileText className="h-3.5 w-3.5" strokeWidth={1.6} />
                                  {project.assetsCount}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-600">Проектов пока нет.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-sm text-gray-500">
                Пользователи не найдены.
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "memory" ? (
          <section className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Brain className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                    <h2 className="text-xl font-medium">Память и чаты в базе</h2>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
                    Все чаты архитектурно хранятся в базе и участвуют в памяти через summary, но админ видит только счетчики, заполнение и техническое состояние.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black px-5 py-4">
                  <div className="text-sm text-gray-500">Заполнение памяти</div>
                  <div className="mt-2 text-3xl font-medium">{memory.fillPercent}%</div>
                </div>
              </div>

              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-white" style={{ width: `${memory.fillPercent}%` }} />
              </div>
              <div className="mt-3 text-sm text-gray-600">
                {formatNumber(memory.memoryTokens)} из {formatNumber(memory.memoryLimitTokens)} токенов памяти.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {memoryStats.map((stat) => (
                <article key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <stat.icon className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <p className="mt-6 text-3xl font-medium">{stat.value}</p>
                  <h3 className="mt-2 text-sm font-medium text-gray-200">{stat.label}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{stat.detail}</p>
                </article>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black p-5">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" strokeWidth={1.5} />
                <p className="text-sm leading-relaxed text-gray-400">{memory.privateNote}</p>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "pricing" ? (
          <section className="space-y-5">
            {pricing.exchangeRates.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-3">
                {pricing.exchangeRates.map((rate) => (
                  <article key={rate.pair} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <DollarSign className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                    <div className="mt-5 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-gray-500">{rate.pair}</p>
                        <p className="mt-2 text-3xl font-medium">{formatRate(rate.value)}</p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${
                          rate.stale
                            ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                        }`}
                      >
                        {rate.stale ? "кэш" : "daily"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-gray-600">{rate.note}</p>
                    <div className="mt-4 space-y-1 text-xs text-gray-700">
                      <p>Источник: {rate.sourceName}</p>
                      <p>Дата курса: {rate.effectiveDate}</p>
                      <p>Следующее обновление: {formatDateTime(rate.nextUpdateAt)}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm leading-relaxed text-gray-500">
                Реальные курсы валют пока не загрузились из официальных источников. Резервные значения не подставляются.
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                <h2 className="text-xl font-medium">Прайс тарифов</h2>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
                Цены можно менять в рублях и тенге. Курсы выше подтягиваются из официальных источников и обновляются раз в день.
              </p>

              {pricing.plans.length > 0 ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
                  {pricing.plans.map((plan, index) => (
                    <div key={plan.id} className={`p-4 ${index !== pricing.plans.length - 1 ? "border-b border-white/10" : ""}`}>
                      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr] xl:items-center">
                        <div>
                          <h3 className="text-lg font-medium text-white">{plan.name}</h3>
                          <p className="mt-1 text-sm leading-relaxed text-gray-500">{plan.description}</p>
                          <p className="mt-2 text-xs text-gray-600">
                            {formatNumber(plan.monthlyCredits)} кредитов · {formatNumber(plan.contextTokens)} контекст
                          </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {plan.prices.map((price) => {
                            const key = priceKey(plan.id, price.country);
                            return (
                              <div key={key} className="rounded-2xl border border-white/10 bg-black p-3">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <span className="text-sm text-gray-400">
                                    {price.country === "KZ" ? "Казахстан" : "Россия"} · {price.provider}
                                  </span>
                                  <span className="text-xs text-gray-600">{price.currency}</span>
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    value={draftPrices[key] ?? ""}
                                    onChange={(event) =>
                                      setDraftPrices((current) => ({ ...current, [key]: event.target.value }))
                                    }
                                    inputMode="decimal"
                                    className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void savePrice(plan.id, price.country)}
                                    disabled={savingPrice === key}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                                    aria-label="Сохранить цену"
                                  >
                                    <Save className="h-4 w-4" strokeWidth={1.8} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black p-5 text-sm leading-relaxed text-gray-500">
                  Реальные тарифы не загрузились из таблиц plans и plan_prices. Локальные константы вместо них не показываются.
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function UserStat({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail?: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black p-4">
      <Icon className="h-4 w-4 text-gray-500" strokeWidth={1.6} />
      <p className="mt-4 text-xl font-medium text-white">{value}</p>
      <p className="mt-1 text-sm text-gray-400">{label}</p>
      {detail ? <p className="mt-1 text-xs text-gray-600">{detail}</p> : null}
    </div>
  );
}

function PaymentStat({
  currency,
  label,
  stat,
  tone = "default",
}: {
  currency: string;
  label: string;
  stat: { count: number; amountMinor: number };
  tone?: "default" | "good" | "risk";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-400/15 bg-emerald-400/10"
      : tone === "risk"
        ? "border-red-400/15 bg-red-400/10"
        : "border-white/10 bg-[#050505]";

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-lg font-medium text-white">{formatNumber(stat.count)}</div>
      <div className="mt-1 text-xs text-gray-500">{formatMoney(stat.amountMinor, currency)}</div>
    </div>
  );
}

function priceDrafts(pricing: AdminPricingApiRecord) {
  const drafts: Record<string, string> = {};
  for (const plan of pricing.plans) {
    for (const price of plan.prices) {
      drafts[priceKey(plan.id, price.country)] = String(price.amountMinor / 100);
    }
  }
  return drafts;
}

function readAdminTab(value: string | null): AdminTab {
  return value === "users" || value === "memory" || value === "pricing" ? value : "direction";
}

function adminHeader(tab: AdminTab) {
  switch (tab) {
    case "users":
      return {
        title: "Пользователи",
        subtitle:
          "Поиск по базе пользователей, платежам, активности, расходу кредитов и папкам проектов. Содержимое чатов и файлов не раскрывается.",
      };
    case "memory":
      return {
        title: "Память",
        subtitle:
          "Здесь видны только агрегаты по памяти и чатам: количество, summary и заполнение. Внутренности переписок не выводятся.",
      };
    case "pricing":
      return {
        title: "Прайс",
        subtitle: "Управление ценами тарифов и дневными курсами USD/RUB, USD/KZT и RUB/KZT.",
      };
    default:
      return {
        title: "Панель управления Nerix",
        subtitle:
          "Здесь видно направление проекта, операционные сигналы и решения, которые стоит держать в фокусе. Внутренности пользовательских чатов не показываются.",
      };
  }
}

function priceKey(planId: PlanId, country: "KZ" | "RU") {
  return `${planId}-${country}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatRate(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: currency === "RUB" || currency === "KZT" ? currency : "KZT",
  }).format(amountMinor / 100);
}

function createEmptyAdminOverview(): AdminOverviewApiResponse {
  return {
    businessDirection: {
      metrics: [],
      signals: [],
      nextSteps: [],
    },
    memory: {
      totalChats: 0,
      totalMessages: 0,
      summarizedChats: 0,
      memoryItems: 0,
      memoryTokens: 0,
      memoryLimitTokens: 2_000_000,
      fillPercent: 0,
      privateNote:
        "Реальные агрегаты памяти загрузятся из API. Содержимое чатов и сообщений не выводится.",
    },
    paymentReport: {
      providers: [],
      note: "Отчет по оплатам загрузится из API.",
    },
    pricing: {
      exchangeRates: [],
      plans: [],
    },
  };
}

function createEmptyAdminUsers(query: string): AdminUsersApiResponse {
  return {
    query,
    users: [],
    privacyNote:
      "Реальные пользователи загрузятся из API. Содержимое чатов, файлов и проектов не выводится.",
  };
}
