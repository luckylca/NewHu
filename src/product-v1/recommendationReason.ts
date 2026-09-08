import type { CandidateArticle } from './core/candidateAcquisition';
import { supplyInterestV3 } from './core/candidateInventoryV3';
import { qualityFromCandidateV2 } from './core/highQualityAcquisitionV2';
import { productV1DomainLabel } from './domainLabels';
import type {
  ProductV1RecommendationQualitySignal,
  ProductV1RecommendationReason,
} from '@/src/types/recommendation';

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function roundScore(value: number | null) {
  return value == null ? null : Math.round(value * 10_000) / 10_000;
}

function semanticScoreFor(candidate: CandidateArticle, interestId: string | null, bubbleBreak: boolean) {
  if (bubbleBreak) {
    const bubbleScore = finite(candidate.rawMetadata.bubbleDomainScore);
    if (bubbleScore != null) return roundScore(bubbleScore);
  }
  if (interestId) {
    const index = candidate.matchedInterestIds.indexOf(interestId);
    const matched = finite(candidate.matchedInterestScores[index]);
    if (matched != null) return roundScore(matched);
  }
  return roundScore(finite(candidate.bestSemanticScore));
}

function qualityReason(candidate: CandidateArticle): {
  signal: ProductV1RecommendationQualitySignal | null;
  label: string | null;
} {
  const quality = qualityFromCandidateV2(candidate);
  if (quality.ultraHighQuality) return { signal: 'ultra_high', label: '高收藏价值' };
  if (quality.eligibilityReason === 'POPULAR_AND_SAVE_DOMINANT') {
    return { signal: 'popular_and_save_dominant', label: '高互动/高收藏' };
  }
  if (quality.eligibilityReason === 'SAVE_DOMINANT') {
    return { signal: 'save_dominant', label: '收藏偏强' };
  }
  if (quality.eligibilityReason === 'POPULAR') {
    return { signal: 'popular', label: '高互动' };
  }
  return { signal: null, label: null };
}

export function buildProductV1RecommendationReason(
  candidate: CandidateArticle,
  options: { profileAffinity?: number | null } = {},
): ProductV1RecommendationReason | null {
  const bubbleBreak = candidate.rawMetadata.sourcePolicy === 'bubble_break'
    || candidate.rawMetadata.wasSerendipity === true;
  const bubbleDomain = typeof candidate.rawMetadata.bubbleDomain === 'string'
    && candidate.rawMetadata.bubbleDomain.trim()
    ? candidate.rawMetadata.bubbleDomain.trim()
    : null;
  const targetInterest = typeof candidate.rawMetadata.targetInterest === 'string'
    && candidate.rawMetadata.targetInterest.trim()
    ? candidate.rawMetadata.targetInterest.trim()
    : null;
  const interestId = bubbleBreak && bubbleDomain
    ? bubbleDomain
    : supplyInterestV3(candidate) ?? candidate.bestMatchedInterest ?? null;
  const interestLabel = interestId ? productV1DomainLabel(interestId) : null;
  const bubbleDomainLabel = bubbleDomain ? productV1DomainLabel(bubbleDomain) : null;
  const semanticScore = semanticScoreFor(candidate, interestId, bubbleBreak);
  const profileAffinity = roundScore(finite(options.profileAffinity));
  const quality = qualityReason(candidate);

  const parts: string[] = [];
  if (bubbleBreak && bubbleDomainLabel) {
    parts.push(`破圈推荐：${bubbleDomainLabel}`);
  } else if (interestLabel) {
    if (targetInterest) parts.push(`补充你关注的：${interestLabel}`);
    else if ((profileAffinity ?? 0) > 0) parts.push(`因为你常看：${interestLabel}`);
    else parts.push(`内容匹配：${interestLabel}`);
  }
  if (semanticScore != null) {
    const percent = Math.round(Math.max(0, Math.min(1, semanticScore)) * 100);
    parts.push(`语义匹配 ${percent}%`);
  }
  if (quality.label) parts.push(quality.label);

  if (parts.length === 0) return null;
  return {
    version: 1,
    articleId: candidate.articleId,
    cycleId: candidate.sessionId,
    interestId,
    interestLabel,
    profileAffinity,
    semanticScore,
    qualitySignal: quality.signal,
    qualityLabel: quality.label,
    bubbleBreak,
    bubbleDomain,
    bubbleDomainLabel,
    source: candidate.source,
    summary: parts.join(' · '),
  };
}
