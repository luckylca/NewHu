// src/store/useUserStore.ts
// 这里面放的是用户相关的信息，以后是可以做数据同步，主要是channel和账号相关内容
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface UserState {
    cookies?: string;
    setCookie: (cookie: string) => void;
    username: string;
    avatar:string;
    isLoggedIn: boolean;
    login: (name: string, cookie: string, avatar: string) => void;
    logOut: () => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
        username: 'lcaluckily',
        cookies: 'BEC=5ee33e0856ed13c879689106c041a08d; z_c0=2|1:0|10:1779118308|4:z_c0|92:Mi4xYkpWMVJ3QUFBQUFjOUpkZVN3RlBIQ1lBQUFCZ0FsVk41SDc0YWdEaS1wRVBDZ2R5aHUwR2JNZ3NVbk8yQU4tbzRn|6b8e5da23f6b3a629ec6add9fe2481d50d870363728382eb573a966a28678081; vmce9xdq=U2FsdGVkX1+oNf+DSnzk60Al45tfO1DixhIrqiIal9Gd5yFk3DMHNYYQLXvlF0BHC9MmBqf27kaQpJJUi25t9hpZMwg6e8U7knWswBom3kjmi8wSCqrW+yK+rUu5lF/jYjGmQPj3G08U9aiYMk1Vh5GX5xh/pcPZ62vZ2n4Qk9I=; cmci9xde=U2FsdGVkX19f8A2CUDTTGA3fXoUPQlb86NUHncS+y8t4GgHZ9yz1z7P/JugEn58SDygzhntltBkOEkgdax7jDw==; __snaker__id=C6HoVatKAH02wWnC; JOID=UlgXB0lGVB98UXewDi_CiYvAf2UXFid0KRolwXwwMHIoOB_9a4FgFBJTdbQO6CSdI3xAV-_1kQA4Jkr2uPX-6p8=; _zap=aed6e473-399f-465d-8431-c3a9f2fd7d15; assva5=U2FsdGVkX1+7dDexws/83ECFfkuvd60bJ2Xn4hPoOyzodEJDJFRTdxVuLI7HaXtNHxEqDnXibPwIf+NNjmK4SQ==; Hm_lpvt_98beee57fd2ef70ccdd5ca52b9740c49=1779118311; DATE=1771068168246; captcha_ticket_v2=2|1:0|10:1779118291|17:captcha_ticket_v2|728:eyJ2YWxpZGF0ZSI6IkNOMzFfU1p2cSp6WDEyZ0FGMGZsKmx4Y1ByV1hueTlQVHFhQmVlVDBpNFFzWl9YOGR6RkZqTjJtQzBGZlZGemtsNGM4a0IyNjA4T2JUSUprQzljeEtrZFh3TjFleGVSU0FmVWtlKmJUc0c1NVo4NjZ2SzNyQmhONTRJME0yVWFNMlhkUVh6TmlvdSp6WFEwRm15OGhRa1JQdmlFelFjWWsqZU5aTXhQUlVxcWhBb1ZHTjBfbVNkKmtXalZQT1NjVGtIYXhPeEJQdk1ud1lXY2JpTi5WdUpwcHVtTjAzLlJ2ckNaMUtwbWl3SzlkVENjeUhIYjFTWk81MThhNFlTd3RWWWxRYjhMRUZfdGZBVzNXaXpqQ2VxbGdsVndsMjUqSk12NEJsTE10V1FKbDBNbFZSZkgybzEwcTh3WE1aakFwdlUqMEVyVFZSNE50ekhyTTJMOHJOeXpGQ2RVTmJ0dlZ1YmZmb21NU3VsenpWNjVRa2ZhT2NqSXdvTjhFdDR6STlBRklnWVBFSypYZFc1QzNVWjlMNmhnWFdZeUNodEQ0RUcuZTA2QXp0RmlDcUJDenFLODFTYzllZ0ZFaERTZEw0ZU1yRkt0el9PMkZWbjhXWmtSWGJuVTVWSkhPMlRFb0hGS0YuQnRyNEFHYTBGd1EwZl90clpzTFloQ3U2d0tiaTZfVTh0NnN3a003N192X2lfMSJ9|67ff8de571daa410ad15fcb4bc6c5f2539d57d788bcb6324a7723b00a603e5f6; SESSIONID=PqmSIRsttdoRojMg7Tn3POYJleKWJoiM9B7Xonca9bf; assva6=U2FsdGVkX19PMNrSmyClVCdUGBIj29Omofl2Ct/JFaY=; captcha_session_v2=2|1:0|10:1779118277|18:captcha_session_v2|88:cXNnZFBYUmsvaDd5UDVjdjM4dURQTmMzeG40cDlHRkNwUHBlblNsc0lwRmtOZUQ2clN0UC82RlBZMEo0d3V3Yg==|028115ce98d48b5a13727ee9eb6d3b53dfa91e493c477cc10fc76fc89f19dc81; gdxidpyhxdE=U7lTakHkpvlSrrT6GQ%5CV1yKSAkkSnPd6fL773UMdXH28n5poqpyIVNOAvU0HOWAj8QjGve1YkpmtYPPImGi6evzY5mG%2BrIKo0P1HTeAWT9khJGWLbYLhJ%2Fhe4cZQsxoCJEmaoMT4nxi%2Bre6cbTn3D1LeL7sO71WquDdI9uXcKsLsz0RS%3A1779119178495; pmck9xge=U2FsdGVkX1+z8NdALeLKdb6M1fQWT+mq2aXIvRPat4s=; d_c0=HPSXXksBTxyPTnD5U6LfmB6Y4Gk3yQvO9mE=|1779118276; _xsrf=b8e29a2f-6e7f-4778-a9f9-ada888ba25e6; HMACCOUNT=5463A49DB75A3111; crystal=U2FsdGVkX19AXkpwzSx49nWv1TH9E/UEf9IG+LgzGU53WRikc19twHx6DFdHULEsZ1RhZioSFB4DfjyLp9IBx6Jwb+beIbVwpAxsb3n2kAiTyEyUf8SnOrVQCC+OUSAq/AuNnd2nh7EkUPNDbPtH3yICANtj114Iv9i5MSR4mOHUUhBhaSkQJ8SK+oqD93HrfSB/XTIdDz5cYQR+x+gnVfIZJsC9IdK+EQlGbFEQgCy3BDr9yWUonlRKa3iE83JK; osd=VFAVC0hAXB1wUHG4DCPDj4PCc2QRHiV4KBwtw3AxNnoqNB77Y4NsFRRbd7gP7iyfL31GX-35kAYwJEb3vv385p4=; Hm_lvt_98beee57fd2ef70ccdd5ca52b9740c49=1779117922,1779118277',
        avatar: 'https://picx.zhimg.com/v2-1abe7b115ea0ab9e5dfe334d5a1fef38_r.jpg',
        isLoggedIn: false,
        setCookie: (cookie: string) => set({ cookies: cookie }),
        login: (name: string, cookie: string, avatar: string) => set({ username: name, cookies: cookie, avatar: avatar, isLoggedIn: true }),
        logOut: () => set({ username: '', cookies: undefined, avatar: '', isLoggedIn: false }),
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