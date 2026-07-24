export type WorkspaceArticleBlock = {
  key: string;
  locale: string;
  title: string;
  body: string;
  placement: string;
  updatedAt: string;
};

export type WorkspaceArticle = {
  key: string;
  slug: string;
  title: string;
  excerpt: string;
  paragraphs: string[];
  category: string;
  cover: string;
  ctaLabel: string;
  ctaHref: string;
  updatedAt: string;
};

export const workspaceArticleTypes = ["images", "video", "voice", "humanizer"] as const;
export type WorkspaceArticleType = (typeof workspaceArticleTypes)[number];

type ArticleView = Pick<WorkspaceArticle, "category" | "cover" | "ctaLabel" | "ctaHref">;

const articleViews: Record<WorkspaceArticleType, ArticleView> = {
  images: {
    category: "Изображения",
    cover: "images",
    ctaLabel: "Попробовать изображения",
    ctaHref: "/workspace/media/image",
  },
  video: {
    category: "Видео",
    cover: "video",
    ctaLabel: "Попробовать видео",
    ctaHref: "/workspace/media/video",
  },
  voice: {
    category: "Аудио",
    cover: "voice",
    ctaLabel: "Попробовать озвучку",
    ctaHref: "/workspace/media/voice",
  },
  humanizer: {
    category: "Текст",
    cover: "humanizer",
    ctaLabel: "Попробовать Humanizer",
    ctaHref: "/tools/humanizer",
  },
};

const legacyArticleKeys: Record<string, { type: WorkspaceArticleType; slug: string }> = {
  "workspace.home.article.images": { type: "images", slug: "ai-images-from-reference" },
  "workspace.home.article.video": { type: "video", slug: "video-from-first-frame" },
  "workspace.home.article.voice": { type: "voice", slug: "voice-for-product-content" },
  "workspace.home.article.humanizer": { type: "humanizer", slug: "natural-ai-text" },
};

const articleKeyPattern = /^workspace\.home\.article\.(images|video|voice|humanizer)\.([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export const workspaceArticleFallbacks: WorkspaceArticleBlock[] = [
  {
    key: "workspace.home.article.images",
    locale: "ru",
    title: "Изображение по референсу: что теперь можно контролировать",
    body: "Загрузите исходный кадр, выберите формат и задайте ракурс — NomduChat передаст всё в один сценарий генерации.\n\nРеференс помогает сохранить композицию и характер объекта, а отдельные параметры размера и камеры делают результат предсказуемее.\n\nНачните с короткого описания сцены, затем уточните свет, материал и фон.",
    placement: "workspace.home.articles",
    updatedAt: "2026-07-22T00:00:00.000Z",
  },
  {
    key: "workspace.home.article.video",
    locale: "ru",
    title: "Видео со стартового кадра и выбранным движением камеры",
    body: "Первый кадр задаёт героя, композицию и визуальный ритм будущего ролика. Дальше можно выбрать формат, качество и направление камеры.\n\nДля короткого видео достаточно описать одно действие и одно движение камеры. Чем меньше конфликтующих указаний, тем стабильнее результат.\n\nВертикальный формат подходит для коротких публикаций, горизонтальный — для презентаций и сайта.",
    placement: "workspace.home.articles",
    updatedAt: "2026-07-22T00:00:00.000Z",
  },
  {
    key: "workspace.home.article.voice",
    locale: "ru",
    title: "Озвучка без отдельного редактора",
    body: "Готовый текст можно сразу превратить в аудиофайл, выбрав голос, темп и формат.\n\nПеред запуском уберите длинные предложения и расставьте смысловые паузы — так речь будет звучать естественнее.\n\nMP3 удобен для публикации, WAV — для дальнейшего монтажа.",
    placement: "workspace.home.articles",
    updatedAt: "2026-07-22T00:00:00.000Z",
  },
];

export function toWorkspaceArticles(blocks: WorkspaceArticleBlock[]) {
  return blocks.flatMap((block): WorkspaceArticle[] => {
    const identity = workspaceArticleIdentity(block.key);
    if (!identity) return [];
    const view = articleViews[identity.type];
    const paragraphs = splitBody(block.body);
    if (!block.title.trim() || paragraphs.length === 0) return [];

    return [{
      key: block.key,
      slug: identity.slug,
      ...view,
      title: block.title.trim(),
      excerpt: paragraphs[0],
      paragraphs,
      updatedAt: block.updatedAt,
    }];
  });
}

export function findWorkspaceArticle(blocks: WorkspaceArticleBlock[], slug?: string) {
  return toWorkspaceArticles(blocks).find((article) => article.slug === slug) ?? null;
}

export function buildWorkspaceArticleKey(type: WorkspaceArticleType, slug: string) {
  const safeSlug = normalizeWorkspaceArticleSlug(slug);
  return safeSlug ? `workspace.home.article.${type}.${safeSlug}` : null;
}

export function workspaceArticleSlugFromKey(key: string) {
  return workspaceArticleIdentity(key)?.slug ?? null;
}

export function normalizeWorkspaceArticleSlug(value: string) {
  const transliterated = Array.from(value.trim().toLowerCase().normalize("NFKC"))
    .map((character) => slugCharacters[character] ?? character)
    .join("");

  return transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

function workspaceArticleIdentity(key: string) {
  const legacy = legacyArticleKeys[key];
  if (legacy) return legacy;

  const match = articleKeyPattern.exec(key);
  if (!match) return null;
  return {
    type: match[1] as WorkspaceArticleType,
    slug: match[2],
  };
}

function splitBody(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

const slugCharacters: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ә: "a", ғ: "g", қ: "q", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};
