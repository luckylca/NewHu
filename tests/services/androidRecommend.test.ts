import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeAndroidRecommendItem } from '../../src/services/androidRecommendService';
import { fetchRecommendationSourcePage, mergeRecommendationSourceItems } from '../../src/services/candidateSourceService';
import type { FeedItemInfo } from '../../src/types/zhihu';

const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'android-recommend.json'), 'utf8')) as { data: any[] };

test('Android ComponentCard fixture normalizes answer, article and question targets', () => {
  const items = fixture.data.map(normalizeAndroidRecommendItem).filter((item): item is FeedItemInfo => item !== null);
  assert.equal(items.length, 3);

  const [answer, article, question] = items;
  assert.equal(answer.feedType, 'answer');
  assert.equal(answer.item.id, '101');
  assert.equal(answer.item.questionId, '201');
  assert.equal(answer.item.title, 'Sanitized answer title');
  assert.equal(answer.item.excerpt, 'Sanitized answer excerpt');
  assert.equal(answer.item.authorName, 'Fixture author');
  assert.equal(answer.item.voteCount, 12);
  assert.deepEqual(answer.candidateSources, ['android_recommend']);

  assert.equal(article.feedType, 'article');
  assert.equal(article.item.id, 'p-301');
  assert.equal(article.item.title, 'Sanitized article title');
  assert.equal(article.item.voteCount, 0);
  assert.equal(article.item.authorName, '匿名用户');

  assert.equal(question.feedType, 'question');
  assert.equal(question.item.id, '401');
  assert.equal(question.item.questionId, '401');
  assert.equal(question.item.title, 'Sanitized question title');
});

test('Android normalizer safely drops unknown card types and unsupported route kinds', () => {
  assert.equal(normalizeAndroidRecommendItem(fixture.data[3]), null);
  assert.equal(normalizeAndroidRecommendItem(fixture.data[4]), null);
  assert.equal(normalizeAndroidRecommendItem({ type: 'ComponentCard', action: { parameter: 'invalid' }, children: [] }), null);
});

test('same answer from Web and Android deduplicates by content ID and retains both origins', () => {
  const android = normalizeAndroidRecommendItem(fixture.data[0])!;
  const web: FeedItemInfo = {
    ...android,
    candidateSources: ['web_recommend'],
    item: { ...android.item, excerpt: 'A richer Web excerpt', content: '<p>body</p>' },
  };
  const result = mergeRecommendationSourceItems([web, android]);

  assert.equal(result.items.length, 1);
  assert.equal(result.duplicateCount, 1);
  assert.deepEqual(result.items[0].candidateSources, ['web_recommend', 'android_recommend']);
  assert.equal(result.items[0].item.content, '<p>body</p>');
});

test('Mixed candidate acquisition continues with Web when Android fails', async () => {
  const expected: FeedItemInfo = {
    ...normalizeAndroidRecommendItem(fixture.data[0])!,
    candidateSources: ['web_recommend'],
  };
  const result = await fetchRecommendationSourcePage({
    mode: 'mixed',
    webCursor: '',
    androidCursor: '',
    fetchWeb: async () => ({ data: [{ target: { type: 'answer' } }], paging: { next: 'https://www.zhihu.com/web-next' } }),
    fetchAndroid: async () => { throw Object.assign(new Error('blocked'), { status: 403 }); },
    normalizeWebItem: () => expected,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.webNormalizedCount, 1);
  assert.equal(result.androidError?.status, 403);
  assert.equal(result.nextWebCursor, 'https://www.zhihu.com/web-next');
});

test('Android-only candidate acquisition falls back to Web on Android failure', async () => {
  const expected: FeedItemInfo = {
    ...normalizeAndroidRecommendItem(fixture.data[1])!,
    candidateSources: ['web_recommend'],
  };
  let webCalls = 0;
  const result = await fetchRecommendationSourcePage({
    mode: 'android',
    webCursor: '',
    androidCursor: '',
    fetchWeb: async () => {
      webCalls += 1;
      return { data: [{ target: { type: 'article' } }], paging: { next: '' } };
    },
    fetchAndroid: async () => { throw Object.assign(new Error('unavailable'), { status: 401 }); },
    normalizeWebItem: () => expected,
  });

  assert.equal(webCalls, 1);
  assert.equal(result.items[0].candidateSources?.[0], 'web_recommend');
  assert.equal(result.androidError?.status, 401);
});
