import { Link } from "react-router";
import type { ReactNode } from "react";
import { ArrowLeft, CircleUser, Globe, Mail, Shield } from "lucide-react";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";

export default function SettingsProfile() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const rows = [
    { label: t.settings.profile, value: user?.name || t.auth.guest, icon: CircleUser },
    { label: t.auth.email, value: user?.email ?? "—", icon: Mail },
    { label: t.settings.country, value: user?.country ?? "KZ", icon: Globe },
    { label: t.settings.security, value: user ? t.settings.protected : t.auth.guestHint, icon: Shield },
  ];

  return (
    <SettingsDetailShell title={t.settings.profile} subtitle={t.settings.profileSubtitle}>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0D0D]">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-4 p-4 ${
              index !== rows.length - 1 ? "border-b border-white/5" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <row.icon className="h-5 w-5 shrink-0 text-gray-400" strokeWidth={1.6} />
              <span className="text-gray-200">{row.label}</span>
            </div>
            <span className="truncate text-sm text-gray-500">{row.value}</span>
          </div>
        ))}
      </div>
    </SettingsDetailShell>
  );
}

export function SettingsDetailShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-8 md:p-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-5">
          <Link
            to="/workspace/settings"
            className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
            {t.settings.backToSettings}
          </Link>
          <div>
            <h2 className="text-2xl font-medium text-white">{title}</h2>
            <p className="mt-2 text-gray-400">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
