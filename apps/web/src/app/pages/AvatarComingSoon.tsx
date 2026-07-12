import { Link } from "react-router";
import { ArrowRight, Clock3, Sparkles, UserRound, Video } from "lucide-react";

const roadmap = [
  {
    title: "Визуальный стиль",
    text: "Готовим отдельный образ nomduchat-аватара вместо временного технического прототипа.",
  },
  {
    title: "Фото и голос",
    text: "Проверяем сценарий, где пользователь загружает фото, а сервис собирает аккуратный цифровой образ.",
  },
  {
    title: "Аватар-видео",
    text: "Подключаем генерацию роликов с ведущим, речью и понятным статусом обработки.",
  },
];

export default function AvatarComingSoon() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] px-5 py-6 text-white md:px-10 md:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-6xl flex-col justify-center gap-8">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-gray-300">
              <Clock3 className="h-4 w-4" strokeWidth={1.7} />
              Раздел в разработке
            </div>

            <h1 className="mt-6 text-3xl font-medium leading-tight text-white sm:text-4xl lg:text-5xl">
              Аватар nomduchat скоро появится в рабочем пространстве
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-400">
              Мы временно закрыли студию аватара, чтобы довести визуал, обработку фото и генерацию видео до уровня,
              который можно спокойно показывать пользователям.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/workspace/chat"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              >
                Перейти в чат
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
              <Link
                to="/workspace/apps"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 px-5 text-sm font-medium text-gray-300 transition-colors hover:border-white/25 hover:text-white"
              >
                Открыть приложения
              </Link>
            </div>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#0B0B0B]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(32,227,178,0.2),transparent_32%),radial-gradient(circle_at_78%_70%,rgba(124,58,237,0.16),transparent_30%)]" />
            <div className="relative flex h-full min-h-[360px] flex-col items-center justify-center px-6 py-10 text-center">
              <div className="relative">
                <div className="flex h-36 w-36 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
                  <UserRound className="h-16 w-16 text-white" strokeWidth={1.35} />
                </div>
                <div className="absolute -right-4 top-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
                  <Sparkles className="h-5 w-5" strokeWidth={1.7} />
                </div>
                <div className="absolute -bottom-3 -left-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-300/10 text-violet-100">
                  <Video className="h-5 w-5" strokeWidth={1.7} />
                </div>
              </div>
              <div className="mt-9 max-w-sm text-sm leading-relaxed text-gray-400">
                Здесь появится отдельный продукт для персонального аватара, презентаций и коротких видео от лица
                пользователя.
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {roadmap.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
              <h2 className="text-base font-medium text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">{item.text}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
