import { Download, History, LoaderCircle, Mic2, Play, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  createGenerationJob,
  fetchGenerationArtifact,
  refreshGenerationJob,
  type MediaGenerationOptions,
} from "../../api-client/generation";
import { useAuth } from "../../auth";
import { useLanguage } from "../../i18n";
import "../../../styles/immersive-apps.css";

type VoiceRender = {
  id: string;
  url: string;
  text: string;
  voice: string;
  speed: number;
  format: string;
  createdAt: Date;
};

const voices = [
  ["nova", "Nova", "мягкий"],
  ["alloy", "Alloy", "нейтральный"],
  ["onyx", "Onyx", "глубокий"],
  ["fable", "Fable", "выразительный"],
  ["shimmer", "Shimmer", "светлый"],
] as const;

export default function VoiceStudio() {
  const { isAuthenticated, user } = useAuth();
  const { language } = useLanguage();
  const urls = useRef<string[]>([]);
  const [text, setText] = useState(
    "Добро пожаловать в nomduchat. Опишите задачу, и мы соберем подходящий рабочий процесс."
  );
  const [voice, setVoice] = useState<(typeof voices)[number][0]>("shimmer");
  const [speed, setSpeed] = useState(1);
  const [format, setFormat] = useState("mp3");
  const [renders, setRenders] = useState<VoiceRender[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const generate = async () => {
    const currentText = text.trim();
    if (!currentText || busy) return;
    if (!isAuthenticated) {
      setError("Войдите в аккаунт, чтобы создать озвучку.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus("Создаю отдельную дорожку…");
    try {
      const response = await createGenerationJob({
        agentId: "voice",
        modality: "voice",
        prompt: currentText,
        options: { voice, speed, format } as MediaGenerationOptions,
        language,
        country: user?.country === "RU" ? "RU" : "KZ",
      });
      let job = response.job;
      for (let attempt = 0; attempt < 72 && (job.status === "queued" || job.status === "running"); attempt += 1) {
        setStatus(job.status === "queued" ? "Озвучка в очереди…" : "Записываю голос…");
        await wait(1800);
        job = (await refreshGenerationJob(job.id)).job;
      }
      if (job.status !== "succeeded") throw new Error("Не удалось завершить озвучку.");

      const blob = await fetchGenerationArtifact(job.id);
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      setRenders((current) => [{
        id: job.id,
        url,
        text: currentText,
        voice,
        speed,
        format,
        createdAt: new Date(),
      }, ...current]);
      setStatus("Новая дорожка готова");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Не удалось создать озвучку.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pro-studio-shell voice-pro">
      <div className="pro-studio-grid">
        <aside className="pro-control-panel">
          <header className="pro-panel-heading">
            <div>
              <p className="pro-overline">Voice lab</p>
              <h2>Новая дорожка из текущего текста</h2>
            </div>
            <Mic2 />
          </header>
          <label className="pro-field">
            <span>Текст диктора</span>
            <textarea rows={8} value={text} onChange={(event) => setText(event.target.value)} />
            <small>{text.trim().split(/\s+/).filter(Boolean).length} слов · {text.length} символов</small>
          </label>
          <div className="pro-field">
            <span>Голос</span>
            <div className="voice-picker">
              {voices.map(([id, title, description]) => (
                <button key={id} type="button" className={voice === id ? "is-active" : ""} onClick={() => setVoice(id)}>
                  <Volume2 />
                  <span><strong>{title}</strong><small>{description}</small></span>
                </button>
              ))}
            </div>
          </div>
          <label className="pro-range">
            <span>Скорость</span>
            <output>{speed.toFixed(2)}×</output>
            <input type="range" min={0.7} max={1.3} step={0.05} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
          </label>
          <label className="pro-field">
            <span>Формат</span>
            <select value={format} onChange={(event) => setFormat(event.target.value)}>
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
            </select>
          </label>
          <button type="button" className="pro-primary-button" disabled={busy || !text.trim()} onClick={() => void generate()}>
            {busy ? <LoaderCircle className="spin" /> : <Play />}
            Озвучить только этот текст
          </button>
          {status ? <p className="pro-status-line"><Sparkles />{status}</p> : null}
          {error ? <p className="pro-error">{error}</p> : null}
        </aside>

        <div className="pro-result-panel">
          <header className="pro-result-heading">
            <div>
              <p className="pro-overline">История озвучек</p>
              <h2>{renders.length ? `${renders.length} ${pluralTrack(renders.length)}` : "Дорожки появятся здесь"}</h2>
            </div>
            <History />
          </header>

          {renders.length ? (
            <div className="voice-history">
              {renders.map((render, index) => (
                <article key={render.id} className={index === 0 ? "is-latest" : ""}>
                  <div className="voice-track-head">
                    <div className="voice-track-index">{String(renders.length - index).padStart(2, "0")}</div>
                    <div>
                      <strong>{voices.find(([id]) => id === render.voice)?.[1] ?? render.voice}</strong>
                      <span>{render.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {render.speed.toFixed(2)}× · {render.format.toUpperCase()}</span>
                    </div>
                    {index === 0 ? <em>Новая</em> : null}
                  </div>
                  <audio controls preload="metadata" src={render.url} />
                  <p>{render.text}</p>
                  <div className="voice-track-actions">
                    <a href={render.url} download={`nomduchat-voice-${render.id}.${render.format}`}><Download />Скачать</a>
                    <button type="button" onClick={() => setText(render.text)}><RotateCcw />Вернуть текст в редактор</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="voice-empty">
              <div className="voice-wave">{Array.from({ length: 28 }, (_, index) => <i key={index} />)}</div>
              <strong>Каждая генерация будет отдельной</strong>
              <span>Старые записи не исчезнут и не попадут внутрь нового текста.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function pluralTrack(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return "дорожка";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "дорожки";
  return "дорожек";
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
