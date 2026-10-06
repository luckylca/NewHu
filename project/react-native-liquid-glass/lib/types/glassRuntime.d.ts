export type GlassRuntimeEngine = 'legacy' | 'core';
export interface GlassRuntimeConfig {
    engine: GlassRuntimeEngine;
}
export declare function getGlassRuntime(): GlassRuntimeConfig;
export declare function subscribeGlassRuntime(listener: () => void): () => boolean;
export declare function setGlassRuntime(next: GlassRuntimeConfig): void;
