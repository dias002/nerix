import type { AiModality } from "@nomduchat/shared";

export type MediaMode = "image" | "video" | "music" | "voice";

export type MediaModeConfig = {
  id: MediaMode;
  label: string;
  title: string;
  placeholder: string;
  agentId: string;
  modality: AiModality;
  examples: string[];
};

export const mediaModes: Record<MediaMode, MediaModeConfig> = {
  image: {
    id: "image",
    label: "Изображение",
    title: "Создать изображение",
    placeholder: "Опишите объект, сцену или рекламный визуал",
    agentId: "image",
    modality: "image",
    examples: [
      "Карточка товара на тёплом каменном фоне",
      "Обложка подкаста о технологиях и бизнесе",
      "Современная гостиная по референсу",
    ],
  },
  video: {
    id: "video",
    label: "Видео",
    title: "Создать видео",
    placeholder: "Опишите действие, сцену и движение камеры",
    agentId: "video",
    modality: "video",
    examples: [
      "Продукт появляется из темноты, камера плавно приближается",
      "Вертикальный ролик с пролётом над ночным городом",
      "Оживить стартовый кадр лёгким движением камеры",
    ],
  },
  music: {
    id: "music",
    label: "Музыка",
    title: "Создать музыку",
    placeholder: "Опишите жанр, настроение и задачу трека",
    agentId: "music",
    modality: "music",
    examples: [
      "Энергичный электронный джингл для технологичного продукта",
      "Спокойный инструментальный фон для презентации",
      "Тёплая поп-песня с коротким запоминающимся припевом",
    ],
  },
  voice: {
    id: "voice",
    label: "Озвучка",
    title: "Озвучить текст",
    placeholder: "Введите финальный текст для диктора",
    agentId: "voice",
    modality: "voice",
    examples: [
      "Добро пожаловать. Сейчас покажем, как всё работает.",
      "Короткая уверенная подводка для рекламного ролика.",
      "Спокойное объяснение продукта для презентации.",
    ],
  },
};

export function isMediaMode(value?: string): value is MediaMode {
  return value === "image" || value === "video" || value === "music" || value === "voice";
}
