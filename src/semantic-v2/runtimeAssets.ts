import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { sha256FileInBackground } from 'expo-file-integrity';
import CryptoJS from 'crypto-js';
import { yieldToUI } from '@/src/product-v1/core/cooperative';

export const SEMANTIC_V2_ASSET_VERSION = '1';
export const SEMANTIC_V2_ASSET_BASE_URL =
  'https://gitee.com/lcaluckily/NewHuRecommend/raw/master/semantic-v2/v1';
export const SEMANTIC_V2_ASSET_MANIFEST_URL = `${SEMANTIC_V2_ASSET_BASE_URL}/manifest.json`;
const SEMANTIC_V2_COMPATIBILITY_ID = 'SemanticV2-Native512-RelevanceMax';

export type SemanticV2AssetKey =
  | 'selector'
  | 'badgeFallback'
  | 'seedBank'
  | 'seedEmbeddings'
  | 'topicGraph'
  | 'topicGraphEmbeddings';

type ChunkSpec = {
  name: string;
  remotePath: string;
  size: number;
  sha256: string;
};

type AssetSpec = {
  key: SemanticV2AssetKey;
  name: string;
  remotePath: string;
  size: number;
  sha256: string;
  label: string;
  chunks?: ChunkSpec[];
};

type ManifestChunk = {
  name: string;
  path: string;
  size: number;
  sha256: string;
};

export type SemanticV2AssetManifest = {
  version: string;
  semanticVersion: string;
  basePath: string;
  totalBytes: number;
  assets: Array<{
    name: string;
    path: string;
    size: number;
    sha256: string;
    chunks?: ManifestChunk[];
  }>;
};

export type SemanticV2RuntimeAssetUpdate = {
  currentVersion: string;
  latestVersion: string;
  changedAssets: Array<{ key: SemanticV2AssetKey; label: string; size: number }>;
  manifest: SemanticV2AssetManifest;
};

const DEFAULT_SPECS: Record<SemanticV2AssetKey, AssetSpec> = {
  selector: {
    key: 'selector', name: 'selector.int4.onnx', remotePath: 'selector.int4.onnx', size: 11_602_862,
    sha256: 'c3c1b1ff80ea0bcfca688b0740823aeb8494f96c1ef2f229cbb7018ff41bb499', label: 'Semantic V2 selector',
    chunks: [
      { name: 'selector.int4.onnx.part00', remotePath: 'selector.int4.onnx.part00', size: 4_000_000, sha256: '64c77168704e20b051f48b2be54b884ab0bc42adf404612617614b4fb90a6db8' },
      { name: 'selector.int4.onnx.part01', remotePath: 'selector.int4.onnx.part01', size: 4_000_000, sha256: '47592ebecd26c99f4bd03f5d6e85a9d4ba5fdfd40c8c0a1ae5c3c75077c4d9a7' },
      { name: 'selector.int4.onnx.part02', remotePath: 'selector.int4.onnx.part02', size: 3_602_862, sha256: 'fc29a831bd291db53b7209face4490d479540a241ba22a08e707771e06e89835' },
    ],
  },
  badgeFallback: {
    key: 'badgeFallback', name: 'badge_fallback_v32.onnx', remotePath: 'badge_fallback_v32.onnx', size: 1_476_709,
    sha256: 'ab18d1eafbee9336d44b3c901327f0c1eb4146ac127a8e0a23b5dd7e193b3511', label: 'Semantic V2 badge fallback',
  },
  seedBank: {
    key: 'seedBank', name: 'search_seed_bank_v2.compact.json', remotePath: 'recommendation/search_seed_bank_v2.compact.json', size: 1_284_852,
    sha256: '1355839d69d0638b3f12a09d7c7d3954af9a0109477455e26b3f3d0186a8fb8f', label: 'Native512 seed bank',
  },
  seedEmbeddings: {
    key: 'seedEmbeddings', name: 'search_seed_embeddings_v2_512.int8.bin', remotePath: 'recommendation/search_seed_embeddings_v2_512.int8.bin', size: 1_385_472,
    sha256: '91ec944276353bcaa2516c65a41d65710ee00ccf6a5e07fdf7fe9dc8b3e636ba', label: 'Native512 seed embeddings',
  },
  topicGraph: {
    key: 'topicGraph', name: 'search_topic_graph_v1.compact.json', remotePath: 'recommendation/search_topic_graph_v1.compact.json', size: 1_326_181,
    sha256: '0b1699f521fe172971eeb7330f7d2e4ff9eaa220f35d390b2f5ec843d91dc610', label: 'Native512 topic graph',
  },
  topicGraphEmbeddings: {
    key: 'topicGraphEmbeddings', name: 'search_topic_graph_embeddings_v2_512.int8.bin', remotePath: 'recommendation/search_topic_graph_embeddings_v2_512.int8.bin', size: 1_647_616,
    sha256: 'ffc59f7fb2a5bec6116196a642eec552fbaa2b84afba3a94481c1291703067c7', label: 'Native512 topic graph embeddings',
  },
};

