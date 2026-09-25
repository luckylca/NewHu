import type { CandidateArticle, SearchSeedCompact } from './candidateAcquisition';

export const SEARCH_PAGE_OFFSETS = [0, 20, 40] as const;
export const SEARCH_PAGE_LIMIT = 20;
export const SEARCH_CANDIDATES_RETAINED_PER_REQUEST = 12;
export const SEARCH_MAX_REQUESTS_PER_CYCLE = 10;
export const SEARCH_RECOVERY_REQUESTS = 3;
export const SEARCH_HIGH_DEFICIT_THRESHOLD = 7;
export const SEARCH_NORMAL_DISPLAY_QUOTA = 2;
export const SEARCH_HIGH_DEFICIT_DISPLAY_QUOTA = 3;
export const AUTO_SEARCH_EXPLORATION_TARGET = 3;
export const AUTO_SEARCH_MAX_PROACTIVE_REQUESTS = 1;
export const SEARCH_SAME_INTEREST_QUALITY_GUARD = 0.12;
export const SEARCH_UNIT_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
export const SEARCH_UNIT_HISTORY_LIMIT = 100;

export type SearchPageOffset = (typeof SEARCH_PAGE_OFFSETS)[number];

export interface SearchUnitHistoryEntry {
  key: string;
  seedId: string;
  offset: SearchPageOffset;
  usedAt: number;
}

export interface DisplayableSupplySnapshot {
  counts: Record<string, number>;
  recommendationCounts: Record<string, number>;
  searchCounts: Record<string, number>;
  searchQuotaByInterest: Record<string, number>;
  totalDisplayableSearch: number;
}

export function searchUnitKey(seedId: string, offset: number) {
  return `${seedId}@${Math.max(0, Math.trunc(offset))}`;
}

export function candidateSearchOffset(candidate: CandidateArticle): SearchPageOffset {
  const value = Number(candidate.rawMetadata?.searchOffset ?? 0);
  return SEARCH_PAGE_OFFSETS.includes(value as SearchPageOffset) ? value as SearchPageOffset : 0;
}

export function candidateSearchUnitKey(candidate: CandidateArticle) {
  const seedId = candidate.searchSeedId ?? candidate.seedIds[0] ?? candidate.sourceQuery ?? candidate.duplicateKey;
  return searchUnitKey(seedId, candidateSearchOffset(candidate));
}

export function pruneSearchUnitHistory(
  history: SearchUnitHistoryEntry[],
  nowMs = Date.now(),
  ttlMs = SEARCH_UNIT_HISTORY_TTL_MS,
) {
  const cutoff = nowMs - Math.max(0, ttlMs);
  const byKey = new Map<string, SearchUnitHistoryEntry>();
  for (const entry of history) {
    if (!entry?.key || !entry?.seedId || !Number.isFinite(entry.usedAt) || entry.usedAt < cutoff) continue;
    byKey.set(entry.key, entry);
  }
  return [...byKey.values()]
    .sort((a, b) => a.usedAt - b.usedAt)
    .slice(-SEARCH_UNIT_HISTORY_LIMIT);
}

export function nextSearchOffset(
  seedId: string,
  history: SearchUnitHistoryEntry[],
  nowMs = Date.now(),
): SearchPageOffset | null {
  const used = new Set(pruneSearchUnitHistory(history, nowMs).map((entry) => entry.key));
  return SEARCH_PAGE_OFFSETS.find((offset) => !used.has(searchUnitKey(seedId, offset))) ?? null;
}

export function recordSearchUnit(
  history: SearchUnitHistoryEntry[],
  seedId: string,
  offset: SearchPageOffset,
  nowMs = Date.now(),
) {
  const current = pruneSearchUnitHistory(history, nowMs)
    .filter((entry) => entry.key !== searchUnitKey(seedId, offset));
  current.push({ key: searchUnitKey(seedId, offset), seedId, offset, usedAt: nowMs });
  return current.slice(-SEARCH_UNIT_HISTORY_LIMIT);
}

export function searchSeedFamily(seed: Pick<SearchSeedCompact, 'text' | 'parentText'>) {
  return (seed.parentText ?? seed.text).trim().toLocaleLowerCase();
}

export interface SearchSeedUnitSelection {
  seed: SearchSeedCompact;
  offset: SearchPageOffset;
  family: string;
}

/**
 * Select the next exact Search unit without permanently burning a whole seed family.
 *
 * Page-0 across distinct seeds is preferred before page-20/page-40. Within the
 * current acquisition cycle we softly prefer a family that has not been used yet;
 * if every available seed belongs to an already-used family, another unused
 * seed/page variant is still allowed. This preserves the incremental value of the
 * six seed variants validated by the Windows V4 research.
 */
