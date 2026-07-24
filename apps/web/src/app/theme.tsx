import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppearanceMode = "dark" | "light";
export type FontSizeMode = "compact" | "comfortable" | "large";

const storageKey = "nomduchat-appearance";
const fontSizeStorageKey = "nomduchat-font-size";
const fontSizeValues: Record<FontSizeMode, string> = {
  compact: "15px",
  comfortable: "16px",
  large: "18px",
};

type ThemeContextValue = {
  theme: AppearanceMode;
  setTheme: (theme: AppearanceMode) => void;
  fontSize: FontSizeMode;
  setFontSize: (fontSize: FontSizeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppearanceMode>(() => readStoredTheme());
  const [fontSize, setFontSizeState] = useState<FontSizeMode>(() => readStoredFontSize());

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  useEffect(() => {
    applyFontSize(fontSize);
    window.localStorage.setItem(fontSizeStorageKey, fontSize);
  }, [fontSize]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme(nextTheme) {
        setThemeState(nextTheme);
      },
      fontSize,
      setFontSize(nextFontSize) {
        setFontSizeState(nextFontSize);
      },
    }),
    [fontSize, theme]
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
  const stored = window.localStorage.getItem(storageKey);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

function readStoredFontSize(): FontSizeMode {
  if (typeof window === "undefined") return "comfortable";
  const stored = window.localStorage.getItem(fontSizeStorageKey);
  return stored === "compact" || stored === "large" ? stored : "comfortable";
}

function applyTheme(theme: AppearanceMode) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
}

function applyFontSize(fontSize: FontSizeMode) {
  const root = document.documentElement;
  root.dataset.fontSize = fontSize;
  root.style.setProperty("--font-size", fontSizeValues[fontSize]);
}
