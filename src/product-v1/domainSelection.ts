export type ProductV1DomainScore = {
  domain: string;
  score: number;
};

export type ProductV1DomainMatch = ProductV1DomainScore & {
  label: string;
};

export type ProductV1DomainSelectionOptions = {
  minScore?: number;
  maxGapFromBest?: number;
  maxDomains?: number;
  labelForDomain?: (domain: string) => string;
};

export function selectProductV1DomainMatches(
  scores: Iterable<ProductV1DomainScore>,
  options: ProductV1DomainSelectionOptions = {},
): ProductV1DomainMatch[] {
  const minScore = options.minScore ?? 0.18;
  const maxGapFromBest = options.maxGapFromBest ?? 0.08;
  const maxDomains = Math.max(1, Math.trunc(options.maxDomains ?? 3));
  const labelForDomain = options.labelForDomain ?? ((domain: string) => domain);

  const aggregated = new Map<string, number>();
  for (const row of scores) {
    const domain = row.domain.trim();
    if (!domain || domain === 'UNKNOWN' || !Number.isFinite(row.score)) continue;
    aggregated.set(domain, Math.max(aggregated.get(domain) ?? -Infinity, row.score));
  }

  const ranked = [...aggregated.entries()]
    .map(([domain, score]) => ({ domain, score }))
    .sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));

  const best = ranked[0]?.score;
  if (best == null || best < minScore) return [];

  const cutoff = Math.max(minScore, best - maxGapFromBest);
  return ranked
    .filter((row) => row.score >= cutoff)
    .slice(0, maxDomains)
    .map((row) => ({ ...row, label: labelForDomain(row.domain) }));
}
