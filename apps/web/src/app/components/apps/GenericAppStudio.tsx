import { Check, Copy, Download, FileUp, LoaderCircle, Play, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AiModality } from "@nomduchat/shared";
import { sendChatMessage } from "../../api-client/chat";
import {
  createGenerationJob,
  fetchGenerationArtifact,
  refreshGenerationJob,
  type MediaGenerationOptions,
  type ReferenceImageJobInput,
} from "../../api-client/generation";
import { useAuth } from "../../auth";
import { appCatalog } from "../../data/appCatalog";
import { useLanguage } from "../../i18n";
import PresentationStudio from "./PresentationStudio";
import VoiceStudio from "./VoiceStudio";
import "../../../styles/immersive-apps.css";

type CatalogApp = (typeof appCatalog)[number];
type FieldValue = string | boolean;

type StudioField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "range" | "checkbox";
  defaultValue: FieldValue;
  placeholder?: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
};

type StudioConfig = {
  title: string;
  action: string;
  fields: StudioField[];
  accept?: string;
};

type StudioResult =
  | { kind: "text"; value: string }
  | { kind: "image" | "video" | "audio"; value: string; filename: string };

const studioConfigs: Record<string, StudioConfig> = {
  "ai-translation": {
    title: "Перевод с контролем смысла",
    action: "Перевести",
    fields: [
      { id: "source", label: "Исходный текст", type: "textarea", defaultValue: "", placeholder: "Вставьте текст для перевода…" },
      { id: "language", label: "Язык результата", type: "select", defaultValue: "Английский", options: options("Английский", "Русский", "Казахский", "Немецкий", "Испанский") },
      { id: "tone", label: "Тон", type: "select", defaultValue: "Сохранить исходный", options: options("Сохранить исходный", "Деловой", "Дружелюбный", "Литературный") },
      { id: "variants", label: "Дать альтернативный вариант", type: "checkbox", defaultValue: true },
    ],
  },
  "prompt-builder": {
    title: "Конструктор точного запроса",
    action: "Собрать промпт",
    fields: [
      { id: "goal", label: "Что нужно получить", type: "textarea", defaultValue: "", placeholder: "Опишите результат обычными словами…" },
      { id: "target", label: "Для чего промпт", type: "select", defaultValue: "Текст", options: options("Текст", "Изображение", "Видео", "Код", "Исследование", "Бизнес") },
      { id: "detail", label: "Детализация", type: "range", defaultValue: "70", min: 0, max: 100 },
    ],
  },
  "seo-article": {
    title: "Редактор SEO-материала",
    action: "Подготовить статью",
    fields: [
      { id: "topic", label: "Тема и задача", type: "textarea", defaultValue: "", placeholder: "О чём статья и какое действие должен сделать читатель…" },
      { id: "keywords", label: "Ключевые запросы", type: "text", defaultValue: "", placeholder: "Через запятую" },
      { id: "audience", label: "Аудитория", type: "text", defaultValue: "Люди без специальных знаний" },
      { id: "length", label: "Объём", type: "select", defaultValue: "Средняя · 1200 слов", options: options("Короткая · 700 слов", "Средняя · 1200 слов", "Подробная · 2000 слов") },
      { id: "faq", label: "Добавить FAQ и meta description", type: "checkbox", defaultValue: true },
    ],
  },
  images: {
    title: "Визуальная студия",
    action: "Создать изображение",
    accept: "image/png,image/jpeg,image/webp",
    fields: [
      { id: "prompt", label: "Сцена", type: "textarea", defaultValue: "Выразительный рекламный визуал продукта с чистой композицией и направленным светом.", placeholder: "Опишите объект, окружение, свет и настроение…" },
      { id: "style", label: "Стиль", type: "select", defaultValue: "Предметный 3D", options: options("Предметный 3D", "Редакционная фотография", "Кино", "Иллюстрация", "Минимализм") },
      { id: "aspectRatio", label: "Формат", type: "select", defaultValue: "1:1", options: options("1:1", "4:5", "16:9", "9:16", "3:2") },
      { id: "imageSize", label: "Качество", type: "select", defaultValue: "2K", options: options("1K", "2K", "4K") },
    ],
  },
  video: {
    title: "Видео и движение камеры",
    action: "Создать видео",
    accept: "image/png,image/jpeg,image/webp",
    fields: [
      { id: "prompt", label: "Сцена и действие", type: "textarea", defaultValue: "Кинематографичный продуктовый ролик: объект появляется из темноты, камера плавно приближается.", placeholder: "Опишите первый кадр, действие и финал…" },
      { id: "movement", label: "Камера", type: "select", defaultValue: "push_in", options: labeledOptions([["static", "Статичная"], ["push_in", "Плавное приближение"], ["orbit", "Орбита"], ["tracking", "Следование"], ["crane", "Подъём"]]) },
      { id: "duration", label: "Длительность", type: "select", defaultValue: "6", options: labeledOptions([["4", "4 секунды"], ["6", "6 секунд"], ["8", "8 секунд"]]) },
      { id: "aspectRatio", label: "Формат", type: "select", defaultValue: "16:9", options: options("16:9", "9:16", "1:1") },
      { id: "resolution", label: "Разрешение", type: "select", defaultValue: "1080p", options: options("720p", "1080p", "4k") },
    ],
  },
  presentation: {
    title: "Сценарий презентации",
    action: "Собрать структуру",
    fields: [
      { id: "topic", label: "Тема и цель", type: "textarea", defaultValue: "", placeholder: "Что нужно представить и какого решения добиться…" },
      { id: "audience", label: "Аудитория", type: "text", defaultValue: "Руководители и заказчики" },
      { id: "slides", label: "Количество слайдов", type: "range", defaultValue: "10", min: 5, max: 20, step: 1 },
      { id: "speakerNotes", label: "Добавить заметки спикера", type: "checkbox", defaultValue: true },
    ],
  },
  music: {
    title: "Музыкальная студия",
    action: "Создать трек",
    fields: [
      { id: "prompt", label: "Идея трека", type: "textarea", defaultValue: "Энергичный электронный джингл для технологичного продукта, запоминающийся хук.", placeholder: "Жанр, настроение, инструменты и развитие…" },
      { id: "genre", label: "Жанр", type: "select", defaultValue: "Electronic", options: options("Electronic", "Ambient", "Pop", "Cinematic", "Lo-fi", "Acoustic") },
      { id: "energy", label: "Энергия", type: "range", defaultValue: "72", min: 0, max: 100 },
      { id: "instrumental", label: "Без вокала", type: "checkbox", defaultValue: true },
    ],
  },
  voice: {
    title: "Студия озвучки",
    action: "Озвучить",
    fields: [
      { id: "text", label: "Текст диктора", type: "textarea", defaultValue: "Добро пожаловать в nomduchat. Опишите задачу, и мы соберём подходящий рабочий процесс.", placeholder: "Введите текст для озвучки…" },
      { id: "voice", label: "Голос", type: "select", defaultValue: "nova", options: labeledOptions([["nova", "Nova · мягкий"], ["alloy", "Alloy · нейтральный"], ["onyx", "Onyx · глубокий"], ["fable", "Fable · выразительный"], ["shimmer", "Shimmer · светлый"]]) },
      { id: "speed", label: "Скорость", type: "range", defaultValue: "1", min: 0.7, max: 1.3, step: 0.05 },
      { id: "format", label: "Формат", type: "select", defaultValue: "mp3", options: options("mp3", "wav") },
    ],
  },
  mailing: {
    title: "Редактор рассылки",
    action: "Подготовить письмо",
    fields: [
      { id: "offer", label: "Предложение", type: "textarea", defaultValue: "", placeholder: "Что предлагаете, кому и почему сейчас…" },
      { id: "audience", label: "Сегмент аудитории", type: "text", defaultValue: "Активные клиенты" },
      { id: "tone", label: "Тон", type: "select", defaultValue: "Коротко и по делу", options: options("Коротко и по делу", "Дружелюбно", "Премиально", "Энергично") },
      { id: "ab", label: "Сделать A/B-варианты темы", type: "checkbox", defaultValue: true },
    ],
  },
  code: {
    title: "Разбор кода и ошибок",
    action: "Проанализировать",
    fields: [
      { id: "code", label: "Код или ошибка", type: "textarea", defaultValue: "", placeholder: "Вставьте код, stack trace или опишите поведение…" },
      { id: "language", label: "Технология", type: "text", defaultValue: "Определить автоматически" },
      { id: "goal", label: "Что нужно", type: "select", defaultValue: "Найти и исправить ошибку", options: options("Найти и исправить ошибку", "Провести code review", "Упростить код", "Добавить тесты", "Объяснить код") },
      { id: "minimal", label: "Предлагать минимальный патч", type: "checkbox", defaultValue: true },
    ],
  },
  documents: {
    title: "Аналитика документов",
    action: "Разобрать документ",
    accept: ".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json",
    fields: [
      { id: "document", label: "Текст документа", type: "textarea", defaultValue: "", placeholder: "Вставьте текст или загрузите файл…" },
      { id: "goal", label: "Результат", type: "select", defaultValue: "Резюме, риски и действия", options: options("Резюме, риски и действия", "Проверка логики", "Сравнение версий", "Извлечение фактов", "Вопросы к автору") },
      { id: "quotes", label: "Ссылаться на фрагменты документа", type: "checkbox", defaultValue: true },
    ],
  },
};

