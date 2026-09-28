import assert from 'node:assert/strict';
import test from 'node:test';
import { AndroidHttpError, AndroidZhihuClient, createAndroidHeaders } from '../../src/api/android/androidClient';
import { generateSignature } from '../../src/api/crypto';

const cookie = 'z_c0=login-cookie; d_c0=device-cookie; SESSIONID=session-value; JOID=user-value; _xsrf=xsrf-value';

test('Web and Android transports preserve the same full Cookie string', () => {
  const webHeaders = generateSignature('https://www.zhihu.com/api/v4/me', cookie).headers;
  const androidHeaders = createAndroidHeaders(cookie);

  assert.equal(webHeaders.cookie, cookie);
  assert.equal(androidHeaders.cookie, cookie);
  assert.equal(androidHeaders['x-xsrftoken'], 'xsrf-value');
  assert.match(androidHeaders.cookie, /z_c0=login-cookie/);
  assert.match(androidHeaders.cookie, /d_c0=device-cookie/);
  assert.match(androidHeaders.cookie, /SESSIONID=session-value/);
  assert.match(androidHeaders.cookie, /JOID=user-value/);
});

test('Android headers use the independently sourced Android transport and never Web signatures', () => {
  const headers = createAndroidHeaders(cookie);
  assert.match(headers['user-agent'], /^com\.zhihu\.android\//);
  assert.equal(headers['x-api-version'], '3.0.93');
  assert.equal(headers['x-app-version'], '10.100.0');
  assert.match(headers['x-app-za'], /^OS=Android&/);
  assert.equal(headers['x-page-id'], '132');
  assert.equal(headers['x-app-bundleid'], 'com.zhihu.android');
  assert.equal(headers['x-app-flavor'], 'zhihuwap64');
  assert.equal(headers['x-app-build'], 'release');
  assert.equal(headers['x-network-type'], '3G');
  assert.equal(headers['x-zse-96'], undefined);
});

test('Android recommendation uses api.zhihu.com and the returned full paging URL', async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ data: [], paging: { next: '', is_end: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }) as typeof fetch;
  console.info = () => undefined;
  try {
    const client = new AndroidZhihuClient(cookie);
    const result = await client.getRecommend('https://api.zhihu.com/topstory/recommend?offset=next-offset');
    assert.equal(requestUrl, 'https://api.zhihu.com/topstory/recommend?offset=next-offset');
    assert.equal(requestInit?.method, 'GET');
    assert.equal(requestInit?.credentials, 'omit');
    assert.equal((requestInit?.headers as Record<string, string>).cookie, cookie);
    assert.equal(result.status, 200);
    assert.match(result.contentType, /^application\/json/);
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
  }
});

test('anonymous Android recommendation omits Cookie even when the shared client has a login', async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  let requestHeaders: Record<string, string> = {};
  globalThis.fetch = (async (_input, init) => {
    requestHeaders = init?.headers as Record<string, string>;
    return new Response(JSON.stringify({ data: [], paging: { next: '', is_end: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  console.info = () => undefined;
  try {
    await new AndroidZhihuClient(cookie).getRecommend('', { anonymous: true });
    assert.equal(Object.hasOwn(requestHeaders, 'cookie'), false);
    assert.match(requestHeaders['user-agent'], /^com\.zhihu\.android\//);
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
  }
});

test('Android rejects an unexpected pagination host without making a request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('fetch should not be called'); }) as typeof fetch;
  try {
    const client = new AndroidZhihuClient(cookie);
    await assert.rejects(client.getRecommend('https://example.com/topstory/recommend?offset=1'), /分页地址无效/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Android 403 does not mutate the Web transport and keeps status without exposing body', async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => undefined;
  globalThis.fetch = (async () => new Response('private service response', { status: 403 })) as typeof fetch;
  try {
    const client = new AndroidZhihuClient(cookie);
    await assert.rejects(client.getRecommend(), (error: unknown) => error instanceof AndroidHttpError && error.status === 403);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
