import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import CryptoJS from 'crypto-js';
import { yieldToUI } from './core/cooperative';

export const PRODUCT_V1_ASSET_VERSION = '1';
export const PRODUCT_V1_ASSET_BASE_URL =
  'https://gitee.com/lcaluckily/NewHuRecommend/raw/master/product-v1/v1';

type AssetSpec = {
  name: string;
  size: number;
  md5: string;
  sha256: string;
};

type ModelChunkSpec = AssetSpec;

export const PRODUCT_V1_MODEL_SPEC: AssetSpec & { chunks: ModelChunkSpec[] } = {
  name: 'tiny_encoder_v1.mobile.fp32.onnx',
  size: 16_811_941,
  md5: 'c3bbc025e35263eb4f3be9e34f092121',
  sha256: '50c7d0b82bab201fed14e34f220a9ff86f03e00cdf62a43369b3af918d19da16',
  chunks: [
    { name: 'tiny_encoder_v1.mobile.fp32.onnx.part00', size: 4_000_000, md5: '0387ee5088a9eae982115dc9252bede9', sha256: '1d797df28e9387ca6bec2d7097e6b967d67dacddbcd8f38f14d43b0fdd67b832' },
    { name: 'tiny_encoder_v1.mobile.fp32.onnx.part01', size: 4_000_000, md5: '7b933e8d7f7a8e655656b0c4f7cc359d', sha256: '0a12a615950445df8be712ecc264d49f9bfc153cfbe26a71f6880d0df1de8ed6' },
    { name: 'tiny_encoder_v1.mobile.fp32.onnx.part02', size: 4_000_000, md5: '289dd5eb4215d3932b25f0b11cb43fc7', sha256: 'b07c24c59000baa5608661135d42541b99e8d802a0a212c3e08599369f91ed9f' },
    { name: 'tiny_encoder_v1.mobile.fp32.onnx.part03', size: 4_000_000, md5: '2a952624091c805cd9cf0ff9489f6a61', sha256: '8c183d97fa4b97bf427421be5672b9e29fe509773bb8aa6319724d26bf8e7b94' },
    { name: 'tiny_encoder_v1.mobile.fp32.onnx.part04', size: 811_941, md5: '5e5aa9d74a60447066c52044487f93ec', sha256: '88ec0ef143fcc9e60fb5d4eb8af912edafecd6249af2b8faed83c1bbed3e6743' },
  ],
};

export const PRODUCT_V1_SEED_BANK_SPEC: AssetSpec = {
  name: 'search_seed_bank_v2.compact.json',
  size: 1_904_553,
  md5: '4619d84a8fbae15b8d9e0370d642c504',
  sha256: '5a4a69fdcbf6c01fb36b6f529b6f56a820e3f119000c3b5848759a3c3da23e98',
};

export const PRODUCT_V1_SEED_EMBEDDINGS_SPEC: AssetSpec = {
  name: 'search_seed_embeddings_v1.int8.bin',
  size: 346_368,
  md5: '9cf7f0dc2faf6f4d92fdcaea6dcaa881',
  sha256: '1cc74b2d5e874b1333c2607498b57279cc2984d9c112ccdd6bf587c896d44144',
};

export const PRODUCT_V1_TOPIC_GRAPH_SPEC: AssetSpec = {
  name: 'search_topic_graph_v1.compact.json',
  size: 1_977_887,
  md5: '43997e1b41978da37ddc01157c6f9daa',
  sha256: '5b214299a1872a2e8e22cca51b67ec1d9f108c1a7382bf96d2fa111cc37817ed',
};

export const PRODUCT_V1_TOPIC_GRAPH_EMBEDDINGS_SPEC: AssetSpec = {
  name: 'search_topic_graph_embeddings_v1.int8.bin',
  size: 411_904,
  md5: '98e56c329a8e1426f7c52b2705901a7a',
  sha256: 'bb147ba152a9d3e76344c3d88e7b53241b8a3990a2bf2787b582959759fff82b',
};

export type ProductV1AssetDownloadProgress = {
  phase: 'seed_bank' | 'seed_embeddings' | 'model' | 'complete';
  currentFile: string;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
};

export type ProductV1RuntimeAssetStatus = {
  version: string;
  modelInstalled: boolean;
  seedBankInstalled: boolean;
  seedEmbeddingsInstalled: boolean;
  topicGraphInstalled: boolean;
  topicGraphEmbeddingsInstalled: boolean;
  topicGraphReady: boolean;
  installed: boolean;
  installedBytes: number;
  totalBytes: number;
};

export type ProductV1RuntimeStorageStatus = {
  bytes: number;
  fileCount: number;
  installed: boolean;
};

type ProgressListener = (progress: ProductV1AssetDownloadProgress) => void;

