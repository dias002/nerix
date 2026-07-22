import { DomainError } from "../../domain/result.js";

const maxAvatarBytes = 1_500_000;
const maxAvatarDataUrlLength = 2_200_000;
const avatarPattern = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export function normalizeAvatarDataUrl(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxAvatarDataUrlLength) {
    throw new DomainError("validation_failed", "Avatar image is too large.", 400);
  }

  const match = avatarPattern.exec(trimmed);
  if (!match) {
    throw new DomainError("validation_failed", "Avatar must be a PNG, JPEG, or WebP image.", 400);
  }

  const raw = match[2] ?? "";
  if (Buffer.byteLength(raw, "base64") > maxAvatarBytes) {
    throw new DomainError("validation_failed", "Avatar image must be up to 1.5 MB.", 400);
  }

  return trimmed.replace(/^data:image\/jpg;/, "data:image/jpeg;");
}
