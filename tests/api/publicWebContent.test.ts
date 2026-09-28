import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fetchPublicWebDetail, PublicWebContentError } from '../../src/api/web/publicContent';

const answerFixture = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'guest-web-answer.html'), 'utf8');
const articleFixture = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'guest-web-article.html'), 'utf8');

test('anonymous Web answer reader returns full public content without Cookie or Android headers', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let requestInit: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    requestedUrl = String(input);
    requestInit = init;
    return new Response(answerFixture, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }) as typeof fetch;
  try {
    const result = await fetchPublicWebDetail('answer', '9001');
    assert.equal(requestedUrl, 'https://www.zhihu.com/tardis/zm/ans/9001');
    assert.equal(requestInit?.credentials, 'omit');
    assert.deepEqual(Object.keys(requestInit?.headers ?? {}).sort(), ['accept', 'user-agent']);
    assert.equal(result.content, '<p>这是匿名可见的完整回答正文。</p>');
    assert.equal(result.questionTitle, '公开问题标题');
    assert.equal(result.authorName, '测试作者');
    assert.equal(result.voteCount, 9);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('anonymous Web article page reads its SSR article entity without Cookie', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let requestInit: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    requestedUrl = String(input);
    requestInit = init;
    return new Response(articleFixture, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }) as typeof fetch;
  try {
    const result = await fetchPublicWebDetail('article', 'article-9002');
    assert.equal(requestedUrl, 'https://zhuanlan.zhihu.com/p/article-9002');
    assert.equal(requestInit?.credentials, 'omit');
    assert.equal((requestInit?.headers as Record<string, string>).cookie, undefined);
    assert.equal(result.content, '<p>这是匿名可见的完整文章正文。</p>');
    assert.equal(result.authorUrlToken, 'article-author');
    assert.equal(result.authorAvatar, 'https://pic.example.test/article-author.jpg');
    assert.equal(result.voteCount, 12);
    assert.equal(result.favoriteCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('anonymous Web article reader keeps login-gated and paid bodies unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const gatedFixture = articleFixture.replace('"contentNeedTruncated":false', '"contentNeedTruncated":true');
  globalThis.fetch = (async () => new Response(gatedFixture, { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;
  try {
    await assert.rejects(fetchPublicWebDetail('article', 'article-9002'), PublicWebContentError);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('public Web reader rejects invalid IDs and HTTP errors without parsing response bodies', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response('blocked', { status: 403, headers: { 'content-type': 'text/html' } });
  }) as typeof fetch;
  try {
    await assert.rejects(fetchPublicWebDetail('answer', '12/3'), /ID 无效/);
    assert.equal(calls, 0);
    await assert.rejects(fetchPublicWebDetail('answer', '9001'), (error: unknown) => error instanceof PublicWebContentError && error.status === 403);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
