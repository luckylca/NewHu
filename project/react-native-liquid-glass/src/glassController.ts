import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { getGlassNativeEngine } from './glassNativeEngine';

type CaptureMode = 'oneShot' | 'frozen' | 'live';

interface LiquidGlassControllerNativeModule {
    setCaptureMode(providerId: string, mode: CaptureMode): void;
    prepareFrozenBackdrop(providerId: string, blurRadiusDp: number): void;
}

const nativeModule = Platform.OS === 'android'
    ? requireNativeModule<LiquidGlassControllerNativeModule>('ExpoLiquidGlassProvider')
    : null;
const coreNativeModule = Platform.OS === 'android'
    ? requireNativeModule<LiquidGlassControllerNativeModule>('NewHuLiquidGlassCore')
    : null;

function setCaptureMode(providerId: string | null, mode: CaptureMode) {
    if (!providerId) return;
    const module = getGlassNativeEngine() === 'core' ? coreNativeModule : nativeModule;
    module?.setCaptureMode(providerId, mode);
}

function prepareFrozenBackdrop(providerId: string | null, blurRadiusDp: number) {
    if (!providerId) return;
    const module = getGlassNativeEngine() === 'core' ? coreNativeModule : nativeModule;
    module?.prepareFrozenBackdrop(providerId, blurRadiusDp);
}

export const glassController = {
    oneShot(providerId: string | null) {
        setCaptureMode(providerId, 'oneShot');
    },
    freeze(providerId: string | null) {
        setCaptureMode(providerId, 'frozen');
    },
    resume(providerId: string | null) {
        setCaptureMode(providerId, 'live');
    },
    prepareFrozenBackdrop(providerId: string | null, blurRadiusDp: number) {
        prepareFrozenBackdrop(providerId, blurRadiusDp);
    },
};
