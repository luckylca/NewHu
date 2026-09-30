import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Static, low-frequency light field used only when Liquid Glass has no user wallpaper. */
export const DefaultAmbientBackdrop = memo(function DefaultAmbientBackdrop({ dark }: { dark: boolean }) {
    const base = dark ? '#080B11' : '#F3F6FC';
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width="100%" height="100%" viewBox="0 0 100 230" preserveAspectRatio="xMidYMid slice">
                <Defs>
                    <RadialGradient id="ambient-blue" cx="10%" cy="8%" r="92%">
                        <Stop offset="0%" stopColor={dark ? '#1B3C68' : '#AFC9F2'} stopOpacity={dark ? 0.48 : 0.62} />
                        <Stop offset="100%" stopColor={dark ? '#173253' : '#C7D9F4'} stopOpacity="0" />
                    </RadialGradient>
                    <RadialGradient id="ambient-cool" cx="100%" cy="57%" r="78%">
                        <Stop offset="0%" stopColor={dark ? '#16434B' : '#B8DCE7'} stopOpacity={dark ? 0.32 : 0.42} />
                        <Stop offset="100%" stopColor={dark ? '#12323A' : '#DAE8F2'} stopOpacity="0" />
                    </RadialGradient>
                    <RadialGradient id="ambient-lower" cx="47%" cy="100%" r="62%">
                        <Stop offset="0%" stopColor={dark ? '#172A4A' : '#CBD8F1'} stopOpacity={dark ? 0.28 : 0.34} />
                        <Stop offset="100%" stopColor={dark ? '#172A4A' : '#CBD8F1'} stopOpacity="0" />
                    </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100" height="230" fill={base} />
                <Rect x="0" y="0" width="100" height="230" fill="url(#ambient-blue)" />
                <Rect x="0" y="0" width="100" height="230" fill="url(#ambient-cool)" />
                <Rect x="0" y="0" width="100" height="230" fill="url(#ambient-lower)" />
            </Svg>
        </View>
    );
});
