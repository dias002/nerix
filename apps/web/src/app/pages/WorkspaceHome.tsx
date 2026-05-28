import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, MessageSquarePlus } from "lucide-react";
import DownloadAppBanner from "../components/DownloadAppBanner";
import { useLanguage } from "../i18n";

export default function WorkspaceHome() {
  const { t } = useLanguage();

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-6 md:p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto flex min-h-full max-w-4xl flex-col justify-center space-y-8 py-10 text-center"
      >
        <h2 className="text-3xl font-medium text-white">
          {t.workspaceHome.question}
        </h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-500">
          {t.workspaceHome.hint}
        </p>
        
        <Link
          to="/workspace/chat"
          className="inline-flex items-center gap-3 px-6 py-3.5 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white rounded-xl border border-white/10 transition-colors mx-auto"
        >
          <MessageSquarePlus className="w-5 h-5" />
          <span>{t.workspaceHome.startChat}</span>
        </Link>

        <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 text-left">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-lg font-medium text-white">{t.workspaceHome.servicesTitle}</h3>
            <Link to="/workspace/agents" className="hidden items-center gap-1 text-sm text-gray-500 transition-colors hover:text-white sm:flex">
              {t.nav.agents}
              <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {t.workspaceHome.services.map((service) => (
              <Link
                key={service.title}
                to="/workspace/agents"
                className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
              >
                <h4 className="text-base font-medium text-white">{service.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{service.text}</p>
              </Link>
            ))}
          </div>
        </div>

        <DownloadAppBanner />
      </motion.div>
    </div>
  );
}
