import bundledTopicMeta from '@/assets/semantic-v2/product_topic_meta.json';
import type { SearchTopicGraphCompactV1 } from './core/searchTopicGraphV1';

/** Small, offline capsule graph used until the richer runtime graph is ready. */
export const bundledBadgeGraph = {
  version: 1,
  schemaVersion: 1,
  embeddingDimension: 512,
  dequantScale: 1,
  broadDomains: bundledTopicMeta.broadDomains.map((domain, index) => ({
    nodeId: `bundled-broad-${index}`,
    canonicalName: domain.canonicalName,
    centroidRowIndex: domain.centroidRowIndex,
  })),
  leafTopics: bundledTopicMeta.leafTopics.map((topic) => ({
    nodeId: topic.nodeId,
    canonicalName: topic.canonicalName,
    broadDomain: topic.broadDomain,
    crossLinkDomains: topic.crossLinkDomains ?? [],
    centroidRowIndex: topic.centroidRowIndex,
  })),
  queries: [],
} as SearchTopicGraphCompactV1;
