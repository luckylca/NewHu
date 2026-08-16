export type CommentAuthorIdentity = {
    name?: string;
    urlToken?: string;
};

function normalizeIdentity(value: unknown) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, '')
        .toLocaleLowerCase();
}

/** Read the comment-author relationship from the variants used by Zhihu. */
export function readCommentAuthorFlag(raw: any): boolean | undefined {
    const candidates = [
        raw?.is_author,
        raw?.relationship?.is_author,
        raw?.author?.is_author,
        raw?.is_content_author,
    ];
    for (const value of candidates) {
        if (typeof value === 'boolean') return value;
        if (value === 0 || value === 1) return value === 1;
        if (value === 'true' || value === 'false') return value === 'true';
        if (value === '1' || value === '0') return value === '1';
    }
    return undefined;
}

export function commentMatchesContentAuthor(
    comment: { authorName?: string; authorUrlToken?: string },
    contentAuthor?: CommentAuthorIdentity,
) {
    if (!contentAuthor) return false;

    const commentToken = normalizeIdentity(comment.authorUrlToken);
    const authorToken = normalizeIdentity(contentAuthor.urlToken);
    if (commentToken && authorToken) return commentToken === authorToken;

    const commentName = normalizeIdentity(comment.authorName);
    const authorName = normalizeIdentity(contentAuthor.name);
    if (commentName === '匿名用户' || authorName === '匿名用户') return false;
    return Boolean(commentName && authorName && commentName === authorName);
}
