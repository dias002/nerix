export const interiorCategories = [
  "Диваны",
  "Кресла",
  "Столы",
  "Стулья",
  "Хранение",
  "Спальня",
  "Свет",
  "Техника",
  "Декор",
  "Текстиль и растения",
] as const;

export type InteriorCategory = (typeof interiorCategories)[number];

export type InteriorCatalogItem = {
  id: string;
  title: string;
  category: InteriorCategory;
  detail: string;
  image: string;
  prompt: string;
  referenceImage?: string;
};

type ItemSeed = readonly [
  id: string,
  title: string,
  category: InteriorCategory,
  detail: string,
  prompt: string,
];

const items: ItemSeed[] = [
  ["modular-sofa", "Модульный диван", "Диваны", "Кремовое букле · 280 см", "low cream bouclé modular sofa with broad seats and soft square arms"],
  ["cloud-corner-sofa", "Угловой диван Cloud", "Диваны", "Светлый шенилл · 310 см", "large cloud-like L-shaped sofa in warm ivory chenille with deep rounded cushions"],
  ["linen-straight-sofa", "Диван Linen", "Диваны", "Натуральный лен · 230 см", "straight three-seat sofa upholstered in natural oatmeal linen with slim oak legs"],
  ["velvet-sofa", "Диван Moss", "Диваны", "Оливковый велюр · 220 см", "soft olive green velvet sofa with a low back and gently curved silhouette"],
  ["compact-loveseat", "Диван Duo", "Диваны", "Серый текстиль · 165 см", "compact two-seat light gray sofa with tailored cushions and thin black legs"],
  ["daybed-sofa", "Кушетка Daylight", "Диваны", "Шерсть и дуб · 190 см", "minimal oak daybed with a thick warm wool mattress and cylindrical bolster"],

  ["rust-chair", "Кресло Terra", "Кресла", "Терракотовое букле", "sculptural rust bouclé lounge chair with rounded monolithic arms"],
  ["cocoon-chair", "Кресло Cocoon", "Кресла", "Молочный шенилл", "rounded cocoon lounge chair in soft ivory chenille with a deep enveloping seat"],
  ["leather-lounge-chair", "Кресло Lounge", "Кресла", "Коньячная кожа", "mid-century lounge chair in cognac leather with a dark walnut frame"],
  ["oak-rocking-chair", "Кресло-качалка", "Кресла", "Массив дуба и лен", "light oak rocking chair with a woven linen seat and gently curved runners"],
  ["boucle-swivel-chair", "Поворотное кресло", "Кресла", "Светлое букле", "compact swivel armchair in textured cream bouclé with a concealed round base"],
  ["soft-pouf", "Пуф Pebble", "Кресла", "Шерсть · 70 см", "low pebble-shaped pouf in warm gray felted wool with an organic silhouette"],

  ["oak-table", "Овальный стол", "Столы", "Натуральный дуб · 220 см", "oval natural oak dining table with two fluted cylindrical legs"],
  ["travertine-table", "Стол Travertine", "Столы", "Травертин · 90 см", "round travertine coffee table with a thick top and twin stone legs"],
  ["glass-coffee-table", "Стол Air", "Столы", "Стекло и хром", "low clear glass coffee table with softly rounded corners and polished chrome legs"],
  ["pedestal-side-table", "Столик Mono", "Столы", "Темный камень · 42 см", "small monolithic dark stone pedestal side table with a honed finish"],
  ["slim-writing-desk", "Письменный стол", "Столы", "Орех · 140 см", "slim walnut writing desk with two shallow drawers and refined tapered legs"],
  ["stone-console", "Консоль Arch", "Столы", "Светлый камень", "narrow light limestone console table with two architectural arched supports"],

  ["wishbone-chair", "Стул Wishbone", "Стулья", "Дуб и плетение", "natural oak wishbone dining chair with a hand-woven paper cord seat"],
  ["upholstered-dining-chair", "Стул Soft", "Стулья", "Бежевый текстиль", "fully upholstered beige dining chair with a softly curved back and slim profile"],
  ["bar-stool", "Барный стул", "Стулья", "Орех и кожа", "walnut counter stool with a curved backrest and dark brown leather seat"],
  ["cantilever-chair", "Стул Linea", "Стулья", "Хром и плетение", "cantilever dining chair with a polished tubular steel frame and woven cane seat"],
  ["office-chair", "Рабочее кресло", "Стулья", "Сетка и алюминий", "ergonomic minimal office chair in warm gray mesh with a polished aluminum base"],
  ["bench-seat", "Скамья Plane", "Стулья", "Дуб · 150 см", "simple solid oak dining bench with softly rounded edges and slab legs"],

  ["media-console", "ТВ-консоль", "Хранение", "Орех · 200 см", "low walnut media console with three seamless doors and a recessed plinth"],
  ["tall-bookcase", "Стеллаж Grid", "Хранение", "Черный металл и дуб", "tall open bookcase with a slim black steel grid and natural oak shelves"],
  ["low-sideboard", "Комод Reed", "Хранение", "Рифленый дуб", "low sideboard in fluted light oak with four handleless doors and rounded corners"],
  ["glass-cabinet", "Витрина Frame", "Хранение", "Стекло и металл", "slim smoked-glass display cabinet with a matte bronze metal frame"],
  ["entry-console", "Консоль для прихожей", "Хранение", "Орех и камень", "narrow walnut entry cabinet with a pale stone top and concealed shoe storage"],
  ["modular-shelf", "Полки Blocks", "Хранение", "Модульный дуб", "wall-mounted modular oak shelving with alternating open boxes and long shelves"],

  ["ivory-bed", "Кровать Cloud", "Спальня", "Мягкое изголовье · 180 см", "minimal ivory upholstered bed with a soft rectangular headboard"],
  ["oak-nightstand", "Тумба Dawn", "Спальня", "Светлый дуб", "floating light oak nightstand with one seamless drawer and a rounded edge"],
  ["soft-bench", "Банкетка", "Спальня", "Букле · 140 см", "low bedroom bench upholstered in cream bouclé with chunky rounded legs"],
  ["wardrobe", "Шкаф Quiet", "Спальня", "Матовый кашемир", "floor-to-ceiling matte cashmere wardrobe with flush doors and recessed pulls"],
  ["vanity-table", "Туалетный столик", "Спальня", "Дуб и латунь", "compact oak vanity table with a round mirror and subtle brushed brass details"],
  ["crib", "Детская кроватка", "Спальня", "Светлый бук", "minimal light beech baby crib with rounded rails and an understated Scandinavian form"],

  ["floor-lamp", "Торшер Line", "Свет", "Черный металл · 155 см", "slim matte black floor lamp with an angled conical shade"],
  ["arc-floor-lamp", "Торшер Arc", "Свет", "Сталь и лен", "large arched floor lamp in brushed steel with a warm linen drum shade"],
  ["pendant-light", "Подвес Halo", "Свет", "Опаловое стекло", "large opal glass pendant light with a soft warm glow and thin suspension cable"],
  ["table-lamp", "Лампа Dome", "Свет", "Керамика и лен", "small sculptural ceramic table lamp with a natural linen shade"],
  ["wall-sconce", "Бра Fold", "Свет", "Латунь", "minimal folded brass wall sconce casting soft indirect light up and down"],
  ["ceiling-track", "Трековый свет", "Свет", "Белый металл", "recessed white ceiling track with adjustable architectural spotlights"],

  ["frame-tv", "Телевизор Frame", "Техника", "55″ · матовый экран", "slim wall-mounted 55-inch television with a flush black frame and hidden cables"],
  ["projector", "Проектор Cinema", "Техника", "4K · компактный корпус", "compact white 4K projector placed discreetly on a shelf with a hidden projection screen"],
  ["soundbar", "Саундбар", "Техника", "Черный алюминий", "minimal matte black soundbar centered below the television with no visible cables"],
  ["turntable", "Проигрыватель Vinyl", "Техника", "Орех и алюминий", "premium walnut and brushed aluminum vinyl turntable displayed on a low console"],
  ["air-purifier", "Очиститель воздуха", "Техника", "Белый · бесшумный", "compact cylindrical white air purifier with a subtle perforated lower body"],
  ["smart-speaker", "Умная колонка", "Техника", "Текстиль · графит", "small graphite fabric smart speaker with a minimal touch surface"],

  ["ceramic-vase", "Ваза Form", "Декор", "Матовая керамика", "large hand-built matte ceramic vase in warm off-white with an irregular organic form"],
  ["wall-art", "Картина Horizon", "Декор", "Холст · 100 × 140 см", "large abstract canvas artwork in muted earth tones with a thin natural oak frame"],
  ["sculptural-object", "Скульптура Loop", "Декор", "Светлый камень", "small abstract loop sculpture carved from pale limestone"],
  ["round-mirror", "Зеркало Orbit", "Декор", "Тонированное стекло · 90 см", "large round wall mirror with a very thin dark bronze frame"],
  ["candles", "Набор свечей", "Декор", "Воск и камень", "group of three ivory pillar candles on a low travertine tray"],
  ["books-set", "Арт-альбомы", "Декор", "Комплект из 4 книг", "curated stack of four large neutral-toned art and architecture books"],

  ["olive-tree", "Оливковое дерево", "Текстиль и растения", "Высота 180 см", "tall indoor olive tree in a textured light-stone planter"],
  ["wool-rug", "Ковер Dune", "Текстиль и растения", "Шерсть · 200 × 300 см", "large hand-tufted wool rug in warm sand with a subtle organic relief pattern"],
  ["linen-curtains", "Льняные шторы", "Текстиль и растения", "Натуральный лен", "floor-to-ceiling sheer natural linen curtains with a soft full drape"],
  ["cushions-set", "Подушки Tone", "Текстиль и растения", "Лен и шерсть · 4 шт.", "four decorative cushions in oatmeal, clay and olive linen and wool"],
  ["throw-blanket", "Плед Soft", "Текстиль и растения", "Мериносовая шерсть", "soft oversized merino wool throw in a warm light gray tone"],
  ["monstera", "Монстера", "Текстиль и растения", "Высота 120 см", "healthy indoor monstera plant in a simple matte charcoal ceramic planter"],
];

