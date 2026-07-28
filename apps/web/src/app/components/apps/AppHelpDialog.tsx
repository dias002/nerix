import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { AppHelpContent } from "./appHelpContent";
import "../../../styles/app-help.css";

type AppHelpDialogProps = {
  appName: string;
  content: AppHelpContent;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function AppHelpDialog({ appName, content }: AppHelpDialogProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (items.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="app-help-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <section
              ref={dialogRef}
              className="app-help-dialog custom-scrollbar"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              tabIndex={-1}
            >
              <header className="app-help-dialog-head">
                <div>
                  <p className="app-help-kicker">Справка по приложению</p>
                  <h2 id={titleId}>Как работать в «{appName}»</h2>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  className="app-help-close"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть справку"
                >
                  <X className="h-5 w-5" strokeWidth={1.8} />
                </button>
              </header>

              <p id={descriptionId} className="app-help-description">
                {content.description}
              </p>

              <div className="app-help-result">
                <h3>Что вы получите</h3>
                <p>{content.result}</p>
              </div>

              <div className="app-help-steps">
                <h3>Базовый сценарий</h3>
                <ol>
                  {content.steps.map((step, index) => (
                    <li key={step}>
                      <span aria-hidden="true">{index + 1}</span>
                      <p>{step}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {content.tip ? (
                <div className="app-help-tip">
                  <strong>Полезно знать</strong>
                  <p>{content.tip}</p>
                </div>
              ) : null}

              <div className="app-help-footer">
                <button type="button" className="nd-primary-action app-help-done" onClick={() => setOpen(false)}>
                  Понятно
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="app-help-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Справка о приложении ${appName}`}
        title="Как пользоваться"
      >
        <span aria-hidden="true">?</span>
      </button>
      {dialog}
    </>
  );
}
