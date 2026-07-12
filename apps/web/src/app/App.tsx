import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { LanguageProvider } from "./i18n";
import { AuthProvider } from "./auth";
import { ThemeProvider } from "./theme";
import CookieConsentBanner from "./components/CookieConsentBanner";
import UpdateAvailableToast from "./components/UpdateAvailableToast";
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
          <UpdateAvailableToast />
          <YandexAnalytics />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
