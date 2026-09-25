import { PRODUCT_V1_VERSION } from './constants';
import { loadProductState, saveProductState } from '@/src/db/repositories/productV1Repository';
import type { ProductV1Settings } from './types';
import {
  ACTIVE_NATIVE512_GEOMETRY_MODE,
  ACTIVE_RECOMMENDATION_BACKEND_ID,
} from '@/src/semantic-v2/recommendationBackend';

export function createProductV1Settings(): ProductV1Settings {
  return {
    schemaVersion: 1,
    productVersion: PRODUCT_V1_VERSION,
    updatedAt: Date.now(),
    enabled: true,
    mode: 'live',
    highQualityEnabled: false,
    bubbleBreakEnabled: false,
    recommendationBackend: ACTIVE_RECOMMENDATION_BACKEND_ID,
    native512GeometryMode: ACTIVE_NATIVE512_GEOMETRY_MODE,
  };
}

export async function loadProductV1Settings(): Promise<ProductV1Settings> {
  const saved = await loadProductState<ProductV1Settings>('settings');
  if (!saved || saved.schemaVersion !== 1) return createProductV1Settings();

  const migrated: ProductV1Settings = {
    ...createProductV1Settings(),
    ...saved,
    // Semantic V2 Native512/RelevanceMax is now the only production recommendation path.
    recommendationBackend: ACTIVE_RECOMMENDATION_BACKEND_ID,
    native512GeometryMode: ACTIVE_NATIVE512_GEOMETRY_MODE,
  };
  const needsMigration = saved.recommendationBackend !== ACTIVE_RECOMMENDATION_BACKEND_ID
    || saved.native512GeometryMode !== ACTIVE_NATIVE512_GEOMETRY_MODE;
  if (needsMigration) {
    migrated.updatedAt = Date.now();
    await saveProductState('settings', 1, migrated);
  }
  return migrated;
}

export async function updateProductV1Settings(patch: Partial<ProductV1Settings>) {
  const settings: ProductV1Settings = {
    ...await loadProductV1Settings(),
    ...patch,
    recommendationBackend: ACTIVE_RECOMMENDATION_BACKEND_ID,
    native512GeometryMode: ACTIVE_NATIVE512_GEOMETRY_MODE,
    updatedAt: Date.now(),
  };
  await saveProductState('settings', 1, settings);
  return settings;
}