const ORDER: SemanticV2AssetKey[] = ['seedBank', 'seedEmbeddings', 'topicGraph', 'topicGraphEmbeddings', 'badgeFallback', 'selector'];
let SPECS: Record<SemanticV2AssetKey, AssetSpec> = DEFAULT_SPECS;
let TOTAL_BYTES = ORDER.reduce((sum, key) => sum + SPECS[key].size, 0);
let activeManifestVersion = SEMANTIC_V2_ASSET_VERSION;
let progressTotalBytes = TOTAL_BYTES;
const assetDirectory = new Directory(Paths.document, `semantic-v2-v${SEMANTIC_V2_ASSET_VERSION}`);
const updateStagingDirectory = new Directory(Paths.document, 'semantic-v2-update-staging');
const updateBackupDirectory = new Directory(Paths.document, 'semantic-v2-update-backup');
const files = Object.fromEntries(ORDER.map((key) => [key, new File(assetDirectory, SPECS[key].name)])) as Record<SemanticV2AssetKey, File>;
const installedManifestFile = new File(assetDirectory, 'manifest.json');

export type SemanticV2AssetDownloadProgress = {
  phase: 'download' | 'verify' | 'complete';
  key: SemanticV2AssetKey | null;
  currentFile: string;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
};

export type SemanticV2RuntimeAssetStatus = {
  version: string;
  installed: boolean;
  installedBytes: number;
  totalBytes: number;
  installedFiles: number;
  totalFiles: number;
};

type ProgressListener = (progress: SemanticV2AssetDownloadProgress) => void;
const listeners = new Set<ProgressListener>();
const verified = new Set<string>();
let activeDownload: Promise<SemanticV2RuntimeAssetStatus> | null = null;
let activeProgress: SemanticV2AssetDownloadProgress | null = null;
let installedManifestLoaded = false;
let installedManifestLoad: Promise<void> | null = null;

