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
    cookies: 'BEC=e9bdbc10d489caddf435785a710b7029; z_c0=2|1:0|10:1772181821|4:z_c0|92:Mi4xYkpWMVJ3QUFBQUFCa3hRMXRLVG5HeVlBQUFCZ0FsVk5QYWVPYWdETV8yZ1NodkJXN0NXT0hBUGRUU1NiV0VEZjFn|6fa963755ab001afe3cbe475f7a74e564396985d1e68e4813be5c4987c5f85c3; __snaker__id=QSaai58kYySbHgTk; JOID=U1oTB010oHiqlVMdWhww618EWs5GHs8fkaMqXDck4QbY5mZQFFP_2caRVBtaywuergEroHH-5A9M68Vec3TiJrY=; assva6=U2FsdGVkX1+2CIJ0SKGF6piPF1p9yeua73QK1j+V0NU=; gdxidpyhxdE=19nZC%5CahUdYZOph3vE2eaoZKSawWGQBc4j%2F582EAu75lR2LQjmTfnA%5CA4sh%2FPcgXB%5Cj%2BU%2Fhq95WcmYkQq83szHA2L%2FEM%5CK2hEooEzjga83rpBM8xnK6CzsQVspzufQSRHd677HiR7W5jkrfYypyy6y2EIKB3AG%2Bd7P5qYpm7O%2BSmDbsT%3A1772182692944; d_c0=AZMUNbSk5xuPTtHUTGyCN_qxrUuTDLP-fpY=|1772181791; pmck9xge=U2FsdGVkX1/VEBjE0bG4FwXI8mqGnXPcB3Hn1+3qvVI=; vmce9xdq=U2FsdGVkX18yrqPxuEgTa0B9gp3u0HVnEuMITQJ6HPb6D72IVCIPsV9NbzWnsSYU2Q4a6E1DZEC0/CAj7X17MulswdF7vqow1kSAJJm+ceRV3ceL+b96J5DH8rH5Lw754GvvfoubaB5VWJxcjag7K4a7HR5/WNqkEjP8CpPTCHE=; cmci9xde=U2FsdGVkX1+p31RFOTGGu59rfBk73QinsMhqFPuU3HjmeXnRaZ/PqpZJ9wrh95unnbP3CYBt1mpnUgqGnDLx4Q==; captcha_session_v2=2|1:0|10:1772181792|18:captcha_session_v2|88:dmwzc1h2QVVFK3psbUFjZlFkbGJ2K3F1SWtHMWhiNjJjT1p6WTIrd0xqZ0J6Qkd5dkFRYjBzbVY3WmdrenR6cQ==|4e72b9a7baf83e981ab8d29f51be872c3be5fb3f87ad4f6f905592533b1fe209; Hm_lpvt_98beee57fd2ef70ccdd5ca52b9740c49=1772181823; DATE=1771068168246; captcha_ticket_v2=2|1:0|10:1772181796|17:captcha_ticket_v2|728:eyJ2YWxpZGF0ZSI6IkNOMzFfcl9zZVFvbTRPc2NUZ0hqempQMG5PTnVLeU9qWHc5YmJEUjRPM1IxaVYqX2I2TXh0Y0JlSmZVSndkemk5WHlUTF9scTJkNVZJSGdVNFdlbnZVV3ZzM2dtVSp6ZG9OdlphY3l1cHZyU3ZJMVZBLnZrTHlOcUtIZEMzUmpxZnRockhYVVk0alVVUjZNVFhGMVk1Y2FaSl9vUGJuSm5IRkFLRGZhT193NlJiR3ZsSVRhNmZRMy5RSnZfWWhkYUZPKkNhV1BneGFrelc1dWN2dWZIRVBBT28uaHlUQ09qeGhaamVqUyowVktsSXlMX0cuUmMydS5fcEZ0Um9fMUpIWiptU1ljZlFRUkEySXlYS19NMjl2YS51eWlVQ0xxR0JGai5QS3ZENjJjRElsZDVyUHFhZE9CWnFTdVc1TGJNMEs2MnVQT09tRDlnWWE1UHdjRFpjck5nZjQ0Nk9VU0FhSWk0c1dJSjQxZU85XzBPbXBpUldxY1NwM0tDREJ4ZGl1SFV2cm5jY2tSUjZ2NDEzUXVpKlZZWGN5NlQ5QVNxSkZxNnFHWEhvYmRHZEYzX2lTbHpIZGwqTkFjMkRZXzRPWkFSNWJkTHlEWUJxaklKNndvTG1SdXE4ZHYuQUx6QzNZTjRDLlVqbSpaQWNQU3pXZlFscFV1UkFESkJfdGNkMlVDb2JQbGp3YVk3N192X2lfMSJ9|0f728d862f4db2d78a1ca78e58e60c52ddfd67a34d550a586db5510eb5f188f2; SESSIONID=ike91zEoWBzpq2NJdNXzS4fWVquUJu8vlMEwYPqffBY; _xsrf=39959ddf-bd6f-44ee-8259-ea255b28e151; HMACCOUNT=B0F220CC13D341EB; crystal=U2FsdGVkX19AXkpwzSx49nWv1TH9E/UEf9IG+LgzGU53WRikc19twHx6DFdHULEsZ1RhZioSFB4DfjyLp9IBx6Jwb+beIbVwpAxsb3n2kAiTyEyUf8SnOrVQCC+OUSAq/AuNnd2nh7EkUPNDbPtH3yICANtj114Iv9i5MSR4mOHUUhBhaSkQJ8SK+oqD93HrfSB/XTIdDz5cYQR+x+gnVfIZJsC9IdK+EQlGbFEQgCy3BDr9yWUonlRKa3iE83JK; osd=WlASBkh9qnmrkFoXWx014lUFW8tPFM4elKogXTYh6AzZ52NZHlL-3M-bVRpfwgGfrwQiqnD_4QZG6sRben7jJ7M=; Hm_lvt_98beee57fd2ef70ccdd5ca52b9740c49=1771582707,1771663824,1772110236,1772181791; assva5=U2FsdGVkX1/QUIshtxxX4oKATw3Llwfk1cm5euwE0MNoIsnrebYkMj2v5GeBQlelA6mELCqKOarv6vZRTqu5BA==; _zap=2384ac4d-8d9b-41db-bf39-4bc2fd58e516',
    avatar: 'https://picx.zhimg.com/v2-1abe7b115ea0ab9e5dfe334d5a1fef38_r.jpg',
    isLoggedIn: false,
    setCookie: (cookie: string) => set({ cookies: cookie }),
    login: (name: string, cookie: string, avatar: string) => set({ username: name, cookies: cookie, avatar: avatar, isLoggedIn: true }),
    logOut: () => set({ username: '', cookies: undefined, avatar: '', isLoggedIn: false }),
}));