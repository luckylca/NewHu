import { DomUtils, parseDocument } from 'htmlparser2';

function readVideoId(value: unknown) {
    if (typeof value !== 'string' || !value) return '';
    const candidates = [value];
    try {
        candidates.push(decodeURIComponent(value));
    } catch {
        // Keep the original URL when it contains malformed escape sequences.
    }
    for (const candidate of candidates) {
        const match = candidate.match(/\/(?:video|zvideo)\/([a-z\d_-]+)/i);
        if (match?.[1]) return match[1];
    }
    return '';
}

function findPoster(node: any): string {
    if (!node || typeof node !== 'object') return '';
    if (node.name === 'img') {
        const attrs = node.attribs || {};
        return attrs['data-original'] || attrs['data-actualsrc'] || attrs['data-src'] || attrs.src || '';
    }
    for (const child of node.children || []) {
        const poster = findPoster(child);
        if (poster) return poster;
    }
    return '';
}

/** Turn Zhihu's web-only video cards into a small tag handled by the native app. */
export function normalizeZhihuVideoEmbeds(html: string) {
    try {
        const document = parseDocument(html);
        const visit = (node: any) => {
            if (!node || typeof node !== 'object') return;
            const attrs = node.attribs || {};
            const classNames = String(attrs.class || '').split(/\s+/);
            const isVideoCard = classNames.includes('video-box') || classNames.includes('zvideo');
            const isVideoElement = node.name === 'video';
            if (isVideoCard || isVideoElement) {
                const sourceNode = (node.children || []).find((child: any) => child.name === 'source');
                const directUrl = attrs.src || sourceNode?.attribs?.src || '';
                const videoId = attrs['data-lens-id']
                    || attrs['data-video-id']
                    || readVideoId(attrs.href)
                    || readVideoId(directUrl);
                if (videoId || directUrl) {
                    node.name = 'newhu-video';
                    node.attribs = {
                        'data-video-id': String(videoId || ''),
                        'data-video-src': String(directUrl || ''),
                        'data-poster': String(attrs['data-poster'] || attrs.poster || findPoster(node)),
                        'data-video-title': String(attrs['data-name'] || attrs.title || ''),
                    };
                    node.children = [];
                    return;
                }
            }
            for (const child of node.children || []) visit(child);
        };
        for (const child of document.children) visit(child);
        return DomUtils.getInnerHTML(document);
    } catch {
        return html;
    }
}

/** Extract a progressive MP4 URL from the shape returned by play_info. */
export function extractZhihuMp4Url(response: unknown) {
    const payload = response as any;
    const mp4 = payload?.video_play?.playlist?.mp4
        ?? payload?.playlist?.mp4
        ?? payload?.video?.playlist?.mp4;
    const urls: string[] = [];
    const visit = (value: any) => {
        if (typeof value === 'string') {
            if (/^https?:\/\//i.test(value)) urls.push(value);
            return;
        }
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (!value || typeof value !== 'object') return;
        for (const key of ['url', 'play_url', 'src', 'url_list']) {
            if (key in value) visit(value[key]);
        }
        for (const [key, child] of Object.entries(value)) {
            if (!['url', 'play_url', 'src', 'url_list'].includes(key)) visit(child);
        }
    };
    visit(mp4);
    return urls.find((url) => /\.mp4(?:[?#]|$)/i.test(url)) || urls[0] || '';
}
