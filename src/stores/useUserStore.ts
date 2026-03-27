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
    cookies: 'BEC=c838835709364588babacf97e45319e7; z_c0=2|1:0|10:1774583305|4:z_c0|92:Mi4xYkpWMVJ3QUFBQUNXZHhRNm5XMExIQ1lBQUFCZ0FsVk5DVXl6YWdBNnhkZmlBbjBkaXh3ZmhScEJDVkxlQzVVeVZR|ad63bf302bc280820626f15a060fcea94c5108b23dd917df122af6f6e557dff6; __snaker__id=kWJK8gIJDmoDh7m9; JOID=UlAcC0peY1KymzJlVDv-z0ECNrtGP1ck_-J2ATM1XwDD-FUZObGen9OSO2Vctv-YjkqHHOMEsbZni3XE52osZEU=; captcha_ticket_v2=2|1:0|10:1774583294|17:captcha_ticket_v2|728:eyJ2YWxpZGF0ZSI6IkNOMzFfTUN5U1ZXS1ZSM3hqQW9WdVExTXVFZGdyZWtvRExPZldMaXViYVc1ZGwuR3NSenV0VXRKUnRvUjFHQ3Eyemp3ZVplZ2hJSW1QQTBvUTg4VTJOT0pNWFVETVZtX3dOZFJQV2ZRNldCeEowOFp5aWxYbzFYVDRZTTIubnFqWmltZWRtM05IciptdGlVNXBQYy4xTE9jblNqa2hRdU9aYk1ZM0UwYldyNWhnKldTekU5Q0NMaERGUjR1V3BhOVpLNWVhTlZhZGEwYWsuNGpVaWZVMVBLNnY4cXlMUUIwVXJiMzBPR3BSZWpoRmVMZTFkMEdmMUpiOW92eTFYSSpoamNaNEJHb21oS3BKZ0hGMGR4NlUzYVJ0elI4X29WSEZJMkh1SVVoSTZ2a2hfM3NoM1ZaWF85bmdBQUxxeUtETnlLSTA0cEhtRkFJNFc0SWRyb3hkcXJhUjZVZFZOWFRTbGVjREsxeXo2Z0d6aThFVkxxRWhjRF9iOWlLLkM4cC5QcDhMV0l6NXZmTVB5Lk9TVUxIVFhldHg2QSpGakFFaHYqNGEwYktQZkJ3YWlZVGwxeXozRkViMmdJQnhlZXpsUURLOHF5eEVMRU5OVUxPQWRFTmF3aEt4Q3ZYUnN5YWkwZWp4UVF2bWxROGFFQzBrNmpKZWhJNmVXYm9xYmh2dS5rVndXM0xzalk3N192X2lfMSJ9|dc6f161137fc6c8d18bf7a20abdb4ca510c1a7c80b00c9c7f5eb0e8cec8c021e; SESSIONID=i5wDxLefj4Spjftl2IVNqicTBCkFKvuRgdfe4lCP9Dl; captcha_session_v2=2|1:0|10:1774583269|18:captcha_session_v2|88:WGVuQVpWTE5PR2ZNd09XSmFUWEZoRENQTHlVRXpXMTNPcVJ3VnhYdFBScDJzYTZtcm9Fcmc0UWdEVG1jOE4vQQ==|57303a8ec43c9c239392e67d6d4a25fdc1c0d2fc49cc6733fc1d19e9b01c1770; _zap=49d88ed9-d30c-46fa-a0d6-779763dd9e5f; assva5=U2FsdGVkX1+lhKstRwt8a8hDl5ER94cOPECRGVjVtXgWAX1qfxEPyHQv+3jpMyEr35CRc1871Ztoy8otO6XgSg==; gdxidpyhxdE=i40DMsiDr5aaZA23P9UkklzBZB8xPOjmI13z%2F5VHn5m8fl3cabP%2BBm0H2OiH1COkx3w0HwYJecXVViItoH%2Bcfr9l0Vz6RPzO6brydD0xfA%5COTu47mGI1f0Xwb%5CXYq94cbAZcB%2BGUU9bHBr0%5Cl0OD%2Bxgve6A%2BMTQEsOtb%2B8H3QBGoLv6U%3A1774584170272; d_c0=lncUOp1tCxyPTntyMMKdUxk8Kf34maKreRQ=|1774583269; pmck9xge=U2FsdGVkX19jWEMjW4A8V5SvdCHu0lTWqg/0IxXrJ/A=; assva6=U2FsdGVkX1+snbLZaU/3BsBIWFI78Vdi7mhARpiT358=; vmce9xdq=U2FsdGVkX18vIcxDNCMGlVk8myU/2GA17JDkaUXUnnbGb+a3iew9kskIU7OOY6DysMe2hCqrFzFrOmghUVUwSnaT7eyhfeSBqpQ4brYYW7HT7ujZM4rP9FUXc8hwJwfcdGIMsDk4nC2Ej11pv7i64H5R7vGfI0zG8vWOpaRUrWo=; cmci9xde=U2FsdGVkX1/QdJQfWxErllg5hlLDsjfKMTGGNhArYj6+HLAUeM2PFcWlb/+hUlAaFKWKHU1Ig5LLXeTZnsJCSA==; Hm_lpvt_98beee57fd2ef70ccdd5ca52b9740c49=1774583308; DATE=1771068168246; _xsrf=42c360ea-aaca-4f1d-a6d8-c0fa625226ac; HMACCOUNT=EA508FD40E3346C5; crystal=U2FsdGVkX19AXkpwzSx49nWv1TH9E/UEf9IG+LgzGU53WRikc19twHx6DFdHULEsZ1RhZioSFB4DfjyLp9IBx6Jwb+beIbVwpAxsb3n2kAiTyEyUf8SnOrVQCC+OUSAq/AuNnd2nh7EkUPNDbPtH3yICANtj114Iv9i5MSR4mOHUUhBhaSkQJ8SK+oqD93HrfSB/XTIdDz5cYQR+x+gnVfIZJsC9IdK+EQlGbFEQgCy3BDr9yWUonlRKa3iE83JK; osd=V14UBE1bbVq9nDdrXDT5yk8KObxDMV8r-Od4CTwyWg7L91IcN7mRmNacM2pbs_GQgU2CEusLtrNpg3rD4mQka0I=; Hm_lvt_98beee57fd2ef70ccdd5ca52b9740c49=1772110236,1772181791,1774583269',
    avatar: 'https://picx.zhimg.com/v2-1abe7b115ea0ab9e5dfe334d5a1fef38_r.jpg',
    isLoggedIn: false,
    setCookie: (cookie: string) => set({ cookies: cookie }),
    login: (name: string, cookie: string, avatar: string) => set({ username: name, cookies: cookie, avatar: avatar, isLoggedIn: true }),
    logOut: () => set({ username: '', cookies: undefined, avatar: '', isLoggedIn: false }),
}));