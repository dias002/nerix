import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import { ensureBusinessPermission } from "../business/business-permissions.js";
import type { BusinessJobService } from "../business-jobs/business-job.service.js";
import type { AbuseGuardService } from "../security/abuse-guard.js";
import type { BusinessWebsiteService } from "./business-website.service.js";
import type { BusinessWebsiteContent } from "./business-website.types.js";

const countrySchema = z.enum(["KZ", "RU"]);
const styleSchema = z.enum(["clean", "premium", "bold", "warm"]);
const siteTypeSchema = z.enum(["landing", "services", "catalog"]);
const sectionTypeSchema = z.enum(["hero", "services", "benefits", "pricing", "faq", "contacts", "cta"]);

const createDraftSchema = z.object({
  country: countrySchema.default("KZ"),
  prompt: z.string().trim().min(20).max(5_000),
  companyName: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  contact: z.string().trim().max(180).optional(),
  style: styleSchema.default("clean"),
  siteType: siteTypeSchema.default("landing"),
});

const websiteContentSchema = z.object({
  theme: z.object({
    background: z.string().trim().min(1).max(40),
    surface: z.string().trim().min(1).max(40),
    text: z.string().trim().min(1).max(40),
    muted: z.string().trim().min(1).max(40),
    accent: z.string().trim().min(1).max(40),
    accentText: z.string().trim().min(1).max(40),
  }),
  seo: z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(320),
  }),
  contact: z.object({
    city: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(80).optional(),
    telegram: z.string().trim().max(80).optional(),
    whatsapp: z.string().trim().max(180).optional(),
    instagram: z.string().trim().max(80).optional(),
  }),
  pages: z
    .array(
      z.object({
        slug: z.literal("/"),
        title: z.string().trim().min(1).max(120),
        sections: z.array(
          z.object({
            id: z.string().trim().min(1).max(80),
            type: sectionTypeSchema,
            title: z.string().trim().min(1).max(180),
            subtitle: z.string().trim().max(500).optional(),
            body: z.string().trim().max(1_200).optional(),
            items: z.array(z.string().trim().min(1).max(300)).max(12).optional(),
            buttonText: z.string().trim().max(80).optional(),
            buttonHref: z.string().trim().max(300).optional(),
          })
        ).min(1).max(16),
      })
    )
    .length(1),
});

const updateWebsiteSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().min(2).max(80).optional(),
  content: websiteContentSchema.optional(),
});

export async function registerBusinessWebsiteRoutes(
  app: FastifyInstance,
  websites: BusinessWebsiteService,
  businessJobs: BusinessJobService,
  auth: AuthService,
  abuseGuard: AbuseGuardService
) {
  app.get("/business/websites", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const permission = await ensureBusinessPermission(request, auth, "businessSettings");
    if (!permission.ok) return sendResult(reply, permission);

    return sendResult(reply, await websites.listWebsites(user.value.userId));
  });

  app.post("/business/websites/draft", async (request, reply) => {
    const input = createDraftSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business website draft payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const permission = await ensureBusinessPermission(request, auth, "businessSettings");
    if (!permission.ok) return sendResult(reply, permission);

    const allowed = await abuseGuard.assertBusinessActionAllowed(request, user.value.userId, "website-draft");
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(reply, await businessJobs.createWebsiteDraftJob(user.value.userId, input.data));
  });

  app.get("/business/websites/:siteId", async (request, reply) => {
    const params = z.object({ siteId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business website request.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const permission = await ensureBusinessPermission(request, auth, "businessSettings");
    if (!permission.ok) return sendResult(reply, permission);

    return sendResult(reply, await websites.getWebsite(user.value.userId, params.data.siteId));
  });

  app.patch("/business/websites/:siteId", async (request, reply) => {
    const params = z.object({ siteId: z.string().min(1) }).safeParse(request.params);
    const input = updateWebsiteSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business website update payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const permission = await ensureBusinessPermission(request, auth, "businessSettings");
    if (!permission.ok) return sendResult(reply, permission);

    return sendResult(
      reply,
      await websites.updateWebsite(user.value.userId, params.data.siteId, {
        title: input.data.title,
        slug: input.data.slug,
        content: input.data.content as BusinessWebsiteContent | undefined,
      })
    );
  });

  app.post("/business/websites/:siteId/publish", async (request, reply) => {
    const params = z.object({ siteId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business website publish payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const permission = await ensureBusinessPermission(request, auth, "businessSettings");
    if (!permission.ok) return sendResult(reply, permission);

    return sendResult(reply, await websites.publishWebsite(user.value.userId, params.data.siteId));
  });

  app.get("/public/websites/:slug", async (request, reply) => {
    const params = z.object({ slug: z.string().min(1).max(100) }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid website slug.",
        },
      });
    }

    return sendResult(reply, await websites.getPublishedWebsite(params.data.slug));
  });
}
