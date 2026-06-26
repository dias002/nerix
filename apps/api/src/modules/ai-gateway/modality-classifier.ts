import type { AiModality } from "@nomduchat/shared";

const codeNeedles = ["код", "code", "bug", "ошибка", "рефактор", "api", "typescript"];
const imageNeedles = ["картин", "изображ", "image", "photo", "фото", "логотип"];
const videoNeedles = ["видео", "video", "ролик", "анимац"];
const voiceNeedles = ["голос", "озвуч", "voice", "speech"];

const explicitMusicGenerationNeedles = [
  "сгенерируй музыку",
  "сгенерируй песню",
  "сгенерируй трек",
  "создай музыку",
  "создай трек",
  "создай аудио",
  "сгенерируй аудио",
  "сделай аудио",
  "сделай мне прям аудио",
  "generate audio",
  "make audio",
  "сделай бит",
  "сделай минус",
  "запиши песню",
  "спой песню",
  "озвучь песню",
  "аудио песн",
  "mp3",
  "wav",
  "melody",
  "вокал",
  "бит",
  "джингл",
];

const songWritingNeedles = ["песн", "текст песни", "куплет", "припев", "lyrics", "лирик"];
const musicSubjectNeedles = ["песн", "музык", "трек", "бит", "джингл", "минус", "мелод"];
const audioOutputNeedles = ["голос", "озвуч", "audio", "аудио", "mp3", "wav", "спой", "вокал", "запиши"];

export function inferModality(prompt: string): AiModality {
  const normalized = prompt.toLowerCase();

  if (containsAny(normalized, codeNeedles)) return "code";
  if (containsAny(normalized, imageNeedles)) return "image";
  if (containsAny(normalized, videoNeedles)) return "video";
  if (
    containsAny(normalized, explicitMusicGenerationNeedles) ||
    wantsGeneratedAudio(normalized) ||
    (containsAny(normalized, musicSubjectNeedles) && containsAny(normalized, audioOutputNeedles))
  ) {
    return "music";
  }
  if (containsAny(normalized, voiceNeedles)) return "voice";

  // "Напиши/сочини песню" is usually a text-writing request. Actual audio generation
  // should require explicit words like "трек", "mp3", "бит" or "сгенерируй музыку".
  if (containsAny(normalized, songWritingNeedles)) return "text";

  return "text";
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function wantsGeneratedAudio(value: string) {
  return containsAny(value, ["аудио", "audio"]) && containsAny(value, ["сделай", "создай", "сгенер", "запиши", "make", "generate", "create"]);
}
