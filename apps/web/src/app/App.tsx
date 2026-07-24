import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { LanguageProvider } from "./i18n";
import { AuthProvider } from "./auth";
import { ThemeProvider } from "./theme";
import CookieConsentBanner from "./components/CookieConsentBanner";
import CountryConfirmDialog from "./components/CountryConfirmDialog";
import LanguageSwitch from "./components/LanguageSwitch";
import YandexAnalytics from "./components/YandexAnalytics";

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <RouterProvider router={router} />
          </Suspense>
          <div className="global-language-switch fixed right-5 top-5 z-40">
            <LanguageSwitch />
          </div>
          <CountryConfirmDialog />
          <CookieConsentBanner />
          <YandexAnalytics />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
