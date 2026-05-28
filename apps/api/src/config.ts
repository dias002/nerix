import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default("postgresql://nerix:nerix@127.0.0.1:5432/nerix"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  JWT_SECRET: z.string().default("change-me-locally"),
});

export const config = envSchema.parse(process.env);

