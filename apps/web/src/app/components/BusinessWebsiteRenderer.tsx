import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import type { BusinessWebsiteContentApiRecord, BusinessWebsiteSectionApiRecord } from "../api";

type BusinessWebsiteRendererProps = {
  content: BusinessWebsiteContentApiRecord;
  compact?: boolean;
};

export default function BusinessWebsiteRenderer({ content, compact = false }: BusinessWebsiteRendererProps) {
  const page = content.pages[0];
  const theme = content.theme;

  return (
    <div
      className="min-h-full overflow-hidden"
      style={{
        background: theme.background,
        color: theme.text,
      }}
    >
      <header
        className={`mx-auto flex w-full max-w-6xl items-center justify-between px-5 ${compact ? "py-4" : "py-6"}`}
      >
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{page.title}</div>
          <div className="mt-1 text-sm" style={{ color: theme.muted }}>
            {content.contact.city || "Сайт компании"}
          </div>
        </div>
        <a
          href={primaryContactHref(content)}
          className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
          style={{ background: theme.accent, color: theme.accentText }}
        >
          <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
          Связаться
        </a>
      </header>

      <main>
        {page.sections.map((section, index) => (
          <WebsiteSection key={section.id || `${section.type}-${index}`} section={section} theme={theme} compact={compact} />
        ))}
      </main>
    </div>
  );
}

function WebsiteSection({
  section,
  theme,
  compact,
}: {
  section: BusinessWebsiteSectionApiRecord;
  theme: BusinessWebsiteContentApiRecord["theme"];
  compact: boolean;
}) {
  if (section.type === "hero") {
    return (
      <section className={`mx-auto max-w-6xl px-5 ${compact ? "py-8" : "py-16 md:py-20"}`}>
        <div className="max-w-4xl">
          <div className="mb-5 inline-flex rounded-full px-3 py-1 text-sm" style={{ background: theme.surface, color: theme.muted }}>
            Сайт собран в nomduchat
          </div>
          <h1 className={`${compact ? "text-3xl" : "text-5xl md:text-7xl"} font-semibold leading-tight`}>
            {section.title}
          </h1>
          {section.subtitle ? (
            <p className={`${compact ? "mt-4 text-base" : "mt-6 text-xl"} max-w-3xl leading-relaxed`} style={{ color: theme.muted }}>
              {section.subtitle}
            </p>
          ) : null}
          {section.buttonText ? (
            <a
              href={section.buttonHref || "#contacts"}
              className="mt-8 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium"
              style={{ background: theme.accent, color: theme.accentText }}
            >
              {section.buttonText}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </a>
          ) : null}
        </div>
      </section>
    );
  }

  if (section.type === "cta") {
    return (
      <section className={`px-5 ${compact ? "py-6" : "py-12"}`}>
        <div className="mx-auto max-w-6xl rounded-[28px] p-6 md:p-10" style={{ background: theme.accent, color: theme.accentText }}>
          <h2 className={`${compact ? "text-2xl" : "text-4xl"} font-semibold`}>{section.title}</h2>
          {section.subtitle ? <p className="mt-3 max-w-2xl text-base opacity-85">{section.subtitle}</p> : null}
          {section.buttonText ? (
            <a
              href={section.buttonHref || "#contacts"}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black"
            >
              {section.buttonText}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </a>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section id={section.type === "contacts" ? "contacts" : undefined} className={`px-5 ${compact ? "py-6" : "py-12"}`}>
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <h2 className={`${compact ? "text-2xl" : "text-4xl"} font-semibold`}>{section.title}</h2>
          {section.subtitle ? <p className="mt-3 leading-relaxed" style={{ color: theme.muted }}>{section.subtitle}</p> : null}
          {section.body ? <p className="mt-3 leading-relaxed" style={{ color: theme.muted }}>{section.body}</p> : null}
        </div>

        {section.items?.length ? (
          <div className={`mt-6 grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
            {section.items.map((item, index) => (
              <div key={`${section.id}-${index}`} className="rounded-2xl p-4" style={{ background: theme.surface }}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: theme.accent }} strokeWidth={1.8} />
                  <div className="text-sm leading-relaxed" style={{ color: section.type === "faq" ? theme.muted : theme.text }}>
                    {item}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {section.buttonText ? (
          <a
            href={section.buttonHref || "#contacts"}
            className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium"
            style={{ background: theme.accent, color: theme.accentText }}
          >
            {section.buttonText}
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </a>
        ) : null}
      </div>
    </section>
  );
}

function primaryContactHref(content: BusinessWebsiteContentApiRecord) {
  const contact = content.contact;
  if (contact.telegram) return `https://t.me/${contact.telegram.replace(/^@/, "")}`;
  if (contact.whatsapp) return contact.whatsapp;
  if (contact.phone) return `tel:${contact.phone.replace(/[^\d+]/g, "")}`;
  return "#contacts";
}
