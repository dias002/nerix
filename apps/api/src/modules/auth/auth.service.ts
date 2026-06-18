import type { CountryCode, Language } from "@nomduchat/shared";
import { DomainError, fail, ok } from "../../domain/result.js";
import type { AuthRepository } from "./auth.repository.js";
import {
  createOAuthAuthorizationUrl,
  exchangeOAuthCode,
  isOAuthProvider,
  supportedOAuthProviders,
} from "./oauth-provider.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken, verifyAccessToken } from "./token.js";

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async register(input: {
    email: string;
    password: string;
    name?: string;
    country?: CountryCode;
    language?: Language;
  }) {
    const user = await this.repository.createUser({
      email: input.email,
      passwordHash: hashPassword(input.password),
      name: input.name?.trim() || input.email.split("@")[0],
      country: input.country ?? "KZ",
      language: input.language ?? "ru",
    });

    if (!user || !user.email) {
      return fail(new DomainError("validation_failed", "User with this email already exists.", 409));
    }

    return ok({
      user,
      accessToken: signAccessToken({
        userId: user.id,
        email: user.email,
      }),
    });
  }

  async login(input: { email: string; password: string }) {
    const user = await this.repository.findByEmail(input.email);
    if (!user || !verifyPassword(input.password, user.passwordHash) || !user.email) {
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

  async startOAuth(input: { provider: string; returnTo?: string }) {
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
      return ok({
        provider: input.provider,
        authorizationUrl: createOAuthAuthorizationUrl({
          provider: input.provider,
          returnTo: input.returnTo,
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
}
