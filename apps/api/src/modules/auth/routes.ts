import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../../config.js";
import { readBearerToken } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import { countrySchema, languageSchema } from "../../server/schemas.js";
import type { AbuseGuardService } from "../security/abuse-guard.js";
import { isAppReviewCredentials, type AuthService } from "./auth.service.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
  name: z.string().trim().min(1).max(120).optional(),
  country: countrySchema.default("KZ"),
  language: languageSchema.default("ru"),
  avatarDataUrl: z.string().max(2_200_000).nullable().optional(),
  turnstileToken: z.string().trim().min(1).max(4096).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const passwordResetConfirmSchema = z.object({
  token: z.string().trim().min(32).max(512),
  password: z.string().min(8).max(256),
});

const oauthStartSchema = z.object({
  returnTo: z.string().optional(),
  country: countrySchema.optional(),
});

const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  format: z.enum(["json"]).optional(),
});

const linkedAccountProviderSchema = z.object({
  provider: z.string().min(1),
});

export async function registerAuthRoutes(app: FastifyInstance, auth: AuthService, abuseGuard: AbuseGuardService) {
  app.post("/auth/register", async (request, reply) => {
    const input = registerSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Valid email and password are required.",
        },
      });
    }

    const allowed = await abuseGuard.assertRegisterAllowed(request, {
      email: input.data.email,
      turnstileToken: input.data.turnstileToken,
    });
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(reply, await auth.register(input.data));
  });

  app.post("/auth/login", async (request, reply) => {
    const input = loginSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Email and password are required.",
        },
      });
    }

    if (!isAppReviewCredentials(input.data)) {
      const allowed = await abuseGuard.assertLoginAllowed(request, { email: input.data.email });
      if (!allowed.ok) return sendResult(reply, allowed);
    }

    return sendResult(reply, await auth.login(input.data));
  });

  app.get("/auth/me", async (request, reply) => {
    return sendResult(reply, await auth.me(readBearerToken(request.headers.authorization)));
  });

  app.get("/auth/linked-accounts", async (request, reply) => {
    return sendResult(reply, await auth.linkedAccounts(readBearerToken(request.headers.authorization)));
  });

  app.post("/auth/linked-accounts/:provider/unlink", async (request, reply) => {
    const params = linkedAccountProviderSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "OAuth provider is required.",
        },
      });
    }

    return sendResult(
      reply,
      await auth.unlinkOAuthAccount({
        accessToken: readBearerToken(request.headers.authorization),
        provider: params.data.provider,
      })
    );
  });

  app.post("/auth/password-reset/request", async (request, reply) => {
    const input = passwordResetRequestSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Valid email is required.",
        },
      });
    }

    const allowed = await abuseGuard.assertLoginAllowed(request, { email: input.data.email });
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(reply, await auth.requestPasswordReset(input.data));
  });

  app.post("/auth/password-reset/confirm", async (request, reply) => {
    const input = passwordResetConfirmSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Valid reset token and password are required.",
        },
      });
    }

    return sendResult(reply, await auth.confirmPasswordReset(input.data));
  });

  app.get("/auth/oauth/:provider/start", async (request, reply) => {
    const params = z.object({ provider: z.string() }).safeParse(request.params);
    const query = oauthStartSchema.safeParse(request.query);

    if (!params.success || !query.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "OAuth provider is required.",
        },
      });
    }

    const allowed = await abuseGuard.assertOAuthStartAllowed(request, params.data.provider);
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(
      reply,
      await auth.startOAuth({
        provider: params.data.provider,
        returnTo: query.data.returnTo,
        country: query.data.country,
      })
    );
  });

  app.get("/auth/oauth/:provider/callback", async (request, reply) => {
    const params = z.object({ provider: z.string() }).safeParse(request.params);
    const query = oauthCallbackSchema.safeParse(request.query);

    if (!params.success || !query.success) {
      return reply.redirect(oauthErrorRedirect("OAuth callback is invalid."));
    }

    const result = await auth.completeOAuth({
      provider: params.data.provider,
      code: query.data.code,
      state: query.data.state,
    });

    if (query.data.format === "json") {
      return sendResult(reply, result);
    }

    if (!result.ok) {
      return reply.redirect(oauthErrorRedirect(result.error.message));
    }

    return reply.redirect(oauthSuccessRedirect(result.value));
  });
}

function oauthSuccessRedirect(input: { accessToken: string; returnTo: string; user: unknown }) {
  const webUrl = config.WEB_APP_URL.replace(/\/$/, "");
  const fragment = new URLSearchParams({
    accessToken: input.accessToken,
    returnTo: input.returnTo,
    user: Buffer.from(JSON.stringify(input.user), "utf8").toString("base64url"),
  });

  return `${webUrl}/auth/callback#${fragment.toString()}`;
}

function oauthErrorRedirect(message: string) {
  const webUrl = config.WEB_APP_URL.replace(/\/$/, "");
  const query = new URLSearchParams({
    error: message,
  });

  return `${webUrl}/auth?${query.toString()}`;
}
