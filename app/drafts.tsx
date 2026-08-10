import type { CommentDraft } from '@/src/stores/useDraftStore';
import { useDraftStore } from '@/src/stores/useDraftStore';
import { Card, Divider, Icon, ListRow, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, Pressable, View } from 'react-native';

export default function DraftsScreen() {
    const theme = useTheme();
    const drafts = useDraftStore((state) => state.drafts);
    const removeDraft = useDraftStore((state) => state.removeDraft);

    const openDraft = useCallback((draft: CommentDraft) => {
        router.push({
            pathname: '/item/[type]/[id]/comment',
            params: {
                type: draft.target.contentType,
                id: draft.target.contentId,
                draftId: draft.id,
            },
        });
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
            <TopAppBar title="草稿箱" back={() => router.back()} />
            <FlatList
                data={drafts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: theme.spacing.lg, flexGrow: 1 }}
                renderItem={({ item }) => (
                    <Card feedback="none" style={{ marginBottom: theme.spacing.md }} contentStyle={{ overflow: 'hidden' }}>
                        <ListRow
                            title={item.title}
                            summary={item.content.replace(/\s+/g, ' ').trim()}
                            icon={<Icon name="message-text-outline" size={23} color={theme.colors.primary} />}
                            trailing={
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="删除草稿"
                                    hitSlop={8}
                                    onPress={(event) => {
                                        event.stopPropagation();
                                        removeDraft(item.id);
                                    }}
                                    style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Icon name="trash-can-outline" size={21} color={theme.colors.onSurfaceVariantActions} />
                                </Pressable>
                            }
                            onPress={() => openDraft(item)}
                        />
                        <Divider style={{ marginHorizontal: theme.spacing.lg }} />
                        <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary} style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm }}>
                            {new Date(item.updatedAt).toLocaleString()}
                        </Text>
                    </Card>
                )}
                ListEmptyComponent={
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="file-document-edit-outline" size={48} color={theme.colors.onSurfaceVariantSummary} />
                        <Text type="body1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.md }}>
                            暂无草稿
                        </Text>
                    </View>
                }
            />
        </View>
    );
}
