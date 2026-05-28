import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Building2, GraduationCap, MessageSquare, Sparkles, Users } from "lucide-react";
import StarsBackground from "../components/StarsBackground";
import LanguageSwitch from "../components/LanguageSwitch";
import DownloadAppBanner from "../components/DownloadAppBanner";
import { useLanguage } from "../i18n";

export default function About() {
  const { t } = useLanguage();
  const [activeAudience, setActiveAudience] = useState(0);
  const audienceIcons = [Building2, Sparkles, GraduationCap, Users];
  const ActiveIcon = audienceIcons[activeAudience] ?? Sparkles;
  const selectedAudience = t.about.audiences[activeAudience];

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-black text-white">
      <StarsBackground />

      <div className="fixed left-8 top-8 z-20">
        <Link to="/" className="text-xl font-medium text-white transition-colors hover:text-gray-300">
          {t.product}
        </Link>
      </div>

      <div className="fixed right-6 top-8 z-30">
        <LanguageSwitch />
      </div>

      <main className="relative z-10 mx-auto min-h-screen max-w-6xl px-6 py-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="space-y-10"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
            {t.about.backHome}
          </Link>

          <div className="max-w-3xl">
            <div className="mb-5 w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
              {t.about.badge}
            </div>
            <h1 className="text-4xl font-semibold md:text-6xl">{t.about.title}</h1>
            <p className="mt-5 text-lg leading-relaxed text-gray-400">{t.about.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {t.about.metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-[#0A0A0A]/82 p-5 backdrop-blur-md">
                <div className="text-3xl font-medium text-white">{metric.value}</div>
                <div className="mt-2 text-sm text-gray-500">{metric.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {t.about.sections.map((section, index) => (
              <motion.article
                key={section.title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.07 }}
                className="rounded-2xl border border-white/10 bg-[#0A0A0A]/82 p-5 backdrop-blur-md"
              >
                <div className="mb-5 text-sm text-gray-500">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h2 className="text-lg font-medium text-white">{section.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{section.text}</p>
              </motion.article>
            ))}
          </div>

          <section className="rounded-3xl border border-white/10 bg-[#070707]/86 p-5 md:p-6 backdrop-blur-md">
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-medium text-white">{t.about.audiencesTitle}</h2>
                <p className="mt-2 text-sm text-gray-500">{t.home.explainText}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-1">
                {t.about.audiences.map((audience, index) => {
                  const Icon = audienceIcons[index] ?? Sparkles;
                  const active = activeAudience === index;
                  return (
                    <button
                      key={audience.title}
                      type="button"
                      onClick={() => setActiveAudience(index)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                        active
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-white/5 bg-white/[0.03] text-gray-400 hover:border-white/15 hover:text-white"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.6} />
                      <span className="text-sm font-medium">{audience.title}</span>
                    </button>
                  );
                })}
              </div>

              <motion.div
                key={selectedAudience.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="rounded-2xl border border-white/10 bg-black/35 p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                    <ActiveIcon className="h-5 w-5" strokeWidth={1.6} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-medium text-white">{selectedAudience.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-gray-500">{selectedAudience.text}</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-3">
                  {selectedAudience.examples.map((example) => (
                    <div key={example} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-gray-400">
                      {example}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>

          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-medium text-white">{t.about.servicesTitle}</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {t.about.services.map((service, index) => (
                <motion.article
                  key={service.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="rounded-2xl border border-white/10 bg-[#0A0A0A]/82 p-5 backdrop-blur-md"
                >
                  <div className="mb-5 text-sm text-gray-500">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-lg font-medium text-white">{service.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">{service.text}</p>
                </motion.article>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Link
              to="/workspace/chat"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
              {t.about.openApp}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>

          <DownloadAppBanner />
        </motion.div>
      </main>
    </div>
  );
}
