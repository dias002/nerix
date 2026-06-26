import { randomUUID } from "node:crypto";
import type { AiModality, CountryCode, Language } from "@nomduchat/shared";
import { config } from "../../config.js";
import { DomainError, fail, ok } from "../../domain/result.js";
import type { AiGatewayService } from "../ai-gateway/ai-gateway.service.js";
import type { BillingService } from "../billing/billing.service.js";
import type { GenerationRepository } from "./generation.repository.js";
import type { MediaArtifact, MediaGenerationProvider } from "./media-provider.js";
import type { MediaGenerationJob } from "./generation.types.js";

const mediaModalities = new Set<AiModality>(["image", "video", "music", "voice"]);

type SubscriptionAccessService = {
  currentSubscription(userId: string): Promise<{
    ok: true;
    value: {
      subscription: {
        status: string;
      } | null;
    };
  } | {
    ok: false;
    error: {
      code: string;
      message: string;
      statusCode?: number;
    };
  }>;
};

export class GenerationService {
  constructor(
    private readonly generationRepository: GenerationRepository,
    private readonly aiGateway: AiGatewayService,
    private readonly billing: BillingService,
    private readonly mediaProvider: MediaGenerationProvider,
    private readonly subscriptions?: SubscriptionAccessService
  ) {}

  async listJobs(userId: string) {
    return ok({
      jobs: await this.generationRepository.listJobs(userId),
    });
  }

  async listAssets(userId: string) {
    return ok({
      assets: await this.generationRepository.listAssets(userId),
    });
  }

  async getJob(input: { userId: string; jobId: string }) {
    const job = await this.generationRepository.findJob(input.userId, input.jobId);
    if (!job) {
      return fail(new DomainError("not_found", "Generation job was not found.", 404));
    }

    return ok({
      job,
    });
  }

  async createJob(input: {
    userId: string;
    country?: CountryCode;
    language?: Language;
    agentId?: string;
    modality?: AiModality;
    prompt: string;
  }) {
    const prompt = input.prompt.trim();
    if (!prompt) {
      return fail(new DomainError("validation_failed", "Prompt is required.", 400));
    }

    const routeResult = await this.aiGateway.route({
      userId: input.userId,
      country: input.country ?? "KZ",
      language: input.language ?? "ru",
      agentId: input.agentId,
      modality: input.modality,
      prompt,
    });
    if (!routeResult.ok) return routeResult;

    if (!mediaModalities.has(routeResult.value.modality)) {
      return fail(new DomainError("validation_failed", "Use generation jobs only for image, video, music, or voice.", 400));
    }

    const access = await this.getSubscriptionAccess(input.userId);
    if (!access.hasActiveSubscription) {
      return fail(
        new DomainError(
          "subscription_required",
          "Картинки, видео, песни и голос доступны после подписки. В бесплатном режиме доступно 7 обычных текстовых запросов в день.",
          402
        )
      );
    }

    const jobId = randomUUID();
    const reservation = await this.billing.reserve({
      userId: input.userId,
      prompt,
      agentId: routeResult.value.agentId,
      referenceId: jobId,
    });
    if (!reservation.ok) return reservation;

    let job = await this.generationRepository.createJob({
      id: jobId,
      userId: input.userId,
      agentId: routeResult.value.agentId,
      modality: routeResult.value.modality,
      prompt,
      provider: routeResult.value.provider,
      model: routeResult.value.model,
      reservedCredits: reservation.value.estimate.reserveCredits,
      reservationId: reservation.value.reservationId,
      metadata: {
        route: routeResult.value,
      },
    });

    job =
      (await this.generationRepository.updateJob(input.userId, job.id, {
        status: "running",
      })) ?? job;

    try {
      const providerResult = await this.mediaProvider.generate({
        jobId: job.id,
        provider: routeResult.value.provider,
        model: routeResult.value.model,
        modality: routeResult.value.modality,
        prompt,
      });

      if (providerResult.status === "running") {
        const runningJob =
          (await this.generationRepository.updateJob(input.userId, job.id, {
            status: "running",
            metadata: {
              operationName: providerResult.operationName,
              providerRaw: providerResult.raw,
            },
          })) ?? job;

        return ok({
          job: runningJob,
          route: routeResult.value,
          usage: buildUsage(reservation.value.estimate.reserveCredits, null),
        });
      }

      const finalized = await this.finalizeSucceededJob({
        userId: input.userId,
        job,
        finalCredits: reservation.value.estimate.estimatedCredits,
        mimeType: providerResult.mimeType ?? defaultMimeType(routeResult.value.modality),
        base64Data: providerResult.base64Data,
        providerUri: providerResult.providerUri,
        metadata: {
          providerRaw: providerResult.raw,
          text: providerResult.text,
        },
      });

      return ok({
        job: finalized,
        route: routeResult.value,
        usage: buildUsage(reservation.value.estimate.reserveCredits, finalized.finalCredits ?? null),
      });
    } catch (error) {
      const failed = await this.refundFailedJob({
        userId: input.userId,
        job,
        errorMessage: publicMediaErrorMessage(error),
      });

      return ok({
        job: failed,
        route: routeResult.value,
        usage: buildUsage(reservation.value.estimate.reserveCredits, 0),
      });
    }
  }

