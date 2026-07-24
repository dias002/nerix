import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { getPublicContentBlocks } from "../api";
import { useLanguage } from "../i18n";
import {
  findWorkspaceArticle,
  workspaceArticleFallbacks,
  type WorkspaceArticleBlock,
} from "../data/workspaceArticles";

export default function WorkspaceArticle() {
  const { slug } = useParams();
  const { language } = useLanguage();
  const [blocks, setBlocks] = useState<WorkspaceArticleBlock[]>(workspaceArticleFallbacks);
  const article = useMemo(() => findWorkspaceArticle(blocks, slug), [blocks, slug]);

  useEffect(() => {
    let active = true;
    void getPublicContentBlocks({ placement: "workspace.home.articles", locale: language })
      .then((response) => {
        if (!active || response.contentBlocks.length === 0) return;
        setBlocks(response.contentBlocks);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [language]);

  if (!article) {
    return (
      <div className="ns-page-scroll">
        <main className="ns-page-text ns-workspace-article-missing">
          <h1>Статья не найдена</h1>
          <Link to="/workspace">Вернуться на главную</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="ns-page-scroll">
      <main className="ns-workspace-article">
        <Link to="/workspace" className="ns-workspace-article-back">Все материалы</Link>

        <header className="ns-workspace-article-hero">
          <img src={`/app-covers/${article.cover}.jpg`} alt="" />
          <div>
            <span>{article.category}</span>
            <h1>{article.title}</h1>
          </div>
        </header>

        <article className="ns-workspace-article-body">
          {article.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <footer>
            <Link to={article.ctaHref} className="nd-primary-action inline-flex h-12 items-center justify-center px-6 text-sm font-semibold">
              {article.ctaLabel}
            </Link>
          </footer>
        </article>
      </main>
    </div>
  );
}
