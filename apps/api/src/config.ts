import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

if (process.env.NODE_ENV !== "test") {
  loadLocalEnvFile();
}

const parseBooleanFlag = (value: "true" | "false") => value === "true";

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);

const defaultNodeEnv =
  process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV === "test" ? "test" : "development";
const defaultApiHost = defaultNodeEnv === "production" ? "0.0.0.0" : "127.0.0.1";
const defaultApiPort = Number(process.env.PORT ?? 4000);
const defaultRunMigrations = defaultNodeEnv === "production" ? "false" : "true";
const defaultApiPersistence = defaultNodeEnv === "production" ? "postgres" : "memory";
const defaultWebAppUrl = process.env.WEB_APP_URL ?? "http://127.0.0.1:5173";
const defaultCorsOrigins = [
  defaultWebAppUrl,
  "https://nomduchat.com",
  "https://www.nomduchat.com",
  "https://nomduchat.pages.dev",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
].join(",");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default(defaultNodeEnv),
  API_HOST: z.string().default(defaultApiHost),
  API_PORT: z.coerce.number().default(defaultApiPort),
  API_PERSISTENCE: z.enum(["memory", "postgres"]).default(defaultApiPersistence),
  API_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(5_000_000),
  DATABASE_URL: z.string().default("postgresql://nomduchat:nomduchat@127.0.0.1:55432/nomduchat"),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform(parseBooleanFlag),
  DATABASE_RUN_MIGRATIONS: z
    .enum(["true", "false"])
    .default(defaultRunMigrations)
    .transform(parseBooleanFlag),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  JWT_SECRET: z.string().default("change-me-locally"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  CORS_ORIGINS: z.string().default(defaultCorsOrigins),
  ABUSE_PROTECTION_ENABLED: z
    .enum(["true", "false"])
    .default(defaultNodeEnv === "test" ? "false" : "true")
    .transform(parseBooleanFlag),
  ABUSE_TRUST_PROXY_HEADERS: z
    .enum(["true", "false"])
    .default(defaultNodeEnv === "production" ? "true" : "false")
    .transform(parseBooleanFlag),
  ABUSE_HASH_SECRET: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  TURNSTILE_REQUIRED: z
    .enum(["true", "false"])
    .default("false")
    .transform(parseBooleanFlag),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TEXT_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_CODE_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_IMAGE_MODEL: z.string().optional(),
  OPENAI_VOICE_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_TEXT_MODEL: z.string().optional(),
  ANTHROPIC_CODE_MODEL: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GEMINI_TEXT_MODEL: z.string().optional(),
  GEMINI_CODE_MODEL: z.string().optional(),
  GEMINI_IMAGE_MODEL: z.string().optional(),
  GEMINI_VIDEO_MODEL: z.string().optional(),
  GEMINI_MUSIC_MODEL: z.string().optional(),
  HEYGEN_API_KEY: z.string().optional(),
  HEYGEN_VIDEO_MODEL: z.string().optional(),
  HEYGEN_AVATAR_VIDEO_MODEL: z.string().optional(),
  HEYGEN_AVATAR_ID: z.string().optional(),
  HEYGEN_VOICE_ID: z.string().optional(),
  HEYGEN_STYLE_ID: z.string().optional(),
  HEYGEN_BRAND_KIT_ID: z.string().optional(),
  HEYGEN_CALLBACK_URL: z.string().optional(),
  HEYGEN_ORIENTATION: z.preprocess(emptyStringToUndefined, z.enum(["landscape", "portrait"]).optional()),
  OPENAI_BUDGET_USD: z.coerce.number().nonnegative().optional(),
  OPENAI_BALANCE_USD: z.coerce.number().nonnegative().optional(),
  ANTHROPIC_BUDGET_USD: z.coerce.number().nonnegative().optional(),
  ANTHROPIC_BALANCE_USD: z.coerce.number().nonnegative().optional(),
  GEMINI_BUDGET_USD: z.coerce.number().nonnegative().optional(),
  GEMINI_BALANCE_USD: z.coerce.number().nonnegative().optional(),
  AI_CREDITS_PER_USD: z.coerce.number().positive().default(1_000),
  AI_PROVIDER_POLICY: z.enum(["dev_allow_all", "production_rules"]).default("dev_allow_all"),
  AI_MOCK_PROVIDER_ENABLED: z
    .enum(["true", "false"])
    .default(defaultNodeEnv === "production" ? "false" : "true")
    .transform(parseBooleanFlag),
  PAYMENT_MOCK_CHECKOUT_ENABLED: z
    .enum(["true", "false"])
    .default(defaultNodeEnv === "production" ? "false" : "true")
    .transform(parseBooleanFlag),
  KASPI_CHECKOUT_URL: z.string().optional(),
  KASPI_API_TOKEN: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),
  YOOKASSA_RECEIPT_VAT_CODE: z.coerce.number().int().min(1).max(6).default(1),
  YOOKASSA_RETURN_URL: z.string().default("http://127.0.0.1:5173/workspace/balance"),
  API_PUBLIC_URL: z.string().default("http://127.0.0.1:4000"),
  WEB_APP_URL: z.string().default("http://127.0.0.1:5173"),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_BASE_URL: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform(parseBooleanFlag),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  VK_CLIENT_ID: z.string().optional(),
  VK_CLIENT_SECRET: z.string().optional(),
  VK_API_VERSION: z.string().default("5.199"),
  YANDEX_CLIENT_ID: z.string().optional(),
  YANDEX_CLIENT_SECRET: z.string().optional(),
  SMTP_BZ_API_KEY: z.string().optional(),
  SMTP_BZ_BASE_URL: z.string().default("https://api.smtp.bz/v1"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_CLIENT_DOMAIN: z.string().default("nomduchat.com"),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform(parseBooleanFlag),
  SMTP_STARTTLS: z
    .enum(["true", "false"])
    .default("true")
    .transform(parseBooleanFlag),
  SMTP_TLS_REJECT_UNAUTHORIZED: z
    .enum(["true", "false"])
    .default("true")
    .transform(parseBooleanFlag),
  PASSWORD_RESET_FROM_EMAIL: z.string().email().optional(),
  PASSWORD_RESET_FROM_NAME: z.string().default("nomduchat"),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  TRANSACTIONAL_FROM_EMAIL: z.string().email().optional(),
  TRANSACTIONAL_FROM_NAME: z.string().default("nomduchat"),
  LIFECYCLE_NOTIFICATIONS_TOKEN: z.string().optional(),
  MAILINGS_API_TOKEN: z.string().optional(),
  MAILINGS_API_USER_ID: z.string().default("local-user"),
  TELEGRAM_MANAGER_BOT_USERNAME: z.string().optional(),
  ADMIN_EMAILS: z.string().default(""),
});

