// src/store/useSettingStore.ts
// 这里面放的是设置相关的信息，比如自动播放，快进倍速，选中的频道ID等
import {create} from 'zustand';

interface SettingState {
    isDarkMode: boolean;
    setDarkMode: (isDark: boolean) => void;
    themeColor: string; // 主题颜色
    setThemeColor: (color: string) => void; // 设置主题颜色的函数
    backgroundImage: string; // 背景图片URL
    setBackgroundImage: (url: string) => void; // 设置背景图片URL的函数
    backgroundOpacity: number; // 背景图片的透明度
    setBackgroundOpacity: (opacity: number) => void; // 设置背景图片透明度的函数

    disableAnimations: boolean; // 是否关闭动画
    setDisableAnimations: (disabled: boolean) => void; // 设置是否关闭动画

    cookie: string; // 自定义 cookie
    setCookie: (cookie: string) => void; // 设置 cookie

    isAds: boolean; // 是否开启广告过滤
    isPaid: boolean; // 是否开启付费内容过滤
}

export const useSettingStore = create<SettingState>((set) => ({

    // 主题设置
    isDarkMode: false, // 默认不是暗黑模式
    setDarkMode: (isDark) => set({isDarkMode: isDark}),
    themeColor: '#007AFF', // 默认主题颜色
    setThemeColor: (color: string) => set({themeColor: color}),

    backgroundImage: '', // 背景图片URL
    setBackgroundImage: (url: string) => set({backgroundImage: url}),
    backgroundOpacity: 0.5, // 背景图片的透明度
    setBackgroundOpacity: (opacity: number) => set({backgroundOpacity: opacity}),

    disableAnimations: false,
    setDisableAnimations: (disabled) => set({disableAnimations: disabled}),

    cookie: '',
    setCookie: (cookie) => set({cookie}),

    isAds: false, // 是否开启广告过滤
    isPaid: false, // 是否开启付费内容过滤

}));