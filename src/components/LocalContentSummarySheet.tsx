import { buildLocalContentSummary } from '@/src/services/localContentSummary';
import { BottomSheet, Card } from '@/src/ui';
import { getBadgeColorsByIndex } from '@/src/ui/badgePalette';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

export function LocalContentSummarySheet({
    visible,
    onClose,
    html,
    title,
}: {
    visible: boolean;
    onClose: () => void;
    html: string;
    title: string;
}) {
    const theme = useTheme();
    const summary = useMemo(
        () => buildLocalContentSummary(html, title),
        [html, title],
    );

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            title="本地摘要"
        >
            <ScrollView
                style={{ maxHeight: 660 }}
                contentContainerStyle={{
                    paddingBottom: theme.spacing.xl,
                    gap: theme.spacing.md,
                }}
                showsVerticalScrollIndicator={false}
            >
                <Card feedback="none" contentStyle={{ padding: theme.spacing.md }}>
                    <Text type="body2" weight="medium" color={theme.colors.onBackground}>
                        本机规则提取 · 不发送正文
                    </Text>
                    <Text
                        type="footnote1"
                        color={theme.colors.onSurfaceVariantSummary}
                        style={{ marginTop: theme.spacing.xs, lineHeight: 18 }}
                    >
                        从当前缓存正文提取小标题、稳定高频词和代表性句子。它不是生成式模型结论，适合离线快速扫读。
                    </Text>
                    <Text
                        type="footnote2"
                        color={theme.colors.onSurfaceVariantActions}
                        style={{ marginTop: theme.spacing.sm }}
                    >
                        已分析 {summary.textLength.toLocaleString()} 个正文字符
                    </Text>
                </Card>

                <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
                    <Text type="headline1" weight="medium" color={theme.colors.onBackground}>
                        内容结构
                    </Text>
                    {summary.headings.length ? (
                        <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
                            {summary.headings.map((heading, index) => (
                                <View
                                    key={String(index) + ':' + heading}
                                    style={{ flexDirection: 'row', gap: theme.spacing.sm }}
                                >
                                    <Text type="body2" weight="bold" color={theme.colors.primary}>
                                        {index + 1}.
                                    </Text>
                                    <Text
                                        type="body2"
                                        color={theme.colors.onBackground}
                                        style={{ flex: 1, lineHeight: 21 }}
                                    >
                                        {heading}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text
                            type="body2"
                            color={theme.colors.onSurfaceVariantSummary}
                            style={{ marginTop: theme.spacing.sm }}
                        >
                            当前正文没有识别到明确的 h1–h4 小标题。
                        </Text>
                    )}
                </Card>

                <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
                    <Text type="headline1" weight="medium" color={theme.colors.onBackground}>
                        关键词
                    </Text>
                    {summary.keywords.length ? (
                        <View style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: theme.spacing.sm,
                            marginTop: theme.spacing.md,
                        }}>
                            {summary.keywords.map((keyword, index) => {
                                const colors = getBadgeColorsByIndex(index, theme.dark);
                                return (
                                    <View
                                        key={keyword}
                                        style={{
                                            paddingHorizontal: 10,
                                            paddingVertical: 5,
                                            borderRadius: theme.radius.full,
                                            backgroundColor: colors.background,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                        }}
                                    >
                                        <Text type="footnote1" weight="bold" color={colors.foreground}>
                                            {keyword}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <Text
                            type="body2"
                            color={theme.colors.onSurfaceVariantSummary}
                            style={{ marginTop: theme.spacing.sm }}
                        >
                            正文太短，暂时没有稳定关键词。
                        </Text>
                    )}
                </Card>

                <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
                    <Text type="headline1" weight="medium" color={theme.colors.onBackground}>
                        核心句
                    </Text>
                    {summary.coreSentences.length ? (
                        <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.md }}>
                            {summary.coreSentences.map((sentence, index) => (
                                <View
                                    key={String(index) + ':' + sentence}
                                    style={{
                                        flexDirection: 'row',
                                        gap: theme.spacing.sm,
                                        alignItems: 'flex-start',
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: theme.colors.tertiaryContainer,
                                        }}
                                    >
                                        <Text
                                            type="footnote1"
                                            weight="bold"
                                            color={theme.colors.onTertiaryContainer}
                                        >
                                            {index + 1}
                                        </Text>
                                    </View>
                                    <Text
                                        type="body2"
                                        color={theme.colors.onBackground}
                                        style={{ flex: 1, lineHeight: 22 }}
                                    >
                                        {sentence}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text
                            type="body2"
                            color={theme.colors.onSurfaceVariantSummary}
                            style={{ marginTop: theme.spacing.sm }}
                        >
                            正文太短，暂时无法提取代表性句子。
                        </Text>
                    )}
                </Card>
            </ScrollView>
        </BottomSheet>
    );
}
