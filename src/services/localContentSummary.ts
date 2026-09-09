export type LocalContentSummary = {
    headings: string[];
    keywords: string[];
    coreSentences: string[];
    textLength: number;
};

const BLOCK_END_RE = /<\/(?:p|div|li|blockquote|section|article|h[1-6]|tr)>/gi;
const TAG_RE = /<[^>]*>/g;
const SCRIPT_STYLE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

const COMMON_CN = new Set([
    '我们', '你们', '他们', '这个', '那个', '一个', '一些', '这种', '这样',
    '以及', '因为', '所以', '但是', '如果', '那么', '对于', '通过', '进行',
    '可以', '可能', '需要', '已经', '没有', '不是', '就是', '还是', '非常',
    '比较', '很多', '时候', '问题', '内容', '文章', '回答', '作者', '认为',
    '觉得', '自己', '相关', '方面', '其中', '目前', '同时', '之后', '之前',
    '这里', '其实', '应该', '能够', '为了', '由于', '而且', '或者', '并且',
    '只是', '并不', '然后', '什么', '怎么', '如何',
]);

const COMMON_EN = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were',
    'have', 'has', 'but', 'not', 'you', 'your', 'our', 'their', 'into', 'about',
    'can', 'will', 'would', 'should', 'could',
]);

const CN_SPLIT_RE = /(我们|你们|他们|这个|那个|一个|一些|这种|这样|以及|因为|所以|但是|如果|那么|对于|通过|进行|可以|可能|需要|已经|没有|不是|就是|还是|非常|比较|很多|时候|问题|内容|文章|回答|作者|认为|觉得|自己|相关|方面|其中|目前|同时|之后|之前|这里|其实|应该|能够|为了|由于|而且|或者|并且|只是|并不|然后|什么|怎么|如何)/g;

function decodeHtmlEntities(value: string) {
    return value
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
            const codePoint = Number.parseInt(hex, 16);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : '';
        })
        .replace(/&#(\d+);/g, (_, decimal: string) => {
            const codePoint = Number.parseInt(decimal, 10);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : '';
        });
}

