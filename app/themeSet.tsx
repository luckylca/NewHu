import { useSettingStore } from '@/src/stores/useSettingStore';
import { Appbar, Surface, Switch, Text } from '@/src/components/ui';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

const ThemeSetScreen = ({ navigation }: any) => {
    const router = useRouter();

    const theme = useTheme();

    // Store State
    const followSystemTheme = useSettingStore((state) => state.followSystemTheme);
    const setFollowSystemTheme = useSettingStore((state) => state.setFollowSystemTheme);
    const isDarkMode = useSettingStore((state) => state.isDarkMode);
    const setDarkMode = useSettingStore((state) => state.setDarkMode);

    return (
        <View style={[styles.container, { backgroundColor: 'transparent' }]}>
            <Appbar.Header style={{ backgroundColor: 'transparent' }}>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title="主题设置" />
            </Appbar.Header>

            <ScrollView contentContainerStyle={styles.content}>

                {/* 1. Follow System Theme */}
                <Surface style={[styles.card, { backgroundColor: theme.colors.surfaceVariant, opacity: 0.9 }]} elevation={1}>
                    <View style={styles.row}>
                        <View>
                            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>跟随系统</Text>
                            <Text variant="bodySmall" style={{ opacity: 0.7 }}>自动切换黑夜/白天模式</Text>
                        </View>
                        <Switch value={followSystemTheme} onValueChange={setFollowSystemTheme} color={theme.colors.primary} />
                    </View>
                </Surface>

                {/* 2. Dark Mode Toggle */}
                <Surface style={[styles.card, { backgroundColor: theme.colors.surfaceVariant, opacity: 0.9, marginTop: 16 }]} elevation={1}>
                    <View style={styles.row}>
                        <View>
                            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>黑夜模式</Text>
                            <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                                {followSystemTheme ? '已由系统控制' : '切换应用为深色外观'}
                            </Text>
                        </View>
                        <Switch
                            value={isDarkMode}
                            onValueChange={setDarkMode}
                            color={theme.colors.primary}
                            disabled={followSystemTheme}
                        />
                    </View>
                </Surface>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    card: {
        padding: 16,
        borderRadius: 16,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});

export default ThemeSetScreen;
