import { Outlet, Link, useLocation, useNavigate } from "react-router";
import type { WalletBalance } from "@nomduchat/shared";
import { AlertCircle, ArrowLeft, BarChart3, Bot, BriefcaseBusiness, Check, ChevronDown, ChevronLeft, ChevronRight, CircleUser, Clock3, CreditCard, FolderKanban, Globe, Grid2X2, ImageIcon, Lightbulb, LogIn, LogOut, Mail, MessageSquare, PanelLeftClose, Settings, ShieldCheck, SlidersHorizontal, UserRound, Users, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentSubscription, getPlans, getSubscriptionCheckouts, getUsageLimits, getWallet, type CurrentSubscriptionApiResponse, type PlanApiRecord, type SubscriptionCheckoutApiRecord, type UsageLimitsApiResponse } from "../api";
import { roleLabel, type LocalRoleOverride, useAuth } from "../auth";
import { useLanguage } from "../i18n";
import { getUnauthorizedWorkspaceRedirect, getWorkspaceAccess } from "../roleAccess";

export default function WorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { canUseRoleSwitcher, isAuthenticated, logout, roleOverride, setRoleOverride, user } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [usageLimits, setUsageLimits] = useState<UsageLimitsApiResponse | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscriptionApiResponse | null>(null);
  const [failedRenewalCheckout, setFailedRenewalCheckout] = useState<SubscriptionCheckoutApiRecord | null>(null);
  const [plans, setPlans] = useState<PlanApiRecord[]>([]);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [renewalNudgeHidden, setRenewalNudgeHidden] = useState(false);
  const [profileAvatar] = useState(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("nomduchat-profile-avatar-draft");
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("nomduchat-sidebar-collapsed") === "true";
  });
  const [businessMenuOpen, setBusinessMenuOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("nomduchat-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const access = useMemo(() => getWorkspaceAccess(user), [user]);
  const isAdminNavigation = access.isAdmin && !access.isOwner;
  const adminTab = new URLSearchParams(location.search).get("tab");
  const roleOptions: LocalRoleOverride[] = ["real", "admin", "user", "business_owner", "business_employee"];
  const isBusinessSection =
    location.pathname === "/workspace/business" || location.pathname.startsWith("/workspace/business/");
  const showBusinessBrand = access.canUseBusiness;
  const businessNavItems = [
    { path: "/workspace/business", icon: BriefcaseBusiness, label: t.nav.businessOverview, visible: access.canUseBusinessOverview },
    { path: "/workspace/business/website", icon: Globe, label: t.nav.businessWebsite, visible: access.canUseBusinessWebsite },
    { path: "/workspace/business/telegram-bot", icon: Bot, label: t.nav.businessTelegramBot, visible: access.canUseBusinessTelegramBot },
    { path: "/workspace/business/dialogs", icon: MessageSquare, label: t.nav.businessDialogs, visible: access.canUseBusinessDialogs },
    { path: "/workspace/business/analytics", icon: BarChart3, label: t.nav.businessAnalytics, visible: access.canUseBusinessAnalytics },
    { path: "/workspace/business/ideas", icon: Lightbulb, label: t.nav.businessIdeas, visible: access.canUseBusinessIdeas },
  ];
  const adminNavItems = [
        {
          path: "/workspace/admin",
          icon: ShieldCheck,
          label: t.nav.admin,
          visible: true,
          active: () =>
            location.pathname === "/workspace/admin" &&
            adminTab !== "users" &&
            adminTab !== "memory" &&
            adminTab !== "pricing" &&
            adminTab !== "control" &&
            adminTab !== "ai-budget",
        },
        {
          path: "/workspace/admin/control",
          icon: SlidersHorizontal,
          label: t.nav.control,
          visible: true,
          active: () => location.pathname === "/workspace/admin/control" || (location.pathname === "/workspace/admin" && adminTab === "control"),
        },
        {
          path: "/workspace/admin/ai-budget",
          icon: Zap,
          label: t.nav.aiBudget,
          visible: true,
          active: () => location.pathname === "/workspace/admin/ai-budget" || (location.pathname === "/workspace/admin" && adminTab === "ai-budget"),
        },
        {
          path: "/workspace/admin/users",
          icon: Users,
          label: t.nav.users,
          visible: true,
          active: () => location.pathname === "/workspace/admin/users" || (location.pathname === "/workspace/admin" && adminTab === "users"),
        },
        {
          path: "/workspace/admin/pricing",
          icon: CreditCard,
          label: t.nav.price,
          visible: true,
          active: () => location.pathname === "/workspace/admin/pricing" || (location.pathname === "/workspace/admin" && adminTab === "pricing"),
        },
        { path: "/workspace/mailings", icon: Mail, label: t.nav.mailings, visible: access.canUseMailings },
        { path: "/workspace/settings", icon: Settings, label: t.nav.settings, visible: access.canUseSettings },
      ];
  const workspaceNavItems = [
        { path: "/workspace/chat", icon: MessageSquare, label: t.nav.chat, visible: access.canUseChat },
        { path: "/workspace/agents", icon: Bot, label: t.nav.agents, visible: access.canUseChat },
        { path: "/workspace/projects", icon: FolderKanban, label: t.nav.projects, visible: access.canUseChat },
        { path: "/workspace/apps", icon: Grid2X2, label: t.nav.apps, visible: access.canUseChat },
        { path: "/workspace/media", icon: ImageIcon, label: t.nav.media, visible: access.canUseChat },
        { path: "/workspace/avatar", icon: UserRound, label: t.nav.avatar, visible: access.canUseChat },
        { path: "/workspace/history", icon: Clock3, label: t.nav.history, visible: access.canUseHistory },
        { path: "/workspace/business", icon: BriefcaseBusiness, label: t.nav.business, visible: access.canUseBusiness },
        { path: "/workspace/balance", icon: CreditCard, label: t.nav.balance, visible: access.canUseBalance },
        {
          path: "/workspace/settings",
          icon: Settings,
          label: t.nav.settings,
          visible: access.canUseSettings,
          active: () => location.pathname.startsWith("/workspace/settings") || location.pathname === "/workspace/memory",
        },
      ];
  const navItems = isAdminNavigation
    ? adminNavItems
    : access.isOwner
      ? [
          ...workspaceNavItems,
          ...adminNavItems.filter(
            (adminItem) => !workspaceNavItems.some((workspaceItem) => workspaceItem.path === adminItem.path),
          ),
        ]
      : workspaceNavItems;

  const refreshUsageLimits = useCallback(() => {
    if (isAdminNavigation || access.isGuest) {
      setUsageLimits(null);
      setWallet(null);
      setCurrentSubscription(null);
      setFailedRenewalCheckout(null);
      setPlans([]);
      return;
    }

    const country = user?.country === "RU" ? "RU" : "KZ";

    Promise.allSettled([getUsageLimits(), getWallet(), getCurrentSubscription(), getPlans(country), getSubscriptionCheckouts()])
      .then(([usageResult, walletResult, subscriptionResult, plansResult, checkoutsResult]) => {
        setUsageLimits(usageResult.status === "fulfilled" ? usageResult.value : null);
        setWallet(walletResult.status === "fulfilled" ? walletResult.value : null);
        setCurrentSubscription(subscriptionResult.status === "fulfilled" ? subscriptionResult.value : null);
        setPlans(plansResult.status === "fulfilled" ? plansResult.value.plans : []);
        setFailedRenewalCheckout(
          checkoutsResult.status === "fulfilled" ? getLatestFailedCheckout(checkoutsResult.value.checkouts) : null
        );
      })
      .catch(() => {
        setUsageLimits(null);
        setWallet(null);
        setCurrentSubscription(null);
        setFailedRenewalCheckout(null);
        setPlans([]);
      });
  }, [access.isGuest, isAdminNavigation, user?.id, user?.activePlanId, user?.country, roleOverride]);

  useEffect(() => {
    const redirectPath = getUnauthorizedWorkspaceRedirect(location.pathname, access);
    if (redirectPath && redirectPath !== location.pathname) {
      navigate(redirectPath, { replace: true });
    }
  }, [access, location.pathname, navigate]);

  useEffect(() => {
    setBusinessMenuOpen(access.canUseBusiness && isBusinessSection && !sidebarCollapsed);
  }, [access.canUseBusiness, isBusinessSection, sidebarCollapsed]);

  useEffect(() => {
    refreshUsageLimits();
  }, [refreshUsageLimits]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setOnboardingOpen(false);
      return;
    }

    setOnboardingOpen(window.localStorage.getItem(onboardingStorageKey(user.id)) !== "dismissed");
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !failedRenewalCheckout) {
      setRenewalDialogOpen(false);
      setRenewalNudgeHidden(false);
      return;
    }

    const dismissed = window.localStorage.getItem(renewalFailureStorageKey(user.id, failedRenewalCheckout.id)) === "dismissed";
    setRenewalDialogOpen(!dismissed);
    setRenewalNudgeHidden(false);
  }, [failedRenewalCheckout?.id, isAuthenticated, user?.id]);

  useEffect(() => {
    window.addEventListener("nomduchat-usage-updated", refreshUsageLimits);
    window.addEventListener("focus", refreshUsageLimits);

    return () => {
      window.removeEventListener("nomduchat-usage-updated", refreshUsageLimits);
      window.removeEventListener("focus", refreshUsageLimits);
    };
  }, [refreshUsageLimits]);

  const isActive = (item: (typeof navItems)[number]) => {
    if (item.active) return item.active();
    const path = item.path.split("?")[0];
    if (path === "/workspace") {
      return location.pathname === "/workspace" || location.pathname === "/workspace/";
    }
    return location.pathname.startsWith(path);
  };
  const closeOnboarding = () => {
    if (user?.id) {
      window.localStorage.setItem(onboardingStorageKey(user.id), "dismissed");
    }
    setOnboardingOpen(false);
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-black text-white">
      {/* Sidebar */}
      <aside
        className={`
          custom-scrollbar fixed left-0 top-0 bottom-0 z-30 flex flex-col overflow-y-auto overflow-x-hidden transition-[width,transform] duration-300
          ${sidebarCollapsed ? "w-16" : "w-20 md:w-64"}
        `}
        style={{
          backgroundColor: "#000000",
          borderRight: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Logo */}
        <div className="px-3 py-7">
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "justify-center md:justify-between"}`}>
            <Link to="/" className="block text-xl font-medium text-white text-center transition-colors hover:text-gray-300 md:text-left">
              <span className={sidebarCollapsed ? "inline" : "md:hidden"}>N</span>
              <span className={`${sidebarCollapsed ? "hidden" : "hidden md:inline"}`}>
                {t.product}
                {showBusinessBrand ? (
                  <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 align-middle text-[11px] font-medium uppercase tracking-[0.12em] text-gray-400">
                    Business
                  </span>
                ) : null}
              </span>
            </Link>
            {!sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="hidden h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/5 hover:text-white md:inline-flex"
                aria-label="Скрыть меню"
                title="Скрыть меню"
              >
                <PanelLeftClose className="h-5 w-5" strokeWidth={1.5} />
              </button>
            ) : null}
          </div>
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="mt-5 flex h-9 w-full items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Показать меню"
              title="Показать меню"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
          ) : null}
          {!sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="mt-5 flex h-9 w-full items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/5 hover:text-white md:hidden"
              aria-label="Скрыть меню"
              title="Скрыть меню"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2">
          <ul className="space-y-1">
            {navItems.filter((item) => item.visible).map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`
                      flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                      ${sidebarCollapsed ? "" : "md:justify-start"}
                      ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }
                    `}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                    <span className={`${sidebarCollapsed ? "hidden" : "hidden md:inline"} text-sm font-medium`}>
                      {item.label}
                    </span>
                  </Link>
                  {!sidebarCollapsed && item.path === "/workspace/business" ? (
                    <div
                      aria-hidden={!businessMenuOpen}
                      className={`hidden overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out md:block ${
                        businessMenuOpen ? "max-h-72 translate-y-0 opacity-100" : "max-h-0 -translate-y-1 opacity-0"
                      }`}
                    >
                      <ul className="mt-1 space-y-1 border-l border-white/10 pl-4">
                        {businessNavItems.filter((subItem) => subItem.visible).map((subItem, index) => {
                          const SubIcon = subItem.icon;
                          const subActive =
                            subItem.path === "/workspace/business"
                              ? location.pathname === "/workspace/business"
                              : location.pathname === subItem.path || location.pathname.startsWith(`${subItem.path}/`);

                          return (
                            <li
                              key={subItem.path}
                              className="transition-[opacity,transform] duration-300 ease-out"
                              style={{
                                transitionDelay: businessMenuOpen ? `${index * 35}ms` : "0ms",
                                opacity: businessMenuOpen ? 1 : 0,
                                transform: businessMenuOpen ? "translateX(0)" : "translateX(-6px)",
                              }}
                            >
                              <Link
                                to={subItem.path}
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                                  subActive
                                    ? "bg-white/10 text-white"
                                    : "text-gray-500 hover:bg-white/5 hover:text-white"
                                }`}
                              >
                                <SubIcon className="h-4 w-4" strokeWidth={1.5} />
                                <span className="truncate">{subItem.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>

        {!sidebarCollapsed && !isAdminNavigation && access.canUseBalance ? (
          <div className="hidden px-3 pb-3 md:block">
            <UsageLimitPanel
              isGuest={access.isGuest}
              usage={usageLimits}
              wallet={wallet}
              subscription={currentSubscription}
              plans={plans}
            />
          </div>
        ) : null}

        {canUseRoleSwitcher ? (
          <div className="px-3 pb-3">
            <div
              className={`relative rounded-2xl border border-white/10 bg-[#070707] p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.32)] ${
                sidebarCollapsed ? "hidden" : "hidden md:block"
              }`}
              onBlur={(event) => {
                const nextTarget = event.relatedTarget as Node | null;
                if (!event.currentTarget.contains(nextTarget)) {
                  setRoleMenuOpen(false);
                }
              }}
            >
              <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-600">
                Локальная роль
              </div>
              <button
                id="local-role-switcher"
                type="button"
                aria-label="Локальная роль"
                aria-haspopup="listbox"
                aria-expanded={roleMenuOpen}
                onClick={() => setRoleMenuOpen((open) => !open)}
                className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-black px-3 text-left text-sm text-white outline-none transition-colors hover:border-white/25 focus:border-white/35"
              >
                <span className="min-w-0 truncate">{roleLabel(roleOverride)}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${roleMenuOpen ? "rotate-180" : ""}`}
                  strokeWidth={1.8}
                />
              </button>
              {roleMenuOpen ? (
                <div
                  role="listbox"
                  aria-labelledby="local-role-switcher"
                  className="absolute bottom-[calc(100%-0.35rem)] left-2.5 right-2.5 z-50 max-h-60 overflow-y-auto rounded-xl border border-white/[0.12] bg-[#090909] p-1 shadow-[0_18px_44px_rgba(0,0,0,0.7)]"
                >
                  {roleOptions.map((role) => {
                    const selected = roleOverride === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setRoleOverride(role);
                          setRoleMenuOpen(false);
                        }}
                        className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm transition-colors ${
                          selected
                            ? "bg-white text-black"
                            : "text-gray-300 hover:bg-white/[0.08] hover:text-white"
                        }`}
                      >
                        <span className="truncate">{roleLabel(role)}</span>
                        {selected ? <Check className="h-4 w-4 shrink-0" strokeWidth={1.9} /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                const currentIndex = roleOptions.indexOf(roleOverride);
                setRoleOverride(roleOptions[(currentIndex + 1) % roleOptions.length]);
                setRoleMenuOpen(false);
              }}
              className={`h-9 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-xs font-medium text-gray-400 transition-colors hover:border-white/20 hover:text-white ${
                sidebarCollapsed ? "flex" : "flex md:hidden"
              }`}
              title={`Локальная роль: ${roleLabel(roleOverride)}`}
            >
              {roleOverride === "real" ? "R" : roleLabel(roleOverride).slice(0, 1)}
            </button>
          </div>
        ) : null}

        <div className="px-3 pb-3">
          <Link
            to="/"
            className={`flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white ${
              sidebarCollapsed ? "" : "md:justify-start"
            }`}
            title={sidebarCollapsed ? t.nav.start : undefined}
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
            <span className={`${sidebarCollapsed ? "hidden" : "hidden md:inline"} text-sm font-medium`}>{t.nav.start}</span>
          </Link>
        </div>

        {/* Footer / Profile */}
        <div className="p-4 border-t border-white/10">
          <div className={`flex items-center justify-center gap-3 py-2 ${sidebarCollapsed ? "" : "md:justify-start md:px-2"}`}>
            <div className="relative">
              {profileAvatar ? (
                <img
                  src={profileAvatar}
                  alt=""
                  className="h-8 w-8 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <CircleUser className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
              )}
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-black"></div>
            </div>
            <div className={`${sidebarCollapsed ? "hidden" : "hidden md:block"} flex-1 min-w-0`}>
              <p className="text-sm font-medium text-white truncate">{user?.name || user?.email || t.auth.guest}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Zap className="w-3 h-3" />
                <span className="truncate">{user?.email ?? t.auth.guestHint}</span>
              </div>
            </div>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={logout}
                className={`${sidebarCollapsed ? "hidden" : "hidden md:inline-flex"} h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/5 hover:text-white`}
                aria-label={t.auth.logout}
                title={t.auth.logout}
              >
                <LogOut className="h-4 w-4" strokeWidth={1.6} />
              </button>
            ) : (
              <Link
                to="/auth?mode=register"
                className={`${sidebarCollapsed ? "hidden" : "hidden md:inline-flex"} h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/5 hover:text-white`}
                aria-label={t.auth.createAccount}
                title={t.auth.createAccount}
              >
                <LogIn className="h-4 w-4" strokeWidth={1.6} />
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`relative z-10 flex h-screen flex-1 flex-col overflow-hidden transition-[margin] duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-20 md:ml-64"
        }`}
      >
        <Outlet />
      </main>
      {user ? (
        <WorkspaceOnboardingDialog
          open={onboardingOpen}
          access={access}
          onClose={closeOnboarding}
        />
      ) : null}
      {user && failedRenewalCheckout ? (
        <RenewalFailureDialog
          open={renewalDialogOpen}
          checkout={failedRenewalCheckout}
          onClose={() => {
            window.localStorage.setItem(renewalFailureStorageKey(user.id, failedRenewalCheckout.id), "dismissed");
            setRenewalDialogOpen(false);
          }}
        />
      ) : null}
      {user && failedRenewalCheckout && !renewalDialogOpen && !renewalNudgeHidden ? (
        <RenewalFailureNudge
          checkout={failedRenewalCheckout}
          onClose={() => setRenewalNudgeHidden(true)}
        />
      ) : null}
    </div>
  );
}

