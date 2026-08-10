import { requireOptionalNativeModule } from 'expo-modules-core';

export interface DownloadResult {
    uri: string;
    fileName: string;
}

interface NativeDownloadStorageModule {
    copyFileToDownloads(sourceUri: string, fileName: string, mimeType: string, subdirectory?: string): Promise<DownloadResult>;
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
