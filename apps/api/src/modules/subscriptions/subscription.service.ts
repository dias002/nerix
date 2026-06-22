import { DomainError, fail, ok } from "../../domain/result.js";
import { config } from "../../config.js";
import type { BillingService } from "../billing/billing.service.js";
import { findPlanPrice, isPlanId, isSubscriptionCountry } from "./plans.js";
import { createSubscriptionPaymentProvider, type ProviderCheckout } from "./payment-provider.js";
import type { SubscriptionRepository } from "./subscription.repository.js";
import type {
  PaymentProviderCode,
  ProviderCheckoutEventInput,
  ProviderPaymentStatus,
  SubscriptionCompletion,
  SubscriptionCountry,
} from "./subscription.types.js";

export class SubscriptionService {
  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly billing: BillingService
  ) {}

  async listPlans(country: SubscriptionCountry = "KZ") {
    const plans = await this.repository.listPlans(country);
    return ok({
      country,
      plans: plans.map((plan) => {
        const price = findPlanPrice(plan, country);
        if (!price) {
          throw new Error(`Plan '${plan.id}' has no price for ${country}.`);
        }

        return {
          id: plan.id,
          name: plan.name,
          monthlyCredits: plan.monthlyCredits,
          contextTokens: plan.contextTokens,
          description: plan.description,
          enabled: plan.enabled,
          price,
        };
      }),
    });
  }

  async createCheckout(input: { userId: string; planId: string; country: string }) {
    const country = input.country.toUpperCase();
    if (!isSubscriptionCountry(country)) {
      return fail(new DomainError("validation_failed", "Subscriptions are currently available only for KZ and RU.", 400));
    }

    if (!isPlanId(input.planId)) {
      return fail(new DomainError("not_found", `Plan '${input.planId}' was not found.`, 404));
    }

    const plan = await this.repository.findPlan(input.planId);
    if (!plan) {
      return fail(new DomainError("not_found", `Plan '${input.planId}' was not found.`, 404));
    }

    const price = findPlanPrice(plan, country);
    if (!price) {
      return fail(new DomainError("validation_failed", `Plan '${input.planId}' is not available in ${country}.`, 400));
    }

    let providerCheckout: ProviderCheckout;
    try {
      providerCheckout = await createSubscriptionPaymentProvider(price.provider).createCheckout({
        userId: input.userId,
        plan,
        price,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment provider is not configured.";
      return fail(new DomainError("provider_unavailable", message, 503));
    }

    const checkout = await this.repository.createCheckout({
      userId: input.userId,
      plan,
      price,
      providerCheckoutId: providerCheckout.providerCheckoutId,
      checkoutUrl: providerCheckout.checkoutUrl,
    });

    if (!checkout) {
      return fail(new DomainError("not_found", `User '${input.userId}' was not found.`, 404));
    }

    return ok({
      checkout,
      plan: {
        id: plan.id,
        name: plan.name,
        monthlyCredits: plan.monthlyCredits,
      },
    });
  }

  async completeMockCheckout(input: { checkoutId: string }) {
    if (!config.PAYMENT_MOCK_CHECKOUT_ENABLED) {
      return fail(new DomainError("provider_unavailable", "Mock checkout is disabled.", 403));
    }

    const completion = await this.repository.completeCheckoutPayment(input.checkoutId);
    if (!completion) {
      return fail(new DomainError("not_found", `Checkout '${input.checkoutId}' was not found.`, 404));
    }

    return this.finalizeCompletion(completion);
  }

  async completeProviderCheckout(input: ProviderCheckoutEventInput) {
    const completion = await this.repository.completeCheckoutPaymentByProvider(input);
    if (!completion) {
      return fail(
        new DomainError(
          "not_found",
          `Checkout '${input.providerCheckoutId}' for provider '${input.provider}' was not found.`,
          404
        )
      );
    }

    return this.finalizeCompletion(completion);
  }

  async processProviderPaymentEvent(input: ProviderCheckoutEventInput & { paymentStatus: ProviderPaymentStatus }) {
    if (input.paymentStatus === "succeeded") {
      return this.completeProviderCheckout(input);
    }

    if (input.paymentStatus === "failed" || input.paymentStatus === "cancelled") {
      const checkout = await this.repository.failCheckoutPaymentByProvider(input);
      if (!checkout) {
        return fail(
          new DomainError(
            "not_found",
            `Checkout '${input.providerCheckoutId}' for provider '${input.provider}' was not found.`,
            404
          )
        );
      }

      return ok({
        checkout,
        paymentStatus: input.paymentStatus,
        creditsGranted: false,
      });
    }

    return ok({
      provider: input.provider,
      providerCheckoutId: input.providerCheckoutId,
      paymentStatus: input.paymentStatus,
      ignored: true,
    });
  }

  private async finalizeCompletion(completion: SubscriptionCompletion) {
    const plan = await this.repository.findPlan(completion.subscription.planId);
    if (!plan) {
      return fail(new DomainError("not_found", `Plan '${completion.subscription.planId}' was not found.`, 404));
    }

    const wallet = completion.shouldGrantCredits
      ? await this.billing.topupOnce({
          userId: completion.subscription.userId,
          credits: plan.monthlyCredits,
          referenceId: completion.subscription.id,
        })
      : await this.billing.getWallet(completion.subscription.userId);

    if (!wallet.ok) return wallet;

    if (completion.shouldGrantCredits) {
      const updatedCheckout = await this.repository.markCheckoutCreditsGranted(completion.checkout.id);
      if (updatedCheckout) {
        completion.checkout = updatedCheckout;
      }
    }

    return ok({
      checkout: completion.checkout,
      subscription: completion.subscription,
      wallet: wallet.value,
    });
  }

  async currentSubscription(userId = "local-user") {
    const subscription = await this.repository.currentSubscription(userId);
    return ok({
      subscription,
    });
  }

  async cancelCurrentSubscription(userId = "local-user") {
    const subscription = await this.repository.cancelCurrentSubscription(userId);
    if (!subscription) {
      return fail(new DomainError("not_found", `Active subscription for user '${userId}' was not found.`, 404));
    }

    return ok({
      subscription,
    });
  }
}
