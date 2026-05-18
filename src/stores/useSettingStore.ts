// src/store/useSettingStore.ts
// 这里面放的是设置相关的信息，比如自动播放，快进倍速，选中的频道ID等
import { create } from 'zustand';

interface SettingState {
    followSystemTheme: boolean;
    setFollowSystemTheme: (follow: boolean) => void;
    isDarkMode: boolean;
    setDarkMode: (isDark: boolean) => void;
    themeColor: string; // 主题颜色
    setThemeColor: (color: string) => void; // 设置主题颜色的函数

    disableAnimations: boolean; // 是否关闭动画
    setDisableAnimations: (disabled: boolean) => void; // 设置是否关闭动画

    cookie: string; // 自定义 cookie
    setCookie: (cookie: string) => void; // 设置 cookie

    isAds: boolean; // 是否开启广告过滤
    isPaid: boolean; // 是否开启付费内容过滤

    mode: 'normal' | 'card' ; 
    setMode: (mode: 'normal' | 'card') => void; // 设置模式的函数
}

export const useSettingStore = create<SettingState>((set) => ({

    // 主题设置
    followSystemTheme: false,
    setFollowSystemTheme: (follow) => set({followSystemTheme: follow}),
    isDarkMode: false, // 默认不是暗黑模式
    setDarkMode: (isDark) => set({isDarkMode: isDark}),
    themeColor: '#007AFF', // 默认主题颜色
    setThemeColor: (color: string) => set({themeColor: color}),

    disableAnimations: false,
    setDisableAnimations: (disabled) => set({disableAnimations: disabled}),

    cookie: '',
    setCookie: (cookie) => set({cookie}),

    isAds: false, // 是否开启广告过滤
    isPaid: false, // 是否开启付费内容过滤

    mode: 'normal', // 默认模式
    setMode: (mode: 'normal' | 'card') => set({mode}),

}));