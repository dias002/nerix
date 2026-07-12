import { lazy } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";

const Home = lazy(() => import("./pages/Home"));
const Models = lazy(() => import("./pages/Models"));
const About = lazy(() => import("./pages/About"));
const Faq = lazy(() => import("./pages/Faq"));
const Contacts = lazy(() => import("./pages/Contacts"));
const SeoArticles = lazy(() => import("./pages/SeoArticles"));
const Business = lazy(() => import("./pages/Business"));
const Requisites = lazy(() => import("./pages/Requisites"));
const Legal = lazy(() => import("./pages/Legal"));
const Support = lazy(() => import("./pages/Support"));
const DataDeletion = lazy(() => import("./pages/DataDeletion"));
const AuthPage = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const PasswordReset = lazy(() => import("./pages/PasswordReset"));
const WorkspaceLayout = lazy(() => import("./components/WorkspaceLayout"));
const Chat = lazy(() => import("./pages/Chat"));
const AvatarStudio = lazy(() => import("./pages/AvatarStudio"));
const Apps = lazy(() => import("./pages/Apps"));
const Projects = lazy(() => import("./pages/Projects"));
const Agents = lazy(() => import("./pages/Agents"));
const History = lazy(() => import("./pages/History"));
const Memory = lazy(() => import("./pages/Memory"));
const Mailings = lazy(() => import("./pages/Mailings"));
const BusinessCabinet = lazy(() => import("./pages/BusinessCabinet"));
const BusinessDialogs = lazy(() => import("./pages/BusinessDialogs"));
const BusinessEmployeeAnalytics = lazy(() => import("./pages/BusinessEmployeeAnalytics"));
const BusinessIdeas = lazy(() => import("./pages/BusinessIdeas"));
const BusinessTelegramBot = lazy(() => import("./pages/BusinessTelegramBot"));
const BusinessWebsiteBuilder = lazy(() => import("./pages/BusinessWebsiteBuilder"));
const PublicBusinessWebsite = lazy(() => import("./pages/PublicBusinessWebsite"));
const TelegramBotMiniApp = lazy(() => import("./pages/TelegramBotMiniApp"));
const Admin = lazy(() => import("./pages/Admin"));
const Balance = lazy(() => import("./pages/Balance"));
const Settings = lazy(() => import("./pages/Settings"));
const SettingsProfile = lazy(() => import("./pages/SettingsProfile"));
const SettingsAppearance = lazy(() => import("./pages/SettingsAppearance"));
const SettingsNotifications = lazy(() => import("./pages/SettingsNotifications"));

const basename = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

const routes: RouteObject[] = [
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/about",
    Component: About,
  },
  {
    path: "/faq",
    Component: Faq,
  },
  {
    path: "/contacts",
    Component: Contacts,
  },
  {
    path: "/seo/articles",
    Component: SeoArticles,
  },
  {
    path: "/seo/articles/:slug",
    Component: SeoArticles,
  },
  {
    path: "/models",
    Component: Models,
  },
  {
    path: "/business",
    Component: Business,
  },
  {
    path: "/requisites",
    Component: Requisites,
  },
  {
    path: "/company",
    Component: Requisites,
  },
  {
    path: "/legal/terms",
    Component: Legal,
  },
  {
    path: "/legal/privacy",
    Component: Legal,
  },
  {
    path: "/legal/refund",
    Component: Legal,
  },
  {
    path: "/legal/pricing",
    Component: Legal,
  },
  {
    path: "/legal/cookies",
    Component: Legal,
  },
  {
    path: "/legal/auto-renewal",
    Component: Legal,
  },
  {
    path: "/terms",
    Component: Legal,
  },
  {
    path: "/privacy",
    Component: Legal,
  },
  {
    path: "/refund",
    Component: Legal,
  },
  {
    path: "/pricing",
    Component: Legal,
  },
  {
    path: "/cookies",
    Component: Legal,
  },
  {
    path: "/auto-renewal",
    Component: Legal,
  },
  {
    path: "/support",
    Component: Support,
  },
  {
    path: "/data-deletion",
    Component: DataDeletion,
  },
  {
    path: "/delete-account",
    Component: DataDeletion,
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
    path: "/auth/reset",
    Component: PasswordReset,
  },
  {
    path: "/workspace",
    Component: WorkspaceLayout,
    children: [
      { index: true, Component: Chat },
      { path: "chat", Component: Chat },
      { path: "avatar", Component: AvatarStudio },
      { path: "apps", Component: Apps },
      { path: "projects", Component: Projects },
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
      { path: "admin/users", Component: Admin },
      { path: "admin/memory", Component: Admin },
      { path: "admin/pricing", Component: Admin },
      { path: "admin/control", Component: Admin },
      { path: "admin/ai-budget", Component: Admin },
      { path: "balance", Component: Balance },
      { path: "settings", Component: Settings },
      { path: "settings/memory", Component: Memory },
      { path: "settings/profile", Component: SettingsProfile },
      { path: "settings/appearance", Component: SettingsAppearance },
      { path: "settings/notifications", Component: SettingsNotifications },
    ],
  },
];

export const router = createBrowserRouter(
  routes.map(withRouteErrorBoundary),
  { basename }
);

function withRouteErrorBoundary(route: RouteObject): RouteObject {
  return {
    ...route,
    ErrorBoundary: RouteErrorBoundary,
    children: route.children?.map(withRouteErrorBoundary),
  };
}
