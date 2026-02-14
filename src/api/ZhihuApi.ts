import ZhihuAPI from "./api";

let apiInstance: ZhihuAPI | null = null;

export function getApiInstance(cookie?: string): ZhihuAPI {
    if (!apiInstance) {
        apiInstance = new ZhihuAPI(cookie ?? "");
    }
    return apiInstance;
}

export function setCookie(cookie: string) {
    if (apiInstance) {
        apiInstance.setCookie(cookie);
    } else {
        apiInstance = new ZhihuAPI(cookie);
    }
}