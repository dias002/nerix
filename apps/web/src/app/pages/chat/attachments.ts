import type { AttachedFile } from "./types";

export const maxAttachedFiles = 5;
export const maxAttachedFileSize = 8_000_000;

const maxFileContentChars = 12_000;
const maxTextFileReadBytes = 65_536;
const textFilePattern = /\.(txt|md|markdown|csv|json|jsonl|ts|tsx|js|jsx|html|css|py|java|cs|go|rs|sql|xml|yaml|yml|log)$/i;

export async function readAttachment(file: File): Promise<AttachedFile> {
  const base = {
    id: `${file.name}-${file.size}-${file.lastModified}-${createLocalFileId()}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  };

  if (!isTextFile(file)) {
    return base;
  }

  try {
    const content = await readTextContent(file.slice(0, maxTextFileReadBytes));
    return {
      ...base,
      content: content.slice(0, maxFileContentChars),
      truncated: content.length > maxFileContentChars,
    };
  } catch {
    return base;
  }
}

async function readTextContent(file: File) {
  try {
    if (typeof file.text === "function") {
      return await file.text();
    }
  } catch {
    // continue to FileReader fallback below
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read attachment"));
    reader.readAsText(file, "utf-8");
  });
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

function createLocalFileId() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
