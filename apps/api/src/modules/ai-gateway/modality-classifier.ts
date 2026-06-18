import type { AiModality } from "@nomduchat/shared";

const modalityNeedles: Array<{ modality: AiModality; needles: string[] }> = [
  { modality: "code", needles: ["код", "code", "bug", "ошибка", "рефактор", "api", "typescript"] },
  { modality: "image", needles: ["картин", "изображ", "image", "photo", "фото", "логотип"] },
  { modality: "video", needles: ["видео", "video", "ролик", "анимац"] },
  { modality: "music", needles: ["песн", "трек", "music", "song", "melody", "бит"] },
  { modality: "voice", needles: ["голос", "озвуч", "voice", "speech", "audio"] },
];

export function inferModality(prompt: string): AiModality {
  const normalized = prompt.toLowerCase();
  return modalityNeedles.find(({ needles }) => needles.some((needle) => normalized.includes(needle)))?.modality ?? "text";
}

