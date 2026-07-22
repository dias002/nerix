import { createHash, randomBytes } from "node:crypto";
import type { CountryCode, Language } from "@nomduchat/shared";
import { config } from "../../config.js";
import { DomainError, fail, ok } from "../../domain/result.js";
import type { AuthRepository } from "./auth.repository.js";
import {
  createOAuthAuthorizationUrl,
  exchangeOAuthCode,
  isOAuthProvider,
  supportedOAuthProviders,
} from "./oauth-provider.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { PasswordResetMailer } from "./password-reset-mailer.js";
import type { TransactionalMailer } from "../notifications/transactional-mailer.js";
import { signAccessToken, verifyAccessToken } from "./token.js";
import { normalizeAvatarDataUrl } from "../users/avatar.js";
import { isAppReviewEntitlementEmail } from "../users/admin-access.js";
import type { UpdateUserProfileInput } from "../users/user.repository.js";

const appReviewPassword = "NomduchatReview2026!";

export function isAppReviewCredentials(input: { email: string; password: string }) {
  return isAppReviewEntitlementEmail(input.email) && input.password === appReviewPassword;
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwordResetMailer?: PasswordResetMailer,
    private readonly transactionalMailer?: TransactionalMailer
  ) {}

  async register(input: {
    email: string;
    password: string;
    name?: string;
    country?: CountryCode;
    language?: Language;
    avatarDataUrl?: string | null;
  }) {
    if (!isRegistrationPasswordSafe(input.password)) {
      return fail(new DomainError("validation_failed", "Password length is invalid."));
    }

    const avatarUrl = this.readAvatarDataUrl(input.avatarDataUrl);
    if (!avatarUrl.ok) return avatarUrl;

    const user = await this.repository.createUser({
      email: input.email,
      passwordHash: hashPassword(input.password),
      name: input.name?.trim() || input.email.split("@")[0],
      country: input.country ?? "KZ",
      language: input.language ?? "ru",
      avatarUrl: avatarUrl.value ?? null,
    });

    if (!user || !user.email) {
      return fail(new DomainError("validation_failed", "User with this email already exists.", 409));
    }

    await this.sendBestEffort(() =>
      this.transactionalMailer?.sendWelcome({
        email: user.email!,
        name: user.name,
      })
    );

    return ok({
      user,
      accessToken: signAccessToken({
        userId: user.id,
        email: user.email,
      }),
    });
  }

  async login(input: { email: string; password: string }) {
    if (!isPasswordLengthSafe(input.password)) {
      return fail(new DomainError("unauthorized", "Invalid email or password.", 401));
    }

    const user = await this.repository.findByEmail(input.email);
    const passwordMatches = user ? verifyPassword(input.password, user.passwordHash) : false;
    const appReviewMatches = isAppReviewCredentials(input);
    if (!user || !user.email || (!passwordMatches && !appReviewMatches)) {
      return fail(new DomainError("unauthorized", "Invalid email or password.", 401));
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;

    return ok({
      user: publicUser,
      accessToken: signAccessToken({
        userId: user.id,
        email: user.email,
      }),
    });
  }

  async me(accessToken: string | null) {
    if (!accessToken) {
      return fail(new DomainError("unauthorized", "Access token is required.", 401));
    }

    const payload = verifyAccessToken(accessToken);
    if (!payload) {
      return fail(new DomainError("unauthorized", "Access token is invalid or expired.", 401));
    }

    const user = await this.repository.findById(payload.sub);
    if (!user) {
      return fail(new DomainError("not_found", `User '${payload.sub}' was not found.`, 404));
    }

    return ok({
      user,
    });
  }

  async updateProfile(accessToken: string | null, input: UpdateUserProfileInput & { avatarDataUrl?: string | null }) {
    const currentUser = await this.me(accessToken);
    if (!currentUser.ok) return currentUser;

    const avatarUrl = this.readAvatarDataUrl(input.avatarDataUrl);
    if (!avatarUrl.ok) return avatarUrl;

    const user = await this.repository.updateProfile(currentUser.value.user.id, {
      name: input.name?.trim(),
      country: input.country,
      language: input.language,
      ...(avatarUrl.value !== undefined ? { avatarUrl: avatarUrl.value } : {}),
    });
    if (!user) {
      return fail(new DomainError("not_found", `User '${currentUser.value.user.id}' was not found.`, 404));
    }

    return ok({ user });
  }

  async deleteAccountAccess(userId: string) {
    await this.repository.deleteAccountAccess(userId);
  }

  async linkedAccounts(accessToken: string | null) {
    const currentUser = await this.me(accessToken);
    if (!currentUser.ok) return currentUser;

    return ok({
      accounts: await this.repository.listOAuthAccounts(currentUser.value.user.id),
    });
  }

  async unlinkOAuthAccount(input: { accessToken: string | null; provider: string }) {
    if (!isOAuthProvider(input.provider)) {
      return fail(
        new DomainError(
          "validation_failed",
          `OAuth provider must be one of: ${supportedOAuthProviders().join(", ")}.`,
          400
        )
      );
    }

    const currentUser = await this.me(input.accessToken);
    if (!currentUser.ok) return currentUser;

    const result = await this.repository.unlinkOAuthAccount(currentUser.value.user.id, input.provider);
    if (result === "not_found") {
      return fail(new DomainError("not_found", `Linked ${input.provider} account was not found.`, 404));
    }
    if (result === "last_sign_in_method") {
      return fail(
        new DomainError(
          "validation_failed",
          "Add a password or another login method before unlinking this account.",
          400
        )
      );
    }

    return ok({
      provider: input.provider,
      unlinked: true,
      accounts: await this.repository.listOAuthAccounts(currentUser.value.user.id),
    });
  }

  async requestPasswordReset(input: { email: string }) {
    const email = input.email.trim().toLowerCase();
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + config.PASSWORD_RESET_TTL_MINUTES * 60_000).toISOString();
    const target = await this.repository.createPasswordResetToken({
      email,
      tokenHash,
      expiresAt,
    });
    const resetUrl = buildResetUrl(rawToken);

    if (!target) {
      return ok({
        accepted: true,
      });
    }

    try {
      await this.passwordResetMailer?.sendPasswordReset({
        email: target.email,
        name: target.name,
        resetUrl,
      });
    } catch (error) {
      if (config.NODE_ENV === "production") {
        const message = error instanceof Error ? error.message : "Password reset email could not be sent.";
        return fail(new DomainError("provider_unavailable", message, 503));
      }
    }

    return ok({
      accepted: true,
      ...(config.NODE_ENV === "production" ? {} : { resetUrl }),
    });
  }

  async confirmPasswordReset(input: { token: string; password: string }) {
    if (!isRegistrationPasswordSafe(input.password)) {
      return fail(new DomainError("validation_failed", "Password length is invalid."));
    }

    const token = input.token.trim();
    if (!isResetTokenFormatSafe(token)) {
      return fail(new DomainError("validation_failed", "Reset link is invalid or expired.", 400));
    }

    const user = await this.repository.resetPasswordWithToken({
      tokenHash: hashResetToken(token),
      passwordHash: hashPassword(input.password),
    });

    if (!user?.email) {
      return fail(new DomainError("validation_failed", "Reset link is invalid or expired.", 400));
    }

    return ok({
      user,
      accessToken: signAccessToken({
        userId: user.id,
        email: user.email,
      }),
    });
  }

  async startOAuth(input: { provider: string; returnTo?: string; country?: CountryCode }) {
    if (!isOAuthProvider(input.provider)) {
      return fail(
        new DomainError(
          "validation_failed",
          `OAuth provider must be one of: ${supportedOAuthProviders().join(", ")}.`,
          400
        )
      );
    }

    if (input.provider === "google" && input.country === "RU") {
      return fail(new DomainError("provider_unavailable", "Google OAuth is not available for RU accounts.", 403));
    }

    try {
      return ok({
        provider: input.provider,
        authorizationUrl: createOAuthAuthorizationUrl({
          provider: input.provider,
          returnTo: input.returnTo,
          country: input.country,
        }),
      });
    } catch (error) {
      if (error instanceof DomainError) return fail(error);
      throw error;
    }
  }

  async completeOAuth(input: { provider: string; code: string; state: string }) {
    if (!isOAuthProvider(input.provider)) {
      return fail(
        new DomainError(
          "validation_failed",
          `OAuth provider must be one of: ${supportedOAuthProviders().join(", ")}.`,
          400
        )
      );
    }

    try {
      const { profile, returnTo } = await exchangeOAuthCode({
        provider: input.provider,
        code: input.code,
        state: input.state,
      });
      const user = await this.repository.findOrCreateOAuthUser(profile);

      return ok({
        user,
        accessToken: signAccessToken({
          userId: user.id,
          email: user.email ?? `${profile.provider}:${profile.providerUserId}`,
        }),
        returnTo,
      });
    } catch (error) {
      if (error instanceof DomainError) return fail(error);
      throw error;
    }
  }

  private async sendBestEffort(task: () => Promise<void> | undefined) {
    try {
      await task();
    } catch {
      // Transactional email must not block account access.
    }
  }

  private readAvatarDataUrl(value: string | null | undefined) {
    try {
      return ok(normalizeAvatarDataUrl(value));
    } catch (error) {
      if (error instanceof DomainError) return fail(error);
      throw error;
    }
  }
}

function isPasswordLengthSafe(password: string) {
  return password.length >= 1 && password.length <= 256;
}

function isRegistrationPasswordSafe(password: string) {
  return password.length >= 8 && password.length <= 256;
}

function isResetTokenFormatSafe(token: string) {
  return /^[A-Za-z0-9_-]{32,256}$/.test(token);
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function buildResetUrl(token: string) {
  const webUrl = config.WEB_APP_URL.replace(/\/$/, "");
  const query = new URLSearchParams({ token });
  return `${webUrl}/auth/reset?${query.toString()}`;
}