const rawConfig = envSchema.parse(process.env);

if (
  rawConfig.NODE_ENV === "production" &&
  (rawConfig.JWT_SECRET === "change-me-locally" || rawConfig.JWT_SECRET.length < 32)
) {
  throw new Error("JWT_SECRET must be a non-default value with at least 32 characters in production.");
}

if (rawConfig.NODE_ENV === "production" && rawConfig.API_PERSISTENCE !== "postgres") {
  throw new Error("API_PERSISTENCE must be 'postgres' in production.");
}

export const config = {
  ...rawConfig,
  ABUSE_HASH_SECRET: rawConfig.ABUSE_HASH_SECRET ?? rawConfig.JWT_SECRET,
  CORS_ORIGINS: Array.from(
    new Set([
      ...parseCsv(rawConfig.CORS_ORIGINS),
      ...(rawConfig.NODE_ENV === "production"
        ? ["https://nomduchat.com", "https://www.nomduchat.com", "https://nomduchat.pages.dev"]
        : []),
    ])
  ),
};

function loadLocalEnvFile() {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
    resolve(moduleDir, "../../../.env"),
  ];
  const envFilePath = [...new Set(candidates)].find((candidate) => existsSync(candidate));
  if (!envFilePath) return;

  for (const rawLine of readFileSync(envFilePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;

    const rawValue = line.slice(separatorIndex + 1).trim();
    process.env[key] = stripQuotes(rawValue);
  }
}

function stripQuotes(value: string) {
  const first = value.at(0);
  const last = value.at(-1);
  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}
