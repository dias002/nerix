import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Sparkles } from "lucide-react";
import appCatalogData from "../data/app-catalog.json";
import FilterBar from "../components/workspace/FilterBar";
import PageHeader from "../components/workspace/PageHeader";
import SearchField from "../components/workspace/SearchField";

type AppTone = "solar" | "plasma" | "coral" | "orbit";
type CreationMode = "image" | "video" | "music" | "voice";

type AppCatalogItem = {
  id: string;
  title: string;
  text: string;
  category: string;
  accent: AppTone;
  starterPrompt?: string;
  href?: string;
  agentId?: string;
  networkId?: string;
  creationMode?: CreationMode;
};

const appCatalog = appCatalogData as AppCatalogItem[];

export default function Apps() {
  const [activeCategory, setActiveCategory] = useState("Все");
  const [search, setSearch] = useState("");
  const [failedCovers, setFailedCovers] = useState<Set<string>>(() => new Set());
  const categories = useMemo(() => ["Все", ...Array.from(new Set(appCatalog.map((app) => app.category)))], []);
  const categoryOptions = useMemo(() => categories.map((category) => ({ id: category, label: category })), [categories]);
  const filteredApps = useMemo(() => {
    const query = search.trim().toLowerCase();
    return appCatalog.filter((app) => {
      const matchesCategory = activeCategory === "Все" || app.category === activeCategory;
      const matchesSearch = !query || `${app.title} ${app.text} ${app.category}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);
  const markCoverFailed = (id: string) => {
    setFailedCovers((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="ns-page-scroll">
      <main className="ns-page ns-apps-page space-y-7">
        <PageHeader overline="Приложения" title="Выберите инструмент" />

        <section className="ns-app-toolbar" aria-label="Фильтры приложений">
          <FilterBar options={categoryOptions} value={activeCategory} onChange={setActiveCategory} label="Категория" />
          <SearchField value={search} onChange={setSearch} placeholder="Найти приложение" />
        </section>

        <section className="ns-app-grid">
          {filteredApps.map((app) => (
            <Link key={app.id} to={appHref(app)} className="ns-app-card group" data-tone={app.accent}>
              <CoverImage app={app} failed={failedCovers.has(app.id)} onError={() => markCoverFailed(app.id)} />
              <div className="ns-app-card-copy">
                <h3>{app.title}</h3>
                <p>{app.text}</p>
              </div>
            </Link>
          ))}

          {filteredApps.length === 0 ? (
            <div className="ns-app-empty">
              <Sparkles className="h-5 w-5" strokeWidth={1.7} />
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
        <img
          src={`/app-covers/${app.id}.jpg`}
          alt=""
          className="ns-app-cover-image"
          loading={app.id === "video" ? "eager" : "lazy"}
          onError={onError}
        />
      ) : null}
      <span className="ns-app-cover-orbit" aria-hidden="true" />
    </div>
  );
}

function appHref(app: AppCatalogItem) {
  if (app.href) return app.href;
  if (app.creationMode) {
    const params = new URLSearchParams();
    if (app.starterPrompt) params.set("prompt", app.starterPrompt);
    params.set("preset", app.id);
    return `/workspace/media/${app.creationMode}?${params.toString()}`;
  }

  const params = new URLSearchParams();
  if (app.starterPrompt) params.set("prompt", app.starterPrompt);
  if (app.agentId) params.set("agent", app.agentId);
  if (app.networkId) params.set("network", app.networkId);
  return `/workspace/chat?${params.toString()}`;
}
