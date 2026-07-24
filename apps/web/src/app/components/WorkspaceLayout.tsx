import { Navigate, Outlet, Link, useLocation, useNavigate } from "react-router";
import type { WalletBalance } from "@nomduchat/shared";
import { AlertCircle, BarChart3, Bot, BriefcaseBusiness, Building2, CircleUser, Clock3, CreditCard, FolderKanban, Globe, Grid2X2, Home, ImageIcon, Lightbulb, LogIn, LogOut, Mail, MessageSquare, Settings, ShieldCheck, SlidersHorizontal, UserRound, Users, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentSubscription, getPlans, getSubscriptionCheckouts, getUsageLimits, getWallet, type CurrentSubscriptionApiResponse, type PlanApiRecord, type SubscriptionCheckoutApiRecord, type UsageLimitsApiResponse } from "../api";
import { useAuth } from "../auth";
import { useLanguage, type Language } from "../i18n";
import { getUnauthorizedWorkspaceRedirect, getWorkspaceAccess, getWorkspaceFeatureStatus } from "../roleAccess";
import CommandPalette from "./CommandPalette";
import MobileNavigation from "./MobileNavigation";
import WorkspaceAppShell from "./shell/WorkspaceAppShell";
import WorkspaceSidebar, { type WorkspaceNavItem, type WorkspaceNavSection } from "./shell/WorkspaceSidebar";
import WorkspaceTopbar from "./shell/WorkspaceTopbar";

