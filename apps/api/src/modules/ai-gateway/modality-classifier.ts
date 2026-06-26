import type { AiModality } from "@nomduchat/shared";

const codeNeedles = ["код", "code", "bug", "ошибка", "рефактор", "api", "typescript"];
const imageNeedles = ["картин", "изображ", "image", "photo", "фото", "логотип"];
const videoNeedles = ["видео", "video", "ролик", "анимац"];
const voiceNeedles = ["голос", "озвуч", "voice", "speech", "audio"];

const explicitMusicGenerationNeedles = [
  "сгенерируй музыку",
  "сгенерируй песню",
  "сгенерируй трек",
  "создай музыку",
  "создай трек",
  "сделай бит",
  "сделай минус",
  "запиши песню",
  "аудио песн",
  "mp3",
  "wav",
  "melody",
  "бит",
  "джингл",
];

const songWritingNeedles = ["песн", "текст песни", "куплет", "припев", "lyrics", "лирик"];

export function inferModality(prompt: string): AiModality {
  const normalized = prompt.toLowerCase();

  if (containsAny(normalized, codeNeedles)) return "code";
  if (containsAny(normalized, imageNeedles)) return "image";
  if (containsAny(normalized, videoNeedles)) return "video";
  if (containsAny(normalized, voiceNeedles)) return "voice";
  if (containsAny(normalized, explicitMusicGenerationNeedles)) return "music";

  // "Напиши/сочини песню" is usually a text-writing request. Actual audio generation
  // should require explicit words like "трек", "mp3", "бит" or "сгенерируй музыку".
  if (containsAny(normalized, songWritingNeedles)) return "text";

  return "text";
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}