function cleanInlineHtml(value: string) {
    return decodeHtmlEntities(value.replace(TAG_RE, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

export function extractLocalHeadings(html: string, title = '') {
    const result: string[] = [];
    const seen = new Set<string>();
    const normalizedTitle = title.trim().replace(/\s+/g, ' ');
    const re = /<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) != null) {
        const heading = cleanInlineHtml(match[2]).slice(0, 120);
        if (!heading || heading === normalizedTitle || seen.has(heading)) continue;
        seen.add(heading);
        result.push(heading);
        if (result.length >= 8) break;
    }
    return result;
}

export function localHtmlToPlainText(html: string) {
    return decodeHtmlEntities(
        html
            .replace(SCRIPT_STYLE_RE, ' ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(BLOCK_END_RE, '\n')
            .replace(TAG_RE, ' '),
    )
        .replace(/[ \t\f\v]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function splitSentences(text: string) {
    return text
        .replace(/([。！？!?；;])/g, '$1\n')
        .split(/\n+/g)
        .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
        .filter((sentence) => sentence.length >= 10 && sentence.length <= 220);
}

type KeywordCandidate = {
    term: string;
    score: number;
    firstIndex: number;
    occurrences: number;
    maxBoost: number;
};

function addCandidate(
    map: Map<string, KeywordCandidate>,
    term: string,
    score: number,
    index: number,
) {
    const normalized = term.trim();
    if (normalized.length < 2 || normalized.length > 24) return;
    if (COMMON_CN.has(normalized) || COMMON_EN.has(normalized.toLowerCase())) return;
    const key = /^[A-Za-z]/.test(normalized) ? normalized.toLowerCase() : normalized;
    const current = map.get(key);
    if (current) {
        current.score += score;
        current.firstIndex = Math.min(current.firstIndex, index);
        current.occurrences += 1;
        current.maxBoost = Math.max(current.maxBoost, score);
        return;
    }
    map.set(key, {
        term: normalized,
        score,
        firstIndex: index,
        occurrences: 1,
        maxBoost: score,
    });
}

function collectKeywordCandidates(
    text: string,
    map: Map<string, KeywordCandidate>,
    boost: number,
) {
    const english = text.match(/[A-Za-z][A-Za-z0-9.+#_-]{2,}/g) ?? [];
    english.forEach((word, index) => {
        if (!COMMON_EN.has(word.toLowerCase())) addCandidate(map, word, 1.2 * boost, index);
    });

    const runs = text.match(/[\u3400-\u9fff]{2,}/g) ?? [];
    let globalIndex = 0;
    for (const run of runs) {
        const segments = run.replace(CN_SPLIT_RE, ' ').split(/\s+/g).filter(Boolean);
        for (const segment of segments) {
            if (segment.length >= 2 && segment.length <= 6) {
                addCandidate(map, segment, 1.8 * boost, globalIndex);
            } else if (segment.length > 6) {
                for (let size = 2; size <= 4; size += 1) {
                    for (let offset = 0; offset <= segment.length - size; offset += 1) {
                        addCandidate(
                            map,
                            segment.slice(offset, offset + size),
                            (0.75 + size * 0.22) * boost,
                            globalIndex + offset,
                        );
                    }
                }
            }
            globalIndex += segment.length + 1;
        }
    }
}

export function extractLocalKeywords(text: string, title = '', limit = 8) {
    const candidates = new Map<string, KeywordCandidate>();
    collectKeywordCandidates(text, candidates, 1);
    if (title.trim()) collectKeywordCandidates(title, candidates, 2.8);

    const sorted = [...candidates.values()]
        .filter((candidate) => (
            /^[A-Za-z]/.test(candidate.term)
            || candidate.occurrences >= 2
            || candidate.maxBoost >= 2.5
        ))
        .sort((a, b) => (
            b.score - a.score
            || b.term.length - a.term.length
            || a.firstIndex - b.firstIndex
            || a.term.localeCompare(b.term)
        ));

    const result: string[] = [];
    for (const candidate of sorted) {
        if (result.some((selected) => (
            selected.length >= candidate.term.length
            && selected.includes(candidate.term)
        ))) continue;
        result.push(candidate.term);
        if (result.length >= limit) break;
    }
    return result;
}

function escapeRegExp(value: string) {
    return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function extractCoreSentences(
    text: string,
    keywords: string[],
    limit = 3,
) {
    const sentences = splitSentences(text);
    if (!sentences.length) return [];

    const scored = sentences.map((sentence, index) => {
        let score = Math.max(0, 2.2 - index * 0.12);
        if (sentence.length >= 24 && sentence.length <= 110) score += 2;
        else if (sentence.length <= 160) score += 0.8;
        if (/\d|%|％|研究|数据|结果|结论|因此|意味着|表明/.test(sentence)) score += 0.8;

        for (const keyword of keywords) {
            const matches = sentence.match(new RegExp(escapeRegExp(keyword), 'gi'));
            if (matches?.length) score += matches.length * (1.2 + Math.min(2, keyword.length * 0.18));
        }
        return { sentence, index, score };
    });

    return scored
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, limit)
        .sort((a, b) => a.index - b.index)
        .map((item) => item.sentence);
}

export function buildLocalContentSummary(
    html: string,
    title = '',
): LocalContentSummary {
    const text = localHtmlToPlainText(html);
    const headings = extractLocalHeadings(html, title);
    const keywordContext = [title, ...headings].filter(Boolean).join(' ');
    const keywords = extractLocalKeywords(text, keywordContext, 8);
    return {
        headings,
        keywords,
        coreSentences: extractCoreSentences(text, keywords, 3),
        textLength: text.length,
    };
}
