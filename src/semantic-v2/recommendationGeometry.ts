export type InterestVectorMap = Record<string, ArrayLike<number>>;

export function normalizeRecommendationVector(values: ArrayLike<number>) {
  const output = new Float32Array(values.length);
  let normSq = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = Number(values[index]);
    output[index] = value;
    normSq += value * value;
  }
  const invNorm = 1 / Math.sqrt(Math.max(normSq, 1e-12));
  for (let index = 0; index < output.length; index += 1) output[index] *= invNorm;
  return output;
}

export function cosineRecommendationVector(left: ArrayLike<number>, right: ArrayLike<number>) {
  if (left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftSq = 0;
  let rightSq = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index]);
    const b = Number(right[index]);
    dot += a * b;
    leftSq += a * a;
    rightSq += b * b;
  }
  return dot / Math.sqrt(Math.max(leftSq * rightSq, 1e-12));
}

export function microBalancedAssignmentVector(
  values: ArrayLike<number>,
  mean: ArrayLike<number>,
  coefficient = 0.75,
) {
  if (values.length !== mean.length) return normalizeRecommendationVector(values);
  const centered = new Float32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    centered[index] = Number(values[index]) - coefficient * Number(mean[index]);
  }
  return normalizeRecommendationVector(centered);
}

export function scoreInterestGeometries(
  semanticEmbedding: ArrayLike<number>,
  assignmentEmbedding: ArrayLike<number>,
  semanticCenters: InterestVectorMap,
  assignmentCenters: InterestVectorMap,
) {
  const semanticScores = new Map<string, number>();
  for (const [interest, center] of Object.entries(semanticCenters)) {
    semanticScores.set(interest, cosineRecommendationVector(semanticEmbedding, center));
  }
  const assignmentMatches: [string, number][] = Object.entries(assignmentCenters)
    .map(([interest, center]) => [interest, cosineRecommendationVector(assignmentEmbedding, center)] as [string, number])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    semanticScores,
    assignmentMatches,
    bestSemanticScore: semanticScores.size ? Math.max(...semanticScores.values()) : 0,
  };
}
