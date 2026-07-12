import { request } from "./transport";

export type GeoCountryApiResponse = {
  country: "KZ" | "RU" | null;
  source: "header" | "unknown";
};

export async function detectGeoCountry() {
  return request<GeoCountryApiResponse>("/geo/country");
}
