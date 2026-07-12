import { useEffect, useState } from "react";
import { RefreshCcw, X } from "lucide-react";

const appBuildId = "2026-07-07-visible-tasks";
const storageKey = "nomduchat-seen-app-build";

export default function UpdateAvailableToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(storageKey) !== appBuildId);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(storageKey, appBuildId);
    setVisible(false);
  };

  const reload = () => {
    window.localStorage.setItem(storageKey, appBuildId);
    window.location.reload();
  };

  if (!visible) return null;

  return (
    <div className="fixed right-4 top-24 z-40 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#111111]/95 p-4 text-white shadow-2xl shadow-black/60 backdrop-blur-md md:bottom-4 md:top-auto">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Скрыть уведомление"
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" strokeWidth={1.8} />
      </button>
      <div className="pr-8">
        <div className="text-sm font-medium text-white">Доступно обновление</div>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">
          Перезагрузите страницу, чтобы получить последнюю версию интерфейса.
        </p>
      </div>
      <button
        type="button"
        onClick={reload}
        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
      >
        <RefreshCcw className="h-4 w-4" strokeWidth={1.8} />
        Обновить
      </button>
    </div>
  );
}
