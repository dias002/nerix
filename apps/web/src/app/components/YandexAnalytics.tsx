import { useEffect } from "react";

const metrikaId = import.meta.env.VITE_YANDEX_METRIKA_ID?.trim();
const verificationCode = import.meta.env.VITE_YANDEX_VERIFICATION?.trim();
type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export default function YandexAnalytics() {
  useEffect(() => {
    if (verificationCode && !document.querySelector('meta[name="yandex-verification"]')) {
      const meta = document.createElement("meta");
      meta.name = "yandex-verification";
      meta.content = verificationCode;
      document.head.appendChild(meta);
    }

    if (!metrikaId || !/^\d+$/.test(metrikaId) || document.getElementById(`yandex-metrika-${metrikaId}`)) {
      return;
    }

    const idleWindow = window as IdleWindow;
    let cancelled = false;
    const load = () => {
      if (cancelled || document.getElementById(`yandex-metrika-${metrikaId}`)) return;

    const script = document.createElement("script");
    script.id = `yandex-metrika-${metrikaId}`;
    script.async = true;
    script.text = `
      (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
      })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
      ym(${metrikaId}, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
    `;
    document.head.appendChild(script);
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const id = idleWindow.requestIdleCallback(load, { timeout: 4200 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(id);
      };
    }

    const id = window.setTimeout(load, 3200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  return null;
}
