import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router";
import { BriefcaseBusiness, ChevronLeft, MessageSquarePlus, Orbit, PanelLeftClose } from "lucide-react";
import type { WorkspaceFeatureStatus } from "../../roleAccess";

export type WorkspaceNavItem = {
  path: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  visible: boolean;
  active?: () => boolean;
  featureStatus?: WorkspaceFeatureStatus;
};

export type WorkspaceNavSection = {
  id: string;
  label: string;
  items: WorkspaceNavItem[];
};

export default function WorkspaceSidebar({
  collapsed,
  product,
  showBusinessBrand,
  canCreateTask,
  sections,
  quickItems = [],
  businessItems = [],
  usageSlot,
  roleSlot,
  profileSlot,
  isActive,
  onCollapsedChange,
}: {
  collapsed: boolean;
  product: string;
  showBusinessBrand: boolean;
  canCreateTask: boolean;
  sections: WorkspaceNavSection[];
  quickItems?: WorkspaceNavItem[];
  businessItems?: WorkspaceNavItem[];
  usageSlot?: ReactNode;
  roleSlot?: ReactNode;
  profileSlot?: ReactNode;
  isActive: (item: WorkspaceNavItem) => boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const visibleItems = sections.flatMap((section) => section.items.filter((item) => item.visible));
  const visibleQuickItems = quickItems.filter((item) => item.visible);
  const visibleBusinessItems = businessItems.filter((item) => item.visible);
  const quickPaletteRef = useRef<HTMLDivElement | null>(null);
  const quickPaletteDragStartRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startX: number;
    startY: number;
    hasMoved: boolean;
  } | null>(null);
  const [isQuickPaletteOpen, setIsQuickPaletteOpen] = useState(false);
  const [quickPaletteOffset, setQuickPaletteOffset] = useState({ x: 0, y: -14 });
  const quickPaletteOffsetRef = useRef({ x: 0, y: -14 });
  const [isQuickPaletteDragging, setIsQuickPaletteDragging] = useState(false);
  const quickPalettePointerMovedRef = useRef(false);
  const quickPalettePointerIdRef = useRef<number | null>(null);
  const quickPaletteIgnoreClickRef = useRef(false);
  const QUICK_PALETTE_DRAG_THRESHOLD_PX = 6;
  const QUICK_PALETTE_OFFSET_KEY = "workspace.quick-palette.offset.v1";

  useEffect(() => {
    try {
      const savedOffset = window.localStorage.getItem(QUICK_PALETTE_OFFSET_KEY);
      if (savedOffset) {
        const parsed = JSON.parse(savedOffset) as typeof quickPaletteOffset;
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setQuickPaletteOffset(parsed);
        }
      }
    } catch {
      // Ignore storage issues, defaults are enough.
    }
    quickPaletteOffsetRef.current = quickPaletteOffset;

    const onPointerDown = (event: MouseEvent) => {
      if (!quickPaletteRef.current?.contains(event.target as Node)) {
        setIsQuickPaletteOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsQuickPaletteOpen(false);
      }
    };

    window.document.addEventListener("pointerdown", onPointerDown);
    window.document.addEventListener("keydown", onKeyDown);

    return () => {
      window.document.removeEventListener("pointerdown", onPointerDown);
      window.document.removeEventListener("keydown", onKeyDown);
      if (isQuickPaletteDragging) {
        setIsQuickPaletteDragging(false);
      }
      quickPaletteDragStartRef.current = null;
      window.removeEventListener("pointermove", onQuickPalettePointerMove);
      window.removeEventListener("pointerup", onQuickPalettePointerUpNative);
      window.removeEventListener("pointercancel", onQuickPalettePointerCancel);
      if (quickPalettePointerIdRef.current !== null) {
        quickPaletteRef.current?.releasePointerCapture?.(quickPalettePointerIdRef.current);
        quickPalettePointerIdRef.current = null;
      }
    };
  }, []);

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const closeQuickPalette = () => {
    setIsQuickPaletteOpen(false);
  };

  const toggleQuickPalette = () => {
    if (quickPalettePointerMovedRef.current) {
      quickPalettePointerMovedRef.current = false;
      return;
    }

    setIsQuickPaletteOpen((current) => !current);
  };

  const onQuickPalettePointerMove = (event: globalThis.PointerEvent) => {
    if (!quickPaletteDragStartRef.current) {
      return;
    }
    if (event.pointerId !== quickPalettePointerIdRef.current) {
      return;
    }

    const start = quickPaletteDragStartRef.current;
    const movedDistance = Math.hypot(event.clientX - start.startX, event.clientY - start.startY);
    if (movedDistance >= QUICK_PALETTE_DRAG_THRESHOLD_PX) {
      if (!start.hasMoved) {
        setIsQuickPaletteDragging(true);
      }
      quickPaletteDragStartRef.current.hasMoved = true;
      quickPalettePointerMovedRef.current = true;
    }

    const nextX = clamp(start.originX + (event.clientX - start.startX), -20, 48);
    const nextY = clamp(start.originY + (event.clientY - start.startY), -24, 56);

    setQuickPaletteOffset({ x: nextX, y: nextY });
    quickPaletteOffsetRef.current = { x: nextX, y: nextY };
  };

  const onQuickPalettePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    onQuickPalettePointerUpNative(event.nativeEvent);
  };

  const onQuickPalettePointerUpNative = (event: globalThis.PointerEvent) => {
    if (event.pointerId !== quickPalettePointerIdRef.current) {
      return;
    }

    if (!quickPaletteDragStartRef.current) {
      if (quickPalettePointerIdRef.current !== null) {
        quickPalettePointerIdRef.current = null;
      }

      window.removeEventListener("pointermove", onQuickPalettePointerMove);
      window.removeEventListener("pointerup", onQuickPalettePointerUpNative);
      window.removeEventListener("pointercancel", onQuickPalettePointerCancel);
      return;
    }

    const hasMoved = quickPaletteDragStartRef.current?.hasMoved ?? false;
    quickPaletteDragStartRef.current = null;
    quickPalettePointerIdRef.current = null;

    window.removeEventListener("pointermove", onQuickPalettePointerMove);
    window.removeEventListener("pointerup", onQuickPalettePointerUpNative);
    window.removeEventListener("pointercancel", onQuickPalettePointerCancel);
    setIsQuickPaletteDragging(false);

    try {
      window.localStorage.setItem(QUICK_PALETTE_OFFSET_KEY, JSON.stringify(quickPaletteOffsetRef.current));
    } catch {
      // Ignore storage issues.
    }

    const shouldToggle = !hasMoved && !quickPalettePointerMovedRef.current;
    quickPalettePointerMovedRef.current = false;
    if (shouldToggle) {
      quickPaletteIgnoreClickRef.current = true;
      setIsQuickPaletteOpen((current) => !current);
      window.setTimeout(() => {
        quickPaletteIgnoreClickRef.current = false;
      }, 0);
    }
  };

  const onQuickPalettePointerCancel = (event: globalThis.PointerEvent) => {
    if (event.pointerId !== quickPalettePointerIdRef.current) {
      return;
    }

    if (quickPalettePointerIdRef.current !== null) {
      quickPalettePointerIdRef.current = null;
    }

    window.removeEventListener("pointermove", onQuickPalettePointerMove);
    window.removeEventListener("pointerup", onQuickPalettePointerUpNative);
    window.removeEventListener("pointercancel", onQuickPalettePointerCancel);
    quickPaletteDragStartRef.current = null;
    setIsQuickPaletteDragging(false);
    quickPalettePointerMovedRef.current = false;

    try {
      window.localStorage.setItem(QUICK_PALETTE_OFFSET_KEY, JSON.stringify(quickPaletteOffsetRef.current));
    } catch {
      // Ignore storage issues.
    }
  };

  useEffect(() => {
    quickPaletteOffsetRef.current = quickPaletteOffset;
  }, [quickPaletteOffset]);

  useEffect(() => {
    if (collapsed) {
      setIsQuickPaletteOpen(false);
      setIsQuickPaletteDragging(false);
      quickPalettePointerMovedRef.current = false;
      quickPaletteDragStartRef.current = null;
      window.removeEventListener("pointermove", onQuickPalettePointerMove);
      window.removeEventListener("pointerup", onQuickPalettePointerUpNative);
      window.removeEventListener("pointercancel", onQuickPalettePointerCancel);
    }
  }, [collapsed, onQuickPalettePointerMove, onQuickPalettePointerUpNative]);

  const onQuickPalettePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    if (quickPaletteDragStartRef.current) {
      return;
    }

    quickPaletteDragStartRef.current = {
      pointerId: event.pointerId,
      originX: quickPaletteOffset.x,
      originY: quickPaletteOffset.y,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
    };
    quickPalettePointerIdRef.current = event.pointerId;
    quickPalettePointerMovedRef.current = false;

    setIsQuickPaletteDragging(false);
    window.addEventListener("pointermove", onQuickPalettePointerMove);
      window.addEventListener("pointerup", onQuickPalettePointerUpNative);
    window.addEventListener("pointercancel", onQuickPalettePointerCancel);
  };

  const quickPalette = (
    <div
      ref={quickPaletteRef}
      className={`ns-sidebar-quick-palette ${isQuickPaletteOpen ? "is-open" : ""}`}
      aria-label="Быстрые разделы"
      style={{ transform: `translate(${quickPaletteOffset.x}px, ${quickPaletteOffset.y}px)` }}
    >
      <button
        type="button"
        className="ns-sidebar-quick-palette-trigger"
        data-dragging={isQuickPaletteDragging ? "true" : "false"}
        title="Перетащить и открыть быстрый доступ"
        onPointerDown={onQuickPalettePointerDown}
        onPointerUp={onQuickPalettePointerUp}
        onClick={() => {
          if (quickPaletteIgnoreClickRef.current) {
            quickPaletteIgnoreClickRef.current = false;
            return;
          }
          toggleQuickPalette();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleQuickPalette();
          }
        }}
        aria-expanded={isQuickPaletteOpen}
        aria-label="Быстрый переход"
      >
        <Orbit className="h-5 w-5" strokeWidth={1.9} />
      </button>
      {isQuickPaletteOpen ? (
        <div className="ns-sidebar-quick-palette-menu custom-scrollbar" role="menu">
          {visibleQuickItems.map((item) => {
            const Icon = item.icon;
            const isItemActive = isActive(item);

            return (
            <Link
              key={item.path}
              to={item.path}
              className={`ns-sidebar-quick-palette-item ${isItemActive ? "is-active" : ""}`}
              aria-label={item.label}
              aria-current={isItemActive ? "page" : undefined}
              title={item.label}
              onClick={closeQuickPalette}
              role="menuitem"
            >
              <Icon className="h-5 w-5" strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.featureStatus === "beta" ? (
                <span className="ns-sidebar-quick-palette-item-badge" aria-label="В разработке">
                  Beta
                </span>
              ) : null}
            </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );

  return (
    <aside className="ns-sidebar custom-scrollbar" data-collapsed={collapsed ? "true" : "false"}>
      <div className="ns-sidebar-brand">
        {collapsed ? (
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--surface-1)] text-[var(--text-primary)] transition-colors hover:border-[var(--line-default)]"
            aria-label="Показать меню"
            title="Показать меню"
          >
            <img src="/favicon.png" alt="" className="h-6 w-6 rounded-md object-cover" />
          </button>
        ) : (
          <>
            <Link
              to="/"
              className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 text-xl font-medium tracking-[-0.025em] text-[var(--text-primary)]"
            >
              <img src="/favicon.png" alt="" className="row-span-2 h-8 w-8 rounded-lg border border-[var(--line-subtle)] object-cover" />
              <span className="truncate leading-none">{product}</span>
              {showBusinessBrand ? <span className="ns-sidebar-badge mt-1 w-fit">Business</span> : null}
            </Link>
            <button
              type="button"
              onClick={() => onCollapsedChange(true)}
              className="ns-shell-button h-9 w-9 shrink-0 p-0"
              aria-label="Скрыть меню"
              title="Скрыть меню"
            >
              <PanelLeftClose className="h-5 w-5" strokeWidth={1.6} />
            </button>
          </>
        )}
      </div>

      {canCreateTask ? (
        <div className="px-3 pb-3">
          <Link
            to="/workspace/chat?new=1"
            className={`nd-primary-action flex h-[46px] items-center justify-center gap-2 px-3 text-sm font-medium ${
              collapsed ? "w-11 px-0" : "w-full"
            }`}
            aria-label="Новая задача"
            title="Новая задача"
          >
            <MessageSquarePlus className="h-4 w-4" strokeWidth={1.8} />
            {!collapsed ? <span>Новая задача</span> : null}
          </Link>
        </div>
      ) : null}

      {collapsed ? (
        <nav className="flex-1 px-3 py-2" aria-label="Рабочие разделы">
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className="ns-sidebar-icon-only"
                    data-active={active ? "true" : "false"}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.7} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : (
        <nav className="flex-1 px-3 py-2" aria-label="Рабочие разделы">
          {sections.map((section) => {
            const items = section.items.filter((item) => item.visible);
            if (items.length === 0) return null;

            return (
              <section key={section.id} className="ns-sidebar-section">
                <div className="ns-sidebar-section-label ns-overline">{section.label}</div>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);

                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className="ns-sidebar-item"
                          data-active={active ? "true" : "false"}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.7} />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{item.label}</span>
                            {item.featureStatus === "beta" ? (
                              <span className="ns-sidebar-item-badge" aria-label="В разработке">
                                Beta
                              </span>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </nav>
      )}

      <div className="ns-sidebar-scroll custom-scrollbar">
        {!collapsed ? usageSlot : null}
        {!collapsed ? roleSlot : null}
      </div>

      {!collapsed ? (
        <div className="ns-sidebar-footer">
          {visibleBusinessItems.length > 0 || visibleQuickItems.length > 0 ? (
            <div className="ns-sidebar-bottom-palettes">
              {visibleBusinessItems.length > 0 ? (
                <SidebarBusinessPalette items={visibleBusinessItems} isActive={isActive} />
              ) : null}
              {visibleQuickItems.length > 0 ? quickPalette : null}
            </div>
          ) : null}
          {profileSlot}
          <button
            type="button"
            onClick={() => onCollapsedChange(true)}
            className="ns-sidebar-mobile-collapse"
            aria-label="Скрыть меню"
            title="Скрыть меню"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function SidebarBusinessPalette({
  items,
  isActive,
}: {
  items: WorkspaceNavItem[];
  isActive: (item: WorkspaceNavItem) => boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.document.addEventListener("pointerdown", onPointerDown);
    window.document.addEventListener("keydown", onKeyDown);
    return () => {
      window.document.removeEventListener("pointerdown", onPointerDown);
      window.document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`ns-sidebar-quick-palette ns-sidebar-business-palette ${open ? "is-open" : ""}`}
      aria-label="Бизнес-разделы"
    >
      <button
        type="button"
        className="ns-sidebar-quick-palette-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Бизнес-разделы"
        title="Бизнес-разделы"
      >
        <BriefcaseBusiness className="h-5 w-5" strokeWidth={1.9} />
      </button>
      {open ? (
        <div className="ns-sidebar-quick-palette-menu custom-scrollbar" role="menu">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
            <Link
              key={item.path}
              to={item.path}
              className={`ns-sidebar-quick-palette-item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <Icon className="h-5 w-5" strokeWidth={1.7} />
              <span>{item.label}</span>
            </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
