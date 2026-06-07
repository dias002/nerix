import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../../config.js";
import { readBearerToken } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import { countrySchema, languageSchema } from "../../server/schemas.js";
import type { AuthService } from "./auth.service.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  country: countrySchema.default("KZ"),
  language: languageSchema.default("ru"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const oauthStartSchema = z.object({
  returnTo: z.string().optional(),
});

const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  format: z.enum(["json"]).optional(),
});

export async function registerAuthRoutes(app: FastifyInstance, auth: AuthService) {
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

    return sendResult(reply, await auth.login(input.data));
  });

  app.get("/auth/me", async (request, reply) => {
    return sendResult(reply, await auth.me(readBearerToken(request.headers.authorization)));
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

    return sendResult(reply, await auth.startOAuth({ provider: params.data.provider, returnTo: query.data.returnTo }));
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
