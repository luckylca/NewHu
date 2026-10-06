import type { GlassRuntimeEngine } from './glassRuntime';
export type LocalGlassRendererKind = 'native' | 'skia' | 'fallback';
export type LocalGlassNativeEngine = GlassRuntimeEngine;
export type LocalGlassTelemetrySnapshot = {
    mountedMaterialCount: number;
    mountedNativeViewCount: number;
    mountedSkiaCanvasCount: number;
    fallbackCount: number;
    visibleItemCount: number;
    nativeOnDrawCount: number;
    nativeInvalidateCount: number;
    materialApplyCount: number;
    runtimeShaderCreateCount: number;
    runtimeShaderReuseCount: number;
    uniformUpdateCount: number;
    sizeUniformUpdateCount: number;
    materialUniformUpdateCount: number;
};
export declare function getLocalGlassNativeEngine(): GlassRuntimeEngine;
export declare function subscribeLocalGlassNativeEngine(listener: () => void): () => boolean;
export declare function setLocalGlassNativeEngine(next: LocalGlassNativeEngine): void;
/** Opt-in diagnostics only. Disabled paths do not allocate timers or notify React. */
export declare function setLocalGlassTelemetryEnabled(next: boolean): void;
/** Debug-only A/B switch. Android applies a hardware layer to LocalGlassMaterial views only. */
export declare function setLocalGlassHardwareLayerExperimentEnabled(next: boolean): void;
export declare function registerLocalGlassMaterial(kind: LocalGlassRendererKind): () => void;
export declare function setLocalGlassVisibleItemCount(count: number): void;
export declare function getLocalGlassTelemetry(): Promise<LocalGlassTelemetrySnapshot | null>;
