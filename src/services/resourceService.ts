import CryptoJS from 'crypto-js';
import { Directory, File, Paths } from 'expo-file-system';
import { getNetworkStatus } from '@/src/stores/useNetworkStore';
import { addResourceRef, deleteResourceRecord, getResource, listResourcesForCleanup, touchResource, upsertResource } from '@/src/db/repositories/resourceRepository';
import type { ResourceRecord } from '@/src/db/types';

const imageDirectory = new Directory(Paths.document, 'offline', 'images');
const inFlightDownloads = new Map<string, Promise<ResourceRecord | null>>();

/**
 * Zhihu's HTML can contain escaped or protocol-relative image URLs.  Keep a
 * single canonical form for new downloads while still allowing the resolver
 * to find records created by older builds.
 */
export function normalizeRemoteUrl(value: string) {
    const decoded = String(value || '')
        .trim()
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x2f;|&#47;/gi, '/');
    return decoded.startsWith('//') ? `https:${decoded}` : decoded;
}

function remoteUrlCandidates(value: string) {
    const raw = String(value || '').trim();
    const normalized = normalizeRemoteUrl(raw);
    const candidates = [raw, normalized];
    try {
        const parsed = new URL(normalized);
        const imageHosts = ['picx.zhimg.com', 'pica.zhimg.com', 'pic1.zhimg.com', 'pic2.zhimg.com', 'pic3.zhimg.com'];
        if (imageHosts.includes(parsed.hostname)) {
            for (const host of imageHosts) {
                const alias = new URL(parsed.toString());
                alias.hostname = host;
                candidates.push(alias.toString());
            }
        }
    } catch {
        // Invalid/unsupported URLs are filtered below.
    }
    return [...new Set(candidates)].filter((url) => /^https?:\/\//i.test(url));
}

function extensionFor(url: string) {
    const extension = url.split(/[?#]/)[0].match(/\.([a-z\d]{2,5})$/i)?.[1]?.toLowerCase();
    return extension && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic'].includes(extension) ? extension : 'bin';
}

function resourceId(remoteUrl: string) {
    return `resource:${CryptoJS.SHA256(remoteUrl).toString()}`;
}

export function extractImageUrls(html: string) {
    const urls = new Set<string>();
    const imageTag = /<img\b[^>]*>/gi;
    const attributes = ['data-original', 'data-actualsrc', 'data-src', 'src'];
    for (const tag of html.match(imageTag) || []) {
        for (const attribute of attributes) {
            const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(['"])(.*?)\\1`, 'i'))?.[2];
            const url = match ? normalizeRemoteUrl(match) : '';
            if (url && /^https?:\/\//i.test(url) && !/^data:image\/svg/i.test(url)) urls.add(url);
        }
    }
    const commentImage = /<a\b[^>]*class\s*=\s*(['"])[^'"]*comment_img[^'"]*\1[^>]*href\s*=\s*(['"])(.*?)\2/gi;
    let match: RegExpExecArray | null;
    while ((match = commentImage.exec(html)) !== null) {
        const url = normalizeRemoteUrl(match[3]);
        if (/^https?:\/\//i.test(url)) urls.add(url);
    }
    return [...urls];
}

async function ensureDirectory() {
    if (!imageDirectory.exists) imageDirectory.create({ idempotent: true, intermediates: true });
}

export async function resolveImageUri(remoteUrl: string, online = getNetworkStatus() === 'online') {
    if (!remoteUrl) return null;
    // Online browsing should stay on the normal network path. Looking up and
    // touching SQLite for every image created dozens of reads/writes while a
    // long article was mounting, which competed directly with navigation and
    // scrolling. The resource table is only needed to resolve an offline URI.
    if (online) return normalizeRemoteUrl(remoteUrl);
    for (const candidate of remoteUrlCandidates(remoteUrl)) {
        const record = await getResource(candidate);
        if (record?.localUri) {
            const local = new File(record.localUri);
            if (local.exists) {
                await touchResource(candidate);
                return local.uri;
            }
        }
    }
    return online ? normalizeRemoteUrl(remoteUrl) : null;
}

async function downloadResourceImpl(remoteUrl: string): Promise<ResourceRecord | null> {
    const normalizedUrl = normalizeRemoteUrl(remoteUrl);
    if (!normalizedUrl || getNetworkStatus() !== 'online') return null;
    const existing = await getResource(normalizedUrl);
    if (existing?.localUri && new File(existing.localUri).exists) {
        await touchResource(normalizedUrl);
        return existing;
    }
    await ensureDirectory();
    const id = existing?.id || resourceId(normalizedUrl);
    const target = new File(imageDirectory, `${id.replace(/[^a-z0-9:_-]/gi, '_')}.${extensionFor(normalizedUrl)}`);
    const timestamp = Date.now();
    await upsertResource({ id, remoteUrl: normalizedUrl, localUri: target.uri, mimeType: null, fileSize: 0, status: 'pending', createdAt: existing?.createdAt || timestamp, lastAccessedAt: timestamp });
    try {
        const downloaded = await File.downloadFileAsync(normalizedUrl, target, { idempotent: true });
        const size = downloaded.size || 0;
        const ready: ResourceRecord = { id, remoteUrl: normalizedUrl, localUri: downloaded.uri, mimeType: null, fileSize: size, status: 'ready', createdAt: existing?.createdAt || timestamp, lastAccessedAt: timestamp };
        await upsertResource(ready);
        return ready;
    } catch (error) {
        await upsertResource({ id, remoteUrl: normalizedUrl, localUri: target.uri, mimeType: null, fileSize: 0, status: 'failed', createdAt: existing?.createdAt || timestamp, lastAccessedAt: timestamp });
        throw error;
    }
}

export async function downloadResource(remoteUrl: string): Promise<ResourceRecord | null> {
    const normalizedUrl = normalizeRemoteUrl(remoteUrl);
    const existing = inFlightDownloads.get(normalizedUrl);
    if (existing) return existing;
    const task = downloadResourceImpl(normalizedUrl);
    inFlightDownloads.set(normalizedUrl, task);
    try {
        return await task;
    } finally {
        inFlightDownloads.delete(normalizedUrl);
    }
}

export type ResourceDownloadStats = {
    bytesDownloaded: number;
    bytesPerSecond: number;
};

export async function downloadResources(
    urls: string[],
    onProgress?: (completed: number, total: number, stats: ResourceDownloadStats) => void,
) {
    const unique = [...new Set(urls.filter(Boolean).map(normalizeRemoteUrl))];
    let cursor = 0;
    let completed = 0;
    let successful = 0;
    let bytesDownloaded = 0;
    const startedAt = Date.now();
    const worker = async () => {
        while (cursor < unique.length) {
            const index = cursor++;
            const existing = await getResource(unique[index]);
            const alreadyDownloaded = Boolean(existing?.status === 'ready' && existing.localUri && new File(existing.localUri).exists);
            try {
                const result = await downloadResource(unique[index]);
                if (result?.status === 'ready') {
                    successful += 1;
                    if (!alreadyDownloaded) bytesDownloaded += result.fileSize || 0;
                }
            } catch { /* one resource may fail without aborting a content job */ }
            completed += 1;
            onProgress?.(completed, unique.length, {
                bytesDownloaded,
                bytesPerSecond: bytesDownloaded / Math.max(1, (Date.now() - startedAt) / 1000),
            });
        }
    };
    await Promise.all(Array.from({ length: Math.min(4, Math.max(unique.length, 1)) }, worker));
    return successful;
}

export async function cleanupResourceFiles(limit = 20) {
    const resources = await listResourcesForCleanup(limit);
    let deletedBytes = 0;
    for (const resource of resources) {
        if (resource.localUri) {
            const file = new File(resource.localUri);
            if (file.exists) {
                deletedBytes += file.size || 0;
                file.delete();
            }
        }
        await deleteResourceRecord(resource.id);
    }
    return deletedBytes;
}

export async function referenceResource(remoteUrl: string, ownerType: string, ownerId: string, purpose: string) {
    await addResourceRef(remoteUrl, ownerType, ownerId, purpose);
}
