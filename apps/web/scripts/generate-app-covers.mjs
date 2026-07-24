import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const apiKey = process.env.GOOGLE_AI_API_KEY;
if (!apiKey) {
  throw new Error("GOOGLE_AI_API_KEY is required to generate application covers.");
}

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const catalogPath = path.join(webRoot, "src/app/data/app-catalog.json");
const outputDir = path.join(webRoot, "public/app-covers");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const force = process.argv.includes("--force");
const selectedId = process.argv.find((value) => value.startsWith("--id="))?.slice(5);
const model = normalizeImageModel(process.env.GEMINI_IMAGE_MODEL);
const palettes = {
  solar: "burnished gold, amber glass, warm ivory and a restrained ember-orange edge light",
  plasma: "royal violet, saturated orchid, electric berry and a small warm gold highlight",
  coral: "luminous coral, vermilion, warm rose and polished copper highlights",
  orbit: "deep emerald, bright chartreuse-gold, teal glass and a warm cream highlight",
};

await mkdir(outputDir, { recursive: true });

for (const app of catalog) {
  if (selectedId && app.id !== selectedId) continue;

  const outputPath = path.join(outputDir, `${app.id}.jpg`);
  if (!force && await fileExists(outputPath)) {
    console.log(`skip ${app.id}`);
    continue;
  }

  console.log(`generate ${app.id}`);
  const image = await generateCover(app);
  validateJpeg(image, app.id);

  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, image);
  await rename(temporaryPath, outputPath);
}

async function generateCover(app) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [{ type: "text", text: buildPrompt(app) }],
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: "5:4",
          image_size: "1K",
        },
        store: false,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Gemini cover generation failed for ${app.id} (${response.status}): ${errorMessage(body)}`);
    }

    const artifact = findImage(body);
    if (!artifact) throw new Error(`Gemini did not return an image for ${app.id}.`);
    return Buffer.from(artifact, "base64");
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(app) {
  const palette = palettes[app.accent] ?? palettes.solar;

  return [
    `Create a premium editorial cover for the NomduChat application “${app.title}”.`,
    `Product purpose: ${app.text}`,
    `Central visual metaphor: ${app.visual}.`,
    "Art direction: an own sophisticated cosmic product universe, premium commercial campaign quality, tactile materials, realistic depth, elegant cinematic lighting, one unmistakable focal object.",
    `Color direction: ${palette}. Keep a deep ink-space base, but make the focal colors rich, warm and desirable rather than cold corporate blue.`,
    "Composition: 5:4 landscape cover, subject slightly off-center, clear silhouette at small card size, controlled negative space, layered foreground and background, subtle orbital motion.",
    "No text, letters, numbers, logos, watermark, fake interface, buttons, generic robot head, neon HUD, busy star field, cheap cyberpunk, flat icon or stock-photo look.",
  ].join("\n");
}

function findImage(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImage(item);
      if (found) return found;
    }
    return null;
  }

  const record = value;
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  const mime = String(record.mime_type ?? record.mimeType ?? "").toLowerCase();
  const data = typeof record.data === "string" ? record.data : undefined;
  if (data && (type === "image" || mime.startsWith("image/"))) return data;

  for (const child of Object.values(record)) {
    const found = findImage(child);
    if (found) return found;
  }
  return null;
}

function validateJpeg(buffer, id) {
  const signature = buffer.subarray(0, 3).toString("hex");
  if (signature !== "ffd8ff") {
    throw new Error(`Gemini returned an invalid JPEG for ${id}.`);
  }
  if (buffer.length < 20_000 || buffer.length > 12_000_000) {
    throw new Error(`Gemini returned an unexpected file size for ${id}: ${buffer.length} bytes.`);
  }
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 20_000;
  } catch {
    return false;
  }
}

function normalizeImageModel(value) {
  if (!value || value === "gemini-image-configured" || value === "image-primary") return "gemini-3.1-flash-image";
  return value.replace(/^models\//, "");
}

function errorMessage(body) {
  if (body?.error?.message) return body.error.message;
  return JSON.stringify(body).slice(0, 500);
}
