export function buildTitleVideoPrompt(title: string) {
  const cleanTitle = title.trim() || "NomduChat";

  return [
    `Create a premium short AI video from this title: "${cleanTitle}".`,
    "Final result: cinematic 6-8 second product-style video, 16:9, suitable for a modern AI platform interface.",
    "Visual direction: minimal dark environment, precise light accents, clean camera movement, premium technology feel, no clutter, no stock footage look.",
    "Storyboard: start with a quiet establishing frame, reveal the core idea through motion, finish with a strong hero frame that can be used as a cover.",
    "Camera: slow push-in, subtle parallax, controlled depth of field, no shaky movement.",
    "Avoid text overlays, logos, watermarks, distorted UI, fake app screenshots, extra fingers, unreadable typography, aggressive neon, cheap sci-fi HUD.",
  ].join("\n");
}

export function buildApplicationCoverPrompt(title: string) {
  const cleanTitle = title.trim() || "AI-приложение NomduChat";

  return [
    `Create a premium application cover image for NomduChat. Application name: "${cleanTitle}".`,
    "The image will be used as a large cover inside an AI tools catalog, not as a logo.",
    "Style: expensive minimal AI-product editorial art, dark refined background, controlled cyan-blue-violet light accents, subtle orange highlight, high contrast, clean composition, modern SaaS/AI platform feeling.",
    "Composition: one clear central visual metaphor for the app purpose, generous negative space on the left for UI text overlay, strong focal point, no visual noise.",
    "Quality bar: polished product artwork, realistic depth, crisp details, elegant lighting, suitable for Apple/Linear-level interface presentation.",
    "No text, no letters, no logos, no watermark, no fake buttons, no screenshots, no low-poly render, no cartoon mascot unless the title explicitly requires a character.",
  ].join("\n");
}
