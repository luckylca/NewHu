// src/store/useUserStore.ts
// 用户账号与登录状态；Cookie 只保存在设备存储中，不写入源码。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface UserState {
    cookies?: string;
    setCookie: (cookie: string) => void;
    username: string;
    avatar: string;
    isLoggedIn: boolean;
    login: (name: string, cookie: string, avatar: string) => void;
    logOut: () => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            cookies: undefined,
            username: 'lcaluckily',
            avatar: 'https://picx.zhimg.com/v2-1abe7b115ea0ab9e5dfe334d5a1fef38_r.jpg',
            isLoggedIn: false,
            setCookie: (cookie) => set({ cookies: cookie }),
            login: (name, cookie, avatar) => set({
                username: name,
                cookies: cookie,
                avatar,
                isLoggedIn: true,
            }),
            logOut: () => set({
                username: '',
                cookies: undefined,
                avatar: '',
                isLoggedIn: false,
            }),
        }),
        {
            name: 'user-store',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                cookies: state.cookies,
                username: state.username,
                avatar: state.avatar,
                isLoggedIn: state.isLoggedIn,
            }),
        }
    )
);
