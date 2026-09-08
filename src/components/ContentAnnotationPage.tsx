import { getAnswer, getApiInstance, getArticle } from '@/src/api/ZhihuApi';
import LoadingView from '@/src/components/LoadingView';
import { KnowledgeCardEditorSheet } from '@/src/components/KnowledgeCardEditorSheet';
import {
    createContentAnnotation,
    deleteContentAnnotation,
    listContentAnnotations,
} from '@/src/db/repositories/contentAnnotationRepository';
import { getContent } from '@/src/db/repositories/contentRepository';
import { getKnowledgeCardByAnnotation } from '@/src/db/repositories/knowledgeCardRepository';
import type { ContentAnnotation, ContentAnnotationKind, KnowledgeCard } from '@/src/db/types';
import { useStoreHydrated } from '@/src/hooks/useStoreHydrated';
import { notify } from '@/src/stores/useNotificationStore';
import { useContentStore } from '@/src/stores/useContentStore';
import { useExportContentStore } from '@/src/stores/useExportContentStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { BottomSheet, Button, Card, Dialog, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import {
    getContentSourceUrl,
    normalizeAnnotationSelection,
} from '@/src/utils/contentAnnotation';
import { htmlToPlainText } from '@/src/utils/contentExport';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

type SelectionPageParams = { type: 'answer' | 'article'; id: string };

type SelectionDocument = {
    id: string;
    type: SelectionPageParams['type'];
    title: string;
    authorName: string;
    questionId?: string;
    updatedTime: number;
    htmlContent: string;
};

type CurrentSelection = {
    start: number;
    end: number;
    text: string;
};

const ANNOTATION_LABELS: Record<ContentAnnotationKind, string> = {
    highlight: '划线',
    excerpt: '摘录',
    note: '笔记',
};

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sortAnnotations(items: ContentAnnotation[]) {
    return [...items].sort((a, b) => (
        a.selectionStart - b.selectionStart
        || a.createdAt - b.createdAt
    ));
}

