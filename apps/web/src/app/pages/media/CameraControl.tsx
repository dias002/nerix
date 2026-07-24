import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Camera, Move3D } from "lucide-react";
import type { MediaGenerationOptions } from "../../api-client/generation";

export type CameraSettings = NonNullable<MediaGenerationOptions["camera"]>;

type CameraControlProps = {
  value: CameraSettings;
  onChange: (value: CameraSettings) => void;
};

const anglePresets: Array<{ label: string; yaw: number; pitch: number }> = [
  { label: "Фронт", yaw: 0, pitch: 0 },
  { label: "¾", yaw: 38, pitch: -6 },
  { label: "Снизу", yaw: 18, pitch: -28 },
  { label: "Сверху", yaw: -24, pitch: 34 },
];

export default function CameraControl({ value, onChange }: CameraControlProps) {
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    yaw: number;
    pitch: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const update = <Key extends keyof CameraSettings>(key: Key, next: CameraSettings[Key]) => {
    onChange({ ...value, [key]: next });
  };

  const updateAngles = (yaw: number, pitch: number) => {
    onChange({
      ...value,
      yaw: clamp(Math.round(yaw), -90, 90),
      pitch: clamp(Math.round(pitch), -45, 45),
    });
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      yaw: value.yaw,
      pitch: value.pitch,
    };
    setDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    updateAngles(
      current.yaw + (event.clientX - current.x) * 0.55,
      current.pitch - (event.clientY - current.y) * 0.42,
    );
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const moveWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 4;
    if (event.key === "ArrowLeft") updateAngles(value.yaw - step, value.pitch);
    else if (event.key === "ArrowRight") updateAngles(value.yaw + step, value.pitch);
    else if (event.key === "ArrowUp") updateAngles(value.yaw, value.pitch + step);
    else if (event.key === "ArrowDown") updateAngles(value.yaw, value.pitch - step);
    else return;
    event.preventDefault();
  };

  return (
    <section className="ns-camera-control">
      <div
        className="ns-camera-stage"
        data-dragging={dragging ? "true" : "false"}
        role="application"
        tabIndex={0}
        aria-label="Ракурс камеры. Перетаскивайте модель или используйте стрелки клавиатуры."
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onKeyDown={moveWithKeyboard}
      >
        <div className="ns-camera-orbit ns-camera-orbit-x" />
        <div className="ns-camera-orbit ns-camera-orbit-y" />
        <div
          className="ns-camera-object"
          style={{ transform: `rotateX(${-value.pitch}deg) rotateY(${value.yaw}deg)` }}
        >
          <span className="ns-camera-object-face ns-camera-object-front" />
          <span className="ns-camera-object-face ns-camera-object-side" />
          <span className="ns-camera-object-face ns-camera-object-top" />
        </div>
        <span
          className="ns-camera-marker"
          style={{ transform: `translate(${value.yaw * 0.42}px, ${value.pitch * -0.52}px)` }}
        >
          <Camera className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <span className="ns-camera-stage-label">
          <Move3D className="h-3.5 w-3.5" strokeWidth={1.8} />
          Потяните модель
        </span>
      </div>

      <div className="ns-camera-presets">
        {anglePresets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            data-active={value.yaw === preset.yaw && value.pitch === preset.pitch}
            onClick={() => onChange({ ...value, yaw: preset.yaw, pitch: preset.pitch })}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="ns-camera-sliders">
        <label>
          <span>Поворот</span>
          <input type="range" min="-90" max="90" value={value.yaw} onChange={(event) => update("yaw", Number(event.target.value))} />
        </label>
        <label>
          <span>Высота</span>
          <input type="range" min="-45" max="45" value={value.pitch} onChange={(event) => update("pitch", Number(event.target.value))} />
        </label>
      </div>

      <div className="ns-camera-selects">
        <label>
          <span>План</span>
          <select value={value.distance} onChange={(event) => update("distance", event.target.value as CameraSettings["distance"])}>
            <option value="macro">Макро</option>
            <option value="close">Крупный</option>
            <option value="medium">Средний</option>
            <option value="wide">Общий</option>
          </select>
        </label>
        <label>
          <span>Объектив</span>
          <select value={value.lens} onChange={(event) => update("lens", Number(event.target.value) as CameraSettings["lens"])}>
            {[24, 35, 50, 85].map((lens) => <option key={lens} value={lens}>{lens} мм</option>)}
          </select>
        </label>
        <label>
          <span>Движение</span>
          <select value={value.movement} onChange={(event) => update("movement", event.target.value as CameraSettings["movement"])}>
            <option value="static">Статично</option>
            <option value="push_in">Наезд</option>
            <option value="pull_out">Отъезд</option>
            <option value="orbit">Орбита</option>
            <option value="tracking">Слежение</option>
            <option value="crane">Кран</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
