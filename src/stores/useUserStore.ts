// src/store/useUserStore.ts
// 这里面放的是用户相关的信息，以后是可以做数据同步，主要是channel和账号相关内容
import { create } from 'zustand';

interface UserState {
    cookies?: string;
    setCookie: (cookie: string) => void;
    username: string;
    avatar:string;
    isLoggedIn: boolean;
    login: (name: string, cookie: string, avatar: string) => void;
    logOut?: () => void;
}

export const useUserStore = create<UserState>((set) => ({
    username: 'lcaluckily',
    cookies: 'BEC=d6322fc1daba6406210e61eaa4ec5a7a; z_c0=2|1:0|10:1771141555|4:z_c0|92:Mi4xYkpWMVJ3QUFBQUJpY2RTcVppVFlHeVlBQUFCZ0FsVk5zOGQtYWdDRmtOMkx6ZDRLR0NYdXpRNnBsbzRMdE05NTR3|06659700a7fe5232ad240f375334aaea2d4e7dde8358f292b90da1d39b0bd6ac; assva6=U2FsdGVkX189luZqqc27WiA5tOZVflEcfR0cqRY+4SI=; vmce9xdq=U2FsdGVkX1/GcP0+0BrtPHaPOMwyu7SY6e7geM3jwExzZ8a67m8oxKYXtxyzhZ/uBULrBdUldEWiMoFW0tmkX4lYTxaMLUjP44apb84lmfmW0FI/awivAnY7eLVocM17GOlCylD01yzgMa5LISvM0ZWY1Wz351UF8mLvx+aHpOg=; cmci9xde=U2FsdGVkX1+eGPn5PRytzbakJpDcbHPpeOUwkSLntPZWhGE8D2BF8yY8mMPC/NMcveXv7syuMUi2vmtTzf+5lg==; __snaker__id=fqfDCrLoAg0nMZMa; JOID=VFEcAk0_BytpgaMJT1WcsJIfqNFbYjVsCuLqWQxuYE0RzddRKaV2tQeOrAFAoEYLIObBkgJM8GTSgNKboYAHhJo=; captcha_ticket_v2=2|1:0|10:1771141534|17:captcha_ticket_v2|728:eyJ2YWxpZGF0ZSI6IkNOMzFfZzVzeWxhYmlyZlU4VVZwa0ZLQWJiLjVFSkRTNE1EaTltRXpIVlgqVnE1WGMuNWg5Nml4OXVLWllfeHVWRElrUE5WWVoyOXdDMTNOdDN0aHNRa04qcVNxLkoucnhBVUllY1djd29sMTAuUmlPcjhTSGszVS5rcXp0ZUI1V0tERW9sT1I4V2luT2pIMnlJSTNOQWl5MjV2MmQ0QUJQSlNlMVFqMlJkenNsSjVSMmlKZDJUM2RvanpIWGhGemJ6TmhnM2lkb0RIa3NOTmdhcVNxa084MXY0bmQwdXRqeEFkelUycFJ2NTJtenNHU2VYOVNUR3NGYzlabjNTaTRDVDZIOHJhTEZzKlFkalBUUmh0Wmpkc2lGRzlXTk9pOGhKZnhhcVdsVHV2U2VEY2NaUjQ0ZjBYVTMzLlhrQ2JBRzlsTE9jT0wzaEpWb3V6d3JHaG1pMzFqT3Zqc2J6UWJmaE5PUGZLKjFtV1N5Mzlpbmx6ZkJZNC52UF9FdXVmcno1MGxQc09wSVphOUV0QW9MUmhzQ1ZYUEhKS0MqdzRBRkZua0Iuc0gycmFPaU5iUXVjLk95UkFtSjVDdEE2S2RQNXV1TU1fS1ZHQUhpTmc2YU81djJIUy5DTCo5RF85SWtqajVEQ0JpeG1ZcHBPMEdHMW9BdXpudThVYUEqajZTcUtFSmIuOGtFNFg3N192X2lfMSJ9|8ffcc3e98ab7c23e1d2349001682a2bbb0761da96ed5af4ecaa7fad3789f92fd; SESSIONID=R2OdcFPKQhfpKtWfOwYjyR2e4WtWzFsYD13qVRkG7UP; Hm_lpvt_98beee57fd2ef70ccdd5ca52b9740c49=1771141557; DATE=1771068168246; captcha_session_v2=2|1:0|10:1771141525|18:captcha_session_v2|88:QXdzZlROOVgycmdMYWJrczZRSkdmU0VTRjFpSUcyNnZTNGRNTVVoZjM2RXdyazRVbDgwZmZ2cjZkY2hnQXJzNg==|5b99ae7b5622fa47df9cf7c5573e057e151e470190649680f09f9dea55c75f9d; gdxidpyhxdE=r230dozYT%2B9jY2OPCMBA%2FvspILzlQ%2BYq9%5C00If1gaDLrsVy7pOcOYoIvJ7L1BCViAsSP3vygjG4sZh2XtWVzI4aGiCiwLZDDDsSBOb4pIfDz%5CD%2FfgwTrRu0vwwHMn7SlyVJ5pX%5Cr6BTJjE4qy%2FVGuEaQkbfI4d%2F36sgQzLt4Yk0TGEM3%3A1771142425811; pmck9xge=U2FsdGVkX1+qQpYBV1J9p/1eZug7Nlch3tzjxanuR8E=; d_c0=YnHUqmYk2BuPTlOM8-0d0eYbKAT1Yk8LKAA=|1771141524; _xsrf=c6481240-3acb-453f-950c-4fd9b4b30c0e; HMACCOUNT=2B64DFB638595ABA; crystal=U2FsdGVkX19AXkpwzSx49nWv1TH9E/UEf9IG+LgzGU53WRikc19twHx6DFdHULEsZ1RhZioSFB4DfjyLp9IBx6Jwb+beIbVwpAxsb3n2kAiTyEyUf8SnOrVQCC+OUSAq/AuNnd2nh7EkUPNDbPtH3yICANtj114Iv9i5MSR4mOHUUhBhaSkQJ8SK+oqD93HrfSB/XTIdDz5cYQR+x+gnVfIZJsC9IdK+EQlGbFEQgCy3BDr9yWUonlRKa3iE83JK; Hm_lvt_98beee57fd2ef70ccdd5ca52b9740c49=1771071712,1771071783,1771140604,1771141524; osd=VVsTA08-DSRog6IDQFSesZgQqdNaaDptCOPgVg1sYUcezNVQI6p3twaEowBCoUwEIeTAmA1N8mXYj9OZoIoIhZg=; assva5=U2FsdGVkX19CZRVHzMrG3LCz/hGj/87SXSc36mqSesze1V3MJqY10OkYdw+Hfzc6fGFtmgVzx8EPrjbmcsnnKQ==; _zap=8729821d-2163-4655-b3ea-95e09c0ec2c4',
    avatar: 'https://picx.zhimg.com/v2-1abe7b115ea0ab9e5dfe334d5a1fef38_r.jpg',
    isLoggedIn: false,
    setCookie: (cookie: string) => set({ cookies: cookie }),
    login: (name: string, cookie: string, avatar: string) => set({ username: name, cookies: cookie, avatar: avatar, isLoggedIn: true }),
    logOut: () => set({ username: '', cookies: undefined, avatar: '', isLoggedIn: false }),
}));