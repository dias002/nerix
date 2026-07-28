import {
  Armchair,
  Camera,
  Check,
  Download,
  ImageUp,
  LampFloor,
  LoaderCircle,
  Move3D,
  RotateCcw,
  Sparkles,
  Trees,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createGenerationJob,
  fetchGenerationArtifact,
  refreshGenerationJob,
  type MediaGenerationOptions,
  type ReferenceImageJobInput,
} from "../../api-client/generation";
import { useAuth } from "../../auth";
import { useLanguage } from "../../i18n";
import InteriorCatalog from "./InteriorCatalog";
import {
  interiorCatalog,
  maxInteriorSelection,
  readInteriorSelection,
  saveInteriorSelection,
  type InteriorCatalogItem,
} from "./interiorCatalogData";
import "../../../styles/immersive-apps.css";
import "../../../styles/interior-catalog.css";

type InteriorRender = {
  id: string;
  jobId: string;
  imageUrl: string;
  label: string;
};

type RoomReference = ReferenceImageJobInput & {
  preview: string;
};

const styles = [
  ["warm-minimal", "Теплый минимализм"],
  ["scandinavian", "Скандинавский"],
  ["contemporary", "Современный"],
  ["japandi", "Джапанди"],
] as const;

const cameraPresets = [
  ["corner", "Из угла"],
  ["front", "Фронтально"],
  ["window", "От окна"],
  ["wide", "Широкий план"],
] as const;

const windowViews = [
  ["rain-forest", "Лес и дождь"],
  ["city-night", "Ночной город"],
  ["mountains", "Горы"],
  ["courtyard", "Тихий двор"],
] as const;

