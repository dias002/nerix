import type { AiModality, AiRouteRequest, AiTaskType } from "@nomduchat/shared";
import { DomainError, fail, ok } from "../../domain/result.js";
import type { AgentService } from "../agents/agent.service.js";
import type { BillingService } from "../billing/billing.service.js";
import { inferModality } from "./modality-classifier.js";
import { chooseProvider } from "./provider-router.js";
import type { AiCompletionProvider, CompletionStreamCallbacks } from "./completion-provider.js";

export class AiGatewayService {
  constructor(
    private readonly agents: AgentService,
    private readonly billing: BillingService,
    private readonly completionProvider: AiCompletionProvider
  ) {}

  async route(input: Partial<AiRouteRequest> & { prompt?: string }) {
    const prompt = input.prompt?.trim();

    if (!prompt) {
      return fail(new DomainError("validation_failed", "Prompt is required.", 400));
    }

    const modality = input.modality ?? inferModality(prompt);
    const agentResult = await this.agents.findBestAgent(prompt, input.agentId);
    if (!agentResult.ok) return agentResult;
    const taskType = input.taskType ?? inferTaskType({ prompt, modality, agentId: agentResult.value.id });

    const estimateResult = await this.billing.estimate({
      prompt,
      agentId: agentResult.value.id,
    });
    if (!estimateResult.ok) return estimateResult;

    const provider = chooseProvider({
      country: input.country ?? "KZ",
      modality,
      preferredModel: agentResult.value.defaultModel,
      agentId: agentResult.value.id,
      taskType,
      selectedModelId: input.selectedModelId,
    });
    if (!provider) {
      return fail(new DomainError("provider_unavailable", "No AI provider is configured for this request.", 503));
    }

    return ok({
      agentId: agentResult.value.id,
      taskType,
      provider: provider.provider,
      model: provider.model,
      policyMode: provider.policyMode,
      estimatedCredits: estimateResult.value.estimatedCredits,
      reserveCredits: estimateResult.value.reserveCredits,
      asyncJob: ["image", "video", "avatar_video", "music", "voice"].includes(modality),
      modality,
      routingReason: provider.reason,
    });
  }

  async complete(input: { provider: string; model: string; prompt: string; agentId: string }) {
    const agentResult = await this.agents.requireAgent(input.agentId);
    if (!agentResult.ok) return agentResult;

    return ok(
      await this.completionProvider.complete({
        provider: input.provider,
        model: input.model,
        prompt: input.prompt,
        systemPrompt: agentResult.value.systemPrompt,
      })
    );
  }

  async completeStreaming(input: {
    provider: string;
    model: string;
    prompt: string;
    agentId: string;
    onDelta: CompletionStreamCallbacks["onDelta"];
  }) {
    const agentResult = await this.agents.requireAgent(input.agentId);
    if (!agentResult.ok) return agentResult;

    return ok(
      await this.completionProvider.stream?.(
        {
          provider: input.provider,
          model: input.model,
          prompt: input.prompt,
          systemPrompt: agentResult.value.systemPrompt,
        },
        { onDelta: input.onDelta }
      ) ?? await this.completionProvider.complete({
        provider: input.provider,
        model: input.model,
        prompt: input.prompt,
        systemPrompt: agentResult.value.systemPrompt,
      })
    );
  }
}

function inferTaskType(input: { prompt: string; modality: AiModality; agentId?: string }): AiTaskType {
  if (input.modality === "code") return "code_generation";
  if (
    input.modality === "image" ||
    input.modality === "video" ||
    input.modality === "avatar_video" ||
    input.modality === "music" ||
    input.modality === "voice"
  ) {
    return "media_generation";
  }

  const normalizedPrompt = input.prompt.toLowerCase();
  if (/сайт|лендинг|website|landing/.test(normalizedPrompt)) return "website_copy";
  if (/рассыл|campaign|newsletter|email/.test(normalizedPrompt)) return "campaign_copy";
  if (/бот|telegram|policy|инструкц/.test(normalizedPrompt)) return "bot_policy";
  if (/summary|сводк|deal|сделк|pipeline/.test(normalizedPrompt)) return "deal_summary";
  if (/faq|knowledge|база знаний|найди по документ/.test(normalizedPrompt)) return "knowledge_search";

  if (input.agentId === "marketing") return "campaign_copy";
  if (input.agentId === "support") return "customer_support";
  if (input.agentId === "business") return "internal_analysis";
  if (input.agentId === "documents") return "knowledge_search";

  return "chat_reply";
}
