import { useEffect, useState } from "react";
import { Check, Cookie } from "lucide-react";

const storageKey = "nomduchat-cookie-consent";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(storageKey) === null);
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
    <div className="fixed bottom-4 left-4 right-4 z-50 text-white md:right-auto md:w-[min(56rem,calc(100vw-2rem))]">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0A0A0A]/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-md md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <Cookie className="h-5 w-5 text-gray-300" strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">Cookies</div>
            <p className="mt-1 text-sm leading-relaxed text-gray-400">
              Мы используем необходимые cookies для работы сервиса и можем включать веб-аналитику после вашего согласия.
              Подробнее:{" "}
              <a href="/legal/cookies" className="text-white underline-offset-4 hover:underline">
                согласие на cookies
              </a>{" "}
              и{" "}
              <a href="/legal/privacy" className="text-white underline-offset-4 hover:underline">
                политика конфиденциальности
              </a>
              .
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => saveChoice("necessary")}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
          >
            Только необходимые
          </button>
          <button
            type="button"
            onClick={() => saveChoice("all")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            <Check className="h-4 w-4" strokeWidth={1.8} />
            Принять
          </button>
        </div>
      </div>
    </div>
  );
}
