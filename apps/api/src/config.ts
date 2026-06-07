import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default("postgresql://nerix:nerix@127.0.0.1:55432/nerix"),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  JWT_SECRET: z.string().default("change-me-locally"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TEXT_MODEL: z.string().default("gpt-5.2"),
  OPENAI_CODE_MODEL: z.string().default("gpt-5.2"),
  KASPI_CHECKOUT_URL: z.string().optional(),
  KASPI_API_TOKEN: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),
  YOOKASSA_RETURN_URL: z.string().default("http://127.0.0.1:5173/workspace/balance"),
  API_PUBLIC_URL: z.string().default("http://127.0.0.1:4000"),
  WEB_APP_URL: z.string().default("http://127.0.0.1:5173"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  VK_CLIENT_ID: z.string().optional(),
  VK_CLIENT_SECRET: z.string().optional(),
  VK_API_VERSION: z.string().default("5.199"),
  SMTP_BZ_API_KEY: z.string().optional(),
  SMTP_BZ_BASE_URL: z.string().default("https://api.smtp.bz/v1"),
  ADMIN_EMAILS: z.string().default(""),
});

export const config = envSchema.parse(process.env);
