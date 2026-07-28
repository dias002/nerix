import { Check, Copy, RotateCcw, SlidersHorizontal, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { sendChatMessage } from "../../api-client/chat";
import { useAuth } from "../../auth";
import { useLanguage } from "../../i18n";

const tones = [
  { id: "natural", label: "Естественный" },
  { id: "friendly", label: "Дружелюбный" },
  { id: "expert", label: "Экспертный" },
  { id: "confident", label: "Уверенный" },
] as const;

const audiences = ["Широкая аудитория", "Клиенты", "Коллеги", "Руководители", "Соцсети"];

export default function HumanizerStudio() {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [source, setSource] = useState("");
  const [result, setResult] = useState("");
  const [tone, setTone] = useState<(typeof tones)[number]["id"]>("natural");
  const [audience, setAudience] = useState(audiences[0]);
  const [warmth, setWarmth] = useState(64);
  const [formality, setFormality] = useState(42);
  const [length, setLength] = useState(100);
  const [preserveFacts, setPreserveFacts] = useState(true);
  const [removeCliches, setRemoveCliches] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sourceStats = useMemo(() => textStats(source), [source]);
  const resultStats = useMemo(() => textStats(result), [result]);

  const run = async () => {
    if (!source.trim() || busy) return;
    if (!isAuthenticated) {
      setError("Войдите в аккаунт, чтобы обработать текст.");
      return;
    }

    setBusy(true);
    setError(null);
    setCopied(false);

    const toneLabel = tones.find((item) => item.id === tone)?.label ?? "Естественный";
    const prompt = [
      "Перепиши текст так, чтобы он звучал как работа живого автора.",
      `Голос текста: ${toneLabel}.`,
      `Аудитория: ${audience}.`,
      `Теплота: ${warmth} из 100.`,
      `Формальность: ${formality} из 100.`,
      `Целевая длина: примерно ${length}% от исходника.`,
      preserveFacts ? "Сохрани все факты, цифры, имена и причинно-следственные связи." : "Можно упрощать второстепенные детали.",
      removeCliches ? "Убери канцелярит, AI-клише, лишние вводные и неестественные перечисления." : "Не удаляй устойчивые формулировки без необходимости.",
      "Не объясняй правки и не добавляй комментарии. Верни только готовый текст с естественным ритмом и нормальными абзацами.",
      "",
      "Исходный текст:",
      source.trim(),
    ].join("\n");

    try {
      const response = await sendChatMessage({
        message: prompt,
        agentId: "general",
        selectedModelId: "openai:gpt-4o-mini",
        language,
      });
      setResult(response.assistantMessage?.content?.trim() || "Модель не вернула текст. Попробуйте ещё раз.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Не удалось обработать текст.");
    } finally {
      setBusy(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const reset = () => {
    setSource("");
    setResult("");
    setTone("natural");
    setAudience(audiences[0]);
    setWarmth(64);
    setFormality(42);
    setLength(100);
    setError(null);
  };

  return (
    <section className="app-studio-grid humanizer-studio">
      <div className="app-studio-panel">
        <div className="app-studio-panel-head">
          <div>
            <p className="ns-overline">Исходник</p>
            <h2>Текст и его голос</h2>
          </div>
          <button type="button" className="app-studio-icon-button" onClick={reset} aria-label="Сбросить настройки">
            <RotateCcw className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <label className="app-studio-field">
          <span>Текст</span>
          <textarea
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Вставьте черновик, письмо, пост или фрагмент статьи…"
            className="app-studio-textarea app-studio-textarea-large"
          />
          <small>{sourceStats.words} слов · {sourceStats.characters} знаков</small>
        </label>

        <div className="app-studio-control-group">
          <div className="app-studio-control-title">
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
            Голос
          </div>
          <div className="app-studio-segmented">
            {tones.map((item) => (
              <button
                key={item.id}
                type="button"
                data-active={tone === item.id ? "true" : "false"}
                onClick={() => setTone(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="app-studio-two-columns">
          <label className="app-studio-field">
            <span>Аудитория</span>
            <select value={audience} onChange={(event) => setAudience(event.target.value)}>
              {audiences.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="app-studio-field">
            <span>Длина результата</span>
            <select value={length} onChange={(event) => setLength(Number(event.target.value))}>
              <option value={70}>Короче · 70%</option>
              <option value={100}>Как исходник · 100%</option>
              <option value={120}>Подробнее · 120%</option>
            </select>
          </label>
        </div>

        <RangeControl label="Теплота" value={warmth} onChange={setWarmth} left="Сдержанно" right="Живо" />
        <RangeControl label="Формальность" value={formality} onChange={setFormality} left="Разговорно" right="Официально" />

        <div className="app-studio-checks">
          <CheckControl checked={preserveFacts} onChange={setPreserveFacts} label="Сохранять факты и цифры" />
          <CheckControl checked={removeCliches} onChange={setRemoveCliches} label="Убирать AI-клише и канцелярит" />
        </div>

        {error ? <p className="app-studio-error">{error}</p> : null}

        <button type="button" className="nd-primary-action app-studio-run" onClick={() => void run()} disabled={!source.trim() || busy}>
          <WandSparkles className="h-4 w-4" strokeWidth={1.8} />
          {busy ? "Настраиваю голос…" : "Сделать естественнее"}
        </button>
      </div>

      <div className="app-studio-panel app-studio-result-panel">
        <div className="app-studio-panel-head">
          <div>
            <p className="ns-overline">Результат</p>
            <h2>Готовая версия</h2>
          </div>
          {result ? (
            <button type="button" className="app-studio-copy" onClick={() => void copyResult()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Скопировано" : "Копировать"}
            </button>
          ) : null}
        </div>
        {result ? (
          <>
            <div className="app-studio-result-text">{result}</div>
            <p className="app-studio-result-meta">{resultStats.words} слов · {resultStats.characters} знаков</p>
          </>
        ) : (
          <div className="app-studio-empty-result">
            <span><WandSparkles className="h-5 w-5" strokeWidth={1.7} /></span>
            <h3>Результат появится здесь</h3>
            <p>Настройте голос, аудиторию и степень формальности. Исходный текст останется слева для сравнения.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function RangeControl({
  label,
  value,
  onChange,
  left,
  right,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  left: string;
  right: string;
}) {
  return (
    <label className="app-studio-range">
      <span><strong>{label}</strong><output>{value}</output></span>
      <input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <small><span>{left}</span><span>{right}</span></small>
    </label>
  );
}

function CheckControl({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="app-studio-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true">{checked ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : null}</span>
      {label}
    </label>
  );
}

function textStats(value: string) {
  return {
    words: value.trim() ? value.trim().split(/\s+/).length : 0,
    characters: value.length,
  };
}
