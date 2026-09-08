import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AI_TEXT_SENSITIVITY_THRESHOLDS, TaidTfidfModel } from '../../src/services/aiTextDetectorCore';

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

test('TAIDTF1 sensitivity tiers use the frozen report operating points', () => {
    assert.equal(AI_TEXT_SENSITIVITY_THRESHOLDS.conservative, 0.6648456937028345);
    assert.equal(AI_TEXT_SENSITIVITY_THRESHOLDS.balanced, 0.5137511455);
    assert.equal(AI_TEXT_SENSITIVITY_THRESHOLDS.sensitive, 0.2917528562);
});

test('TAIDTF1 sensitivity tiers relax the flagging threshold monotonically', () => {
    const { conservative, balanced, sensitive } = AI_TEXT_SENSITIVITY_THRESHOLDS;
    assert.ok(conservative > balanced, 'balanced tier must flag more than conservative');
    assert.ok(balanced > sensitive, 'sensitive tier must flag more than balanced');
});

test('TAIDTF1 golden AI vectors flag at the sensitive tier but not the conservative tier', () => {
    for (const id of ['ai_structured_intro', 'ai_polished_style']) {
        const vector = golden.vectors.find((item) => item.id === id);
        assert.ok(vector, `missing golden vector ${id}`);
        const score = model.predictScore(vector.text);
        assert.ok(score >= AI_TEXT_SENSITIVITY_THRESHOLDS.sensitive, `${id} should flag at sensitive tier: ${score}`);
        assert.ok(score < AI_TEXT_SENSITIVITY_THRESHOLDS.conservative, `${id} should stay hidden at conservative tier: ${score}`);
    }
});
