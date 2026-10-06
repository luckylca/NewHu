import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { getGlassNativeEngine } from './glassNativeEngine';
const nativeModule = Platform.OS === 'android'
    ? requireNativeModule('ExpoLiquidGlassProvider')
    : null;
const coreNativeModule = Platform.OS === 'android'
    ? requireNativeModule('NewHuLiquidGlassCore')
    : null;
function activeModule() {
    return getGlassNativeEngine() === 'core' ? coreNativeModule : nativeModule;
}
export function setLiquidGlassPerformanceTelemetryEnabled(enabled) {
    activeModule()?.setPerformanceTelemetryEnabled(enabled);
}
export async function getLiquidGlassPerformanceStats() {
    return activeModule()?.getPerformanceStats() ?? null;
}
//# sourceMappingURL=performanceTelemetry.js.map