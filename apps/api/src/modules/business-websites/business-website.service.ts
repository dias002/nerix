import { DomainError, fail, ok } from "../../domain/result.js";
import type { BusinessWebsiteRepository } from "./business-website.repository.js";
import type {
  BusinessWebsiteContent,
  BusinessWebsiteCountry,
  BusinessWebsiteSection,
  BusinessWebsiteStyle,
  BusinessWebsiteTheme,
  BusinessWebsiteType,
  CreateBusinessWebsiteDraftInput,
  CreateBusinessWebsiteRepositoryInput,
  UpdateBusinessWebsiteInput,
} from "./business-website.types.js";

const styleThemes: Record<BusinessWebsiteStyle, BusinessWebsiteTheme> = {
  clean: {
    background: "#F7F8FA",
    surface: "#FFFFFF",
    text: "#111827",
    muted: "#5B6472",
    accent: "#0EA5E9",
    accentText: "#FFFFFF",
  },
  premium: {
    background: "#0B0D10",
    surface: "#151922",
    text: "#F8FAFC",
    muted: "#A7B0BE",
    accent: "#D6B56D",
    accentText: "#111111",
  },
  bold: {
    background: "#101820",
    surface: "#FFFFFF",
    text: "#111827",
    muted: "#475569",
    accent: "#F97316",
    accentText: "#111111",
  },
  warm: {
    background: "#F8F5F0",
    surface: "#FFFFFF",
    text: "#1F2937",
    muted: "#6B5F56",
    accent: "#10B981",
    accentText: "#FFFFFF",
  },
};

const typeLabels: Record<BusinessWebsiteType, string> = {
  landing: "лендинг",
  services: "сайт услуг",
  catalog: "мини-каталог",
};

export class BusinessWebsiteService {
  constructor(private readonly repository: BusinessWebsiteRepository) {}

  async listWebsites(userId: string) {
    return ok({
      websites: await this.repository.listByUser(userId),
    });
  }

  async getWebsite(userId: string, siteId: string) {
    const website = await this.repository.getById(userId, siteId);
    if (!website) return fail(new DomainError("not_found", "Business website was not found.", 404));
    return ok({ website });
  }

  async getPublishedWebsite(slug: string) {
    const website = await this.repository.getPublishedBySlug(slug);
    if (!website) return fail(new DomainError("not_found", "Published website was not found.", 404));
    return ok({ website });
  }

  async createDraft(input: CreateBusinessWebsiteDraftInput) {
    const normalized = normalizeDraftInput(input);
    if (!normalized.prompt || normalized.prompt.length < 20) {
      return fail(new DomainError("validation_failed", "Опишите бизнес и сайт хотя бы в одном коротком абзаце.", 400));
    }

    const generated = generateWebsiteContent(normalized);
    const repositoryInput: CreateBusinessWebsiteRepositoryInput = {
      userId: normalized.userId,
      workspaceId: null,
      country: normalized.country,
      status: "draft",
      slug: buildSlug(generated.title),
      title: generated.title,
      prompt: normalized.prompt,
      siteType: normalized.siteType,
      style: normalized.style,
      content: generated.content,
    };

    const website = await this.repository.create(repositoryInput);
    if (!website) {
      return fail(new DomainError("not_found", `User '${input.userId}' was not found.`, 404));
    }

    return ok({
      website,
      assistantSummary: generated.assistantSummary,
      suggestedNextSteps: [
        "Проверьте заголовок, услуги и контакты.",
        "При необходимости отредактируйте блоки прямо в кабинете.",
        "Нажмите «Опубликовать», чтобы получить готовую ссылку внутри nomduchat.",
      ],
    });
  }

  async updateWebsite(userId: string, siteId: string, input: UpdateBusinessWebsiteInput) {
    const normalizedContent = input.content ? normalizeWebsiteContent(input.content) : undefined;
    const website = await this.repository.update(userId, siteId, {
      title: input.title?.trim(),
      slug: input.slug?.trim(),
      content: normalizedContent,
    });

    if (!website) return fail(new DomainError("not_found", "Business website was not found.", 404));
    return ok({ website });
  }

  async publishWebsite(userId: string, siteId: string) {
    const website = await this.repository.publish(userId, siteId);
    if (!website) return fail(new DomainError("not_found", "Business website was not found.", 404));
    return ok({ website });
  }
}

