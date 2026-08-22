import { create } from 'zustand';
import type { ProductV1Health } from './types';

const initialHealth: ProductV1Health = {
  phase: 'idle',
  encoderReady: false,
  encoderNorm: null,
  seedCount: 0,
  activeCount: 0,
  reserveCount: 0,
  lastCycleId: null,
  lastCycleAt: null,
  lastError: null,
};

type ProductV1HealthStore = ProductV1Health & {
  update: (next: Partial<ProductV1Health>) => void;
};

export const useProductV1HealthStore = create<ProductV1HealthStore>((set) => ({
  ...initialHealth,
  update: (next) => set(next),
}));

export function updateProductV1Health(next: Partial<ProductV1Health>) {
  useProductV1HealthStore.getState().update(next);
}

