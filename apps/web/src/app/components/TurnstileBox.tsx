import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId: string) => void;
    };
  }
}

type TurnstileBoxProps = {
  action: string;
  onTokenChange: (token: string | null) => void;
};

const turnstileScriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function isTurnstileEnabled() {
  return Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
}

export default function TurnstileBox({ action, onTokenChange }: TurnstileBoxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;
    onTokenChange(null);

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: "dark",
          callback: (token) => onTokenChange(token),
          "expired-callback": () => onTokenChange(null),
          "error-callback": () => onTokenChange(null),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      onTokenChange(null);
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onTokenChange, siteKey]);

  if (!siteKey) return null;

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black p-3">
      <div ref={containerRef} className="min-h-[65px]" />
      {loadError ? (
        <p className="mt-2 text-xs text-red-200">Проверка от ботов не загрузилась. Обновите страницу.</p>
      ) : null}
    </div>
  );
}

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();

  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${turnstileScriptUrl}"]`);
  if (existingScript) {
    return new Promise<void>((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("turnstile_script_failed")), { once: true });
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = turnstileScriptUrl;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile_script_failed"));
    document.head.appendChild(script);
  });
}