const references: Record<string, string> = {
  "modular-sofa": "/furniture/modular-sofa.jpg",
  "rust-chair": "/furniture/rust-chair.jpg",
  "oak-table": "/furniture/oak-table.jpg",
  "travertine-table": "/furniture/travertine-table.jpg",
  "media-console": "/furniture/media-console.jpg",
  "ivory-bed": "/furniture/ivory-bed.jpg",
  "floor-lamp": "/furniture/floor-lamp.jpg",
  "olive-tree": "/furniture/olive-tree.jpg",
};

export const interiorCatalog: InteriorCatalogItem[] = items.map(([id, title, category, detail, prompt], index) => {
  const referenceImage = references[id];
  return {
    id,
    title,
    category,
    detail,
    prompt,
    image: `/furniture/catalog/item-${String(index + 1).padStart(2, "0")}.jpg`,
    ...(referenceImage ? { referenceImage } : {}),
  };
});

export const maxInteriorSelection = 4;

const selectionKey = "nomduchat-interior-catalog-selection";
const defaultSelection = ["modular-sofa", "floor-lamp", "media-console", "olive-tree"];
const itemIds = new Set(interiorCatalog.map((item) => item.id));

export function readInteriorSelection() {
  if (typeof window === "undefined") return defaultSelection;

  try {
    const stored = JSON.parse(window.localStorage.getItem(selectionKey) ?? "null");
    if (!Array.isArray(stored)) return defaultSelection;
    const valid = stored.filter((id): id is string => typeof id === "string" && itemIds.has(id));
    return valid.slice(0, maxInteriorSelection);
  } catch {
    return defaultSelection;
  }
}

export function saveInteriorSelection(ids: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(selectionKey, JSON.stringify(ids.slice(0, maxInteriorSelection)));
  } catch {
    // The selection still works for the current session when storage is unavailable.
  }
}
