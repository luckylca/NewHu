/**
 * 应用主题（纯自定义 MD3 配色，无第三方主题库）
 *
 * 组件库（src/components/ui）与页面统一通过 ThemeProvider 提供的 useTheme() 读取。
 * 颜色语义沿用原 MD3 命名（primary / onSurfaceVariant / surfaceVariant ...），
 * 保证迁移后各页面 theme.colors.XXX 的访问点无需改动。
 */

import { Platform } from 'react-native';

export interface ElevationColors {
    level0: string;
    level1: string;
    level2: string;
    level3: string;
    level4: string;
    level5: string;
}

export interface ThemeColors {
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondary: string;
    onSecondary: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    tertiary: string;
    onTertiary: string;
    tertiaryContainer: string;
    onTertiaryContainer: string;
    error: string;
    onError: string;
    errorContainer: string;
    onErrorContainer: string;
    background: string;
    onBackground: string;
    surface: string;
    onSurface: string;
    surfaceVariant: string;
    onSurfaceVariant: string;
    surfaceDisabled: string;
    onSurfaceDisabled: string;
    outline: string;
    outlineVariant: string;
    shadow: string;
    inverseSurface: string;
    inverseOnSurface: string;
    elevation: ElevationColors;
    // React Navigation 需要的语义色（导航主题直接取用）
    card: string;
    text: string;
    border: string;
    notification: string;
}

export interface FontStyle {
    fontFamily: string;
    fontWeight: '400' | '500' | '700' | '800';
}

export interface AppTheme {
    dark: boolean;
    colors: ThemeColors;
    // 与 React Navigation v7 的 fonts 结构一致（regular/medium/bold/heavy）
    fonts: {
        regular: FontStyle;
        medium: FontStyle;
        bold: FontStyle;
        heavy: FontStyle;
    };
}

// 主色：Violet-600，现代 M3 风格紫罗兰
const BRAND_PRIMARY = '#7C3AED';

const fonts = {
    regular: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' })!, fontWeight: '400' as const },
    medium: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' })!, fontWeight: '500' as const },
    bold: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' })!, fontWeight: '700' as const },
    heavy: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' })!, fontWeight: '800' as const },
};

export const lightTheme: AppTheme = {
    dark: false,
    colors: {
        primary: BRAND_PRIMARY,
        onPrimary: '#FFFFFF',
        primaryContainer: '#EDE9FE',
        onPrimaryContainer: '#3B0764',
        secondary: '#5D5F72',
        onSecondary: '#FFFFFF',
        secondaryContainer: '#E8E7F5',
        onSecondaryContainer: '#1A1B2C',
        tertiary: '#6A5C9A',
        onTertiary: '#FFFFFF',
        tertiaryContainer: '#E8DEFF',
        onTertiaryContainer: '#231945',
        error: '#BA1A1A',
        onError: '#FFFFFF',
        errorContainer: '#FFDAD6',
        onErrorContainer: '#410002',
        background: '#FFFFFF',
        onBackground: '#1C1B21',
        surface: '#FFFFFF',
        onSurface: '#1C1B21',
        surfaceVariant: '#F3EDF7',
        onSurfaceVariant: '#49454F',
        surfaceDisabled: 'rgba(28,27,31,0.12)',
        onSurfaceDisabled: 'rgba(28,27,31,0.38)',
        outline: '#79747E',
        outlineVariant: '#CAC4D0',
        shadow: '#000000',
        inverseSurface: '#322F35',
        inverseOnSurface: '#F5EFF7',
        elevation: {
            level0: '#FFFFFF',
            level1: '#F7F2FA',
            level2: '#F3EDF7',
            level3: '#ECE6F0',
            level4: '#EAE4EE',
            level5: '#E7E0E8',
        },
        card: '#FFFFFF',
        text: '#1C1B21',
        border: '#79747E',
        notification: '#BA1A1A',
    },
    fonts,
};

export const darkTheme: AppTheme = {
    dark: true,
    colors: {
        primary: '#C9B7FF',
        onPrimary: '#3F1F6E',
        primaryContainer: '#5B2E9E',
        onPrimaryContainer: '#EDE4FF',
        secondary: '#C7C5DD',
        onSecondary: '#2F2F41',
        secondaryContainer: '#46465A',
        onSecondaryContainer: '#E3E1F9',
        tertiary: '#CDBDFF',
        onTertiary: '#34294B',
        tertiaryContainer: '#4A3D63',
        onTertiaryContainer: '#E8DEFF',
        error: '#FFB4AB',
        onError: '#690005',
        errorContainer: '#93000A',
        onErrorContainer: '#FFDAD6',
        background: '#121212',
        onBackground: '#E6E1E6',
        surface: '#121212',
        onSurface: '#E6E1E6',
        surfaceVariant: '#2A282E',
        onSurfaceVariant: '#CAC4D0',
        surfaceDisabled: 'rgba(230,225,230,0.12)',
        onSurfaceDisabled: 'rgba(230,225,230,0.38)',
        outline: '#938F99',
        outlineVariant: '#49454F',
        shadow: '#000000',
        inverseSurface: '#E6E0E9',
        inverseOnSurface: '#322F35',
        elevation: {
            level0: '#121212',
            level1: '#1C1B1F',
            level2: '#211F24',
            level3: '#262429',
            level4: '#28272C',
            level5: '#2C2B30',
        },
        card: '#121212',
        text: '#E6E1E6',
        border: '#938F99',
        notification: '#FFB4AB',
    },
    fonts,
};
