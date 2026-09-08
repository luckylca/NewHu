import type { ProductV1DomainMatch } from './domainSelection';

export const PRODUCT_V1_DOMAIN_CACHE_FORMAT_VERSION = 1;

export type ProductV1DomainCacheValue = {
  fingerprint: string;
  matches: ProductV1DomainMatch[];
};

export type ProductV1DomainCacheEntry = [contentKey: string, value: ProductV1DomainCacheValue];

function hash32(text: string, seed: number) {
  let hash = seed >>> 0;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
    hash ^= hash >>> 13;
  }
  return hash >>> 0;
}

export function createProductV1DomainFingerprint(title: string, excerpt: string) {
  const source = `${title}\u0000${excerpt}`;
  const first = hash32(source, 2166136261);
  const second = hash32(source, 0x9e3779b9);
  return `${source.length}:${first.toString(16).padStart(8, '0')}:${second.toString(16).padStart(8, '0')}`;
}

function isDomainMatch(value: unknown): value is ProductV1DomainMatch {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.domain === 'string'
    && typeof row.label === 'string'
    && typeof row.score === 'number'
    && Number.isFinite(row.score);
}

export function serializeProductV1DomainCache(entries: ProductV1DomainCacheEntry[]) {
  return JSON.stringify({
    version: PRODUCT_V1_DOMAIN_CACHE_FORMAT_VERSION,
    entries,
  });
}

export function parseProductV1DomainCache(raw: string | null, maxEntries: number): ProductV1DomainCacheEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      entries?: unknown;
    };
    if (parsed.version !== PRODUCT_V1_DOMAIN_CACHE_FORMAT_VERSION || !Array.isArray(parsed.entries)) return [];

    const valid: ProductV1DomainCacheEntry[] = [];
    for (const entry of parsed.entries) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') continue;
      const value = entry[1];
      if (!value || typeof value !== 'object') continue;
      const candidate = value as Record<string, unknown>;
      if (typeof candidate.fingerprint !== 'string' || !Array.isArray(candidate.matches)) continue;
      if (!candidate.matches.every(isDomainMatch)) continue;
      valid.push([
        entry[0],
        {
          fingerprint: candidate.fingerprint,
          matches: candidate.matches.slice(0, 3),
        },
      ]);
    }
    return valid.slice(-Math.max(0, Math.trunc(maxEntries)));
  } catch {
    return [];
  }
}
