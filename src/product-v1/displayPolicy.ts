import type { ProductV1CandidateRecord } from './types';
import { supplyInterestV3 } from './core/candidateInventoryV3';
import { bubbleSlotPlan } from './core/optionalFeaturesV1';
import { candidateSearchUnitKey, SEARCH_NORMAL_DISPLAY_QUOTA } from './core/searchAcquisitionV4';

export const MAX_AUTO_SUPPLY_PER_INTEREST = 8;
// Legacy exports retained for compatibility. V4 no longer applies a fixed global Search cap.
export const MAX_DISPLAYED_SEARCH_RESULTS = Number.POSITIVE_INFINITY;
export const MAX_DISPLAYED_RESULTS_PER_SEED = SEARCH_NORMAL_DISPLAY_QUOTA;
export const MAX_SEARCH_CANDIDATES_PER_SEED = 12;
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

function seedUnitKey(record: ProductV1CandidateRecord) {
  return candidateSearchUnitKey(record.candidate);
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

export function selectDiverseDisplayRecords(
  records: ProductV1CandidateRecord[],
  options: { searchQuotaByInterest?: Record<string, number> } = {},
) {
  const seedUnitCounts = new Map<string, number>();
  const eligible = records.filter((record) => {
    if (record.candidate.source !== 'search') return true;
    const interest = supplyInterestV3(record.candidate);
    const quota = Math.max(
      1,
      Math.trunc(interest ? options.searchQuotaByInterest?.[interest] ?? SEARCH_NORMAL_DISPLAY_QUOTA : SEARCH_NORMAL_DISPLAY_QUOTA),
    );
    const unit = seedUnitKey(record);
    if ((seedUnitCounts.get(unit) ?? 0) >= quota) return false;
    seedUnitCounts.set(unit, (seedUnitCounts.get(unit) ?? 0) + 1);
    return true;
  });

  const pending = [...eligible];
  const output: ProductV1CandidateRecord[] = [];
  while (pending.length) {
    const burst = trailingInterestBurst(output);
    let nextIndex = 0;
    if (burst.count >= MAX_INTEREST_BURST) {
      const alternative = pending.slice(0, DIVERSITY_LOOKAHEAD).findIndex((record) => (
        supplyInterestV3(record.candidate) !== burst.interest
      ));
      if (alternative >= 0) nextIndex = alternative;
    }
    output.push(pending.splice(nextIndex, 1)[0]);
  }
  return output;
}

export function promoteAutoSearchExploration(
  records: ProductV1CandidateRecord[],
  scores: Record<string, { finalScore: number }>,
  target = 3,
  horizon = 20,
  qualityLossMargin = 0.12,
) {
  const output = [...records];
  const limit = Math.min(Math.max(0, Math.trunc(horizon)), output.length);
  let searchCount = output.slice(0, limit).filter((record) => record.candidate.source === 'search').length;
  const desiredSearch = Math.min(Math.max(0, Math.trunc(target)), limit);
  if (searchCount >= desiredSearch) return output;

  for (let candidateIndex = limit; candidateIndex < output.length && searchCount < desiredSearch; candidateIndex += 1) {
    const searchRecord = output[candidateIndex];
    if (searchRecord.candidate.source !== 'search') continue;
    const interest = supplyInterestV3(searchRecord.candidate);
    if (!interest) continue;
    const searchScore = scores[searchRecord.candidate.duplicateKey]?.finalScore;
    if (!Number.isFinite(searchScore)) continue;

    let replacementIndex = -1;
    let replacementScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < limit; index += 1) {
      const current = output[index];
      if (current.candidate.source === 'search') continue;
      if (supplyInterestV3(current.candidate) !== interest) continue;
      const score = scores[current.candidate.duplicateKey]?.finalScore;
      if (!Number.isFinite(score) || score >= replacementScore) continue;
      replacementIndex = index;
      replacementScore = score;
    }
    if (replacementIndex < 0 || searchScore < replacementScore - qualityLossMargin) continue;
    [output[replacementIndex], output[candidateIndex]] = [output[candidateIndex], output[replacementIndex]];
    searchCount += 1;
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
