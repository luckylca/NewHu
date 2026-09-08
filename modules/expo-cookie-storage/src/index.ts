import { requireOptionalNativeModule } from 'expo-modules-core';

interface NativeCookieStorageModule {
  getCookieHeader(url: string): Promise<string>;
  clearAllCookies(): Promise<boolean>;
}

const nativeModule = requireOptionalNativeModule<NativeCookieStorageModule>('ExpoCookieStorage');

function getNativeModule() {
  if (!nativeModule) {
    throw new Error('Cookie 模块尚未安装，请重新构建 Android 客户端');
  }
  return nativeModule;
}

export function getCookieHeader(url: string) {
  return getNativeModule().getCookieHeader(url);
}

export function clearAllCookies() {
  return getNativeModule().clearAllCookies();
}
