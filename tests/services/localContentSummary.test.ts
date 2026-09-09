import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildLocalContentSummary,
    extractLocalHeadings,
    localHtmlToPlainText,
} from '../../src/services/localContentSummary';

test('local summary extracts headings while removing duplicate title and inline tags', () => {
    const html = [
        '<h1>量化投资方法</h1>',
        '<h2>策略逻辑 <em>与风险</em></h2>',
        '<p>正文</p>',
        '<h3>回撤控制</h3>',
    ].join('');
    assert.deepEqual(
        extractLocalHeadings(html, '量化投资方法'),
        ['策略逻辑 与风险', '回撤控制'],
    );
});

test('local summary converts article HTML to readable local text without scripts', () => {
    const text = localHtmlToPlainText(
        '<p>第一段&nbsp;内容</p><script>bad()</script><p>第二段 &amp; 数据</p>',
    );
    assert.equal(text.includes('bad()'), false);
    assert.match(text, /第一段 内容/);
    assert.match(text, /第二段 & 数据/);
});

test('local summary returns bounded keywords and core sentences deterministically', () => {
    const html = [
        '<h2>风险控制</h2>',
        '<p>量化投资策略首先需要明确风险控制，因为风险控制决定了策略能否长期存活。</p>',
        '<p>回撤管理不是简单止损，历史数据表明合理控制仓位可以显著降低组合最大回撤。</p>',
        '<p>量化投资还需要持续验证交易成本，否则回测收益可能高估真实表现。</p>',
        '<p>因此，风险控制、回撤管理和交易成本应该一起评估，而不是只看收益率。</p>',
    ].join('');
    const first = buildLocalContentSummary(html, '量化投资策略');
    const second = buildLocalContentSummary(html, '量化投资策略');

    assert.deepEqual(first, second);
    assert.deepEqual(first.headings, ['风险控制']);
    assert.ok(first.keywords.length >= 3 && first.keywords.length <= 8);
    assert.ok(first.keywords.some((keyword) => /风险|量化|回撤/.test(keyword)));
    assert.equal(first.keywords.includes('否则回测收益'), false);
    assert.equal(first.keywords.includes('量化投资还'), false);
    assert.ok(first.coreSentences.length > 0 && first.coreSentences.length <= 3);
    assert.ok(first.coreSentences.some((sentence) => /风险控制|回撤/.test(sentence)));
    assert.ok(first.textLength > 80);
});
