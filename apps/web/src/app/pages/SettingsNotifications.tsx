import { useState } from "react";
import { Bell, CalendarClock, CreditCard, Mail, MessageSquare } from "lucide-react";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";
import { SettingsDetailShell } from "./SettingsProfile";

const storageKey = "nomduchat-notifications";

type NotificationState = {
  chat: boolean;
  billing: boolean;
  product: boolean;
  registrationEmail: boolean;
  unpaidReminderDay1: boolean;
  unpaidReminderDay3: boolean;
  tariffEndingReminder: boolean;
};

export default function SettingsNotifications() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationState>(() => readSettings());
  const canSeeMailScenarios = Boolean(user?.permissions.adminPanel || user?.permissions.mailings);

  const userRows = [
    { id: "chat" as const, label: t.settings.chatNotifications, description: "Показывать уведомления по новым ответам.", icon: MessageSquare },
    { id: "billing" as const, label: t.settings.billingNotifications, description: "Платежи, чеки и статус подписки.", icon: CreditCard },
    { id: "product" as const, label: t.settings.productNotifications, description: "Обновления продукта и новые возможности.", icon: Bell },
  ];
  const adminRows = [
    { id: "registrationEmail" as const, label: "Письмо после регистрации", description: "Приветственное письмо с подсказками по началу работы.", icon: Mail },
    { id: "unpaidReminderDay1" as const, label: "Напоминание через 1 день", description: "Если пользователь зарегистрировался, но не оплатил тариф.", icon: CalendarClock },
    { id: "unpaidReminderDay3" as const, label: "Напоминание через 3 дня", description: "Повторное письмо с пользой тарифа и ссылкой на оплату.", icon: CalendarClock },
    { id: "tariffEndingReminder" as const, label: "Тариф скоро закончится", description: "Письмо до окончания оплаченного периода.", icon: CreditCard },
  ];
  const rows = canSeeMailScenarios ? [...userRows, ...adminRows] : userRows;
  const mailScenarios = [
    {
      title: "После регистрации",
      enabled: settings.registrationEmail,
      subject: "Добро пожаловать в nomduchat",
      text: "Короткое письмо с входом в кабинет, подсказками по чату и ссылкой на тарифы.",
    },
    {
      title: "После оплаты",
      enabled: settings.billing,
      subject: "Тариф активирован",
      text: "Подтверждение оплаты, название тарифа, период действия и ссылка на историю платежей.",
    },
    {
      title: "Не оплатил через 1 день",
      enabled: settings.unpaidReminderDay1,
      subject: "Продолжите настройку nomduchat",
      text: "Мягкое напоминание о тарифах, лимитах и быстрый переход к оплате.",
    },
    {
      title: "Не оплатил через 3 дня",
      enabled: settings.unpaidReminderDay3,
      subject: "Ваш аккаунт ждет первый тариф",
      text: "Повторное письмо с пользой тарифа и ссылкой на оплату.",
    },
    {
      title: "Тариф скоро закончится",
      enabled: settings.tariffEndingReminder,
      subject: "Подписка скоро закончится",
      text: "Напоминание до окончания периода и ссылка на продление или смену плана.",
    },
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
              <span>
                <span className="block text-gray-200">{row.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-gray-600">{row.description}</span>
              </span>
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

      {canSeeMailScenarios ? (
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-medium text-white">Сценарии писем</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            Эти шаблоны показывают, какие письма будут уходить после подключения SMTP-отправки.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {mailScenarios.map((scenario) => (
            <div key={scenario.title} className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-medium text-white">{scenario.title}</h4>
                  <p className="mt-1 text-xs text-gray-600">{scenario.subject}</p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    scenario.enabled
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                      : "border-white/10 bg-black text-gray-500"
                  }`}
                >
                  {scenario.enabled ? "включено" : "выключено"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">{scenario.text}</p>
            </div>
          ))}
        </div>
      </section>
      ) : null}
    </SettingsDetailShell>
  );
}

function readSettings(): NotificationState {
  const defaults = {
    chat: false,
    billing: true,
    product: false,
    registrationEmail: true,
    unpaidReminderDay1: true,
    unpaidReminderDay3: true,
    tariffEndingReminder: true,
  };

  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}
