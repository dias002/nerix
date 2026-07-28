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
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router";
import {
  createGenerationJob,
  fetchGenerationArtifact,
  refreshGenerationJob,
  type ImageMaskJobInput,
  type MediaGenerationOptions,
  type ReferenceImageJobInput,
} from "../../api-client/generation";
import { useAuth } from "../../auth";
import { useLanguage } from "../../i18n";
import InteriorCatalog from "./InteriorCatalog";
import {
  interiorCatalog,
  maxInteriorSelection,
  readInteriorCart,
  saveInteriorCart,
  type InteriorCartLine,
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

type EditTarget = "furniture" | "walls" | "light" | "window" | "decor";
type EditScope = "scene" | "region";
type EditRegion = { x: number; y: number; width: number; height: number };
type SelectedInteriorItem = { item: InteriorCatalogItem; quantity: number };

const editTargets: Array<{ id: EditTarget; label: string }> = [
  { id: "furniture", label: "Мебель" },
  { id: "walls", label: "Стены" },
  { id: "light", label: "Свет" },
  { id: "window", label: "Окно" },
  { id: "decor", label: "Декор" },
];

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

export default function InteriorDesignStudio({ catalogOnly = false }: { catalogOnly?: boolean }) {
  const { isAuthenticated, user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const urls = useRef<string[]>([]);
  const editStart = useRef<{ x: number; y: number } | null>(null);
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
  const [cart, setCart] = useState(readInteriorCart);
  const [roomReference, setRoomReference] = useState<RoomReference | null>(null);
  const [renders, setRenders] = useState<InteriorRender[]>([]);
  const [activeId, setActiveId] = useState("");
  const [change, setChange] = useState("");
  const [editTarget, setEditTarget] = useState<EditTarget>("furniture");
  const [editScope, setEditScope] = useState<EditScope>("scene");
  const [editRegion, setEditRegion] = useState<EditRegion | null>(null);
  const [editCapability, setEditCapability] = useState<"mask" | "reference" | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const activeRender = renders.find((item) => item.id === activeId) ?? renders[0] ?? null;
  const cartItems = useMemo(() => cart.flatMap((line) => {
    const item = interiorCatalog.find((candidate) => candidate.id === line.id);
    return item ? [{ item, quantity: line.quantity }] : [];
  }), [cart]);
  const selectedItems = useMemo(() => cartItems.map((line) => line.item), [cartItems]);

  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  useEffect(() => saveInteriorCart(cart), [cart]);

  const addFurniture = (id: string) => {
    setError("");
    setCart((current) => {
      const existing = current.find((line) => line.id === id);
      if (existing) {
        return current.map((line) => line.id === id ? { ...line, quantity: Math.min(9, line.quantity + 1) } : line);
      }
      if (current.length >= maxInteriorSelection) {
        setError(`Можно передать модели до ${maxInteriorSelection} предметов за одну генерацию.`);
        return current;
      }
      return [...current, { id, quantity: 1 }];
    });
  };

  const decrementFurniture = (id: string) => {
    setCart((current) => current.flatMap((line) => {
      if (line.id !== id) return [line];
      return line.quantity > 1 ? [{ ...line, quantity: line.quantity - 1 }] : [];
    }));
    setError("");
  };

  const removeFurniture = (id: string) => {
    setCart((current) => current.filter((line) => line.id !== id));
    setError("");
  };

  const clearFurniture = () => {
    setCart([]);
    setError("");
  };

  const editPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const startEditRegion = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (editScope !== "region" || !activeRender || busy) return;
    const point = editPoint(event);
    editStart.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    setEditRegion({ ...point, width: 0, height: 0 });
  };

  const moveEditRegion = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editStart.current || editScope !== "region") return;
    setEditRegion(regionBetween(editStart.current, editPoint(event)));
  };

  const finishEditRegion = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editStart.current) return;
    const region = regionBetween(editStart.current, editPoint(event));
    editStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setEditRegion(region.width >= 0.02 && region.height >= 0.02 ? region : null);
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
    if (mode === "edit" && editScope === "region" && !editRegion) {
      setError("Нарисуйте прямоугольную область на изображении или выберите всю сцену.");
      return;
    }

    setBusy(true);
    setError("");
    setEditCapability(null);
    setStatus(mode === "edit" ? "Готовлю новую версию…" : "Собираю комнату и референсы…");

    try {
      const referenceLimit = roomReference ? 3 : 4;
      const references = await Promise.all(
        selectedItems
          .filter((item) => item.referenceImage)
          .slice(0, referenceLimit)
          .map((item) => imageToReference(item))
      );
      if (roomReference) {
        const { preview: _preview, ...reference } = roomReference;
        references.unshift(reference);
      }
      const maskImage = mode === "edit" && editScope === "region" && editRegion && activeRender
        ? await createRegionMask(activeRender.imageUrl, editRegion)
        : undefined;

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
          furniture: cartItems,
          change: mode === "edit" ? change.trim() : "",
          editTarget,
          editScope,
          editRegion,
        }),
        imageReferenceJobId: mode === "edit" ? activeRender?.jobId : undefined,
        referenceImages: references.length ? references : undefined,
        editRegion: mode === "edit" && editScope === "region" ? editRegion ?? undefined : undefined,
        maskImage,
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
      if (mode === "edit" && maskImage) {
        const imageEdit = readImageEditMetadata(job.metadata);
        setEditCapability(imageEdit?.maskApplied === true ? "mask" : "reference");
      }

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

  if (catalogOnly) {
    return (
      <InteriorCatalog
        items={interiorCatalog}
        cart={cart}
        maxSelected={maxInteriorSelection}
        error={error}
        onAdd={addFurniture}
        onDecrement={decrementFurniture}
        onRemove={removeFurniture}
        onClear={clearFurniture}
        onDone={() => navigate("/workspace/apps/interior")}
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
                  navigate("/workspace/apps/interior/catalog");
                }}
              >
                <Armchair />
                Открыть каталог
              </button>
            </div>
            <div className="selected-furniture">
              {cartItems.map(({ item, quantity }) => (
                <button key={item.id} type="button" onClick={() => removeFurniture(item.id)}>
                  <img src={item.image} alt="" />
                  <span>{item.title}{quantity > 1 ? ` · ${quantity} шт.` : ""}</span>
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

          <div
            className={`interior-render-stage ${editScope === "region" && activeRender ? "is-selecting-region" : ""}`}
            onPointerDown={startEditRegion}
            onPointerMove={moveEditRegion}
            onPointerUp={finishEditRegion}
            onPointerCancel={finishEditRegion}
          >
            {activeRender ? (
              <>
                <img src={activeRender.imageUrl} alt="Сгенерированный интерьер" draggable={false} />
                {editScope === "region" && editRegion ? (
                  <span
                    className="interior-edit-region"
                    style={{
                      left: `${editRegion.x * 100}%`,
                      top: `${editRegion.y * 100}%`,
                      width: `${editRegion.width * 100}%`,
                      height: `${editRegion.height * 100}%`,
                    }}
                  />
                ) : null}
                {editScope === "region" ? (
                  <span className="interior-edit-hint">
                    {editRegion ? "Область изменения" : "Проведите по изображению, чтобы выделить область"}
                  </span>
                ) : null}
              </>
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
                <details className="interior-edit-settings">
                  <summary>
                    <Move3D />
                    Область и тип изменения
                  </summary>
                  <div className="interior-edit-settings-body">
                    <div className="pro-field">
                      <span>Что меняем</span>
                      <div className="interior-edit-targets">
                        {editTargets.map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            className={editTarget === target.id ? "is-active" : ""}
                            onClick={() => setEditTarget(target.id)}
                          >
                            {target.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="pro-field">
                      <span>Где меняем</span>
                      <div className="interior-edit-scope">
                        <button
                          type="button"
                          className={editScope === "scene" ? "is-active" : ""}
                          onClick={() => {
                            setEditScope("scene");
                            setEditRegion(null);
                          }}
                        >
                          Вся сцена
                        </button>
                        <button
                          type="button"
                          className={editScope === "region" ? "is-active" : ""}
                          onClick={() => setEditScope("region")}
                        >
                          Выделенная область
                        </button>
                      </div>
                      {editScope === "region" ? (
                        <>
                          <small>Закройте настройки и нарисуйте прямоугольник прямо на предыдущем рендере.</small>
                          {editCapability === "reference" ? (
                            <p className="interior-edit-capability is-fallback">
                              Точная область недоступна, используется reference edit.
                            </p>
                          ) : editCapability === "mask" ? (
                            <p className="interior-edit-capability">
                              Точная область применена через PNG mask.
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                </details>
                <button
                  type="button"
                  disabled={busy || !change.trim() || (editScope === "region" && !editRegion)}
                  onClick={() => void generate("edit")}
                >
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
  furniture: SelectedInteriorItem[];
  change: string;
  editTarget: EditTarget;
  editScope: EditScope;
  editRegion: EditRegion | null;
}) {
  const styleLabel = styles.find(([id]) => id === input.style)?.[1] ?? input.style;
  const cameraLabel = cameraPresets.find(([id]) => id === input.camera)?.[1] ?? input.camera;
  const viewLabel = windowViews.find(([id]) => id === input.windowView)?.[1] ?? input.windowView;
  const targetLabel = editTargets.find((target) => target.id === input.editTarget)?.label ?? input.editTarget;
  const regionRule = input.editScope === "region" && input.editRegion
    ? `Edit only normalized region x=${input.editRegion.x.toFixed(3)}, y=${input.editRegion.y.toFixed(3)}, width=${input.editRegion.width.toFixed(3)}, height=${input.editRegion.height.toFixed(3)}. Coordinates use the supplied image with top-left origin and values from 0 to 1. Outside this rectangle preserve the source image pixel composition and every object exactly.`
    : "Apply the requested change to the whole scene, but preserve all architecture and composition not explicitly mentioned.";
  const editRules = input.change ? [
    `Edit target: ${targetLabel}.`,
    regionRule,
    "Invariant: preserve the exact room geometry, wall openings, floor plan, camera position, lens, perspective, crop and image dimensions.",
    "Invariant: do not move, resize, recolor, remove or add objects outside the requested target and scope.",
    "Keep lighting continuity and realistic contact shadows at the boundary of the edited region.",
  ] : [];
  return [
    input.change
      ? `Edit the supplied previous interior render. Requested change: ${input.change}.`
      : "Create a photorealistic, buildable architectural interior visualization.",
    `Room: ${input.roomType}, exact internal dimensions ${input.width} m × ${input.depth} m × ${input.height} m.`,
    `User direction: ${input.brief.trim()}`,
    `Interior style: ${styleLabel}.`,
    `Place and closely match the supplied catalog selection: ${input.furniture.map(({ item, quantity }) => `${quantity} × ${item.prompt}`).join("; ") || "no fixed furniture references"}.`,
    `Camera: ${cameraLabel}, ${input.lens} mm architectural lens, horizontal turn ${input.cameraTurn} degrees, eye level 1.55 m. Keep vertical lines straight and show the complete usable room.`,
    `Lighting: daylight intensity ${input.light} percent, main light direction ${input.lightDirection} degrees, physically accurate indirect light and soft contact shadows.`,
    `Windows: clearly show ${viewLabel} outside, with believable glass reflections and weather light entering the room.`,
    ...editRules,
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function regionBetween(start: { x: number; y: number }, end: { x: number; y: number }): EditRegion {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

async function createRegionMask(imageUrl: string, region: EditRegion): Promise<ImageMaskJobInput> {
  const image = new Image();
  image.src = imageUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Не удалось подготовить маску области.");

  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.clearRect(
    Math.round(region.x * canvas.width),
    Math.round(region.y * canvas.height),
    Math.max(1, Math.round(region.width * canvas.width)),
    Math.max(1, Math.round(region.height * canvas.height))
  );

  const dataUrl = canvas.toDataURL("image/png");
  return {
    dataBase64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mimeType: "image/png",
    filename: "nomduchat-interior-mask.png",
  };
}

function readImageEditMetadata(metadata: Record<string, unknown>) {
  const value = metadata.imageEdit;
  return value && typeof value === "object"
    ? value as { maskApplied?: boolean; maskSupported?: boolean; mode?: string }
    : null;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
