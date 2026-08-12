import { getContent } from '@/src/db/repositories/contentRepository';
import { getCacheSummary, listOfflinePins } from '@/src/db/repositories/offlineCacheRepository';
import { cleanupTransientCache } from '@/src/services/cacheCleanupService';
import { removeCachedContent } from '@/src/services/offlineCacheService';
import { Button, Card, Divider, ListRow, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

type CacheItem = { id: string; type: 'answer' | 'article'; title: string; summary: string };

export default function StorageManagementScreen() {
    const theme = useTheme();
    const [items, setItems] = useState<CacheItem[]>([]);
    const [summary, setSummary] = useState({ transientBytes: 0, pinnedBytes: 0, commentCount: 0, outboxCount: 0, pinnedCount: 0 });
    const [cleaning, setCleaning] = useState(false);

    const reload = useCallback(async () => {
        const [pins, nextSummary] = await Promise.all([listOfflinePins(), getCacheSummary()]);
        const nextItems = await Promise.all(pins.map(async (pin) => {
            const content = await getContent(pin.contentId, pin.contentType);
            return {
                id: pin.contentId,
                type: pin.contentType,
                title: content?.title || content?.questionTitle || '未命名内容',
                summary: `${pin.rootCommentMode === 'none' ? '不缓存评论' : pin.rootCommentMode === 'all' ? '全部根评论' : '最多 100 条根评论'} · 每条回复最多 ${pin.childCommentLimit} 条${pin.withImages ? ' · 含图片' : ''}`,
            };
        }));
        setItems(nextItems);
        setSummary(nextSummary);
    }, []);

    useEffect(() => { void reload(); }, [reload]);

    const clean = async () => {
        if (cleaning) return;
        setCleaning(true);
        try { await cleanupTransientCache(); await reload(); } finally { setCleaning(false); }
    };

    const formatBytes = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar title="存储管理" back={() => router.back()} />
            <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
                <Card contentStyle={{ padding: theme.spacing.lg }}>
                    <Text type="headline2" weight="bold">存储概览</Text>
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: 8 }}>离线缓存 {summary.pinnedCount} 篇 · 约 {formatBytes(summary.pinnedBytes)}</Text>
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: 4 }}>临时缓存约 {formatBytes(summary.transientBytes)} · 待同步操作 {summary.outboxCount} 条</Text>
                    <Button type="default" onPress={() => void clean()} disabled={cleaning} style={{ marginTop: theme.spacing.md, alignSelf: 'flex-start' }}>
                        {cleaning ? '清理中…' : '清理临时数据'}
                    </Button>
                </Card>
                <Text type="headline2" weight="bold" style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }}>离线缓存</Text>
                <Card contentStyle={{ overflow: 'hidden' }}>
                    {items.length === 0 ? <View style={{ padding: theme.spacing.xl, alignItems: 'center' }}><Text type="body2" color={theme.colors.onSurfaceVariantSummary}>还没有离线缓存</Text></View> : items.map((item, index) => (
                        <React.Fragment key={`${item.type}:${item.id}`}>
                            {index > 0 ? <Divider style={{ marginLeft: 60 }} /> : null}
                            <ListRow
                                title={item.title}
                                summary={item.summary}
                                onPress={() => router.push({ pathname: '/item/[type]/[id]', params: { type: item.type, id: item.id } })}
                                trailing={<Button type="default" onPress={() => void removeCachedContent(item.id, item.type).then(reload)}>删除</Button>}
                            />
                        </React.Fragment>
                    ))}
                </Card>
            </ScrollView>
        </View>
    );
}
