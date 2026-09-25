export type SemanticV2LeafRefinementPolicy = {
  leafCosineGte: number;
  leafMarginGte: number;
  crossBroadRescue?: {
    enabled: boolean;
    leafCosineGte: number;
    leafMarginGte: number;
  };
};

export type SemanticV2LeafRefinementDecision =
  | 'same-broad-leaf'
  | 'cross-broad-rescue'
  | 'broad-fallback';

export function decideSemanticV2LeafRefinement(
  fallbackBroad: string,
  leafBroad: string,
  leafScore: number,
  leafMargin: number,
  policy: SemanticV2LeafRefinementPolicy,
): SemanticV2LeafRefinementDecision {
  if (leafBroad === fallbackBroad) {
    return leafScore >= policy.leafCosineGte && leafMargin >= policy.leafMarginGte
      ? 'same-broad-leaf'
      : 'broad-fallback';
  }

  const rescue = policy.crossBroadRescue;
  if (rescue?.enabled
    && leafScore >= rescue.leafCosineGte
    && leafMargin >= rescue.leafMarginGte) {
    return 'cross-broad-rescue';
  }

  return 'broad-fallback';
}
