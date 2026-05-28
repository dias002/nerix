import assert from "node:assert/strict";
import test from "node:test";
import { estimateTextCredits, reserveCredits } from "../src/domain/credits.js";
import { inferModality } from "../src/modules/ai-gateway/modality-classifier.js";
import { chooseProvider } from "../src/modules/ai-gateway/provider-router.js";
import { createDependencies } from "../src/server/dependencies.js";

test("credits estimator has a minimum and applies multiplier", () => {
  assert.equal(estimateTextCredits("hi"), 30);
  assert.equal(estimateTextCredits("a".repeat(400), 1.4), 70);
  assert.equal(reserveCredits(100), 125);
});

test("modality classifier detects media and code tasks", () => {
  assert.equal(inferModality("сделай песню для рекламы"), "music");
  assert.equal(inferModality("найди bug в коде"), "code");
  assert.equal(inferModality("создай видео ролик"), "video");
  assert.equal(inferModality("обычный вопрос"), "text");
});

test("provider router separates supported and regional country routes", () => {
  assert.deepEqual(
    chooseProvider({
      country: "KZ",
      modality: "text",
      preferredModel: "text-primary",
    }),
    {
      provider: "mock-provider",
      model: "text-primary",
      reason: "Default provider for supported country route.",
    }
  );

  assert.equal(
    chooseProvider({
      country: "RU",
      modality: "music",
      preferredModel: "music-primary",
    }).provider,
    "regional-mock-provider"
  );
});

test("billing service reserves, captures, and refunds credits", async () => {
  const dependencies = createDependencies();
  const walletBefore = await dependencies.billing.getWallet("local-user");
  assert.equal(walletBefore.ok, true);
  if (!walletBefore.ok) return;

  const reservation = await dependencies.billing.reserve({
    userId: "local-user",
    prompt: "Напиши архитектуру API для Nerix",
    agentId: "general",
    referenceId: "test-request",
  });

  assert.equal(reservation.ok, true);
  if (!reservation.ok) return;

  assert.ok(reservation.value.reservationId);
  assert.equal(
    reservation.value.wallet.availableCredits,
    walletBefore.value.availableCredits - reservation.value.estimate.reserveCredits
  );
  assert.equal(reservation.value.wallet.reservedCredits, reservation.value.estimate.reserveCredits);

  const captured = await dependencies.billing.capture({
    userId: "local-user",
    reservationId: reservation.value.reservationId,
    finalCredits: reservation.value.estimate.estimatedCredits,
  });

  assert.equal(captured.ok, true);
  if (!captured.ok) return;

  const unusedCredits = reservation.value.estimate.reserveCredits - reservation.value.estimate.estimatedCredits;
  const refunded = await dependencies.billing.refund({
    userId: "local-user",
    reservationId: reservation.value.reservationId,
    credits: unusedCredits,
  });

  assert.equal(refunded.ok, true);
  if (!refunded.ok) return;

  assert.equal(refunded.value.reservedCredits, 0);
  assert.equal(
    refunded.value.availableCredits,
    walletBefore.value.availableCredits - reservation.value.estimate.estimatedCredits
  );
});