export default function ContentAnnotationPage() {
    const { type: rawType, id: rawId } = useLocalSearchParams<SelectionPageParams>();
    const type = rawType === 'article' ? 'article' : 'answer';
    const id = String(rawId ?? '');
    const theme = useTheme();
    const router = useRouter();
    const webViewRef = useRef<WebView>(null);

    const cookies = useUserStore((state) => state.cookies);
    const userHydrated = useStoreHydrated(useUserStore);
    const pending = useExportContentStore((state) => state.pending);
    const feedItem = useContentStore((state) => (
        state.feedList.find((item) => item.feedType === type && String(item.item.id) === id)?.item
    ));

    const [document, setDocument] = useState<SelectionDocument | null>(null);
    const [error, setError] = useState('');
    const [annotations, setAnnotations] = useState<ContentAnnotation[]>([]);
    const [selection, setSelection] = useState<CurrentSelection | null>(null);
    const [noteVisible, setNoteVisible] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [managerVisible, setManagerVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [cardEditorVisible, setCardEditorVisible] = useState(false);
    const [cardEditorAnnotation, setCardEditorAnnotation] = useState<ContentAnnotation | null>(null);
    const [cardEditorCard, setCardEditorCard] = useState<KnowledgeCard | null>(null);

    useEffect(() => {
        if (pending && pending.type === type && pending.id === id) {
            setDocument(pending);
            return;
        }
        if (feedItem) {
            setDocument({
                id,
                type,
                title: type === 'answer' ? feedItem.questionTitle : feedItem.title,
                authorName: feedItem.authorName,
                questionId: feedItem.questionId,
                updatedTime: feedItem.updatedTime,
                htmlContent: feedItem.content || '<p>暂无正文内容</p>',
            });
            return;
        }
        if (!userHydrated || !id) return;

        let cancelled = false;
        const load = async () => {
            let localLoaded = false;
            try {
                const local = await getContent(id, type);
                if (local && !cancelled) {
                    localLoaded = true;
                    setDocument({
                        id,
                        type,
                        title: type === 'answer' ? local.questionTitle : local.title,
                        authorName: local.authorName,
                        questionId: local.questionId,
                        updatedTime: local.updatedTime,
                        htmlContent: local.content || '<p>暂无正文内容</p>',
                    });
                }
            } catch (localError) {
                console.warn('读取本地可标注文章失败', localError);
            }

            if (!cookies) {
                if (!localLoaded && !cancelled) setError('本地没有正文缓存，请登录或联网后重试');
                return;
            }

            try {
                getApiInstance(cookies);
                const data = type === 'answer' ? await getAnswer(id) : await getArticle(id);
                const nextDocument: SelectionDocument = {
                    id,
                    type,
                    title: type === 'answer'
                        ? data.question?.title || data.title || '回答详情'
                        : data.title || '文章详情',
                    authorName: data.author?.name || '匿名用户',
                    questionId: String(data.question?.id || ''),
                    updatedTime: data.updated_time || data.updated || data.created || 0,
                    htmlContent: data.content || '<p>暂无正文内容</p>',
                };
                if (!cancelled) setDocument(nextDocument);
            } catch (loadError) {
                console.error('加载可标注文章失败', loadError);
                if (!localLoaded && !cancelled) setError('内容加载失败，请返回详情页重试');
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [cookies, feedItem, id, pending, type, userHydrated]);

    useEffect(() => {
        let active = true;
        void listContentAnnotations(id, type)
            .then((items) => {
                if (active) setAnnotations(sortAnnotations(items));
            })
            .catch((loadError) => {
                console.warn('本地标注读取失败', loadError);
            });
        return () => { active = false; };
    }, [id, type]);

    const selectableText = useMemo(() => {
        if (!document) return '';
        const date = document.updatedTime
            ? new Date(document.updatedTime * 1000).toLocaleString()
            : '最近更新';
        return [
            document.title,
            `${document.authorName} · ${date}`,
            htmlToPlainText(document.htmlContent),
        ]
            .filter(Boolean)
            .join('\n\n');
    }, [document]);

    const sourceUrl = useMemo(
        () => getContentSourceUrl(type, id, document?.questionId),
        [document?.questionId, id, type],
    );

    const annotationDescriptors = useMemo(() => annotations.map((annotation) => ({
        id: annotation.id,
        kind: annotation.kind,
        start: annotation.selectionStart,
        end: annotation.selectionEnd,
        hasNote: Boolean(annotation.noteText),
    })), [annotations]);

    const selectionHtml = useMemo(() => {
        const descriptorJson = JSON.stringify(annotationDescriptors).replace(/</g, '\\u003c');
        return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" /><style>
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${theme.colors.background}; color: ${theme.colors.onBackground}; }
body { padding: 18px 20px 40px; font-family: sans-serif; font-size: 17px; line-height: 1.75; -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }
#content { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
mark.newhu-annotation { color: inherit; border-radius: 3px; padding: 0 1px; }
mark[data-kind="highlight"] { background: ${theme.colors.secondaryContainer}; }
mark[data-kind="excerpt"] { background: ${theme.colors.tertiaryContainer}; }
mark[data-kind="note"] { background: ${theme.colors.tertiaryContainer}; border-bottom: 2px solid ${theme.colors.primary}; }
</style></head><body><div id="content">${escapeHtml(selectableText)}</div>
<script>
(function () {
  const root = document.getElementById('content');
  const annotations = ${descriptorJson};

  function locateOffset(target) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let consumed = 0;
    let node = walker.nextNode();
    let last = null;
    while (node) {
      const length = node.nodeValue ? node.nodeValue.length : 0;
      last = node;
      if (target <= consumed + length) {
        return { node: node, offset: Math.max(0, Math.min(length, target - consumed)) };
      }
      consumed += length;
      node = walker.nextNode();
    }
    if (last) return { node: last, offset: last.nodeValue ? last.nodeValue.length : 0 };
    return null;
  }

  function applyAnnotation(annotation) {
    if (!Number.isFinite(annotation.start) || !Number.isFinite(annotation.end) || annotation.end <= annotation.start) return;
    const start = locateOffset(annotation.start);
    const end = locateOffset(annotation.end);
    if (!start || !end) return;
    try {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      const mark = document.createElement('mark');
      mark.className = 'newhu-annotation';
      mark.dataset.annotationId = String(annotation.id);
      mark.dataset.kind = String(annotation.kind);
      mark.dataset.hasNote = annotation.hasNote ? 'true' : 'false';
      try {
        range.surroundContents(mark);
      } catch (_) {
        const fragment = range.extractContents();
        mark.appendChild(fragment);
        range.insertNode(mark);
      }
    } catch (_) {}
  }

  annotations
    .slice()
    .sort(function (a, b) { return b.start - a.start || b.end - a.end; })
    .forEach(applyAnnotation);

  let timer = null;
  function postSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selection', empty: true }));
      return;
    }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selection', empty: true }));
      return;
    }
    try {
      const prefix = document.createRange();
      prefix.selectNodeContents(root);
      prefix.setEnd(range.startContainer, range.startOffset);
      const start = prefix.toString().length;
      const text = range.toString();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'selection',
        start: start,
        end: start + text.length,
        text: text
      }));
    } catch (_) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selection', empty: true }));
    }
  }

  function scheduleSelection() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(postSelection, 80);
  }

  document.addEventListener('selectionchange', scheduleSelection);
  document.addEventListener('touchend', scheduleSelection);
  document.addEventListener('mouseup', scheduleSelection);
})();
</script></body></html>`;
    }, [
        annotationDescriptors,
        selectableText,
        theme.colors.background,
        theme.colors.onBackground,
        theme.colors.primary,
        theme.colors.secondaryContainer,
        theme.colors.tertiaryContainer,
    ]);

    const handleWebMessage = useCallback((event: WebViewMessageEvent) => {
        try {
            const payload = JSON.parse(event.nativeEvent.data);
            if (payload?.type !== 'selection') return;
            if (payload.empty) {
                setSelection(null);
                return;
            }
            const range = normalizeAnnotationSelection(
                Number(payload.start),
                Number(payload.end),
                selectableText.length,
            );
            if (!range) {
                setSelection(null);
                return;
            }
            const text = selectableText.slice(range.start, range.end);
            if (!text.trim()) {
                setSelection(null);
                return;
            }
            setSelection({ ...range, text });
        } catch {
            // Ignore unrelated WebView messages.
        }
    }, [selectableText]);

    const saveCurrentSelection = useCallback(async (
        kind: ContentAnnotationKind,
        note = '',
    ) => {
        if (!document || !selection || saving) return;
        if (kind === 'note' && !note.trim()) return;

        const duplicate = kind !== 'note' && annotations.some((annotation) => (
            annotation.kind === kind
            && annotation.selectionStart === selection.start
            && annotation.selectionEnd === selection.end
        ));
        if (duplicate) {
            notify(kind === 'highlight' ? '这段文字已经划线' : '这段文字已经摘录');
            return;
        }

        setSaving(true);
        try {
            const annotation = await createContentAnnotation({
                contentId: id,
                contentType: type,
                kind,
                selectionStart: selection.start,
                selectionEnd: selection.end,
                quoteText: selection.text,
                noteText: note,
                title: document.title,
                authorName: document.authorName,
                sourceUrl,
                sourceUpdatedAt: document.updatedTime,
            });
            setAnnotations((current) => sortAnnotations([...current, annotation]));
            setSelection(null);
            setNoteText('');
            setNoteVisible(false);
            notify(kind === 'highlight' ? '已划线' : kind === 'excerpt' ? '已保存摘录' : '笔记已保存');
        } catch (saveError) {
            console.error('保存本地标注失败', saveError);
            notify('保存失败，请重试');
        } finally {
            setSaving(false);
        }
    }, [annotations, document, id, saving, selection, sourceUrl, type]);

    const removeAnnotation = useCallback(async (annotationId: string) => {
        try {
            await deleteContentAnnotation(annotationId);
            setAnnotations((current) => current.filter((item) => item.id !== annotationId));
            notify('已删除标注');
        } catch (deleteError) {
            console.error('删除本地标注失败', deleteError);
            notify('删除失败，请重试');
        }
    }, []);

    const locateAnnotation = useCallback((annotationId: string) => {
        setManagerVisible(false);
        const idJson = JSON.stringify(annotationId);
        webViewRef.current?.injectJavaScript(`