export default function GenericAppStudio({ app }: { app: CatalogApp }) {
  if (app.id === "presentation") return <PresentationStudio />;
  if (app.id === "voice") return <VoiceStudio />;
  return <ConfigurableAppStudio app={app} />;
}

function ConfigurableAppStudio({ app }: { app: CatalogApp }) {
  const config = studioConfigs[app.id] ?? studioConfigs["prompt-builder"];
  const { isAuthenticated, user } = useAuth();
  const { language } = useLanguage();
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(config.fields.map((field) => [field.id, field.defaultValue]))
  );
  const [reference, setReference] = useState<ReferenceImageJobInput | null>(null);
  const [referenceName, setReferenceName] = useState("");
  const [result, setResult] = useState<StudioResult | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (result && result.kind !== "text") URL.revokeObjectURL(result.value);
    };
  }, [result]);

  const isMedia = Boolean(app.creationMode);
  const mainValue = useMemo(
    () => config.fields.find((field) => field.type === "textarea" || field.type === "text")
      ? String(values[config.fields.find((field) => field.type === "textarea" || field.type === "text")!.id] ?? "").trim()
      : "ready",
    [config.fields, values]
  );

  const update = (id: string, value: FieldValue) => {
    setValues((current) => ({ ...current, [id]: value }));
    setError(null);
  };

  const run = async () => {
    if (!mainValue || busy) return;
    if (!isAuthenticated) {
      setError("Войдите в аккаунт, чтобы запустить приложение.");
      return;
    }

    setBusy(true);
    setError(null);
    setCopied(false);
    setStatus(isMedia ? "Создаю задачу…" : "Собираю результат…");

    try {
      if (isMedia) {
        const prompt = buildPrompt(app, config, values);
        const options = generationOptions(app.id, values);
        const response = await createGenerationJob({
          agentId: app.id === "images" ? "image" : app.id,
          modality: app.creationMode as AiModality,
          prompt,
          options,
          referenceImage: reference ?? undefined,
          language,
          country: user?.country === "RU" ? "RU" : "KZ",
        });
        let job = response.job;

        for (let attempt = 0; attempt < 72 && (job.status === "queued" || job.status === "running"); attempt += 1) {
          setStatus(job.status === "queued" ? "Задача в очереди…" : "Генерирую результат…");
          await wait(2500);
          job = (await refreshGenerationJob(job.id)).job;
        }

        if (job.status !== "succeeded") {
          throw new Error(job.status === "cancelled" ? "Генерация отменена." : "Не удалось завершить генерацию.");
        }

        const blob = await fetchGenerationArtifact(job.id);
        const url = URL.createObjectURL(blob);
        const kind = mediaKind(app.creationMode);
        setResult({
          kind,
          value: url,
          filename: `${app.id}-${job.id}.${extensionForMime(blob.type, kind)}`,
        });
      } else {
        const response = await sendChatMessage({
          message: buildPrompt(app, config, values),
          agentId: app.agentId ?? "general",
          selectedModelId: app.networkId ?? "openai:gpt-4o-mini",
          language,
          country: user?.country === "RU" ? "RU" : "KZ",
        });
        setResult({
          kind: "text",
          value: response.assistantMessage?.content?.trim() || "Модель не вернула результат. Попробуйте ещё раз.",
        });
      }
      setStatus("Готово");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Не удалось выполнить задачу.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const readReference = async (file: File | null) => {
    if (!file) {
      setReference(null);
      setReferenceName("");
      return;
    }
    setReferenceName(file.name);
    if (file.type.startsWith("image/")) {
      setReference(await fileToReference(file));
      return;
    }
    const text = await file.text();
    const target = config.fields.find((field) => field.type === "textarea");
    if (target) update(target.id, text.slice(0, 180_000));
  };

  const copy = async () => {
    if (!result || result.kind !== "text") return;
    await navigator.clipboard.writeText(result.value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="app-studio-grid app-studio-generic">
      <div className="app-studio-panel">
        <div className="app-studio-panel-head">
          <div>
            <p className="ns-overline">Управление</p>
            <h2>{config.title}</h2>
          </div>
          <span className="app-studio-local-badge">Без перехода в чат</span>
        </div>

        <div className="app-studio-fields">
          {config.fields.slice(0, 1).map((field) => (
            <StudioControl key={field.id} field={field} value={values[field.id]} onChange={(value) => update(field.id, value)} />
          ))}
          {config.fields.length > 1 ? (
            <details className="app-studio-advanced">
              <summary>
                <span><SlidersHorizontal className="h-4 w-4" /> Дополнительные настройки</span>
                <small>{config.fields.length - 1}</small>
              </summary>
              <div className="app-studio-advanced-body">
                {config.fields.slice(1).map((field) => (
                  <StudioControl key={field.id} field={field} value={values[field.id]} onChange={(value) => update(field.id, value)} />
                ))}
              </div>
            </details>
          ) : null}
        </div>

        {config.accept ? (
          <label className="app-studio-upload">
            <FileUp className="h-5 w-5" strokeWidth={1.7} />
            <span>
              <strong>{referenceName || "Добавить исходный файл"}</strong>
              <small>{referenceName ? "Нажмите, чтобы заменить" : "Референс или документ останется внутри этой задачи"}</small>
            </span>
            <input type="file" accept={config.accept} onChange={(event) => void readReference(event.target.files?.[0] ?? null)} />
          </label>
        ) : null}

        {error ? <p className="app-studio-error">{error}</p> : null}

        <button type="button" className="nd-primary-action app-studio-run" onClick={() => void run()} disabled={!mainValue || busy}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isMedia ? <Play className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {busy ? status : config.action}
        </button>
      </div>

      <div className="app-studio-panel app-studio-result-panel">
        <div className="app-studio-panel-head">
          <div>
            <p className="ns-overline">Результат</p>
            <h2>{status || "Рабочая область"}</h2>
          </div>
          {result && result.kind !== "text" ? (
            <a className="app-studio-copy" href={result.value} download={result.filename}>
              <Download className="h-4 w-4" />
              Скачать
            </a>
          ) : null}
        </div>

        {result ? (
          <div className="app-studio-output">
            <StudioOutput result={result} />
            {result.kind === "text" ? (
              <div className="app-studio-result-actions">
                <button
                  type="button"
                  className="app-studio-copy app-studio-copy--compact"
                  onClick={() => void copy()}
                  aria-label={copied ? "Скопировано" : "Копировать результат"}
                  title={copied ? "Скопировано" : "Копировать результат"}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="app-studio-empty-result">
            <div className="app-studio-placeholder-object" aria-hidden="true">
              <span />
              <span />
              <span />
              <img
                src={`/app-placeholders/${app.id}.jpg`}
                alt=""
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            </div>
            <h3>{busy ? status : "Здесь появится результат"}</h3>
            <p>Все параметры, исходники и готовый материал находятся в одном пространстве приложения.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function StudioControl({
  field,
  value,
  onChange,
}: {
  field: StudioField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="app-studio-check">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span aria-hidden="true">{value ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : null}</span>
        {field.label}
      </label>
    );
  }

  if (field.type === "range") {
    return (
      <label className="app-studio-range">
        <span><strong>{field.label}</strong><output>{String(value)}</output></span>
        <input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  return (
    <label className="app-studio-field">
      <span>{field.label}</span>
      {field.type === "textarea" ? (
        <textarea
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="app-studio-textarea"
        />
      ) : field.type === "select" ? (
        <select value={String(value)} onChange={(event) => onChange(event.target.value)}>
          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <input type="text" value={String(value)} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
      )}
      {field.help ? <small>{field.help}</small> : null}
    </label>
  );
}

function StudioOutput({ result }: { result: StudioResult }) {
  if (result.kind === "image") return <img src={result.value} alt="Созданный результат" className="app-studio-media-result" />;
  if (result.kind === "video") return <video src={result.value} controls playsInline className="app-studio-media-result" />;
  if (result.kind === "audio") return <audio src={result.value} controls className="app-studio-audio-result" />;
  return <div className="app-studio-result-text">{result.value}</div>;
}

function buildPrompt(app: CatalogApp, config: StudioConfig, values: Record<string, FieldValue>) {
  const parameters = config.fields.map((field) => `${field.label}: ${formatValue(values[field.id])}`).join("\n");
  const task = app.id === "prompt-builder"
    ? "Составь один готовый промпт, который можно сразу использовать. Не задавай уточняющих вопросов, не добавляй вступление и не объясняй свою работу."
    : app.starterPrompt ?? `Выполни задачу в приложении «${app.title}».`;
  return [
    task,
    "",
    "Параметры пользователя:",
    parameters,
    "",
    "Верни готовый результат без предложения перейти в другой инструмент.",
  ].join("\n");
}

function generationOptions(appId: string, values: Record<string, FieldValue>): MediaGenerationOptions {
  if (appId === "images") {
    return {
      aspectRatio: String(values.aspectRatio) as MediaGenerationOptions["aspectRatio"],
      imageSize: String(values.imageSize) as MediaGenerationOptions["imageSize"],
    };
  }
  if (appId === "video") {
    return {
      aspectRatio: String(values.aspectRatio) as MediaGenerationOptions["aspectRatio"],
      durationSeconds: Number(values.duration) as 4 | 6 | 8,
      videoResolution: String(values.resolution) as MediaGenerationOptions["videoResolution"],
      camera: {
        yaw: 0,
        pitch: 0,
        distance: "medium",
        lens: 35,
        movement: String(values.movement) as NonNullable<MediaGenerationOptions["camera"]>["movement"],
      },
    };
  }
  if (appId === "voice") {
    return {
      voice: String(values.voice) as MediaGenerationOptions["voice"],
      speechSpeed: Number(values.speed),
      audioFormat: String(values.format) as MediaGenerationOptions["audioFormat"],
    };
  }
  return {};
}

function mediaKind(modality: string): "image" | "video" | "audio" {
  if (modality === "image") return "image";
  if (modality === "video") return "video";
  return "audio";
}

function formatValue(value: FieldValue | undefined) {
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  return String(value ?? "");
}

function options(...items: string[]) {
  return items.map((item) => ({ value: item, label: item }));
}

function labeledOptions(items: Array<[string, string]>) {
  return items.map(([value, label]) => ({ value, label }));
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fileToReference(file: File): Promise<ReferenceImageJobInput> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return {
    dataBase64: dataUrl.split(",")[1] ?? "",
    mimeType: normalizeImageType(file.type),
    filename: file.name,
    consentConfirmed: true,
  };
}

function normalizeImageType(type: string): ReferenceImageJobInput["mimeType"] {
  if (type === "image/png" || type === "image/webp") return type;
  return "image/jpeg";
}

function extensionForMime(mime: string, kind: "image" | "video" | "audio") {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg")) return kind === "video" ? "mp4" : "mp3";
  return kind === "image" ? "jpg" : kind === "video" ? "mp4" : "mp3";
}
