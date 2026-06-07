import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const algorithm = "pbkdf2_sha256";
const iterations = 210_000;
const keyLength = 32;
const digest = "sha256";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, iterations, keyLength, digest).toString("base64url");
  return `${algorithm}$${iterations}$${salt}$${hash}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [storedAlgorithm, storedIterations, salt, hash] = encoded.split("$");
  if (storedAlgorithm !== algorithm || !storedIterations || !salt || !hash) return false;

  const parsedIterations = Number(storedIterations);
  if (!Number.isInteger(parsedIterations) || parsedIterations <= 0) return false;

  const expected = Buffer.from(hash, "base64url");
  const actual = pbkdf2Sync(password, salt, parsedIterations, expected.length, digest);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
