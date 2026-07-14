import { useEffect } from "react";
import { Link } from "react-router";
import { ArrowLeft, Gift, Link2, Settings, Users } from "lucide-react";
import StarsBackground from "../components/StarsBackground";
import LanguageSwitch from "../components/LanguageSwitch";
import { setPageSeo } from "../seo";

const steps = [
  {
    title: "Скопируйте ссылку",
    text: "Персональная ссылка находится в профиле: настройки, профиль, реферальная ссылка.",
    icon: Link2,
  },
  {
    title: "Пригласите пользователя",
    text: "Новый пользователь регистрируется по вашей ссылке, а источник сохраняется в параметре регистрации.",
    icon: Users,
  },
  {
    title: "Получите бонус",
    text: "Бонусная механика подключается к платежам и может использоваться для акций или внутренних начислений.",
    icon: Gift,
  },
];

export default function ReferralProgram() {
  useEffect(() => {
    setPageSeo(
      "Реферальная программа nomduchat",
      "Как работает реферальная ссылка и где найти приглашение в профиле nomduchat.",
      "/about-referral-program",
    );
  }, []);

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

        <section className="mt-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            <Gift className="h-4 w-4" strokeWidth={1.7} />
            Реферальная программа
          </div>
          <h1 className="mt-5 text-4xl font-semibold md:text-6xl">Приглашайте пользователей через личную ссылку</h1>
          <p className="mt-5 text-base leading-relaxed text-gray-400 md:text-lg">
            В nomduchat уже есть персональная ссылка в настройках профиля. Ее можно отправлять клиентам, коллегам и партнерам, чтобы регистрация приходила с вашим ref-кодом.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.title} className="rounded-2xl border border-white/10 bg-[#080808]/86 p-5 backdrop-blur-md">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                <step.icon className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <h2 className="text-lg font-medium text-white">{step.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">{step.text}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#080808]/86 p-5 backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-medium text-white">Где найти ссылку</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                Откройте профиль в личном кабинете. Там можно скопировать готовую ссылку вида `/auth?mode=register&ref=...`.
              </p>
            </div>
            <Link
              to="/workspace/settings/profile"
              className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              <Settings className="h-4 w-4" strokeWidth={1.8} />
              Открыть профиль
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
