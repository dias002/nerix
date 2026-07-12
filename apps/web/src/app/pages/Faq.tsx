import { Link } from "react-router";
import { ArrowLeft, CreditCard, HelpCircle, MessageSquare, ShieldCheck, UserRound } from "lucide-react";
import StarsBackground from "../components/StarsBackground";

const faqGroups = [
  {
    title: "Аккаунт и вход",
    icon: UserRound,
    items: [
      {
        question: "Можно ли пользоваться без регистрации?",
        answer: "Да, базовый чат доступен гостю. Аккаунт нужен, чтобы сохранить историю, подписку, файлы, память и настройки.",
      },
      {
        question: "Почему для России не показывается Google-вход?",
        answer: "При выборе России быстрый вход через Google скрыт. Для других стран Google остается доступным, а VK ID доступен в форме входа.",
      },
    ],
  },
  {
    title: "Чат и ответы",
    icon: MessageSquare,
    items: [
      {
        question: "Как выбрать стиль ответа?",
        answer: "В чате есть режим авто-подбора. Он подбирает формат ответа под задачу, а ручные стили можно расширять в настройках интерфейса.",
      },
      {
        question: "Почему ответ иногда идет не сразу?",
        answer: "Сервис маршрутизирует задачу к подходящему AI-провайдеру. Текст обычно приходит быстрее, медиа, видео и аватары требуют больше времени.",
      },
    ],
  },
  {
    title: "Оплата",
    icon: CreditCard,
    items: [
      {
        question: "Где посмотреть тарифы и примеры?",
        answer: "Откройте раздел «Подписка» в рабочем пространстве. В карточках тарифов указаны лимиты, цена и примеры задач.",
      },
      {
        question: "Что делать, если платеж не прошел?",
        answer: "В разделе «Подписка» отображается история платежей. По неуспешной операции можно создать новый платеж или написать в поддержку.",
      },
    ],
  },
  {
    title: "Данные",
    icon: ShieldCheck,
    items: [
      {
        question: "Где политика конфиденциальности и cookies?",
        answer: "Документы доступны внизу главной страницы: пользовательское соглашение, политика конфиденциальности и согласие на cookies.",
      },
      {
        question: "Как удалить аккаунт?",
        answer: "На странице удаления данных есть инструкция и контакт поддержки для запроса удаления аккаунта и связанных данных.",
      },
    ],
  },
];

export default function Faq() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <StarsBackground />

      <header className="fixed left-6 right-6 top-6 z-20 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-medium text-white transition-colors hover:text-gray-300">
          nomduchat
        </Link>
        <Link
          to="/contacts"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
        >
          Контакты
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-28 md:py-32">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          На главную
        </Link>

        <section className="mt-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            <HelpCircle className="h-4 w-4" strokeWidth={1.7} />
            FAQ
          </div>
          <h1 className="mt-5 text-4xl font-semibold md:text-6xl">Вопросы и ответы</h1>
          <p className="mt-5 text-base leading-relaxed text-gray-400 md:text-lg">
            Короткие ответы по входу, оплате, чату, данным и основным сценариям nomduchat.
          </p>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {faqGroups.map((group) => (
            <article key={group.title} className="rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <group.icon className="h-5 w-5 text-gray-300" strokeWidth={1.7} />
                <h2 className="text-xl font-medium text-white">{group.title}</h2>
              </div>
              <div className="space-y-5">
                {group.items.map((item) => (
                  <div key={item.question}>
                    <h3 className="text-base font-medium text-white">{item.question}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.answer}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/workspace/chat"
            className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            Открыть чат
          </Link>
          <Link
            to="/support"
            className="inline-flex items-center justify-center rounded-full border border-white/10 px-5 py-2.5 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
          >
            Написать в поддержку
          </Link>
        </section>
      </main>
    </div>
  );
}