export default function WorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { isAuthenticated, logout, roleOverride, user } = useAuth();
  const [usageLimits, setUsageLimits] = useState<UsageLimitsApiResponse | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscriptionApiResponse | null>(null);
  const [failedRenewalCheckout, setFailedRenewalCheckout] = useState<SubscriptionCheckoutApiRecord | null>(null);
  const [plans, setPlans] = useState<PlanApiRecord[]>([]);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [renewalNudgeHidden, setRenewalNudgeHidden] = useState(false);
  const [legacyProfileAvatar] = useState(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("nomduchat-profile-avatar-draft");
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("nomduchat-sidebar-collapsed") === "true";
  });

  useEffect(() => {
    window.localStorage.setItem("nomduchat-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const access = useMemo(() => getWorkspaceAccess(user), [user]);
  const isAdminNavigation = access.isAdmin && !access.isOwner;
  const adminTab = new URLSearchParams(location.search).get("tab");
  const profileAvatar = user?.avatarUrl ?? legacyProfileAvatar;
  const profileHref = "/workspace/settings/profile";
  const showBusinessBrand = access.canUseBusiness;
  const resolveFeatureStatus = (path: string) => getWorkspaceFeatureStatus(path, access);
  const currentFeatureStatus = resolveFeatureStatus(location.pathname);
  const withFeatureVisibility = (items: WorkspaceNavItem[]) =>
    items.map((item) => {
      const featureStatus = resolveFeatureStatus(item.path);
      return {
        ...item,
        featureStatus,
        visible: item.visible && featureStatus !== "hidden",
      };
    });
  const businessNavItems = withFeatureVisibility([
    {
      path: "/workspace/business",
      icon: Building2,
      label: t.nav.businessOverview,
      visible: access.canUseBusinessOverview,
      active: () => location.pathname === "/workspace/business",
    },
    { path: "/workspace/business/website", icon: Globe, label: t.nav.businessWebsite, visible: access.canUseBusinessWebsite },
    { path: "/workspace/business/telegram-bot", icon: Bot, label: t.nav.businessTelegramBot, visible: access.canUseBusinessTelegramBot },
    { path: "/workspace/business/dialogs", icon: MessageSquare, label: t.nav.businessDialogs, visible: access.canUseBusinessDialogs },
    { path: "/workspace/business/analytics", icon: BarChart3, label: t.nav.businessAnalytics, visible: access.canUseBusinessAnalytics },
    { path: "/workspace/business/ideas", icon: Lightbulb, label: t.nav.businessIdeas, visible: access.canUseBusinessIdeas },
  ]);
  const adminNavItems: WorkspaceNavItem[] = withFeatureVisibility([
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
          path: "/workspace/chat",
          icon: MessageSquare,
          label: "Тестовый чат",
          visible: true,
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
      ]);
  const quickNavItems: WorkspaceNavItem[] = withFeatureVisibility([
    { path: "/workspace/apps", icon: Grid2X2, label: t.nav.apps, visible: access.canUseChat },
    { path: "/workspace/media", icon: ImageIcon, label: t.nav.media, visible: access.canUseChat },
    { path: "/workspace/avatar", icon: UserRound, label: t.nav.avatar, visible: access.canUseChat },
    { path: "/workspace/history", icon: Clock3, label: t.nav.history, visible: access.canUseHistory },
  ]);

  const workspaceNavItems: WorkspaceNavItem[] = withFeatureVisibility([
        { path: "/workspace", icon: Home, label: t.nav.home, visible: access.canUseChat },
        { path: "/workspace/chat", icon: MessageSquare, label: t.nav.chat, visible: access.canUseChat },
        { path: "/workspace/projects", icon: FolderKanban, label: t.nav.projects, visible: access.canUseChat },
        { path: "/workspace/balance", icon: CreditCard, label: t.nav.balance, visible: access.canUseBalance },
        {
          path: "/workspace/settings",
          icon: Settings,
          label: t.nav.settings,
          visible: access.canUseSettings,
          active: () => location.pathname.startsWith("/workspace/settings") || location.pathname === "/workspace/memory",
        },
      ]);
  const shellLabels = getShellLabels(language);
  const workspaceNavSections: WorkspaceNavSection[] = [
    {
      id: "work",
      label: shellLabels.work,
      items: workspaceNavItems.filter((item) =>
        item.path === "/workspace" || item.path === "/workspace/chat" || item.path === "/workspace/projects",
      ),
    },
    {
      id: "create",
      label: shellLabels.create,
      items: [],
    },
    {
      id: "manage",
      label: shellLabels.manage,
      items: workspaceNavItems.filter((item) =>
        item.path === "/workspace/balance" ||
        item.path === "/workspace/settings",
      ),
    },
  ];
  const ownerAdminItems = adminNavItems.filter(
    (adminItem) => !workspaceNavItems.some((workspaceItem) => workspaceItem.path === adminItem.path),
  );
  const adminNavSections: WorkspaceNavSection[] = [
    {
      id: "admin",
      label: shellLabels.admin,
      items: adminNavItems.filter((item) =>
        item.path === "/workspace/admin" ||
        item.path === "/workspace/admin/control" ||
        item.path === "/workspace/admin/ai-budget" ||
        item.path === "/workspace/admin/users" ||
        item.path === "/workspace/admin/pricing",
      ),
    },
    {
      id: "admin-work",
      label: shellLabels.work,
      items: adminNavItems.filter((item) =>
        item.path === "/workspace/chat" || item.path === "/workspace/mailings" || item.path === "/workspace/settings",
      ),
    },
  ];
  const navSections = isAdminNavigation
    ? adminNavSections
    : access.isOwner
      ? [
          ...workspaceNavSections,
          {
            id: "owner-admin",
            label: shellLabels.admin,
            items: ownerAdminItems,
          },
        ]
      : workspaceNavSections;
  const navItems: WorkspaceNavItem[] = [
    ...navSections.flatMap((section) => section.items),
    ...quickNavItems,
    ...businessNavItems,
  ];

  const visibleQuickItems = quickNavItems.filter((item) => item.visible);
  const pageContext = getPageContext(location.pathname, navItems, shellLabels.workspace);

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

  const isActive = (item: WorkspaceNavItem) => {
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
  const showModelContext =
    location.pathname.startsWith("/workspace/chat") ||
    location.pathname.startsWith("/workspace/apps") ||
    location.pathname.startsWith("/workspace/media") ||
    location.pathname.startsWith("/workspace/avatar");

  const fallbackRedirect = getUnauthorizedWorkspaceRedirect(location.pathname, access);
  const featureContent = (() => {
    if (currentFeatureStatus === "hidden") {
      return fallbackRedirect && fallbackRedirect !== location.pathname
        ? <Navigate to={fallbackRedirect} replace />
        : <Navigate to="/workspace/chat" replace />;
    }

    if (currentFeatureStatus === "beta") {
      return <WorkspaceFeatureComingSoon currentPath={location.pathname} />;
    }

    return <Outlet />;
  })();
  const usageSlot = !isAdminNavigation && access.canUseBalance ? (
    <div className="px-3 pb-3">
      <UsageLimitPanel
        isGuest={access.isGuest}
        usage={usageLimits}
        wallet={wallet}
        subscription={currentSubscription}
        plans={plans}
      />
    </div>
  ) : null;
  const profileSlot = (
    <div className="border-t border-[var(--line-subtle)] p-4">
      <div className="flex items-center gap-2 py-2">
        {isAuthenticated ? (
          <Link
            to={profileHref}
            className="flex min-w-0 flex-1 items-center justify-center gap-3 rounded-[var(--radius-control)] py-1 transition-colors hover:bg-[var(--surface-1)] md:justify-start md:px-2"
            aria-label={t.settings.profile}
          >
            <div className="relative shrink-0">
              {profileAvatar ? (
                <img src={profileAvatar} alt="" className="h-8 w-8 rounded-full border border-[var(--line-subtle)] object-cover" />
              ) : (
                <CircleUser className="h-8 w-8 text-[var(--text-secondary)]" strokeWidth={1.5} />
              )}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--canvas)] bg-[var(--signal-mint)]" />
            </div>
            <div className="hidden min-w-0 flex-1 md:block">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">{user?.name || user?.email || t.auth.guest}</p>
              <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                <Zap className="h-3 w-3" />
                <span className="truncate">{user?.email ?? t.auth.guestHint}</span>
              </div>
            </div>
          </Link>
        ) : (
          <Link
            to="/auth?mode=login&returnTo=%2Fworkspace%2Fsettings%2Fprofile"
            className="flex min-w-0 flex-1 items-center justify-center gap-3 rounded-[var(--radius-control)] py-1 transition-colors hover:bg-[var(--surface-1)] md:justify-start md:px-2"
            aria-label={t.auth.loginAction}
            title={t.auth.loginAction}
          >
            <LogIn className="h-5 w-5 text-[var(--text-tertiary)]" strokeWidth={1.6} />
            <div className="hidden min-w-0 flex-1 md:block">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">{t.auth.loginAction}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{t.auth.loginSubtitle}</p>
            </div>
          </Link>
        )}
        {isAuthenticated ? (
          <button
            type="button"
            onClick={logout}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)] md:inline-flex"
            aria-label={t.auth.logout}
            title={t.auth.logout}
          >
            <LogOut className="h-4 w-4" strokeWidth={1.6} />
          </button>
        ) : null}
      </div>
    </div>
  );
  const overlays = (
    <>
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
    </>
  );

  return (
    <WorkspaceAppShell
      sidebarCollapsed={sidebarCollapsed}
      sidebar={
        <WorkspaceSidebar
          collapsed={sidebarCollapsed}
          product={t.product}
          showBusinessBrand={showBusinessBrand}
          canCreateTask={!isAdminNavigation && access.canUseChat}
            sections={navSections}
          quickItems={visibleQuickItems}
          businessItems={businessNavItems}
          usageSlot={usageSlot}
          profileSlot={profileSlot}
          isActive={isActive}
          onCollapsedChange={setSidebarCollapsed}
        />
      }
      topbar={
        <WorkspaceTopbar
          title={pageContext.title}
          section={pageContext.section}
          showModelContext={showModelContext}
          profileAvatar={profileAvatar}
          profileLabel={user?.name || user?.email || t.auth.guest}
          profileHref={profileHref}
          showProfileButton={isAuthenticated}
        />
      }
      commandPalette={<CommandPalette />}
      mobileNavigation={!isAdminNavigation ? <MobileNavigation profileHref={profileHref} /> : null}
      overlays={overlays}
    >
        {featureContent}
    </WorkspaceAppShell>
  );
}

