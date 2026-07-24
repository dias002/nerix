import { randomUUID } from "node:crypto";
import type { AiModality, CountryCode, Language } from "@nomduchat/shared";
import { config } from "../../config.js";
import { DomainError, fail, ok } from "../../domain/result.js";
import type { AiGatewayService } from "../ai-gateway/ai-gateway.service.js";
import type { BillingService } from "../billing/billing.service.js";
import type { GenerationRepository } from "./generation.repository.js";
import type { MediaArtifact, MediaGenerationProvider } from "./media-provider.js";
import type {
  AvatarVideoGenerationInput,
  GenerationPurpose,
  ImageReferenceInput,
  MediaGenerationOptions,
  MediaGenerationJob,
  UploadedReferenceImageInput,
} from "./generation.types.js";

const mediaModalities = new Set<AiModality>(["image", "video", "avatar_video", "music", "voice"]);

type MediaRoute = {
  agentId: string;
  taskType: string;
  provider: string;
  model: string;
  policyMode: string;
  estimatedCredits: number;
  reserveCredits: number;
  asyncJob: boolean;
  modality: AiModality;
  routingReason: string;
};

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
      jobs: (await this.generationRepository.listJobs(userId)).map(jobForResponse),
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
      job: jobForResponse(job),
    });
  }

  async createJob(input: {
    userId: string;
    country?: CountryCode;
    language?: Language;
    agentId?: string;
    modality?: AiModality;
    purpose?: GenerationPurpose;
    prompt: string;
    options?: MediaGenerationOptions;
    avatarVideo?: AvatarVideoGenerationInput;
    referenceImage?: UploadedReferenceImageInput;
    referenceImages?: UploadedReferenceImageInput[];
    imageReferenceJobId?: string;
    isAdmin?: boolean;
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
      modality: input.imageReferenceJobId ? "image" : input.modality,
      prompt,
    });
    if (!routeResult.ok) return routeResult;
    const imageReferenceResult = await this.resolveImageReferences({
      userId: input.userId,
      modality: routeResult.value.modality,
      prompt,
      referenceImage: input.referenceImage,
      referenceImages: input.referenceImages,
      imageReferenceJobId: input.imageReferenceJobId,
    });
    if (!imageReferenceResult.ok) return imageReferenceResult;
    const imageReferences = imageReferenceResult.value.imageReferences;
    const primaryImageReference = imageReferences[0];
    const route = applyGenerationPurposeRoute({
      purpose: input.purpose,
      route: routeResult.value,
      hasImageReferences: imageReferences.length > 0,
    });

    if (route.modality === "image" && imageReferences.length > 0 && !supportsImageReferences(route.provider)) {
      return fail(new DomainError("provider_unavailable", "Image references require Gemini or OpenAI image generation to be configured.", 503));
    }

    if (!mediaModalities.has(route.modality)) {
      return fail(new DomainError("validation_failed", "Use generation jobs only for image, video, avatar video, music, or voice.", 400));
    }

    if (input.avatarVideo?.referenceImage && route.modality !== "avatar_video") {
      return fail(new DomainError("validation_failed", "Face reference images can only be used for avatar video jobs.", 400));
    }

    if (input.referenceImage && route.modality !== "image" && route.modality !== "video") {
      return fail(new DomainError("validation_failed", "Reference images can only be used for image or video generation jobs.", 400));
    }

    if (input.referenceImages?.length && route.modality !== "image") {
      return fail(new DomainError("validation_failed", "Reference images can only be used for image generation jobs.", 400));
    }

    if (input.referenceImage && !input.referenceImage.consentConfirmed) {
      return fail(new DomainError("validation_failed", "Confirm that you own this image or have permission to use it.", 400));
    }

    if (input.referenceImages?.some((reference) => !reference.consentConfirmed)) {
      return fail(new DomainError("validation_failed", "Confirm that you own every reference image or have permission to use it.", 400));
    }

    if (input.avatarVideo?.referenceImage && !input.avatarVideo.consentConfirmed) {
      return fail(new DomainError("validation_failed", "Confirm that you own this face image or have permission to use it.", 400));
    }

    const freeAvatarProfileJob = isFreeAvatarProfileJob({
      purpose: input.purpose,
      agentId: route.agentId,
      modality: route.modality,
    });
    const access = input.isAdmin || freeAvatarProfileJob ? { hasActiveSubscription: true } : await this.getSubscriptionAccess(input.userId);
    if (!access.hasActiveSubscription) {
      return fail(
        new DomainError(
          "subscription_required",
          "Картинки, видео, аватар-ролики, песни и голос доступны после подписки. В бесплатном режиме доступно 7 обычных текстовых запросов в день.",
          402
        )
      );
    }

    const jobId = randomUUID();
    const unmetered = input.isAdmin === true || freeAvatarProfileJob;
    let reservedCredits = 0;
    let reservationId: string | undefined;
    let finalCredits = 0;

    if (!unmetered) {
      const reservation = await this.billing.reserve({
        userId: input.userId,
        prompt,
        agentId: route.agentId,
        referenceId: jobId,
        unmetered: false,
      });
      if (!reservation.ok) return reservation;
      reservedCredits = reservation.value.estimate.reserveCredits;
      reservationId = reservation.value.reservationId;
      finalCredits = reservation.value.estimate.estimatedCredits;
    }

    let job = await this.generationRepository.createJob({
      id: jobId,
      userId: input.userId,
      agentId: route.agentId,
      modality: route.modality,
      prompt,
      provider: route.provider,
      model: route.model,
      reservedCredits,
      reservationId,
      metadata: {
        route,
        purpose: input.purpose,
        providerCredentialSource: "server_config",
        budgetSource: input.isAdmin ? "project_admin_budget" : freeAvatarProfileJob ? "registration_avatar_budget" : "user_reserved_credits",
        unmeteredReason: freeAvatarProfileJob ? "avatar_profile" : input.isAdmin ? "admin" : undefined,
        avatarVideo: sanitizeAvatarVideoMetadata(input.avatarVideo),
        imageReference: sanitizeImageReferenceMetadata(primaryImageReference),
        imageReferences: sanitizeImageReferencesMetadata(imageReferences),
        options: sanitizeMediaOptions(input.options),
      },
    });

    job =
      (await this.generationRepository.updateJob(input.userId, job.id, {
        status: "running",
      })) ?? job;

    try {
      const providerResult = await this.mediaProvider.generate({
        jobId: job.id,
        provider: route.provider,
        model: route.model,
        modality: route.modality,
        prompt,
        avatarVideo: input.avatarVideo,
        imageReference: primaryImageReference,
        imageReferences,
        options: input.options,
      });

      if (providerResult.status === "running") {
        const runningJob =
          (await this.generationRepository.updateJob(input.userId, job.id, {
            status: "running",
            metadata: {
              operationName: providerResult.operationName,
              providerRaw: sanitizeProviderRaw(providerResult.raw),
            },
          })) ?? job;

        return ok({
          job: jobForResponse(runningJob),
          route: routeResult.value,
          usage: buildUsage(reservedCredits, null),
        });
      }

      const finalized = await this.finalizeSucceededJob({
        userId: input.userId,
        job,
        finalCredits,
        mimeType: providerResult.mimeType ?? defaultMimeType(route.modality),
        base64Data: providerResult.base64Data,
        providerUri: providerResult.providerUri,
        metadata: {
          providerRaw: sanitizeProviderRaw(providerResult.raw),
          text: providerResult.text,
        },
      });

      return ok({
        job: jobForResponse(finalized),
        route: routeResult.value,
        usage: buildUsage(reservedCredits, finalized.finalCredits ?? null),
      });
    } catch (error) {
      const failed = await this.refundFailedJob({
        userId: input.userId,
        job,
        errorMessage: publicMediaErrorMessage(error),
      });

      return ok({
        job: jobForResponse(failed),
        route: routeResult.value,
        usage: buildUsage(reservedCredits, 0),
      });
    }
  }

  async refreshJob(input: { userId: string; jobId: string }) {
    const job = await this.generationRepository.findJob(input.userId, input.jobId);
    if (!job) {
      return fail(new DomainError("not_found", "Generation job was not found.", 404));
    }

    const operationName = stringMetadata(job, "operationName");
    const recoveringRefundedArtifact = canRecoverRefundedArtifact(job, operationName);
    if (job.status !== "running" && !recoveringRefundedArtifact) {
      return ok({
        job: jobForResponse(job),
      });
    }

    if (!operationName) {
      return ok({
        job: jobForResponse(job),
      });
    }

    try {
      const refreshResult = await this.mediaProvider.refresh(operationName);
      if (refreshResult.status === "running") {
        const runningJob =
          (await this.generationRepository.updateJob(input.userId, job.id, {
            status: "running",
            metadata: {
              lastProviderRaw: sanitizeProviderRaw(refreshResult.raw),
            },
          })) ?? job;

        return ok({
          job: jobForResponse(runningJob),
        });
      }

      if (refreshResult.status === "failed") {
        const failed = await this.refundFailedJob({
          userId: input.userId,
          job,
          errorMessage: refreshResult.errorMessage ?? "Media generation failed.",
          metadata: {
            providerRaw: sanitizeProviderRaw(refreshResult.raw),
          },
        });

        return ok({
          job: jobForResponse(failed),
        });
      }

      const finalized = await this.finalizeSucceededJob({
        userId: input.userId,
        job,
        finalCredits: recoveringRefundedArtifact ? 0 : job.reservedCredits,
        mimeType: refreshResult.mimeType ?? defaultMimeType(job.modality),
        base64Data: refreshResult.base64Data,
        providerUri: refreshResult.providerUri,
        metadata: {
          providerRaw: sanitizeProviderRaw(refreshResult.raw),
        },
        skipBillingCapture: recoveringRefundedArtifact,
      });

      return ok({
        job: jobForResponse(finalized),
      });
    } catch (error) {
      const failed = await this.refundFailedJob({
        userId: input.userId,
        job,
        errorMessage: publicMediaErrorMessage(error),
      });

      return ok({
        job: jobForResponse(failed),
      });
    }
  }

  async cancelJob(input: { userId: string; jobId: string }) {
    const job = await this.generationRepository.findJob(input.userId, input.jobId);
    if (!job) {
      return fail(new DomainError("not_found", "Generation job was not found.", 404));
    }

    if (job.status !== "queued" && job.status !== "running") {
      return ok({
        job: jobForResponse(job),
      });
    }

    const operationName = stringMetadata(job, "operationName");
    let providerCancelRaw: Record<string, unknown> | undefined;
    let providerCancelError: string | undefined;

    if (operationName) {
      try {
        providerCancelRaw = sanitizeProviderRaw((await this.mediaProvider.cancel(operationName)).raw);
      } catch (error) {
        providerCancelError = error instanceof Error ? error.message : "Provider cancellation failed.";
      }
    }

    if (job.reservationId && job.reservedCredits > 0) {
      await this.billing.refund({
        userId: input.userId,
        reservationId: job.reservationId,
        credits: job.reservedCredits,
      });
    }

    const cancelled =
      (await this.generationRepository.updateJob(input.userId, job.id, {
        status: "cancelled",
        finalCredits: 0,
        errorMessage: "Генерация остановлена. Кредиты возвращены.",
        metadata: compactObject({
          cancelledAt: new Date().toISOString(),
          providerCancelRaw,
          providerCancelError,
        }),
      })) ?? job;

    return ok({
      job: jobForResponse(cancelled),
    });
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

  private async resolveImageReferences(input: {
    userId: string;
    modality: AiModality;
    prompt: string;
    referenceImage?: UploadedReferenceImageInput;
    referenceImages?: UploadedReferenceImageInput[];
    imageReferenceJobId?: string;
  }) {
    const uploadedReferences = [
      ...(input.referenceImage ? [input.referenceImage] : []),
      ...(input.referenceImages ?? []),
    ];

    if (uploadedReferences.length > 0 && input.imageReferenceJobId) {
      return fail(new DomainError("validation_failed", "Use either an uploaded reference image or an existing image job.", 400));
    }

    if (uploadedReferences.length > 0) {
      if (input.modality !== "image" && input.modality !== "video") {
        return fail(new DomainError("validation_failed", "Image references can only be used for image or video generation jobs.", 400));
      }

      const maxReferences = input.modality === "video" ? 1 : 3;
      if (uploadedReferences.length > maxReferences) {
        return fail(new DomainError("validation_failed", input.modality === "video" ? "Use one starting frame for video generation." : "Use up to 3 reference images.", 400));
      }

      if (uploadedReferences.some((reference) => !reference.consentConfirmed)) {
        return fail(new DomainError("validation_failed", "Confirm that you own every reference image or have permission to use it.", 400));
      }

      return ok({
        imageReferences: uploadedReferences.map((reference, index) => ({
          jobId: uploadedReferences.length === 1 ? "uploaded" : `uploaded-${index + 1}`,
          prompt: reference.filename ? `${input.prompt}\nReference filename: ${reference.filename}` : input.prompt,
          mimeType: reference.mimeType,
          data: Buffer.from(reference.dataBase64, "base64"),
        } satisfies ImageReferenceInput)),
      });
    }

    if (!input.imageReferenceJobId) {
      return ok({
        imageReferences: [],
      });
    }

    if (input.modality !== "image") {
      return fail(new DomainError("validation_failed", "Image references can only be used for image generation jobs.", 400));
    }

    const sourceJob = await this.generationRepository.findJob(input.userId, input.imageReferenceJobId);
    if (!sourceJob) {
      return fail(new DomainError("not_found", "Source image was not found.", 404));
    }

    if (sourceJob.modality !== "image" || sourceJob.status !== "succeeded") {
      return fail(new DomainError("validation_failed", "Source image is not ready for editing.", 400));
    }

    const artifact = await this.getArtifact({
      userId: input.userId,
      jobId: sourceJob.id,
    });
    if (!artifact.ok) return artifact;

    return ok({
      imageReferences: [
        {
          jobId: sourceJob.id,
          prompt: sourceJob.prompt,
          resultUrl: sourceJob.resultUrl,
          mimeType: artifact.value.mimeType,
          data: artifact.value.data,
        } satisfies ImageReferenceInput,
      ],
    });
  }

  private async finalizeSucceededJob(input: {
    userId: string;
    job: MediaGenerationJob;
    finalCredits: number;
    mimeType: string;
    base64Data?: string;
    providerUri?: string;
    metadata?: Record<string, unknown>;
    skipBillingCapture?: boolean;
  }) {
    if (input.job.reservationId && !input.skipBillingCapture) {
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
    if (normalized.includes("heygen")) {
      return "У текущего HeyGen ключа нет доступной квоты для avatar video генерации. Кредиты nomduchat возвращены.";
    }

    if (normalized.includes("openai")) {
      return "У текущего OpenAI ключа нет доступной квоты для этой медиа-генерации. Кредиты nomduchat возвращены.";
    }

    return "У текущего Google Gemini ключа нет доступной квоты для этой медиа-генерации. Кредиты nomduchat возвращены.";
  }

  if (normalized.includes("heygen_api_key")) {
    return "HeyGen ключ для avatar video генерации не настроен. Кредиты nomduchat возвращены.";
  }

  if (normalized.includes("heygen_voice_id")) {
    return "HeyGen voice_id для avatar video генерации не настроен. Кредиты nomduchat возвращены.";
  }

  if (normalized.includes("google_ai_api_key")) {
    return "Gemini ключ для медиа-генерации не настроен. Кредиты nomduchat возвращены.";
  }

  if (normalized.includes("openai_api_key")) {
    return "OpenAI ключ для генерации изображений и озвучки не настроен. Кредиты nomduchat возвращены.";
  }

  if (
    normalized.includes("gemini video generation failed with 404") ||
    normalized.includes("gemini image generation failed with 404") ||
    normalized.includes("not found for api version") ||
    normalized.includes("not found. did you mean") ||
    normalized.includes("predictlongrunning")
  ) {
    return "Медиа-модель Gemini настроена неверно или временно недоступна. Кредиты nomduchat возвращены.";
  }

  if (normalized.includes("media provider") && normalized.includes("not supported")) {
    return "Этот тип медиа пока не подключен к рабочему провайдеру. Кредиты nomduchat возвращены.";
  }

  return message;
}

function canRecoverRefundedArtifact(job: MediaGenerationJob, operationName?: string) {
  if (!operationName) return false;
  if (job.status !== "refunded") return false;
  return job.errorMessage === "Gemini operation completed without a media artifact.";
}

function artifactUrl(jobId: string) {
  return `${config.API_PUBLIC_URL.replace(/\/$/, "")}/generation/jobs/${jobId}/artifact`;
}

function createAssetTitle(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 90) || "Generated media";
}