export function selectSearchSeedUnit(
  orderedSeeds: Iterable<SearchSeedCompact>,
  history: SearchUnitHistoryEntry[],
  usedFamiliesThisCycle: ReadonlySet<string> = new Set<string>(),
  nowMs = Date.now(),
): SearchSeedUnitSelection | null {
  const unique = new Map<string, SearchSeedCompact>();
  for (const seed of orderedSeeds) {
    if (!seed.enabled || unique.has(seed.seedId)) continue;
    unique.set(seed.seedId, seed);
  }
  const available = [...unique.values()].map((seed) => ({
    seed,
    offset: nextSearchOffset(seed.seedId, history, nowMs),
    family: searchSeedFamily(seed),
  })).filter((row): row is SearchSeedUnitSelection => row.offset != null);

  for (const offset of SEARCH_PAGE_OFFSETS) {
    const pageRows = available.filter((row) => row.offset === offset);
    const diverse = pageRows.find((row) => !usedFamiliesThisCycle.has(row.family));
    if (diverse) return diverse;
    if (pageRows[0]) return pageRows[0];
  }
  return null;
}

export function searchDisplayQuota(displayDeficit: number, explicit: boolean) {
  return explicit && displayDeficit >= SEARCH_HIGH_DEFICIT_THRESHOLD
    ? SEARCH_HIGH_DEFICIT_DISPLAY_QUOTA
    : SEARCH_NORMAL_DISPLAY_QUOTA;
}

export function searchRequestBudget(displayDeficit: number, quota: number) {
  const deficit = Math.max(0, Math.trunc(displayDeficit));
  const safeQuota = Math.max(1, Math.trunc(quota));
  if (deficit <= 0) return 0;
  return Math.min(
    SEARCH_MAX_REQUESTS_PER_CYCLE,
    Math.ceil(deficit / safeQuota) + SEARCH_RECOVERY_REQUESTS,
  );
}

export function reserveCapForDesiredSupply(desiredSupply: number) {
  return Math.max(30, 4 * Math.max(0, Math.trunc(desiredSupply)));
}

function isSearch(candidate: CandidateArticle) {
  return candidate.source === 'search' || candidate.sourceOrigins.includes('search');
}

export function displayableSupplySnapshot(
  candidates: Iterable<CandidateArticle>,
  desiredSupply: Record<string, number>,
  explicit: boolean,
): DisplayableSupplySnapshot {
  const rows = [...candidates].filter((candidate) => candidate.qualified);
  const recommendationCounts: Record<string, number> = {};
  const searchGroups = new Map<string, CandidateArticle[]>();

  for (const candidate of rows) {
    const interest = typeof candidate.rawMetadata?.targetInterest === 'string' && isSearch(candidate)
      ? candidate.rawMetadata.targetInterest
      : candidate.bestMatchedInterest ?? null;
    if (!interest) continue;
    if (!isSearch(candidate)) {
      recommendationCounts[interest] = (recommendationCounts[interest] ?? 0) + 1;
      continue;
    }
    const key = `${interest}:${candidateSearchUnitKey(candidate)}`;
    const group = searchGroups.get(key) ?? [];
    group.push(candidate);
    searchGroups.set(key, group);
  }

  const searchQuotaByInterest: Record<string, number> = {};
  const searchCounts: Record<string, number> = {};
  const interests = new Set([
    ...Object.keys(desiredSupply),
    ...Object.keys(recommendationCounts),
    ...[...searchGroups.keys()].map((key) => key.slice(0, key.indexOf(':'))),
  ]);
  for (const interest of interests) {
    const desired = Math.max(0, Math.trunc(desiredSupply[interest] ?? 0));
    const recommendation = recommendationCounts[interest] ?? 0;
    searchQuotaByInterest[interest] = searchDisplayQuota(Math.max(0, desired - recommendation), explicit);
  }

  for (const [key, group] of searchGroups) {
    const separator = key.indexOf(':');
    const interest = key.slice(0, separator);
    const quota = searchQuotaByInterest[interest] ?? SEARCH_NORMAL_DISPLAY_QUOTA;
    searchCounts[interest] = (searchCounts[interest] ?? 0) + Math.min(quota, group.length);
  }

  const counts: Record<string, number> = {};
  for (const interest of interests) {
    counts[interest] = (recommendationCounts[interest] ?? 0) + (searchCounts[interest] ?? 0);
  }
  return {
    counts,
    recommendationCounts,
    searchCounts,
    searchQuotaByInterest,
    totalDisplayableSearch: Object.values(searchCounts).reduce((sum, count) => sum + count, 0),
  };
}
