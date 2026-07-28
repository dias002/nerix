import { useEffect, useState } from "react";
import { Check, Globe2 } from "lucide-react";
import { detectGeoCountry } from "../api-client/geo";

type BillingCountry = "KZ" | "RU";
type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

const confirmedStorageKey = "nomduchat-country-confirmed";
const countryStorageKey = "nomduchat-country";

export default function CountryConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<BillingCountry>(() => inferCountry());

  useEffect(() => {
    if (window.localStorage.getItem(confirmedStorageKey) === "true") return;

    const savedCountry = window.localStorage.getItem(countryStorageKey);
    const storedCountry = savedCountry === "RU" || savedCountry === "KZ" ? savedCountry : null;
    const nextCountry = storedCountry ?? inferCountry();
    setCountry(nextCountry);
    window.localStorage.setItem(countryStorageKey, nextCountry);
    setOpen(true);

    if (storedCountry) return;

    let active = true;
    const loadGeoCountry = () => {
      detectGeoCountry()
        .then((response) => {
          if (!active || (response.country !== "RU" && response.country !== "KZ")) return;
          setCountry(response.country);
          window.localStorage.setItem(countryStorageKey, response.country);
          window.dispatchEvent(new Event("nomduchat-country-updated"));
        })
        .catch(() => {
          // Header-based geo detection is best-effort; timezone/language fallback stays active.
        });
    };
    const idleWindow = window as IdleWindow;
    const idleId = idleWindow.requestIdleCallback?.(loadGeoCountry, { timeout: 2600 });
    const timeoutId = idleId === undefined ? window.setTimeout(loadGeoCountry, 1800) : undefined;

    return () => {
      active = false;
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  const confirm = () => {
    window.localStorage.setItem(countryStorageKey, country);
    window.localStorage.setItem(confirmedStorageKey, "true");
    window.dispatchEvent(new Event("nomduchat-country-updated"));
    window.dispatchEvent(new Event("nomduchat-country-confirmed"));
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[55] flex justify-center text-white sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-6 sm:w-[min(26rem,calc(100vw-3rem))]">
      <section className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0A0A]/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-md sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 sm:h-10 sm:w-10">
            <Globe2 className="h-5 w-5 text-gray-300" strokeWidth={1.7} />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Подтвердите страну</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              Нужна для валюты и способов оплаты. Позже страну можно изменить в настройках.
            </p>
          </div>
        </div>

        <label className="mt-4 block sm:mt-5">
          <span className="mb-1.5 block text-xs text-gray-500">Страна</span>
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value === "RU" ? "RU" : "KZ")}
            className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
          >
            <option className="bg-black text-white" value="KZ">Казахстан</option>
            <option className="bg-black text-white" value="RU">Россия</option>
          </select>
        </label>

        <button
          type="button"
          onClick={confirm}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 sm:mt-5 sm:h-11"
        >
          <Check className="h-4 w-4" strokeWidth={1.8} />
          Подтвердить
        </button>
      </section>
    </div>
  );
}

function inferCountry(): BillingCountry {
  if (typeof window === "undefined") return "KZ";

  const saved = window.localStorage.getItem(countryStorageKey);
  if (saved === "RU" || saved === "KZ") return saved;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase();
  if (timezone.includes("almaty") || timezone.includes("astana") || timezone.includes("qyzylorda")) return "KZ";

  const language = navigator.language.toLowerCase();
  if (language.includes("ru-ru")) return "RU";

  return "KZ";
}
