import { z } from "zod";
import { isCountryCode, type CountryCode } from "@nomduchat/shared";

export const countrySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value): value is CountryCode => isCountryCode(value), {
    message: "Unsupported country code.",
  });

export const languageSchema = z
  .enum(["ru", "kz", "kk", "en"])
  .transform((value) => (value === "kk" ? "kz" : value));
