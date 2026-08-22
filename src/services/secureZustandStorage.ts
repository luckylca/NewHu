import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

const SECURE_CHUNK_SIZE = 1800;
const SECURE_CHUNK_MARKER = '__newhu_secure_chunks_v1__:';

type ChunkMetadata = { generation: string; count: number };

function parseChunkMetadata(value: string | null): ChunkMetadata | null {
  if (!value?.startsWith(SECURE_CHUNK_MARKER)) return null;
  try {
    const parsed = JSON.parse(value.slice(SECURE_CHUNK_MARKER.length)) as ChunkMetadata;
    if (!parsed.generation || !Number.isInteger(parsed.count) || parsed.count < 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function chunkKey(secureKey: string, metadata: ChunkMetadata, index: number) {
  return `${secureKey}.${metadata.generation}.${index}`;
}

async function deleteChunks(secureKey: string, metadata: ChunkMetadata | null) {
  if (!metadata) return;
  await Promise.all(Array.from({ length: metadata.count }, (_, index) =>
    SecureStore.deleteItemAsync(chunkKey(secureKey, metadata, index))));
}

async function readSecureValue(secureKey: string) {
  const stored = await SecureStore.getItemAsync(secureKey);
  const metadata = parseChunkMetadata(stored);
  if (!metadata) return { value: stored, chunked: false };
  const chunks = await Promise.all(Array.from({ length: metadata.count }, (_, index) =>
    SecureStore.getItemAsync(chunkKey(secureKey, metadata, index))));
  if (chunks.some((chunk) => chunk === null)) throw new Error(`Incomplete secure value for ${secureKey}`);
  return { value: chunks.join(''), chunked: true };
}

async function writeSecureValue(secureKey: string, value: string) {
  const previous = parseChunkMetadata(await SecureStore.getItemAsync(secureKey));
  if (value.length <= SECURE_CHUNK_SIZE) {
    await SecureStore.setItemAsync(secureKey, value);
    await deleteChunks(secureKey, previous);
    return;
  }

  const metadata: ChunkMetadata = {
    generation: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    count: Math.ceil(value.length / SECURE_CHUNK_SIZE),
  };
  await Promise.all(Array.from({ length: metadata.count }, (_, index) =>
    SecureStore.setItemAsync(
      chunkKey(secureKey, metadata, index),
      value.slice(index * SECURE_CHUNK_SIZE, (index + 1) * SECURE_CHUNK_SIZE),
    )));
  await SecureStore.setItemAsync(secureKey, `${SECURE_CHUNK_MARKER}${JSON.stringify(metadata)}`);
  await deleteChunks(secureKey, previous);
}

async function deleteSecureValue(secureKey: string) {
  const metadata = parseChunkMetadata(await SecureStore.getItemAsync(secureKey));
  await SecureStore.deleteItemAsync(secureKey);
  await deleteChunks(secureKey, metadata);
}

export function createSecureZustandStorage(
  storageName: string,
  secretField: string,
  secureKey: string,
): StateStorage {
  return {
    getItem: async () => {
      const raw = await AsyncStorage.getItem(storageName);
      let envelope: { state?: Record<string, unknown>; version?: number };
      try {
        envelope = raw ? JSON.parse(raw) : { state: {} };
      } catch {
        envelope = { state: {} };
      }
      envelope.state ??= {};
      const secureValue = await readSecureValue(secureKey);
      let secret = secureValue.value;
      const legacy = envelope.state[secretField];
      if (!secret && typeof legacy === 'string' && legacy) {
        secret = legacy;
        await writeSecureValue(secureKey, legacy);
      } else if (secret && !secureValue.chunked && secret.length > SECURE_CHUNK_SIZE) {
        await writeSecureValue(secureKey, secret);
      }
      delete envelope.state[secretField];
      await AsyncStorage.setItem(storageName, JSON.stringify(envelope));
      if (secret) envelope.state[secretField] = secret;
      return JSON.stringify(envelope);
    },
    setItem: async (_name, value) => {
      const envelope = JSON.parse(value) as { state?: Record<string, unknown>; version?: number };
      envelope.state ??= {};
      const secret = envelope.state[secretField];
      if (typeof secret === 'string' && secret) await writeSecureValue(secureKey, secret);
      else await deleteSecureValue(secureKey);
      delete envelope.state[secretField];
      await AsyncStorage.setItem(storageName, JSON.stringify(envelope));
    },
    removeItem: async () => {
      await Promise.all([
        AsyncStorage.removeItem(storageName),
        deleteSecureValue(secureKey),
      ]);
    },
  };
}