function defaultMimeType(modality: AiModality) {
  if (modality === "image") return "image/png";
  if (modality === "music") return "audio/mpeg";
  if (modality === "voice") return "audio/wav";
  if (modality === "video" || modality === "avatar_video") return "video/mp4";
  return "application/octet-stream";
}

export function applyGenerationPurposeRoute(input: {
  route: MediaRoute;
  purpose?: GenerationPurpose;
  hasImageReferences?: boolean;
}) {
  if (input.purpose === "application_cover" && input.route.modality === "image" && config.GOOGLE_AI_API_KEY) {
    return {
      ...input.route,
      provider: "gemini",
      model: config.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
      routingReason: "Application cover generation uses the server-side Gemini image model configured for NomduChat.",
    };
  }

  if (
    input.purpose === "avatar_profile" &&
    input.route.modality === "image" &&
    input.hasImageReferences &&
    config.GOOGLE_AI_API_KEY
  ) {
    return {
      ...input.route,
      provider: "gemini",
      model: config.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
      routingReason: "Avatar profile image editing uses the server-side Gemini image model.",
    };
  }

  if (input.route.modality === "image" && input.hasImageReferences && input.route.provider === "openai") {
    return input.route;
  }

  if (input.route.modality === "image" && input.hasImageReferences && config.OPENAI_API_KEY) {
    return {
      ...input.route,
      provider: "openai",
      model: config.OPENAI_IMAGE_MODEL || "gpt-image-1",
      routingReason: "Image editing falls back to the configured OpenAI image model.",
    };
  }

  if (input.route.modality === "image" && input.hasImageReferences && input.route.provider === "gemini") {
    return input.route;
  }

  if (input.route.modality === "image" && input.hasImageReferences && config.GOOGLE_AI_API_KEY) {
    return {
      ...input.route,
      provider: "gemini",
      model: config.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
      routingReason: "Image editing uses the configured Gemini image model.",
    };
  }

  if (input.purpose === "title_video" && input.route.modality === "video" && config.GOOGLE_AI_API_KEY) {
    return {
      ...input.route,
      provider: "gemini",
      model: config.GEMINI_VIDEO_MODEL || "veo-3.1-lite-generate-preview",
      routingReason: "Title-based video generation uses Gemini Veo for cinematic video output.",
    };
  }

  return input.route;
}