type ParsedManifest = {
  manifest: SemanticV2AssetManifest;
  specs: Record<SemanticV2AssetKey, AssetSpec>;
  totalBytes: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeRemotePath(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.includes('?')
    && !value.includes('#')
    && value.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function parseManifest(value: unknown): ParsedManifest {
  if (!isRecord(value)
    || typeof value.version !== 'string'
    || !value.version.trim()
    || value.semanticVersion !== SEMANTIC_V2_COMPATIBILITY_ID
    || value.basePath !== 'semantic-v2/v1'
    || !Array.isArray(value.assets)) {
    throw new Error('Gitee 资源清单格式不兼容');
  }

  const assetsByName = new Map<string, Record<string, unknown>>();
  for (const rawAsset of value.assets) {
    if (!isRecord(rawAsset) || typeof rawAsset.name !== 'string' || assetsByName.has(rawAsset.name)) {
      throw new Error('Gitee 资源清单包含无效或重复文件');
    }
    assetsByName.set(rawAsset.name, rawAsset);
  }

  const specs = {} as Record<SemanticV2AssetKey, AssetSpec>;
  const assets: SemanticV2AssetManifest['assets'] = [];
  let totalBytes = 0;

  for (const key of ORDER) {
    const original = DEFAULT_SPECS[key];
    const raw = assetsByName.get(original.name);
    if (!raw
      || !isSafeRemotePath(raw.path)
      || !Number.isSafeInteger(raw.size)
      || (raw.size as number) <= 0
      || typeof raw.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/i.test(raw.sha256)) {
      throw new Error(`Gitee 资源清单缺少有效文件：${original.name}`);
    }

    let chunks: ChunkSpec[] | undefined;
    let manifestChunks: ManifestChunk[] | undefined;
    if (raw.chunks !== undefined) {
      if (!Array.isArray(raw.chunks) || raw.chunks.length === 0) {
        throw new Error(`${original.name} 分块清单无效`);
      }
      chunks = raw.chunks.map((rawChunk) => {
        if (!isRecord(rawChunk)
          || typeof rawChunk.name !== 'string'
          || rawChunk.name.length === 0
          || rawChunk.name.includes('/')
          || rawChunk.name.includes('\\')
          || !isSafeRemotePath(rawChunk.path)
          || !Number.isSafeInteger(rawChunk.size)
          || (rawChunk.size as number) <= 0
          || typeof rawChunk.sha256 !== 'string'
          || !/^[a-f0-9]{64}$/i.test(rawChunk.sha256)) {
          throw new Error(`${original.name} 分块清单无效`);
        }
        return {
          name: rawChunk.name,
          remotePath: rawChunk.path,
          size: rawChunk.size as number,
          sha256: rawChunk.sha256.toLowerCase(),
        };
      });
      if (chunks.reduce((sum, chunk) => sum + chunk.size, 0) !== raw.size) {
        throw new Error(`${original.name} 分块大小与文件大小不匹配`);
      }
      manifestChunks = chunks.map((chunk) => ({
        name: chunk.name,
        path: chunk.remotePath,
        size: chunk.size,
        sha256: chunk.sha256,
      }));
    }

    const spec: AssetSpec = {
      ...original,
      remotePath: raw.path,
      size: raw.size as number,
      sha256: raw.sha256.toLowerCase(),
      chunks,
    };
    specs[key] = spec;
    totalBytes += spec.size;
    assets.push({
      name: spec.name,
      path: spec.remotePath,
      size: spec.size,
      sha256: spec.sha256,
      ...(manifestChunks ? { chunks: manifestChunks } : {}),
    });
  }

  if (assetsByName.size !== ORDER.length || value.totalBytes !== totalBytes) {
    throw new Error('Gitee 资源清单文件数量或总大小不匹配');
  }

  return {
    manifest: {
      version: value.version,
      semanticVersion: SEMANTIC_V2_COMPATIBILITY_ID,
      basePath: 'semantic-v2/v1',
      totalBytes,
      assets,
    },
    specs,
    totalBytes,
  };
}

function changedAssetKeys(next: Record<SemanticV2AssetKey, AssetSpec>) {
  return ORDER.filter((key) => {
    const current = SPECS[key];
    const latest = next[key];
    if (current.remotePath !== latest.remotePath
      || current.size !== latest.size
      || current.sha256 !== latest.sha256
      || current.chunks?.length !== latest.chunks?.length) return true;
    return current.chunks?.some((chunk, index) => {
      const nextChunk = latest.chunks?.[index];
      return !nextChunk
        || chunk.name !== nextChunk.name
        || chunk.remotePath !== nextChunk.remotePath
        || chunk.size !== nextChunk.size
        || chunk.sha256 !== nextChunk.sha256;
    }) ?? false;
  });
}

async function loadInstalledManifest() {
  if (installedManifestLoaded) return;
  if (!installedManifestLoad) {
    installedManifestLoad = (async () => {
      await recoverInterruptedUpdate();
      if (installedManifestFile.exists) {
        try {
          const parsed = parseManifest(JSON.parse(installedManifestFile.textSync()));
          SPECS = parsed.specs;
          TOTAL_BYTES = parsed.totalBytes;
          progressTotalBytes = TOTAL_BYTES;
          activeManifestVersion = parsed.manifest.version;
        } catch (error) {
          console.warn('[SemanticV2] installed asset manifest is invalid; using bundled manifest', error);
        }
      }
      installedManifestLoaded = true;
    })().catch((error) => {
      installedManifestLoad = null;
      throw error;
    });
  }
  await installedManifestLoad;
}

async function recoverInterruptedUpdate() {
  const journalFile = new File(updateBackupDirectory, 'update-journal.json');
  if (!updateBackupDirectory.exists) {
    if (updateStagingDirectory.exists) updateStagingDirectory.delete();
    return;
  }

  let recoveryComplete = false;
  try {
    // The journal is written before the first asset is moved. Without it,
    // no destination could have changed, so only stale downloads remain.
    if (!journalFile.exists) {
      recoveryComplete = true;
      return;
    }
    const journal = JSON.parse(journalFile.textSync()) as {
      manifest?: unknown;
      keys?: unknown;
      existingKeys?: unknown;
    };
    const target = parseManifest(journal.manifest);
    if (!Array.isArray(journal.keys)
      || !Array.isArray(journal.existingKeys)
      || journal.keys.some((key) => typeof key !== 'string' || !ORDER.includes(key as SemanticV2AssetKey))
      || journal.existingKeys.some((key) => typeof key !== 'string' || !ORDER.includes(key as SemanticV2AssetKey))) {
      throw new Error('update journal is invalid');
    }
    const committed = installedManifestFile.exists
      && JSON.stringify(parseManifest(JSON.parse(installedManifestFile.textSync())).manifest) === JSON.stringify(target.manifest);
    if (!committed) {
      const keys = journal.keys.filter((key): key is SemanticV2AssetKey => typeof key === 'string' && ORDER.includes(key as SemanticV2AssetKey));
      const existingKeys = new Set(journal.existingKeys.filter((key): key is SemanticV2AssetKey => typeof key === 'string' && ORDER.includes(key as SemanticV2AssetKey)));
      for (const key of keys.reverse()) {
        const destination = files[key];
        const backup = new File(updateBackupDirectory, DEFAULT_SPECS[key].name);
        if (backup.exists) {
          if (destination.exists) destination.delete();
          backup.move(destination);
        } else if (!existingKeys.has(key) && destination.exists) {
          destination.delete();
        }
      }
    }
    recoveryComplete = true;
  } catch (error) {
    console.warn('[SemanticV2] recovering interrupted asset update', error);
    throw new Error('上次模型更新未能恢复；已保留恢复备份，请重新启动应用后重试');
  } finally {
    if (updateStagingDirectory.exists) updateStagingDirectory.delete();
    if (recoveryComplete && updateBackupDirectory.exists) updateBackupDirectory.delete();
  }
}

async function fetchLatestManifest() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const separator = SEMANTIC_V2_ASSET_MANIFEST_URL.includes('?') ? '&' : '?';
    const response = await fetch(`${SEMANTIC_V2_ASSET_MANIFEST_URL}${separator}check=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Gitee 资源清单请求失败（HTTP ${response.status}）`);
    return parseManifest(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

function ensureDirectory() {
  if (!assetDirectory.exists) assetDirectory.create({ idempotent: true, intermediates: true });
}

function hasExpectedSize(key: SemanticV2AssetKey) {
  const file = files[key];
  return file.exists && file.size === SPECS[key].size;
}

function bytesToWordArray(bytes: Uint8Array) {
  const words = new Array<number>(Math.ceil(bytes.length / 4)).fill(0);
  for (let index = 0; index < bytes.length; index += 1) {
    words[index >>> 2] |= bytes[index] << (24 - (index % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

async function sha256File(file: File) {
  const nativeHash = await sha256FileInBackground(file.uri);
  if (nativeHash !== null) return nativeHash;

  const hasher = CryptoJS.algo.SHA256.create();
  const handle = file.open();
  let remaining = file.size;
  try {
    while (remaining > 0) {
      const bytes = handle.readBytes(Math.min(128 * 1024, remaining));
      if (bytes.length === 0) break;
      hasher.update(bytesToWordArray(bytes));
      remaining -= bytes.length;
      await yieldToUI();
    }
  } finally {
    handle.close();
  }
  return remaining === 0 ? hasher.finalize().toString() : '';
}

function verificationKey(key: SemanticV2AssetKey) {
  const spec = SPECS[key];
  return `${files[key].uri}:${spec.size}:${spec.sha256}`;
}

async function validateAsset(key: SemanticV2AssetKey) {
  if (!hasExpectedSize(key)) return false;
  const cacheKey = verificationKey(key);
  if (verified.has(cacheKey)) return true;
  const valid = (await sha256File(files[key])) === SPECS[key].sha256;
  if (valid) verified.add(cacheKey);
  return valid;
}

function emit(progress: Omit<SemanticV2AssetDownloadProgress, 'percent'>) {
  const next: SemanticV2AssetDownloadProgress = {
    ...progress,
    percent: Math.min(100, Math.round((progress.downloadedBytes / Math.max(1, progress.totalBytes)) * 100)),
  };
  activeProgress = next;
  listeners.forEach((listener) => listener(next));
}

export function getSemanticV2RuntimeAssetStatus(): SemanticV2RuntimeAssetStatus {
  const installedKeys = ORDER.filter(hasExpectedSize);
  return {
    version: activeManifestVersion,
    installed: installedKeys.length === ORDER.length,
    installedBytes: installedKeys.reduce((sum, key) => sum + SPECS[key].size, 0),
    totalBytes: TOTAL_BYTES,
    installedFiles: installedKeys.length,
    totalFiles: ORDER.length,
  };
}

export async function checkSemanticV2RuntimeAssetUpdates(): Promise<SemanticV2RuntimeAssetUpdate> {
  await loadInstalledManifest();
  const latest = await fetchLatestManifest();
  const changed = changedAssetKeys(latest.specs);
  return {
    currentVersion: activeManifestVersion,
    latestVersion: latest.manifest.version,
    changedAssets: changed.map((key) => ({
      key,
      label: latest.specs[key].label,
      size: latest.specs[key].size,
    })),
    manifest: latest.manifest,
  };
}

export function getSemanticV2RuntimeStorageStatus() {
  if (!assetDirectory.exists) return { bytes: 0, fileCount: 0, installed: false };
  const entries = assetDirectory.list().filter((entry): entry is File => entry instanceof File);
  return {
    bytes: entries.reduce((sum, file) => sum + (file.exists ? file.size : 0), 0),
    fileCount: entries.length,
    installed: getSemanticV2RuntimeAssetStatus().installed,
  };
}

/** Async equivalent for screens so storage enumeration doesn't block a UI frame. */
export async function getSemanticV2RuntimeStorageStatusAsync() {
  const directoryInfo = await LegacyFileSystem.getInfoAsync(assetDirectory.uri);
  if (!directoryInfo.exists || !directoryInfo.isDirectory) {
    return { bytes: 0, fileCount: 0, installed: false };
  }

  const names = await LegacyFileSystem.readDirectoryAsync(assetDirectory.uri);
  const entries = await Promise.all(names.map((name) => (
    LegacyFileSystem.getInfoAsync(new File(assetDirectory, name).uri)
  )));
  const fileCount = entries.filter((entry) => entry.exists && !entry.isDirectory).length;
  const entryByName = new Map(names.map((name, index) => [name, entries[index]]));
  const installedCount = ORDER.filter((key) => {
    const info = entryByName.get(SPECS[key].name);
    return info?.exists === true && info.size === SPECS[key].size;
  }).length;

  return {
    bytes: entries.reduce((sum, entry) => (
      entry.exists && !entry.isDirectory ? sum + entry.size : sum
    ), 0),
    fileCount,
    installed: installedCount === ORDER.length,
  };
}

async function downloadChunkedAsset(key: SemanticV2AssetKey, completedBytes: number, destination: File = files[key]) {
  ensureDirectory();
  const spec = SPECS[key];
  if (!spec.chunks?.length) throw new Error(`${spec.label} 缺少分块清单`);
  const assembled = new File(assetDirectory, `${spec.name}.assembling`);
  if (assembled.exists) assembled.delete();
  assembled.create({ overwrite: true });
  const handle = assembled.open();
  let chunkBytes = 0;
  try {
    for (const chunk of spec.chunks) {
      const temporary = new File(assetDirectory, `${chunk.name}.download`);
      if (temporary.exists) temporary.delete();
      const task = LegacyFileSystem.createDownloadResumable(
        `${SEMANTIC_V2_ASSET_BASE_URL}/${chunk.remotePath}`,
        temporary.uri,
        {},
        ({ totalBytesWritten }) => emit({
          phase: 'download', key, currentFile: chunk.name,
          downloadedBytes: completedBytes + chunkBytes + Math.min(totalBytesWritten, chunk.size), totalBytes: progressTotalBytes,
        }),
      );
      const result = await task.downloadAsync();
      if (!result) throw new Error(`${chunk.name} 下载已取消`);
      const downloaded = new File(result.uri);
      if (downloaded.size !== chunk.size || (await sha256File(downloaded)) !== chunk.sha256) {
        if (downloaded.exists) downloaded.delete();
        throw new Error(`${chunk.name} 下载校验失败`);
      }
      handle.writeBytes(await downloaded.bytes());
      chunkBytes += chunk.size;
      downloaded.delete();
    }
  } catch (error) {
    handle.close();
    if (assembled.exists) assembled.delete();
    throw error;
  }
  handle.close();
  emit({ phase: 'verify', key, currentFile: spec.name, downloadedBytes: completedBytes + spec.size, totalBytes: progressTotalBytes });
  if (assembled.size !== spec.size || (await sha256File(assembled)) !== spec.sha256) {
    if (assembled.exists) assembled.delete();
    throw new Error(`${spec.label} 拼接校验失败`);
  }
  if (destination.exists) destination.delete();
  assembled.move(destination);
  verified.add(verificationKey(key));
}

async function downloadAsset(key: SemanticV2AssetKey, completedBytes: number, destination: File = files[key]) {
  ensureDirectory();
  const spec = SPECS[key];
  if (spec.chunks?.length) {
    await downloadChunkedAsset(key, completedBytes, destination);
    return;
  }
  const temporary = new File(assetDirectory, `${spec.name}.download`);
  if (temporary.exists) temporary.delete();
  const task = LegacyFileSystem.createDownloadResumable(
    `${SEMANTIC_V2_ASSET_BASE_URL}/${spec.remotePath}`,
    temporary.uri,
    {},
    ({ totalBytesWritten }) => emit({
      phase: 'download', key, currentFile: spec.name,
      downloadedBytes: completedBytes + Math.min(totalBytesWritten, spec.size), totalBytes: progressTotalBytes,
    }),
  );
  try {
    const result = await task.downloadAsync();
    if (!result) throw new Error(`${spec.label} 下载已取消`);
    const downloaded = new File(result.uri);
    emit({ phase: 'verify', key, currentFile: spec.name, downloadedBytes: completedBytes + spec.size, totalBytes: progressTotalBytes });
    if (downloaded.size !== spec.size || (await sha256File(downloaded)) !== spec.sha256) {
      if (downloaded.exists) downloaded.delete();
      throw new Error(`${spec.label} 下载校验失败`);
    }
    if (destination.exists) destination.delete();
    downloaded.move(destination);
    verified.add(verificationKey(key));
  } catch (error) {
    if (temporary.exists) temporary.delete();
    throw error;
  }
}

async function ensureAllAssets() {
  await loadInstalledManifest();
  progressTotalBytes = TOTAL_BYTES;
  let completedBytes = 0;
  for (const key of ORDER) {
    const file = files[key];
    if (hasExpectedSize(key) && (await validateAsset(key))) {
      completedBytes += SPECS[key].size;
      continue;
    }
    if (file.exists) file.delete();
    await downloadAsset(key, completedBytes);
    completedBytes += SPECS[key].size;
  }
  const status = getSemanticV2RuntimeAssetStatus();
  if (!status.installed) throw new Error('Semantic V2 在线资源安装不完整');
  emit({ phase: 'complete', key: null, currentFile: '', downloadedBytes: TOTAL_BYTES, totalBytes: TOTAL_BYTES });
  return status;
}

async function applyRuntimeAssetUpdate(update: SemanticV2RuntimeAssetUpdate) {
  const latest = parseManifest(update.manifest);
  if (changedAssetKeys(latest.specs).length === 0) return getSemanticV2RuntimeAssetStatus();

  const previousSpecs = SPECS;
  const previousTotalBytes = TOTAL_BYTES;
  const previousVersion = activeManifestVersion;
  const previousProgressTotalBytes = progressTotalBytes;
  SPECS = latest.specs;
  TOTAL_BYTES = latest.totalBytes;
  ensureDirectory();

  const existingKeys: SemanticV2AssetKey[] = [];
  let transactionKeys: SemanticV2AssetKey[] = [];
  let swapStarted = false;
  let committed = false;
  try {
    const installKeys: SemanticV2AssetKey[] = [];
    for (const key of ORDER) {
      if (!(hasExpectedSize(key) && await validateAsset(key))) installKeys.push(key);
    }
    const installBytes = installKeys.reduce((sum, key) => sum + SPECS[key].size, 0);
    progressTotalBytes = installBytes;

    if (updateStagingDirectory.exists) updateStagingDirectory.delete();
    updateStagingDirectory.create({ idempotent: true, intermediates: true });
    let completedBytes = 0;
    for (const key of installKeys) {
      const stagingFile = new File(updateStagingDirectory, SPECS[key].name);
      await downloadAsset(key, completedBytes, stagingFile);
      completedBytes += SPECS[key].size;
    }

    if (updateBackupDirectory.exists) updateBackupDirectory.delete();
    updateBackupDirectory.create({ idempotent: true, intermediates: true });
    for (const key of installKeys) if (files[key].exists) existingKeys.push(key);
    const journal = new File(updateBackupDirectory, 'update-journal.json');
    await LegacyFileSystem.writeAsStringAsync(journal.uri, JSON.stringify({
      manifest: latest.manifest,
      keys: installKeys,
      existingKeys,
    }));
    transactionKeys = installKeys;
    swapStarted = true;

    for (const key of installKeys) {
      const destination = files[key];
      const backup = new File(updateBackupDirectory, SPECS[key].name);
      const stagingFile = new File(updateStagingDirectory, SPECS[key].name);
      if (destination.exists) destination.move(backup);
      stagingFile.move(destination);
    }

    const statusBeforeManifest = getSemanticV2RuntimeAssetStatus();
    if (!statusBeforeManifest.installed) throw new Error('Semantic V2 更新后资源不完整');
    await LegacyFileSystem.writeAsStringAsync(installedManifestFile.uri, JSON.stringify(latest.manifest));
    installedManifestLoaded = true;
    activeManifestVersion = latest.manifest.version;
    committed = true;
    emit({ phase: 'complete', key: null, currentFile: '', downloadedBytes: installBytes, totalBytes: installBytes });
    try {
      if (updateBackupDirectory.exists) updateBackupDirectory.delete();
      if (updateStagingDirectory.exists) updateStagingDirectory.delete();
    } catch (cleanupError) {
      console.warn('[SemanticV2] temporary update files will be cleaned up on next launch', cleanupError);
    }
    return getSemanticV2RuntimeAssetStatus();
  } catch (error) {
    if (!committed) {
      if (swapStarted) {
        for (const key of transactionKeys.slice().reverse()) {
          const destination = files[key];
          const backup = new File(updateBackupDirectory, DEFAULT_SPECS[key].name);
          if (backup.exists) {
            if (destination.exists) destination.delete();
            backup.move(destination);
          } else if (!existingKeys.includes(key) && destination.exists) {
            destination.delete();
          }
        }
      }
      if (updateBackupDirectory.exists) updateBackupDirectory.delete();
      if (updateStagingDirectory.exists) updateStagingDirectory.delete();
      SPECS = previousSpecs;
      TOTAL_BYTES = previousTotalBytes;
      activeManifestVersion = previousVersion;
      progressTotalBytes = previousProgressTotalBytes;
      verified.clear();
    }
    throw error;
  }
}

export async function ensureSemanticV2RuntimeAssets(onProgress?: ProgressListener) {
  await loadInstalledManifest();
  if (onProgress) {
    listeners.add(onProgress);
    if (activeProgress) onProgress(activeProgress);
  }
  try {
    if (!activeDownload) {
      activeDownload = ensureAllAssets().finally(() => {
        activeDownload = null;
        activeProgress = null;
        progressTotalBytes = TOTAL_BYTES;
      });
    }
    return await activeDownload;
  } finally {
    if (onProgress) listeners.delete(onProgress);
  }
}

export async function installSemanticV2RuntimeAssetUpdate(
  update: SemanticV2RuntimeAssetUpdate,
  onProgress?: ProgressListener,
) {
  await loadInstalledManifest();
  if (onProgress) {
    listeners.add(onProgress);
    if (activeProgress) onProgress(activeProgress);
  }
  try {
    if (activeDownload) await activeDownload;
    if (!activeDownload) {
      activeDownload = applyRuntimeAssetUpdate(update).finally(() => {
        activeDownload = null;
        activeProgress = null;
        progressTotalBytes = TOTAL_BYTES;
      });
    }
    return await activeDownload;
  } finally {
    if (onProgress) listeners.delete(onProgress);
  }
}

export async function getSemanticV2AssetFile(key: SemanticV2AssetKey) {
  await ensureSemanticV2RuntimeAssets();
  const file = files[key];
  if (!(await validateAsset(key))) throw new Error(`${SPECS[key].label} 本地校验失败`);
  return file;
}

export function removeSemanticV2RuntimeAssets() {
  if (activeDownload) throw new Error('Semantic V2 资源正在下载，请稍后再删除');
  const status = getSemanticV2RuntimeStorageStatus();
  if (assetDirectory.exists) assetDirectory.delete();
  if (updateStagingDirectory.exists) updateStagingDirectory.delete();
  if (updateBackupDirectory.exists) updateBackupDirectory.delete();
  verified.clear();
  activeProgress = null;
  SPECS = DEFAULT_SPECS;
  TOTAL_BYTES = ORDER.reduce((sum, key) => sum + DEFAULT_SPECS[key].size, 0);
  progressTotalBytes = TOTAL_BYTES;
  activeManifestVersion = SEMANTIC_V2_ASSET_VERSION;
  installedManifestLoaded = false;
  installedManifestLoad = null;
  return status.bytes;
}

export function resetSemanticV2RuntimeAssetVerificationCache() {
  verified.clear();
}
