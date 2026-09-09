import type { LocalSearchSource } from '@/src/types/localSearch';

const SOURCE_ORDER: LocalSearchSource[] = [
    'favorite',
    'offline',
    'later',
    'read',
    'annotation',
    'knowledge',
    'draft',
];

export function normalizeLocalSearchTerms(query: string) {
    return String(query || '')
        .normalize('NFKC')
        .trim()
        .split(/[\s,，;；]+/g)
        .map((term) => term.trim())
        .filter(Boolean)
        .filter((term, index, all) => all.findIndex((item) => item.toLocaleLowerCase() === term.toLocaleLowerCase()) === index)
        .slice(0, 8);
}

function normalizeComparable(value: string) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase();
}

export function localTextMatches(query: string, ...values: string[]) {
    const terms = normalizeLocalSearchTerms(query);
    if (!terms.length) return false;
    const haystack = normalizeComparable(values.join('\n'));
    return terms.every((term) => haystack.includes(normalizeComparable(term)));
}

export function scoreLocalSearchText(query: string, options: {
    title?: string;
    snippet?: string;
    author?: string;
}) {
    const terms = normalizeLocalSearchTerms(query);
    if (!terms.length) return 0;

    const title = normalizeComparable(options.title || '');
    const snippet = normalizeComparable(options.snippet || '');
    const author = normalizeComparable(options.author || '');
    const wholeQuery = normalizeComparable(query.trim());

    let score = 0;
    if (wholeQuery && title === wholeQuery) score += 180;
    else if (wholeQuery && title.includes(wholeQuery)) score += 110;
    if (wholeQuery && snippet.includes(wholeQuery)) score += 55;
    if (wholeQuery && author.includes(wholeQuery)) score += 35;

    for (const term of terms) {
        const needle = normalizeComparable(term);
        if (title.includes(needle)) score += 45;
        if (snippet.includes(needle)) score += 18;
        if (author.includes(needle)) score += 10;
    }
    return score;
}

export function buildLocalSearchSnippet(text: string, query: string, maxLength = 180) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;

    const lower = normalizeComparable(clean);
    const terms = normalizeLocalSearchTerms(query);
    let matchIndex = -1;
    for (const term of terms) {
        const index = lower.indexOf(normalizeComparable(term));
        if (index >= 0 && (matchIndex < 0 || index < matchIndex)) matchIndex = index;
    }

    if (matchIndex < 0) return `${clean.slice(0, maxLength - 1)}…`;
    const radius = Math.floor((maxLength - 2) / 2);
    const start = Math.max(0, matchIndex - radius);
    const end = Math.min(clean.length, start + maxLength - 2);
    return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`;
}

export function mergeLocalSearchSources(
    first: LocalSearchSource[],
    second: LocalSearchSource[],
) {
    const merged = new Set<LocalSearchSource>([...first, ...second]);
    return SOURCE_ORDER.filter((source) => merged.has(source));
}
