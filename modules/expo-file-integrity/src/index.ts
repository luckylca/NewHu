import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type NativeFileIntegrity = {
  sha256File(uri: string): Promise<string>;
};

let nativeModule: NativeFileIntegrity | null | undefined;

function getNativeModule() {
  if (Platform.OS !== 'android') return null;
  if (nativeModule !== undefined) return nativeModule;

  try {
    nativeModule = requireNativeModule<NativeFileIntegrity>('ExpoFileIntegrity');
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

/** Hash a local Android file on an IO worker; return null when native support is unavailable. */
export function sha256FileInBackground(uri: string) {
  return getNativeModule()?.sha256File(uri) ?? Promise.resolve(null);
}
