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
    cookies: 'BEC=04678b89b8500afc30b012aad143c9b0; z_c0=2|1:0|10:1771663838|4:z_c0|92:Mi4xYkpWMVJ3QUFBQUJoWjVRT3otemZHeVlBQUFCZ0FsVk4zci1HYWdEQnJDdFk3dFIwQUNxTTVIdWJmeUlzWG9YRXJR|06fa96b96309ad238115495d178449f4a90fe196cd11a41db9e1cd2ebf5f5086; __snaker__id=o394Ze98EoxLu1m6; JOID=UV0XBU_A23Uph23ZPahO4NkQZA8nhb0zf9Qvl0qXiz9-wl2TcA-p6kWGbNo7CuBp6skMMTfkCx8GXIkRxUIRoEk=; vmce9xdq=U2FsdGVkX19S8gRSmSHmSq6JlTtDZWxn+FNCuJyIvxmcOp0Mmm4xhCQq5nKhL9fIO8U7qQomxi9MWJ4VGwM3PtGsBXAeEeqlFgpOZRchzv6CO2ECbp12ytYMUwwathzOJbe0y207YT5nKvfxOCdv4ofCAcXKqdVCf3VDpsnamT8=; cmci9xde=U2FsdGVkX1/TDFTeM5GFtrELCAm7OnQVnJd4yS3lERnqx6IvOQWg+aqnu11gYEhZXOc2e1SwHITG2GouHi5kjQ==; _zap=18096d4e-16ee-43fa-b0db-b8293413e19d; assva5=U2FsdGVkX19LTIjKrrqa5EbJmNtqqOplsKLu4dIAwYnj0h60rRt7tj8IHWiRvS3RpjUOZzJPbO41SBYn7crw2w==; captcha_session_v2=2|1:0|10:1771663823|18:captcha_session_v2|88:amgxQXhCdDhpNC83TXJ5Vy96K1Rnb0EzbWR3Zk9qZFMwQUJqcXQ0UE9kR2g3dngvaHVYb29admRoNHdDcXdmLw==|e8fe3eafca1646f9dae07679e898a777c5fe97f8c04fd593fc443a3e5c53f5f4; assva6=U2FsdGVkX18vpdifQHx7/NGSrimIWDjFm4eWzF4dRbA=; Hm_lpvt_98beee57fd2ef70ccdd5ca52b9740c49=1771663841; DATE=1771068168246; captcha_ticket_v2=2|1:0|10:1771663827|17:captcha_ticket_v2|728:eyJ2YWxpZGF0ZSI6IkNOMzFfM3FzVHNlbnZvM3EuNXkxSFdsLnBsR3BJRyo1Qk9pRkpqS2xSZy5GX0p3T3VLTUd6VUVLYlNSQnQ2bVFUdmJyWGtIeGlEZ0pUNC56YTZKZm15U0o0MkFCb2g4QWl3a2pyS3ZPYTg2eVpVTG9rTUJISHcxZ0tsb0tFaklWOEVmenpCT1k4TFExUjRncXBXTFNpUlFodE4qaXhrVWl1SDh6bEVjMmNDOXo0bUxKaWlTeTBqQWFoWXFBWURfMkxQS1RBUFN2UVFWeC4qcl9OTlVVbzBDNFRDQTA2bGt3TlJXSXNXTU5fRjM0WjNmMEU0T25CUzFBcUs2MzVDY0FCblZ4Wi5RRFVoMUFNeVFVMXhqelFiaVNFMzRkSzN4UC4qVU9jY3pOd0tpd21TcUdrUmFJRktLOFZ2UHYqWnJGVzR2cWR1Z1ptNGxoX0ttbUdrKkZyTklrem94V21EU2FLbFBXTUZvQ1JFKld1a21CVnMuYXhMaFRyU3hYbWtCb3ZHTGxMQVVEVldvcXVMaTFaLmZvR2c2RG5hUlE1dWxQZlptVm9vWGlSTHZjNG5ldE1fQXdBQWs5b2ZYeVZ3YkNWQ0dDdVdURkVpWmkqQnVuaUxJeExmQTh5X0c0T05UZ2hnbEx0alhyYjJzdm93RHFDZV9vRVZfQ29jOCp0aXZ6NHhZQTgucmlqcFg3N192X2lfMSJ9|11c0d921466531403cfd3a1ac04c46066821ca12241a2f281966d0ba62ed884c; SESSIONID=CaBTTDIsPVMSG7LJ3ELtlLIe9Af6NFThLvaa3ZeLwYz; gdxidpyhxdE=vPN7snpJw2ojZJg6BxBrHq0hE%5CVdD8auQ2twmGrRkWQBAZSUYWbr7guKn40lVkKGvy3hIWMoYlGXKfs7ARkzmaDC7j51CVDdugaDmC65hsBD8PATbAN3kyoOyhnZn4fvUlajw%5CU1CCeP9h5WQlpSwPNN3fsUvNfM1xNc108cdqWQtpBN%3A1771664724974; pmck9xge=U2FsdGVkX19qZa1tSCf5Voan298io17ntvUWveeRI6w=; d_c0=YWeUDs_s3xuPTgNTKBB3ETnVu7p36EhSTws=|1771663822; _xsrf=b4b18df8-d1f8-4caa-be9b-e536a7875b58; HMACCOUNT=F1B61F990B493712; crystal=U2FsdGVkX19AXkpwzSx49nWv1TH9E/UEf9IG+LgzGU53WRikc19twHx6DFdHULEsZ1RhZioSFB4DfjyLp9IBx6Jwb+beIbVwpAxsb3n2kAiTyEyUf8SnOrVQCC+OUSAq/AuNnd2nh7EkUPNDbPtH3yICANtj114Iv9i5MSR4mOHUUhBhaSkQJ8SK+oqD93HrfSB/XTIdDz5cYQR+x+gnVfIZJsC9IdK+EQlGbFEQgCy3BDr9yWUonlRKa3iE83JK; osd=UV4TCknA2HEmgW3aOadI4NoUawknhrk8edQsk0WRizx6zVuTcwum7EWFaNU9CuNt5c8MMjPrDR8FWIYXxUEVr08=; Hm_lvt_98beee57fd2ef70ccdd5ca52b9740c49=1771560895,1771570962,1771582707,1771663824',
    avatar: 'https://picx.zhimg.com/v2-1abe7b115ea0ab9e5dfe334d5a1fef38_r.jpg',
    isLoggedIn: false,
    setCookie: (cookie: string) => set({ cookies: cookie }),
    login: (name: string, cookie: string, avatar: string) => set({ username: name, cookies: cookie, avatar: avatar, isLoggedIn: true }),
    logOut: () => set({ username: '', cookies: undefined, avatar: '', isLoggedIn: false }),
}));