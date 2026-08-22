import type { CandidateArticle } from "./candidateAcquisition";

export interface CandidateInventoryConfig {
  retrievalTtlHours: number;
}

export const DEFAULT_CANDIDATE_INVENTORY_CONFIG: CandidateInventoryConfig = { retrievalTtlHours: 24 * 7 };

function timestampMs(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null;
}

export function candidateAgeDays(candidate: CandidateArticle, nowMs = Date.now()): number | null {
  const published = timestampMs(candidate.publishedAt ?? candidate.updatedAt);
  if (published == null) return null;
  return Math.max(0, (nowMs - published) / 86_400_000);
}

export function isInventoryEntryExpired(candidate: CandidateArticle, config: CandidateInventoryConfig = DEFAULT_CANDIDATE_INVENTORY_CONFIG, nowMs = Date.now()): boolean {
  const retrieved = timestampMs(candidate.retrievedAt);
  if (retrieved == null) return false;
  return nowMs - retrieved > config.retrievalTtlHours * 3_600_000;
}

export function candidateSupplyInterest(candidate: CandidateArticle): string | null {
  const target = candidate.rawMetadata?.targetInterest;
  if (candidate.qualified && typeof target === "string" && target.trim().length > 0 && (candidate.source === "search" || candidate.sourceOrigins.includes("search"))) return target;
  return candidate.bestMatchedInterest ?? null;
}

export class CandidateInventory {
  private readonly byKey = new Map<string, CandidateArticle>();
  private readonly used = new Set<string>();
  private readonly lastAcquisition = new Map<string, string>();

  add(candidates: CandidateArticle[], acquiredAt = new Date().toISOString()): number {
    let added = 0;
    for (const candidate of candidates) {
      const key = candidate.duplicateKey;
      const current = this.byKey.get(key);
      if (!current) { this.byKey.set(key, { ...candidate }); added += 1; }
      else {
        current.sourceOrigins = [...new Set([...current.sourceOrigins, ...candidate.sourceOrigins, candidate.source])];
        current.queries = [...new Set([...current.queries, ...candidate.queries, ...(candidate.sourceQuery ? [candidate.sourceQuery] : [])])];
        current.seedIds = [...new Set([...current.seedIds, ...candidate.seedIds, ...(candidate.searchSeedId ? [candidate.searchSeedId] : [])])];
        if ((candidate.bestSemanticScore ?? Number.NEGATIVE_INFINITY) > (current.bestSemanticScore ?? Number.NEGATIVE_INFINITY)) this.byKey.set(key, { ...candidate });
      }
      const interest = candidateSupplyInterest(candidate);
      if (interest) this.lastAcquisition.set(interest, acquiredAt);
    }
    return added;
  }

  markUsed(duplicateKeys: Iterable<string>): void { for (const key of duplicateKeys) this.used.add(key); }

  unusedQualifiedCounts(config: CandidateInventoryConfig = DEFAULT_CANDIDATE_INVENTORY_CONFIG, nowMs = Date.now()): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, candidate] of this.byKey) {
      const interest = candidateSupplyInterest(candidate);
      if (this.used.has(key) || !candidate.qualified || !interest || isInventoryEntryExpired(candidate, config, nowMs)) continue;
      out[interest] = (out[interest] ?? 0) + 1;
    }
    return out;
  }

  sourceMix(interestId: string, config: CandidateInventoryConfig = DEFAULT_CANDIDATE_INVENTORY_CONFIG, nowMs = Date.now()): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, candidate] of this.byKey) {
      const interest = candidateSupplyInterest(candidate);
      if (this.used.has(key) || !candidate.qualified || interest !== interestId || isInventoryEntryExpired(candidate, config, nowMs)) continue;
      for (const source of candidate.sourceOrigins.length ? candidate.sourceOrigins : [candidate.source]) out[source] = (out[source] ?? 0) + 1;
    }
    return out;
  }

  lastAcquisitionTime(interestId: string): string | null { return this.lastAcquisition.get(interestId) ?? null; }

  ageDays(interestId?: string, config: CandidateInventoryConfig = DEFAULT_CANDIDATE_INVENTORY_CONFIG, nowMs = Date.now()): number[] {
    const ages: number[] = [];
    for (const [key, candidate] of this.byKey) {
      if (this.used.has(key) || !candidate.qualified || isInventoryEntryExpired(candidate, config, nowMs)) continue;
      if (interestId && candidateSupplyInterest(candidate) !== interestId) continue;
      const age = candidateAgeDays(candidate, nowMs); if (age != null) ages.push(age);
    }
    return ages.sort((a, b) => a - b);
  }
}
