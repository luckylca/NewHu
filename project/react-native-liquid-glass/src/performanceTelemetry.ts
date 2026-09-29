import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export interface LiquidGlassPerformanceStats {
    displayRefreshRate: number;
    backdropRequestCount: number;
    backdropCaptureCount: number;
    captureSkippedNoIntersection: number;
    captureSkippedAlreadyDirty: number;
    captureScheduledCount: number;
    consumerDrawCount: number;
    effectBuildCount: number;
    geometryLookupCount: number;
    sourceContentDirtyCount: number;
    consumerGeometryDirtyCount: number;
    opticsDirtyCount: number;
    materialDirtyCount: number;
    uiFrameCount: number;
}

interface LiquidGlassPerformanceNativeModule {
    setPerformanceTelemetryEnabled(enabled: boolean): void;
    getPerformanceStats(): Promise<LiquidGlassPerformanceStats>;
}

const nativeModule = Platform.OS === 'android'
    ? requireNativeModule<LiquidGlassPerformanceNativeModule>('ExpoLiquidGlassProvider')
    : null;

export function setLiquidGlassPerformanceTelemetryEnabled(enabled: boolean) {
    nativeModule?.setPerformanceTelemetryEnabled(enabled);
}

export async function getLiquidGlassPerformanceStats(): Promise<LiquidGlassPerformanceStats | null> {
    return nativeModule?.getPerformanceStats() ?? null;
}
