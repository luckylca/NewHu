// src/stores/useSettingStore.ts
// 这里面放的是设置相关的信息，比如自动播放，快进倍速，选中的频道ID等
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SettingState {
    followSystemTheme: boolean;
    setFollowSystemTheme: (follow: boolean) => void;
    isDarkMode: boolean;
    setDarkMode: (isDark: boolean) => void;

    wallpaperUri: string | null;
    setWallpaperUri: (uri: string | null) => void;
    wallpaperOpacity: number;
    setWallpaperOpacity: (opacity: number) => void;
    wallpaperBlur: number;
    setWallpaperBlur: (blur: number) => void;

    disableAnimations: boolean; // 是否关闭动画
    setDisableAnimations: (disabled: boolean) => void; // 设置是否关闭动画

    cookie: string; // 自定义 cookie
    setCookie: (cookie: string) => void; // 设置 cookie

    isAds: boolean; // 是否开启广告过滤
    isPaid: boolean; // 是否开启付费内容过滤
    setAds: (enabled: boolean) => void;
    setPaid: (enabled: boolean) => void;

    mode: 'normal' | 'card';
    setMode: (mode: 'normal' | 'card') => void; // 设置模式的函数
}

export const useSettingStore = create<SettingState>()(
    persist(
        (set) => ({

            // 主题设置
            followSystemTheme: false,
            setFollowSystemTheme: (follow) => set({ followSystemTheme: follow }),
            isDarkMode: false, // 默认不是暗黑模式
            setDarkMode: (isDark) => set({ isDarkMode: isDark }),
            wallpaperUri: null,
            setWallpaperUri: (uri) => set({ wallpaperUri: uri }),
            wallpaperOpacity: 0.82,
            setWallpaperOpacity: (opacity) => set({ wallpaperOpacity: opacity }),
            wallpaperBlur: 8,
            setWallpaperBlur: (blur) => set({ wallpaperBlur: blur }),

            disableAnimations: false,
            setDisableAnimations: (disabled) => set({ disableAnimations: disabled }),

            cookie: '',
            setCookie: (cookie) => set({ cookie }),

            isAds: true,
            isPaid: true,
            setAds: (enabled) => set({ isAds: enabled }),
            setPaid: (enabled) => set({ isPaid: enabled }),

            mode: 'normal', // 默认模式
            setMode: (mode) => set({ mode }),

        }),
        {
            name: 'setting-store',
            storage: createJSONStorage(() => AsyncStorage),
            // 所有设置字段都是可序列化的，整体持久化即可
        }
    )
);
