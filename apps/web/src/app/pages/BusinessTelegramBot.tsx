import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useAuth } from "../auth";
import {
  createTelegramBotOrder,
  getTelegramBotOrders,
  getTelegramBotProduct,
  toPublicApiError,
  type CreateTelegramBotOrderInput,
  type TelegramBotCountry,
  type TelegramBotOrderApiRecord,
  type TelegramBotPriceApiRecord,
  type TelegramBotTone,
} from "../api";

type FormState = CreateTelegramBotOrderInput;
type PaymentState = {
  cardNumber: string;
  cardHolder: string;
  expiry: string;
  cvv: string;
  receiptContact: string;
};

type WizardStep = {
  key: "company" | "offer" | "rules" | "handoff" | "payment";
  title: string;
  text: string;
  fields: Array<keyof FormState>;
};

const fallbackPrices: TelegramBotPriceApiRecord[] = [
  { country: "KZ", currency: "KZT", amountMinor: 3_500_000, label: "35 000" },
  { country: "RU", currency: "RUB", amountMinor: 700_000, label: "7 000" },
];

const toneOptions: Array<{ value: TelegramBotTone; label: string; detail: string }> = [
  { value: "friendly", label: "Тепло", detail: "Спокойно и по-человечески" },
  { value: "expert", label: "Уверенно", detail: "С фактами и четкой структурой" },
  { value: "sales", label: "К заявке", detail: "Мягко ведет к контакту" },
  { value: "strict", label: "Коротко", detail: "Без лишних фраз" },
];

const wizardSteps: WizardStep[] = [
  {
    key: "company",
    title: "Кто запускает менеджера",
    text: "Нужны контакт и название компании, чтобы заявка не потерялась.",
    fields: ["companyName", "contact"],
  },
  {
    key: "offer",
    title: "Что продает компания",
    text: "Опишите бизнес и основные услуги. Этого достаточно для первой версии ответов.",
    fields: ["businessDescription", "services"],
  },
  {
    key: "rules",
    title: "Как должен отвечать менеджер",
    text: "Задайте задачу, стиль и правила. По ним мы соберем рабочий prompt.",
    fields: ["botPurpose", "responseRules"],
  },
  {
    key: "handoff",
    title: "Когда звать человека",
    text: "Укажите, в каких случаях диалог нужно передать владельцу или менеджеру.",
    fields: ["escalationContact"],
  },
  {
    key: "payment",
    title: "Оплата запуска",
    text: "Цена появляется только здесь и берется по стране, указанной в аккаунте.",
    fields: [],
  },
];

