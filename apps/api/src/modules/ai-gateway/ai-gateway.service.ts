import type { AiRouteRequest } from "@nerix/shared";
import { DomainError, fail, ok } from "../../domain/result.js";
import type { AgentService } from "../agents/agent.service.js";
import type { BillingService } from "../billing/billing.service.js";
import { inferModality } from "./modality-classifier.js";
import { chooseProvider } from "./provider-router.js";

export class AiGatewayService {
  constructor(
    private readonly agents: AgentService,
    private readonly billing: BillingService
  ) {}

  async route(input: Partial<AiRouteRequest> & { prompt?: string }) {
    const prompt = input.prompt?.trim();

    if (!prompt) {
      return fail(new DomainError("validation_failed", "Prompt is required.", 400));
    }

    const modality = input.modality ?? inferModality(prompt);
    const agentResult = await this.agents.findBestAgent(prompt, input.agentId);
    if (!agentResult.ok) return agentResult;

    const estimateResult = await this.billing.estimate({
      prompt,
      agentId: agentResult.value.id,
    });
    if (!estimateResult.ok) return estimateResult;

    const provider = chooseProvider({
      country: input.country ?? "KZ",
      modality,
      preferredModel: agentResult.value.defaultModel,
    });

    return ok({
      agentId: agentResult.value.id,
      provider: provider.provider,
      model: provider.model,
      policyMode: provider.policyMode,
      estimatedCredits: estimateResult.value.estimatedCredits,
      reserveCredits: estimateResult.value.reserveCredits,
      asyncJob: ["image", "video", "music", "voice"].includes(modality),
      modality,
      routingReason: provider.reason,
    });
  }
}
