import type { Language } from "@nomduchat/shared";
import type { AuthApiResponse, LinkedAccountApiRecord, UserApiRecord } from "./index";
import { request } from "./transport";

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
  country?: string;
  language?: Language;
  avatarDataUrl?: string | null;
  turnstileToken?: string;
}) {
  return request<AuthApiResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function loginUser(input: { email: string; password: string }) {
  return request<AuthApiResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function requestPasswordReset(input: { email: string }) {
  return request<{ accepted: true; resetUrl?: string }>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function confirmPasswordReset(input: { token: string; password: string }) {
  return request<AuthApiResponse>("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser() {
  return request<{ user: UserApiRecord }>("/auth/me");
}

export async function exportCurrentUserData() {
  return request<unknown>("/users/me/export");
}

export async function deleteCurrentUser(confirmation: string) {
  return request<{
    userId: string;
    deletedAt: string;
    emailBeforeDeletion: string | null;
    retainedRecords: string[];
  }>("/users/me/delete", {
    method: "POST",
    body: JSON.stringify({ confirmation }),
  });
}

export async function updateCurrentUserProfile(input: {
  name?: string;
  country?: string;
  language?: Language;
  avatarDataUrl?: string | null;
}) {
  return request<{ user: UserApiRecord }>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export type OAuthProvider = "google" | "vk" | "yandex";

export async function startOAuth(provider: OAuthProvider, returnTo = "/workspace", country?: "KZ" | "RU") {
  const query = new URLSearchParams({ returnTo });
  if (country) query.set("country", country);

  return request<{ provider: OAuthProvider; authorizationUrl: string }>(
    `/auth/oauth/${provider}/start?${query.toString()}`
  );
}

export async function getLinkedAccounts() {
  return request<{ accounts: LinkedAccountApiRecord[] }>("/auth/linked-accounts");
}

export async function unlinkLinkedAccount(provider: OAuthProvider) {
  return request<{ provider: OAuthProvider; unlinked: true; accounts: LinkedAccountApiRecord[] }>(
    `/auth/linked-accounts/${provider}/unlink`,
    {
      method: "POST",
    }
  );
}
