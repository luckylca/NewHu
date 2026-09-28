export const ZHIHU_ANDROID_RECOMMEND_URL = 'https://api.zhihu.com/topstory/recommend';

export type ZhihuApiMode = 'web' | 'android';

export type AndroidApiResult<T> = {
  data: T;
  status: number;
  contentType: string;
};

export type AndroidRequestOptions = {
  /** Explicitly omit Cookie even if the shared account client has a stored session. */
  anonymous?: boolean;
};

export class AndroidHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly contentType: string,
  ) {
    super(`知乎 Android API 请求失败（HTTP ${status}）`);
    this.name = 'AndroidHttpError';
  }
}

// Values follow the current zhurl Android transport (zly2006/zhurl, src/main.rs).
// They are kept separate from Web's d_c0/x-zse-96 signer and can be updated independently.
export const ANDROID_API_VERSION = '3.0.93';
export const ANDROID_APP_VERSION = '10.100.0';
export const ANDROID_USER_AGENT = 'com.zhihu.android/Futureve/10.100.0 Mozilla/5.0 (Linux; Android 12; sdk_gphone64_arm64 Build/SE1A.220630.001.A1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.1000.10 Mobile Safari/537.36';
export const ANDROID_APP_ZA = 'OS=Android&Release=12&Model=sdk_gphone64_arm64&VersionName=10.100.0&VersionCode=30008&Product=com.zhihu.android&Width=1440&Height=2952&Installer=Market&DeviceType=AndroidPhone&Brand=google';

export function createAndroidHeaders(cookie: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    cookie,
    'user-agent': ANDROID_USER_AGENT,
    'x-page-id': '132',
    'x-api-version': ANDROID_API_VERSION,
    'x-app-version': ANDROID_APP_VERSION,
    'x-app-za': ANDROID_APP_ZA,
    'x-app-bundleid': 'com.zhihu.android',
    'x-app-flavor': 'zhihuwap64',
    'x-app-build': 'release',
    'x-network-type': '3G',
  };
  const xsrf = cookie.match(/(?:^|;\s*)_xsrf=([^;]+)/)?.[1];
  if (xsrf) headers['x-xsrftoken'] = xsrf;
  return headers;
}

function resolveRecommendUrl(cursor: string) {
  if (!cursor) return ZHIHU_ANDROID_RECOMMEND_URL;
  const next = new URL(cursor, ZHIHU_ANDROID_RECOMMEND_URL);
  if (next.protocol !== 'https:' || next.hostname !== 'api.zhihu.com' || next.pathname !== '/topstory/recommend') {
    throw new Error('知乎 Android 推荐分页地址无效');
  }
  return next.toString();
}

export class AndroidZhihuClient {
  constructor(private cookie: string) {}

  setCookie(cookie: string) {
    this.cookie = cookie;
  }

  async getRecommend(cursor = '', options: AndroidRequestOptions = {}): Promise<AndroidApiResult<any>> {
    const url = resolveRecommendUrl(cursor);
    const headers = createAndroidHeaders(options.anonymous ? '' : this.cookie);
    if (options.anonymous) delete headers.cookie;
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'omit',
    });
    const contentType = response.headers.get('content-type') ?? '';
    const responseText = await response.text();
    if (!response.ok) {
      console.warn(`[ZhihuAndroid] GET /topstory/recommend HTTP ${response.status}`);
      throw new AndroidHttpError(response.status, contentType);
    }
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.warn(`[ZhihuAndroid] GET /topstory/recommend invalid-json content-type=${contentType || 'unknown'}`);
      throw new Error('知乎 Android 推荐响应不是有效 JSON');
    }
    const rawCount = Array.isArray(data?.data) ? data.data.length : 0;
    console.info(`[ZhihuAndroid] GET /topstory/recommend HTTP ${response.status} content-type=${contentType || 'unknown'} raw=${rawCount} next=${Boolean(data?.paging?.next)} end=${data?.paging?.is_end === true}`);
    return { data, status: response.status, contentType };
  }
}
