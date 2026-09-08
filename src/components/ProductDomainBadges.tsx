import { classifyProductV1Domains } from '@/src/product-v1/domainClassifier';
import type { ProductV1DomainMatch } from '@/src/product-v1/domainSelection';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export function ProductDomainBadges({
  enabled,
  contentKey,
  title,
  excerpt,
  style,
}: {
  enabled: boolean;
  contentKey: string;
  title: string;
  excerpt: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [domains, setDomains] = React.useState<ProductV1DomainMatch[]>([]);

  React.useEffect(() => {
    if (!enabled) {
      setDomains([]);
      return;
    }

    let active = true;
    void classifyProductV1Domains(contentKey, title, excerpt)
      .then((matches) => {
        if (active) setDomains(matches);
      })
      .catch(() => {
        if (active) setDomains([]);
      });

    return () => {
      active = false;
    };
  }, [contentKey, enabled, excerpt, title]);

  if (!enabled || domains.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 4,
        },
        style,
      ]}
    >
      {domains.map((domain) => (
        <View
          key={domain.domain}
          style={{
            minHeight: 22,
            paddingHorizontal: 8,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.secondaryContainer,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text type="footnote2" weight="bold" color={theme.colors.onSecondaryContainer}>
            {domain.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
