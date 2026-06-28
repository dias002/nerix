import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { config } from "../../config.js";
import type { DatabaseClient } from "../../database/index.js";
import { DomainError, fail, ok, type Result } from "../../domain/result.js";

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

type RateLimitRule = {
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
};

type RateLimitIncrement = {
  bucketKey: string;
  windowStart: Date;
  windowEnd: Date;
};

type RateLimitIncrementResult = {
  count: number;
  windowEnd: Date;
};

type AbuseGuardOptions = {
  enabled?: boolean;
  trustProxyHeaders?: boolean;
  hashSecret?: string;
  turnstileSecretKey?: string;
  turnstileRequired?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type TurnstileSiteVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export interface AbuseRateLimitRepository {
  increment(input: RateLimitIncrement): Promise<RateLimitIncrementResult>;
}

export class InMemoryAbuseRateLimitRepository implements AbuseRateLimitRepository {
  private readonly buckets = new Map<string, { count: number; windowEnd: Date }>();

  async increment(input: RateLimitIncrement): Promise<RateLimitIncrementResult> {
    const key = `${input.bucketKey}:${input.windowStart.toISOString()}`;
    this.cleanup(input.windowStart);

    const current = this.buckets.get(key);
    const nextCount = (current?.count ?? 0) + 1;
    const next = { count: nextCount, windowEnd: input.windowEnd };
    this.buckets.set(key, next);
    return next;
  }

  private cleanup(now: Date) {
    const nowMs = now.getTime();
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.windowEnd.getTime() <= nowMs) {
        this.buckets.delete(key);
      }
    }
  }
}

export class PostgresAbuseRateLimitRepository implements AbuseRateLimitRepository {
  constructor(private readonly database: DatabaseClient) {}

  async increment(input: RateLimitIncrement): Promise<RateLimitIncrementResult> {
    const result = await this.database.query<{ count: number; window_end: Date | string }>(
      `
        insert into abuse_rate_limits (bucket_key, window_start, window_end, count)
        values ($1, $2, $3, 1)
        on conflict (bucket_key, window_start)
        do update set count = abuse_rate_limits.count + 1,
                      window_end = excluded.window_end,
                      updated_at = now()
        returning count, window_end
      `,
      [input.bucketKey, input.windowStart.toISOString(), input.windowEnd.toISOString()]
    );

    const row = result.rows[0];
    return {
      count: Number(row?.count ?? 0),
      windowEnd: new Date(row?.window_end ?? input.windowEnd),
    };
  }
}

export class AbuseGuardService {
  private readonly enabled: boolean;
  private readonly trustProxyHeaders: boolean;
  private readonly hashSecret: string;
  private readonly turnstileSecretKey?: string;
  private readonly turnstileRequired: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(
    private readonly repository: AbuseRateLimitRepository,
    options: AbuseGuardOptions = {}
  ) {
    this.enabled = options.enabled ?? config.ABUSE_PROTECTION_ENABLED;
    this.trustProxyHeaders = options.trustProxyHeaders ?? config.ABUSE_TRUST_PROXY_HEADERS;
    this.hashSecret = options.hashSecret ?? config.ABUSE_HASH_SECRET;
    this.turnstileSecretKey = options.turnstileSecretKey ?? config.TURNSTILE_SECRET_KEY;
    this.turnstileRequired = options.turnstileRequired ?? config.TURNSTILE_REQUIRED;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? (() => new Date());
  }

  async assertRegisterAllowed(request: FastifyRequest, input: { email: string; turnstileToken?: string }) {
    const challenge = await this.assertBotChallenge(request, input.turnstileToken);
    if (!challenge.ok) return challenge;

    return this.consumeMany(request, [
      { scope: "auth.register.ip", subject: `ip:${this.clientIp(request)}`, limit: 5, windowMs: hourMs },
      { scope: "auth.register.email", subject: `email:${input.email.toLowerCase().trim()}`, limit: 3, windowMs: hourMs },
      { scope: "auth.register.device", subject: `device:${this.deviceId(request)}`, limit: 3, windowMs: hourMs },
    ]);
  }

  async assertLoginAllowed(request: FastifyRequest, input: { email: string }) {
    return this.consumeMany(request, [
      { scope: "auth.login.ip", subject: `ip:${this.clientIp(request)}`, limit: 30, windowMs: 15 * minuteMs },
      { scope: "auth.login.email", subject: `email:${input.email.toLowerCase().trim()}`, limit: 10, windowMs: 15 * minuteMs },
      { scope: "auth.login.device", subject: `device:${this.deviceId(request)}`, limit: 20, windowMs: 15 * minuteMs },
    ]);
  }

  async assertOAuthStartAllowed(request: FastifyRequest, provider: string) {
    return this.consumeMany(request, [
      { scope: "auth.oauth.ip", subject: `ip:${this.clientIp(request)}:${provider}`, limit: 20, windowMs: 15 * minuteMs },
      { scope: "auth.oauth.device", subject: `device:${this.deviceId(request)}:${provider}`, limit: 12, windowMs: 15 * minuteMs },
    ]);
  }

  async assertPublicAiRouteAllowed(request: FastifyRequest) {
    return this.consumeMany(request, [
      { scope: "ai.route.ip", subject: `ip:${this.clientIp(request)}`, limit: 60, windowMs: minuteMs },
      { scope: "ai.route.device", subject: `device:${this.deviceId(request)}`, limit: 60, windowMs: minuteMs },
    ]);
  }

