import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Bot, Brain, Code2, FileText, Image, MessageSquare, Mic2, Music2, Presentation, Sparkles, Video } from "lucide-react";
import { getAiProviders, type AiProviderApiRecord } from "../api";
import { useLanguage } from "../i18n";

const modelGroups = [
  {
    title: "Текст и рассуждение",
    detail: "Ответы, идеи, объяснения, планы, письма и рабочие тексты.",
    icon: MessageSquare,
    tags: ["OpenAI", "Anthropic", "Gemini"],
  },
  {
    title: "Код",
    detail: "Архитектура, отладка, рефакторинг, генерация и ревью кода.",
    icon: Code2,
    tags: ["OpenAI", "Anthropic", "Gemini"],
  },
  {
    title: "Документы и файлы",
    detail: "Разбор, выжимки, сравнение, извлечение фактов и подготовка черновиков.",
    icon: FileText,
    tags: ["OpenAI", "Anthropic", "Gemini"],
  },
  {
    title: "Презентации",
    detail: "Структура слайдов, pitch deck, тезисы, заметки спикера и визуальные идеи.",
    icon: Presentation,
    tags: ["OpenAI", "Anthropic", "Gemini"],
  },
  {
    title: "Изображения",
    detail: "Генерация визуалов, обложек, аватаров, концептов и промптов.",
    icon: Image,
    tags: ["OpenAI", "Gemini"],
  },
  {
    title: "Видео",
    detail: "Сцены, короткие ролики, storyboard и видео-генерация через backend-модели.",
    icon: Video,
    tags: ["Gemini / Veo"],
  },
  {
    title: "Музыка и аудио",
    detail: "Музыкальные идеи, тексты песен, джинглы, Suno-ready промпты и аудио-сценарии.",
    icon: Music2,
    tags: ["Gemini", "Suno-ready", "специализированные режимы"],
  },
  {
    title: "Голос",
    detail: "Озвучка, речь, дубляж и голосовые промпты.",
    icon: Mic2,
    tags: ["OpenAI", "voice pipeline"],
  },
  {
    title: "Бизнес-агенты",
    detail: "Продажи, поддержка, маркетинг, CRM-контекст и бизнес-процессы.",
    icon: Bot,
    tags: ["Business", "Support", "Marketing"],
  },
];

const modalityLabels: Record<string, string> = {
  text: "текст",
  code: "код",
  image: "изображения",
  video: "видео",
  music: "музыка",
  voice: "голос",
  file: "файлы",
};

const providerModelCatalog = [
  {
    provider: "OpenAI",
    accent: "border-sky-300/15 bg-sky-300/[0.04]",
    models: [
      { name: "gpt-4.1", type: "текст, код, документы" },
      { name: "gpt-4.1-mini", type: "быстрые рабочие задачи" },
      { name: "gpt-4.1-nano", type: "массовые короткие ответы" },
      { name: "gpt-4o", type: "мультимодальный чат" },
      { name: "gpt-4o-mini", type: "экономичный мультимодальный чат" },
      { name: "o3", type: "рассуждение и анализ" },
      { name: "o3-mini", type: "быстрые reasoning-задачи" },
      { name: "o4-mini", type: "код, логика, анализ" },
      { name: "gpt-image-1", type: "изображения" },
      { name: "dall-e-3", type: "изображения" },
      { name: "tts-1", type: "озвучка" },
      { name: "tts-1-hd", type: "качественная озвучка" },
      { name: "whisper-1", type: "распознавание речи" },
      { name: "text-embedding-3-large", type: "поиск и память" },
    ],
  },
  {
    provider: "Anthropic",
    accent: "border-orange-300/15 bg-orange-300/[0.04]",
    models: [
      { name: "claude-opus-4-20250514", type: "сложное рассуждение" },
      { name: "claude-sonnet-4-20250514", type: "код и рабочие задачи" },
      { name: "claude-3-7-sonnet-20250219", type: "анализ, код, документы" },
      { name: "claude-3-5-sonnet-20241022", type: "баланс качества и скорости" },
      { name: "claude-3-5-haiku-20241022", type: "быстрые ответы" },
      { name: "claude-3-opus-20240229", type: "сложные тексты" },
      { name: "claude-3-sonnet-20240229", type: "универсальные задачи" },
      { name: "claude-3-haiku-20240307", type: "короткие быстрые задачи" },
    ],
  },
  {
    provider: "Google Gemini",
    accent: "border-emerald-300/15 bg-emerald-300/[0.04]",
    models: [
      { name: "gemini-2.5-pro", type: "сложные задачи" },
      { name: "gemini-2.5-flash", type: "быстрый multimodal" },
      { name: "gemini-2.5-flash-lite", type: "экономичные ответы" },
      { name: "gemini-2.0-flash", type: "текст, код, агенты" },
      { name: "gemini-2.0-flash-lite", type: "массовые быстрые задачи" },
      { name: "gemini-1.5-pro", type: "длинный контекст" },
      { name: "gemini-1.5-flash", type: "быстрый длинный контекст" },
      { name: "gemini-1.5-flash-8b", type: "дешевые короткие задачи" },
      { name: "imagen-4.0-generate-preview-06-06", type: "изображения" },
      { name: "imagen-4.0-ultra-generate-preview-06-06", type: "качественные изображения" },
      { name: "imagen-3.0-generate-002", type: "изображения" },
      { name: "veo-2.0-generate-001", type: "видео" },
      { name: "veo-3.0-generate-preview", type: "видео" },
      { name: "chirp-3-hd", type: "голос и речь" },
      { name: "lyria-realtime-exp", type: "музыка в реальном времени" },
      { name: "text-embedding-004", type: "поиск и память" },
      { name: "aqa", type: "вопросы по источникам" },
      { name: "gemini-embedding-exp", type: "семантический поиск" },
    ],
  },
];

