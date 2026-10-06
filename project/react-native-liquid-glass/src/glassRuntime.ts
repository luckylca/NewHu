export type GlassRuntimeEngine = 'legacy' | 'core';

export interface GlassRuntimeConfig {
    engine: GlassRuntimeEngine;
}

let runtime: GlassRuntimeConfig = { engine: 'legacy' };
const listeners = new Set<() => void>();

export function getGlassRuntime(): GlassRuntimeConfig {
    return runtime;
}

export function subscribeGlassRuntime(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function setGlassRuntime(next: GlassRuntimeConfig) {
    if (runtime.engine === next.engine) return;
    runtime = next;
    for (const listener of listeners) listener();
}
