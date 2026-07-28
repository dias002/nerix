import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  ExternalLink,
  Loader2,
  MessageSquare,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  createTelegramBotOrder,
  createTelegramMiniAppDraft,
  toPublicApiError,
  type TelegramMiniAppDraftApiRecord,
  type TelegramMiniAppDraftInput,
} from "../api";

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: {
    user?: {
      username?: string;
      first_name?: string;
    };
  };
  colorScheme?: "light" | "dark";
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred?: (style: "light" | "medium" | "heavy") => void;
    notificationOccurred?: (type: "error" | "success" | "warning") => void;
  };
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

type MiniAppForm = TelegramMiniAppDraftInput;

const initialForm: MiniAppForm = {
  country: "KZ",
  companyName: "",
  businessCategory: "",
  city: "",
  contact: "",
  website: "",
  mainOffer: "",
  priceInfo: "",
  audience: "",
  goals: ["answers", "leads"],
  language: "ru",
  telegramInitData: "",
};

const goals = [
  { id: "answers", label: "Ответы" },
  { id: "leads", label: "Заявки" },
  { id: "sales", label: "Продажи" },
  { id: "support", label: "Поддержка" },
  { id: "booking", label: "Запись" },
];

export default function TelegramBotMiniApp() {
  const [telegram, setTelegram] = useState<TelegramWebApp | null>(null);
  const [form, setForm] = useState<MiniAppForm>(initialForm);
  const [draft, setDraft] = useState<TelegramMiniAppDraftApiRecord | null>(null);
  const [generating, setGenerating] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const connect = () => {
      if (!active) return;
      const webApp = window.Telegram?.WebApp ?? null;
      setTelegram(webApp);
      webApp?.ready?.();
      webApp?.expand?.();

      const username = webApp?.initDataUnsafe?.user?.username;
      const firstName = webApp?.initDataUnsafe?.user?.first_name;
      setForm((current) => ({
        ...current,
        contact: current.contact || (username ? `@${username}` : firstName || ""),
        telegramInitData: webApp?.initData ?? "",
      }));
    };

    if (window.Telegram?.WebApp) {
      connect();
    } else {
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-web-app.js";
      script.async = true;
      script.addEventListener("load", connect, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      active = false;
    };
  }, []);

  const isReady = useMemo(
    () =>
      form.companyName.trim().length >= 2 &&
      form.businessCategory.trim().length >= 2 &&
      form.contact.trim().length >= 3 &&
      form.mainOffer.trim().length >= 10,
    [form.businessCategory, form.companyName, form.contact, form.mainOffer]
  );

  const generateDraft = async () => {
    if (!isReady || generating) return;

    setGenerating(true);
    setError(null);
    setOrderStatus(null);
    try {
      telegram?.HapticFeedback?.impactOccurred?.("light");
      const response = await createTelegramMiniAppDraft(form);
      setDraft(response.draft);
      telegram?.HapticFeedback?.notificationOccurred?.("success");
    } catch (generateError) {
      setError(toPublicApiError(generateError, "Не удалось собрать черновик бота."));
      telegram?.HapticFeedback?.notificationOccurred?.("error");
    } finally {
      setGenerating(false);
    }
  };

  const createOrder = async () => {
    if (!draft || ordering) return;

    setOrdering(true);
    setError(null);
    try {
      const response = await createTelegramBotOrder(draft.orderPayload);
      setOrderStatus(`Заявка создана: ${response.order.companyName} · ${formatPlainAmount(response.order.amountMinor)}`);
      telegram?.HapticFeedback?.notificationOccurred?.("success");
    } catch (orderError) {
      setError(toPublicApiError(orderError, "Не удалось создать заявку."));
      telegram?.HapticFeedback?.notificationOccurred?.("error");
    } finally {
      setOrdering(false);
    }
  };

  const openManagedBot = () => {
    if (!draft?.managedBotUrl) return;
    if (telegram?.openTelegramLink) {
      telegram.openTelegramLink(draft.managedBotUrl);
      return;
    }
    window.location.href = draft.managedBotUrl;
  };

  const toggleGoal = (goal: string) => {
    setForm((current) => ({
      ...current,
      goals: current.goals.includes(goal)
        ? current.goals.filter((item) => item !== goal)
        : [...current.goals, goal],
    }));
  };

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-5 text-white">
      <div className="mx-auto max-w-xl space-y-5">
        <header className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Bot className="h-5 w-5" strokeWidth={1.7} />
              </div>
              <div>
                <div className="text-sm text-gray-500">nomduchat Mini App</div>
                <h1 className="text-2xl font-medium">AI bot builder</h1>
              </div>
            </div>
            <div className="rounded-full border border-white/10 px-3 py-1 text-sm text-gray-300">
              Цена в конце
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["1", "Данные"],
              ["2", "AI сборка"],
              ["3", "Заявка"],
            ].map(([step, label]) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3">
                <div className="text-xs text-gray-600">{step}</div>
                <div className="mt-1 text-sm text-gray-300">{label}</div>
              </div>
            ))}
          </div>
        </header>

        <section className="space-y-4 rounded-3xl border border-white/10 bg-[#0A0A0A] p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ClipboardList className="h-4 w-4" strokeWidth={1.7} />
            Минимум данных
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm((current) => ({ ...current, country: "KZ" }))}
              className={choiceClass(form.country === "KZ")}
            >
              Казахстан
            </button>
            <button
              type="button"
              onClick={() => setForm((current) => ({ ...current, country: "RU" }))}
              className={choiceClass(form.country === "RU")}
            >
              Россия
            </button>
          </div>

          <Field
            label="Компания"
            value={form.companyName}
            onChange={(value) => setForm((current) => ({ ...current, companyName: value }))}
            placeholder="Nomdu Market"
          />
          <Field
            label="Ниша"
            value={form.businessCategory}
            onChange={(value) => setForm((current) => ({ ...current, businessCategory: value }))}
            placeholder="Оптовые продажи посуды"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Город"
              value={form.city ?? ""}
              onChange={(value) => setForm((current) => ({ ...current, city: value }))}
              placeholder="Алматы"
            />
            <Field
              label="Контакт"
              value={form.contact}
              onChange={(value) => setForm((current) => ({ ...current, contact: value }))}
              placeholder="@manager"
            />
          </div>
          <TextArea
            label="Что продаете"
            value={form.mainOffer}
            onChange={(value) => setForm((current) => ({ ...current, mainOffer: value }))}
            placeholder="Каталог столовых приборов, опт для ресторанов, расчет партии, доставка."
          />
          <TextArea
            label="Цены и условия"
            value={form.priceInfo ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, priceInfo: value }))}
            placeholder="Если точных цен нет, напишите что расчет делает менеджер."
          />
          <Field
            label="Сайт или каталог"
            value={form.website ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, website: value }))}
            placeholder="https://example.com"
          />

          <div className="space-y-2">
            <div className="text-sm text-gray-400">Задачи</div>
            <div className="flex flex-wrap gap-2">
              {goals.map((goal) => (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => toggleGoal(goal.id)}
                  className={pillClass(form.goals.includes(goal.id))}
                >
                  {goal.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void generateDraft()}
            disabled={!isReady || generating}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : <Wand2 className="h-4 w-4" strokeWidth={1.8} />}
            {generating ? "AI собирает" : "Собрать элементы бота"}
          </button>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {draft ? (
          <section className="space-y-4 rounded-3xl border border-white/10 bg-[#0A0A0A] p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Sparkles className="h-4 w-4" strokeWidth={1.7} />
              Сгенерировано агентом
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-gray-500">Название</div>
              <div className="mt-1 text-xl font-medium">{draft.botName}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.botUsernameSuggestions.map((username) => (
                  <span key={username} className="rounded-full border border-white/10 px-3 py-1 text-sm text-gray-300">
                    @{username}
                  </span>
                ))}
              </div>
            </div>

            <GeneratedBlock icon={MessageSquare} title="Приветствие" text={draft.welcomeMessage} />
            <GeneratedBlock icon={ClipboardList} title="Задача бота" text={draft.botPurpose} />
            <GeneratedBlock icon={CheckCircle2} title="Правила" text={draft.responseRules} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm text-gray-500">Кнопки меню</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {draft.menuButtons.map((button) => (
                    <span key={button} className="rounded-full bg-white px-3 py-1 text-sm text-black">
                      {button}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm text-gray-500">Команды</div>
                <div className="mt-3 space-y-2">
                  {draft.commands.map((command) => (
                    <div key={command.command} className="text-sm text-gray-300">
                      /{command.command} · <span className="text-gray-500">{command.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void createOrder()}
              disabled={ordering}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
            >
              {ordering ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : <CreditCard className="h-4 w-4" strokeWidth={1.8} />}
              {ordering ? "Создаю заявку" : `Создать заявку за ${formatPlainAmount(draft.amountMinor)}`}
            </button>

            {draft.managedBotUrl ? (
              <button
                type="button"
                onClick={openManagedBot}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 text-sm font-medium text-gray-200 transition-colors hover:border-white/20 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                Создать username в Telegram
              </button>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-gray-500">
                Для кнопки создания username нужно указать `TELEGRAM_MANAGER_BOT_USERNAME` на API.
              </div>
            )}

            {orderStatus ? (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                {orderStatus}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="pb-4 text-center text-xs text-gray-700">
          nomduchat · Telegram Mini App
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm text-gray-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-white/10 bg-[#050505] px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-white/25"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm text-gray-400">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-[#050505] px-4 py-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-600 focus:border-white/25"
      />
    </label>
  );
}

function GeneratedBlock({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Bot;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Icon className="h-4 w-4" strokeWidth={1.7} />
        {title}
      </div>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{text}</div>
    </div>
  );
}

function choiceClass(active: boolean) {
  return active
    ? "rounded-2xl border border-white/30 bg-white px-4 py-3 text-sm font-medium text-black"
    : "rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-gray-300";
}

function pillClass(active: boolean) {
  return active
    ? "rounded-full bg-white px-3 py-2 text-sm font-medium text-black"
    : "rounded-full border border-white/10 px-3 py-2 text-sm text-gray-300";
}

function formatPlainAmount(amountMinor: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}