function supportsImageReferences(provider: string) {
  return provider === "gemini" || provider === "openai";
}

function isFreeAvatarProfileJob(input: { purpose?: string; agentId?: string; modality: AiModality }) {
  return input.purpose === "avatar_profile" && input.agentId === "avatar" && input.modality === "image";
}

function sanitizeAvatarVideoMetadata(input?: AvatarVideoGenerationInput) {
  if (!input) return undefined;

  return compactObject({
    hasReferenceImage: Boolean(input.referenceImage),
    referenceImageMimeType: input.referenceImage?.mimeType,
    referenceImageFilename: input.referenceImage?.filename,
    scriptLength: input.script?.length,
    avatarName: input.avatarName,
    consentConfirmed: input.consentConfirmed,
    aspectRatio: input.aspectRatio,
    expressiveness: input.expressiveness,
    motionPrompt: input.motionPrompt,
  });
}

function sanitizeMediaOptions(input?: MediaGenerationOptions) {
  if (!input) return undefined;

  return compactObject({
    aspectRatio: input.aspectRatio,
    imageSize: input.imageSize,
    videoResolution: input.videoResolution,
    durationSeconds: input.durationSeconds,
    voice: input.voice,
    speechSpeed: input.speechSpeed,
    audioFormat: input.audioFormat,
    camera: input.camera ? compactObject(input.camera) : undefined,
  });
}

