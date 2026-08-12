import { useTheme } from '@/src/ui/theme';
import React, { useState } from 'react';
import { View } from 'react-native';

type MiuixProgressIndicatorProps = {
    progress: number;
    height?: number;
};

/** Determinate linear ProgressIndicator ported from miuix-vue. */
export default function MiuixProgressIndicator({ progress, height = 6 }: MiuixProgressIndicatorProps) {
    const theme = useTheme();
    const [trackWidth, setTrackWidth] = useState(0);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    // Miuix keeps a round dot visible at 0%, rather than rendering an empty
    // track with a zero-width fill.
    const fillWidth = trackWidth > 0 ? height + (trackWidth - height) * clampedProgress : height;

    return (
        <View
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            style={{
                width: '100%',
                height,
                borderRadius: theme.radius.full,
                overflow: 'hidden',
                backgroundColor: theme.colors.secondaryContainer,
            }}
        >
            <View
                style={{
                    width: fillWidth,
                    height,
                    borderRadius: theme.radius.full,
                    backgroundColor: theme.colors.primary,
                }}
            />
        </View>
    );
}
