import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  LoaderCircle,
  MonitorPlay,
  Plus,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { sendChatMessage } from "../../api-client/chat";
import { useAuth } from "../../auth";
import { useLanguage } from "../../i18n";
import "../../../styles/immersive-apps.css";

type DeckSlide = {
  title: string;
  subtitle: string;
  bullets: string[];
  notes: string;
  visual: string;
};

type Deck = {
  title: string;
  subtitle: string;
  slides: DeckSlide[];
};

const deckStyles = [
  ["executive", "Деловой"],
  ["editorial", "Редакционный"],
  ["minimal", "Минималистичный"],
  ["bold", "Контрастный"],
] as const;

export default function PresentationStudio() {
  const { isAuthenticated, user } = useAuth();
  const { language } = useLanguage();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("Руководители и заказчики");
  const [slideCount, setSlideCount] = useState(8);
  const [style, setStyle] = useState<(typeof deckStyles)[number][0]>("executive");
  const [speakerNotes, setSpeakerNotes] = useState(true);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!topic.trim() || busy) return;
    if (!isAuthenticated) {
      setError("Войдите в аккаунт, чтобы создать презентацию.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const styleName = deckStyles.find(([id]) => id === style)?.[1] ?? style;
      const prompt = [
        "Создай готовую презентацию и верни только валидный JSON без markdown и пояснений.",
        `Тема и задача: ${topic.trim()}`,
        `Аудитория: ${audience}.`,
        `Количество слайдов: ровно ${slideCount}.`,
        `Визуальный стиль: ${styleName}.`,
        speakerNotes ? "Для каждого слайда добавь заметки спикера." : "Поле notes оставь пустым.",
        "Схема JSON:",
        '{"title":"Название","subtitle":"Подзаголовок","slides":[{"title":"Заголовок","subtitle":"Короткая мысль","bullets":["Тезис 1","Тезис 2"],"notes":"Заметки спикера","visual":"Идея визуала"}]}',
        "На слайде не больше четырех коротких тезисов. Первый слайд обложка, последний содержит вывод и следующее действие.",
      ].join("\n");
      const response = await sendChatMessage({
        message: prompt,
        agentId: "presentations",
        selectedModelId: "openai:gpt-4o-mini",
        language,
        country: user?.country === "RU" ? "RU" : "KZ",
      });
      const content = response.assistantMessage?.content?.trim() ?? "";
      setDeck(parseDeck(content, topic, slideCount));
      setActiveSlide(0);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Не удалось собрать презентацию.");
    } finally {
      setBusy(false);
    }
  };

  const updateSlide = (patch: Partial<DeckSlide>) => {
    setDeck((current) => {
      if (!current) return current;
      return {
        ...current,
        slides: current.slides.map((slide, index) => index === activeSlide ? { ...slide, ...patch } : slide),
      };
    });
  };

  const addSlide = () => {
    setDeck((current) => {
      if (!current) return current;
      const slides = [
        ...current.slides,
        {
          title: "Новый слайд",
          subtitle: "Добавьте основную мысль",
          bullets: ["Первый тезис"],
          notes: "",
          visual: "Чистая композиция с одним главным акцентом",
        },
      ];
      window.setTimeout(() => setActiveSlide(slides.length - 1), 0);
      return { ...current, slides };
    });
  };

  const downloadPptx = async () => {
    if (!deck || exporting) return;
    setExporting(true);
    setError("");
    try {
      const mod = await import("pptxgenjs");
      const pptx = new mod.default();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "nomduchat";
      pptx.subject = deck.subtitle;
      pptx.title = deck.title;
      pptx.company = "nomduchat";
      pptx.lang = language === "ru" ? "ru-RU" : language === "kk" ? "kk-KZ" : "en-US";
      pptx.theme = {
        headFontFace: "Aptos Display",
        bodyFontFace: "Aptos",
        lang: pptx.lang,
      };

      deck.slides.forEach((item, index) => {
        const slide = pptx.addSlide();
        slide.background = { color: index % 2 === 0 ? "101A17" : "171411" };
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 0.18,
          h: 7.5,
          line: { color: index % 2 === 0 ? "69E3B6" : "FFB55F", transparency: 100 },
          fill: { color: index % 2 === 0 ? "69E3B6" : "FFB55F" },
        });
        slide.addText(String(index + 1).padStart(2, "0"), {
          x: 0.65,
          y: 0.48,
          w: 0.7,
          h: 0.3,
          fontFace: "Aptos",
          fontSize: 10,
          color: "809089",
          charSpacing: 2,
        });
        slide.addText(item.title, {
          x: 0.65,
          y: 1.05,
          w: 7.35,
          h: 1.25,
          fontFace: "Aptos Display",
          fontSize: index === 0 ? 34 : 28,
          bold: true,
          color: "F4F3EF",
          margin: 0,
          breakLine: false,
          fit: "shrink",
        });
        if (item.subtitle) {
          slide.addText(item.subtitle, {
            x: 0.68,
            y: 2.3,
            w: 6.9,
            h: 0.55,
            fontFace: "Aptos",
            fontSize: 15,
            color: "AEB8B3",
            margin: 0,
            fit: "shrink",
          });
        }
        if (item.bullets.length) {
          slide.addText(
            item.bullets.map((text) => ({
              text,
              options: { bullet: { indent: 16 }, hanging: 4, breakLine: true },
            })),
            {
              x: 0.68,
              y: 3.05,
              w: 7.15,
              h: 3.35,
              fontFace: "Aptos",
              fontSize: 18,
              color: "E8ECE9",
              paraSpaceAfterPt: 16,
              margin: 0,
              valign: "top",
              breakLine: false,
              fit: "shrink",
            }
          );
        }
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 8.55,
          y: 0.8,
          w: 4.05,
          h: 5.9,
          rectRadius: 0.08,
          line: { color: "FFFFFF", transparency: 86, width: 1 },
          fill: { color: index % 2 === 0 ? "173128" : "33261B", transparency: 4 },
        });
        slide.addText("ВИЗУАЛ", {
          x: 8.95,
          y: 1.18,
          w: 1.3,
          h: 0.25,
          fontFace: "Aptos",
          fontSize: 9,
          bold: true,
          color: index % 2 === 0 ? "69E3B6" : "FFB55F",
          charSpacing: 2,
          margin: 0,
        });
        slide.addText(item.visual || "Главный визуальный акцент", {
          x: 8.95,
          y: 2.2,
          w: 3.25,
          h: 2.2,
          fontFace: "Aptos Display",
          fontSize: 22,
          color: "F4F3EF",
          margin: 0,
          valign: "mid",
          fit: "shrink",
        });
        if (item.notes) slide.addNotes(item.notes);
      });

      await pptx.writeFile({ fileName: `${safeFilename(deck.title)}.pptx` });
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Не удалось экспортировать PPTX.");
    } finally {
      setExporting(false);
    }
  };

  const slide = deck?.slides[activeSlide] ?? null;

  return (
    <section className="pro-studio-shell presentation-pro">
      <div className="pro-studio-grid">
        <aside className="pro-control-panel">
          <header className="pro-panel-heading">
            <div>
              <p className="pro-overline">Deck builder</p>
              <h2>Презентация, а не план</h2>
            </div>
            <MonitorPlay />
          </header>
          <label className="pro-field">
            <span>Тема и результат</span>
            <textarea
              rows={6}
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Например: презентация BI GROUP для инвесторов с акцентом на проекты, рост и новые рынки"
            />
          </label>
          <label className="pro-field">
            <span>Аудитория</span>
            <input value={audience} onChange={(event) => setAudience(event.target.value)} />
          </label>
          <label className="pro-range">
            <span>Слайдов</span>
            <output>{slideCount}</output>
            <input type="range" min={5} max={16} value={slideCount} onChange={(event) => setSlideCount(Number(event.target.value))} />
          </label>
          <div className="pro-field">
            <span>Дизайн</span>
            <div className="pro-choice-grid">
              {deckStyles.map(([id, label]) => (
                <button key={id} type="button" className={style === id ? "is-active" : ""} onClick={() => setStyle(id)}>
                  <span className={`deck-swatch deck-swatch--${id}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="pro-check">
            <input type="checkbox" checked={speakerNotes} onChange={(event) => setSpeakerNotes(event.target.checked)} />
            <span>Добавить заметки спикера</span>
          </label>
          <button type="button" className="pro-primary-button" disabled={busy || !topic.trim()} onClick={() => void generate()}>
            {busy ? <LoaderCircle className="spin" /> : <Sparkles />}
            Создать презентацию
          </button>
          {error ? <p className="pro-error">{error}</p> : null}
        </aside>

        <div className="pro-result-panel presentation-workspace">
          <header className="pro-result-heading">
            <div>
              <p className="pro-overline">Предпросмотр</p>
              <h2>{deck?.title ?? "Слайды появятся здесь"}</h2>
            </div>
            {deck ? (
              <button type="button" className="pro-download-button" disabled={exporting} onClick={() => void downloadPptx()}>
                {exporting ? <LoaderCircle className="spin" /> : <FileDown />}
                Скачать PPTX
              </button>
            ) : null}
          </header>

          {deck && slide ? (
            <div className="deck-workspace">
              <div className="deck-thumbnails">
                {deck.slides.map((item, index) => (
                  <button key={`${item.title}-${index}`} type="button" className={activeSlide === index ? "is-active" : ""} onClick={() => setActiveSlide(index)}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item.title}</strong>
                  </button>
                ))}
                <button type="button" className="deck-add-slide" onClick={addSlide}>
                  <Plus />
                  Добавить слайд
                </button>
              </div>

              <div className="deck-stage-wrap">
                <article className={`deck-stage deck-stage--${style}`}>
                  <span className="deck-number">{String(activeSlide + 1).padStart(2, "0")}</span>
                  <div className="deck-copy">
                    <h3>{slide.title}</h3>
                    <p>{slide.subtitle}</p>
                    <ul>{slide.bullets.map((bullet, index) => <li key={`${bullet}-${index}`}>{bullet}</li>)}</ul>
                  </div>
                  <div className="deck-visual">
                    <span>Визуал</span>
                    <strong>{slide.visual}</strong>
                  </div>
                </article>
                <div className="deck-navigation">
                  <button type="button" disabled={activeSlide === 0} onClick={() => setActiveSlide((current) => current - 1)}><ChevronLeft /></button>
                  <span>{activeSlide + 1} / {deck.slides.length}</span>
                  <button type="button" disabled={activeSlide === deck.slides.length - 1} onClick={() => setActiveSlide((current) => current + 1)}><ChevronRight /></button>
                </div>
                <details className="deck-editor">
                  <summary>Изменить текущий слайд</summary>
                  <label className="pro-field">
                    <span>Заголовок</span>
                    <input value={slide.title} onChange={(event) => updateSlide({ title: event.target.value })} />
                  </label>
                  <label className="pro-field">
                    <span>Тезисы, каждый с новой строки</span>
                    <textarea rows={4} value={slide.bullets.join("\n")} onChange={(event) => updateSlide({ bullets: event.target.value.split("\n").filter(Boolean) })} />
                  </label>
                  <label className="pro-field">
                    <span>Заметки спикера</span>
                    <textarea rows={3} value={slide.notes} onChange={(event) => updateSlide({ notes: event.target.value })} />
                  </label>
                </details>
              </div>
            </div>
          ) : (
            <div className="presentation-empty">
              <MonitorPlay />
              <strong>Здесь будет настоящая презентация</strong>
              <span>Можно пролистать слайды, отредактировать текст и скачать готовый PPTX.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function parseDeck(content: string, fallbackTitle: string, expectedCount: number): Deck {
  const clean = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(clean.slice(start, end + 1)) as Partial<Deck>;
      const slides = Array.isArray(parsed.slides)
        ? parsed.slides.slice(0, expectedCount).map(normalizeSlide)
        : [];
      if (slides.length) {
        return {
          title: String(parsed.title || fallbackTitle),
          subtitle: String(parsed.subtitle || ""),
          slides,
        };
      }
    } catch {
      // The readable fallback below also handles providers that wrap JSON in prose.
    }
  }

  const sections = clean.split(/\n(?=#{1,4}\s|\d+\.\s)/).filter(Boolean);
  const slides = sections.slice(0, expectedCount).map((section, index) => {
    const lines = section.split("\n").map((line) => line.replace(/^#{1,4}\s*|^\d+\.\s*/, "").trim()).filter(Boolean);
    return normalizeSlide({
      title: lines[0] || `Слайд ${index + 1}`,
      subtitle: "",
      bullets: lines.slice(1, 5),
      notes: "",
      visual: "Ключевой визуальный акцент по теме слайда",
    });
  });
  return {
    title: fallbackTitle,
    subtitle: "",
    slides: slides.length ? slides : [normalizeSlide({ title: fallbackTitle, bullets: [clean] })],
  };
}

function normalizeSlide(value: Partial<DeckSlide>): DeckSlide {
  return {
    title: String(value.title || "Без названия"),
    subtitle: String(value.subtitle || ""),
    bullets: Array.isArray(value.bullets) ? value.bullets.map(String).filter(Boolean).slice(0, 5) : [],
    notes: String(value.notes || ""),
    visual: String(value.visual || "Один крупный визуальный акцент"),
  };
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 80) || "nomduchat-presentation";
}