  async assertFreeAiRequestAllowed(request: FastifyRequest, userId: string) {
    return this.consumeMany(request, [
      { scope: "ai.free.user.burst", subject: `user:${userId}`, limit: 5, windowMs: minuteMs },
      { scope: "ai.free.user.daily", subject: `user:${userId}`, limit: 12, windowMs: dayMs },
      { scope: "ai.free.ip.daily", subject: `ip:${this.clientIp(request)}`, limit: 20, windowMs: dayMs },
      { scope: "ai.free.device.daily", subject: `device:${this.deviceId(request)}`, limit: 12, windowMs: dayMs },
    ]);
  }

  async assertExpensiveActionAllowed(request: FastifyRequest, userId: string, action: string) {
    return this.consumeMany(request, [
      { scope: `expensive.${action}.user.burst`, subject: `user:${userId}`, limit: 4, windowMs: minuteMs },
      { scope: `expensive.${action}.user.hour`, subject: `user:${userId}`, limit: 20, windowMs: hourMs },
      { scope: `expensive.${action}.ip.hour`, subject: `ip:${this.clientIp(request)}`, limit: 40, windowMs: hourMs },
    ]);
  }

  async assertBusinessActionAllowed(request: FastifyRequest, userId: string, action: string) {
    return this.consumeMany(request, [
      { scope: `business.${action}.user.hour`, subject: `user:${userId}`, limit: 15, windowMs: hourMs },
      { scope: `business.${action}.ip.hour`, subject: `ip:${this.clientIp(request)}`, limit: 30, windowMs: hourMs },
    ]);
  }

  private async assertBotChallenge(request: FastifyRequest, token?: string): Promise<Result<{ verified: boolean }>> {
    if (!this.enabled || !this.turnstileRequired) return ok({ verified: false });

    if (!this.turnstileSecretKey) {
      return fail(new DomainError("bot_challenge_required", "Bot challenge is not configured.", 503));
    }

    if (!token) {
      return fail(new DomainError("bot_challenge_required", "Подтвердите, что вы не бот.", 403));
    }

    const form = new URLSearchParams();
    form.set("secret", this.turnstileSecretKey);
    form.set("response", token);

    const ip = this.clientIp(request);
    if (ip !== "unknown") {
      form.set("remoteip", ip);
    }

    try {
      const response = await this.fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as TurnstileSiteVerifyResponse;

      if (!response.ok || body.success !== true) {
        return fail(new DomainError("bot_challenge_required", "Проверка от ботов не пройдена.", 403));
      }

      return ok({ verified: true });
    } catch {
      return fail(new DomainError("bot_challenge_required", "Проверка от ботов временно недоступна.", 503));
    }
  }

  private async consumeMany(request: FastifyRequest, rules: RateLimitRule[]): Promise<Result<{ allowed: true }>> {
    if (!this.enabled) return ok({ allowed: true });

    for (const rule of rules) {
      const result = await this.consume(rule);
      if (!result.ok) {
        request.log.warn({ scope: rule.scope }, "abuse guard rejected request");
        return result;
      }
    }

    return ok({ allowed: true });
  }

  private async consume(rule: RateLimitRule): Promise<Result<{ allowed: true }>> {
    const now = this.now();
    const windowStartMs = Math.floor(now.getTime() / rule.windowMs) * rule.windowMs;
    const windowStart = new Date(windowStartMs);
    const windowEnd = new Date(windowStartMs + rule.windowMs);
    const bucketKey = this.bucketKey(rule.scope, rule.subject);
    const next = await this.repository.increment({ bucketKey, windowStart, windowEnd });

    if (next.count <= rule.limit) return ok({ allowed: true });

    const retryAfterSeconds = Math.max(1, Math.ceil((next.windowEnd.getTime() - now.getTime()) / 1000));
    return fail(
      new DomainError(
        "rate_limit_exceeded",
        `Слишком много попыток. Попробуйте снова через ${formatRetryAfter(retryAfterSeconds)}.`,
        429
      )
    );
  }

  private bucketKey(scope: string, subject: string) {
    return `abuse:${scope}:${this.hash(subject)}`;
  }

  private hash(value: string) {
    return createHash("sha256").update(this.hashSecret).update(":").update(value).digest("hex");
  }

  private clientIp(request: FastifyRequest) {
    if (this.trustProxyHeaders) {
      const cloudflareIp = firstHeaderValue(request.headers["cf-connecting-ip"]);
      if (cloudflareIp) return cloudflareIp;

      const forwardedFor = firstHeaderValue(request.headers["x-forwarded-for"])?.split(",")[0]?.trim();
      if (forwardedFor) return forwardedFor;
    }

    return request.ip || "unknown";
  }

  private deviceId(request: FastifyRequest) {
    const deviceId = firstHeaderValue(request.headers["x-nomduchat-device-id"])?.trim();
    return deviceId && deviceId.length <= 160 ? deviceId : this.clientIp(request);
  }
}

export function createAbuseRateLimitRepository(database: DatabaseClient, persistence: "memory" | "postgres") {
  return persistence === "postgres"
    ? new PostgresAbuseRateLimitRepository(database)
    : new InMemoryAbuseRateLimitRepository();
}

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatRetryAfter(seconds: number) {
  if (seconds < 60) return `${seconds} сек.`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} мин.`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} ч.`;
}
