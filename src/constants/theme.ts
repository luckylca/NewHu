import tinycolor from 'tinycolor2';
import { MD3LightTheme,MD3DarkTheme } from 'react-native-paper';

// 只需要定义一个主色
const BRAND_PRIMARY = '#4F46E5'; 

// 自动生成辅助色函数
const generateColorPalette = (primary:any) => ({
  primary: primary,
  // 自动生成浅 80% 的颜色作为 Container
  primaryContainer: tinycolor(primary).lighten(40).toHexString(),
  // 自动生成互补色或类比色作为 Secondary
  secondary: tinycolor(primary).spin(30).darken(10).toHexString(),
  // 这里的逻辑可以根据需要无限扩展
});

const palette = generateColorPalette(BRAND_PRIMARY);

export const AppLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...palette, // 自动填充生成的颜色
    background: '#FFFFFF',
  },
};

export const AppDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...palette, // 自动填充生成的颜色
    background: '#121212',
  },
};