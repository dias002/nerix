import { RouterProvider } from "react-router";
import { router } from "./routes";
import { LanguageProvider } from "./i18n";
import { AuthProvider } from "./auth";
import { ThemeProvider } from "./theme";

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
