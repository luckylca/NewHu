import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { getGlassNativeEngine } from './glassNativeEngine';

export interface LiquidGlassPerformanceStats {
    [key: string]: number;
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
    routeDispatchCount: number;
    routeTreeTraversalCount: number;
    routeRenderNodeRecordCount: number;
    sourceRenderNodeReuseCount: number;
    regionRenderNodeRecordCount: number;
    regionRenderNodeReuseCount: number;
    scrollWindowRefreshCount: number;
    scrollWindowReuseFrameCount: number;
    descendantInvalidationReceivedCount: number;
    scrollEventsReceivedCount: number;
    paintDirtyReceived: number;
    structureDirtyReceived: number;
    sourceGeometryDirtyReceived: number;
    consumerGeometryDirtyReceived: number;
    opticsDirtyReceived: number;
    materialDirtyReceived: number;
    scrollDirtyReceived: number;
    scrollTouchDownEvents: number;
    scrollOffsetUpdateCount: number;
    scrollOffsetIntervalCount: number;
    scrollOffsetIntervalUnder8Ms: number;
    scrollOffsetInterval8To12Ms: number;
    scrollOffsetInterval12To17Ms: number;
    scrollOffsetIntervalOver17Ms: number;
    scrollTouchToOffsetLatencyCount: number;
    scrollTouchToOffsetLatencySumMs: number;
    scrollTouchToOffsetLatencyMaxMs: number;
    scrollFrameSampleCount: number;
    scrollFrameOffsetChangedCount: number;
    scrollFrameRepeatedOffsetCount: number;
    scrollFrameIntervalUnder8Ms: number;
    scrollFrameInterval8To12Ms: number;
    scrollFrameInterval12To17Ms: number;
    scrollFrameIntervalOver17Ms: number;
    sourceRerecordRequired: number;
    sourceRerecordAvoided: number;
    sourceRerecordExecuted: number;
    sourceRerecordByStructure: number;
    sourceRerecordByGeometry: number;
    sourceRerecordByRevision: number;
    sourceRerecordByInitialCapture: number;
    consumerRefreshOnly: number;
    scrollReuseFrame: number;
    scrollSettleRerecord: number;
}

interface LiquidGlassPerformanceNativeModule {
    setPerformanceTelemetryEnabled(enabled: boolean): void;
    beginEffectiveScrollFpsSession?(page: string): void;
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

/** Start a clean Debug-only content-offset cadence window for one benchmark route. */
export function beginEffectiveScrollFpsSession(page: string) {
    activeModule()?.beginEffectiveScrollFpsSession?.(page);
}

export async function getLiquidGlassPerformanceStats(): Promise<LiquidGlassPerformanceStats | null> {
    return activeModule()?.getPerformanceStats() ?? null;
}
