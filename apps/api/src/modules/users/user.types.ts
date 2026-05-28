import type { CountryCode, Language } from "@nerix/shared";

export type UserRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: CountryCode;
  language: Language;
};

