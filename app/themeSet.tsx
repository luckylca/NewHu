import { useSettingStore } from '@/src/stores/useSettingStore';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Appbar, Surface, Switch, Text, useTheme } from 'react-native-paper'; // Note: Paper doesn't export Slider, using community one below

const COLOR_PRESETS = [
    '#4F46E5', // Indigo (Default)
    '#6750A4', // Purple 
    '#006C4C', // Green
    '#9C4146', // Red
    '#00639B', // Blue
    '#7D5260', // Pink/Terra
    '#FF8F00', // Orange
];

const ThemeSetScreen = ({ navigation }: any) => {
    const router = useRouter();

    const theme = useTheme();

    // Store State
    const followSystemTheme = useSettingStore((state) => state.followSystemTheme);
    const setFollowSystemTheme = useSettingStore((state) => state.setFollowSystemTheme);
    const isDarkMode = useSettingStore((state) => state.isDarkMode);
    const setDarkMode = useSettingStore((state) => state.setDarkMode);
    const themeColor = useSettingStore((state) => state.themeColor);
    const setThemeColor = useSettingStore((state) => state.setThemeColor);

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
                <Surface style={[styles.card, { backgroundColor: theme.colors.surfaceVariant, opacity: 0.9,marginTop: 16 }]} elevation={1}>
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

                {/* 3. Theme Color Picker */}
                <Surface style={[styles.card, { backgroundColor: theme.colors.surfaceVariant, marginTop: 16, opacity: 0.9 }]} elevation={0}>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 16 }}>主题颜色</Text>
                    <View style={styles.colorRow}>
                        {COLOR_PRESETS.map((color) => {
                            const isSelected = themeColor === color;
                            return (
                            <TouchableOpacity
                                key={color}
                                style={[
                                    styles.colorCircle,
                                    { backgroundColor: color,borderColor: isSelected ? theme.colors.primary : 'transparent',overflow: 'hidden' },
                                    isSelected && styles.selectedColorCircle,
                                
                                ]}
                                onPress={() => setThemeColor(color)}
                            >
                                {isSelected && (
                                    <View style={styles.checkMark} />
                                )}
                            </TouchableOpacity>
                        )})}
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
    colorRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    colorCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    selectedColorCircle: {
        borderWidth: 3,
        borderColor: 'white', // Needs contrast check, using white for now as it's common for selection rings
    },
    checkMark: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'white',
    },
});

export default ThemeSetScreen;
