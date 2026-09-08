import type { ProductV1RecommendationReason as RecommendationReason } from '@/src/types/recommendation';
import { useConsentStore } from '@/src/stores/useConsentStore';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

export function ProductRecommendationReason({
  reason,
  style,
}: {
  reason?: RecommendationReason | null;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const enabled = useConsentStore((state) => state.aiInterestAnalysisEnabled);
  if (!enabled || !reason?.summary) return null;

  return (
    <View pointerEvents="none" accessibilityElementsHidden style={style}>
      <Text
        type="footnote2"
        color={theme.colors.onSurfaceVariantSummary}
        numberOfLines={2}
        style={{ lineHeight: 17 }}
      >
        推荐 · {reason.summary}
      </Text>
    </View>
  );
}
