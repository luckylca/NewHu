import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { TaidTfidfModel } from '../../src/services/aiTextDetectorCore';

type GoldenVector = {
    id: string;
    text: string;
    expected_logit: number;
    expected_probability: number;
};

type GoldenFile = {
    entry_count: number;
    max_code_points: number;
    tolerance_abs_probability: number;
    vectors: GoldenVector[];
};

const root = process.cwd();
const modelBytes = new Uint8Array(readFileSync(path.join(root, 'assets/ai-detector/tfidf_opening_192_plus_nlpcc.taid')));
const golden = JSON.parse(readFileSync(path.join(root, 'tests/fixtures/ai-detector-golden-vectors.json'), 'utf8')) as GoldenFile;
const model = TaidTfidfModel.fromBytes(modelBytes);

test('TAIDTF1 bundled AI detector header matches the frozen handoff', () => {
    assert.equal(model.entryCount, golden.entry_count);
    assert.equal(model.maxCodePoints, golden.max_code_points);
});

for (const vector of golden.vectors) {
    test(`TAIDTF1 golden vector: ${vector.id}`, () => {
        const logit = model.decisionFunction(vector.text);
        const score = model.predictScore(vector.text);
        assert.ok(Math.abs(logit - vector.expected_logit) <= 1e-5, `logit mismatch: ${logit}`);
        assert.ok(
            Math.abs(score - vector.expected_probability) <= golden.tolerance_abs_probability,
            `score mismatch: ${score}`,
        );
    });
}
