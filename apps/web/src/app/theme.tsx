import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppearanceMode = "dark" | "light";

const storageKey = "nerix-appearance";

type ThemeContextValue = {
  theme: AppearanceMode;
  setTheme: (theme: AppearanceMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppearanceMode>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme(nextTheme) {
        setThemeState(nextTheme);
      },
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}

function readStoredTheme(): AppearanceMode {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(storageKey) === "light" ? "light" : "dark";
}

function applyTheme(theme: AppearanceMode) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
}
