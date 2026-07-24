import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ImageIcon,
  Loader2,
  Mic2,
  Music2,
  Paperclip,
  Send,
  SlidersHorizontal,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import type { MediaGenerationOptions, ReferenceImageJobInput } from "../../api-client/generation";
import { useMediaConversation } from "../../hooks/useMediaConversation";
import { GenerationJobCard } from "../chat/generation";
import CameraControl, { type CameraSettings } from "./CameraControl";
import { isMediaMode, mediaModes, type MediaMode } from "./mediaModes";
import VerticalProcessRail from "./VerticalProcessRail";

const modeIcons = {
  image: ImageIcon,
  video: Video,
  music: Music2,
  voice: Mic2,
};

const defaultCamera: CameraSettings = {
  yaw: 38,
  pitch: -6,
  distance: "medium",
  lens: 50,
  movement: "push_in",
};

type WidgetId =
  | "format"
  | "size"
  | "quality"
  | "duration"
  | "reference"
  | "camera"
  | "voice"
  | "speed"
  | "file"
  | "tempo"
  | "energy"
  | "vocals";

const defaultWidgetOrder: Record<MediaMode, WidgetId[]> = {
  image: ["format", "size", "reference", "camera"],
  video: ["format", "quality", "duration", "reference", "camera"],
  voice: ["voice", "speed", "file"],
  music: ["tempo", "energy", "vocals"],
};

export default function MediaChat() {
  const { kind } = useParams();
  const [searchParams] = useSearchParams();
  if (!isMediaMode(kind)) return <Navigate to="/workspace/media/image" replace />;

  return <MediaChatScreen key={kind} mode={kind} initialPrompt={searchParams.get("prompt") ?? ""} />;
}