const providerModelCatalogTotal = providerModelCatalog.reduce((total, group) => total + group.models.length, 0);

export default function Models() {
  const { t } = useLanguage();
  const [providers, setProviders] = useState<AiProviderApiRecord[] | null>(null);

  useEffect(() => {
    let active = true;
    getAiProviders()
      .then((response) => {
        if (active) setProviders(response.providers);
      })
      .catch(() => {
        if (active) setProviders([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeProviders = useMemo(() => (providers ?? []).filter((provider) => provider.enabled), [providers]);

  return (
    <div className="min-h-dvh bg-black px-5 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
            На главную
          </Link>
          <div className="text-lg font-medium">{t.product}</div>
        </header>

        <main className="py-12 md:py-16">
          <section className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-gray-300">
              <Sparkles className="h-4 w-4" strokeWidth={1.7} />
              {providerModelCatalogTotal} ИИ-моделей внутри системы
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Какие модели есть в nomduchat
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-gray-400">
              nomduchat использует модели OpenAI, Anthropic и Google Gemini. Система сама выбирает backend-провайдера,
              агента и формат ответа: текст, код, документы, изображения, видео, музыку, голос или бизнес-сценарий.
            </p>
          </section>

          <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {modelGroups.map((group) => {
              const Icon = group.icon;
              return (
                <article key={group.title} className="rounded-2xl border border-white/10 bg-[#080808] p-4">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                      <Icon className="h-5 w-5" strokeWidth={1.6} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-medium text-white">{group.title}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-gray-500">{group.detail}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {group.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 bg-black px-2.5 py-1 text-xs text-gray-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </section>

          <section className="mt-12">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-medium text-white">40 моделей, которые используются</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                  Список показывает конкретные модели и режимы, которые лежат в основе маршрутизации nomduchat.
                  API-ключи и внутренняя конфигурация остаются скрытыми.
                </p>
              </div>
              <div className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-gray-300">
                Всего: {providerModelCatalogTotal}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {providerModelCatalog.map((group) => (
                <article key={group.provider} className={`rounded-2xl border p-4 ${group.accent}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-medium text-white">{group.provider}</h3>
                    <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-xs text-gray-300">
                      {group.models.length} моделей
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {group.models.map((model, index) => (
                      <div key={model.name} className="rounded-xl border border-white/10 bg-black/45 p-3">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs text-gray-500">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white">{model.name}</div>
                            <div className="mt-1 text-xs leading-relaxed text-gray-500">{model.type}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-12 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-white/10 bg-[#080808] p-5">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-white" strokeWidth={1.7} />
                <h2 className="text-xl font-medium">Активные провайдеры сейчас</h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Список подтягивается из production API. Если ключ провайдера выключен на backend, он не будет участвовать в маршрутизации.
              </p>

              <div className="mt-5 space-y-3">
                {providers === null ? (
                  <div className="rounded-xl border border-white/10 bg-black p-4 text-sm text-gray-500">Загружаю провайдеров...</div>
                ) : activeProviders.length > 0 ? (
                  activeProviders.map((provider) => (
                    <div key={provider.code} className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-medium text-white">{provider.name}</h3>
                          <p className="mt-1 text-xs text-emerald-100/60">Включен в production</p>
                        </div>
                        <span className="rounded-full bg-emerald-300 px-2.5 py-1 text-xs font-semibold text-black">active</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {provider.modalities.map((modality) => (
                          <span key={modality} className="rounded-full border border-white/10 bg-black px-2.5 py-1 text-xs text-gray-300">
                            {modalityLabels[modality] ?? modality}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black p-4 text-sm text-gray-500">
                    Провайдеры временно не отобразились. Основной чат проверяет доступность на backend при каждом запросе.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#080808] p-5">
              <h2 className="text-xl font-medium">Почему 40 моделей</h2>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-500">
                <p>
                  В интерфейсе пользователь видит не длинный список сырых моделей, а готовые режимы: чат, код, бизнес,
                  учеба, документы, изображения, видео, музыка, голос, маркетинг и поддержка.
                </p>
                <p>
                  Внутри каждый режим использует основной provider, fallback provider, специализированную модель
                  по модальности и отдельные настройки качества. Поэтому пользователю не нужно вручную выбирать между
                  десятками backend-вариантов.
                </p>
                <p>
                  Реальные ключи не показываются публично. Это защищает backend-конфигурацию, но список моделей,
                  активных провайдеров и типов задач открыт на этой странице.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/workspace/chat"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
                >
                  Попробовать чат
                </Link>
                <Link
                  to="/workspace/agents"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  Посмотреть агентов
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
