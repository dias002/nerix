import type { FastifyInstance, FastifyRequest } from "fastify";

type SupportedGeoCountry = "KZ" | "RU";

const countryHeaders = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "cloudfront-viewer-country",
  "x-country-code",
  "x-geo-country",
];

export async function registerGeoRoutes(app: FastifyInstance) {
  app.get("/geo/country", async (request) => {
    const country = detectCountryFromHeaders(request);

    return {
      country,
      source: country ? "header" : "unknown",
    };
  });
}

export function detectCountryFromHeaders(request: FastifyRequest): SupportedGeoCountry | null {
  for (const header of countryHeaders) {
    const country = normalizeCountryHeader(readHeader(request, header));
    if (country) return country;
  }

  return null;
}

function readHeader(request: FastifyRequest, header: string) {
  const value = request.headers[header];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCountryHeader(value: string | undefined): SupportedGeoCountry | null {
  const country = value?.trim().toUpperCase();
  if (country === "KZ" || country === "RU") return country;
  return null;
}
