import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveInputPresentation } from '../../src/ui/inputPresentation';

test('labelled input never overlaps its label with helper placeholder', () => {
    assert.deepEqual(
        resolveInputPresentation({
            hasLabel: true,
            useLabelAsPlaceholder: false,
            hasText: false,
            focused: false,
            placeholder: 'https://api.example.com/v1',
        }),
        {
            labelVisible: true,
            floating: false,
            placeholder: undefined,
        },
    );

    assert.deepEqual(
        resolveInputPresentation({
            hasLabel: true,
            useLabelAsPlaceholder: false,
            hasText: false,
            focused: true,
            placeholder: 'https://api.example.com/v1',
        }),
        {
            labelVisible: true,
            floating: true,
            placeholder: 'https://api.example.com/v1',
        },
    );
});

test('label stays floating for entered text and plain inputs keep their placeholder', () => {
    assert.deepEqual(
        resolveInputPresentation({
            hasLabel: true,
            useLabelAsPlaceholder: false,
            hasText: true,
            focused: false,
            placeholder: 'sk-…',
        }),
        {
            labelVisible: true,
            floating: true,
            placeholder: undefined,
        },
    );

    assert.deepEqual(
        resolveInputPresentation({
            hasLabel: false,
            useLabelAsPlaceholder: false,
            hasText: false,
            focused: false,
            placeholder: '搜索',
        }),
        {
            labelVisible: false,
            floating: false,
            placeholder: '搜索',
        },
    );
});

test('placeholder-label mode hides its label only after text exists', () => {
    assert.deepEqual(
        resolveInputPresentation({
            hasLabel: true,
            useLabelAsPlaceholder: true,
            hasText: false,
            focused: true,
            placeholder: 'secondary hint',
        }),
        {
            labelVisible: true,
            floating: false,
            placeholder: undefined,
        },
    );

    assert.equal(
        resolveInputPresentation({
            hasLabel: true,
            useLabelAsPlaceholder: true,
            hasText: true,
            focused: false,
            placeholder: 'secondary hint',
        }).labelVisible,
        false,
    );
});
