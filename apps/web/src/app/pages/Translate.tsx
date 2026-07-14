import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Check, Copy, Languages, Send } from "lucide-react";
import StarsBackground from "../components/StarsBackground";
import LanguageSwitch from "../components/LanguageSwitch";
import { setPageSeo } from "../seo";

type TargetLanguage = "ru" | "en" | "kk";
type TranslationMode = "basic" | "ai";

const targetLanguages: Array<{ id: TargetLanguage; label: string }> = [
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
  { id: "kk", label: "Қазақша" },
];

export default function Translate() {
  const navigate = useNavigate();
  const [text, setText] = useState("Привет! Подготовь короткое описание проекта.");
  const [target, setTarget] = useState<TargetLanguage>("en");
  const [mode, setMode] = useState<TranslationMode>("basic");
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => buildTranslationResult(text, target, mode), [mode, target, text]);

  useEffect(() => {
    setPageSeo(
      "Переводчик nomduchat",
      "Базовый переводчик и AI-перевод через чат nomduchat.",
      "/translate",
    );
  }, []);

  const openChat = () => {
    navigate(`/workspace/chat?prompt=${encodeURIComponent(buildAiTranslationPrompt(text, target))}`);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <StarsBackground />
      <header className="fixed left-6 right-6 top-6 z-20 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-medium text-white transition-colors hover:text-gray-300">
          nomduchat
        </Link>
        <LanguageSwitch />
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-28 md:py-32">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          На главную
        </Link>

        <section className="mt-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            <Languages className="h-4 w-4" strokeWidth={1.7} />
            Переводчик
          </div>
          <h1 className="mt-5 text-4xl font-semibold md:text-6xl">Базовый и AI-перевод</h1>
          <p className="mt-5 text-base leading-relaxed text-gray-400 md:text-lg">
            Быстрый черновик можно получить локально, точный перевод отправляется в чат с сохранением смысла, структуры и тона.
          </p>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-[#080808]/86 p-5 backdrop-blur-md">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-56 w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
              placeholder="Введите текст для перевода"
            />
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">Язык</span>
                <select
                  value={target}
                  onChange={(event) => setTarget(event.target.value as TargetLanguage)}
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
                  value={mode}
                  onChange={(event) => setMode(event.target.value as TranslationMode)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/25"
                >
                  <option className="bg-black text-white" value="basic">Базовый</option>
                  <option className="bg-black text-white" value="ai">AI-перевод</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#080808]/86 p-5 backdrop-blur-md">
            <h2 className="text-lg font-medium text-white">Результат</h2>
            <pre className="mt-4 min-h-56 whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black p-4 font-sans text-sm leading-relaxed text-gray-300">
              {result}
            </pre>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={openChat}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              >
                <Send className="h-4 w-4" strokeWidth={1.8} />
                Открыть в чате
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard?.writeText(result);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1400);
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 px-4 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
              >
                {copied ? <Check className="h-4 w-4" strokeWidth={1.8} /> : <Copy className="h-4 w-4" strokeWidth={1.8} />}
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>
          </div>
        </section>
      </main>
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
