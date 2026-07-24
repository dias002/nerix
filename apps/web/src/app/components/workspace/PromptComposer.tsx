import type { KeyboardEvent, ReactNode } from "react";
import { Mic, Paperclip, Send } from "lucide-react";

type PromptComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled?: boolean;
  modeLabel?: string;
  submitLabel?: string;
  footer?: ReactNode;
  onAttach?: () => void;
  onVoice?: () => void;
  isListening?: boolean;
};

export default function PromptComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false,
  modeLabel = "Авто",
  submitLabel = "Отправить",
  footer,
  onAttach,
  onVoice,
  isListening = false,
}: PromptComposerProps) {
  const canSubmit = value.trim().length > 0 && !disabled;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <form
      className="ns-prompt-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <div className="flex min-h-16 items-end gap-2 p-2">
        {onAttach ? (
          <button
            type="button"
            onClick={onAttach}
            className="ns-shell-button h-11 w-11 shrink-0 rounded-[var(--radius-input)]"
            aria-label="Прикрепить файл"
          >
            <Paperclip className="h-5 w-5" strokeWidth={1.8} />
          </button>
        ) : null}

        <label className="sr-only" htmlFor="workspace-prompt-composer">
          Запрос
        </label>
        <textarea
          id="workspace-prompt-composer"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-[15px] leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
        />

        <div className="hidden h-11 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--line-subtle)] bg-[var(--surface-2)] px-3 text-xs font-medium text-[var(--text-secondary)] sm:flex">
          <span className="ns-signal-dot" />
          {modeLabel}
        </div>

        {onVoice ? (
          <button
            type="button"
            onClick={onVoice}
            className="ns-shell-button h-11 w-11 shrink-0 rounded-[var(--radius-input)]"
            aria-label={isListening ? "Остановить голосовой ввод" : "Голосовой ввод"}
            aria-pressed={isListening}
          >
            <Mic className="h-5 w-5" strokeWidth={1.8} />
          </button>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-input)] bg-[var(--primary-button)] text-[var(--primary-button-text)] transition-[background-color,transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:-translate-y-px hover:bg-[var(--primary-button-hover)] active:translate-y-0 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45"
          aria-label={submitLabel}
        >
          <Send className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>

      {footer ? <div className="border-t border-[var(--line-subtle)] px-4 py-3">{footer}</div> : null}
    </form>
  );
}
