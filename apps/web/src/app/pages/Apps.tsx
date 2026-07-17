import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Bot, Check, Copy, FileText, ImageIcon, Languages, Palette, Send, Sparkles, UserRound, Video } from "lucide-react";

type TargetLanguage = "ru" | "en" | "kk";
type TranslationMode = "basic" | "ai";

const targetLanguages: Array<{ id: TargetLanguage; label: string }> = [
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
  { id: "kk", label: "Қазақша" },
];

const outputFormats = ["план", "пост", "письмо", "таблица", "инструкция", "промпт для изображения"];
const appCatalog = [
  {
    title: "AI-перевод",
    text: "Перевод текста с сохранением смысла, тона и структуры.",
    status: "Готово",
    icon: Languages,
    prompt: "Переведи текст на английский. Сохрани смысл, структуру и тон. После перевода укажи спорные места.",
  },
  {
    title: "Генератор промптов",
    text: "Собирает четкий запрос для текста, изображения, видео или бизнес-задачи.",
    status: "Готово",
    icon: Sparkles,
    prompt: "Помоги составить сильный промпт. Сначала задай 3 уточняющих вопроса, затем дай готовую версию.",
  },
  {
    title: "Humanizer",
    text: "Убирает сухие AI-формулировки и делает текст естественнее.",
    status: "Страница",
    icon: FileText,
    href: "/tools/humanizer",
  },
  {
    title: "SEO-статья",
    text: "Структура, заголовки, читаемый текст и мета-описание.",
    status: "Через чат",
    icon: Bot,
    prompt: "Подготовь SEO-статью: заголовок, план H2/H3, интро, основной текст, FAQ и meta description.",
  },
  {
    title: "Интерьер",
    text: "Промпт для дизайна комнаты, света, мебели и материалов.",
    status: "Страница",
    icon: Palette,
    href: "/tools/dizajn-interyera",
  },
  {
    title: "Изображения",
    text: "Карточки, обложки, визуальные концепции и промпты для Flux.",
    status: "Страница",
    icon: ImageIcon,
    href: "/ai/flux-2",
  },
  {
    title: "Видео",
    text: "Сценарий ролика, раскадровка, сцены и промпт для генерации.",
    status: "Через чат",
    icon: Video,
    prompt: "Сделай сценарий короткого видео: хук, сцены, визуальный стиль, текст ведущего и CTA.",
  },
  {
    title: "Аватар",
    text: "Будущий продукт для персонального ведущего и avatar-video.",
    status: "В разработке",
    icon: UserRound,
    href: "/workspace/avatar",
  },
];

