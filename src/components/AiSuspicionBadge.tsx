import { detectAiTextCached, isSuspiciousAiScore } from '@/src/services/aiTextDetector';
import { AI_TEXT_SENSITIVITY_THRESHOLDS } from '@/src/services/aiTextDetectorCore';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export function AiSuspicionBadge({ contentKey, text, style }: {
    contentKey: string;
    text: string;
    style?: StyleProp<ViewStyle>;
}) {
    const theme = useTheme();
    const enabled = useSettingStore((state) => state.aiTextDetectionEnabled);
    const sensitivity = useSettingStore((state) => state.aiTextDetectionSensitivity);
    const [score, setScore] = useState<number | null>(null);

    useEffect(() => {
        if (!enabled) {
            setScore(null);
            return;
        }

        let active = true;
        void detectAiTextCached(contentKey, text)
            .then((nextScore) => {
                if (active) setScore(nextScore);
            })
            .catch(() => {
                if (active) setScore(null);
            });
        return () => {
            active = false;
        };
    }, [contentKey, enabled, text]);

    if (!enabled || score == null || !isSuspiciousAiScore(score, AI_TEXT_SENSITIVITY_THRESHOLDS[sensitivity])) return null;

    return (
        <View
            pointerEvents="none"
            accessibilityElementsHidden
            style={[
                {
                    minHeight: 22,
                    paddingHorizontal: 8,
                    borderRadius: theme.radius.full,
                    backgroundColor: theme.colors.errorContainer,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                style,
            ]}
        >
            <Text type="footnote2" weight="bold" color={theme.colors.onErrorContainer}>
                疑似 AI
            </Text>
        </View>
    );
}
