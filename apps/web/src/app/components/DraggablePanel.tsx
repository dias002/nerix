import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { GripHorizontal, RotateCcw } from "lucide-react";

type PanelPosition = {
  x: number;
  y: number;
};

type Viewport = {
  width: number;
  height: number;
};

type DraggablePanelProps = {
  storageKey: string;
  title: string;
  kicker?: string;
  children: ReactNode;
  className?: string;
  visibilityClassName?: string;
  defaultPosition?: PanelPosition | ((viewport: Viewport) => PanelPosition);
  width?: number;
  accent?: "orange" | "blue";
};

const defaultWidth = 320;

export default function DraggablePanel({
  storageKey,
  title,
  kicker,
  children,
  className = "",
  visibilityClassName = "hidden xl:block",
  defaultPosition = ({ width }) => ({ x: Math.max(24, width - defaultWidth - 24), y: 88 }),
  width = defaultWidth,
  accent = "orange",
}: DraggablePanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef(false);
  const pointerOffsetRef = useRef<PanelPosition>({ x: 0, y: 0 });
  const [position, setPosition] = useState<PanelPosition>(() => readPosition(storageKey, defaultPosition, width));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      if (!draggingRef.current) return;
      const next = clampPosition(
        {
          x: event.clientX - pointerOffsetRef.current.x,
          y: event.clientY - pointerOffsetRef.current.y,
        },
        width,
        panelRef.current?.offsetHeight,
      );
      setPosition(next);
    };

    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      setPosition((current) => {
        window.localStorage.setItem(storageKey, JSON.stringify(current));
        return current;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [storageKey, width]);

  useEffect(() => {
    const onResize = () => {
      setPosition((current) => clampPosition(current, width, panelRef.current?.offsetHeight));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [width]);

  const resetPosition = () => {
    const next = resolveDefaultPosition(defaultPosition);
    const clamped = clampPosition(next, width, panelRef.current?.offsetHeight);
    setPosition(clamped);
    window.localStorage.setItem(storageKey, JSON.stringify(clamped));
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setDragging(true);
    pointerOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  };

  return (
    <section
      ref={panelRef}
      className={`nd-floating-panel fixed z-30 max-h-[calc(100vh-6rem)] overflow-hidden text-white shadow-2xl shadow-black/50 ${visibilityClassName} ${dragging ? "select-none" : ""} ${className}`}
      style={{ left: position.x, top: position.y, width }}
    >
      <div
        className="nd-floating-handle flex cursor-grab items-center justify-between gap-3 border-b border-white/10 px-3 py-2 active:cursor-grabbing"
        onPointerDown={startDrag}
      >
        <div className="min-w-0">
          {kicker ? (
            <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${accent === "blue" ? "text-[var(--nd-blue)]" : "text-[var(--nd-orange)]"}`}>
              {kicker}
            </div>
          ) : null}
          <h2 className="truncate text-sm font-medium text-white">{title}</h2>
        </div>
        <div className="flex items-center gap-1 text-gray-500">
          <GripHorizontal className="h-4 w-4" strokeWidth={1.8} />
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10 hover:text-white"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={resetPosition}
            aria-label="Вернуть панель на место"
            title="Вернуть панель на место"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
      </div>
      <div className="custom-scrollbar max-h-[calc(100vh-10rem)] overflow-y-auto p-3">{children}</div>
    </section>
  );
}

function readPosition(
  storageKey: string,
  defaultPosition: DraggablePanelProps["defaultPosition"],
  width: number,
): PanelPosition {
  if (typeof window === "undefined") return { x: 24, y: 88 };

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<PanelPosition>;
      if (typeof stored.x === "number" && typeof stored.y === "number") {
        return clampPosition({ x: stored.x, y: stored.y }, width);
      }
    }
  } catch {
    window.localStorage.removeItem(storageKey);
  }

  return clampPosition(resolveDefaultPosition(defaultPosition), width);
}

function resolveDefaultPosition(defaultPosition: DraggablePanelProps["defaultPosition"]): PanelPosition {
  const viewport = getViewport();
  if (typeof defaultPosition === "function") return defaultPosition(viewport);
  return defaultPosition ?? { x: Math.max(24, viewport.width - defaultWidth - 24), y: 88 };
}

function clampPosition(position: PanelPosition, width: number, panelHeight = 360): PanelPosition {
  const viewport = getViewport();
  const minX = 16;
  const minY = 72;
  const maxX = Math.max(minX, viewport.width - width - 16);
  const maxY = Math.max(minY, viewport.height - panelHeight - 16);

  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}

function getViewport(): Viewport {
  if (typeof window === "undefined") return { width: 1440, height: 900 };
  return { width: window.innerWidth, height: window.innerHeight };
}
