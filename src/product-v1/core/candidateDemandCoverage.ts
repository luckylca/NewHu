export interface DemandCoverageMetricsV3 {
  demandSatisfactionRate: number;
  requiredSupplyCoverage: number;
  demandWeightedSupplyCoverage: number;
  activeSupplyExcessRatio: number;
  legacyCoverageAt5: number;
  legacyCoverageAt10: number;
  legacyCoverageAt20: number;
}

export function demandCoverageV3(desired: Record<string, number>, available: Record<string, number>): DemandCoverageMetricsV3 {
  const keys = Object.keys(desired).filter((k) => Math.trunc(desired[k] ?? 0) > 0);
  if (!keys.length) return { demandSatisfactionRate: 1, requiredSupplyCoverage: 1, demandWeightedSupplyCoverage: 1, activeSupplyExcessRatio: 0, legacyCoverageAt5: 1, legacyCoverageAt10: 1, legacyCoverageAt20: 1 };
  const req = Object.fromEntries(keys.map((k) => [k, Math.max(0, Math.trunc(desired[k] ?? 0))]));
  const av = Object.fromEntries(keys.map((k) => [k, Math.max(0, Math.trunc(available[k] ?? 0))]));
  const sat = Object.fromEntries(keys.map((k) => [k, Math.min(1, av[k] / Math.max(1, req[k]))]));
  const total = Math.max(1, keys.reduce((s, k) => s + req[k], 0));
  return {
    demandSatisfactionRate: keys.reduce((s, k) => s + sat[k], 0) / keys.length,
    requiredSupplyCoverage: keys.filter((k) => av[k] >= req[k]).length / keys.length,
    demandWeightedSupplyCoverage: keys.reduce((s, k) => s + req[k] * sat[k], 0) / total,
    activeSupplyExcessRatio: keys.reduce((s, k) => s + Math.max(0, av[k] - req[k]), 0) / total,
    legacyCoverageAt5: keys.filter((k) => av[k] >= 5).length / keys.length,
    legacyCoverageAt10: keys.filter((k) => av[k] >= 10).length / keys.length,
    legacyCoverageAt20: keys.filter((k) => av[k] >= 20).length / keys.length,
  };
}
