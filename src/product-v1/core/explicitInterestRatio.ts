import type { ExplicitInterestRatioState, InterestRatioEntry } from "./types";
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

export function normalizeRatios(state: ExplicitInterestRatioState): void {
  if (!state.entries.length) return;
  const values = state.entries.map(e => Math.max(0, e.targetRatio));
  const sum = values.reduce((a, b) => a + b, 0);
  state.entries.forEach((e, i) => { e.targetRatio = sum <= 1e-12 ? 1 / state.entries.length : values[i] / sum; });
}

export function ratioFromProfile(named: Array<[string, number]>): ExplicitInterestRatioState {
  const entries: InterestRatioEntry[] = named.slice(0, 9).map(([interestId, value]) => ({ interestId, targetRatio: Math.max(value, 0.01), locked: false }));
  const state: ExplicitInterestRatioState = { entries, explicitOverride: false, maxLength: 9 };
  normalizeRatios(state); return state;
}

export function setExplicitRatio(state: ExplicitInterestRatioState, interestId: string, value: number): void {
  let target = state.entries.find(e => e.interestId === interestId);
  if (!target) {
    if (state.entries.length >= state.maxLength) {
      const removable = state.entries.filter(e => !e.locked).sort((a, b) => a.targetRatio - b.targetRatio)[0];
      if (removable) state.entries = state.entries.filter(e => e !== removable);
    }
    target = { interestId, targetRatio: 0.05, locked: false }; state.entries.push(target); normalizeRatios(state);
  }
  const lockedOther = state.entries.filter(e => e !== target && e.locked).reduce((a, e) => a + e.targetRatio, 0);
  const available = Math.max(0, 1 - lockedOther); target.targetRatio = Math.min(clamp(value, 0, 1), available);
  const rest = state.entries.filter(e => e !== target && !e.locked); const remaining = Math.max(0, available - target.targetRatio);
  const old = rest.reduce((a, e) => a + Math.max(0, e.targetRatio), 0);
  if (rest.length) rest.forEach(e => { e.targetRatio = old <= 1e-12 ? remaining / rest.length : remaining * Math.max(0, e.targetRatio) / old; });
  state.explicitOverride = true; normalizeRatios(state);
}

export class RatioAwareReranker {
  readonly window = 30; readonly strength = 0.42; readonly maxBonus = 0.18; readonly qualityGuardMargin = 0.24;
  private history: string[] = [];
  recentShare(interestId: string): number { const h = this.history.slice(-this.window); return h.length ? h.filter(x => x === interestId).length / h.length : 0; }
  deficit(interestId: string | null, state: ExplicitInterestRatioState): number { if (!interestId) return 0; const e = state.entries.find(x => x.interestId === interestId); return e ? e.targetRatio - this.recentShare(interestId) : 0; }
  bonus(interestId: string | null, state: ExplicitInterestRatioState, baseScore: number, bestBaseScore: number): number {
    if (!interestId || !state.entries.length || baseScore < bestBaseScore - this.qualityGuardMargin) return 0;
    return clamp(this.strength * this.deficit(interestId, state), -this.maxBonus, this.maxBonus);
  }
  observe(interestId: string | null): void { this.history.push(interestId ?? "__none__"); if (this.history.length > this.window * 3) this.history = this.history.slice(-this.window * 2); }
  adherenceL1(state: ExplicitInterestRatioState): number { return state.entries.reduce((sum, e) => sum + Math.abs(e.targetRatio - this.recentShare(e.interestId)), 0); }
}
