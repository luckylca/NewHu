import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { getGlassRuntime, setGlassRuntime, subscribeGlassRuntime } from './glassRuntime';
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

interface NativeLocalGlassTelemetryModule {
    setPerformanceTelemetryEnabled(enabled: boolean): Promise<void>;
    setHardwareLayerExperimentEnabled(enabled: boolean): Promise<void>;
    getPerformanceTelemetry(): Promise<Pick<LocalGlassTelemetrySnapshot,
        'mountedNativeViewCount' | 'nativeOnDrawCount' | 'nativeInvalidateCount' | 'materialApplyCount' |
        'runtimeShaderCreateCount' | 'runtimeShaderReuseCount' | 'uniformUpdateCount' |
        'sizeUniformUpdateCount' | 'materialUniformUpdateCount'>>;
}

const nativeTelemetryModule = Platform.OS === 'android'
    ? requireNativeModule<NativeLocalGlassTelemetryModule>('ExpoLocalGlass')
    : null;
const coreNativeTelemetryModule = Platform.OS === 'android'
    ? requireNativeModule<NativeLocalGlassTelemetryModule>('ExpoLocalGlassEngine')
    : null;

export function getLocalGlassNativeEngine() {
    return getGlassRuntime().engine;
}

export function subscribeLocalGlassNativeEngine(listener: () => void) {
    return subscribeGlassRuntime(listener);
}

export function setLocalGlassNativeEngine(next: LocalGlassNativeEngine) {
    setGlassRuntime({ engine: next });
}

let enabled = false;
const mountedByKind: Record<LocalGlassRendererKind, number> = { native: 0, skia: 0, fallback: 0 };
let snapshot: LocalGlassTelemetrySnapshot = {
    mountedMaterialCount: 0,
    mountedNativeViewCount: 0,
    mountedSkiaCanvasCount: 0,
    fallbackCount: 0,
    visibleItemCount: 0,
    nativeOnDrawCount: 0,
    nativeInvalidateCount: 0,
    materialApplyCount: 0,
    runtimeShaderCreateCount: 0,
    runtimeShaderReuseCount: 0,
    uniformUpdateCount: 0,
    sizeUniformUpdateCount: 0,
    materialUniformUpdateCount: 0,
};

/** Opt-in diagnostics only. Disabled paths do not allocate timers or notify React. */
export function setLocalGlassTelemetryEnabled(next: boolean) {
    enabled = next;
    if (next) {
        snapshot = {
            mountedMaterialCount: mountedByKind.native + mountedByKind.skia + mountedByKind.fallback,
            mountedNativeViewCount: mountedByKind.native,
            mountedSkiaCanvasCount: mountedByKind.skia,
            fallbackCount: mountedByKind.fallback,
            visibleItemCount: 0,
            nativeOnDrawCount: 0,
            nativeInvalidateCount: 0,
            materialApplyCount: 0,
            runtimeShaderCreateCount: 0,
            runtimeShaderReuseCount: 0,
            uniformUpdateCount: 0,
            sizeUniformUpdateCount: 0,
            materialUniformUpdateCount: 0,
        };
    }
    void nativeTelemetryModule?.setPerformanceTelemetryEnabled(next).catch((error) => {
        console.warn('[LiquidGlass] Native Local Glass telemetry unavailable.', error);
    });
    void coreNativeTelemetryModule?.setPerformanceTelemetryEnabled(next).catch((error) => {
        console.warn('[LiquidGlass] Core Local Glass telemetry unavailable.', error);
    });
}

/** Debug-only A/B switch. Android applies a hardware layer to LocalGlassMaterial views only. */
export function setLocalGlassHardwareLayerExperimentEnabled(next: boolean) {
    void nativeTelemetryModule?.setHardwareLayerExperimentEnabled(next).catch((error) => {
        console.warn('[LiquidGlass] Local Glass hardware layer experiment unavailable.', error);
    });
    void coreNativeTelemetryModule?.setHardwareLayerExperimentEnabled(next).catch((error) => {
        console.warn('[LiquidGlass] Core Local Glass hardware layer experiment unavailable.', error);
    });
}

export function registerLocalGlassMaterial(kind: LocalGlassRendererKind): () => void {
    mountedByKind[kind] += 1;
    if (enabled) updateMountedSnapshot();

    let mounted = true;
    return () => {
        if (!mounted) return;
        mounted = false;
        mountedByKind[kind] = Math.max(0, mountedByKind[kind] - 1);
        if (enabled) updateMountedSnapshot();
    };
}

function updateMountedSnapshot() {
    snapshot.mountedNativeViewCount = mountedByKind.native;
    snapshot.mountedSkiaCanvasCount = mountedByKind.skia;
    snapshot.fallbackCount = mountedByKind.fallback;
    snapshot.mountedMaterialCount = mountedByKind.native + mountedByKind.skia + mountedByKind.fallback;
}

export function setLocalGlassVisibleItemCount(count: number) {
    if (enabled) snapshot.visibleItemCount = Math.max(0, Math.floor(count));
}

export async function getLocalGlassTelemetry(): Promise<LocalGlassTelemetrySnapshot | null> {
    if (!enabled) return null;
    const nativeModule = getGlassRuntime().engine === 'core' ? coreNativeTelemetryModule : nativeTelemetryModule;
    const native = await nativeModule?.getPerformanceTelemetry();
    return { ...snapshot, ...native };
}
