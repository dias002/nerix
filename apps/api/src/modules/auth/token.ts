import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../../config.js";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

export function signAccessToken(input: { userId: string; email: string }) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: input.userId,
    email: input.email,
    iat: now,
    exp: now + config.ACCESS_TOKEN_TTL_SECONDS,
  };
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const encodedHeader = encodeJson(header);
  const encodedPayload = encodeJson(payload);
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyAccessToken(token: string) {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) return null;

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  if (!safeEqual(signature, expectedSignature)) return null;

  const payload = decodeJson<AccessTokenPayload>(encodedPayload);
  if (!payload || typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

function sign(value: string) {
  return createHmac("sha256", config.JWT_SECRET).update(value).digest("base64url");
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson<T>(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