(function () {
  const targetId = ${idJson};
  const items = Array.from(document.querySelectorAll('[data-annotation-id]'));
  const target = items.find(function (item) { return item.getAttribute('data-annotation-id') === targetId; });
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
})(); true;`);
    }, []);

    const openKnowledgeCardEditor = useCallback(async (annotation: ContentAnnotation) => {
        try {
            const existing = await getKnowledgeCardByAnnotation(annotation.id);
            setManagerVisible(false);
            setCardEditorAnnotation(annotation);
            setCardEditorCard(existing);
            setTimeout(() => setCardEditorVisible(true), 180);
        } catch (error) {
            console.error('读取关联知识卡片失败', error);
            notify('知识卡片读取失败');
        }
    }, []);

    if (!document) {
        return error ? (
            <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
                <Text type="body1" color={theme.colors.onBackground}>{error}</Text>
            </View>
        ) : <LoadingView message="正在准备可标注文章…" />;
    }

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
            <TopAppBar
                title="划线与笔记"
                back={() => router.back()}
                actions={(
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="查看本页标注"
                        onPress={() => setManagerVisible(true)}
                        hitSlop={8}
                        style={({ pressed }) => ({
                            minHeight: 40,
                            justifyContent: 'center',
                            opacity: pressed ? 0.6 : 1,
                        })}
                    >
                        <Text type="body2" weight="medium" color={theme.colors.primary}>
                            标注 {annotations.length}
                        </Text>
                    </Pressable>
                )}
            />

            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: selectionHtml }}
                style={styles.webView}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                textZoom={100}
                androidLayerType="none"
                onMessage={handleWebMessage}
            />

            {selection ? (
                <View style={[
                    styles.selectionBar,
                    {
                        backgroundColor: theme.colors.surfaceContainer,
                        borderTopColor: theme.colors.secondaryContainer,
                    },
                ]}>
                    <Text
                        type="body2"
                        color={theme.colors.onSurfaceVariantSummary}
                        numberOfLines={2}
                    >
                        {selection.text.trim()}
                    </Text>
                    <View style={styles.actionRow}>
                        <Button
                            disabled={saving}
                            style={styles.actionButton}
                            onPress={() => void saveCurrentSelection('highlight')}
                        >
                            划线
                        </Button>
                        <Button
                            disabled={saving}
                            style={styles.actionButton}
                            onPress={() => void saveCurrentSelection('excerpt')}
                        >
                            摘录
                        </Button>
                        <Button
                            type="primary"
                            disabled={saving}
                            style={styles.actionButton}
                            onPress={() => setNoteVisible(true)}
                        >
                            笔记
                        </Button>
                    </View>
                </View>
            ) : (
                <View style={[styles.hintBar, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>
                        长按正文并拖动选区，可划线、摘录或添加笔记
                    </Text>
                </View>
            )}

            <Dialog
                visible={noteVisible}
                onClose={() => {
                    if (saving) return;
                    setNoteVisible(false);
                    setNoteText('');
                }}
                title="添加笔记"
                summary={selection?.text.trim().slice(0, 96)}
                closeOnClickModal={!saving}
            >
                <TextInput
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder="写下你的理解、疑问或补充…"
                    placeholderTextColor={theme.colors.onSurfaceVariantSummary}
                    multiline
                    autoFocus
                    textAlignVertical="top"
                    style={[
                        styles.noteInput,
                        {
                            color: theme.colors.onBackground,
                            backgroundColor: theme.colors.surfaceContainer,
                            borderColor: theme.colors.secondaryContainer,
                        },
                    ]}
                />
                <View style={[styles.dialogActions, { marginTop: theme.spacing.md }]}>
                    <Button
                        disabled={saving}
                        onPress={() => {
                            setNoteVisible(false);
                            setNoteText('');
                        }}
                    >
                        取消
                    </Button>
                    <Button
                        type="primary"
                        disabled={saving || !noteText.trim()}
                        onPress={() => void saveCurrentSelection('note', noteText)}
                    >
                        保存
                    </Button>
                </View>
            </Dialog>

            <BottomSheet
                visible={managerVisible}
                onClose={() => setManagerVisible(false)}
                title={`本页标注 ${annotations.length}`}
            >
                {annotations.length ? (
                    <ScrollView
                        style={styles.annotationList}
                        contentContainerStyle={{ paddingBottom: theme.spacing.lg, gap: theme.spacing.sm }}
                        showsVerticalScrollIndicator={false}
                    >
                        {annotations.map((annotation) => (
                            <Card
                                key={annotation.id}
                                feedback="none"
                                contentStyle={{ padding: theme.spacing.md }}
                            >
                                <View style={styles.annotationHeader}>
                                    <Text type="body2" weight="medium" color={theme.colors.primary}>
                                        {ANNOTATION_LABELS[annotation.kind]}
                                    </Text>
                                    <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                                        {new Date(annotation.createdAt).toLocaleString()}
                                    </Text>
                                </View>
                                <Text
                                    type="body1"
                                    color={theme.colors.onBackground}
                                    numberOfLines={4}
                                    style={{ marginTop: theme.spacing.xs }}
                                >
                                    {annotation.quoteText.trim()}
                                </Text>
                                {annotation.noteText ? (
                                    <Text
                                        type="body2"
                                        color={theme.colors.onSurfaceVariantSummary}
                                        style={{ marginTop: theme.spacing.sm }}
                                    >
                                        {annotation.noteText}
                                    </Text>
                                ) : null}
                                <View style={[styles.annotationActions, { marginTop: theme.spacing.md }]}>
                                    <Button
                                        style={{ flex: 1 }}
                                        onPress={() => void openKnowledgeCardEditor(annotation)}
                                    >
                                        知识卡片
                                    </Button>
                                    <Button
                                        style={{ flex: 1 }}
                                        onPress={() => locateAnnotation(annotation.id)}
                                    >
                                        定位
                                    </Button>
                                    <Button
                                        style={{ flex: 1 }}
                                        onPress={() => void removeAnnotation(annotation.id)}
                                    >
                                        删除
                                    </Button>
                                </View>
                            </Card>
                        ))}
                    </ScrollView>
                ) : (
                    <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
                        <Text type="body1" color={theme.colors.onSurfaceVariantSummary}>
                            还没有标注
                        </Text>
                    </View>
                )}
            </BottomSheet>

            <KnowledgeCardEditorSheet
                visible={cardEditorVisible}
                annotation={cardEditorAnnotation}
                card={cardEditorCard}
                onClose={() => {
                    setCardEditorVisible(false);
                    setCardEditorAnnotation(null);
                    setCardEditorCard(null);
                }}
                onSaved={() => {
                    setCardEditorVisible(false);
                    setCardEditorAnnotation(null);
                    setCardEditorCard(null);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    webView: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    hintBar: {
        paddingHorizontal: 18,
        paddingVertical: 12,
    },
    selectionBar: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    actionButton: { flex: 1 },
    noteInput: {
        minHeight: 132,
        maxHeight: 240,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        lineHeight: 23,
    },
    dialogActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    annotationList: {
        maxHeight: 520,
    },
    annotationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    annotationActions: {
        flexDirection: 'row',
        gap: 8,
    },
});