function sanitizeImageReferenceMetadata(input?: ImageReferenceInput) {
  if (!input) return undefined;

  return compactObject({
    jobId: input.jobId,
    sourcePrompt: input.prompt,
    sourceResultUrl: input.resultUrl,
    mimeType: input.mimeType,
  });
}

function sanitizeImageReferencesMetadata(input: ImageReferenceInput[]) {
  if (input.length === 0) return undefined;
  return input.map((reference) => sanitizeImageReferenceMetadata(reference));
}

const providerBinaryFields = new Set([
  "artifactbase64",
  "data",
  "b64_json",
  "base64data",
  "base64_data",
  "bytesbase64encoded",
  "bytes_base64_encoded",
  "signature",
]);

function sanitizeProviderRaw(input?: Record<string, unknown>) {
  if (!input) return undefined;
  return sanitizeProviderValue(input) as Record<string, unknown>;
}

function sanitizeProviderValue(input: unknown, key?: string): unknown {
  if (typeof input === "string") {
    if (key && providerBinaryFields.has(key.toLowerCase())) return "[binary omitted]";
    if (input.length > 4_000) return "[large provider value omitted]";
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((value) => sanitizeProviderValue(value));
  }

  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([field, value]) => [field, sanitizeProviderValue(value, field)])
    );
  }

  return input;
}

function jobForResponse(job: MediaGenerationJob): MediaGenerationJob {
  const metadata = sanitizeProviderValue(job.metadata) as Record<string, unknown>;
  delete metadata.artifactBase64;
  return {
    ...job,
    metadata,
  };
}

function stringMetadata(job: MediaGenerationJob, key: string) {
  const value = job.metadata[key];
  return typeof value === "string" && value ? value : undefined;
}

function compactObject(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