function MediaChatScreen({ mode, initialPrompt }: { mode: MediaMode; initialPrompt: string }) {
  const config = mediaModes[mode];
  const Icon = modeIcons[mode];
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localError, setLocalError] = useState("");
  const [aspectRatio, setAspectRatio] = useState<NonNullable<MediaGenerationOptions["aspectRatio"]>>(mode === "video" ? "16:9" : "1:1");
  const [imageSize, setImageSize] = useState<NonNullable<MediaGenerationOptions["imageSize"]>>("1K");
  const [videoResolution, setVideoResolution] = useState<NonNullable<MediaGenerationOptions["videoResolution"]>>("720p");
  const [durationSeconds, setDurationSeconds] = useState<NonNullable<MediaGenerationOptions["durationSeconds"]>>(8);
  const [camera, setCamera] = useState<CameraSettings>(defaultCamera);
  const [referenceImage, setReferenceImage] = useState<ReferenceImageJobInput | null>(null);
  const [referenceConsent, setReferenceConsent] = useState(false);
  const [voice, setVoice] = useState<NonNullable<MediaGenerationOptions["voice"]>>("alloy");
  const [speechSpeed, setSpeechSpeed] = useState(1);
  const [audioFormat, setAudioFormat] = useState<NonNullable<MediaGenerationOptions["audioFormat"]>>("mp3");
  const [bpm, setBpm] = useState(112);
  const [musicEnergy, setMusicEnergy] = useState("medium");
  const [instrumental, setInstrumental] = useState(true);
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(() => readWidgetOrder(mode));
  const conversation = useMediaConversation();
  const latestTurn = conversation.turns[conversation.turns.length - 1];
  const busy = conversation.isStarting || conversation.hasActiveJob;

  const options = useMemo<MediaGenerationOptions>(() => {
    if (mode === "image") return { aspectRatio, imageSize, camera };
    if (mode === "video") return { aspectRatio, videoResolution, durationSeconds, camera };
    if (mode === "voice") return { voice, speechSpeed, audioFormat };
    return {};
  }, [aspectRatio, audioFormat, camera, durationSeconds, imageSize, mode, speechSpeed, videoResolution, voice]);

  useEffect(() => {
    window.localStorage.setItem(`nomduchat-media-widgets-${mode}`, JSON.stringify(widgetOrder));
  }, [mode, widgetOrder]);

  useEffect(() => {
    document.documentElement.classList.toggle("ns-media-settings-open", settingsOpen);
    return () => document.documentElement.classList.remove("ns-media-settings-open");
  }, [settingsOpen]);

  const moveWidget = (id: WidgetId, direction: -1 | 1) => {
    setWidgetOrder((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const dropWidget = (source: WidgetId, target: WidgetId) => {
    if (source === target) return;
    setWidgetOrder((current) => {
      const next = current.filter((id) => id !== source);
      const targetIndex = next.indexOf(target);
      if (targetIndex < 0) return current;
      next.splice(targetIndex, 0, source);
      return next;
    });
  };

  const sortFor = (id: WidgetId) => ({
    id,
    index: widgetOrder.indexOf(id),
    total: widgetOrder.length,
    onMove: moveWidget,
    onDrop: dropWidget,
  });

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setLocalError("Опишите результат.");
      return;
    }
    if (referenceImage && !referenceConsent) {
      setLocalError("Подтвердите право использовать загруженный кадр.");
      return;
    }

    setLocalError("");
    const providerPrompt = buildProviderPrompt({
      mode,
      prompt: cleanPrompt,
      options,
      bpm,
      musicEnergy,
      instrumental,
    });
    const job = await conversation.start(
      {
        agentId: config.agentId,
        modality: config.modality,
        prompt: providerPrompt,
        options,
        referenceImage: referenceImage ? { ...referenceImage, consentConfirmed: referenceConsent } : undefined,
      },
      cleanPrompt,
    );
    if (job) setPrompt("");
  };

  const handleReference = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const image = await readReferenceImage(file);
      setReferenceImage(image);
      setReferenceConsent(false);
      setLocalError("");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Не удалось прочитать изображение.");
    }
  };

  return (
    <div className="ns-media-chat-shell">
      <header className="ns-media-chat-header">
        <Link to="/workspace/media" className="ns-media-back" aria-label="Вернуться в медиа">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
        </Link>
        <nav className="ns-media-mode-tabs" aria-label="Тип генерации">
          {(Object.keys(mediaModes) as MediaMode[]).map((item) => {
            const ItemIcon = modeIcons[item];
            return (
              <Link key={item} to={`/workspace/media/${item}`} data-active={item === mode}>
                <ItemIcon className="h-4 w-4" strokeWidth={1.8} />
                <span>{mediaModes[item].label}</span>
              </Link>
            );
          })}
        </nav>
        <button type="button" className="ns-media-settings-trigger" onClick={() => setSettingsOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
          Параметры
        </button>
      </header>

      <div className="ns-media-chat-layout">
        <main className="ns-media-thread">
          <div className="ns-media-thread-scroll">
            {conversation.turns.length === 0 ? (
              <section className="ns-media-empty">
                <ResultPlaceholder mode={mode} icon={Icon} />
                <h1>{config.title}</h1>
                <div className="ns-media-examples">
                  {config.examples.map((example) => (
                    <button key={example} type="button" onClick={() => setPrompt(example)}>{example}</button>
                  ))}
                </div>
              </section>
            ) : (
              <div className="ns-media-turns">
                {conversation.turns.map((turn) => (
                  <article key={turn.id} className="ns-media-turn">
                    <div className="ns-media-user-message">{turn.prompt}</div>
                    <GenerationJobCard
                      job={turn.job}
                      artifactUrl={turn.artifactUrl}
                      isCancelling={turn.isCancelling}
                      onCancel={() => void conversation.cancel(turn.job.id)}
                    />
                  </article>
                ))}
              </div>
            )}
          </div>

          <form className="ns-media-composer" onSubmit={handleSubmit}>
            {(mode === "image" || mode === "video") ? (
              <>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleReference} />
                <button
                  type="button"
                  className="ns-media-composer-icon"
                  onClick={() => fileInput.current?.click()}
                  aria-label={mode === "video" ? "Добавить стартовый кадр" : "Добавить референс"}
                >
                  <Paperclip className="h-5 w-5" strokeWidth={1.8} />
                </button>
              </>
            ) : null}

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={config.placeholder}
              rows={1}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!busy) void handleSubmit();
                }
              }}
            />
            <button type="submit" className="ns-media-send" disabled={busy || !prompt.trim()} aria-label="Запустить генерацию">
              {conversation.isStarting ? <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} /> : <Send className="h-5 w-5" strokeWidth={1.8} />}
            </button>
          </form>

          {(localError || conversation.error) ? <div className="ns-media-error">{localError || conversation.error}</div> : null}
        </main>

        {settingsOpen ? <button className="ns-media-settings-scrim" type="button" onClick={() => setSettingsOpen(false)} aria-label="Закрыть параметры" /> : null}
        <aside className="ns-media-settings" data-open={settingsOpen}>
          <div className="ns-media-settings-head">
            <div>
              <span>Параметры</span>
              <strong>{config.label}</strong>
            </div>
            <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Закрыть параметры">
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>

          {latestTurn ? <VerticalProcessRail job={latestTurn.job} /> : null}

          {(mode === "image" || mode === "video") ? (
            <div className="ns-media-widget-stack">
              <SettingGroup label="Формат" sort={sortFor("format")}>
                <Segmented
                  value={aspectRatio}
                  options={mode === "video" ? ["16:9", "9:16"] : ["1:1", "4:5", "3:2", "16:9", "9:16"]}
                  onChange={(value) => setAspectRatio(value as NonNullable<MediaGenerationOptions["aspectRatio"]>)}
                />
              </SettingGroup>

              {mode === "image" ? (
                <SettingGroup label="Размер" sort={sortFor("size")}>
                  <Segmented value={imageSize} options={["1K", "2K", "4K"]} onChange={(value) => setImageSize(value as NonNullable<MediaGenerationOptions["imageSize"]>)} />
                </SettingGroup>
              ) : (
                <>
                  <SettingGroup label="Качество" sort={sortFor("quality")}>
                    <Segmented
                      value={videoResolution}
                      options={["720p", "1080p"]}
                      onChange={(value) => {
                        const resolution = value as NonNullable<MediaGenerationOptions["videoResolution"]>;
                        setVideoResolution(resolution);
                        if (resolution === "1080p") setDurationSeconds(8);
                      }}
                    />
                  </SettingGroup>
                  <SettingGroup label="Длительность" sort={sortFor("duration")}>
                    <Segmented
                      value={`${durationSeconds} с`}
                      options={["4 с", "6 с", "8 с"]}
                      disabled={videoResolution === "1080p"}
                      onChange={(value) => setDurationSeconds(Number(value.split(" ")[0]) as 4 | 6 | 8)}
                    />
                  </SettingGroup>
                </>
              )}

              <SettingGroup label={mode === "video" ? "Стартовый кадр" : "Референс"} sort={sortFor("reference")}>
                {referenceImage ? (
                  <div className="ns-reference-preview">
                    <img src={`data:${referenceImage.mimeType};base64,${referenceImage.dataBase64}`} alt="Загруженный референс" />
                    <button type="button" onClick={() => { setReferenceImage(null); setReferenceConsent(false); }} aria-label="Удалить изображение">
                      <X className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>
                ) : (
                  <button type="button" className="ns-reference-add" onClick={() => fileInput.current?.click()}>
                    <Camera className="h-4 w-4" strokeWidth={1.8} />
                    {mode === "video" ? "Выбрать первый кадр" : "Добавить изображение"}
                  </button>
                )}
                {referenceImage ? (
                  <label className="ns-reference-consent">
                    <input type="checkbox" checked={referenceConsent} onChange={(event) => setReferenceConsent(event.target.checked)} />
                    У меня есть право использовать файл
                  </label>
                ) : null}
              </SettingGroup>

              <SettingGroup label="Камера" sort={sortFor("camera")}>
                <CameraControl value={camera} onChange={setCamera} />
              </SettingGroup>
            </div>
          ) : null}

          {mode === "voice" ? (
            <div className="ns-media-widget-stack">
              <SettingGroup label="Голос" sort={sortFor("voice")}>
                <select className="ns-media-select" value={voice} onChange={(event) => setVoice(event.target.value as NonNullable<MediaGenerationOptions["voice"]>)}>
                  <option value="alloy">Нейтральный</option>
                  <option value="onyx">Глубокий</option>
                  <option value="nova">Тёплый</option>
                  <option value="fable">Мягкий</option>
                  <option value="shimmer">Энергичный</option>
                </select>
              </SettingGroup>
              <SettingGroup label={`Скорость · ${speechSpeed.toFixed(1)}×`} sort={sortFor("speed")}>
                <input className="ns-media-range" type="range" min="0.7" max="1.4" step="0.1" value={speechSpeed} onChange={(event) => setSpeechSpeed(Number(event.target.value))} />
              </SettingGroup>
              <SettingGroup label="Файл" sort={sortFor("file")}>
                <Segmented value={audioFormat.toUpperCase()} options={["MP3", "WAV"]} onChange={(value) => setAudioFormat(value.toLowerCase() as "mp3" | "wav")} />
              </SettingGroup>
            </div>
          ) : null}

          {mode === "music" ? (
            <div className="ns-media-widget-stack">
              <SettingGroup label={`Темп · ${bpm} BPM`} sort={sortFor("tempo")}>
                <input className="ns-media-range" type="range" min="60" max="180" step="2" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} />
              </SettingGroup>
              <SettingGroup label="Энергия" sort={sortFor("energy")}>
                <Segmented value={musicEnergy} options={["low", "medium", "high"]} labels={{ low: "Тихо", medium: "Средне", high: "Ярко" }} onChange={setMusicEnergy} />
              </SettingGroup>
              <SettingGroup label="Вокал" sort={sortFor("vocals")}>
                <Segmented value={instrumental ? "Инструментал" : "С вокалом"} options={["Инструментал", "С вокалом"]} onChange={(value) => setInstrumental(value === "Инструментал")} />
              </SettingGroup>
              <div className="ns-media-fact">
                <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                Lyria Clip создаёт 30-секундный MP3.
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ResultPlaceholder({ mode, icon: Icon }: { mode: MediaMode; icon: typeof ImageIcon }) {
  return (
    <div className="ns-media-result-placeholder" data-mode={mode} aria-label="Место будущего результата">
      <div className="ns-media-result-frame">
        <span className="ns-media-result-glow" aria-hidden="true" />
        <Icon className="h-7 w-7" strokeWidth={1.55} />
        <strong>Результат появится здесь</strong>
        <span>{mode === "video" ? "Кадр и таймлайн" : mode === "image" ? "Изображение и варианты" : mode === "music" ? "Трек и волна" : "Аудио и плеер"}</span>
      </div>
      <div className="ns-media-result-track" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

type WidgetSort = {
  id: WidgetId;
  index: number;
  total: number;
  onMove: (id: WidgetId, direction: -1 | 1) => void;
  onDrop: (source: WidgetId, target: WidgetId) => void;
};

function SettingGroup({ label, sort, children }: { label: string; sort: WidgetSort; children: ReactNode }) {
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const source = event.dataTransfer.getData("text/plain") as WidgetId;
    if (source) sort.onDrop(source, sort.id);
  };

  return (
    <section
      className="ns-media-setting-group"
      style={{ order: sort.index }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="ns-media-setting-title">
        <h2>{label}</h2>
        <div className="ns-media-setting-sort">
          <button
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", sort.id);
            }}
            aria-label={`Перетащить блок «${label}»`}
          >
            <GripVertical className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
          <button type="button" disabled={sort.index <= 0} onClick={() => sort.onMove(sort.id, -1)} aria-label={`Поднять блок «${label}»`}>
            <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
          <button type="button" disabled={sort.index >= sort.total - 1} onClick={() => sort.onMove(sort.id, 1)} aria-label={`Опустить блок «${label}»`}>
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}

function Segmented({
  value,
  options,
  labels,
  disabled = false,
  onChange,
}: {
  value: string;
  options: string[];
  labels?: Record<string, string>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ns-media-segmented" data-disabled={disabled}>
      {options.map((option) => (
        <button key={option} type="button" data-active={value === option} disabled={disabled} onClick={() => onChange(option)}>
          {labels?.[option] ?? option}
        </button>
      ))}
    </div>
  );
}

function buildProviderPrompt(input: {
  mode: MediaMode;
  prompt: string;
  options: MediaGenerationOptions;
  bpm: number;
  musicEnergy: string;
  instrumental: boolean;
}) {
  if (input.mode === "voice") return input.prompt;
  if (input.mode === "music") {
    return [
      input.prompt,
      `Tempo: ${input.bpm} BPM. Energy: ${input.musicEnergy}.`,
      input.instrumental ? "Instrumental only, no vocals." : "Include original vocals and lyrics in the prompt language.",
    ].join("\n");
  }

  const camera = input.options.camera ?? defaultCamera;
  return [
    input.prompt,
    `Output aspect ratio: ${input.options.aspectRatio}.`,
    `Camera: ${cameraDescription(camera)}; ${camera.lens}mm lens; ${movementDescription(camera.movement)}.`,
    "Keep one clear focal subject, intentional lighting and a clean premium composition. No text, logos or watermark unless explicitly requested.",
  ].join("\n");
}

function cameraDescription(camera: CameraSettings) {
  const horizontal = camera.yaw < -20 ? "left three-quarter view" : camera.yaw > 20 ? "right three-quarter view" : "front view";
  const vertical = camera.pitch < -15 ? "low angle" : camera.pitch > 15 ? "high angle" : "eye level";
  const distance = { macro: "macro detail", close: "close-up", medium: "medium shot", wide: "wide shot" }[camera.distance];
  return `${distance}, ${horizontal}, ${vertical}`;
}

function movementDescription(movement: CameraSettings["movement"]) {
  return {
    static: "locked camera",
    push_in: "slow cinematic push-in",
    pull_out: "controlled pull-out",
    orbit: "smooth orbital move around the subject",
    tracking: "smooth tracking shot",
    crane: "gentle crane movement",
  }[movement];
}

async function readReferenceImage(file: File): Promise<ReferenceImageJobInput> {
  if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) {
    throw new Error("Поддерживаются JPG, PNG и WebP.");
  }
  if (file.size > 2_800_000) throw new Error("Размер изображения — до 2,8 МБ.");

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Не удалось прочитать файл."));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });

  return {
    dataBase64: dataUrl.split(",")[1] ?? "",
    mimeType: file.type as ReferenceImageJobInput["mimeType"],
    filename: file.name,
  };
}

function readWidgetOrder(mode: MediaMode) {
  const fallback = defaultWidgetOrder[mode];
  if (typeof window === "undefined") return [...fallback];

  try {
    const saved = JSON.parse(window.localStorage.getItem(`nomduchat-media-widgets-${mode}`) ?? "null");
    if (
      Array.isArray(saved)
      && saved.length === fallback.length
      && saved.every((id) => fallback.includes(id))
    ) {
      return saved as WidgetId[];
    }
  } catch {
    // Ignore invalid local preferences.
  }

  return [...fallback];
}
