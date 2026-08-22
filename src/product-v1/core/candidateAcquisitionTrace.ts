import type { AcquisitionAction, SearchStopReason } from "./adaptiveCandidateAcquisition";

export interface CandidateAcquisitionTraceEntry {
  cycleId: string;
  step: number;
  interestId: string | null;
  desiredSupply: number | null;
  availableSupplyBefore: number | null;
  deficitBefore: number | null;
  action: AcquisitionAction;
  seedId?: string | null;
  query?: string | null;
  requestCost: number;
  rawCandidates: number;
  newUnique: number;
  newQualified: number;
  targetInterestQualified: number;
  medianAgeDays?: number | null;
  semanticPrecision?: number | null;
  duplicateRate?: number | null;
  availableSupplyAfter?: number | null;
  deficitAfter?: number | null;
  stopReason?: SearchStopReason | null;
}

export function acquisitionTraceRow(value: CandidateAcquisitionTraceEntry): CandidateAcquisitionTraceEntry {
  return { ...value };
}
