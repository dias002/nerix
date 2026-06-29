import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, Building2, ChevronDown, FileText, LifeBuoy } from "lucide-react";
import StarsBackground from "../components/StarsBackground";
import LanguageSwitch from "../components/LanguageSwitch";
import DownloadAppBanner from "../components/DownloadAppBanner";
import { useLanguage } from "../i18n";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-black text-white">
      <StarsBackground />

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed top-8 left-8 z-20"
      >
        <h1 className="text-xl font-medium">
          {t.product}
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="fixed right-6 top-8 z-30"
      >
        <LanguageSwitch />
      </motion.div>

      {/* Hero Section */}
      <section className="relative z-10 flex min-h-[760px] flex-col items-center justify-start px-6 pb-20 pt-24 md:min-h-[820px] md:justify-center md:py-0">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="max-w-3xl mx-auto text-center space-y-6"
        >
          <div className="mx-auto w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            {t.home.eyebrow}
          </div>
          <h2 className="text-4xl md:text-6xl font-semibold">
            {t.home.welcome}
          </h2>
          <p className="mx-auto max-w-2xl text-lg md:text-xl text-gray-400 font-light leading-relaxed">
            {t.home.subtitle}
          </p>

          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
            {t.home.metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                <div className="text-2xl font-medium text-white">{metric.value}</div>
                <div className="mt-1 text-xs leading-relaxed text-gray-500">{metric.label}</div>
              </div>
            ))}
          </div>

          <div className="pt-8">
            <Link
              to="/workspace/chat"
              className="inline-flex items-center justify-center px-10 py-3.5 rounded-full bg-white text-black text-base font-medium hover:bg-gray-200 transition-colors"
            >
              {t.home.enter}
            </Link>
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white"
                >
                  <BookOpen className="h-4 w-4" strokeWidth={1.6} />
                  {t.home.aboutProject}
                </Link>
                <Link
                  to="/business"
                  className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white"
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
                  {t.home.forBusiness}
                </Link>
                <Link
                  to="/requisites"
                  className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white"
                >
                  <Building2 className="h-4 w-4" strokeWidth={1.6} />
                  Реквизиты
                </Link>
                <Link
                  to="/legal/terms"
                  className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white"
                >
                  <FileText className="h-4 w-4" strokeWidth={1.6} />
                  Документы
                </Link>
                <Link
                  to="/support"
                  className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white"
                >
                  <LifeBuoy className="h-4 w-4" strokeWidth={1.6} />
                  Поддержка
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="relative z-10 px-6 pb-28">
        <div className="mx-auto max-w-5xl space-y-8">
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <h2 className="text-3xl md:text-4xl font-medium text-white">
              {t.home.explainTitle}
            </h2>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-gray-400">
              {t.home.explainText}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 1, y: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="rounded-3xl border border-white/10 bg-[#070707]/85 p-5 md:p-6 backdrop-blur-md"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl md:text-3xl font-medium text-white">
                  {t.home.servicesTitle}
                </h2>
                <p className="mt-3 text-sm md:text-base leading-relaxed text-gray-500">
                  {t.home.servicesText}
                </p>
              </div>
              <Link
                to="/about"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
              >
                {t.home.aboutProject}
                <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              {t.home.services.map((service, index) => (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 1, y: 0 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-120px" }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                >
                  <div className="mb-4 text-sm text-gray-500">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-base font-medium text-white">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{service.text}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <DownloadAppBanner />

          <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
            <Link to="/legal/terms" className="transition-colors hover:text-white">
              Пользовательское соглашение
            </Link>
            <Link to="/legal/privacy" className="transition-colors hover:text-white">
              Политика конфиденциальности
            </Link>
            <Link to="/legal/refund" className="transition-colors hover:text-white">
              Возвраты
            </Link>
            <Link to="/legal/pricing" className="transition-colors hover:text-white">
              Тарифы
            </Link>
            <Link to="/support" className="transition-colors hover:text-white">
              Поддержка
            </Link>
            <Link to="/data-deletion" className="transition-colors hover:text-white">
              Удаление данных
            </Link>
          </nav>
        </div>
      </section>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.9 }}
        className="fixed bottom-8 left-8 z-20 hidden items-center gap-2 text-xs text-gray-500 md:flex"
      >
        <ChevronDown className="w-4 h-4 animate-bounce" />
        <span>{t.home.scroll}</span>
      </motion.div>
    </div>
  );
}
