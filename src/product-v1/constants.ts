export const PRODUCT_V1_VERSION = 'ProductV1-Frozen-Core-20260820';
export const PRODUCT_V1_ENCODER_VERSION = 'TINY_V1';
export const PRODUCT_V1_EMBEDDING_DIMENSION = 128;
export const PRODUCT_V1_MAX_LENGTH = 256;
export const PRODUCT_V1_HORIZON = 20;
export const PRODUCT_V1_SEED_COUNT = 2706;

export const PRODUCT_V1_SCHEMA = {
  profile: 1,
  rewardStats: 1,
  candidate: 1,
  inventory: 3,
  reserve: 1,
  settings: 1,
  exposureHistory: 1,
} as const;