function normalizeDraftInput(input: CreateBusinessWebsiteDraftInput): Required<CreateBusinessWebsiteDraftInput> {
  return {
    userId: input.userId,
    country: input.country === "RU" ? "RU" : "KZ",
    prompt: clean(input.prompt),
    companyName: clean(input.companyName ?? ""),
    city: clean(input.city ?? ""),
    contact: clean(input.contact ?? ""),
    style: normalizeStyle(input.style),
    siteType: normalizeSiteType(input.siteType),
  };
}

function generateWebsiteContent(input: Required<CreateBusinessWebsiteDraftInput>): {
  title: string;
  content: BusinessWebsiteContent;
  assistantSummary: string;
} {
  const prompt = input.prompt;
  const city = input.city || extractCity(prompt);
  const companyName = cleanupCompanyName(input.companyName || extractCompanyName(prompt), city);
  const niche = extractNiche(prompt, input.siteType);
  const contact = extractContact(prompt, input.contact);
  const offers = extractOffers(prompt, input.siteType);
  const benefits = extractBenefits(prompt, city);
  const priceItems = extractPriceItems(prompt);
  const faqItems = buildFaqItems(companyName, niche, contact, priceItems.length > 0);
  const title = companyName;
  const citySuffix = city ? ` в ${city}` : "";
  const description = `${companyName}: ${niche}${citySuffix}. Быстрый сайт с услугами, условиями и заявкой через nomduchat.`;
  const theme = styleThemes[input.style];
  const lead = buildLead(prompt, niche, city);
  const sections: BusinessWebsiteSection[] = [
    {
      id: "hero",
      type: "hero",
      title: `${companyName} — ${niche}${citySuffix}`,
      subtitle: lead,
      buttonText: "Оставить заявку",
      buttonHref: contact.primaryHref,
    },
    {
      id: "services",
      type: "services",
      title: input.siteType === "catalog" ? "Что можно заказать" : "Что мы делаем",
      subtitle: "Сайт собран по вашему описанию. Любой пункт можно отредактировать перед публикацией.",
      items: offers,
    },
    {
      id: "benefits",
      type: "benefits",
      title: "Почему выбирают нас",
      items: benefits,
    },
  ];

  if (priceItems.length > 0) {
    sections.push({
      id: "pricing",
      type: "pricing",
      title: "Цены и условия",
      subtitle: "Если цена зависит от задачи, сайт ведет клиента к заявке и уточнению деталей.",
      items: priceItems,
    });
  }

  sections.push(
    {
      id: "faq",
      type: "faq",
      title: "Вопросы клиентов",
      items: faqItems,
    },
    {
      id: "contacts",
      type: "contacts",
      title: "Контакты",
      subtitle: contact.label || "Оставьте заявку, и мы свяжемся с вами.",
      body: city ? `Работаем в регионе: ${city}.` : "Работаем с заявками через сайт и мессенджеры.",
      buttonText: "Написать",
      buttonHref: contact.primaryHref,
    },
    {
      id: "cta",
      type: "cta",
      title: "Готовы обсудить задачу?",
      subtitle: "Напишите, что вам нужно, и менеджер подготовит ответ по условиям, срокам и цене.",
      buttonText: "Получить консультацию",
      buttonHref: contact.primaryHref,
    }
  );

  const content: BusinessWebsiteContent = {
    theme,
    seo: {
      title: `${companyName} — ${niche}${citySuffix}`,
      description,
    },
    contact: {
      city,
      phone: contact.phone,
      telegram: contact.telegram,
      whatsapp: contact.whatsapp,
      instagram: contact.instagram,
    },
    pages: [
      {
        slug: "/",
        title,
        sections,
      },
    ],
  };

  return {
    title,
    content,
    assistantSummary: `Собрал ${typeLabels[input.siteType]} для "${companyName}": ${sections.length} блоков, SEO-описание, CTA и контакты. Хостинг и ссылка будут внутри nomduchat после публикации.`,
  };
}

function normalizeWebsiteContent(content: BusinessWebsiteContent): BusinessWebsiteContent {
  return {
    theme: {
      ...styleThemes.clean,
      ...content.theme,
    },
    seo: {
      title: clean(content.seo?.title ?? "Сайт компании").slice(0, 160),
      description: clean(content.seo?.description ?? "Сайт компании, собранный в nomduchat.").slice(0, 320),
    },
    contact: {
      city: clean(content.contact?.city ?? ""),
      phone: clean(content.contact?.phone ?? ""),
      telegram: clean(content.contact?.telegram ?? ""),
      whatsapp: clean(content.contact?.whatsapp ?? ""),
      instagram: clean(content.contact?.instagram ?? ""),
    },
    pages: [
      {
        slug: "/",
        title: clean(content.pages?.[0]?.title ?? content.seo?.title ?? "Сайт компании").slice(0, 120),
        sections: (content.pages?.[0]?.sections ?? []).slice(0, 16).map((section, index) => ({
          id: clean(section.id || `section-${index + 1}`),
          type: section.type,
          title: clean(section.title).slice(0, 180),
          subtitle: clean(section.subtitle ?? "").slice(0, 500),
          body: clean(section.body ?? "").slice(0, 1_200),
          items: (section.items ?? []).map((item) => clean(item).slice(0, 300)).filter(Boolean).slice(0, 12),
          buttonText: clean(section.buttonText ?? "").slice(0, 80),
          buttonHref: clean(section.buttonHref ?? "").slice(0, 300),
        })),
      },
    ],
  };
}

