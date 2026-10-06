"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLiquidGlassPerformanceTelemetryEnabled = setLiquidGlassPerformanceTelemetryEnabled;
exports.getLiquidGlassPerformanceStats = getLiquidGlassPerformanceStats;
const expo_modules_core_1 = require("expo-modules-core");
const react_native_1 = require("react-native");
const glassNativeEngine_1 = require("./glassNativeEngine");
const nativeModule = react_native_1.Platform.OS === 'android'
    ? (0, expo_modules_core_1.requireNativeModule)('ExpoLiquidGlassProvider')
    : null;
const coreNativeModule = react_native_1.Platform.OS === 'android'
    ? (0, expo_modules_core_1.requireNativeModule)('NewHuLiquidGlassCore')
    : null;
function activeModule() {
    return (0, glassNativeEngine_1.getGlassNativeEngine)() === 'core' ? coreNativeModule : nativeModule;
}
function setLiquidGlassPerformanceTelemetryEnabled(enabled) {
    activeModule()?.setPerformanceTelemetryEnabled(enabled);
}
async function getLiquidGlassPerformanceStats() {
    return activeModule()?.getPerformanceStats() ?? null;
}
//# sourceMappingURL=performanceTelemetry.js.map