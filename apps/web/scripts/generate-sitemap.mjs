import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const siteUrl = process.env.SITE_URL?.replace(/\/$/, "") ?? "https://nomduchat.com";
const lastmod = process.env.SITEMAP_LASTMOD ?? new Date().toISOString().slice(0, 10);

const routes = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "monthly", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/business", changefreq: "monthly", priority: "0.7" },
  { path: "/models", changefreq: "monthly", priority: "0.7" },
  { path: "/faq", changefreq: "monthly", priority: "0.7" },
  { path: "/contacts", changefreq: "monthly", priority: "0.6" },
  { path: "/support", changefreq: "monthly", priority: "0.6" },
  { path: "/translate", changefreq: "weekly", priority: "0.7" },
  { path: "/about-referral-program", changefreq: "monthly", priority: "0.6" },
  { path: "/ai/flux-2", changefreq: "monthly", priority: "0.6" },
  { path: "/tools/dizajn-interyera", changefreq: "monthly", priority: "0.6" },
  { path: "/tools/humanizer", changefreq: "monthly", priority: "0.6" },
  { path: "/seo/articles", changefreq: "weekly", priority: "0.6" },
  { path: "/seo/articles/kak-vybrat-ai-servis", changefreq: "monthly", priority: "0.5" },
  { path: "/seo/articles/ai-chat-dlya-ucheby", changefreq: "monthly", priority: "0.5" },
  { path: "/seo/articles/faq-dlya-saita", changefreq: "monthly", priority: "0.5" },
  { path: "/requisites", changefreq: "monthly", priority: "0.5" },
  { path: "/legal/terms", changefreq: "monthly", priority: "0.5" },
  { path: "/legal/privacy", changefreq: "monthly", priority: "0.5" },
  { path: "/legal/refund", changefreq: "monthly", priority: "0.5" },
  { path: "/legal/pricing", changefreq: "monthly", priority: "0.5" },
  { path: "/legal/cookies", changefreq: "monthly", priority: "0.5" },
  { path: "/legal/auto-renewal", changefreq: "monthly", priority: "0.5" },
  { path: "/data-deletion", changefreq: "monthly", priority: "0.5" },
];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map((route) =>
    [
      "  <url>",
      `    <loc>${siteUrl}${route.path}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${route.changefreq}</changefreq>`,
      `    <priority>${route.priority}</priority>`,
      "  </url>",
    ].join("\n")
  ),
  "</urlset>",
  "",
].join("\n");

writeFileSync(resolve("public/sitemap.xml"), xml);
