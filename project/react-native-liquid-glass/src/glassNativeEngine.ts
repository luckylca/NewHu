import { getGlassRuntime, setGlassRuntime, subscribeGlassRuntime } from './glassRuntime';
import type { GlassRuntimeEngine } from './glassRuntime';

export type GlassNativeEngine = GlassRuntimeEngine;

export function getGlassNativeEngine(): GlassNativeEngine {
    return getGlassRuntime().engine;
}

export function subscribeGlassNativeEngine(listener: () => void) {
    return subscribeGlassRuntime(listener);
}

export function setGlassNativeEngine(next: GlassNativeEngine) {
    setGlassRuntime({ engine: next });
}
