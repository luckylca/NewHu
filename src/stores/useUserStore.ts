// src/store/useUserStore.ts
// 这里面放的是用户相关的信息，以后是可以做数据同步，主要是channel和账号相关内容
import { create } from 'zustand';

interface UserState {
    cookies?: string;
    setCookie: (cookie: string) => void;
    username: string;
    isLoggedIn: boolean;
    login: (name: string, cookie: string) => void;
    logOut?: () => void;
}

export const useUserStore = create<UserState>((set) => ({
    username: '',
    cookies: undefined,
    isLoggedIn: false,
    setCookie: (cookie: string) => set({ cookies: cookie }),
    login: (name: string, cookie: string) => set({ username: name, cookies: cookie, isLoggedIn: true }),
    logOut: () => set({ username: '', cookies: undefined, isLoggedIn: false }),
}));