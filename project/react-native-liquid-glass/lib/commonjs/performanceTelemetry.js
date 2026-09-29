"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLiquidGlassPerformanceTelemetryEnabled = setLiquidGlassPerformanceTelemetryEnabled;
exports.getLiquidGlassPerformanceStats = getLiquidGlassPerformanceStats;
const expo_modules_core_1 = require("expo-modules-core");
const react_native_1 = require("react-native");
const nativeModule = react_native_1.Platform.OS === 'android'
    ? (0, expo_modules_core_1.requireNativeModule)('ExpoLiquidGlassProvider')
    : null;
function setLiquidGlassPerformanceTelemetryEnabled(enabled) {
    nativeModule?.setPerformanceTelemetryEnabled(enabled);
}
async function getLiquidGlassPerformanceStats() {
    return nativeModule?.getPerformanceStats() ?? null;
}
//# sourceMappingURL=performanceTelemetry.js.map