import { Link } from "react-router";
import { ArrowRight, Captions, ImageIcon, Mic2, Music2, Sparkles, UserRound, Video } from "lucide-react";

const mediaFlows = [
  {
    title: "Изображения",
    text: "Промпты, обложки, карточки товаров, интерьер и визуальные идеи для бренда.",
    status: "Через чат",
    icon: ImageIcon,
    prompt: "Собери промпт для изображения: цель, объект, стиль, композиция, свет, фон и ограничения.",
  },
  {
    title: "Видео",
    text: "Сценарии коротких роликов, раскадровка, структура сцены и промпты для видеомоделей.",
    status: "Через чат",
    icon: Video,
    prompt: "Сделай сценарий короткого видео: хук, 5 сцен, текст ведущего, визуальный стиль и финальный призыв.",
  },
  {
    title: "Аватар-видео",
    text: "Отдельный продукт nomduchat для цифрового ведущего, презентаций и объясняющих роликов.",
    status: "В разработке",
    icon: UserRound,
    href: "/workspace/avatar",
  },
  {
    title: "Озвучка",
    text: "Дикторский текст, темп, паузы, интонация и подготовка речи под короткий ролик.",
    status: "Через чат",
    icon: Mic2,
    prompt: "Подготовь текст для озвучки: спокойный тон, паузы, понятные фразы и версия до 45 секунд.",
  },
  {
    title: "Музыка",
    text: "Идеи песен, джинглов, припевов и коротких аудио-концепций для продукта.",
    status: "Через чат",
    icon: Music2,
    prompt: "Придумай джингл для продукта: настроение, жанр, текст припева и 3 варианта названия.",
  },
  {
    title: "Субтитры",
    text: "Структура TikTok/Reels-субтитров, короткие фразы, тайминг и акценты.",
    status: "Шаблон",
    icon: Captions,
    prompt: "Разбей текст ролика на короткие субтитры: до 42 символов в строке, с акцентами и таймингом.",
  },
];

const pipelineSteps = [
  "Сначала формулируем задачу и стиль",
  "Затем собираем промпт или сценарий",
  "После этого отправляем в нужный генератор",
  "Результат сохраняем в проекте",
];

export default function Media() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-6 text-white md:p-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-400">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              Медиа-студия nomduchat
            </div>
            <h1 className="mt-5 text-3xl font-medium leading-tight text-white md:text-4xl">
              Изображения, видео, голос и аватары в одном рабочем контуре
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-500">
              Пока тяжелые генераторы подключаются постепенно, раздел уже дает пользователю понятный путь:
              выбрать медиа-сценарий, получить готовый промпт в чате и продолжить работу в проекте.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
            <h2 className="text-base font-medium text-white">Как работает флоу</h2>
            <div className="mt-4 space-y-3">
              {pipelineSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 text-sm text-gray-400">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black text-xs text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mediaFlows.map((flow) => {
            const Icon = flow.icon;
            const href = flow.href ?? `/workspace/chat?prompt=${encodeURIComponent(flow.prompt ?? "")}`;

            return (
              <article key={flow.title} className="flex min-h-64 flex-col rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-200">
                    <Icon className="h-5 w-5" strokeWidth={1.7} />
                  </div>
                  <span className="rounded-full border border-white/10 bg-black px-2.5 py-1 text-xs text-gray-400">
                    {flow.status}
                  </span>
                </div>

                <div className="mt-5 flex-1">
                  <h2 className="text-lg font-medium text-white">{flow.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">{flow.text}</p>
                </div>

                <Link
                  to={href}
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  Открыть сценарий
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </Link>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
