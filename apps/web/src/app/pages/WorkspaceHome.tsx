import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import OptimizedImage from "../components/OptimizedImage";
import SearchTag from "../components/workspace/SearchTag";
import PageHeader from "../components/workspace/PageHeader";
import { useLanguage } from "../i18n";
import {
  toWorkspaceArticles,
  workspaceArticleFallbacks,
  type WorkspaceArticleBlock,
} from "../data/workspaceArticles";

const publicContentEnabled = import.meta.env.VITE_ENABLE_PUBLIC_CONTENT_BLOCKS === "true";

export default function WorkspaceHome() {
  const { language } = useLanguage();
  const [articleBlocks, setArticleBlocks] = useState<WorkspaceArticleBlock[]>(workspaceArticleFallbacks);
  const articles = useMemo(() => toWorkspaceArticles(articleBlocks), [articleBlocks]);

  useEffect(() => {
    if (!publicContentEnabled) return;

    let active = true;
    void import("../api-client/content")
      .then(({ getPublicContentBlocks }) => getPublicContentBlocks({ placement: "workspace.home.articles", locale: language }))
      .then((response) => {
        if (!active || response.contentBlocks.length === 0) return;
        setArticleBlocks(response.contentBlocks);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [language]);

  return (
    <div className="ns-page-scroll">
      <main className="ns-page space-y-10">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
          className="ns-living-grid rounded-[var(--radius-hero)] px-0 py-8 md:py-12"
        >
          <PageHeader
            overline="Nomdu workspace"
            title="AI-платформа для работы с контентом"
          />

          <div className="mt-8 max-w-[760px]">
            <p className="text-sm leading-relaxed text-gray-300 md:text-base">
              Nomduchat — единая среда для генерации текста, изображений, видео и аватаров.
              Здесь публикуются обновления и примеры применения ИИ, а также описания того, какие
              инструменты доступны в приложении.
            </p>
          </div>
        </motion.section>

        <section className="ns-home-editorial" aria-labelledby="workspace-articles-title">
          <div className="ns-home-editorial-head">
            <p className="ns-overline">Обновления</p>
            <h2 id="workspace-articles-title">Идеи для работы с AI</h2>
          </div>
          <div className="ns-home-articles">
            {articles.map((article, index) => (
              <article key={article.key} className="ns-home-article">
                <Link
                  to={`/workspace/articles/${article.slug}`}
                  className="ns-card-hit"
                  aria-label={`Открыть статью: ${article.title}`}
                />
                <OptimizedImage
                  src={articleCoverSrc(article.cover)}
                  mobileSrc={articleMobileCoverSrc(article.cover)}
                  alt=""
                  pictureClassName="ns-home-article-picture"
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  width={1152}
                  height={720}
                  sizes="(max-width: 767px) 100vw, 50vw"
                />
                <div className="ns-home-article-copy">
                  <SearchTag tag={article.category} />
                  <h3>{article.title}</h3>
                  <p>{article.excerpt}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function articleCoverSrc(cover: string) {
  return cover.startsWith("article-") ? `/article-covers/${cover}.webp` : `/app-covers/${cover}.jpg`;
}

function articleMobileCoverSrc(cover: string) {
  return cover.startsWith("article-") ? `/article-covers/${cover}-mobile.webp` : undefined;
}
