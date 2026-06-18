import { DomainError, fail, ok } from "../../domain/result.js";
import { estimateTextCredits, reserveCredits } from "../../domain/credits.js";
import type { AgentService } from "../agents/agent.service.js";
import type { WalletRepository } from "./wallet.repository.js";

export class BillingService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly agents: AgentService
  ) {}

  async getWallet(userId = "local-user") {
    const wallet = await this.walletRepository.getWallet(userId);

    if (!wallet) {
      return fail(new DomainError("not_found", `Wallet for user '${userId}' was not found.`, 404));
    }

    return ok(wallet);
  }

  async estimate(input: { prompt: string; agentId?: string }) {
    const agentResult = await this.agents.findBestAgent(input.prompt, input.agentId);
    if (!agentResult.ok) return agentResult;

    const estimatedCredits = estimateTextCredits(input.prompt, agentResult.value.priceMultiplier);

    return ok({
      agentId: agentResult.value.id,
      estimatedCredits,
      reserveCredits: reserveCredits(estimatedCredits),
      currency: "NOMDUCHAT" as const,
    });
  }

  async topup(input: { userId: string; credits: number; referenceId: string }) {
    const wallet = await this.walletRepository.topup(input.userId, input.credits, input.referenceId);

    if (!wallet) {
      return fail(new DomainError("not_found", `Wallet for user '${input.userId}' was not found.`, 404));
    }

    return ok(wallet);
  }

  async topupOnce(input: { userId: string; credits: number; referenceId: string }) {
    const wallet = await this.walletRepository.topupOnce(input.userId, input.credits, input.referenceId);

    if (!wallet) {
      return fail(new DomainError("not_found", `Wallet for user '${input.userId}' was not found.`, 404));
    }

    return ok(wallet);
  }

  async reserve(input: { userId: string; prompt: string; agentId?: string; referenceId: string }) {
    const estimateResult = await this.estimate(input);
    if (!estimateResult.ok) return estimateResult;

    const reservation = await this.walletRepository.reserve(
      input.userId,
      estimateResult.value.reserveCredits,
      input.referenceId
    );

    if (!reservation) {
      return fail(new DomainError("insufficient_credits", "Not enough nomduchat credits.", 402));
    }

    return ok({
      ...reservation,
      estimate: estimateResult.value,
    });
  }

  async capture(input: { userId: string; reservationId: string; finalCredits: number }) {
    const wallet = await this.walletRepository.capture(input.userId, input.reservationId, input.finalCredits);

    if (!wallet) {
      return fail(new DomainError("validation_failed", "Reservation cannot be captured.", 400));
    }

    return ok(wallet);
  }

  async refund(input: { userId: string; reservationId: string; credits: number }) {
    const wallet = await this.walletRepository.refund(input.userId, input.reservationId, input.credits);

    if (!wallet) {
      return fail(new DomainError("validation_failed", "Reservation cannot be refunded.", 400));
    }

    return ok(wallet);
  }

  async ledger(userId = "local-user") {
    return ok({
      entries: await this.walletRepository.ledger(userId),
    });
  }
}
