export const MIN_REQUEST_CREDITS = 30;
export const CREDIT_RESERVE_MULTIPLIER = 1.25;

export function estimateTextCredits(prompt: string, multiplier = 1) {
  const normalizedLength = prompt.trim().length;
  const base = Math.ceil(normalizedLength / 8);
  return Math.max(MIN_REQUEST_CREDITS, Math.ceil(base * multiplier));
}

export function reserveCredits(estimatedCredits: number) {
  return Math.ceil(estimatedCredits * CREDIT_RESERVE_MULTIPLIER);
}

