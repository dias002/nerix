import { z } from "zod";

const parseBooleanFlag = (value: "true" | "false") => value === "true";

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const defaultNodeEnv = process.env.NODE_ENV === "production" ? "production" : "development";
const defaultApiHost = defaultNodeEnv === "production" ? "0.0.0.0" : "127.0.0.1";
const defaultApiPort = Number(process.env.PORT ?? 4000);
const defaultRunMigrations = defaultNodeEnv === "production" ? "false" : "true";
const defaultWebAppUrl = process.env.WEB_APP_URL ?? "http://127.0.0.1:5173";
const defaultCorsOrigins = [defaultWebAppUrl, "http://localhost:5173", "http://127.0.0.1:5173"].join(",");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default(defaultNodeEnv),
  API_HOST: z.string().default(defaultApiHost),
  API_PORT: z.coerce.number().default(defaultApiPort),
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
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TEXT_MODEL: z.string().default("gpt-5.2"),
  OPENAI_CODE_MODEL: z.string().default("gpt-5.2"),
  AI_PROVIDER_POLICY: z.enum(["dev_allow_all", "production_rules"]).default("dev_allow_all"),
  PAYMENT_MOCK_CHECKOUT_ENABLED: z
    .enum(["true", "false"])
    .default(defaultNodeEnv === "production" ? "false" : "true")
    .transform(parseBooleanFlag),
  KASPI_CHECKOUT_URL: z.string().optional(),
  KASPI_API_TOKEN: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),
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
  SMTP_BZ_API_KEY: z.string().optional(),
  SMTP_BZ_BASE_URL: z.string().default("https://api.smtp.bz/v1"),
  MAILINGS_API_TOKEN: z.string().optional(),
  MAILINGS_API_USER_ID: z.string().default("local-user"),
  ADMIN_EMAILS: z.string().default(""),
});

const rawConfig = envSchema.parse(process.env);

export const config = {
  ...rawConfig,
  CORS_ORIGINS: parseCsv(rawConfig.CORS_ORIGINS),
};
