import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../../config.js";
import { DomainError, fail, ok, type Result } from "../../domain/result.js";
import { readBearerToken, readLocalRoleOverride } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { AbuseGuardService } from "../security/abuse-guard.js";
import { LOCAL_USER_PUBLIC_ID } from "../users/local-user.js";
import type { MailingService } from "./mailing.service.js";

const createAudienceSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const importContactsSchema = z.object({
  rawContacts: z.string().max(2_000_000).optional(),
  contacts: z
    .array(
      z.object({
        email: z.string().trim().email(),
        name: z.string().trim().max(180).optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .max(20_000)
    .optional(),
});

const createCampaignSchema = z.object({
  audienceId: z.string().min(1),
  name: z.string().trim().min(1).max(140),
  fromEmail: z.string().trim().email(),
  fromName: z.string().trim().max(140).optional(),
  replyTo: z.string().trim().email().optional().or(z.literal("")),
  subject: z.string().trim().min(1).max(220),
  html: z.string().trim().min(1).max(400_000),
  text: z.string().trim().max(400_000).optional(),
});

export async function registerMailingRoutes(
  app: FastifyInstance,
  mailings: MailingService,
  auth: AuthService,
  abuseGuard: AbuseGuardService
) {
  app.get("/mailings/audiences", async (request, reply) => {
    const user = await resolveMailingUser(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await mailings.listAudiences(user.value.userId));
  });

  app.post("/mailings/audiences", async (request, reply) => {
    const input = createAudienceSchema.safeParse(request.body);
    if (!input.success) return validationError(reply, "Audience name is required.");

    const user = await resolveMailingUser(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const allowed = await abuseGuard.assertBusinessActionAllowed(request, user.value.userId, "mailing-audience-create");
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(reply, await mailings.createAudience({ userId: user.value.userId, name: input.data.name }));
  });

  app.get("/mailings/audiences/:audienceId/contacts", async (request, reply) => {
    const params = z.object({ audienceId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return validationError(reply, "Audience id is required.");

    const user = await resolveMailingUser(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const allowed = await abuseGuard.assertBusinessActionAllowed(request, user.value.userId, "mailing-contact-import");
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(
      reply,
      await mailings.listContacts({ userId: user.value.userId, audienceId: params.data.audienceId })
    );
  });

  app.post("/mailings/audiences/:audienceId/import", async (request, reply) => {
    const params = z.object({ audienceId: z.string().min(1) }).safeParse(request.params);
    const input = importContactsSchema.safeParse(request.body);
    if (!params.success || !input.success) return validationError(reply, "Contacts payload is invalid.");

    const user = await resolveMailingUser(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const allowed = await abuseGuard.assertBusinessActionAllowed(request, user.value.userId, "mailing-contact-import");
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(
      reply,
      await mailings.importContacts({
        userId: user.value.userId,
        audienceId: params.data.audienceId,
        rawContacts: input.data.rawContacts,
        contacts: input.data.contacts,
      })
    );
  });

  app.get("/mailings/campaigns", async (request, reply) => {
    const user = await resolveMailingUser(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await mailings.listCampaigns(user.value.userId));
  });

  app.post("/mailings/campaigns", async (request, reply) => {
    const input = createCampaignSchema.safeParse(request.body);
    if (!input.success) return validationError(reply, "Campaign payload is invalid.");

    const user = await resolveMailingUser(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const allowed = await abuseGuard.assertBusinessActionAllowed(request, user.value.userId, "mailing-campaign-create");
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(
      reply,
      await mailings.createCampaign({
        ...input.data,
        userId: user.value.userId,
        replyTo: input.data.replyTo || undefined,
      })
    );
  });

  app.post("/mailings/campaigns/:campaignId/send", async (request, reply) => {
    const params = z.object({ campaignId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return validationError(reply, "Campaign id is required.");

    const user = await resolveMailingUser(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const allowed = await abuseGuard.assertBusinessActionAllowed(request, user.value.userId, "mailing-campaign-send");
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(reply, await mailings.sendCampaign({ userId: user.value.userId, campaignId: params.data.campaignId }));
  });

  app.post("/mailings/campaigns/:campaignId/sync", async (request, reply) => {
    const params = z.object({ campaignId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return validationError(reply, "Campaign id is required.");

    const user = await resolveMailingUser(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const allowed = await abuseGuard.assertBusinessActionAllowed(request, user.value.userId, "mailing-campaign-sync");
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(reply, await mailings.syncCampaign({ userId: user.value.userId, campaignId: params.data.campaignId }));
  });

  app.get("/mailings/campaigns/:campaignId/recipients", async (request, reply) => {
    const params = z.object({ campaignId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return validationError(reply, "Campaign id is required.");

    const user = await resolveMailingUser(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(
      reply,
      await mailings.listRecipients({ userId: user.value.userId, campaignId: params.data.campaignId })
    );
  });
}

async function resolveMailingUser(
  request: FastifyRequest,
  auth: AuthService
): Promise<Result<{ userId: string }>> {
  const accessToken = readBearerToken(request.headers.authorization);
  if (config.MAILINGS_API_TOKEN && accessToken === config.MAILINGS_API_TOKEN) {
    return ok({ userId: config.MAILINGS_API_USER_ID });
  }

  if (readLocalRoleOverride(request) === "admin") {
    return ok({ userId: LOCAL_USER_PUBLIC_ID });
  }

  if (!accessToken) {
    return fail(new DomainError("unauthorized", "Admin access token is required for mailings.", 401));
  }

  const currentUser = await auth.me(accessToken);
  if (!currentUser.ok) return fail(currentUser.error);

  if (!currentUser.value.user.permissions.mailings) {
    return fail(new DomainError("unauthorized", "Mailings are available only for admin users.", 403));
  }

  return ok({ userId: currentUser.value.user.id });
}

function validationError(reply: FastifyReply, message: string) {
  return reply.status(400).send({
    error: {
      code: "validation_failed",
      message,
    },
  });
}
