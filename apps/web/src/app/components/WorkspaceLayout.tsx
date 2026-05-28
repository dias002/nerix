import { Outlet, Link, useLocation } from "react-router";
import { ArrowLeft, Brain, CircleUser, Clock3, CreditCard, Home, MessageSquare, Settings, Users, Zap } from "lucide-react";
import { useLanguage } from "../i18n";

export default function WorkspaceLayout() {
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { path: "/workspace", icon: Home, label: t.nav.home },
    { path: "/workspace/chat", icon: MessageSquare, label: t.nav.chat },
    { path: "/workspace/history", icon: Clock3, label: t.nav.history },
    { path: "/workspace/agents", icon: Users, label: t.nav.agents },
    { path: "/workspace/memory", icon: Brain, label: t.nav.memory },
    { path: "/workspace/balance", icon: CreditCard, label: t.nav.balance },
    { path: "/workspace/settings", icon: Settings, label: t.nav.settings },
  ];

  const isActive = (path: string) => {
    if (path === "/workspace") {
      return location.pathname === "/workspace" || location.pathname === "/workspace/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-black text-white">
      {/* Sidebar */}
      <aside
        className="fixed left-0 top-0 bottom-0 w-20 md:w-64 z-30 flex flex-col"
        style={{
          backgroundColor: "#000000",
          borderRight: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Logo */}
        <div className="px-4 md:px-6 py-8">
          <Link to="/" className="block text-xl font-medium text-white text-center transition-colors hover:text-gray-300 md:text-left">
            <span className="md:hidden">N</span>
            <span className="hidden md:inline">{t.product}</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`
                      flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg transition-colors
                      ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                    <span className="hidden md:inline text-sm font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-3 pb-3">
          <Link
            to="/"
            className="flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white md:justify-start"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
            <span className="hidden text-sm font-medium md:inline">{t.nav.start}</span>
          </Link>
        </div>

        {/* Footer / Profile */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-center md:justify-start gap-3 md:px-2 py-2">
            <div className="relative">
              <CircleUser className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-black"></div>
            </div>
            <div className="hidden md:block flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{t.common.user}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Zap className="w-3 h-3" />
                <span>{t.common.tokens}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-20 md:ml-64 relative z-10 flex flex-col h-screen overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
