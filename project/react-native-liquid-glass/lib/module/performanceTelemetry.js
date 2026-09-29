import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
const nativeModule = Platform.OS === 'android'
    ? requireNativeModule('ExpoLiquidGlassProvider')
    : null;
export function setLiquidGlassPerformanceTelemetryEnabled(enabled) {
    nativeModule?.setPerformanceTelemetryEnabled(enabled);
}
export async function getLiquidGlassPerformanceStats() {
    return nativeModule?.getPerformanceStats() ?? null;
}
//# sourceMappingURL=performanceTelemetry.js.map