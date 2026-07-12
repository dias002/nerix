import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, FileText, Search } from "lucide-react";
import StarsBackground from "../components/StarsBackground";
import { setPageSeo } from "../seo";

const articles = [
  {
    slug: "kak-vybrat-ai-servis",
    title: "Как выбрать AI-сервис для ежедневной работы",
    description: "Критерии выбора AI-помощника для текста, учебы, документов, кода и рабочих задач.",
    body: [
      "Хороший AI-сервис должен помогать решить задачу, а не заставлять пользователя разбираться в десятках моделей. Поэтому важны понятный чат, история, файлы, настройки ответа и прозрачные лимиты.",
      "Для ежедневной работы полезнее единая среда: пользователь пишет задачу обычными словами, а система подбирает подходящий режим. Такой подход снижает порог входа и экономит время.",
      "Перед оплатой стоит проверить, есть ли у сервиса поддержка, юридические документы, понятная политика возврата, история операций и возможность контролировать подписку.",
    ],
  },
  {
    slug: "ai-chat-dlya-ucheby",
    title: "AI-чат для учебы: как получать понятные объяснения",
    description: "Как использовать AI для конспектов, проверки знаний и разбора сложных тем.",
    body: [
      "AI-чат полезен в учебе, когда он не просто дает ответ, а объясняет ход мысли. Пользователь может попросить пример, короткий конспект, тест или повторное объяснение другими словами.",
      "Лучший результат получается, если в запросе указать уровень подготовки, цель и формат: кратко, подробно, с примерами или в виде плана.",
      "Важно проверять факты и использовать AI как помощника, а не как единственный источник истины. Особенно это касается экзаменов, расчетов и профессиональных тем.",
    ],
  },
  {
    slug: "faq-dlya-saita",
    title: "FAQ для сайта: как снизить нагрузку на поддержку",
    description: "Как собрать вопросы пользователей, написать ответы и улучшать FAQ по данным обращений.",
    body: [
      "FAQ помогает пользователям быстрее находить ответы и уменьшает количество повторных обращений в поддержку. Начинать стоит с реальных вопросов из чатов, писем и звонков.",
      "Ответы должны быть короткими, конкретными и регулярно обновляться. Если вопрос связан с оплатой, возвратом или персональными данными, рядом должны быть ссылки на официальные документы.",
      "После запуска FAQ нужно смотреть, какие вопросы остаются без ответа. Это помогает улучшать продукт, тексты, интерфейс и сценарии поддержки.",
    ],
  },
];

export default function SeoArticles() {
  const { slug } = useParams();
  const article = articles.find((item) => item.slug === slug) ?? null;

  useEffect(() => {
    if (article) {
      setPageSeo(`${article.title} | nomduchat`, article.description, `/seo/articles/${article.slug}`);
      return;
    }

    setPageSeo(
      "SEO-статьи nomduchat",
      "Индексируемые материалы nomduchat про AI-чат, учебу, FAQ, тексты и выбор AI-сервиса.",
      "/seo/articles"
    );
  }, [article]);

  if (article) return <ArticleView article={article} />;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <StarsBackground />
      <main className="relative z-10 mx-auto max-w-5xl px-6 py-28 md:py-32">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          На главную
        </Link>
        <section className="mt-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            <Search className="h-4 w-4" strokeWidth={1.7} />
            SEO-страницы
          </div>
          <h1 className="mt-5 text-4xl font-semibold md:text-6xl">Полезные материалы nomduchat</h1>
          <p className="mt-5 text-base leading-relaxed text-gray-400 md:text-lg">
            Индексируемые статьи для пользователей, которые ищут AI-чат, FAQ, работу с текстами и выбор AI-сервиса.
          </p>
        </section>
        <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {articles.map((item) => (
            <Link
              key={item.slug}
              to={`/seo/articles/${item.slug}`}
              className="rounded-3xl border border-white/10 bg-[#080808]/85 p-5 transition-colors hover:border-white/20 md:p-6"
            >
              <FileText className="h-6 w-6 text-gray-300" strokeWidth={1.7} />
              <h2 className="mt-5 text-xl font-medium text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">{item.description}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}

function ArticleView({ article }: { article: (typeof articles)[number] }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <StarsBackground />
      <main className="relative z-10 mx-auto max-w-4xl px-6 py-28 md:py-32">
        <Link to="/seo/articles" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          Все материалы
        </Link>
        <article className="mt-10 rounded-3xl border border-white/10 bg-[#080808]/85 p-6 md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            <FileText className="h-4 w-4" strokeWidth={1.7} />
            Статья
          </div>
          <h1 className="mt-5 text-4xl font-semibold md:text-6xl">{article.title}</h1>
          <p className="mt-5 text-base leading-relaxed text-gray-400 md:text-lg">{article.description}</p>
          <div className="mt-8 space-y-4">
            {article.body.map((paragraph) => (
              <p key={paragraph} className="text-base leading-relaxed text-gray-300">
                {paragraph}
              </p>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}
