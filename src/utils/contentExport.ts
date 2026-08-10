import { File, Paths } from 'expo-file-system';
import { saveImageToDownloads, savePdfToDownloads, type DownloadResult } from 'expo-download-storage';

export interface ExportDocument {
    id: string;
    title: string;
    authorName: string;
    updatedTime: number;
    htmlContent: string;
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Zhihu content often wraps an image in a paragraph/figure and adds inline
 * dimensions. Those dimensions are useful in the feed, but make WebView PDF
 * layout reserve a second, empty block around the image. Keep the source and
 * let the print stylesheet use the image's natural aspect ratio instead.
 */
function normalizePrintContent(html: string) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<figure\b[^>]*>/gi, '<div class="media">')
        .replace(/<\/figure>/gi, '</div>')
        .replace(/<img\b([^>]*)>/gi, (_match, attributes: string) => {
            const source = attributes.match(/\b(?:data-original|data-actualsrc|data-src|src)\s*=\s*(['"])(.*?)\1/i)?.[2];
            if (!source || /^data:image\/svg/i.test(source)) return '';
            const cleanAttributes = attributes
                .replace(/\s(?:data-original|data-actualsrc|data-src|src)\s*=\s*(['"])[\s\S]*?\1/gi, '')
                .replace(/\s(?:width|height)\s*=\s*(['"])[\s\S]*?\1/gi, '')
                .replace(/\sstyle\s*=\s*(['"])[\s\S]*?\1/gi, '')
                .replace(/\s*\/?\s*$/, '')
                .trim();
            return `<img src="${escapeHtml(source)}"${cleanAttributes ? ` ${cleanAttributes}` : ''} />`;
        })
        .replace(/<p\b[^>]*>\s*(<img\b[^>]*\/?>)\s*<\/p>/gi, '<div class="media">$1</div>')
        .replace(/<div class="media">\s*<div class="media">([\s\S]*?)<\/div>\s*<\/div>/gi, '<div class="media">$1</div>');
}

function decodeHtmlEntities(value: string) {
    return value
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
        .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

export function htmlToPlainText(html: string) {
    return decodeHtmlEntities(
        html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<img\b[^>]*>/gi, '\n[图片]\n')
            .replace(/<br\s*\/?>(?=\s*)/gi, '\n')
            .replace(/<\/(p|div|li|blockquote|pre|h[1-6]|figure|ul|ol)>/gi, '\n\n')
            .replace(/<li[^>]*>/gi, '• ')
            .replace(/<[^>]+>/g, '')
    )
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function buildPrintHtml(document: ExportDocument) {
    const date = document.updatedTime
        ? new Date(document.updatedTime * 1000).toLocaleString()
        : '';
    const safeContent = normalizePrintContent(document.htmlContent);
    return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
* { box-sizing: border-box; }
@page { margin: 18px 20px; }
body { color: #1c1c1e; font-family: -apple-system, BlinkMacSystemFont, "Noto Sans CJK SC", sans-serif; font-size: 16px; line-height: 1.7; margin: 0; padding: 0; }
h1 { font-size: 25px; line-height: 1.35; margin: 0 0 8px; }
.meta { color: #777b86; font-size: 13px; margin: 0 0 16px; }
.article-content > * { min-height: 0 !important; height: auto !important; }
.article-content p, .article-content > div, .article-content figure { margin: 0 0 10px !important; padding: 0 !important; min-height: 0 !important; height: auto !important; }
.article-content .media { display: block; margin: 0 0 10px !important; padding: 0 !important; height: auto !important; min-height: 0 !important; line-height: 0 !important; page-break-inside: avoid; }
.article-content .media img, .article-content img { display: block; width: auto !important; max-width: 100% !important; height: auto !important; min-height: 0 !important; margin: 0 auto !important; padding: 0 !important; vertical-align: top; }
.article-content p:has(img) { margin: 0 0 10px !important; line-height: 0 !important; }
.article-content p:empty, .article-content div:empty { display: none; }
blockquote { border-left: 3px solid #d5d9e2; color: #5f6470; margin: 0 0 12px; padding-left: 14px; }
pre { background: #f3f4f7; padding: 12px; white-space: pre-wrap; margin: 0 0 12px; }
</style></head><body>
<h1>${escapeHtml(document.title)}</h1>
<div class="meta">${escapeHtml(document.authorName)}${date ? ` · ${escapeHtml(date)}` : ''}</div>
<div class="article-content">${safeContent}</div>
</body></html>`;
}

function fileStem(title: string, id: string) {
    const safeTitle = title.replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim().slice(0, 56) || '知乎内容';
    return `${safeTitle}-${id}-${Date.now()}`;
}

export async function exportPdf(document: ExportDocument): Promise<DownloadResult> {
    const printModule = await import('expo-print');
    const printed = await printModule.printToFileAsync({
        html: buildPrintHtml(document),
    });
    if (!printed.uri) throw new Error('PDF 生成失败，没有得到临时文件');

    return savePdfToDownloads(printed.uri, `${fileStem(document.title, document.id)}.pdf`);
}

function imageExtension(sourceUri: string) {
    const extension = sourceUri.split(/[?#]/)[0].match(/\.([a-z\d]{2,5})$/i)?.[1]?.toLowerCase();
    return extension === 'png' || extension === 'webp' || extension === 'jpeg' || extension === 'jpg'
        ? `.${extension === 'jpeg' ? 'jpg' : extension}`
        : '.jpg';
}

export async function exportImage(sourceUri: string, sourceName?: string): Promise<DownloadResult> {
    const extension = imageExtension(sourceName || sourceUri);
    const fileName = `newhu-image-${Date.now()}${extension}`;
    let localFile: { uri: string; exists: boolean; delete: () => void } | null = null;
    try {
        if (/^https?:\/\//i.test(sourceUri)) {
            const downloaded = await File.downloadFileAsync(sourceUri, new File(Paths.cache, fileName), { idempotent: true });
            localFile = downloaded;
            return await saveImageToDownloads(downloaded.uri, fileName);
        }
        return await saveImageToDownloads(sourceUri, fileName);
    } finally {
        if (localFile?.exists) localFile.delete();
    }
}
