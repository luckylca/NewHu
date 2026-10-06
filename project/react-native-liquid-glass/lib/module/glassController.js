import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { getGlassNativeEngine } from './glassNativeEngine';
const nativeModule = Platform.OS === 'android'
    ? requireNativeModule('ExpoLiquidGlassProvider')
    : null;
const coreNativeModule = Platform.OS === 'android'
    ? requireNativeModule('NewHuLiquidGlassCore')
    : null;
function setCaptureMode(providerId, mode) {
    if (!providerId)
        return;
    const module = getGlassNativeEngine() === 'core' ? coreNativeModule : nativeModule;
    module?.setCaptureMode(providerId, mode);
}
function prepareFrozenBackdrop(providerId, blurRadiusDp) {
    if (!providerId)
        return;
    const module = getGlassNativeEngine() === 'core' ? coreNativeModule : nativeModule;
    module?.prepareFrozenBackdrop(providerId, blurRadiusDp);
}
export const glassController = {
    oneShot(providerId) {
        setCaptureMode(providerId, 'oneShot');
    },
    freeze(providerId) {
        setCaptureMode(providerId, 'frozen');
    },
    resume(providerId) {
        setCaptureMode(providerId, 'live');
    },
    prepareFrozenBackdrop(providerId, blurRadiusDp) {
        prepareFrozenBackdrop(providerId, blurRadiusDp);
    },
};
//# sourceMappingURL=glassController.js.map