  async refreshJob(input: { userId: string; jobId: string }) {
    const job = await this.generationRepository.findJob(input.userId, input.jobId);
    if (!job) {
      return fail(new DomainError("not_found", "Generation job was not found.", 404));
    }

    if (job.status !== "running") {
      return ok({
        job,
      });
    }

    const operationName = stringMetadata(job, "operationName");
    if (!operationName) {
      return ok({
        job,
      });
    }

    try {
      const refreshResult = await this.mediaProvider.refresh(operationName);
      if (refreshResult.status === "running") {
        const runningJob =
          (await this.generationRepository.updateJob(input.userId, job.id, {
            status: "running",
            metadata: {
              lastProviderRaw: refreshResult.raw,
            },
          })) ?? job;

        return ok({
          job: runningJob,
        });
      }

      if (refreshResult.status === "failed") {
        const failed = await this.refundFailedJob({
          userId: input.userId,
          job,
          errorMessage: refreshResult.errorMessage ?? "Media generation failed.",
          metadata: {
            providerRaw: refreshResult.raw,
          },
        });

        return ok({
          job: failed,
        });
      }

      const finalized = await this.finalizeSucceededJob({
        userId: input.userId,
        job,
        finalCredits: job.reservedCredits,
        mimeType: refreshResult.mimeType ?? defaultMimeType(job.modality),
        base64Data: refreshResult.base64Data,
        providerUri: refreshResult.providerUri,
        metadata: {
          providerRaw: refreshResult.raw,
        },
      });

      return ok({
        job: finalized,
      });
    } catch (error) {
      const failed = await this.refundFailedJob({
        userId: input.userId,
        job,
        errorMessage: publicMediaErrorMessage(error),
      });

      return ok({
        job: failed,
      });
    }
  }

  async getArtifact(input: { userId: string; jobId: string }) {
    const job = await this.generationRepository.findJob(input.userId, input.jobId);
    if (!job) {
      return fail(new DomainError("not_found", "Generation job was not found.", 404));
    }

    if (job.status !== "succeeded") {
      return fail(new DomainError("validation_failed", "Generation job is not ready yet.", 400));
    }

    const base64Data = stringMetadata(job, "artifactBase64");
    const mimeType = job.resultMimeType ?? stringMetadata(job, "artifactMimeType") ?? defaultMimeType(job.modality);
    if (base64Data) {
      return ok({
        mimeType,
        data: Buffer.from(base64Data, "base64"),
      } satisfies MediaArtifact);
    }

    const providerUri = stringMetadata(job, "providerUri");
    if (providerUri) {
      return ok(await this.mediaProvider.fetchArtifact(providerUri));
    }

    return fail(new DomainError("not_found", "Generation artifact was not found.", 404));
  }

