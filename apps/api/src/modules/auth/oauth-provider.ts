import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { CountryCode } from "@nomduchat/shared";
import { config } from "../../config.js";
import { DomainError } from "../../domain/result.js";
import type { OAuthProviderCode, OAuthUserProfile } from "./auth.repository.js";

type OAuthStatePayload = {
  provider: OAuthProviderCode;
  returnTo: string;
  country: CountryCode;
  nonce: string;
  exp: number;
};

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  email?: string;
  user_id?: string | number;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  name?: string;
  given_name?: string;
};

type VkUserInfo = {
  response?: Array<{
    id?: number;
    first_name?: string;
    last_name?: string;
  }>;
  error?: {
    error_msg?: string;
  };
};

export function supportedOAuthProviders() {
  return ["google", "vk"] as const;
}

export function isOAuthProvider(value: string): value is OAuthProviderCode {
  return value === "google" || value === "vk";
}

export function isOAuthProviderConfigured(provider: OAuthProviderCode) {
  if (provider === "google") return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  return Boolean(config.VK_CLIENT_ID && config.VK_CLIENT_SECRET);
}

export function createOAuthAuthorizationUrl(input: { provider: OAuthProviderCode; returnTo?: string; country?: CountryCode }) {
  if (!isOAuthProviderConfigured(input.provider)) {
    throw new DomainError("provider_unavailable", `${providerLabel(input.provider)} OAuth is not configured.`, 503);
  }

  const state = signOAuthState({
    provider: input.provider,
    returnTo: normalizeReturnTo(input.returnTo),
    country: input.country ?? "KZ",
  });

  if (input.provider === "google") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", config.GOOGLE_CLIENT_ID!);
    url.searchParams.set("redirect_uri", redirectUri("google"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  const url = new URL("https://oauth.vk.com/authorize");
  url.searchParams.set("client_id", config.VK_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri("vk"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "email");
  url.searchParams.set("state", state);
  url.searchParams.set("v", config.VK_API_VERSION);
  return url.toString();
}

export async function exchangeOAuthCode(input: {
  provider: OAuthProviderCode;
  code: string;
  state: string;
}): Promise<{ profile: OAuthUserProfile; returnTo: string }> {
  const state = verifyOAuthState(input.state);
  if (!state || state.provider !== input.provider) {
    throw new DomainError("unauthorized", "OAuth state is invalid or expired.", 401);
  }

  if (!isOAuthProviderConfigured(input.provider)) {
    throw new DomainError("provider_unavailable", `${providerLabel(input.provider)} OAuth is not configured.`, 503);
  }

  const profile =
    input.provider === "google" ? await exchangeGoogleCode(input.code) : await exchangeVkCode(input.code);

  return {
    profile: {
      ...profile,
      country: state.country,
    },
    returnTo: state.returnTo,
  };
}

function signOAuthState(input: { provider: OAuthProviderCode; returnTo: string; country: CountryCode }) {
  const payload: OAuthStatePayload = {
    provider: input.provider,
    returnTo: input.returnTo,
    country: input.country,
    nonce: randomBytes(16).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", config.JWT_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyOAuthState(value: string) {
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = createHmac("sha256", config.JWT_SECRET).update(encodedPayload).digest("base64url");
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!isOAuthProvider(payload.provider)) return null;
    if (typeof payload.returnTo !== "string") return null;
    if (payload.country !== "KZ" && payload.country !== "RU") return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function exchangeGoogleCode(code: string): Promise<OAuthUserProfile> {
  const token = await postForm<TokenResponse>("https://oauth2.googleapis.com/token", {
    code,
    client_id: config.GOOGLE_CLIENT_ID!,
    client_secret: config.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri("google"),
    grant_type: "authorization_code",
  });

  if (!token.access_token) {
    throw new DomainError("unauthorized", token.error_description ?? "Google OAuth token exchange failed.", 401);
  }

  const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  });

  if (!userInfoResponse.ok) {
    throw new DomainError("unauthorized", "Google OAuth profile request failed.", 401);
  }

  const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;
  if (!userInfo.sub) {
    throw new DomainError("unauthorized", "Google OAuth profile is missing user id.", 401);
  }

  return {
    provider: "google",
    providerUserId: userInfo.sub,
    email: userInfo.email ?? null,
    name: userInfo.name ?? userInfo.given_name ?? "Google User",
    country: "KZ",
    language: "ru",
    rawProfile: userInfo as Record<string, unknown>,
  };
}

async function exchangeVkCode(code: string): Promise<OAuthUserProfile> {
  const tokenUrl = new URL("https://oauth.vk.com/access_token");
  tokenUrl.searchParams.set("client_id", config.VK_CLIENT_ID!);
  tokenUrl.searchParams.set("client_secret", config.VK_CLIENT_SECRET!);
  tokenUrl.searchParams.set("redirect_uri", redirectUri("vk"));
  tokenUrl.searchParams.set("code", code);

  const tokenResponse = await fetch(tokenUrl.toString());
  const token = (await tokenResponse.json()) as TokenResponse;
  if (!tokenResponse.ok || token.error || !token.access_token || !token.user_id) {
    throw new DomainError("unauthorized", token.error_description ?? "VK OAuth token exchange failed.", 401);
  }

  const userInfoUrl = new URL("https://api.vk.com/method/users.get");
  userInfoUrl.searchParams.set("access_token", token.access_token);
  userInfoUrl.searchParams.set("user_ids", String(token.user_id));
  userInfoUrl.searchParams.set("fields", "first_name,last_name");
  userInfoUrl.searchParams.set("v", config.VK_API_VERSION);

  const userInfoResponse = await fetch(userInfoUrl.toString());
  const userInfo = (await userInfoResponse.json()) as VkUserInfo;
  const vkUser = userInfo.response?.[0];
  if (!userInfoResponse.ok || userInfo.error || !vkUser?.id) {
    throw new DomainError("unauthorized", userInfo.error?.error_msg ?? "VK OAuth profile request failed.", 401);
  }

  const name = [vkUser.first_name, vkUser.last_name].filter(Boolean).join(" ").trim() || "VK User";
  return {
    provider: "vk",
    providerUserId: String(vkUser.id),
    email: token.email ?? null,
    name,
    country: "RU",
    language: "ru",
    rawProfile: {
      tokenUserId: token.user_id,
      ...vkUser,
    },
  };
}

async function postForm<T>(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const json = (await response.json()) as T & TokenResponse;
  if (!response.ok || json.error) {
    throw new DomainError("unauthorized", json.error_description ?? "OAuth token exchange failed.", 401);
  }
  return json as T;
}

function redirectUri(provider: OAuthProviderCode) {
  return `${config.API_PUBLIC_URL.replace(/\/$/, "")}/auth/oauth/${provider}/callback`;
}

function normalizeReturnTo(returnTo: string | undefined) {
  if (!returnTo?.startsWith("/")) return "/workspace";
  if (returnTo.startsWith("//")) return "/workspace";
  return returnTo;
}

function providerLabel(provider: OAuthProviderCode) {
  return provider === "google" ? "Google" : "VK";
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
