import type { BehaviorEvent, RewardSignal } from "./types";

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

export function evaluateReward(event: BehaviorEvent): RewardSignal {
  const readMs = Math.max(event.estimatedReadingMs, 1);
  const dwellRatio = clamp(event.dwellMs / readMs, 0, 2);
  const completionRatio = clamp(Math.max(event.scrollRatio, Math.min(dwellRatio, 1)), 0, 1);
  const components: Record<string, number> = {};
  if (event.favorited) components.favorite = 0.72;
  if (event.liked) components.like = 0.42;
  if (event.hidden) components.hide = -0.90;
  if (event.explicitNotInterested) components.not_interested = -1.00;
  if (event.opened) {
    components.completion = 0.24 * completionRatio;
    components.dwell = 0.16 * clamp(dwellRatio, 0, 1);
    if (dwellRatio < 0.10 && completionRatio < 0.12) components.quick_bounce = -0.28;
  } else if (event.skipped) {
    // No action / no click is deliberately weak evidence, not dislike.
    components.skip = -0.035;
  }
  const reward = clamp(Object.values(components).reduce((a, b) => a + b, 0), -1, 1);
  let confidence = 0.08;
  if (event.explicitNotInterested || event.hidden) confidence = 0.99;
  else if (event.favorited) confidence = 0.97;
  else if (event.liked) confidence = 0.90;
  else if (event.opened && (dwellRatio >= 0.55 || completionRatio >= 0.65)) confidence = 0.68;
  else if (event.opened) confidence = 0.42;
  else if (event.skipped) confidence = 0.14;
  return { reward, confidence, dwellRatio, completionRatio, components };
}