function WorkspaceOnboardingDialog({
  open,
  access,
  onClose,
}: {
  open: boolean;
  access: ReturnType<typeof getWorkspaceAccess>;
  onClose: () => void;
}) {
  if (!open) return null;

  const items = [
    {
      icon: MessageSquare,
      title: "Чат",
      text: "Основное место для вопросов, текстов, кода, документов и генерации. Опишите задачу обычными словами.",
      visible: access.canUseChat,
    },
    {
      icon: Bot,
      title: "Агенты",
      text: "Готовые режимы для текста, бизнеса, кода, учебы, документов, изображений, видео, голоса и поддержки.",
      visible: access.canUseChat,
    },
    {
      icon: FolderKanban,
      title: "Проекты",
      text: "Сохраняйте рабочие контексты и отправляйте их в чат, чтобы не собирать задачу заново.",
      visible: access.canUseChat,
    },
    {
      icon: Grid2X2,
      title: "Приложения",
      text: "Каталог быстрых инструментов: перевод, промпты, SEO, humanizer, изображения и бизнес-сценарии.",
      visible: access.canUseChat,
    },
    {
      icon: ImageIcon,
      title: "Медиа",
      text: "Отдельная точка для изображений, видео, музыки и озвучки. Сейчас сценарии ведут в чат и приложения.",
      visible: access.canUseChat,
    },
    {
      icon: UserRound,
      title: "Аватар",
      text: "Аватар-видео пока оформлено как продукт в разработке, без слабого временного прототипа.",
      visible: access.canUseChat,
    },
    {
      icon: Clock3,
      title: "История",
      text: "Здесь остаются прошлые диалоги, чтобы быстро вернуться к задаче и продолжить с контекстом.",
      visible: access.canUseHistory,
    },
    {
      icon: CreditCard,
      title: "Подписка",
      text: "Тарифы, баланс кредитов и платежи. Валюта берется по стране аккаунта: KZT или RUB.",
      visible: access.canUseBalance,
    },
    {
      icon: BriefcaseBusiness,
      title: "Бизнес",
      text: "Раздел для CRM-сценариев: клиенты, диалоги, отчеты, AI-сайт и Telegram-бот компании.",
      visible: access.canUseBusiness,
    },
    {
      icon: ShieldCheck,
      title: "Админ",
      text: "Пользователи, платежи, прайс, AI-провайдеры, агенты, рассылки и контроль запуска.",
      visible: access.isAdmin,
    },
    {
      icon: Settings,
      title: "Настройки",
      text: "Профиль, страна, язык и параметры аккаунта. Страна влияет на платежный сценарий.",
      visible: access.canUseSettings,
    },
  ].filter((item) => item.visible);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-4 pb-4 pt-16 backdrop-blur-md sm:items-center sm:p-6">
      <section className="relative max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#080808] p-5 text-white shadow-2xl shadow-black/60 sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Закрыть инструкцию"
          title="Закрыть инструкцию"
        >
          <X className="h-5 w-5" strokeWidth={1.7} />
        </button>

        <div className="pr-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-400">
            <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.8} />
            Первый вход на этом устройстве
          </div>
          <h2 className="text-2xl font-medium tracking-tight text-white">Коротко по рабочему пространству</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
            Это окно показывается один раз на устройстве. Коллеги могут закрыть его и сразу пробовать доступные разделы.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-xl border border-white/10 bg-black p-4">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white">
                    <Icon className="h-5 w-5" strokeWidth={1.6} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-white">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500">{item.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {access.isAdmin ? (
            <Link
              to="/workspace/admin"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-gray-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
              Открыть админку
            </Link>
          ) : access.canUseChat ? (
            <Link
              to="/workspace/chat"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-gray-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
              Открыть чат
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            Понятно
          </button>
        </div>
      </section>
    </div>
  );
}

function onboardingStorageKey(userId: string) {
  return `nomduchat-workspace-onboarding:v1:${userId}`;
}

function renewalFailureStorageKey(userId: string, checkoutId: string) {
  return `nomduchat-renewal-failure:v1:${userId}:${checkoutId}`;
}

function getLatestFailedCheckout(checkouts: SubscriptionCheckoutApiRecord[]) {
  return checkouts
    .filter((checkout) => checkout.status === "failed" || checkout.status === "cancelled")
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null;
}

function RenewalFailureDialog({
  open,
  checkout,
  onClose,
}: {
  open: boolean;
  checkout: SubscriptionCheckoutApiRecord;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/75 px-4 pb-4 pt-16 backdrop-blur-md sm:items-center sm:p-6">
      <section className="relative w-full max-w-md rounded-2xl border border-red-400/20 bg-[#080808] p-5 text-white shadow-2xl shadow-black/60 sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Закрыть"
          title="Закрыть"
        >
          <X className="h-5 w-5" strokeWidth={1.7} />
        </button>

        <div className="pr-10">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-red-400/20 bg-red-400/10 text-red-100">
            <AlertCircle className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <h2 className="text-2xl font-medium text-white">Не удалось продлить подписку</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">
            Платеж по тарифу {planLabel(checkout.planId)} не завершился. Проверьте карту или выберите другой способ оплаты.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-gray-400">
          <div className="flex items-center justify-between gap-3">
            <span>{planLabel(checkout.planId)}</span>
            <span className="text-white">{formatCheckoutPrice(checkout.amountMinor, checkout.currency)}</span>
          </div>
          <div className="mt-2 truncate text-xs text-gray-600">ID: {checkout.providerCheckoutId}</div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            to="/workspace/balance"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            Попробовать оплатить снова
          </Link>
          <Link
            to="/support"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white"
          >
            Написать в поддержку
          </Link>
        </div>
      </section>
    </div>
  );
}

function RenewalFailureNudge({
  checkout,
  onClose,
}: {
  checkout: SubscriptionCheckoutApiRecord;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[min(25rem,calc(100vw-2rem))] rounded-2xl border border-indigo-300/25 bg-indigo-500/95 p-3 text-white shadow-2xl shadow-black/50 backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Скрыть"
        title="Скрыть"
      >
        <X className="h-4 w-4" strokeWidth={1.8} />
      </button>
      <div className="flex items-center gap-3 pr-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <CreditCard className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">Возобновите подписку</div>
          <div className="mt-0.5 truncate text-xs text-white/75">
            {planLabel(checkout.planId)} · {formatCheckoutPrice(checkout.amountMinor, checkout.currency)}
          </div>
        </div>
        <Link
          to="/workspace/balance"
          className="ml-auto inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-white px-3 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50"
        >
          Возобновить
        </Link>
      </div>
    </div>
  );
}

function UsageLimitPanel({
  isGuest,
  usage,
  wallet,
  subscription,
  plans,
}: {
  isGuest: boolean;
  usage: UsageLimitsApiResponse | null;
  wallet: WalletBalance | null;
  subscription: CurrentSubscriptionApiResponse | null;
  plans: PlanApiRecord[];
}) {
  if (isGuest) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#070707] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-gray-600">Подписка</span>
          <CreditCard className="h-4 w-4 text-gray-500" strokeWidth={1.6} />
        </div>
        <p className="mt-2 text-sm font-medium text-white">Текст, видео и песни доступны после подключения тарифа.</p>
        <Link
          to="/workspace/balance"
          className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-lg border border-white/10 text-xs font-medium text-gray-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white"
        >
          Смотреть тарифы
        </Link>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#070707] p-3 text-xs text-gray-500">
        Лимиты загрузятся после подключения API.
      </div>
    );
  }

  if (usage.hasActiveSubscription) {
    const plan = plans.find((item) => item.id === subscription?.subscription?.planId) ?? plans.find((item) => item.id === usage.planId);
    const rawAvailableCredits = wallet?.availableCredits ?? 0;
    const availableCredits = plan ? Math.min(rawAvailableCredits, plan.monthlyCredits) : rawAvailableCredits;
    const monthlyCredits = plan?.monthlyCredits ?? Math.max(availableCredits, 1);
    const remainingPercent =
      monthlyCredits > 0 ? Math.min(100, Math.max(0, (availableCredits / monthlyCredits) * 100)) : 0;

    return (
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-emerald-200/80">Подписка</span>
          <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-[11px] font-semibold text-black">
            Активна
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-white">Текст, видео и песни доступны.</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xl font-semibold text-white">{formatCredits(availableCredits)}</p>
            <p className="text-xs text-emerald-100/60">nomduchat-кредитов</p>
          </div>
          <p className="pb-0.5 text-xs text-emerald-100/60">{Math.round(remainingPercent)}%</p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${remainingPercent}%` }} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-emerald-100/60">
          {plan ? `${plan.name}: пакет на ${formatCredits(plan.monthlyCredits)} кредитов.` : "Баланс обновляется после каждого запроса."}
        </p>
      </div>
    );
  }

  const limit = usage.text.dailyLimit ?? 7;
  const remaining = usage.text.remainingToday ?? 0;
  const used = usage.text.usedToday ?? Math.max(0, limit - remaining);
  const remainingProgress = limit > 0 ? Math.min(100, Math.max(0, (remaining / limit) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#070707] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-gray-600">Сегодня</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-gray-300">
          Free
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{remaining}</p>
          <p className="text-xs text-gray-500">текстовых осталось</p>
        </div>
        <p className="pb-0.5 text-xs text-gray-500">{Math.round(remainingProgress)}%</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${remainingProgress}%` }} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        Использовано {used}/{limit}. Видео и песни откроются после подписки.
      </p>
      <Link
        to="/workspace/balance"
        className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-lg border border-white/10 text-xs font-medium text-gray-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white"
      >
        Открыть подписку
      </Link>
    </div>
  );
}

function formatCredits(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.max(0, Math.round(value)));
}

function planLabel(planId: string) {
  const labels: Record<string, string> = {
    base: "Easy Start",
    ultra: "Active Work",
    pro: "Team Mode",
    business: "Business Cabinet",
  };
  return labels[planId] ?? planId;
}

function formatCheckoutPrice(amountMinor: number, currency: "KZT" | "RUB") {
  const amount = amountMinor / 100;
  const formatted = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(amount);

  return `${formatted} ${currency === "KZT" ? "₸" : "₽"}`;
}