export default function InteriorDesignStudio() {
  const { isAuthenticated, user } = useAuth();
  const { language } = useLanguage();
  const urls = useRef<string[]>([]);
  const [brief, setBrief] = useState(
    "Светлая гостиная для отдыха и встреч. Натуральные материалы, свободный проход и спокойная атмосфера."
  );
  const [roomType, setRoomType] = useState("Гостиная");
  const [width, setWidth] = useState(5.2);
  const [depth, setDepth] = useState(4.4);
  const [height, setHeight] = useState(2.8);
  const [style, setStyle] = useState<(typeof styles)[number][0]>("warm-minimal");
  const [camera, setCamera] = useState<(typeof cameraPresets)[number][0]>("corner");
  const [lens, setLens] = useState(28);
  const [cameraTurn, setCameraTurn] = useState(-12);
  const [light, setLight] = useState(64);
  const [lightDirection, setLightDirection] = useState(28);
  const [windowView, setWindowView] = useState<(typeof windowViews)[number][0]>("rain-forest");
  const [selected, setSelected] = useState(readInteriorSelection);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [roomReference, setRoomReference] = useState<RoomReference | null>(null);
  const [renders, setRenders] = useState<InteriorRender[]>([]);
  const [activeId, setActiveId] = useState("");
  const [change, setChange] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const activeRender = renders.find((item) => item.id === activeId) ?? renders[0] ?? null;
  const selectedItems = useMemo(
    () => selected.map((id) => interiorCatalog.find((item) => item.id === id)).filter(Boolean) as InteriorCatalogItem[],
    [selected]
  );

  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  useEffect(() => saveInteriorSelection(selected), [selected]);

  const toggleFurniture = (id: string) => {
    setError("");
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= maxInteriorSelection) {
        setError(`Можно передать модели до ${maxInteriorSelection} предметов за одну генерацию.`);
        return current;
      }
      return [...current, id];
    });
  };

  const uploadRoom = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Загрузите JPG, PNG или WebP.");
      return;
    }
    const reference = await fileToReference(file);
    setRoomReference({ ...reference, preview: `data:${reference.mimeType};base64,${reference.dataBase64}` });
    setError("");
  };

  const generate = async (mode: "new" | "edit") => {
    if (busy) return;
    if (!isAuthenticated) {
      setError("Войдите в аккаунт, чтобы создать интерьер.");
      return;
    }
    if (!brief.trim()) {
      setError("Опишите, каким должен быть интерьер.");
      return;
    }
    if (mode === "edit" && (!activeRender || !change.trim())) {
      setError("Напишите, что нужно изменить в текущем варианте.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus(mode === "edit" ? "Готовлю новую версию…" : "Собираю комнату и референсы…");

    try {
      const references = await Promise.all(
        selectedItems.filter((item) => item.referenceImage).map((item) => imageToReference(item))
      );
      if (roomReference) {
        const { preview: _preview, ...reference } = roomReference;
        references.unshift(reference);
      }

      const response = await createGenerationJob({
        agentId: "image",
        modality: "image",
        prompt: buildInteriorPrompt({
          brief,
          roomType,
          width,
          depth,
          height,
          style,
          camera,
          lens,
          cameraTurn,
          light,
          lightDirection,
          windowView,
          furniture: selectedItems,
          change: mode === "edit" ? change.trim() : "",
        }),
        imageReferenceJobId: mode === "edit" ? activeRender?.jobId : undefined,
        referenceImages: references.length ? references : undefined,
        options: { aspectRatio: "16:9", imageSize: "2K" } as MediaGenerationOptions,
        language,
        country: user?.country === "RU" ? "RU" : "KZ",
      });

      let job = response.job;
      for (let attempt = 0; attempt < 72 && (job.status === "queued" || job.status === "running"); attempt += 1) {
        setStatus(job.status === "queued" ? "Задача в очереди…" : "Модель расставляет мебель и свет…");
        await wait(2500);
        job = (await refreshGenerationJob(job.id)).job;
      }
      if (job.status !== "succeeded") throw new Error("Не удалось завершить визуализацию.");

      const blob = await fetchGenerationArtifact(job.id);
      const imageUrl = URL.createObjectURL(blob);
      urls.current.push(imageUrl);
      const render = {
        id: `${job.id}-${Date.now()}`,
        jobId: job.id,
        imageUrl,
        label: mode === "edit" ? `Версия ${renders.length + 1}` : "Первый вариант",
      };
      setRenders((current) => [render, ...current]);
      setActiveId(render.id);
      setChange("");
      setStatus("Интерьер готов");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Не удалось создать интерьер.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  if (catalogOpen) {
    return (
      <InteriorCatalog
        items={interiorCatalog}
        selectedIds={selected}
        maxSelected={maxInteriorSelection}
        error={error}
        onToggle={toggleFurniture}
        onDone={() => {
          setCatalogOpen(false);
          setError("");
        }}
      />
    );
  }

  return (
    <section className="pro-studio-shell interior-pro">
      <div className="pro-studio-grid">
        <aside className="pro-control-panel">
          <header className="pro-panel-heading">
            <div>
              <p className="pro-overline">Планировщик</p>
              <h2>Интерьер под вашу комнату</h2>
            </div>
            <Move3D />
          </header>

          <label className="pro-field">
            <span>Ваше видение</span>
            <textarea value={brief} onChange={(event) => setBrief(event.target.value)} rows={5} />
          </label>

          <div className="pro-field-grid pro-field-grid--dimensions">
            <label className="pro-field">
              <span>Комната</span>
              <select value={roomType} onChange={(event) => setRoomType(event.target.value)}>
                <option>Гостиная</option>
                <option>Спальня</option>
                <option>Кухня-гостиная</option>
                <option>Кабинет</option>
              </select>
            </label>
            <NumberField label="Ширина, м" value={width} onChange={setWidth} />
            <NumberField label="Глубина, м" value={depth} onChange={setDepth} />
            <NumberField label="Высота, м" value={height} onChange={setHeight} />
          </div>

          <div className="pro-field">
            <span>Стиль</span>
            <div className="pro-choice-grid">
              {styles.map(([id, label]) => (
                <button key={id} type="button" className={style === id ? "is-active" : ""} onClick={() => setStyle(id)}>
                  <span className={`style-dot style-dot--${id}`} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pro-field">
            <div className="pro-field-head">
              <span>Мебель в сцене</span>
              <button
                type="button"
                className="pro-text-button"
                onClick={() => {
                  setError("");
                  setCatalogOpen(true);
                }}
              >
                <Armchair />
                Открыть каталог
              </button>
            </div>
            <div className="selected-furniture">
              {selectedItems.map((item) => (
                <button key={item.id} type="button" onClick={() => toggleFurniture(item.id)}>
                  <img src={item.image} alt="" />
                  <span>{item.title}</span>
                  <Check />
                </button>
              ))}
            </div>
          </div>

          <details className="pro-settings">
            <summary>
              <Camera />
              Точные настройки
            </summary>
            <div className="pro-settings-body">
              <div className="pro-segmented">
                {cameraPresets.map(([id, label]) => (
                  <button key={id} type="button" className={camera === id ? "is-active" : ""} onClick={() => setCamera(id)}>
                    {label}
                  </button>
                ))}
              </div>
              <RangeField label="Объектив" value={lens} min={20} max={55} suffix=" мм" onChange={setLens} />
              <RangeField label="Поворот камеры" value={cameraTurn} min={-40} max={40} suffix="°" onChange={setCameraTurn} />
              <RangeField label="Яркость" value={light} min={10} max={100} suffix="%" onChange={setLight} />
              <RangeField label="Направление света" value={lightDirection} min={-90} max={90} suffix="°" onChange={setLightDirection} />
              <label className="pro-field">
                <span>Вид из окна</span>
                <select value={windowView} onChange={(event) => setWindowView(event.target.value as typeof windowView)}>
                  {windowViews.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
            </div>
          </details>

          <label className="room-upload">
            <ImageUp />
            <span>
              <strong>{roomReference ? "Фото комнаты загружено" : "Добавить фото комнаты"}</strong>
              <small>Модель сохранит окна, стены и пропорции</small>
            </span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadRoom(event.target.files?.[0] ?? null)} />
          </label>

          <button type="button" className="pro-primary-button" disabled={busy} onClick={() => void generate("new")}>
            {busy ? <LoaderCircle className="spin" /> : <Sparkles />}
            Создать интерьер
          </button>
          {error ? <p className="pro-error">{error}</p> : null}
        </aside>

        <div className="pro-result-panel">
          <header className="pro-result-heading">
            <div>
              <p className="pro-overline">Визуализация</p>
              <h2>{activeRender ? activeRender.label : "Комната появится здесь"}</h2>
            </div>
            {status ? <span className="pro-status">{status}</span> : null}
          </header>

          <div className="interior-render-stage">
            {activeRender ? (
              <img src={activeRender.imageUrl} alt="Сгенерированный интерьер" />
            ) : (
              <div className="interior-empty">
                <div className="interior-empty-room">
                  <Trees />
                  <Armchair />
                  <LampFloor />
                </div>
                <strong>Соберите комнату из параметров слева</strong>
                <span>Модель учтет площадь, предметы, камеру, свет и вид из окна.</span>
              </div>
            )}
          </div>

          {activeRender ? (
            <>
              <div className="interior-actions">
                <a href={activeRender.imageUrl} download={`nomduchat-interior-${activeRender.jobId}.png`}>
                  <Download />
                  Скачать
                </a>
                <button type="button" onClick={() => setChange("Добавьте ")}>
                  <WandSparkles />
                  Изменить
                </button>
              </div>
              <div className="interior-revision">
                <label className="pro-field">
                  <span>Что изменить в этом варианте</span>
                  <textarea
                    value={change}
                    onChange={(event) => setChange(event.target.value)}
                    placeholder="Например: замените ковер на светлый, добавьте книжный стеллаж и сделайте дождь за окном сильнее"
                    rows={3}
                  />
                </label>
                <button type="button" disabled={busy || !change.trim()} onClick={() => void generate("edit")}>
                  {busy ? <LoaderCircle className="spin" /> : <RotateCcw />}
                  Создать новую версию
                </button>
              </div>
            </>
          ) : null}

          {renders.length > 1 ? (
            <div className="render-history">
              {renders.map((render) => (
                <button key={render.id} type="button" className={render.id === activeId ? "is-active" : ""} onClick={() => setActiveId(render.id)}>
                  <img src={render.imageUrl} alt="" />
                  <span>{render.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="pro-field">
      <span>{label}</span>
      <input type="number" min={1.8} max={20} step={0.1} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="pro-range">
      <span>{label}</span>
      <output>{value}{suffix}</output>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function buildInteriorPrompt(input: {
  brief: string;
  roomType: string;
  width: number;
  depth: number;
  height: number;
  style: string;
  camera: string;
  lens: number;
  cameraTurn: number;
  light: number;
  lightDirection: number;
  windowView: string;
  furniture: InteriorCatalogItem[];
  change: string;
}) {
  const styleLabel = styles.find(([id]) => id === input.style)?.[1] ?? input.style;
  const cameraLabel = cameraPresets.find(([id]) => id === input.camera)?.[1] ?? input.camera;
  const viewLabel = windowViews.find(([id]) => id === input.windowView)?.[1] ?? input.windowView;
  return [
    input.change
      ? `Edit the supplied interior render. Change only this: ${input.change}. Keep the architecture, room proportions and all elements not mentioned in the edit unchanged.`
      : "Create a photorealistic, buildable architectural interior visualization.",
    `Room: ${input.roomType}, exact internal dimensions ${input.width} m × ${input.depth} m × ${input.height} m.`,
    `User direction: ${input.brief.trim()}`,
    `Interior style: ${styleLabel}.`,
    `Place and closely match the supplied catalog references: ${input.furniture.map((item) => item.prompt).join("; ") || "no fixed furniture references"}.`,
    `Camera: ${cameraLabel}, ${input.lens} mm architectural lens, horizontal turn ${input.cameraTurn} degrees, eye level 1.55 m. Keep vertical lines straight and show the complete usable room.`,
    `Lighting: daylight intensity ${input.light} percent, main light direction ${input.lightDirection} degrees, physically accurate indirect light and soft contact shadows.`,
    `Windows: clearly show ${viewLabel} outside, with believable glass reflections and weather light entering the room.`,
    "Respect real furniture scale, walking clearances, doors, windows and construction logic. No fisheye, no floating furniture, no text, no people, no watermark.",
  ].join("\n");
}

async function imageToReference(item: InteriorCatalogItem): Promise<ReferenceImageJobInput> {
  const source = item.referenceImage ?? item.image;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Не удалось загрузить референс «${item.title}».`);
  const blob = await response.blob();
  return blobToReference(blob, `${item.id}.jpg`);
}

async function fileToReference(file: File): Promise<ReferenceImageJobInput> {
  return blobToReference(file, file.name);
}

async function blobToReference(blob: Blob, filename: string): Promise<ReferenceImageJobInput> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < buffer.length; offset += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(offset, offset + 0x8000));
  }
  return {
    dataBase64: btoa(binary),
    mimeType: blob.type || "image/jpeg",
    filename,
    consentConfirmed: true,
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
