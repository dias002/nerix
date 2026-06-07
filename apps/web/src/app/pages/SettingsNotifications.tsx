import { useState } from "react";
import { Bell, CreditCard, MessageSquare } from "lucide-react";
import { useLanguage } from "../i18n";
import { SettingsDetailShell } from "./SettingsProfile";

const storageKey = "nerix-notifications";

type NotificationState = {
  chat: boolean;
  billing: boolean;
  product: boolean;
};

export default function SettingsNotifications() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<NotificationState>(() => readSettings());

  const rows = [
    { id: "chat" as const, label: t.settings.chatNotifications, icon: MessageSquare },
    { id: "billing" as const, label: t.settings.billingNotifications, icon: CreditCard },
    { id: "product" as const, label: t.settings.productNotifications, icon: Bell },
  ];

  const updateSetting = (id: keyof NotificationState) => {
    setSettings((current) => {
      const next = { ...current, [id]: !current[id] };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  return (
    <SettingsDetailShell title={t.settings.notifications} subtitle={t.settings.notificationsSubtitle}>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0D0D]">
        {rows.map((row, index) => (
          <button
            key={row.id}
            type="button"
            onClick={() => updateSetting(row.id)}
            className={`flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-white/[0.03] ${
              index !== rows.length - 1 ? "border-b border-white/5" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <row.icon className="h-5 w-5 shrink-0 text-gray-400" strokeWidth={1.6} />
              <span className="text-gray-200">{row.label}</span>
            </div>
            <span
              className={`h-6 w-11 rounded-full border transition-colors ${
                settings[row.id] ? "border-white/30 bg-white" : "border-white/10 bg-black"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full transition-transform ${
                  settings[row.id] ? "translate-x-5 bg-black" : "translate-x-0 bg-gray-600"
                }`}
              />
            </span>
          </button>
        ))}
      </div>
    </SettingsDetailShell>
  );
}

function readSettings(): NotificationState {
  if (typeof window === "undefined") {
    return { chat: false, billing: true, product: false };
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? { chat: false, billing: true, product: false, ...JSON.parse(raw) } : { chat: false, billing: true, product: false };
  } catch {
    return { chat: false, billing: true, product: false };
  }
}