function extractCompanyName(prompt: string) {
  const explicit = prompt.match(/(?:компания|бренд|название|бизнес)\s*[:\-]\s*([^\n,.]+)/i)?.[1];
  if (explicit) return clean(explicit).slice(0, 80);

  const quoted = prompt.match(/[«"]([^»"]{2,80})[»"]/i)?.[1];
  if (quoted) return clean(quoted).slice(0, 80);

  const firstWords = prompt
    .split(/[.!?\n]/)[0]
    ?.replace(/нужен сайт для/i, "")
    .replace(/сделай сайт для/i, "")
    .replace(/создай сайт для/i, "")
    .trim();
  return titleCase(firstWords || "Моя компания").slice(0, 80);
}

function cleanupCompanyName(value: string, city: string) {
  const cleanValue = clean(value);
  if (!city) return cleanValue;

  return cleanValue
    .replace(new RegExp(`\\s+в\\s+${escapeRegExp(city)}$`, "i"), "")
    .replace(new RegExp(`\\s+г\\.\\s*${escapeRegExp(city)}$`, "i"), "")
    .trim() || cleanValue;
}

function extractNiche(prompt: string, siteType: BusinessWebsiteType) {
  const explicit = prompt.match(/(?:ниша|сфера|категория)\s*[:\-]\s*([^\n.]+)/i)?.[1];
  if (explicit) return clean(explicit).slice(0, 100);

  if (/кафе|ресторан|кофе|еда|доставка/i.test(prompt)) return "еда и доставка";
  if (/стоматолог|клиник|медиц|врач/i.test(prompt)) return "медицинские услуги";
  if (/ремонт|строитель|дизайн интерьера/i.test(prompt)) return "ремонт и услуги";
  if (/одежд|магазин|товар|каталог|опт|розниц/i.test(prompt)) return "товары и продажи";
  if (/обучен|курс|школ|репетитор/i.test(prompt)) return "обучение и консультации";

  return siteType === "catalog" ? "товары и каталог" : siteType === "services" ? "услуги для клиентов" : "бизнес-услуги";
}

function extractCity(prompt: string) {
  const explicit = prompt.match(/(?:город|регион)\s*[:\-]\s*([^\n,.]+)/i)?.[1];
  if (explicit) return clean(explicit).slice(0, 80);

  const known = ["Алматы", "Астана", "Шымкент", "Москва", "Санкт-Петербург", "Казань", "Екатеринбург"];
  return known.find((city) => new RegExp(city, "i").test(prompt)) ?? "";
}

function extractContact(prompt: string, fallback: string) {
  const phone = clean(prompt.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] ?? "");
  const telegram = clean(prompt.match(/@[a-zA-Z0-9_]{4,32}/)?.[0] ?? "");
  const instagram = clean(prompt.match(/(?:instagram|инстаграм)\s*[:\-]?\s*(@[a-zA-Z0-9_.]+)/i)?.[1] ?? "");
  const fallbackClean = clean(fallback);
  const label = [phone, telegram || fallbackClean, instagram].filter(Boolean).join(" · ");
  const primary = telegram || fallbackClean || phone || "";
  const primaryHref = primary.startsWith("@")
    ? `https://t.me/${primary.slice(1)}`
    : phone
      ? `tel:${phone.replace(/[^\d+]/g, "")}`
      : "#contacts";

  return {
    phone,
    telegram: telegram || (fallbackClean.startsWith("@") ? fallbackClean : ""),
    whatsapp: phone ? `https://wa.me/${phone.replace(/[^\d]/g, "")}` : "",
    instagram,
    label,
    primaryHref,
  };
}

