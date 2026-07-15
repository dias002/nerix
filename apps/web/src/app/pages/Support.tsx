import { Link } from "react-router";
import { useState } from "react";
import { ArrowLeft, Check, Copy, CreditCard, LifeBuoy, Mail, RefreshCcw, ShieldCheck } from "lucide-react";
import StarsBackground from "../components/StarsBackground";

const supportEmail = "admin@nomduchat.com";

const supportTopics = [
  {
    title: "Оплата и чек",
    text: "Поможем проверить статус платежа, чек, тариф, повторное списание или ошибку YooKassa/Kaspi.",
    icon: CreditCard,
  },
  {
    title: "Доступ к аккаунту",
    text: "Проверим вход, активный тариф, баланс кредитов, бизнес-workspace и права сотрудника.",
    icon: ShieldCheck,
  },
  {
    title: "Возврат",
    text: "Разберем платеж, использование лимитов и возможность возврата по условиям сервиса.",
    icon: RefreshCcw,
  },
];

export default function Support() {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    await navigator.clipboard?.writeText(supportEmail);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <StarsBackground />

      <header className="fixed left-6 right-6 top-6 z-20 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-medium text-white transition-colors hover:text-gray-300">
          nomduchat
        </Link>
        <Link
          to="/requisites"
          className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
        >
          Реквизиты
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-28 md:py-32">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          На главную
        </Link>

        <section className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            <LifeBuoy className="h-4 w-4" strokeWidth={1.7} />
            Поддержка nomduchat
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold md:text-6xl">Помощь по оплате и доступу</h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-gray-400 md:text-lg">
            Напишите с email аккаунта и приложите ID платежа, если вопрос связан с оплатой. Так мы быстрее найдем операцию.
          </p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            <a
              href={`mailto:${supportEmail}?subject=${encodeURIComponent("Поддержка nomduchat")}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              <Mail className="h-4 w-4" strokeWidth={1.8} />
              {supportEmail}
            </a>
            <button
              type="button"
              onClick={copyEmail}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              {copied ? <Check className="h-4 w-4" strokeWidth={1.8} /> : <Copy className="h-4 w-4" strokeWidth={1.8} />}
              {copied ? "Скопировано" : "Копировать email"}
            </button>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {supportTopics.map((topic) => (
            <article key={topic.title} className="rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md">
              <topic.icon className="h-5 w-5 text-gray-400" strokeWidth={1.7} />
              <h2 className="mt-4 text-xl font-medium">{topic.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">{topic.text}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md md:p-6">
          <h2 className="text-2xl font-medium">Что указать в обращении</h2>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              "Email аккаунта nomduchat.",
              "ID платежа из раздела Баланс, если вопрос по оплате.",
              "Тариф, страна оплаты и примерное время операции.",
              "Короткое описание проблемы и скриншот, если он помогает.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300">
                {item}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