  private async getSubscriptionAccess(userId: string) {
    if (!this.subscriptions) {
      return { hasActiveSubscription: false };
    }

    const current = await this.subscriptions.currentSubscription(userId);
    const subscription = current.ok ? current.value.subscription : null;

    return {
      hasActiveSubscription: subscription?.status === "active",
    };
  }

  private async finalizeSucceededJob(input: {
    userId: string;
    job: MediaGenerationJob;
    finalCredits: number;
    mimeType: string;
    base64Data?: string;
    providerUri?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (input.job.reservationId) {
      const captured = await this.billing.capture({
        userId: input.userId,
        reservationId: input.job.reservationId,
        finalCredits: input.finalCredits,
      });

      if (!captured.ok) {
        throw new Error(captured.error.message);
      }

      const unusedCredits = Math.max(0, input.job.reservedCredits - input.finalCredits);
      if (unusedCredits > 0) {
        await this.billing.refund({
          userId: input.userId,
          reservationId: input.job.reservationId,
          credits: unusedCredits,
        });
      }
    }

    const resultUrl = artifactUrl(input.job.id);
    const metadata = {
      artifactMimeType: input.mimeType,
      artifactBase64: input.base64Data,
      providerUri: input.providerUri,
      ...input.metadata,
    };

    const finalized =
      (await this.generationRepository.updateJob(input.userId, input.job.id, {
        status: "succeeded",
        finalCredits: input.finalCredits,
        resultUrl,
        resultMimeType: input.mimeType,
        metadata: compactObject(metadata),
      })) ?? input.job;

    await this.generationRepository.createAsset({
      userId: input.userId,
      mediaType: input.job.modality,
      title: createAssetTitle(input.job.prompt),
      status: "ready",
      metadata: {
        jobId: input.job.id,
        resultUrl,
        mimeType: input.mimeType,
        provider: input.job.provider,
        model: input.job.model,
      },
    });

    return finalized;
  }

  private async refundFailedJob(input: {
    userId: string;
    job: MediaGenerationJob;
    errorMessage: string;
    metadata?: Record<string, unknown>;
  }) {
    if (input.job.reservationId && input.job.reservedCredits > 0) {
      await this.billing.refund({
        userId: input.userId,
        reservationId: input.job.reservationId,
        credits: input.job.reservedCredits,
      });
    }

    return (
      (await this.generationRepository.updateJob(input.userId, input.job.id, {
        status: "refunded",
        finalCredits: 0,
        errorMessage: input.errorMessage,
        metadata: input.metadata,
      })) ?? input.job
    );
  }
}

function buildUsage(reserveCredits: number, finalCredits: number | null) {
  return {
    reserveCredits,
    finalCredits,
  };
}

function publicMediaErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Media generation failed.";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("429") ||
    normalized.includes("too_many_requests") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("not enough quota") ||
    normalized.includes("quota")
  ) {
    return "У текущего Google Gemini ключа нет доступной квоты для этой медиа-генерации. Кредиты nomduchat возвращены.";
  }

  if (normalized.includes("google_ai_api_key")) {
    return "Gemini ключ для медиа-генерации не настроен. Кредиты nomduchat возвращены.";
  }

  if (normalized.includes("media provider") && normalized.includes("not supported")) {
    return "Этот тип медиа пока не подключен к рабочему провайдеру. Кредиты nomduchat возвращены.";
  }

  return message;
}

function artifactUrl(jobId: string) {
  return `${config.API_PUBLIC_URL.replace(/\/$/, "")}/generation/jobs/${jobId}/artifact`;
}

function createAssetTitle(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 90) || "Generated media";
}

function defaultMimeType(modality: AiModality) {
  if (modality === "image") return "image/png";
  if (modality === "music" || modality === "voice") return "audio/wav";
  if (modality === "video") return "video/mp4";
  return "application/octet-stream";
}

function stringMetadata(job: MediaGenerationJob, key: string) {
  const value = job.metadata[key];
  return typeof value === "string" && value ? value : undefined;
}

function compactObject(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
