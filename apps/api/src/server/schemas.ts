import { z } from "zod";
import { isCountryCode, type CountryCode } from "@nerix/shared";

export const countrySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value): value is CountryCode => isCountryCode(value), {
    message: "Unsupported country code.",
  });

export const languageSchema = z.enum(["ru", "kz", "en"]);