function WorkspaceFeatureComingSoon({ currentPath }: { currentPath: string }) {
  const basePath = currentPath.split("/").slice(0, 3).join("/");
  const label = featureLabelForPath(basePath);

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-3xl flex-col justify-center gap-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-gray-300">
          Раздел в разработке
        </div>
        <h1 className="text-3xl font-medium leading-tight text-white sm:text-4xl">Скоро будет доступно: {label}</h1>
        <p className="text-sm leading-relaxed text-gray-400">
          Этот раздел пока на этапе подготовки. Вы можете продолжить работу в чате — там доступен весь текущий функционал.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/workspace/chat" className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-gray-200">
            Перейти в чат
          </Link>
          <Link
            to="/workspace/apps"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white"
          >
            Открыть приложения
          </Link>
        </div>
      </div>
    </div>
  );
}

function featureLabelForPath(path: string) {
  if (path.startsWith("/workspace/avatar")) {
    return "Аватар";
  }

  return path || "/workspace";
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
    return null;
  }

  if (!usage) {
    return null;
  }

  if (usage.hasActiveSubscription) {
    const plan = plans.find((item) => item.id === subscription?.subscription?.planId) ?? plans.find((item) => item.id === usage.planId);
    const rawAvailableCredits = wallet?.availableCredits ?? 0;
    const availableCredits = plan ? Math.min(rawAvailableCredits, plan.monthlyCredits) : rawAvailableCredits;
    const monthlyCredits = plan?.monthlyCredits ?? Math.max(availableCredits, 1);
    const remainingPercent =
      monthlyCredits > 0 ? Math.min(100, Math.max(0, (availableCredits / monthlyCredits) * 100)) : 0;

    return (
      <div className="ns-usage-meter" data-active="true">
        <div className="flex items-center justify-between gap-2">
          <span className="ns-overline text-[var(--signal-mint)]">Подписка</span>
          <span className="rounded-full bg-[var(--signal-mint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-inverse)]">
            Активна
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Текст, видео и песни доступны.</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{formatCredits(availableCredits)}</p>
            <p className="text-xs text-[var(--text-secondary)]">nomduchat-кредитов</p>
          </div>
          <p className="pb-0.5 text-xs text-[var(--text-tertiary)]">{Math.round(remainingPercent)}%</p>
        </div>
        <div className="ns-usage-progress mt-3">
          <span style={{ width: `${remainingPercent}%` }} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
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
    <div className="ns-usage-meter">
      <div className="flex items-center justify-between gap-2">
        <span className="ns-overline">Сегодня</span>
        <span className="rounded-full border border-[var(--line-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
          Free
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{remaining}</p>
          <p className="text-xs text-[var(--text-tertiary)]">текстовых осталось</p>
        </div>
        <p className="pb-0.5 text-xs text-[var(--text-tertiary)]">{Math.round(remainingProgress)}%</p>
      </div>
      <div className="ns-usage-progress mt-3">
        <span style={{ width: `${remainingProgress}%` }} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
        Использовано {used}/{limit}. Видео и песни откроются после подписки.
      </p>
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

function getShellLabels(language: Language) {
  const labels = {
    ru: {
      workspace: "Рабочее пространство",
      work: "Работа",
      create: "Создание",
      manage: "Управление",
      admin: "Администрирование",
      localRole: "Локальная роль",
    },
    kk: {
      workspace: "Жұмыс кеңістігі",
      work: "Жұмыс",
      create: "Жасау",
      manage: "Басқару",
      admin: "Әкімшілік",
      localRole: "Жергілікті рөл",
    },
    en: {
      workspace: "Workspace",
      work: "Work",
      create: "Create",
      manage: "Manage",
      admin: "Admin",
      localRole: "Local role",
    },
  };

  return labels[language];
}

function getPageContext(pathname: string, navItems: WorkspaceNavItem[], fallbackSection: string) {
  const activeItem = navItems
    .filter((item) => item.visible)
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => {
      if (item.active) return item.active();
      const path = item.path.split("?")[0];
      return path === "/workspace" ? pathname === "/workspace" || pathname === "/workspace/" : pathname.startsWith(path);
    });

  return {
    section: fallbackSection,
    title: activeItem?.label ?? fallbackSection,
  };
}
