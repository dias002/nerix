import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  CheckCircle2,
  MessageCircle,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  addBusinessCustomerMessage,
  addBusinessTeamMessage,
  createBusinessCustomerConversation,
  getBusinessOpsOverview,
  rateBusinessCustomerConversation,
  type BusinessConversationRating,
  type BusinessCustomerChannel,
  type BusinessCustomerConversationApiRecord,
  type BusinessCustomerMessageRole,
  type BusinessOpsOverviewApiResponse,
} from "../api";

const emptyConversationForm = {
  channel: "telegram" as BusinessCustomerChannel,
  customerName: "",
  customerContact: "",
  source: "",
  transcript: "",
  trainingAllowed: false,
};

export default function BusinessDialogs() {
  const [overview, setOverview] = useState<BusinessOpsOverviewApiResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversationForm, setConversationForm] = useState(emptyConversationForm);
  const [messageText, setMessageText] = useState("");
  const [teamText, setTeamText] = useState("");
  const [teamAuthor, setTeamAuthor] = useState("Владелец");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getBusinessOpsOverview()
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setSelectedId(data.conversations[0]?.id ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setNotice("Не удалось загрузить диалоги. Проверьте, запущен ли API.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const conversations = overview?.conversations ?? [];
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0] ?? null,
    [conversations, selectedId]
  );

  const updateOverview = (nextOverview: BusinessOpsOverviewApiResponse) => {
    setOverview(nextOverview);
    setSelectedId((current) => {
      if (current && nextOverview.conversations.some((conversation) => conversation.id === current)) return current;
      return nextOverview.conversations[0]?.id ?? null;
    });
  };

  const createConversation = async () => {
    const messages = parseTranscript(conversationForm.transcript);
    if (messages.length === 0) {
      setNotice("Добавьте хотя бы один фрагмент диалога, чтобы система смогла сделать выводы.");
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const response = await createBusinessCustomerConversation({
        channel: conversationForm.channel,
        customerName: conversationForm.customerName || "Клиент",
        customerContact: conversationForm.customerContact,
        source: conversationForm.source,
        trainingAllowed: conversationForm.trainingAllowed,
        messages,
      });
      updateOverview(response.overview);
      setSelectedId(response.conversation.id);
      setConversationForm(emptyConversationForm);
    } catch {
      setNotice("Диалог не сохранился. Проверьте обязательные поля и попробуйте еще раз.");
    } finally {
      setSaving(false);
    }
  };

  const addMessage = async () => {
    if (!selectedConversation || !messageText.trim()) return;

    setSaving(true);
    setNotice(null);
    try {
      const response = await addBusinessCustomerMessage(selectedConversation.id, {
        role: "customer",
        content: messageText,
      });
      updateOverview(response.overview);
      setSelectedId(response.conversation.id);
      setMessageText("");
    } catch {
      setNotice("Новое сообщение не добавилось. Попробуйте еще раз.");
    } finally {
      setSaving(false);
    }
  };

  const rateConversation = async (rating: BusinessConversationRating) => {
    if (!selectedConversation) return;

    setSaving(true);
    setNotice(null);
    try {
      const response = await rateBusinessCustomerConversation(selectedConversation.id, rating);
      updateOverview(response.overview);
      setSelectedId(response.conversation.id);
    } catch {
      setNotice("Оценка не сохранилась. Попробуйте еще раз.");
    } finally {
      setSaving(false);
    }
  };

  const sendTeamMessage = async () => {
    if (!teamText.trim()) return;

    setSaving(true);
    setNotice(null);
    try {
      const response = await addBusinessTeamMessage({
        authorName: teamAuthor || "Владелец",
        roleTitle: "Команда",
        text: teamText,
      });
      updateOverview(response.overview);
      setTeamText("");
    } catch {
      setNotice("Сообщение в командный чат не отправилось.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-5 text-white md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <Link
              to="/workspace/business"
              className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              Назад в B2B
            </Link>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
              <MessageSquareText className="h-4 w-4" strokeWidth={1.7} />
              Разговоры, команда, качество продаж
            </div>
            <h1 className="mt-4 text-3xl font-medium md:text-5xl">Диалоги клиентов под контролем</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-400">
              Клиент пишет боту или на сайт, а владелец видит весь разговор: что человек хотел, где сомневался, когда звать менеджера и насколько хорошо бот довел заявку.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 text-sm text-gray-400 xl:w-80">
            <div className="flex items-center gap-2 text-gray-300">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.7} />
              Данные для обучения
            </div>
            <p className="mt-2 leading-relaxed text-gray-500">
              Диалоги можно помечать для обезличенного обучения позже. В MVP мы только храним согласие и сигналы качества.
            </p>
          </div>
        </header>

        {notice ? (
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-3 text-sm text-gray-400">
            {notice}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {(overview?.metrics ?? defaultMetrics()).map((metric, index) => (
            <Metric
              key={metric.label}
              icon={metricIcon(index)}
              label={metric.label}
              value={loading ? "..." : metric.value}
              detail={metric.detail}
            />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.45fr]">
          <div className="space-y-5">
            <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]">
              <div className="border-b border-white/10 p-5">
                <h2 className="text-2xl font-medium">Клиентские диалоги</h2>
                <p className="mt-2 text-sm text-gray-500">
                  Здесь собираются разговоры из Telegram, сайта и ручного импорта.
                </p>
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                {conversations.length > 0 ? (
                  conversations.map((conversation) => (
                    <ConversationListItem
                      key={conversation.id}
                      conversation={conversation}
                      active={selectedConversation?.id === conversation.id}
                      onSelect={() => setSelectedId(conversation.id)}
                    />
                  ))
                ) : (
                  <div className="p-5 text-sm leading-relaxed text-gray-500">
                    Пока нет разговоров. Вставьте первый диалог ниже, и система сразу покажет разбор.
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Sparkles className="h-4 w-4" strokeWidth={1.7} />
                Быстро добавить разговор
              </div>
              <h2 className="mt-2 text-2xl font-medium">Вставьте переписку</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Для демо достаточно текста. Если строки начинаются с «клиент:» или «бот:», роли определятся автоматически.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <input
                  value={conversationForm.customerName}
                  onChange={(event) => setConversationForm((form) => ({ ...form, customerName: event.target.value }))}
                  placeholder="Имя или компания клиента"
                  className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                />
                <input
                  value={conversationForm.customerContact}
                  onChange={(event) => setConversationForm((form) => ({ ...form, customerContact: event.target.value }))}
                  placeholder="@username, телефон или WhatsApp"
                  className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                />
                <select
                  value={conversationForm.channel}
                  onChange={(event) =>
                    setConversationForm((form) => ({
                      ...form,
                      channel: event.target.value as BusinessCustomerChannel,
                    }))
                  }
                  className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none transition-colors focus:border-white/25"
                >
                  <option value="telegram">Telegram</option>
                  <option value="website">Сайт</option>
                  <option value="manual">Ручной импорт</option>
                </select>
                <input
                  value={conversationForm.source}
                  onChange={(event) => setConversationForm((form) => ({ ...form, source: event.target.value }))}
                  placeholder="Источник: бот, форма, реклама"
                  className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                />
              </div>
              <textarea
                value={conversationForm.transcript}
                onChange={(event) => setConversationForm((form) => ({ ...form, transcript: event.target.value }))}
                placeholder={"клиент: Нужен бот, который отвечает по цене\nбот: Уточните город и контакт\nклиент: Дорого, но если быстро, готов обсудить"}
                className="mt-3 min-h-40 w-full resize-y rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
              />
              <label className="mt-3 flex items-start gap-3 text-sm text-gray-500">
                <input
                  type="checkbox"
                  checked={conversationForm.trainingAllowed}
                  onChange={(event) =>
                    setConversationForm((form) => ({ ...form, trainingAllowed: event.target.checked }))
                  }
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-black"
                />
                Можно использовать этот разговор в будущем датасете только после обезличивания.
              </label>
              <button
                type="button"
                onClick={createConversation}
                disabled={saving}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-500"
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                Разобрать диалог
              </button>
            </article>
          </div>

          <div className="space-y-5">
            <ConversationDetails
              conversation={selectedConversation}
              messageText={messageText}
              saving={saving}
              onMessageTextChange={setMessageText}
              onAddMessage={addMessage}
              onRate={rateConversation}
            />

            <article className="rounded-2xl border border-white/10 bg-[#0A0A0A]">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="h-4 w-4" strokeWidth={1.7} />
                  Общий чат команды
                </div>
                <h2 className="mt-2 text-2xl font-medium">Сотрудники видят задачу в одном месте</h2>
                <p className="mt-2 text-sm text-gray-500">
                  Владелец может оставить поручение, а менеджеры забирают диалог без пересылок между сервисами.
                </p>
              </div>
              <div className="max-h-72 space-y-3 overflow-y-auto p-5">
                {(overview?.teamMessages ?? []).length > 0 ? (
                  overview?.teamMessages.map((message) => (
                    <div key={message.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-white">{message.authorName}</span>
                        <span className="text-gray-600">{message.roleTitle}</span>
                        <span className="text-gray-700">{formatDate(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-gray-300">{message.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-500">
                    Командный чат пуст. Оставьте первое поручение по заявке.
                  </div>
                )}
              </div>
              <div className="grid gap-3 border-t border-white/10 p-5 md:grid-cols-[0.45fr_1fr_auto]">
                <input
                  value={teamAuthor}
                  onChange={(event) => setTeamAuthor(event.target.value)}
                  placeholder="Кто пишет"
                  className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                />
                <input
                  value={teamText}
                  onChange={(event) => setTeamText(event.target.value)}
                  placeholder="Например: заберите заявку, клиент просит расчет"
                  className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                />
                <button
                  type="button"
                  onClick={sendTeamMessage}
                  disabled={saving || !teamText.trim()}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-500"
                >
                  <Send className="h-4 w-4" strokeWidth={1.8} />
                  Отправить
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

function ConversationListItem({
  conversation,
  active,
  onSelect,
}: {
  conversation: BusinessCustomerConversationApiRecord;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full border-b border-white/10 p-5 text-left transition-colors ${
        active ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-white">{conversation.customerName || "Клиент"}</div>
          <div className="mt-1 text-sm text-gray-500">
            {channelLabel(conversation.channel)} · {statusLabel(conversation.status)}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs ${ratingClass(conversation.aiRating)}`}>
          {conversation.analysis.score}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-400">{conversation.analysis.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {conversation.analysis.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-500">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

function ConversationDetails({
  conversation,
  messageText,
  saving,
  onMessageTextChange,
  onAddMessage,
  onRate,
}: {
  conversation: BusinessCustomerConversationApiRecord | null;
  messageText: string;
  saving: boolean;
  onMessageTextChange: (value: string) => void;
  onAddMessage: () => void;
  onRate: (rating: BusinessConversationRating) => void;
}) {
  if (!conversation) {
    return (
      <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-8 text-center">
        <MessageCircle className="mx-auto h-10 w-10 text-gray-700" strokeWidth={1.6} />
        <h2 className="mt-4 text-2xl font-medium">Выберите или добавьте диалог</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
          После первого разговора здесь появятся сообщения, оценка и понятная выжимка для владельца.
        </p>
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]">
      <div className="grid gap-4 border-b border-white/10 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <MessageCircle className="h-4 w-4" strokeWidth={1.7} />
            {channelLabel(conversation.channel)}
            {conversation.source ? <span>· {conversation.source}</span> : null}
            <span>· {formatDate(conversation.updatedAt)}</span>
          </div>
          <h2 className="mt-2 text-2xl font-medium">{conversation.customerName || "Клиент"}</h2>
          <p className="mt-2 text-sm text-gray-500">{conversation.customerContact || "Контакт еще не указан"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["bad", "good", "excellent"] as const).map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onRate(rating)}
              disabled={saving}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                conversation.ownerRating === rating
                  ? "border-white/40 bg-white text-black"
                  : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
              }`}
            >
              {ratingLabel(rating)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[1fr_0.85fr]">
        <section className="space-y-3">
          {conversation.messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-2xl border p-4 ${
                message.role === "customer"
                  ? "border-white/10 bg-white/[0.04]"
                  : "border-white/10 bg-black"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-white">{message.authorName}</span>
                <span className="text-gray-600">{roleLabel(message.role)}</span>
                <span className="text-gray-700">{formatDate(message.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-300">{message.content}</p>
            </div>
          ))}
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={messageText}
              onChange={(event) => onMessageTextChange(event.target.value)}
              placeholder="Добавить новое сообщение клиента"
              className="h-12 rounded-2xl border border-white/10 bg-black px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
            />
            <button
              type="button"
              onClick={onAddMessage}
              disabled={saving || !messageText.trim()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-500"
            >
              <Send className="h-4 w-4" strokeWidth={1.8} />
              Добавить
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-gray-500">Оценка системы</div>
              <span className={`rounded-full px-3 py-1 text-sm ${ratingClass(conversation.aiRating)}`}>
                {conversation.analysis.score}/100
              </span>
            </div>
            <h3 className="mt-3 text-xl font-medium">{conversation.analysis.goal}</h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">{conversation.analysis.summary}</p>
          </div>

          <AnalysisBlock title="Что хотел клиент" items={conversation.analysis.desiredProducts} empty="Интерес пока не выделен." />
          <AnalysisBlock title="Возражения" items={conversation.analysis.objections} empty="Явных возражений нет." />

          <div className="rounded-2xl border border-white/10 bg-black p-5">
            <div className="text-sm text-gray-500">Следующий шаг</div>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">{conversation.analysis.nextStep}</p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-gray-500">
              {conversation.trainingAllowed
                ? "Разговор помечен как разрешенный для будущего обезличенного датасета."
                : "Для обучения не используем, пока владелец не включит согласие."}
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}

function AnalysisBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black p-5">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <span key={item} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-gray-300">
              {item}
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-600">{empty}</span>
        )}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <div className="text-3xl font-medium">{value}</div>
      <div className="mt-2 text-sm font-medium text-gray-300">{label}</div>
      <div className="mt-1 text-sm text-gray-500">{detail}</div>
    </article>
  );
}

function parseTranscript(transcript: string) {
  const lines = transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  return lines.slice(0, 40).map((line) => {
    const parsed = line.match(/^(клиент|customer|бот|bot|менеджер|employee|сотрудник|system|система)\s*:\s*(.+)$/i);
    if (!parsed) {
      return {
        role: "customer" as BusinessCustomerMessageRole,
        content: line,
      };
    }

    return {
      role: parseRole(parsed[1] ?? ""),
      content: parsed[2] ?? line,
    };
  });
}

function parseRole(value: string): BusinessCustomerMessageRole {
  const normalized = value.toLowerCase();
  if (normalized === "бот" || normalized === "bot") return "bot";
  if (normalized === "менеджер" || normalized === "employee" || normalized === "сотрудник") return "employee";
  if (normalized === "system" || normalized === "система") return "system";
  return "customer";
}

function defaultMetrics() {
  return [
    { label: "Диалоги", value: "0", detail: "с сайта, Telegram и ручного импорта" },
    { label: "Горячие", value: "0", detail: "можно передавать менеджеру" },
    { label: "Средний балл", value: "0", detail: "качество по анализу диалогов" },
    { label: "Возражения", value: "0", detail: "зафиксировано системой" },
    { label: "Отличные", value: "0", detail: "оценены владельцем" },
  ];
}

function metricIcon(index: number): LucideIcon {
  return [MessageCircle, Bot, BarChart3, Sparkles, Star][index] ?? BarChart3;
}

function channelLabel(channel: BusinessCustomerChannel) {
  if (channel === "telegram") return "Telegram";
  if (channel === "website") return "Сайт";
  return "Импорт";
}

function statusLabel(status: string) {
  if (status === "qualified") return "перспективный";
  if (status === "waiting_human") return "нужен менеджер";
  if (status === "won") return "готов к оплате";
  if (status === "lost") return "похож на отказ";
  return "новый";
}

function ratingLabel(rating: BusinessConversationRating) {
  if (rating === "bad") return "Плохой";
  if (rating === "excellent") return "Отличный";
  return "Хороший";
}

function roleLabel(role: BusinessCustomerMessageRole) {
  if (role === "customer") return "клиент";
  if (role === "bot") return "бот";
  if (role === "employee") return "сотрудник";
  return "система";
}

function ratingClass(rating: BusinessConversationRating) {
  if (rating === "excellent") return "bg-emerald-400/15 text-emerald-300";
  if (rating === "bad") return "bg-red-400/15 text-red-300";
  return "bg-amber-400/15 text-amber-200";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
