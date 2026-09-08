import { requireOptionalNativeModule } from 'expo-modules-core';

export interface DownloadResult {
    uri: string;
    fileName: string;
}

interface NativeDownloadStorageModule {
    copyFileToDownloads(sourceUri: string, fileName: string, mimeType: string, subdirectory?: string): Promise<DownloadResult>;
    hasNotificationPermission(): boolean;
    requestNotificationPermission(): Promise<{ granted: boolean; status: string; canAskAgain: boolean }>;
    startOfflineCacheForeground(total: number): void;
    updateOfflineCacheForeground(progress: number, title: string, text: string): void;
    finishOfflineCacheForeground(success: number, failed: number, message?: string): void;
    stopOfflineCacheForeground(): void;
}

const nativeModule = requireOptionalNativeModule<NativeDownloadStorageModule>('ExpoDownloadStorage');

function getNativeModule() {
    if (!nativeModule) {
        throw new Error('下载模块尚未安装，请使用 npx expo run:android 构建开发客户端');
    }
    return nativeModule;
}

export function copyFileToDownloads(sourceUri: string, fileName: string, mimeType: string, subdirectory?: string) {
    return getNativeModule().copyFileToDownloads(sourceUri, fileName, mimeType, subdirectory || '');
}

export function saveImageToDownloads(sourceUri: string, fileName: string, mimeType?: string) {
    const extension = fileName.toLowerCase().split('.').pop();
    const inferredMimeType = extension === 'png'
        ? 'image/png'
        : extension === 'webp'
            ? 'image/webp'
            : 'image/jpeg';
    return copyFileToDownloads(sourceUri, fileName, mimeType || inferredMimeType, 'pictures');
}

export function savePdfToDownloads(sourceUri: string, fileName: string) {
    return copyFileToDownloads(sourceUri, fileName, 'application/pdf', '');
}

export async function ensureOfflineCacheNotificationPermission() {
    const module = getNativeModule();
    if (module.hasNotificationPermission()) return true;
    return Boolean((await module.requestNotificationPermission()).granted);
}

export function startOfflineCacheForeground(total: number) {
    lastNotificationUpdateAt = 0;
    lastNotificationProgress = -1;
    lastNotificationDone = -1;
    getNativeModule().startOfflineCacheForeground(total);
}

let lastNotificationUpdateAt = 0;
let lastNotificationProgress = -1;
let lastNotificationDone = -1;

export function updateOfflineCacheForeground(options: {
    progress: number;
    done: number;
    title: string;
    text: string;
}) {
    const progress = Math.max(0, Math.min(1, options.progress));
    const percent = Math.round(progress * 100);
    const now = Date.now();
    if (options.done === lastNotificationDone && (percent === lastNotificationProgress || now - lastNotificationUpdateAt < 500)) return;
    lastNotificationUpdateAt = now;
    lastNotificationProgress = percent;
    lastNotificationDone = options.done;
    getNativeModule().updateOfflineCacheForeground(progress, options.title, options.text);
}

export function finishOfflineCacheForeground(success: number, failed: number, message?: string) {
    getNativeModule().finishOfflineCacheForeground(success, failed, message);
}

export function stopOfflineCacheForeground() {
    getNativeModule().stopOfflineCacheForeground();
}
