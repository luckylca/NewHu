import { HyperGlowBackground } from '@/src/components/effects/HyperGlowBackground';
import { Card, Text, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function HyperGlowDemoScreen() {
    const theme = useTheme();

    return (
        <View style={styles.root}>
            <HyperGlowBackground />
            <TopAppBar title="动态柔光预览" back={() => router.back()} />
            <View style={styles.content}>
                <Card feedback="sink" contentStyle={styles.card}>
                    <Text type="title2" weight="bold" color="#1C1C1E">Hyper Glow</Text>
                    <Text type="body1" color="rgba(28,28,30,0.66)" style={styles.summary}>
                        粉色、蓝色与白色柔光在磨砂材质下缓慢融合。
                    </Text>
                    <Text type="footnote1" color="rgba(28,28,30,0.48)" style={{ marginTop: theme.spacing.lg }}>
                        系统开启“减少动态效果”后会自动保持静态。
                    </Text>
                </Card>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#FBFBFD',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 28,
    },
    card: {
        padding: 24,
        backgroundColor: 'rgba(255,255,255,0.82)',
    },
    summary: {
        marginTop: 10,
        lineHeight: 25,
    },
});
