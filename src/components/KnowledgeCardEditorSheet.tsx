import type { ContentAnnotation, KnowledgeCard, KnowledgeReviewState } from '@/src/db/types';
import { saveKnowledgeCard } from '@/src/db/repositories/knowledgeCardRepository';
import { notify } from '@/src/stores/useNotificationStore';
import {
    KNOWLEDGE_REVIEW_STATES,
    normalizeKnowledgeTags,
} from '@/src/utils/knowledgeCard';
import { BottomSheet, Button, Card, Input, SegmentedControl } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

export function KnowledgeCardEditorSheet({
    visible,
    annotation,
    card,
    onClose,
    onSaved,
}: {
    visible: boolean;
    annotation?: ContentAnnotation | null;
    card?: KnowledgeCard | null;
    onClose: () => void;
    onSaved?: (card: KnowledgeCard) => void;
}) {
    const theme = useTheme();
    const [understanding, setUnderstanding] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [reviewState, setReviewState] = useState<KnowledgeReviewState>('new');
    const [saving, setSaving] = useState(false);

    const source = card ?? annotation ?? null;
    const quoteText = card?.quoteText ?? annotation?.quoteText ?? '';
    const title = card?.title ?? annotation?.title ?? '';
    const authorName = card?.authorName ?? annotation?.authorName ?? '';

    useEffect(() => {
        if (!visible) return;
        setUnderstanding(card?.understandingText ?? annotation?.noteText ?? '');
        setTagsInput(card?.tags.join('，') ?? '');
        setReviewState(card?.reviewState ?? 'new');
        setSaving(false);
    }, [annotation?.id, annotation?.noteText, card?.id, card?.reviewState, card?.tags, card?.understandingText, visible]);

    const reviewIndex = Math.max(0, KNOWLEDGE_REVIEW_STATES.indexOf(reviewState));
    const previewTags = useMemo(() => normalizeKnowledgeTags(tagsInput), [tagsInput]);

    const save = async () => {
        if (!source || saving) return;
        setSaving(true);
        try {
            const saved = await saveKnowledgeCard({
                id: card?.id,
                annotationId: annotation?.id ?? card?.annotationId ?? null,
                contentId: card?.contentId ?? annotation?.contentId ?? '',
                contentType: card?.contentType ?? annotation?.contentType ?? 'answer',
                quoteText,
                understandingText: understanding,
                tags: previewTags,
                reviewState,
                title,
                authorName,
                sourceUrl: card?.sourceUrl ?? annotation?.sourceUrl ?? '',
                sourceUpdatedAt: card?.sourceUpdatedAt ?? annotation?.sourceUpdatedAt ?? 0,
            });
            onSaved?.(saved);
            notify(card ? '知识卡片已更新' : '已生成知识卡片');
            onClose();
        } catch (error) {
            console.error('知识卡片保存失败', error);
            notify('知识卡片保存失败，请重试');
        } finally {
            setSaving(false);
        }
    };

    return (
        <BottomSheet
            visible={visible}
            onClose={() => {
                if (!saving) onClose();
            }}
            title={card ? '编辑知识卡片' : '生成知识卡片'}
            allowDismiss={!saving}
            closeOnClickModal={!saving}
        >
            <ScrollView
                style={{ maxHeight: 620 }}
                contentContainerStyle={{ paddingBottom: theme.spacing.lg, gap: theme.spacing.md }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Card feedback="none" contentStyle={{ padding: theme.spacing.md }}>
                    <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                        原文摘录
                    </Text>
                    <Text
                        type="body1"
                        color={theme.colors.onBackground}
                        style={{ marginTop: theme.spacing.xs }}
                        numberOfLines={6}
                    >
                        {quoteText.trim() || '暂无摘录'}
                    </Text>
                    {(title || authorName) ? (
                        <Text
                            type="footnote1"
                            color={theme.colors.onSurfaceVariantSummary}
                            style={{ marginTop: theme.spacing.sm }}
                            numberOfLines={2}
                        >
                            {[title, authorName].filter(Boolean).join(' · ')}
                        </Text>
                    ) : null}
                </Card>

                <Input
                    value={understanding}
                    onChangeText={setUnderstanding}
                    label="我的理解"
                    singleLine={false}
                    inputProps={{
                        textAlignVertical: 'top',
                        style: { minHeight: 112, lineHeight: 23 },
                        placeholder: '写下你的理解、疑问、结论或可迁移经验…',
                    }}
                />

                <Input
                    value={tagsInput}
                    onChangeText={setTagsInput}
                    label="标签"
                    inputProps={{
                        placeholder: '用逗号分隔，最多 8 个',
                        returnKeyType: 'done',
                    }}
                />

                {previewTags.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {previewTags.map((tag) => (
                            <View
                                key={tag}
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    borderRadius: theme.radius.full,
                                    backgroundColor: theme.colors.secondaryContainer,
                                }}
                            >
                                <Text type="footnote1" color={theme.colors.onSecondaryContainer}>
                                    {tag}
                                </Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                <View>
                    <Text
                        type="body2"
                        color={theme.colors.onSurfaceVariantSummary}
                        style={{ marginBottom: theme.spacing.sm }}
                    >
                        复习状态
                    </Text>
                    <SegmentedControl
                        tabs={['待复习', '复习中', '已掌握']}
                        selected={reviewIndex}
                        onSelect={(index) => setReviewState(KNOWLEDGE_REVIEW_STATES[index] ?? 'new')}
                    />
                </View>

                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <Button
                        style={{ flex: 1 }}
                        disabled={saving}
                        onPress={onClose}
                    >
                        取消
                    </Button>
                    <Button
                        type="primary"
                        style={{ flex: 1 }}
                        disabled={saving || !quoteText.trim()}
                        onPress={() => void save()}
                    >
                        保存
                    </Button>
                </View>
            </ScrollView>
        </BottomSheet>
    );
}
