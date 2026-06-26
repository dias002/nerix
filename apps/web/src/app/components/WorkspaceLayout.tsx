import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, BarChart3, Bot, Brain, BriefcaseBusiness, Check, ChevronDown, ChevronLeft, ChevronRight, CircleUser, Clock3, CreditCard, Globe, Home, Lightbulb, LogIn, LogOut, Mail, MessageSquare, PanelLeftClose, Settings, ShieldCheck, SlidersHorizontal, Users, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getUsageLimits, type UsageLimitsApiResponse } from "../api";
import { roleLabel, type LocalRoleOverride, useAuth } from "../auth";
import { useLanguage } from "../i18n";

export default function WorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { canUseRoleSwitcher, isAuthenticated, logout, roleOverride, setRoleOverride, user } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [usageLimits, setUsageLimits] = useState<UsageLimitsApiResponse | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("nomduchat-sidebar-collapsed") === "true";
  });
  const [businessMenuOpen, setBusinessMenuOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("nomduchat-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const permissions = user?.permissions;
  const isAdminNavigation = Boolean(permissions?.adminPanel);
  const adminTab = new URLSearchParams(location.search).get("tab");
  const roleOptions: LocalRoleOverride[] = ["real", "admin", "user", "business_owner", "business_employee"];
  const isBusinessSection =
    location.pathname === "/workspace/business" || location.pathname.startsWith("/workspace/business/");
  const showBusinessBrand = isBusinessSection || user?.activePlanId === "business" || Boolean(user?.businessWorkspace);
  const businessNavItems = [
    { path: "/workspace/business", icon: BriefcaseBusiness, label: t.nav.businessOverview },
    { path: "/workspace/business/website", icon: Globe, label: t.nav.businessWebsite },
    { path: "/workspace/business/telegram-bot", icon: Bot, label: t.nav.businessTelegramBot },
    { path: "/workspace/business/dialogs", icon: MessageSquare, label: t.nav.businessDialogs },
    { path: "/workspace/business/analytics", icon: BarChart3, label: t.nav.businessAnalytics },
    { path: "/workspace/business/ideas", icon: Lightbulb, label: t.nav.businessIdeas },
  ];
  const navItems = isAdminNavigation
    ? [
        {
          path: "/workspace/admin",
          icon: ShieldCheck,
          label: t.nav.admin,
          visible: true,
          active: () => location.pathname === "/workspace/admin" && adminTab !== "users" && adminTab !== "memory" && adminTab !== "pricing" && adminTab !== "control",
        },
        {
          path: "/workspace/admin?tab=control",
          icon: SlidersHorizontal,
          label: t.nav.control,
          visible: true,
          active: () => location.pathname === "/workspace/admin" && adminTab === "control",
        },
        {
          path: "/workspace/admin?tab=users",
          icon: Users,
          label: t.nav.users,
          visible: true,
          active: () => location.pathname === "/workspace/admin" && adminTab === "users",
        },
        {
          path: "/workspace/admin?tab=memory",
          icon: Brain,
          label: t.nav.memory,
          visible: true,
          active: () => location.pathname === "/workspace/admin" && adminTab === "memory",
        },
        {
          path: "/workspace/admin?tab=pricing",
          icon: CreditCard,
          label: t.nav.price,
          visible: true,
          active: () => location.pathname === "/workspace/admin" && adminTab === "pricing",
        },
        { path: "/workspace/mailings", icon: Mail, label: t.nav.mailings, visible: Boolean(permissions?.mailings) },
        { path: "/workspace/settings", icon: Settings, label: t.nav.settings, visible: true },
      ]
    : [
        { path: "/workspace", icon: Home, label: t.nav.home, visible: true },
        { path: "/workspace/chat", icon: MessageSquare, label: t.nav.chat, visible: true },
        { path: "/workspace/history", icon: Clock3, label: t.nav.history, visible: true },
        { path: "/workspace/agents", icon: Users, label: t.nav.agents, visible: true },
        { path: "/workspace/business", icon: BriefcaseBusiness, label: t.nav.business, visible: true },
        { path: "/workspace/balance", icon: CreditCard, label: t.nav.balance, visible: true },
        {
          path: "/workspace/settings",
          icon: Settings,
          label: t.nav.settings,
          visible: true,
          active: () => location.pathname.startsWith("/workspace/settings") || location.pathname === "/workspace/memory",
        },
      ];

  const refreshUsageLimits = useCallback(() => {
    if (isAdminNavigation) {
      setUsageLimits(null);
      return;
    }

    getUsageLimits()
      .then(setUsageLimits)
      .catch(() => setUsageLimits(null));
  }, [isAdminNavigation, user?.id, user?.activePlanId, roleOverride]);

  useEffect(() => {
    if (!isAdminNavigation) return;

    const adminPaths = ["/workspace/admin", "/workspace/mailings", "/workspace/settings"];
    if (!adminPaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))) {
      navigate("/workspace/admin", { replace: true });
    }
  }, [isAdminNavigation, location.pathname, navigate]);

  useEffect(() => {
    setBusinessMenuOpen(isBusinessSection && !sidebarCollapsed);
  }, [isBusinessSection, sidebarCollapsed]);

  useEffect(() => {
    refreshUsageLimits();
  }, [refreshUsageLimits]);

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

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-black text-white">
      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 bottom-0 z-30 flex flex-col transition-[width,transform] duration-300
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
                        {businessNavItems.map((subItem, index) => {
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

        {!sidebarCollapsed && !isAdminNavigation ? (
          <div className="hidden px-3 pb-3 md:block">
            <UsageLimitPanel usage={usageLimits} />
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
              <CircleUser className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
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
    </div>
  );
}

function UsageLimitPanel({ usage }: { usage: UsageLimitsApiResponse | null }) {
  if (!usage) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#070707] p-3 text-xs text-gray-500">
        Лимиты загрузятся после подключения API.
      </div>
    );
  }

  if (usage.hasActiveSubscription) {
    return (
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-emerald-200/80">Подписка</span>
          <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-[11px] font-semibold text-black">
            Активна
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-white">Текст, видео и песни доступны.</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-100/60">
          Лимит зависит от баланса nomduchat-кредитов.
        </p>
      </div>
    );
  }

  const limit = usage.text.dailyLimit ?? 7;
  const remaining = usage.text.remainingToday ?? 0;
  const used = usage.text.usedToday ?? Math.max(0, limit - remaining);
  const progress = limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;

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
        <p className="pb-0.5 text-xs text-gray-500">{used}/{limit}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        Видео и песни откроются после подписки.
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
