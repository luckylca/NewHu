import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatLaterReadProgress,
    sortLaterReadItems,
} from '../../src/utils/laterRead';
import type { LaterReadItem } from '../../src/stores/useLaterReadStore';

const items: LaterReadItem[] = [
    {
        key: 'answer:1',
        id: '1',
        type: 'answer',
        title: 'Beta',
        summary: '',
        authorName: 'A',
        addedAt: 100,
    },
    {
        key: 'article:2',
        id: '2',
        type: 'article',
        title: 'Alpha',
        summary: '',
        authorName: 'B',
        addedAt: 200,
    },
    {
        key: 'answer:3',
        id: '3',
        type: 'answer',
        title: 'Gamma',
        summary: '',
        authorName: 'C',
        addedAt: 300,
    },
];

test('later read sorting supports newest, oldest and title modes', () => {
    assert.deepEqual(
        sortLaterReadItems(items, 'added_desc', {}).map((item) => item.id),
        ['3', '2', '1'],
    );
    assert.deepEqual(
        sortLaterReadItems(items, 'added_asc', {}).map((item) => item.id),
        ['1', '2', '3'],
    );
    assert.deepEqual(
        sortLaterReadItems(items, 'title', {}).map((item) => item.id),
        ['2', '1', '3'],
    );
});

test('later read unread-first sorting keeps newer items first inside each group', () => {
    const states = {
        'answer:1': { completed: true, progress: 1, offline: false },
        'article:2': { completed: false, progress: 0.4, offline: false },
        'answer:3': { completed: false, progress: 0, offline: true },
    };
    assert.deepEqual(
        sortLaterReadItems(items, 'unread_first', states).map((item) => item.id),
        ['3', '2', '1'],
    );
});

test('later read progress labels distinguish unread, in-progress and completed', () => {
    assert.equal(formatLaterReadProgress(), '未读');
    assert.equal(formatLaterReadProgress({ completed: false, progress: 0, offline: false }), '未读');
    assert.equal(formatLaterReadProgress({ completed: false, progress: 0.421, offline: false }), '阅读 42%');
    assert.equal(formatLaterReadProgress({ completed: true, progress: 1, offline: true }), '已读完');
});
