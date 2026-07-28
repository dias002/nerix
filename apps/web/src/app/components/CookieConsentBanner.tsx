import { useEffect, useState } from "react";
import { Check, Cookie } from "lucide-react";

const storageKey = "nomduchat-cookie-consent";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => {
      const countryConfirmed = window.localStorage.getItem("nomduchat-country-confirmed") === "true";
      setVisible(countryConfirmed && window.localStorage.getItem(storageKey) === null);
    };

    show();
    window.addEventListener("nomduchat-country-confirmed", show);
    return () => window.removeEventListener("nomduchat-country-confirmed", show);
  }, []);

  const saveChoice = (choice: "necessary" | "all") => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        choice,
        acceptedAt: new Date().toISOString(),
      }),
    );
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 text-white md:bottom-4 md:left-4 md:right-auto md:w-[min(56rem,calc(100vw-2rem))]">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0A0A0A]/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-md md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <Cookie className="h-5 w-5 text-gray-300" strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">Cookies</div>
            <p className="mt-1 text-sm leading-relaxed text-gray-400">
              Необходимые cookies поддерживают работу сервиса. Аналитика включается только с вашего согласия.{" "}
              <a href="/legal/cookies" className="pointer-events-auto text-white underline-offset-4 hover:underline">
                Подробнее
              </a>
              .
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => saveChoice("necessary")}
            className="pointer-events-auto inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
          >
            Только необходимые
          </button>
          <button
            type="button"
            onClick={() => saveChoice("all")}
            className="pointer-events-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            <Check className="h-4 w-4" strokeWidth={1.8} />
            Принять
          </button>
        </div>
      </div>
    </div>
  );
}
