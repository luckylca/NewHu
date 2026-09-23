export type BadgeColors = {
    background: string;
    foreground: string;
    border: string;
};

const LIGHT_BADGE_PALETTE: BadgeColors[] = [
    { background: '#FDE8E7', foreground: '#B42318', border: '#F7B7B2' },
    { background: '#FFF0E0', foreground: '#B54708', border: '#F6C48A' },
    { background: '#FFF6CC', foreground: '#8A6100', border: '#EACF63' },
    { background: '#E3F7E8', foreground: '#18743D', border: '#9FD8AD' },
    { background: '#DCF7F3', foreground: '#0F766E', border: '#93D9D0' },
    { background: '#E1F4FF', foreground: '#0369A1', border: '#9BD3F1' },
    { background: '#F0E7FF', foreground: '#6D28D9', border: '#CDB7F6' },
    { background: '#FCE7F3', foreground: '#BE185D', border: '#F4B3D1' },
];

const DARK_BADGE_PALETTE: BadgeColors[] = [
    { background: '#4A1D1B', foreground: '#FFB4AB', border: '#7A322D' },
    { background: '#4A2A12', foreground: '#FFC182', border: '#79501F' },
    { background: '#453A0A', foreground: '#FFE082', border: '#75651B' },
    { background: '#173A25', foreground: '#8EE3A8', border: '#2D6740' },
    { background: '#123B38', foreground: '#83E4D8', border: '#266763' },
    { background: '#12384A', foreground: '#8BD7FF', border: '#275E77' },
    { background: '#2F214A', foreground: '#D5BAFF', border: '#584282' },
    { background: '#451C35', foreground: '#FFB2D4', border: '#75345B' },
];

export function badgeColorSeed(value: string) {
    let hash = 2166136261;
    for (const char of value) {
        hash ^= char.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function getDistinctBadgePalette(dark: boolean) {
    return dark ? DARK_BADGE_PALETTE : LIGHT_BADGE_PALETTE;
}

export function getBadgeColors(
    key: string,
    dark: boolean,
    offset = 0,
): BadgeColors {
    const palette = getDistinctBadgePalette(dark);
    return palette[(badgeColorSeed(key) + offset) % palette.length];
}

export function getBadgeColorsByIndex(index: number, dark: boolean) {
    const palette = getDistinctBadgePalette(dark);
    return palette[((index % palette.length) + palette.length) % palette.length];
}
