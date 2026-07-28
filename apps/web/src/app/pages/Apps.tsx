import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  LayoutGrid,
  List,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import OptimizedImage from "../components/OptimizedImage";
import FilterBar from "../components/workspace/FilterBar";
import PageHeader from "../components/workspace/PageHeader";
import SearchField from "../components/workspace/SearchField";
import SearchTag from "../components/workspace/SearchTag";
import { appCatalog, appHref, type AppCatalogItem } from "../data/appCatalog";

const orderStorageKey = "nomduchat-app-order";
const viewStorageKey = "nomduchat-app-view";

export default function Apps() {
  const [params] = useSearchParams();
  const initialQuery = params.get("q") ?? params.get("tag") ?? "";
  const [activeCategory, setActiveCategory] = useState("Все");
  const [search, setSearch] = useState(initialQuery);
  const [failedCovers, setFailedCovers] = useState<Set<string>>(() => new Set());
  const [customizing, setCustomizing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>(loadOrder);
  const [view, setView] = useState<"cards" | "compact">(loadView);

  useEffect(() => {
    window.localStorage.setItem(orderStorageKey, JSON.stringify(order));
  }, [order]);

  useEffect(() => {
    window.localStorage.setItem(viewStorageKey, view);
  }, [view]);

  const categories = useMemo(() => ["Все", ...Array.from(new Set(appCatalog.map((app) => app.category)))], []);
  const categoryOptions = useMemo(() => categories.map((category) => ({ id: category, label: category })), [categories]);
  const orderedApps = useMemo(() => sortApps(order), [order]);
  const filteredApps = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orderedApps.filter((app) => {
      const matchesCategory = activeCategory === "Все" || app.category === activeCategory;
      const matchesSearch = !query || `${app.title} ${app.text} ${app.category}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, orderedApps, search]);

  const markCoverFailed = (id: string) => {
    setFailedCovers((current) => new Set(current).add(id));
  };

  const move = (id: string, direction: -1 | 1) => {
    setOrder((current) => {
      const full = sortApps(current).map((app) => app.id);
      const index = full.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= full.length) return current;
      [full[index], full[nextIndex]] = [full[nextIndex], full[index]];
      return full;
    });
  };

  const drop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setOrder((current) => {
      const full = sortApps(current).map((app) => app.id).filter((id) => id !== draggedId);
      const targetIndex = full.indexOf(targetId);
      full.splice(targetIndex, 0, draggedId);
      return full;
    });
    setDraggedId(null);
  };

  const reset = () => {
    setOrder(appCatalog.map((app) => app.id));
    setView("cards");
  };

  return (
    <div className="ns-page-scroll">
      <main className="ns-page ns-apps-page space-y-7">
        <PageHeader
          overline="Приложения"
          title="Выберите инструмент"
          subtitle="Настройте порядок и плотность каталога под свой сценарий."
          actions={
            <div className="ns-app-personalize">
              <button type="button" onClick={() => setView("cards")} aria-pressed={view === "cards"} aria-label="Крупные карточки">
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setView("compact")} aria-pressed={view === "compact"} aria-label="Компактный вид">
                <List className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setCustomizing((value) => !value)} aria-pressed={customizing}>
                <SlidersHorizontal className="h-4 w-4" />
                <span>{customizing ? "Готово" : "Настроить"}</span>
              </button>
              {customizing ? (
                <button type="button" onClick={reset}>
                  <RotateCcw className="h-4 w-4" />
                  <span>Сбросить</span>
                </button>
              ) : null}
            </div>
          }
        />

        <section className="ns-app-toolbar" aria-label="Фильтры приложений">
          <FilterBar options={categoryOptions} value={activeCategory} onChange={setActiveCategory} label="Категория" />
          <SearchField value={search} onChange={setSearch} placeholder="Найти приложение" />
        </section>

        {customizing ? (
          <p className="ns-app-customize-hint">
            <GripVertical className="h-4 w-4" />
            Перетащите карточки или используйте стрелки. Порядок сохранится на этом устройстве.
          </p>
        ) : null}

        <section className="ns-app-grid" data-view={view} data-customizing={customizing}>
          {filteredApps.map((app, index) => (
            <article
              key={app.id}
              className="ns-app-card group"
              data-tone={app.accent}
              draggable={customizing}
              onDragStart={() => setDraggedId(app.id)}
              onDragOver={(event) => customizing && event.preventDefault()}
              onDrop={() => drop(app.id)}
            >
              {customizing ? (
                <>
                  <CoverImage app={app} failed={failedCovers.has(app.id)} onError={() => markCoverFailed(app.id)} />
                  <div className="ns-app-card-copy">
                    <h3>{app.title}</h3>
                    <p>{app.text}</p>
                  </div>
                  <div className="ns-app-reorder">
                    <GripVertical className="h-5 w-5" />
                    <button type="button" onClick={() => move(app.id, -1)} disabled={index === 0} aria-label={`Поднять ${app.title}`}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => move(app.id, 1)} disabled={index === filteredApps.length - 1} aria-label={`Опустить ${app.title}`}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link to={appHref(app)} className="ns-app-card-link" aria-label={`Открыть ${app.title}`}>
                    <CoverImage app={app} failed={failedCovers.has(app.id)} onError={() => markCoverFailed(app.id)} />
                    <div className="ns-app-card-copy">
                      <h3>{app.title}</h3>
                      <p>{app.text}</p>
                    </div>
                  </Link>
                  <SearchTag tag={app.category} className="ns-app-card-tag" />
                </>
              )}
            </article>
          ))}

          {filteredApps.length === 0 ? (
            <div className="ns-app-empty">
              Попробуйте другую категорию или запрос.
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function CoverImage({ app, failed, onError }: { app: AppCatalogItem; failed: boolean; onError: () => void }) {
  return (
    <div className="ns-app-cover" data-tone={app.accent}>
      {!failed ? (
        <OptimizedImage
          src={`/app-covers/${app.id}.jpg`}
          alt=""
          className="ns-app-cover-image"
          pictureClassName="ns-app-cover-picture"
          loading="lazy"
          width={1152}
          height={928}
          sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 33vw"
          onError={onError}
        />
      ) : null}
    </div>
  );
}

function loadOrder() {
  if (typeof window === "undefined") return appCatalog.map((app) => app.id);
  try {
    const saved = JSON.parse(window.localStorage.getItem(orderStorageKey) ?? "[]");
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function loadView() {
  if (typeof window === "undefined") return "cards";
  return window.localStorage.getItem(viewStorageKey) === "compact" ? "compact" : "cards";
}

function sortApps(order: string[]) {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...appCatalog].sort((left, right) => (rank.get(left.id) ?? 999) - (rank.get(right.id) ?? 999));
}
