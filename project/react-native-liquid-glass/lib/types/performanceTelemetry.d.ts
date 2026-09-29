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
export declare function setLiquidGlassPerformanceTelemetryEnabled(enabled: boolean): void;
export declare function getLiquidGlassPerformanceStats(): Promise<LiquidGlassPerformanceStats | null>;
