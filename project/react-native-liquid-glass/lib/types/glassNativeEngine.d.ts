import type { GlassRuntimeEngine } from './glassRuntime';
export type GlassNativeEngine = GlassRuntimeEngine;
export declare function getGlassNativeEngine(): GlassNativeEngine;
export declare function subscribeGlassNativeEngine(listener: () => void): () => boolean;
export declare function setGlassNativeEngine(next: GlassNativeEngine): void;
