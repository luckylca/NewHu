import assert from 'node:assert/strict';
import test from 'node:test';
import { getCookieValue, hasCookie } from '../../src/utils/cookieHeader';

test('cookie header parser matches an exact cookie name', () => {
  const header = 'd_c0=abc; z_c0=2|token==; q_c1=value';
  assert.equal(getCookieValue(header, 'z_c0'), '2|token==');
  assert.equal(hasCookie(header, 'z_c0'), true);
  assert.equal(hasCookie(header, 'c0'), false);
});

test('cookie header parser accepts empty values but rejects malformed names', () => {
  assert.equal(getCookieValue('z_c0=; foo=bar', 'z_c0'), '');
  assert.equal(getCookieValue('foo=bar', 'foo bar'), null);
  assert.equal(getCookieValue('foo=bar', ''), null);
});
