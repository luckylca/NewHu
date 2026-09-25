import assert from 'node:assert/strict';
import test from 'node:test';
import golden from '../../assets/semantic-v2/tokenizer_golden_v30.json';
import { tokenizeSemanticV2 } from '../../src/semantic-v2/tokenizer';

test('Semantic V2 tokenizer matches all frozen mobile64 golden samples', () => {
  assert.equal(golden.sampleCount, golden.samples.length);
  for (const sample of golden.samples) {
    const actual = tokenizeSemanticV2(sample.text);
    assert.deepEqual(Array.from(actual.inputIds, Number), sample.expectedInputIds, sample.text);
    assert.deepEqual(Array.from(actual.attentionMask, Number), sample.expectedAttentionMask, sample.text);
    assert.equal(actual.tokenCount, sample.tokenCount, sample.text);
  }
});