const assetDirectory = new Directory(Paths.document, 'product-v1');
const modelFile = new File(assetDirectory, PRODUCT_V1_MODEL_SPEC.name);
const seedBankFile = new File(assetDirectory, PRODUCT_V1_SEED_BANK_SPEC.name);
const seedEmbeddingsFile = new File(assetDirectory, PRODUCT_V1_SEED_EMBEDDINGS_SPEC.name);
const topicGraphFile = new File(assetDirectory, PRODUCT_V1_TOPIC_GRAPH_SPEC.name);
const topicGraphEmbeddingsFile = new File(assetDirectory, PRODUCT_V1_TOPIC_GRAPH_EMBEDDINGS_SPEC.name);
const totalAssetBytes = PRODUCT_V1_MODEL_SPEC.size
  + PRODUCT_V1_SEED_BANK_SPEC.size
  + PRODUCT_V1_SEED_EMBEDDINGS_SPEC.size;

let activeDownload: Promise<ProductV1RuntimeAssetStatus> | null = null;
let activeProgress: ProductV1AssetDownloadProgress | null = null;
const progressListeners = new Set<ProgressListener>();
const verifiedAssetKeys = new Set<string>();
let lastProgressKey = '';
let lastProgressPercent = -1;

function ensureAssetDirectory() {
  if (!assetDirectory.exists) assetDirectory.create({ idempotent: true, intermediates: true });
}

export function hasProductV1AssetSize(file: File, spec: AssetSpec) {
  return file.exists && file.size === spec.size;
}

export function validateProductV1Asset(file: File, spec: AssetSpec) {
  return hasProductV1AssetSize(file, spec)
    && file.md5?.toLowerCase() === spec.md5;
}

