export type TextSelection = {
    start: number;
    end: number;
};

export type CommentReplyAssistPreset = {
    id: string;
    label: string;
    text: string;
};

export const COMMENT_REPLY_ASSIST_PRESETS: CommentReplyAssistPreset[] = [
    { id: 'thanks', label: '感谢补充', text: '谢谢补充，这点很有帮助。' },
    { id: 'source', label: '追问来源', text: '方便补充一下这个信息的来源吗？' },
    { id: 'clarify', label: '澄清理解', text: '我理解你的意思是：' },
    { id: 'question', label: '提出疑问', text: '这里我有一个疑问：' },
    { id: 'nuance', label: '保留意见', text: '这个观点我部分认同，不过我觉得还需要考虑：' },
    { id: 'expand', label: '请展开', text: '这里的关键可能是证据和适用范围，能再展开一下吗？' },
];

function clampIndex(value: number, length: number) {
    if (!Number.isFinite(value)) return length;
    return Math.max(0, Math.min(length, Math.floor(value)));
}

export function normalizeTextSelection(
    selection: TextSelection | undefined,
    length: number,
): TextSelection {
    if (!selection) return { start: length, end: length };
    const start = clampIndex(selection.start, length);
    const end = clampIndex(selection.end, length);
    return start <= end
        ? { start, end }
        : { start: end, end: start };
}

export function insertTextAtSelection(
    content: string,
    insertion: string,
    selection?: TextSelection,
) {
    const normalized = normalizeTextSelection(selection, content.length);
    const next = [
        content.slice(0, normalized.start),
        insertion,
        content.slice(normalized.end),
    ].join('');
    const cursor = normalized.start + insertion.length;

    return {
        content: next,
        selection: {
            start: cursor,
            end: cursor,
        } satisfies TextSelection,
    };
}
