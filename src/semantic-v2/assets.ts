import { getSemanticV2AssetFile } from './runtimeAssets';

async function downloadedModelPath(key: 'selector' | 'badgeFallback') {
  const file = await getSemanticV2AssetFile(key);
  return file.uri.replace(/^file:\/\//, '');
}

let selectorPathPromise: Promise<string> | null = null;
let fallbackPathPromise: Promise<string> | null = null;

export function loadSemanticV2SelectorPath() {
  if (!selectorPathPromise) {
    selectorPathPromise = downloadedModelPath('selector')
      .catch((error) => {
        selectorPathPromise = null;
        throw error;
      });
  }
  return selectorPathPromise;
}

export function loadSemanticV2FallbackPath() {
  if (!fallbackPathPromise) {
    fallbackPathPromise = downloadedModelPath('badgeFallback')
      .catch((error) => {
        fallbackPathPromise = null;
        throw error;
      });
  }
  return fallbackPathPromise;
}

export function resetSemanticV2AssetCache() {
  selectorPathPromise = null;
  fallbackPathPromise = null;
}
