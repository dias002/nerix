import type { AttachedFile } from "./types";

export const maxAttachedFiles = 5;

const maxFileContentChars = 12_000;
const textFilePattern = /\.(txt|md|markdown|csv|json|jsonl|ts|tsx|js|jsx|html|css|py|java|cs|go|rs|sql|xml|yaml|yml|log)$/i;

export async function readAttachment(file: File): Promise<AttachedFile> {
  const base = {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  };

  if (!isTextFile(file)) {
    return base;
  }

  const content = await file.text();
  return {
    ...base,
    content: content.slice(0, maxFileContentChars),
    truncated: content.length > maxFileContentChars,
  };
}

export function speechLocale(language: string) {
  if (language === "en") return "en-US";
  if (language === "kk") return "kk-KZ";
  return "ru-RU";
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isTextFile(file: File) {
  return file.type.startsWith("text/") || textFilePattern.test(file.name);
}
