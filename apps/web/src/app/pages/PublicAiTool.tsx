import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Bot, Brush, Home, Image, Send, Sparkles, type LucideIcon } from "lucide-react";
import StarsBackground from "../components/StarsBackground";
import LanguageSwitch from "../components/LanguageSwitch";
import { setPageSeo } from "../seo";

type ToolPage = {
  path: string;
  badge: string;
  title: string;
  description: string;
  prompt: string;
  canonical: string;
  icon: LucideIcon;
  bullets: string[];
  examples: string[];
};

const tools: ToolPage[] = [
  {
    path: "/ai/flux-2",
    badge: "AI-модель",
    title: "Flux 2 для визуальных идей",
    description: "Страница для генерации промптов под изображения, концепты, обложки и визуальные варианты через чат nomduchat.",
    prompt: "Сгенерируй 5 промптов для Flux 2. Тема: современный AI-сервис nomduchat. Нужны разные композиции, свет, стиль и негативный промпт.",
    canonical: "/ai/flux-2",
    icon: Image,
    bullets: ["визуальные концепты", "обложки и баннеры", "варианты стиля", "готовый промпт для генерации"],
    examples: ["обложка для AI-чата", "интерфейс продукта", "аватар бренда"],
  },
  {
    path: "/tools/dizajn-interyera",
    badge: "AI-инструмент",
    title: "Нейросеть для интерьера",
    description: "Черновик инструмента для интерьерных идей: пользователь описывает комнату, стиль, ограничения и получает промпт для генерации.",
    prompt: "Сделай промпт для дизайна интерьера. Комната: гостиная 20 м2. Стиль: современный минимализм. Нужно: план, материалы, цвета, свет, промпт для изображения.",
    canonical: "/tools/dizajn-interyera",
    icon: Home,
    bullets: ["описание комнаты", "стиль и материалы", "цветовая палитра", "промпт для изображения"],
    examples: ["гостиная", "кухня", "спальня", "офис"],
  },
  {
    path: "/tools/humanizer",
    badge: "Редактор текста",
    title: "Очеловечивание текста",
    description: "Инструмент помогает переписать текст естественнее: убрать канцелярит, повторяемые AI-фразы и лишнее рекламное звучание.",
    prompt: "Перепиши текст так, чтобы он звучал естественно и по-человечески. Убери канцелярит, повторы и слишком рекламные формулировки. Сохрани смысл.",
    canonical: "/tools/humanizer",
    icon: Bot,
    bullets: ["живой тон", "меньше шаблонных фраз", "сохранение смысла", "короткая редактура"],
    examples: ["описание продукта", "письмо клиенту", "пост", "FAQ-ответ"],
  },
];

export default function PublicAiTool() {
  const location = useLocation();
  const navigate = useNavigate();
  const tool = tools.find((item) => item.path === location.pathname) ?? tools[0];
  const Icon = tool.icon;

  useEffect(() => {
    setPageSeo(`${tool.title} | nomduchat`, tool.description, tool.canonical);
  }, [tool]);

  const openChat = () => {
    navigate(`/workspace/chat?prompt=${encodeURIComponent(tool.prompt)}`);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <StarsBackground />
      <header className="fixed left-6 right-6 top-6 z-20 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-medium text-white transition-colors hover:text-gray-300">
          nomduchat
        </Link>
        <LanguageSwitch />
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-28 md:py-32">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          На главную
        </Link>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
              <Icon className="h-4 w-4" strokeWidth={1.7} />
              {tool.badge}
            </div>
            <h1 className="mt-5 text-4xl font-semibold md:text-6xl">{tool.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-gray-400 md:text-lg">{tool.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openChat}
                className="inline-flex h-12 w-fit items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              >
                <Send className="h-4 w-4" strokeWidth={1.8} />
                Открыть в чате
              </button>
              <Link
                to="/workspace/apps"
                className="inline-flex h-12 w-fit items-center justify-center gap-2 rounded-full border border-white/10 px-5 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white"
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                Все приложения
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#080808]/86 p-5 backdrop-blur-md">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
              <Brush className="h-6 w-6" strokeWidth={1.6} />
            </div>
            <h2 className="text-xl font-medium text-white">Готовый стартовый запрос</h2>
            <pre className="mt-4 whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black p-4 font-sans text-sm leading-relaxed text-gray-300">
              {tool.prompt}
            </pre>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#080808]/86 p-5 backdrop-blur-md">
            <h2 className="text-lg font-medium text-white">Что учитывает</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {tool.bullets.map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-black px-3 py-1.5 text-sm text-gray-300">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#080808]/86 p-5 backdrop-blur-md">
            <h2 className="text-lg font-medium text-white">Примеры</h2>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tool.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => navigate(`/workspace/chat?prompt=${encodeURIComponent(`${tool.prompt}\n\nТема: ${example}`)}`)}
                  className="rounded-xl border border-white/10 bg-black px-4 py-3 text-left text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
