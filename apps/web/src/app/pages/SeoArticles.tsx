import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react";
import OptimizedImage from "../components/OptimizedImage";
import SearchTag from "../components/workspace/SearchTag";
import StarsBackground from "../components/StarsBackground";
import { seoArticles, type SeoArticle } from "../data/seoArticles";
import { setPageSeo } from "../seo";

export default function SeoArticles() {
  const { slug } = useParams();
  const article = seoArticles.find((item) => item.slug === slug) ?? null;

  useEffect(() => {
    if (article) {
      setPageSeo(`${article.title} | nomduchat`, article.description, `/seo/articles/${article.slug}`);
      return;
    }
    setPageSeo(
      "Полезные материалы nomduchat",
      "Практические статьи про AI-чат, учебу, поддержку и выбор AI-сервисов.",
      "/seo/articles",
    );
  }, [article]);

  if (slug && !article) return <NotFound />;
  if (article) return <ArticleView article={article} />;

  return (
    <div className="ns-seo-shell">
      <StarsBackground />
      <main className="ns-seo-index">
        <Link to="/" className="ns-seo-back">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          На главную
        </Link>
        <header className="ns-seo-heading">
          <p className="ns-overline">Материалы</p>
          <h1>Практика работы с AI</h1>
          <p>Короткие разборы, которые ведут от вопроса к конкретному действию в nomduchat.</p>
        </header>
        <section className="ns-seo-grid">
          {seoArticles.map((item) => (
            <article key={item.slug} className="ns-seo-card">
              <Link to={`/seo/articles/${item.slug}`} className="ns-card-hit" aria-label={`Открыть статью: ${item.title}`} />
              <OptimizedImage
                src={`/article-covers/${item.cover}.webp`}
                mobileSrc={`/article-covers/${item.cover}-mobile.webp`}
                alt=""
                pictureClassName="ns-seo-card-picture"
                width={1280}
                height={800}
                sizes="(max-width: 767px) 100vw, 33vw"
              />
              <div className="ns-seo-card-copy">
                <SearchTag tag={item.tags[0]} />
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <span><Clock3 className="h-3.5 w-3.5" /> {item.readMinutes} мин</span>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function ArticleView({ article }: { article: SeoArticle }) {
  const related = seoArticles.filter((item) => item.slug !== article.slug).slice(0, 2);

  return (
    <div className="ns-seo-shell">
      <StarsBackground />
      <main className="ns-seo-article">
        <Link to="/seo/articles" className="ns-seo-back">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          Все материалы
        </Link>
        <header className="ns-seo-article-hero">
          <OptimizedImage
            src={`/article-covers/${article.cover}.webp`}
            mobileSrc={`/article-covers/${article.cover}-mobile.webp`}
            alt=""
            pictureClassName="ns-seo-article-picture"
            loading="eager"
            fetchPriority="high"
            width={1280}
            height={800}
            sizes="100vw"
          />
          <div>
            <div className="ns-seo-tags">
              {article.tags.map((tag) => <SearchTag key={tag} tag={tag} />)}
            </div>
            <h1>{article.title}</h1>
            <p>{article.description}</p>
            <span><Clock3 className="h-4 w-4" /> {article.readMinutes} мин чтения</span>
          </div>
        </header>
        <article className="ns-seo-body">
          {article.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <Link to="/workspace/chat" className="nd-primary-action">
            Попробовать в чате
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
        <section className="ns-seo-related">
          <h2>Похожие материалы</h2>
          <div>
            {related.map((item) => (
              <Link key={item.slug} to={`/seo/articles/${item.slug}`}>
                <span>#{item.tags[0]}</span>
                <strong>{item.title}</strong>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="ns-seo-shell">
      <main className="ns-seo-not-found">
        <p className="ns-overline">404</p>
        <h1>Материал не найден</h1>
        <Link to="/seo/articles">Посмотреть все статьи</Link>
      </main>
    </div>
  );
}
