import { 
  MD3LightTheme, 
  MD3DarkTheme, 
  adaptNavigationTheme 
} from 'react-native-paper';
import { 
  DefaultTheme as NavigationDefaultTheme, 
  DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';

// 1. 定义品牌色
const brandColor = '#4F46E5'; 

// 2. 将 React Navigation 的主题转换为适配 Paper 的格式
const { LightTheme: AdaptedLightTheme, DarkTheme: AdaptedDarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

// 3. 构建最终的浅色主题
export const AppLightTheme = {
  ...MD3LightTheme,
  ...AdaptedLightTheme, // 引入适配后的导航主题配置
  colors: {
    ...MD3LightTheme.colors,
    ...AdaptedLightTheme.colors,
    // 你的自定义颜色覆盖
    primary: brandColor,
    primaryContainer: '#E0E7FF',
    secondary: '#4338CA',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    elevation: {
        ...MD3LightTheme.colors.elevation,
        level3: '#F8FAFC',
    },
  },
  // 关键修复：强制使用 Paper 的 MD3 字体配置，忽略 Navigation 的字体
  fonts: MD3LightTheme.fonts, 
};

// 4. 构建最终的深色主题
export const AppDarkTheme = {
  ...MD3DarkTheme,
  ...AdaptedDarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...AdaptedDarkTheme.colors,
    // 你的自定义颜色覆盖
    primary: '#818CF8', // 深色模式提亮
    primaryContainer: '#312E81',
    secondary: '#6366F1',
    background: '#0F172A', // 深蓝灰背景
    surface: '#1E293B',
    elevation: {
        ...MD3DarkTheme.colors.elevation,
        level3: '#1E293B',
    },
  },
  // 关键修复：强制使用 Paper 的 MD3 字体配置
  fonts: MD3DarkTheme.fonts,
};