function bytesToWordArray(bytes: Uint8Array) {
  const words = new Array<number>(Math.ceil(bytes.length / 4)).fill(0);
  for (let index = 0; index < bytes.length; index += 1) {
    words[index >>> 2] |= bytes[index] << (24 - (index % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

async function sha256File(file: File) {
  const hasher = CryptoJS.algo.SHA256.create();
  const handle = file.open();
  let remaining = file.size;
  try {
    while (remaining > 0) {
      // Hash in short, cooperative slices; processing a 16 MB model in one JS
      // loop used to starve Android's render and input threads.
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

function validationKey(file: File, spec: AssetSpec) {
  return `${file.uri}:${spec.size}:${spec.sha256}`;
}

export async function validateProductV1AssetAsync(file: File, spec: AssetSpec) {
  if (!hasProductV1AssetSize(file, spec)) return false;
  const key = validationKey(file, spec);
  if (verifiedAssetKeys.has(key)) return true;
  const valid = (await sha256File(file)) === spec.sha256;
  if (valid) verifiedAssetKeys.add(key);
  return valid;
}

function emitProgress(progress: Omit<ProductV1AssetDownloadProgress, 'percent'>) {
  const next = {
    ...progress,
    percent: Math.min(100, Math.round((progress.downloadedBytes / Math.max(1, progress.totalBytes)) * 100)),
  };
  const key = `${next.phase}:${next.currentFile}`;
  // Native download callbacks can fire dozens of times per second. Publish
  // only useful percentage changes so a progress bar does not rerender the page.
  if (key === lastProgressKey && next.percent === lastProgressPercent) return;
  activeProgress = next;
  lastProgressKey = key;
  lastProgressPercent = next.percent;
  for (const listener of progressListeners) listener(next);
}

async function installValidatedFile(source: File, destination: File, spec: AssetSpec) {
  if (!(await validateProductV1AssetAsync(source, spec))) {
    throw new Error(`${spec.name} 下载校验失败`);
  }
  if (destination.exists) destination.delete();
  source.move(destination);
  verifiedAssetKeys.add(validationKey(destination, spec));
}

async function downloadFile(
  spec: AssetSpec,
  destination: File,
  phase: ProductV1AssetDownloadProgress['phase'],
  completedBytes: number,
) {
  ensureAssetDirectory();
  const temporary = new File(assetDirectory, `${spec.name}.download`);
  if (temporary.exists) temporary.delete();
  const task = LegacyFileSystem.createDownloadResumable(
    `${PRODUCT_V1_ASSET_BASE_URL}/${spec.name}`,
    temporary.uri,
    {},
    ({ totalBytesWritten }) => emitProgress({
      phase,
      currentFile: spec.name,
      downloadedBytes: completedBytes + Math.min(totalBytesWritten, spec.size),
      totalBytes: totalAssetBytes,
    }),
  );
  try {
    const result = await task.downloadAsync();
    if (!result) throw new Error(`${spec.name} 下载已取消`);
    await installValidatedFile(new File(result.uri), destination, spec);
  } catch (error) {
    if (temporary.exists) temporary.delete();
    throw error;
  }
}

async function downloadModel(completedBytes: number) {
  ensureAssetDirectory();
  const assembled = new File(assetDirectory, `${PRODUCT_V1_MODEL_SPEC.name}.assembling`);
  if (assembled.exists) assembled.delete();
  assembled.create({ overwrite: true });
  const handle = assembled.open();
  let chunkBytes = 0;
  try {
    for (const chunk of PRODUCT_V1_MODEL_SPEC.chunks) {
      const temporary = new File(assetDirectory, `${chunk.name}.download`);
      if (temporary.exists) temporary.delete();
      const task = LegacyFileSystem.createDownloadResumable(
        `${PRODUCT_V1_ASSET_BASE_URL}/${chunk.name}`,
        temporary.uri,
        {},
        ({ totalBytesWritten }) => emitProgress({
          phase: 'model',
          currentFile: chunk.name,
          downloadedBytes: completedBytes + chunkBytes + Math.min(totalBytesWritten, chunk.size),
          totalBytes: totalAssetBytes,
        }),
      );
      const result = await task.downloadAsync();
      if (!result) throw new Error(`${chunk.name} 下载已取消`);
      const downloaded = new File(result.uri);
      // The complete assembled model receives the authoritative SHA-256 check.
      // Per-chunk size checks avoid hashing the 16 MB model twice on the JS thread.
      if (!hasProductV1AssetSize(downloaded, chunk)) {
        downloaded.delete();
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
  await installValidatedFile(assembled, modelFile, PRODUCT_V1_MODEL_SPEC);
}

export function getProductV1ModelFile() {
  return modelFile;
}

export function getProductV1SeedBankFile() {
  return seedBankFile;
}

export function getProductV1SeedEmbeddingsFile() {
  return seedEmbeddingsFile;
}

export function getProductV1TopicGraphFile() {
  return topicGraphFile;
}

export function getProductV1TopicGraphEmbeddingsFile() {
  return topicGraphEmbeddingsFile;
}

export function getProductV1RuntimeAssetStatus(): ProductV1RuntimeAssetStatus {
  // Status checks run on settings and screen renders. File presence and size
  // are constant-time metadata reads; full SHA-256 runs cooperatively at load.
  const modelInstalled = hasProductV1AssetSize(modelFile, PRODUCT_V1_MODEL_SPEC);
  const seedBankInstalled = hasProductV1AssetSize(seedBankFile, PRODUCT_V1_SEED_BANK_SPEC);
  const seedEmbeddingsInstalled = hasProductV1AssetSize(seedEmbeddingsFile, PRODUCT_V1_SEED_EMBEDDINGS_SPEC);
  const topicGraphInstalled = hasProductV1AssetSize(topicGraphFile, PRODUCT_V1_TOPIC_GRAPH_SPEC);
  const topicGraphEmbeddingsInstalled = hasProductV1AssetSize(
    topicGraphEmbeddingsFile,
    PRODUCT_V1_TOPIC_GRAPH_EMBEDDINGS_SPEC,
  );
  return {
    version: PRODUCT_V1_ASSET_VERSION,
    modelInstalled,
    seedBankInstalled,
    seedEmbeddingsInstalled,
    topicGraphInstalled,
    topicGraphEmbeddingsInstalled,
    topicGraphReady: topicGraphInstalled && topicGraphEmbeddingsInstalled,
    // Topic Graph V1 is an additive promoted extension. Keep the frozen Core
    // install usable so Seed Router V2 remains a safe rollback path while the
    // extension is unavailable or its cloud assets cannot be reached.
    installed: modelInstalled && seedBankInstalled && seedEmbeddingsInstalled,
    installedBytes: (modelInstalled ? PRODUCT_V1_MODEL_SPEC.size : 0)
      + (seedBankInstalled ? PRODUCT_V1_SEED_BANK_SPEC.size : 0)
      + (seedEmbeddingsInstalled ? PRODUCT_V1_SEED_EMBEDDINGS_SPEC.size : 0),
    totalBytes: totalAssetBytes,
  };
}

export function getProductV1RuntimeStorageStatus(): ProductV1RuntimeStorageStatus {
  if (!assetDirectory.exists) return { bytes: 0, fileCount: 0, installed: false };
  const files = assetDirectory.list().filter((entry): entry is File => entry instanceof File);
  const bytes = files.reduce((total, file) => total + (file.exists ? file.size : 0), 0);
  const installed = modelFile.exists && modelFile.size === PRODUCT_V1_MODEL_SPEC.size
    && seedBankFile.exists && seedBankFile.size === PRODUCT_V1_SEED_BANK_SPEC.size
    && seedEmbeddingsFile.exists && seedEmbeddingsFile.size === PRODUCT_V1_SEED_EMBEDDINGS_SPEC.size;
  return { bytes, fileCount: files.length, installed };
}

export function removeProductV1RuntimeAssets() {
  if (activeDownload) throw new Error('推荐资源正在下载，请稍后再删除');
  const status = getProductV1RuntimeStorageStatus();
  if (assetDirectory.exists) assetDirectory.delete();
  activeProgress = null;
  verifiedAssetKeys.clear();
  return status.bytes;
}

async function downloadMissingAssets() {
  let status = getProductV1RuntimeAssetStatus();
  let completedBytes = status.installedBytes;
  if (!status.seedBankInstalled) {
    await downloadFile(PRODUCT_V1_SEED_BANK_SPEC, seedBankFile, 'seed_bank', completedBytes);
    completedBytes += PRODUCT_V1_SEED_BANK_SPEC.size;
  }
  if (!status.seedEmbeddingsInstalled) {
    await downloadFile(PRODUCT_V1_SEED_EMBEDDINGS_SPEC, seedEmbeddingsFile, 'seed_embeddings', completedBytes);
    completedBytes += PRODUCT_V1_SEED_EMBEDDINGS_SPEC.size;
  }
  if (!status.modelInstalled) {
    await downloadModel(completedBytes);
  }
  status = getProductV1RuntimeAssetStatus();
  if (!status.installed) throw new Error('Product V1 在线资源安装不完整');
  emitProgress({ phase: 'complete', currentFile: '', downloadedBytes: totalAssetBytes, totalBytes: totalAssetBytes });
  return status;
}

async function downloadExtensionFile(spec: AssetSpec, destination: File) {
  ensureAssetDirectory();
  const temporary = new File(assetDirectory, `${spec.name}.download`);
  if (temporary.exists) temporary.delete();
  try {
    const result = await LegacyFileSystem.downloadAsync(
      `${PRODUCT_V1_ASSET_BASE_URL}/${spec.name}`,
      temporary.uri,
    );
    await installValidatedFile(new File(result.uri), destination, spec);
  } catch (error) {
    if (temporary.exists) temporary.delete();
    throw error;
  }
}

export async function ensureProductV1TopicGraphAssets() {
  let status = getProductV1RuntimeAssetStatus();
  if (!status.topicGraphInstalled) {
    await downloadExtensionFile(PRODUCT_V1_TOPIC_GRAPH_SPEC, topicGraphFile);
  }
  status = getProductV1RuntimeAssetStatus();
  if (!status.topicGraphEmbeddingsInstalled) {
    await downloadExtensionFile(PRODUCT_V1_TOPIC_GRAPH_EMBEDDINGS_SPEC, topicGraphEmbeddingsFile);
  }
  status = getProductV1RuntimeAssetStatus();
  if (!status.topicGraphReady) throw new Error('Search Topic Graph V1 在线资源安装不完整');
  return status;
}

async function ensureCoreAssets() {
  let status = getProductV1RuntimeAssetStatus();
  const assets: [File, AssetSpec, boolean][] = [
    [seedBankFile, PRODUCT_V1_SEED_BANK_SPEC, status.seedBankInstalled],
    [seedEmbeddingsFile, PRODUCT_V1_SEED_EMBEDDINGS_SPEC, status.seedEmbeddingsInstalled],
    [modelFile, PRODUCT_V1_MODEL_SPEC, status.modelInstalled],
  ];
  for (const [file, spec, present] of assets) {
    if (present && !(await validateProductV1AssetAsync(file, spec)) && file.exists) file.delete();
  }
  status = getProductV1RuntimeAssetStatus();
  return status.installed ? status : downloadMissingAssets();
}

export async function ensureProductV1RuntimeAssets(onProgress?: ProgressListener) {
  if (onProgress) {
    progressListeners.add(onProgress);
    if (activeProgress) onProgress(activeProgress);
  }
  try {
    if (!activeDownload) {
      activeDownload = ensureCoreAssets().finally(() => {
        activeDownload = null;
        activeProgress = null;
      });
    }
    return await activeDownload;
  } finally {
    if (onProgress) progressListeners.delete(onProgress);
  }
}

export async function ensureProductV1ModelFile() {
  if (!(await validateProductV1AssetAsync(modelFile, PRODUCT_V1_MODEL_SPEC))) {
    const status = getProductV1RuntimeAssetStatus();
    const completedBytes = status.installedBytes - (status.modelInstalled ? PRODUCT_V1_MODEL_SPEC.size : 0);
    await downloadModel(completedBytes);
  }
  return modelFile;
}

export async function installProductV1Model(source: File) {
  ensureAssetDirectory();
  const temporary = new File(assetDirectory, `${PRODUCT_V1_MODEL_SPEC.name}.installing`);
  if (temporary.exists) temporary.delete();
  source.copy(temporary);
  await installValidatedFile(temporary, modelFile, PRODUCT_V1_MODEL_SPEC);
  return modelFile;
}
