import { File } from 'expo-file-system';
import {
  ensureProductV1ModelFile,
  getProductV1ModelFile,
  installProductV1Model,
  PRODUCT_V1_MODEL_SPEC,
  validateProductV1Asset,
} from './runtimeAssets';

export const PRODUCT_V1_MODEL_FILENAME = PRODUCT_V1_MODEL_SPEC.name;
export const PRODUCT_V1_MODEL_SIZE = PRODUCT_V1_MODEL_SPEC.size;
export const PRODUCT_V1_MODEL_MD5 = PRODUCT_V1_MODEL_SPEC.md5;

export function getProductV1ModelStatus() {
  const modelFile = getProductV1ModelFile();
  return {
    installed: validateProductV1Asset(modelFile, PRODUCT_V1_MODEL_SPEC),
    size: modelFile.exists ? modelFile.size : 0,
    path: modelFile.uri,
    automaticDownloadConfigured: true,
  };
}

export async function ensureProductV1ModelPath() {
  const modelFile = await ensureProductV1ModelFile();
  return modelFile.uri.replace(/^file:\/\//, '');
}

export async function importProductV1Model() {
  const picked = await File.pickFileAsync(undefined, '*/*');
  const selected = Array.isArray(picked) ? picked[0] : picked;
  const source = selected ? new File(selected.uri) : null;
  if (!source) throw new Error('未选择模型文件');
  if (!validateProductV1Asset(source, PRODUCT_V1_MODEL_SPEC)) {
    throw new Error('模型文件校验失败，请选择 Tiny Encoder V1 Mobile FP32 模型');
  }
  return installProductV1Model(source).uri;
}
