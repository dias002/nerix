export type ResponseStyleId = "auto" | "business" | "business_visual" | "conversational" | "brief" | "detailed";

export const responseStyleStorageKey = "nomduchat-response-style";

export const responseStyles: Array<{
  id: ResponseStyleId;
  label: string;
  description: string;
}> = [
  {
    id: "auto",
    label: "Авто",
    description: "nomduchat сам выбирает формат ответа под задачу.",
  },
  {
    id: "business",
    label: "Деловой",
    description: "Коротко, структурно, без лишней эмоциональности.",
  },
  {
    id: "business_visual",
    label: "Деловой с картинками",
    description: "Ответ с идеями для иллюстраций, схем или визуальных блоков.",
  },
  {
    id: "conversational",
    label: "Разговорный",
    description: "Живой стиль, проще формулировки, меньше канцелярита.",
  },
  {
    id: "brief",
    label: "Краткий",
    description: "Сжатый ответ с главным выводом и списком действий.",
  },
  {
    id: "detailed",
    label: "Подробный",
    description: "Развернутый разбор с контекстом, шагами и нюансами.",
  },
];

export function readResponseStyle(): ResponseStyleId {
  if (typeof window === "undefined") return "auto";
  return normalizeResponseStyle(window.localStorage.getItem(responseStyleStorageKey));
}

export function writeResponseStyle(style: ResponseStyleId) {
  window.localStorage.setItem(responseStyleStorageKey, style);
}

export function normalizeResponseStyle(value: unknown): ResponseStyleId {
  return responseStyles.some((style) => style.id === value) ? (value as ResponseStyleId) : "auto";
}

export function responseStyleLabel(styleId: ResponseStyleId) {
  return responseStyles.find((style) => style.id === styleId)?.label ?? responseStyles[0].label;
}
