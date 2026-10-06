"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.glassController = void 0;
const expo_modules_core_1 = require("expo-modules-core");
const react_native_1 = require("react-native");
const glassNativeEngine_1 = require("./glassNativeEngine");
const nativeModule = react_native_1.Platform.OS === 'android'
    ? (0, expo_modules_core_1.requireNativeModule)('ExpoLiquidGlassProvider')
    : null;
const coreNativeModule = react_native_1.Platform.OS === 'android'
    ? (0, expo_modules_core_1.requireNativeModule)('NewHuLiquidGlassCore')
    : null;
function setCaptureMode(providerId, mode) {
    if (!providerId)
        return;
    const module = (0, glassNativeEngine_1.getGlassNativeEngine)() === 'core' ? coreNativeModule : nativeModule;
    module?.setCaptureMode(providerId, mode);
}
function prepareFrozenBackdrop(providerId, blurRadiusDp) {
    if (!providerId)
        return;
    const module = (0, glassNativeEngine_1.getGlassNativeEngine)() === 'core' ? coreNativeModule : nativeModule;
    module?.prepareFrozenBackdrop(providerId, blurRadiusDp);
}
exports.glassController = {
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