export default function Apps() {
  const navigate = useNavigate();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [translationText, setTranslationText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>("en");
  const [translationMode, setTranslationMode] = useState<TranslationMode>("basic");
  const [promptGoal, setPromptGoal] = useState("Сделать продающее описание сервиса nomduchat");
  const [promptAudience, setPromptAudience] = useState("пользователи, которые впервые выбирают AI-сервис");
  const [promptFormat, setPromptFormat] = useState("план");
  const [promptTone, setPromptTone] = useState("понятно, спокойно, без сложных терминов");

  const translationResult = useMemo(
    () => buildTranslationResult(translationText, targetLanguage, translationMode),
    [translationText, targetLanguage, translationMode],
  );

  const generatedPrompt = useMemo(
    () =>
      [
        `Задача: ${promptGoal.trim() || "опиши задачу"}.`,
        `Аудитория: ${promptAudience.trim() || "обычные пользователи"}.`,
        `Формат результата: ${promptFormat}.`,
        `Стиль: ${promptTone.trim() || "понятно и структурно"}.`,
        "",
        "Сначала дай готовый результат, затем коротко предложи 2-3 улучшения.",
      ].join("\n"),
    [promptAudience, promptFormat, promptGoal, promptTone],
  );

  const copy = async (key: string, value: string) => {
    await navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1400);
  };

  const openChat = (prompt: string) => {
    navigate(`/workspace/chat?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-6 md:p-12">
      <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[18rem_1fr]">
        <aside className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-600">Tools</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Приложения</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              Быстрые рабочие инструменты поверх чата: перевод, промпты, текст, изображения и видео.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0D0D0D] p-3">
            <div className="space-y-1">
              {appCatalog.slice(0, 5).map((app) => {
                const Icon = app.icon;
                const href = app.href ?? `/workspace/chat?prompt=${encodeURIComponent(app.prompt ?? "")}`;

                return (
                  <Link
                    key={app.title}
                    to={href}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-gray-500 transition-colors group-hover:text-white" strokeWidth={1.7} />
                    <span className="min-w-0 flex-1 truncate">{app.title}</span>
                    <span className="text-[11px] text-gray-600">{app.status}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="space-y-5">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {appCatalog.map((app) => {
              const Icon = app.icon;
              const href = app.href ?? `/workspace/chat?prompt=${encodeURIComponent(app.prompt ?? "")}`;

              return (
                <Link
                  key={app.title}
                  to={href}
                  className="group grid min-h-36 grid-cols-[auto_1fr] gap-4 rounded-xl border border-white/10 bg-[#0D0D0D] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black text-gray-200">
                    <Icon className="h-5 w-5" strokeWidth={1.7} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="truncate text-base font-semibold text-white">{app.title}</div>
                      <span className="shrink-0 rounded-full border border-white/10 bg-black px-2 py-0.5 text-[11px] text-gray-500">
                        {app.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">{app.text}</p>
                    <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors group-hover:text-white">
                      Открыть
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
            <div className="flex items-center gap-3">
              <Languages className="h-5 w-5 text-gray-300" strokeWidth={1.7} />
              <div>
                <h3 className="text-lg font-medium text-white">Переводчик</h3>
                <p className="mt-1 text-sm text-gray-500">Базовый черновик локально или точный AI-перевод через чат.</p>
              </div>
            </div>

            <textarea
              value={translationText}
              onChange={(event) => setTranslationText(event.target.value)}
              className="mt-5 min-h-36 w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
              placeholder="Введите текст для перевода"
            />

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">Язык</span>
                <select
                  value={targetLanguage}
                  onChange={(event) => setTargetLanguage(event.target.value as TargetLanguage)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                >
                  {targetLanguages.map((language) => (
                    <option key={language.id} className="bg-black text-white" value={language.id}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">Режим</span>
                <select
                  value={translationMode}
                  onChange={(event) => setTranslationMode(event.target.value as TranslationMode)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                >
                  <option className="bg-black text-white" value="basic">Базовый</option>
                  <option className="bg-black text-white" value="ai">AI-перевод</option>
                </select>
              </label>
            </div>

            <ResultBox value={translationResult} />
            <ToolActions
              copied={copiedKey === "translation"}
              onCopy={() => copy("translation", translationResult)}
              onOpenChat={() => openChat(buildAiTranslationPrompt(translationText, targetLanguage))}
            />
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-gray-300" strokeWidth={1.7} />
              <div>
                <h3 className="text-lg font-medium text-white">Генератор промптов</h3>
                <p className="mt-1 text-sm text-gray-500">Собирает понятный запрос для чата, видео, текстов и рабочих задач.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <InputField label="Цель" value={promptGoal} onChange={setPromptGoal} />
              <InputField label="Аудитория" value={promptAudience} onChange={setPromptAudience} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs text-gray-500">Формат</span>
                  <select
                    value={promptFormat}
                    onChange={(event) => setPromptFormat(event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                  >
                    {outputFormats.map((format) => (
                      <option key={format} className="bg-black text-white" value={format}>
                        {format}
                      </option>
                    ))}
                  </select>
                </label>
                <InputField label="Стиль" value={promptTone} onChange={setPromptTone} />
              </div>
            </div>

            <ResultBox value={generatedPrompt} />
            <ToolActions
              copied={copiedKey === "prompt"}
              onCopy={() => copy("prompt", generatedPrompt)}
              onOpenChat={() => openChat(generatedPrompt)}
            />
          </article>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0D0D0D] p-5">
          <h3 className="text-lg font-medium text-white">Готовые сценарии</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              "Сделай FAQ по продукту",
              "Подготовь структуру SEO-статьи",
              "Сгенерируй промпт для аватар-видео",
              "Очеловечь текст и убери AI-формулировки",
              "Подготовь промпт для интерьерного изображения",
              "Собери промпт для Flux 2",
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => openChat(prompt)}
                className="rounded-xl border border-white/10 bg-black p-4 text-left text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
              >
                {prompt}
              </button>
            ))}
          </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-gray-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
      />
    </label>
  );
}

function ResultBox({ value }: { value: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black p-4">
      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-300">{value}</pre>
    </div>
  );
}

function ToolActions({
  copied,
  onCopy,
  onOpenChat,
}: {
  copied: boolean;
  onCopy: () => void;
  onOpenChat: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onClick={onOpenChat}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
      >
        <Send className="h-4 w-4" strokeWidth={1.8} />
        Открыть в чате
      </button>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 px-4 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
      >
        {copied ? <Check className="h-4 w-4" strokeWidth={1.8} /> : <Copy className="h-4 w-4" strokeWidth={1.8} />}
        {copied ? "Скопировано" : "Копировать"}
      </button>
    </div>
  );
}

function buildTranslationResult(text: string, target: TargetLanguage, mode: TranslationMode) {
  const source = text.trim();
  if (!source) return "Введите текст, чтобы увидеть результат.";
  if (mode === "ai") return buildAiTranslationPrompt(source, target);

  const normalized = source.toLowerCase();
  const dictionary: Record<TargetLanguage, Record<string, string>> = {
    ru: {
      hello: "Привет",
      "thank you": "Спасибо",
      "open chat": "Открыть чат",
      "create account": "Создать аккаунт",
    },
    en: {
      "привет": "Hello",
      "спасибо": "Thank you",
      "открыть чат": "Open chat",
      "создать аккаунт": "Create account",
    },
    kk: {
      "привет": "Сәлем",
      "спасибо": "Рақмет",
      "открыть чат": "Чатты ашу",
      "создать аккаунт": "Аккаунт жасау",
    },
  };
  const exact = dictionary[target][normalized];
  if (exact) return exact;

  return [
    `Черновик перевода на ${targetLanguages.find((language) => language.id === target)?.label}:`,
    source,
    "",
    "Для точного перевода откройте запрос в чате в режиме AI-перевода.",
  ].join("\n");
}

function buildAiTranslationPrompt(text: string, target: TargetLanguage) {
  const language = targetLanguages.find((item) => item.id === target)?.label ?? "выбранный язык";
  return [
    `Переведи текст на ${language}.`,
    "Сохрани смысл, структуру и тон. Если есть неоднозначные места, после перевода кратко укажи их.",
    "",
    text.trim() || "Вставьте текст для перевода.",
  ].join("\n");
}
