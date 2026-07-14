import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { LanguageProvider } from "./i18n";
import { AuthProvider } from "./auth";
import { ThemeProvider } from "./theme";
import CookieConsentBanner from "./components/CookieConsentBanner";
import CountryConfirmDialog from "./components/CountryConfirmDialog";
import YandexAnalytics from "./components/YandexAnalytics";

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <RouterProvider router={router} />
          </Suspense>
          <CountryConfirmDialog />
          <CookieConsentBanner />
          <YandexAnalytics />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
