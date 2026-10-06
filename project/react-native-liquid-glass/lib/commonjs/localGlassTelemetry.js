"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalGlassNativeEngine = getLocalGlassNativeEngine;
exports.subscribeLocalGlassNativeEngine = subscribeLocalGlassNativeEngine;
exports.setLocalGlassNativeEngine = setLocalGlassNativeEngine;
exports.setLocalGlassTelemetryEnabled = setLocalGlassTelemetryEnabled;
exports.setLocalGlassHardwareLayerExperimentEnabled = setLocalGlassHardwareLayerExperimentEnabled;
exports.registerLocalGlassMaterial = registerLocalGlassMaterial;
exports.setLocalGlassVisibleItemCount = setLocalGlassVisibleItemCount;
exports.getLocalGlassTelemetry = getLocalGlassTelemetry;
const expo_modules_core_1 = require("expo-modules-core");
const react_native_1 = require("react-native");
const glassRuntime_1 = require("./glassRuntime");
const nativeTelemetryModule = react_native_1.Platform.OS === 'android'
    ? (0, expo_modules_core_1.requireNativeModule)('ExpoLocalGlass')
    : null;
const coreNativeTelemetryModule = react_native_1.Platform.OS === 'android'
    ? (0, expo_modules_core_1.requireNativeModule)('ExpoLocalGlassEngine')
    : null;
function getLocalGlassNativeEngine() {
    return (0, glassRuntime_1.getGlassRuntime)().engine;
}
function subscribeLocalGlassNativeEngine(listener) {
    return (0, glassRuntime_1.subscribeGlassRuntime)(listener);
}
function setLocalGlassNativeEngine(next) {
    (0, glassRuntime_1.setGlassRuntime)({ engine: next });
}
let enabled = false;
const mountedByKind = { native: 0, skia: 0, fallback: 0 };
let snapshot = {
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
function setLocalGlassTelemetryEnabled(next) {
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
function setLocalGlassHardwareLayerExperimentEnabled(next) {
    void nativeTelemetryModule?.setHardwareLayerExperimentEnabled(next).catch((error) => {
        console.warn('[LiquidGlass] Local Glass hardware layer experiment unavailable.', error);
    });
    void coreNativeTelemetryModule?.setHardwareLayerExperimentEnabled(next).catch((error) => {
        console.warn('[LiquidGlass] Core Local Glass hardware layer experiment unavailable.', error);
    });
}
function registerLocalGlassMaterial(kind) {
    mountedByKind[kind] += 1;
    if (enabled)
        updateMountedSnapshot();
    let mounted = true;
    return () => {
        if (!mounted)
            return;
        mounted = false;
        mountedByKind[kind] = Math.max(0, mountedByKind[kind] - 1);
        if (enabled)
            updateMountedSnapshot();
    };
}
function updateMountedSnapshot() {
    snapshot.mountedNativeViewCount = mountedByKind.native;
    snapshot.mountedSkiaCanvasCount = mountedByKind.skia;
    snapshot.fallbackCount = mountedByKind.fallback;
    snapshot.mountedMaterialCount = mountedByKind.native + mountedByKind.skia + mountedByKind.fallback;
}
function setLocalGlassVisibleItemCount(count) {
    if (enabled)
        snapshot.visibleItemCount = Math.max(0, Math.floor(count));
}
async function getLocalGlassTelemetry() {
    if (!enabled)
        return null;
    const nativeModule = (0, glassRuntime_1.getGlassRuntime)().engine === 'core' ? coreNativeTelemetryModule : nativeTelemetryModule;
    const native = await nativeModule?.getPerformanceTelemetry();
    return { ...snapshot, ...native };
}
//# sourceMappingURL=localGlassTelemetry.js.map