import { strict as assert } from 'node:assert';
import test from 'node:test';
import ZhihuClient, { HttpError } from '../../src/api/client';

const COOKIE = 'd_c0=test-device; z_c0=test-session';
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;

test.beforeEach(() => {
    console.error = () => undefined;
});

test.afterEach(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
});

test('POST rejects a JSON 503 response instead of treating it as success', async () => {
    globalThis.fetch = async () => new Response(
        JSON.stringify({ error: { message: 'service busy' } }),
        { status: 503 },
    );
    const client = new ZhihuClient(COOKIE);

    await assert.rejects(
        client.post('https://www.zhihu.com/api/v4/comments', { content: 'test' }, true),
        (error: unknown) => error instanceof HttpError
            && error.status === 503
            && error.message === 'service busy',
    );
});

test('GET rejects rate limits with a retryable HTTP status', async () => {
    globalThis.fetch = async () => new Response('', { status: 429 });
    const client = new ZhihuClient(COOKIE);

    await assert.rejects(
        client.get('https://www.zhihu.com/api/v4/me'),
        (error: unknown) => error instanceof HttpError
            && error.status === 429
            && error.message.includes('频繁'),
    );
});

test('400 responses preserve the service error message', async () => {
    globalThis.fetch = async () => new Response(
        JSON.stringify({ error: { message: '评论内容不能为空' } }),
        { status: 400 },
    );
    const client = new ZhihuClient(COOKIE);

    await assert.rejects(
        client.post('https://www.zhihu.com/api/v4/comments', {}, true),
        (error: unknown) => error instanceof HttpError
            && error.status === 400
            && error.message === '评论内容不能为空',
    );
});
