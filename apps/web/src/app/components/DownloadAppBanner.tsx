import { Download, Smartphone } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../i18n";

type DownloadAppBannerProps = {
  className?: string;
};

export default function DownloadAppBanner({ className = "" }: DownloadAppBannerProps) {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`border border-white/10 bg-[#0A0A0A]/85 rounded-2xl p-4 md:p-5 backdrop-blur-md ${className}`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
            <Smartphone className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-base font-medium text-white">{t.download.title}</h3>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-gray-500">
              {t.download.text}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {[t.download.ios, t.download.android].map((label) => (
            <button
              key={label}
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white text-black px-4 text-sm font-medium transition-colors hover:bg-gray-200"
            >
              <Download className="h-4 w-4" strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
