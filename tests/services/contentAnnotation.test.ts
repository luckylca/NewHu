import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getContentSourceUrl,
    normalizeAnnotationSelection,
} from '../../src/utils/contentAnnotation';

test('content annotation builds canonical source links when question id is available', () => {
    assert.equal(
        getContentSourceUrl('answer', '456', '123'),
        'https://www.zhihu.com/question/123/answer/456',
    );
    assert.equal(
        getContentSourceUrl('article', '456'),
        'https://zhuanlan.zhihu.com/p/456',
    );
});

test('content annotation clamps selection ranges to the document', () => {
    assert.deepEqual(normalizeAnnotationSelection(-5, 80, 50), { start: 0, end: 50 });
    assert.deepEqual(normalizeAnnotationSelection(10.9, 20.7, 100), { start: 10, end: 20 });
    assert.equal(normalizeAnnotationSelection(20, 10, 100), null);
    assert.equal(normalizeAnnotationSelection(Number.NaN, 10, 100), null);
});
