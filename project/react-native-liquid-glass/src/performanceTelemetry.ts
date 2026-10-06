import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { getGlassNativeEngine } from './glassNativeEngine';

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
const coreNativeModule = Platform.OS === 'android'
    ? requireNativeModule<LiquidGlassPerformanceNativeModule>('NewHuLiquidGlassCore')
    : null;

function activeModule() {
    return getGlassNativeEngine() === 'core' ? coreNativeModule : nativeModule;
}

export function setLiquidGlassPerformanceTelemetryEnabled(enabled: boolean) {
    activeModule()?.setPerformanceTelemetryEnabled(enabled);
}

export async function getLiquidGlassPerformanceStats(): Promise<LiquidGlassPerformanceStats | null> {
    return activeModule()?.getPerformanceStats() ?? null;
}
