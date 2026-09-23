import assert from 'node:assert/strict';
import test from 'node:test';

import {
  routeTopicGraphV1,
  routeTopicLeavesV1,
  type SearchTopicGraphCompactV1,
} from '../../src/product-v1/core/searchTopicGraphV1';

const graph: SearchTopicGraphCompactV1 = {
  version: 1,
  embeddingDimension: 2,
  dequantScale: 1 / 127,
  broadDomains: [
    { nodeId: 'domain-a', canonicalName: 'A', centroidRowIndex: 0 },
    { nodeId: 'domain-b', canonicalName: 'B', centroidRowIndex: 1 },
  ],
  leafTopics: [
    { nodeId: 'leaf-a', canonicalName: 'Leaf A', broadDomain: 'A', crossLinkDomains: [], centroidRowIndex: 2 },
    { nodeId: 'leaf-b', canonicalName: 'Leaf B', broadDomain: 'B', crossLinkDomains: [], centroidRowIndex: 3 },
  ],
  queries: [
    {
      queryId: 'query-a',
      seedId: 'seed-a',
      text: 'alpha',
      leafNodeId: 'leaf-a',
      leafName: 'Leaf A',
      broadDomain: 'A',
      crossLinkDomains: [],
      rowIndex: 4,
      provenance: 'test',
      enabled: true,
    },
    {
      queryId: 'query-b',
      seedId: 'seed-b',
      text: 'beta',
      leafNodeId: 'leaf-b',
      leafName: 'Leaf B',
      broadDomain: 'B',
      crossLinkDomains: [],
      rowIndex: 5,
      provenance: 'test',
      enabled: true,
    },
  ],
};

const embeddings = new Int8Array([
  127, 0,
  0, 127,
  127, 0,
  0, 127,
  127, 0,
  0, 127,
]);

test('topic graph routing follows semantic geometry deterministically', () => {
  const routed = routeTopicGraphV1([1, 0], graph, embeddings, { topKQueries: 2 });
  assert.equal(routed[0].queryId, 'query-a');
  assert.equal(routed[0].seedId, 'seed-a');
  assert.ok(routed[0].semanticScore > routed[1].semanticScore);
});

test('topic graph broad-domain hint breaks an equal-semantic tie', () => {
  const routed = routeTopicGraphV1([1, 1], graph, embeddings, {
    hintDomains: ['B'],
    topKQueries: 2,
  });
  assert.equal(routed[0].queryId, 'query-b');
  assert.ok(routed[0].finalScore > routed[1].finalScore);
});

test('topic leaf routing fuses leaf, query and branch evidence', () => {
  const leaves = routeTopicLeavesV1([1, 0], graph, embeddings, 2);
  assert.equal(leaves[0].nodeId, 'leaf-a');
  assert.ok(leaves[0].centroidScore > leaves[1].centroidScore);
  assert.ok(leaves[0].queryEvidenceScore > leaves[1].queryEvidenceScore);
  assert.ok(leaves[0].score > leaves[1].score);
});

test('topic graph never returns disabled query rows', () => {
  const disabledGraph: SearchTopicGraphCompactV1 = {
    ...graph,
    queries: graph.queries.map((query) => query.queryId === 'query-a' ? { ...query, enabled: false } : query),
  };
  const routed = routeTopicGraphV1([1, 0], disabledGraph, embeddings, { topKQueries: 2 });
  assert.deepEqual(routed.map((row) => row.queryId), ['query-b']);
});