export default function BusinessTelegramBot() {
  const { user } = useAuth();
  const accountCountry = resolveCountry(user?.country);
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FormState>(() => createInitialForm(accountCountry));
  const [payment, setPayment] = useState<PaymentState>(() => createEmptyPayment());
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [prices, setPrices] = useState<TelegramBotPriceApiRecord[]>(fallbackPrices);
  const [orders, setOrders] = useState<TelegramBotOrderApiRecord[]>([]);
  const [createdOrder, setCreatedOrder] = useState<TelegramBotOrderApiRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm((current) => (current.country === accountCountry ? current : { ...current, country: accountCountry }));
  }, [accountCountry]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getTelegramBotProduct(), getTelegramBotOrders()])
      .then(([productResponse, ordersResponse]) => {
        if (cancelled) return;
        setPrices(
          productResponse.product.prices.map((price) => ({
            ...price,
            label: formatPlainAmount(price.amountMinor),
          }))
        );
        setOrders(ordersResponse.orders);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(toPublicApiError(loadError, "Не удалось загрузить данные по Telegram-менеджеру."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentStep = wizardSteps[stepIndex];
  const selectedPrice = useMemo(
    () => prices.find((price) => price.country === form.country) ?? fallbackPrices.find((price) => price.country === form.country) ?? fallbackPrices[0],
    [form.country, prices]
  );
  const latestOrder = createdOrder ?? orders[0] ?? null;
  const stepReady = currentStep.fields.every((field) => String(form[field] ?? "").trim().length > 0);
  const paymentReady = isPaymentReady(payment);
  const canSubmit = wizardSteps.every((step) => step.fields.every((field) => String(form[field] ?? "").trim().length > 0));
  const progress = Math.round(((stepIndex + 1) / wizardSteps.length) * 100);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const nextStep = () => {
    if (!stepReady) return;
    setStepIndex((current) => Math.min(current + 1, wizardSteps.length - 1));
  };

  const previousStep = () => {
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const submitOrder = async () => {
    if (!canSubmit || submitting) return;
    if (!paymentReady) {
      setPaymentTouched(true);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await createTelegramBotOrder(form);
      setCreatedOrder(response.order);
      setOrders((current) => [response.order, ...current.filter((order) => order.id !== response.order.id)]);
      setForm(createInitialForm(accountCountry));
      setPayment(createEmptyPayment());
      setPaymentTouched(false);
      setStepIndex(0);
      setStarted(false);
    } catch (submitError) {
      setError(toPublicApiError(submitError, "Не удалось создать заявку на Telegram-менеджера."));
    } finally {
      setSubmitting(false);
    }
  };

  const copySystemPrompt = async () => {
    if (!latestOrder?.systemPrompt) return;

    try {
      await navigator.clipboard.writeText(latestOrder.systemPrompt);
      setCopyMessage("Инструкция скопирована");
    } catch {
      setCopyMessage("Не удалось скопировать");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-5 text-white md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          to="/workspace/business"
          className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          Назад в бизнес-кабинет
        </Link>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
          <article className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-6 md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
              <Bot className="h-4 w-4" strokeWidth={1.7} />
              Для заявок, консультаций и первого контакта
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-medium tracking-normal md:text-6xl">
              ИИ-менеджер в Telegram, который не теряет клиентов
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-gray-400 md:text-lg">
              Клиент пишет в Telegram, менеджер задает пару уточняющих вопросов, фиксирует контакт и передает готовую заявку человеку. Владелец отвечает на короткий опрос, а nomduchat собирает правила ответа и заявку на подключение.
            </p>
            {!started ? (
              <button
                type="button"
                onClick={() => {
                  setStarted(true);
                  setStepIndex(0);
                }}
                className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              >
                Создать своего ИИ-менеджера в Telegram
                <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
            ) : null}
          </article>

          <aside className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.7} />
              Что получает бизнес
            </div>
            <div className="mt-5 space-y-3">
              {[
                "Менеджер отвечает одинаково и по правилам компании.",
                "Заявка приходит с контактом, задачей и следующим шагом.",
                "Владельцу не нужно разбираться в BotFather и webhook на первом этапе.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm leading-relaxed text-gray-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.8} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {started && typeof document !== "undefined" ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
            <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#080808] p-5 shadow-2xl md:p-6">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-gray-400">
                    <Bot className="h-4 w-4" strokeWidth={1.7} />
                    Запуск Telegram-менеджера
                  </div>
                  <h2 className="mt-3 text-2xl font-medium md:text-3xl">Опрос для ИИ-менеджера</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                    Заполните короткие шаги. На каждом шаге мы спрашиваем только то, без чего менеджер не сможет нормально принять первую заявку.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStarted(false)}
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
                >
                  Закрыть
                </button>
              </div>

              <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
                <form
                  className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (currentStep.key === "payment") {
                      void submitOrder();
                    } else {
                      nextStep();
                    }
                  }}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm text-gray-500">
                        Шаг {stepIndex + 1} из {wizardSteps.length}
                      </div>
                      <h3 className="mt-2 text-2xl font-medium md:text-3xl">{currentStep.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">{currentStep.text}</p>
                    </div>
                    <div className="min-w-40 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-400">
                      Готово на {progress}%
                    </div>
                  </div>

                  <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="mt-6">{renderStepFields(currentStep.key)}</div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={previousStep}
                      disabled={stepIndex === 0 || submitting}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
                      Назад
                    </button>

                    {currentStep.key === "payment" ? (
                      <button
                        type="submit"
                        disabled={!canSubmit || submitting}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={1.8} />}
                        Подтвердить оплату и создать заявку
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!stepReady}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Дальше
                        <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </form>

                <aside className="space-y-5">
                  <section className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Sparkles className="h-4 w-4" strokeWidth={1.7} />
                      Путь запуска
                    </div>
                    <div className="mt-5 space-y-2">
                      {wizardSteps.map((step, index) => (
                        <div
                          key={step.key}
                          className={`rounded-2xl border px-4 py-3 text-sm transition-colors ${
                            index === stepIndex
                              ? "border-white/25 bg-white text-black"
                              : index < stepIndex
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                                : "border-white/10 bg-white/[0.03] text-gray-500"
                          }`}
                        >
                          {step.title}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MessageSquare className="h-4 w-4" strokeWidth={1.7} />
                      После заявки
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-gray-500">
                      Мы получим описание бизнеса, правила ответов и контакт. После этого можно подключать менеджера в Telegram и проверять первые диалоги.
                    </p>
                  </section>
                </aside>
              </section>
            </div>
          </div>,
          document.body
        ) : null}

        {!started ? (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {[
              { title: "Не отвечает вместо владельца", text: "Он собирает данные и ведет клиента до понятной заявки." },
              { title: "Работает по правилам", text: "Можно сразу указать, что обещать нельзя и когда нужен человек." },
              { title: "Запуск без сложной настройки", text: "Опрос короче, чем обычное ТЗ для подрядчика." },
            ].map((item) => (
              <article key={item.title} className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5">
                <h2 className="text-xl font-medium">{item.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{item.text}</p>
              </article>
            ))}
          </section>
        ) : null}

        {latestOrder ? (
          <section className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <UserRound className="h-4 w-4" strokeWidth={1.7} />
              Последняя заявка
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr_auto] xl:items-start">
              <div>
                <h3 className="text-xl font-medium">{latestOrder.companyName}</h3>
                <div className="mt-2 text-sm text-gray-500">
                  {formatStatus(latestOrder.status)} · {formatPlainAmount(latestOrder.amountMinor)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">
                {latestOrder.setupSummary}
              </div>
              <button
                type="button"
                onClick={() => void copySystemPrompt()}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
              >
                <Copy className="h-4 w-4" strokeWidth={1.7} />
                Скопировать prompt
              </button>
            </div>
            {copyMessage ? <div className="mt-3 text-sm text-gray-500">{copyMessage}</div> : null}
          </section>
        ) : loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 text-sm text-gray-500">
            Загружаем прошлые заявки.
          </div>
        ) : null}
      </div>
    </div>
  );

  function renderStepFields(step: WizardStep["key"]) {
    if (step === "company") {
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Контакт для запуска"
            value={form.contact}
            onChange={(value) => updateField("contact", value)}
            placeholder="@username, телефон или WhatsApp"
            required
          />
          <Field
            label="Название компании"
            value={form.companyName}
            onChange={(value) => updateField("companyName", value)}
            placeholder="Например, Nomdu Coffee"
            required
          />
          <Field
            label="Ответственный"
            value={form.ownerName ?? ""}
            onChange={(value) => updateField("ownerName", value)}
            placeholder="Имя владельца или менеджера"
          />
          <Field
            label="Username бота"
            value={form.botUsername ?? ""}
            onChange={(value) => updateField("botUsername", value)}
            placeholder="@company_bot, если уже есть"
          />
        </div>
      );
    }

    if (step === "offer") {
      return (
        <div className="space-y-4">
          <TextArea
            label="Что делает компания"
            value={form.businessDescription}
            onChange={(value) => updateField("businessDescription", value)}
            placeholder="Например: кофейня в Алматы, продаем кофе, завтраки и доставку для офисов."
            required
          />
          <TextArea
            label="Услуги, товары, цены"
            value={form.services}
            onChange={(value) => updateField("services", value)}
            placeholder="Перечислите основные услуги, цены, сроки, условия записи или доставки."
            required
          />
          <TextArea
            label="Кто будет писать"
            value={form.audience ?? ""}
            onChange={(value) => updateField("audience", value)}
            placeholder="Клиенты, партнеры, сотрудники или новые заявки из рекламы."
          />
        </div>
      );
    }

    if (step === "rules") {
      return (
        <div className="space-y-5">
          <TextArea
            label="Задача менеджера"
            value={form.botPurpose}
            onChange={(value) => updateField("botPurpose", value)}
            placeholder="Например: отвечать на вопросы, собирать заявки, записывать на консультацию."
            required
          />
          <div>
            <div className="text-sm text-gray-400">Стиль ответа</div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
              {toneOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateField("tone", option.value)}
                  className={`min-h-24 rounded-2xl border p-3 text-left transition-colors ${
                    form.tone === option.value
                      ? "border-white/30 bg-white text-black"
                      : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20"
                  }`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className={form.tone === option.value ? "mt-2 text-xs text-black/60" : "mt-2 text-xs text-gray-500"}>
                    {option.detail}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <TextArea
            label="Правила ответа"
            value={form.responseRules}
            onChange={(value) => updateField("responseRules", value)}
            placeholder="Что нельзя обещать, какие вопросы задавать, когда просить телефон, какие темы не обсуждать."
            required
          />
        </div>
      );
    }

    if (step === "handoff") {
      return (
        <div className="space-y-4">
          <TextArea
            label="Когда передавать человеку"
            value={form.escalationContact}
            onChange={(value) => updateField("escalationContact", value)}
            placeholder="Например: если клиент просит скидку, индивидуальную цену или срочную доставку, писать менеджеру @..."
            required
          />
          <TextArea
            label="Частые вопросы"
            value={form.faq ?? ""}
            onChange={(value) => updateField("faq", value)}
            placeholder="Добавьте готовые ответы, если они уже есть."
          />
          <TextArea
            label="Источники знаний"
            value={form.sourceLinks ?? ""}
            onChange={(value) => updateField("sourceLinks", value)}
            placeholder="Сайт, прайс, Instagram, Google Docs, каталог."
          />
          <Field
            label="Токен BotFather"
            value={form.botToken ?? ""}
            onChange={(value) => updateField("botToken", value)}
            placeholder="Можно добавить позже"
            type="password"
          />
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CreditCard className="h-4 w-4" strokeWidth={1.7} />
            Запуск по стране аккаунта
          </div>
          <div className="mt-4 text-5xl font-medium">{formatPlainAmount(selectedPrice.amountMinor)}</div>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Страна аккаунта: {form.country === "KZ" ? "Казахстан" : "Россия"}. Токены для ответов оплачиваются отдельно по фактическому расходу.
          </p>
          <p className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-gray-500">
            Это тестовый checkout для проверки сценария. Реальное списание нужно подключить через платежного провайдера, чтобы данные карты не хранились в nomduchat.
          </p>
        </div>
        <PaymentForm
          country={form.country}
          payment={payment}
          touched={paymentTouched}
          onChange={setPayment}
        />
      </div>
    );
  }
}

function createInitialForm(country: TelegramBotCountry): FormState {
  return {
    country,
    companyName: "",
    ownerName: "",
    contact: "",
    businessDescription: "",
    services: "",
    audience: "",
    botPurpose: "",
    tone: "friendly",
    responseRules: "",
    escalationContact: "",
    faq: "",
    sourceLinks: "",
    botUsername: "",
    botToken: "",
  };
}

function createEmptyPayment(): PaymentState {
  return {
    cardNumber: "",
    cardHolder: "",
    expiry: "",
    cvv: "",
    receiptContact: "",
  };
}

function resolveCountry(country: string | null | undefined): TelegramBotCountry {
  return country === "RU" ? "RU" : "KZ";
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "password";
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-gray-400">
        {label}
        {required ? <span className="text-red-300"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#050505] px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-gray-400">
        {label}
        {required ? <span className="text-red-300"> *</span> : null}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-[#050505] px-4 py-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
      />
    </label>
  );
}

function PaymentForm({
  country,
  payment,
  touched,
  onChange,
}: {
  country: TelegramBotCountry;
  payment: PaymentState;
  touched: boolean;
  onChange: (payment: PaymentState) => void;
}) {
  const update = (field: keyof PaymentState, value: string) => onChange({ ...payment, [field]: value });
  const receiptLabel = country === "KZ" ? "Телефон для чека" : "Email для чека";
  const ready = isPaymentReady(payment);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#050505] p-5">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <CreditCard className="h-4 w-4" strokeWidth={1.7} />
        Данные карты
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Номер карты"
          value={payment.cardNumber}
          onChange={(value) => update("cardNumber", value)}
          placeholder="0000 0000 0000 0000"
          required
        />
        <Field
          label="Имя на карте"
          value={payment.cardHolder}
          onChange={(value) => update("cardHolder", value)}
          placeholder="IVAN IVANOV"
          required
        />
        <Field
          label="Срок"
          value={payment.expiry}
          onChange={(value) => update("expiry", value)}
          placeholder="MM/YY"
          required
        />
        <Field
          label="CVV"
          value={payment.cvv}
          onChange={(value) => update("cvv", value)}
          placeholder="000"
          type="password"
          required
        />
      </div>
      <Field
        label={receiptLabel}
        value={payment.receiptContact}
        onChange={(value) => update("receiptContact", value)}
        placeholder={country === "KZ" ? "+7..." : "mail@example.com"}
        required
      />
      {touched && !ready ? (
        <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Заполните данные карты и контакт для чека.
        </div>
      ) : null}
    </div>
  );
}

function isPaymentReady(payment: PaymentState) {
  return (
    payment.cardNumber.replace(/\D/g, "").length >= 12 &&
    payment.cardHolder.trim().length >= 3 &&
    payment.expiry.trim().length >= 4 &&
    payment.cvv.replace(/\D/g, "").length >= 3 &&
    payment.receiptContact.trim().length >= 5
  );
}

function formatPlainAmount(amountMinor: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "Черновик",
    ready_for_payment: "Готово к оплате",
    paid: "Оплачено",
    in_setup: "В подключении",
    connected: "Подключено",
    cancelled: "Отменено",
  };
  return labels[status] ?? status;
}
