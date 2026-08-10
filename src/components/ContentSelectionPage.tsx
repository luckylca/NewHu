import { getAnswer, getApiInstance, getArticle } from '@/src/api/ZhihuApi';
import LoadingView from '@/src/components/LoadingView';
import { useStoreHydrated } from '@/src/hooks/useStoreHydrated';
import { useContentStore } from '@/src/stores/useContentStore';
import { useExportContentStore } from '@/src/stores/useExportContentStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { htmlToPlainText } from '@/src/utils/contentExport';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

type SelectionPageParams = { type: 'answer' | 'article'; id: string };
type SelectionDocument = {
    id: string;
    type: SelectionPageParams['type'];
    title: string;
    authorName: string;
    updatedTime: number;
    htmlContent: string;
};

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export default function ContentSelectionPage({ pageTitle = '选择全文' }: { pageTitle?: string }) {
    const { type: rawType, id: rawId } = useLocalSearchParams<SelectionPageParams>();
    const type = rawType === 'article' ? 'article' : 'answer';
    const id = String(rawId ?? '');
    const theme = useTheme();
    const router = useRouter();
    const cookies = useUserStore((state) => state.cookies);
    const userHydrated = useStoreHydrated(useUserStore);
    const pending = useExportContentStore((state) => state.pending);
    const feedItem = useContentStore((state) => state.feedList.find((item) => item.feedType === type && String(item.item.id) === id)?.item);
    const [document, setDocument] = useState<SelectionDocument | null>(null);
    const [error, setError] = useState('');

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
                updatedTime: feedItem.updatedTime,
                htmlContent: feedItem.content || '<p>暂无正文内容</p>',
            });
            return;
        }
        if (!userHydrated || !id) return;

        let cancelled = false;
        const load = async () => {
            try {
                getApiInstance(cookies);
                const data = type === 'answer' ? await getAnswer(id) : await getArticle(id);
                const nextDocument: SelectionDocument = {
                    id,
                    type,
                    title: type === 'answer' ? data.question?.title || data.title || '回答详情' : data.title || '文章详情',
                    authorName: data.author?.name || '匿名用户',
                    updatedTime: data.updated_time || data.updated || data.created || 0,
                    htmlContent: data.content || '<p>暂无正文内容</p>',
                };
                if (!cancelled) setDocument(nextDocument);
            } catch (loadError) {
                console.error('加载可复制文章失败', loadError);
                if (!cancelled) setError('内容加载失败，请返回详情页重试');
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [cookies, feedItem, id, pending, type, userHydrated]);

    const selectableText = useMemo(() => {
        if (!document) return '';
        const date = document.updatedTime ? new Date(document.updatedTime * 1000).toLocaleString() : '最近更新';
        return [document.title, `${document.authorName} · ${date}`, htmlToPlainText(document.htmlContent)]
            .filter(Boolean)
            .join('\n\n');
    }, [document]);

    const selectionHtml = useMemo(() => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" /><style>
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${theme.colors.background}; color: ${theme.colors.onBackground}; }
body { padding: 18px 20px 40px; font-family: sans-serif; font-size: 17px; line-height: 1.75; -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }
#content { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
</style></head><body><div id="content">${escapeHtml(selectableText)}</div></body></html>`, [selectableText, theme.colors.background, theme.colors.onBackground]);

    if (!document) {
        return error ? (
            <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
                <Text type="body1" color={theme.colors.onBackground}>{error}</Text>
            </View>
        ) : <LoadingView message="正在准备可复制文章…" />;
    }

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.background }]}> 
            <TopAppBar title={pageTitle} back={() => router.back()} />
            <WebView
                originWhitelist={['*']}
                source={{ html: selectionHtml }}
                style={styles.webView}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                textZoom={100}
                androidLayerType="none"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    webView: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
