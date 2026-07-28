import { Link } from "react-router";
import { motion } from "motion/react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  CreditCard,
  Database,
  FileText,
  Globe,
  LineChart,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import StarsBackground from "../components/StarsBackground";
import { useLanguage } from "../i18n";

export default function Business() {
  const { t } = useLanguage();
  const sectionIcons = [ShieldCheck, Bot, Globe, MessageSquare, BarChart3, CreditCard];
  const analyticsIcons = [LineChart, Activity, Database, Wrench];
  const cabinetHighlights = [
    {
      title: "Business открывает кабинет",
      text: "Доступ появляется у главного аккаунта после подписки: владелец приглашает сотрудников, выдает роли и контролирует работу команды.",
      icon: Building2,
    },
    {
      title: "До 5 сотрудников и роли",
      text: "Владелец, менеджер продаж, оператор, маркетолог и разработчик работают в одном пространстве, но видят только нужные разделы.",
      icon: Users,
    },
    {
      title: "CRM, обращения и заметки",
      text: "Заявки из сайта, бота и рекламы попадают в воронку. По клиенту можно оставить проблему, договоренность или следующий шаг.",
      icon: FileText,
    },
    {
      title: "Контекст компании для ответов",
      text: "Агент использует услуги, FAQ, прайс, переписки и CRM, чтобы сотрудникам не приходилось каждый раз искать одно и то же.",
      icon: Sparkles,
    },
  ];
  const businessProducts = [
    {
      title: "Бот для чата или сайта",
      text: "Отвечает клиентам 24/7, собирает контакты, передает теплые заявки и снижает нагрузку на оператора.",
      icon: Bot,
    },
    {
      title: "Ассистент воронки",
      text: "Следит за этапами сделки, замечает зависшие лиды, подсказывает следующий шаг и помогает не терять продажи.",
      icon: Workflow,
    },
    {
      title: "Сайт с аналитикой посещений",
      text: "Можно запустить страницу под услугу, смотреть визиты, источники, популярные блоки и заявки прямо в кабинете.",
      icon: Globe,
    },
    {
      title: "API для коммерческого использования",
      text: "Перспективный слой для компаний: запросы, история, роли, контроль рисков и подключение собственных сценариев через backend.",
      icon: Database,
      href: "/support",
      cta: "Обсудить API",
    },
  ];

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-black text-white">
      <StarsBackground />

      <div className="fixed left-8 top-8 z-20">
        <Link to="/" className="inline-flex min-h-11 items-center text-xl font-medium text-white transition-colors hover:text-gray-300">
          {t.product}
        </Link>
      </div>

      <main className="relative z-10 mx-auto min-h-screen max-w-6xl px-6 py-28 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="space-y-10"
        >
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
            {t.business.backHome}
          </Link>

          <div className="max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
              <BriefcaseBusiness className="h-4 w-4" strokeWidth={1.7} />
              {t.business.badge}
            </div>
            <h1 className="text-4xl font-semibold md:text-6xl">{t.business.title}</h1>
            <p className="mt-5 text-lg leading-relaxed text-gray-400">{t.business.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {t.business.metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-[#0A0A0A]/82 p-5 backdrop-blur-md">
                <div className="text-3xl font-medium text-white">{metric.value}</div>
                <div className="mt-2 text-sm text-gray-500">{metric.label}</div>
              </div>
            ))}
          </div>

          <section className="space-y-5">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-3">
                <BriefcaseBusiness className="h-5 w-5 text-gray-400" strokeWidth={1.7} />
                <h2 className="text-2xl font-medium text-white">Business кабинет для команды</h2>
              </div>
              <p className="text-base leading-relaxed text-gray-500">
                Business дает компании отдельное рабочее место: сотрудники, заявки, клиентские проблемы, аналитика сайта и агент по данным компании собраны в одном интерфейсе.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cabinetHighlights.map((item, index) => (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="rounded-2xl border border-white/10 bg-[#080808]/84 p-5 backdrop-blur-md"
                >
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                    <item.icon className="h-5 w-5" strokeWidth={1.6} />
                  </div>
                  <h3 className="text-lg font-medium text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">{item.text}</p>
                </motion.article>
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-3">
                <Bot className="h-5 w-5 text-gray-400" strokeWidth={1.7} />
                <h2 className="text-2xl font-medium text-white">Что можно подключить поверх тарифа</h2>
              </div>
              <p className="text-base leading-relaxed text-gray-500">
                Поверх кабинета можно заказать бота, ассистента продаж или сайт, который сразу связан с обращениями, метриками и CRM.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {businessProducts.map((item) => (
                <article key={item.title} className="rounded-2xl border border-white/10 bg-[#080808]/84 p-5 backdrop-blur-md">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                    <item.icon className="h-5 w-5" strokeWidth={1.6} />
                  </div>
                  <h3 className="text-lg font-medium text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">{item.text}</p>
                  {item.href ? (
                    <Link
                      to={item.href}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-300 transition-colors hover:text-white"
                    >
                      {item.cta ?? "Открыть"}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-2xl border border-white/10 bg-[#070707]/86 p-6 backdrop-blur-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                <Activity className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-gray-500">{t.business.oversightKicker}</p>
              <h2 className="mt-3 text-2xl font-medium text-white md:text-3xl">{t.business.oversightTitle}</h2>
              <p className="mt-4 text-base leading-relaxed text-gray-400">{t.business.oversightText}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A]/82 p-6 backdrop-blur-md">
              <div className="space-y-4">
                {t.business.oversightItems.map((item) => (
                  <div key={item.title} className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                    <h3 className="text-base font-medium text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gray-400" strokeWidth={1.7} />
              <h2 className="text-2xl font-medium text-white">{t.business.sectionsTitle}</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {t.business.sections.map((section, index) => {
                const Icon = sectionIcons[index] ?? MessageSquare;
                return (
                  <motion.article
                    key={section.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.06 }}
                    className="rounded-2xl border border-white/10 bg-[#080808]/84 p-5 backdrop-blur-md"
                  >
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                      <Icon className="h-5 w-5" strokeWidth={1.6} />
                    </div>
                    <h3 className="text-lg font-medium text-white">{section.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-gray-500">{section.text}</p>
                  </motion.article>
                );
              })}
            </div>
          </section>

          <section className="space-y-5">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-gray-400" strokeWidth={1.7} />
                <h2 className="text-2xl font-medium text-white">{t.business.analyticsTitle}</h2>
              </div>
              <p className="text-base leading-relaxed text-gray-500">{t.business.analyticsSubtitle}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {t.business.analytics.map((item, index) => {
                const Icon = analyticsIcons[index] ?? LineChart;
                return (
                  <article key={item.title} className="rounded-2xl border border-white/10 bg-[#080808]/84 p-5 backdrop-blur-md">
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                      <Icon className="h-5 w-5" strokeWidth={1.6} />
                    </div>
                    <h3 className="text-lg font-medium text-white">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-gray-500">{item.text}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Link
              to="/workspace/balance"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 sm:whitespace-nowrap"
            >
              Оформить Business
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
            <Link
              to="/workspace/business"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              Открыть бизнес-кабинет
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
