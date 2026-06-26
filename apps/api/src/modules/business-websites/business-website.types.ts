export type BusinessWebsiteCountry = "KZ" | "RU";
export type BusinessWebsiteStatus = "draft" | "published";
export type BusinessWebsiteStyle = "clean" | "premium" | "bold" | "warm";
export type BusinessWebsiteType = "landing" | "services" | "catalog";

export type BusinessWebsiteTheme = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
};

export type BusinessWebsiteSectionType =
  | "hero"
  | "services"
  | "benefits"
  | "pricing"
  | "faq"
  | "contacts"
  | "cta";

export type BusinessWebsiteSection = {
  id: string;
  type: BusinessWebsiteSectionType;
  title: string;
  subtitle?: string;
  body?: string;
  items?: string[];
  buttonText?: string;
  buttonHref?: string;
};

export type BusinessWebsiteSeo = {
  title: string;
  description: string;
};

export type BusinessWebsiteContact = {
  city?: string;
  phone?: string;
  telegram?: string;
  whatsapp?: string;
  instagram?: string;
};

export type BusinessWebsiteContent = {
  theme: BusinessWebsiteTheme;
  seo: BusinessWebsiteSeo;
  contact: BusinessWebsiteContact;
  pages: Array<{
    slug: "/";
    title: string;
    sections: BusinessWebsiteSection[];
  }>;
};

export type CreateBusinessWebsiteDraftInput = {
  userId: string;
  country: BusinessWebsiteCountry;
  prompt: string;
  companyName?: string;
  city?: string;
  contact?: string;
  style: BusinessWebsiteStyle;
  siteType: BusinessWebsiteType;
};

export type UpdateBusinessWebsiteInput = {
  title?: string;
  slug?: string;
  content?: BusinessWebsiteContent;
};

export type CreateBusinessWebsiteRepositoryInput = {
  userId: string;
  workspaceId: string | null;
  country: BusinessWebsiteCountry;
  status: BusinessWebsiteStatus;
  slug: string;
  title: string;
  prompt: string;
  siteType: BusinessWebsiteType;
  style: BusinessWebsiteStyle;
  content: BusinessWebsiteContent;
};

export type BusinessWebsiteRecord = {
  id: string;
  userId: string;
  workspaceId: string | null;
  country: BusinessWebsiteCountry;
  status: BusinessWebsiteStatus;
  slug: string;
  title: string;
  prompt: string;
  siteType: BusinessWebsiteType;
  style: BusinessWebsiteStyle;
  content: BusinessWebsiteContent;
  publicationPath: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};
