import { Link } from "react-router";
import { ArrowLeft, Building2, FileText, Mail, MapPin } from "lucide-react";
import StarsBackground from "../components/StarsBackground";

const contacts = [
  {
    label: "Поддержка и платежи",
    value: "admin@nomduchat.com",
    href: "mailto:admin@nomduchat.com?subject=Вопрос%20по%20nomduchat",
    icon: Mail,
  },
  {
    label: "Реквизиты компании",
    value: "ТОО «removed-project»",
    href: "/requisites",
    icon: Building2,
  },
  {
    label: "Документы",
    value: "Соглашение, конфиденциальность, возвраты",
    href: "/legal/terms",
    icon: FileText,
  },
];

export default function Contacts() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <StarsBackground />

      <header className="fixed left-6 right-6 top-6 z-20 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-medium text-white transition-colors hover:text-gray-300">
          nomduchat
        </Link>
        <Link
          to="/faq"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
        >
          FAQ
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-28 md:py-32">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
          На главную
        </Link>

        <section className="mt-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            <MapPin className="h-4 w-4" strokeWidth={1.7} />
            Контакты
          </div>
          <h1 className="mt-5 text-4xl font-semibold md:text-6xl">Связаться с nomduchat</h1>
          <p className="mt-5 text-base leading-relaxed text-gray-400 md:text-lg">
            Для вопросов по оплате, доступу, документам и удалению данных используйте официальный email поддержки.
          </p>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {contacts.map((contact) => (
            <a
              key={contact.label}
              href={contact.href}
              className="rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md transition-colors hover:border-white/20 md:p-6"
            >
              <contact.icon className="h-6 w-6 text-gray-300" strokeWidth={1.7} />
              <div className="mt-5 text-sm text-gray-500">{contact.label}</div>
              <div className="mt-2 text-base font-medium text-white">{contact.value}</div>
            </a>
          ))}
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-[#080808]/85 p-5 backdrop-blur-md md:p-6">
          <h2 className="text-2xl font-medium text-white">Юридическая информация</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-400 md:text-base">
            Оператор сервиса: Товарищество с ограниченной ответственностью «removed-project». Реквизиты, условия оплаты,
            возвратов и обработки персональных данных размещены в открытых документах сайта.
          </p>
        </section>
      </main>
    </div>
  );
}
