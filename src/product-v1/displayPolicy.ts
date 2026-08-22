import type { ProductV1CandidateRecord } from './types';
import { supplyInterestV3 } from './core/candidateInventoryV3';
import { bubbleSlotPlan } from './core/optionalFeaturesV1';

export const MAX_AUTO_SUPPLY_PER_INTEREST = 8;
export const MAX_DISPLAYED_SEARCH_RESULTS = 6;
export const MAX_DISPLAYED_RESULTS_PER_SEED = 2;
export const MAX_SEARCH_CANDIDATES_PER_SEED = 4;
const MAX_INTEREST_BURST = 3;
const DIVERSITY_LOOKAHEAD = 12;

export function capAutoDesiredSupply(
  desired: Record<string, number>,
  maximum = MAX_AUTO_SUPPLY_PER_INTEREST,
) {
  return Object.fromEntries(Object.entries(desired).map(([interest, count]) => [
    interest,
    Math.min(Math.max(0, Math.trunc(count)), maximum),
  ]));
}

function seedKey(record: ProductV1CandidateRecord) {
  const candidate = record.candidate;
  return candidate.searchSeedId ?? candidate.seedIds[0] ?? candidate.sourceQuery ?? null;
}

function trailingInterestBurst(records: ProductV1CandidateRecord[]) {
  const lastInterest = records.length ? supplyInterestV3(records[records.length - 1].candidate) : null;
  if (!lastInterest) return { interest: null, count: 0 };
  let count = 0;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (supplyInterestV3(records[index].candidate) !== lastInterest) break;
    count += 1;
  }
  return { interest: lastInterest, count };
}

export function selectDiverseDisplayRecords(records: ProductV1CandidateRecord[]) {
  const seedCounts = new Map<string, number>();
  let searchCount = 0;
  const eligible = records.filter((record) => {
    if (record.candidate.source !== 'search') return true;
    if (searchCount >= MAX_DISPLAYED_SEARCH_RESULTS) return false;
    const seed = seedKey(record);
    if (seed && (seedCounts.get(seed) ?? 0) >= MAX_DISPLAYED_RESULTS_PER_SEED) return false;
    searchCount += 1;
    if (seed) seedCounts.set(seed, (seedCounts.get(seed) ?? 0) + 1);
    return true;
  });

  const pending = [...eligible];
  const output: ProductV1CandidateRecord[] = [];
  while (pending.length) {
    const burst = trailingInterestBurst(output);
    const previousWasSearch = output.at(-1)?.candidate.source === 'search';
    let nextIndex = 0;
    if (previousWasSearch || burst.count >= MAX_INTEREST_BURST) {
      const alternative = pending.slice(0, DIVERSITY_LOOKAHEAD).findIndex((record) => {
        if (previousWasSearch && record.candidate.source === 'search') return false;
        if (burst.count >= MAX_INTEREST_BURST && supplyInterestV3(record.candidate) === burst.interest) return false;
        return true;
      });
      if (alternative >= 0) nextIndex = alternative;
    }
    output.push(pending.splice(nextIndex, 1)[0]);
  }
  return output;
}

export function composeBubbleDisplayRecords(
  knownRecords: ProductV1CandidateRecord[],
  bubbleRecords: ProductV1CandidateRecord[],
  enabled: boolean,
  horizon = 20,
) {
  if (!enabled || bubbleRecords.length === 0) return [...knownRecords];
  const plan = bubbleSlotPlan(horizon, { enabled: true, intensity: 'low' });
  const known = [...knownRecords];
  const bubbles = [...bubbleRecords];
  const output: ProductV1CandidateRecord[] = [];
  for (const slot of plan) {
    const next = slot === 'bubble' ? bubbles.shift() : known.shift();
    if (next) output.push(next);
  }
  output.push(...known, ...bubbles);
  return output;
}
