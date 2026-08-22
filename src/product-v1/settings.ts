import { PRODUCT_V1_VERSION } from './constants';
import { loadProductState, saveProductState } from '@/src/db/repositories/productV1Repository';
import type { ProductV1Settings } from './types';

export function createProductV1Settings(): ProductV1Settings {
  return {
    schemaVersion: 1,
    productVersion: PRODUCT_V1_VERSION,
    updatedAt: Date.now(),
    enabled: true,
    mode: 'live',
    highQualityEnabled: false,
    bubbleBreakEnabled: false,
  };
}

export async function loadProductV1Settings() {
  const saved = await loadProductState<ProductV1Settings>('settings');
  if (!saved || saved.schemaVersion !== 1) return createProductV1Settings();
  return { ...createProductV1Settings(), ...saved };
}

export async function updateProductV1Settings(patch: Partial<ProductV1Settings>) {
  const settings = { ...await loadProductV1Settings(), ...patch, updatedAt: Date.now() };
  await saveProductState('settings', 1, settings);
  return settings;
}

