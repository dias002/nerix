import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Building2, Check, Copy, FileText, Landmark, Mail, ShieldCheck } from "lucide-react";
import StarsBackground from "../components/StarsBackground";

const companyDetails = [
  { label: "Юридическое лицо", value: "Товарищество с ограниченной ответственностью «removed-project»" },
  { label: "БИН", value: "2302 4001 8006" },
  { label: "КБе", value: "17" },
  { label: "Сайт", value: "www.nomduchat.com" },
  { label: "Продукт", value: "nomduchat" },
];

const bankDetails = [
  { label: "Расчетный счет", value: "KZ51 998C TB00 0160 6793" },
  { label: "Банк", value: "АО «Alatau City Bank»" },
  { label: "БИК", value: "TSESKZKA" },
];

const serviceDetails = [
  "Доступ к AI-чату и AI-ассистентам.",
  "Business workspace для работы с заявками, сотрудниками и клиентскими данными.",
  "Генерация и обработка текстов, изображений, аудио, видео и бизнес-материалов.",
  "B2B-инструменты: Telegram-менеджер, сайты, CRM-заметки и рассылки.",
];

export default function Requisites() {
  const [copied, setCopied] = useState(false);
  const requisitesText = buildRequisitesText();

  const copyRequisites = async () => {
    try {
      await navigator.clipboard.writeText(requisitesText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <StarsBackground />

      <header className="fixed left-6 right-6 top-6 z-20 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-medium text-white transition-colors hover:text-gray-300">
          nomduchat
        </Link>
        <Link
          to="/workspace/chat"
          className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
        >
          Открыть сервис
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-28 md:py-32">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          На главную
        </Link>

        <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.78fr] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
              <Building2 className="h-4 w-4" strokeWidth={1.7} />
              Сведения о компании
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold md:text-6xl">Реквизиты nomduchat</h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-gray-400 md:text-lg">
              Публичная страница с юридической информацией оператора сервиса nomduchat, банковскими
              реквизитами и описанием оказываемых услуг.
            </p>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.7} />
              Для платежных провайдеров
            </div>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              Страница размещена на сайте продукта и содержит данные компании, которая принимает оплату за
              доступ к сервису и B2B-инструментам.
            </p>
            <button
              type="button"
              onClick={() => void copyRequisites()}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              {copied ? <Check className="h-4 w-4" strokeWidth={1.8} /> : <Copy className="h-4 w-4" strokeWidth={1.8} />}
              {copied ? "Скопировано" : "Скопировать реквизиты"}
            </button>
          </aside>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DetailsCard icon={FileText} title="Данные компании" items={companyDetails} />
          <DetailsCard icon={Landmark} title="Банковские реквизиты" items={bankDetails} />
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md md:p-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Building2 className="h-4 w-4" strokeWidth={1.7} />
              Услуги
            </div>
            <h2 className="mt-3 text-2xl font-medium">Что оплачивает пользователь</h2>
            <div className="mt-5 space-y-3">
              {serviceDetails.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-gray-300">
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md md:p-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Mail className="h-4 w-4" strokeWidth={1.7} />
              Контакты
            </div>
            <h2 className="mt-3 text-2xl font-medium">Связь с оператором</h2>
            <div className="mt-5 space-y-3 text-sm text-gray-300">
              <a
                href="mailto:admin@nomduchat.com"
                className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20 hover:text-white"
              >
                admin@nomduchat.com
              </a>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 leading-relaxed text-gray-400">
                По вопросам оплаты, доступа к сервису, документов и возвратов.
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

function DetailsCard({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof FileText;
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md md:p-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Icon className="h-4 w-4" strokeWidth={1.7} />
        {title}
      </div>
      <div className="mt-5 divide-y divide-white/10">
        {items.map((item) => (
          <div key={item.label} className="grid grid-cols-1 gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[0.42fr_0.58fr]">
            <div className="text-sm text-gray-500">{item.label}</div>
            <div className="break-words text-sm font-medium text-white">{item.value}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

function buildRequisitesText() {
  return [
    "Реквизиты nomduchat",
    ...companyDetails.map((item) => `${item.label}: ${item.value}`),
    ...bankDetails.map((item) => `${item.label}: ${item.value}`),
    "Контакт: admin@nomduchat.com",
  ].join("\n");
}