function extractOffers(prompt: string, siteType: BusinessWebsiteType) {
  const explicit = prompt.match(/(?:услуги|товары|оффер|продаем|предлагаем)\s*[:\-]?\s*([^\n.]+)/i)?.[1];
  const source = (explicit || prompt)
    .replace(/(?:цена|стоимость|прайс)\s*[:\-]?\s*.+$/i, "")
    .replace(/контакт\s*[:\-]?\s*.+$/i, "");
  const rawItems = source
    .split(/[,;•\n]/)
    .map((item) => clean(item))
    .map((item) => item.replace(/^нужен сайт для\s+/i, "").replace(/^сделай сайт для\s+/i, ""))
    .filter((item) => item.length >= 5 && item.length <= 120)
    .slice(0, 6);

  if (rawItems.length >= 3) return rawItems;

  if (siteType === "catalog") {
    return ["Каталог товаров", "Подбор под задачу клиента", "Расчет стоимости и наличия", "Доставка или самовывоз"];
  }

  if (siteType === "services") {
    return ["Консультация клиента", "Подбор решения", "Расчет стоимости", "Сопровождение до результата"];
  }

  return ["Описание услуги", "Быстрая консультация", "Расчет условий", "Передача заявки менеджеру"];
}

function extractBenefits(prompt: string, city: string) {
  const benefits = [];
  if (/быстро|срочно|1 день|24/i.test(prompt)) benefits.push("Быстро отвечаем и не заставляем клиента ждать");
  if (/опыт|лет|команда|эксперт/i.test(prompt)) benefits.push("Опираемся на опыт команды и понятный процесс работы");
  if (/гарант|договор|официаль/i.test(prompt)) benefits.push("Работаем прозрачно: условия фиксируются заранее");
  if (/доставка/i.test(prompt)) benefits.push("Помогаем с доставкой и уточняем удобный способ получения");
  if (city) benefits.push(`Понимаем локальный рынок и работаем с клиентами в регионе ${city}`);

  return [
    ...benefits,
    "Собираем заявку и передаем ее ответственному менеджеру",
    "Объясняем условия простым языком",
  ].slice(0, 5);
}

function extractPriceItems(prompt: string) {
  const lines = prompt
    .split(/\n/)
    .map((line) => clean(line))
    .filter(Boolean);
  const explicitPrices = [...prompt.matchAll(/(?:цена|стоимость|прайс)\s*[:\-]?\s*([^\n.]+)/gi)]
    .map((match) => clean(match[1] ?? ""))
    .filter(Boolean);
  if (explicitPrices.length > 0) return explicitPrices.slice(0, 6);

  const priceLines = lines.filter((line) => /₸|руб|₽|kzt|тенге|стоим|прайс|от\s+\d/i.test(line));
  if (priceLines.length > 0) return priceLines.slice(0, 6);
  if (/цена|стоим|прайс/i.test(prompt)) return ["Стоимость зависит от задачи. Оставьте заявку, и менеджер подготовит расчет."];
  return [];
}

function buildFaqItems(companyName: string, niche: string, contact: ReturnType<typeof extractContact>, hasPricing: boolean) {
  return [
    `Чем занимается ${companyName}? — Мы работаем в направлении: ${niche}.`,
    hasPricing
      ? "Сколько стоит? — Базовые условия указаны на сайте, точный расчет зависит от задачи."
      : "Сколько стоит? — Оставьте заявку, и менеджер подготовит расчет под вашу задачу.",
    "Как оставить заявку? — Нажмите кнопку связи, напишите задачу и удобный контакт.",
    contact.label ? `Как связаться? — ${contact.label}.` : "Как связаться? — Оставьте заявку через кнопку на сайте.",
  ];
}

function buildLead(prompt: string, niche: string, city: string) {
  if (/для бизнеса|b2b|опт/i.test(prompt)) {
    return `Помогаем компаниям быстро разобраться в условиях, получить расчет и связаться с менеджером${city ? ` в ${city}` : ""}.`;
  }
  if (/доставка|магазин|каталог|товар/i.test(prompt)) {
    return `Подберем подходящий вариант, уточним наличие и поможем оформить заявку${city ? ` в ${city}` : ""}.`;
  }
  return `Понятно рассказываем про ${niche}, собираем заявку и быстро передаем ее ответственному специалисту.`;
}

function normalizeStyle(style: BusinessWebsiteStyle): BusinessWebsiteStyle {
  if (style === "premium" || style === "bold" || style === "warm") return style;
  return "clean";
}

function normalizeSiteType(siteType: BusinessWebsiteType): BusinessWebsiteType {
  if (siteType === "services" || siteType === "catalog") return siteType;
  return "landing";
}

function buildSlug(value: string) {
  const slug = transliterate(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "business-site";
}

function transliterate(value: string) {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  return value
    .split("")
    .map((char) => map[char.toLowerCase()] ?? char)
    .join("");
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
