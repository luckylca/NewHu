import assert from 'node:assert/strict';
import test from 'node:test';
import {
    COMMENT_REPLY_ASSIST_PRESETS,
    insertTextAtSelection,
    normalizeTextSelection,
} from '../../src/utils/commentReplyAssist';

test('reply assist inserts at the current cursor instead of appending', () => {
    assert.deepEqual(
        insertTextAtSelection('前后', '[赞]', { start: 1, end: 1 }),
        {
            content: '前[赞]后',
            selection: { start: 4, end: 4 },
        },
    );
});

test('reply assist replaces the current selection and moves the caret after insertion', () => {
    assert.deepEqual(
        insertTextAtSelection('abcdef', 'XYZ', { start: 2, end: 5 }),
        {
            content: 'abXYZf',
            selection: { start: 5, end: 5 },
        },
    );
});

test('reply assist normalizes reversed and out-of-range selections safely', () => {
    assert.deepEqual(
        normalizeTextSelection({ start: 99, end: -4 }, 6),
        { start: 0, end: 6 },
    );
    assert.deepEqual(
        insertTextAtSelection('abc', '!', undefined),
        {
            content: 'abc!',
            selection: { start: 4, end: 4 },
        },
    );
});

test('reply assist presets cover acknowledgement, evidence and clarification intents', () => {
    const ids = new Set(COMMENT_REPLY_ASSIST_PRESETS.map((preset) => preset.id));
    assert.ok(ids.has('thanks'));
    assert.ok(ids.has('source'));
    assert.ok(ids.has('clarify'));
    assert.ok(ids.has('nuance'));
    assert.ok(COMMENT_REPLY_ASSIST_PRESETS.every((preset) => preset.text.trim().length > 0));
});
