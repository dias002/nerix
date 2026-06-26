import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import About from "./pages/About";
import Business from "./pages/Business";
import AuthPage from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import WorkspaceLayout from "./components/WorkspaceLayout";
import WorkspaceHome from "./pages/WorkspaceHome";
import Chat from "./pages/Chat";
import History from "./pages/History";
import Agents from "./pages/Agents";
import Memory from "./pages/Memory";
import Mailings from "./pages/Mailings";
import BusinessCabinet from "./pages/BusinessCabinet";
import BusinessDialogs from "./pages/BusinessDialogs";
import BusinessEmployeeAnalytics from "./pages/BusinessEmployeeAnalytics";
import BusinessIdeas from "./pages/BusinessIdeas";
import BusinessTelegramBot from "./pages/BusinessTelegramBot";
import BusinessWebsiteBuilder from "./pages/BusinessWebsiteBuilder";
import PublicBusinessWebsite from "./pages/PublicBusinessWebsite";
import TelegramBotMiniApp from "./pages/TelegramBotMiniApp";
import Admin from "./pages/Admin";
import Balance from "./pages/Balance";
import Settings from "./pages/Settings";
import SettingsProfile from "./pages/SettingsProfile";
import SettingsAppearance from "./pages/SettingsAppearance";
import SettingsNotifications from "./pages/SettingsNotifications";

const basename = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: Home,
    },
    {
      path: "/about",
      Component: About,
    },
    {
      path: "/business",
      Component: Business,
    },
    {
      path: "/telegram/miniapp/bot-builder",
      Component: TelegramBotMiniApp,
    },
    {
      path: "/site/:slug",
      Component: PublicBusinessWebsite,
    },
    {
      path: "/auth",
      Component: AuthPage,
    },
    {
      path: "/auth/callback",
      Component: AuthCallback,
    },
    {
      path: "/workspace",
      Component: WorkspaceLayout,
      children: [
        { index: true, Component: WorkspaceHome },
        { path: "chat", Component: Chat },
        { path: "history", Component: History },
        { path: "agents", Component: Agents },
        { path: "memory", Component: Memory },
        { path: "mailings", Component: Mailings },
        { path: "business", Component: BusinessCabinet },
        { path: "business/dialogs", Component: BusinessDialogs },
        { path: "business/ideas", Component: BusinessIdeas },
        { path: "business/analytics", Component: BusinessEmployeeAnalytics },
        { path: "business/telegram-bot", Component: BusinessTelegramBot },
        { path: "business/website", Component: BusinessWebsiteBuilder },
        { path: "admin", Component: Admin },
        { path: "balance", Component: Balance },
        { path: "settings", Component: Settings },
        { path: "settings/profile", Component: SettingsProfile },
        { path: "settings/appearance", Component: SettingsAppearance },
        { path: "settings/notifications", Component: SettingsNotifications },
      ],
    },
  ],
  { basename }
);
