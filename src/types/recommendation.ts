export type ProductV1RecommendationQualitySignal =
  | 'popular'
  | 'save_dominant'
  | 'popular_and_save_dominant'
  | 'ultra_high';

export type ProductV1RecommendationReason = {
  version: 1;
  articleId: string;
  cycleId: string;
  interestId: string | null;
  interestLabel: string | null;
  profileAffinity: number | null;
  semanticScore: number | null;
  qualitySignal: ProductV1RecommendationQualitySignal | null;
  qualityLabel: string | null;
  bubbleBreak: boolean;
  bubbleDomain: string | null;
  bubbleDomainLabel: string | null;
  source: 'recommendation' | 'search';
  summary: string;
};

const QUALITY_SIGNALS = new Set<ProductV1RecommendationQualitySignal>([
  'popular',
  'save_dominant',
  'popular_and_save_dominant',
  'ultra_high',
]);

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function parseProductV1RecommendationReason(raw: unknown): ProductV1RecommendationReason | undefined {
  let value = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return undefined;
    try {
      value = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!value || typeof value !== 'object') return undefined;

  const row = value as Record<string, unknown>;
  if (row.version !== 1) return undefined;
  if (typeof row.articleId !== 'string' || !row.articleId.trim()) return undefined;
  if (typeof row.cycleId !== 'string' || !row.cycleId.trim()) return undefined;
  if (row.source !== 'recommendation' && row.source !== 'search') return undefined;
  if (typeof row.summary !== 'string' || !row.summary.trim()) return undefined;

  const qualitySignal = row.qualitySignal == null
    ? null
    : QUALITY_SIGNALS.has(row.qualitySignal as ProductV1RecommendationQualitySignal)
      ? row.qualitySignal as ProductV1RecommendationQualitySignal
      : undefined;
  if (qualitySignal === undefined) return undefined;

  return {
    version: 1,
    articleId: row.articleId,
    cycleId: row.cycleId,
    interestId: nullableString(row.interestId),
    interestLabel: nullableString(row.interestLabel),
    profileAffinity: finiteNumber(row.profileAffinity),
    semanticScore: finiteNumber(row.semanticScore),
    qualitySignal,
    qualityLabel: nullableString(row.qualityLabel),
    bubbleBreak: row.bubbleBreak === true,
    bubbleDomain: nullableString(row.bubbleDomain),
    bubbleDomainLabel: nullableString(row.bubbleDomainLabel),
    source: row.source,
    summary: row.summary.trim(),
  };
}
