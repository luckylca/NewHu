import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createReadingProgressSnapshot,
    getReadingResumeOffset,
} from '../../src/utils/readingProgress';

test('reading progress stores current and maximum ratios separately', () => {
    const snapshot = createReadingProgressSnapshot({
        scrollOffset: 400,
        contentHeight: 1000,
        viewportHeight: 200,
        previousMaxScrollRatio: 0.7,
    });
    assert.equal(snapshot.scrollRatio, 0.5);
    assert.equal(snapshot.maxScrollRatio, 0.7);
    assert.equal(snapshot.completed, false);
});

test('reading progress becomes completed near the bottom and stays completed', () => {
    const nearBottom = createReadingProgressSnapshot({
        scrollOffset: 730,
        contentHeight: 1000,
        viewportHeight: 200,
    });
    assert.equal(nearBottom.completed, true);

    const backAtTop = createReadingProgressSnapshot({
        scrollOffset: 0,
        contentHeight: 1000,
        viewportHeight: 200,
        previousMaxScrollRatio: nearBottom.maxScrollRatio,
        wasCompleted: nearBottom.completed,
    });
    assert.equal(backAtTop.completed, true);
});

test('short content that fits in the viewport is completed', () => {
    const snapshot = createReadingProgressSnapshot({
        scrollOffset: 0,
        contentHeight: 600,
        viewportHeight: 700,
    });
    assert.equal(snapshot.scrollRatio, 1);
    assert.equal(snapshot.completed, true);
});

test('resume position follows saved ratio when content height changes', () => {
    const offset = getReadingResumeOffset(
        { scrollOffset: 400, scrollRatio: 0.5, completed: false },
        1800,
        200,
    );
    assert.equal(offset, 800);
});

test('completed or barely-started content opens from the top', () => {
    assert.equal(getReadingResumeOffset(
        { scrollOffset: 700, scrollRatio: 0.9, completed: true },
        1800,
        200,
    ), 0);
    assert.equal(getReadingResumeOffset(
        { scrollOffset: 20, scrollRatio: 0.01, completed: false },
        1800,
        200,
    ), 0);
});
