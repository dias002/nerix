import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import OptimizedImage from "../components/OptimizedImage";
import PageHeader from "../components/workspace/PageHeader";
import SearchField from "../components/workspace/SearchField";
import SearchTag from "../components/workspace/SearchTag";
import { appCatalog, appHref } from "../data/appCatalog";
import { seoArticles } from "../data/seoArticles";
import { toWorkspaceArticles, workspaceArticleFallbacks } from "../data/workspaceArticles";

const workspaceArticles = toWorkspaceArticles(workspaceArticleFallbacks);
const suggestedTags = ["Текст", "Изображения", "Видео", "Учёба", "Маркетинг", "Документы"];

export default function WorkspaceSearch() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? params.get("tag") ?? "";
  const normalized = normalize(query);

  const results = useMemo(() => {
    const matches = (value: string) => !normalized || normalize(value).includes(normalized);
    return {
      apps: appCatalog.filter((app) => matches(`${app.title} ${app.text} ${app.category}`)),
      workspace: workspaceArticles.filter((article) => matches(`${article.title} ${article.excerpt} ${article.category}`)),
      public: seoArticles.filter((article) => matches(`${article.title} ${article.description} ${article.tags.join(" ")}`)),
    };
  }, [normalized]);

  const total = results.apps.length + results.workspace.length + results.public.length;

  const updateQuery = (value: string) => {
    const next = new URLSearchParams(params);
    next.delete("tag");
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  };

  return (
    <div className="ns-page-scroll">
      <main className="ns-page ns-search-page">
        <PageHeader
          overline="Поиск"
          title="Найдите нужное в nomduchat"
          subtitle="Приложения и материалы собраны в одном поиске. Запрос можно сохранить или отправить ссылкой."
        />

        <div className="ns-search-input">
          <SearchField value={query} onChange={updateQuery} placeholder="Например: видео, документы или учёба" />
        </div>

        <div className="ns-search-tags" aria-label="Популярные темы">
          {suggestedTags.map((tag) => <SearchTag key={tag} tag={tag} />)}
        </div>

        {total === 0 ? (
          <section className="ns-search-empty">
            <Search className="h-6 w-6" strokeWidth={1.6} />
            <h2>Ничего не найдено</h2>
            <p>Попробуйте более короткий запрос или выберите тему выше.</p>
          </section>
        ) : (
          <div className="ns-search-results">
            {results.apps.length ? (
              <ResultSection title="Приложения" count={results.apps.length}>
                <div className="ns-search-apps">
                  {results.apps.map((app) => (
                    <Link key={app.id} to={appHref(app)} className="ns-search-app">
                      <OptimizedImage
                        src={`/app-covers/${app.id}.jpg`}
                        alt=""
                        pictureClassName="ns-search-app-picture"
                        width={1152}
                        height={928}
                        sizes="(max-width: 767px) 96px, 140px"
                      />
                      <div>
                        <span>#{app.category}</span>
                        <h3>{app.title}</h3>
                        <p>{app.text}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                    </Link>
                  ))}
                </div>
              </ResultSection>
            ) : null}

            {results.workspace.length || results.public.length ? (
              <ResultSection title="Материалы" count={results.workspace.length + results.public.length}>
                <div className="ns-search-articles">
                  {results.workspace.map((article) => (
                    <ArticleResult
                      key={article.key}
                      to={`/workspace/articles/${article.slug}`}
                      title={article.title}
                      description={article.excerpt}
                      tag={article.category}
                      cover={article.cover}
                      workspace
                    />
                  ))}
                  {results.public.map((article) => (
                    <ArticleResult
                      key={article.slug}
                      to={`/seo/articles/${article.slug}`}
                      title={article.title}
                      description={article.description}
                      tag={article.tags[0]}
                      cover={article.cover}
                    />
                  ))}
                </div>
              </ResultSection>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function ResultSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="ns-search-section-head">
        <h2>{title}</h2>
        <span>{count}</span>
      </div>
      {children}
    </section>
  );
}

function ArticleResult({
  to,
  title,
  description,
  tag,
  cover,
  workspace = false,
}: {
  to: string;
  title: string;
  description: string;
  tag: string;
  cover: string;
  workspace?: boolean;
}) {
  const isGenerated = cover.startsWith("article-") || cover.startsWith("seo-");
  const src = isGenerated ? `/article-covers/${cover}.webp` : `/app-covers/${cover}.jpg`;
  const mobileSrc = isGenerated ? `/article-covers/${cover}-mobile.webp` : undefined;

  return (
    <Link to={to} className="ns-search-article">
      <OptimizedImage
        src={src}
        mobileSrc={mobileSrc}
        alt=""
        pictureClassName="ns-search-article-picture"
        width={1280}
        height={800}
        sizes="(max-width: 767px) 100vw, 380px"
      />
      <div>
        <span>{workspace ? "Workspace" : "Статья"} · #{tag}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </Link>
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ru").replace(/ё/g, "е");
}
