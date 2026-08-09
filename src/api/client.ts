/**
 * 知乎 API HTTP 客户端
 * 自动处理加密签名和错误处理
 */

import { generateSignature } from './crypto';

interface Headers {
    [key: string]: string;
}

interface SignatureResult {
    url: string;
    headers: Headers;
}

interface ZhihuClient {
    cookie: string;
    canLoad: boolean;
    setCookie(cookie: string): void;
    get(url: string): Promise<any>;
    post(url: string, data?: any, isJson?: boolean): Promise<any>;
    put(url: string, data?: any): Promise<any>;
    delete(url: string): Promise<any>;
    request(url: string, method?: string, data?: any): Promise<any>;
}

class ZhihuClient {
    private useSignedGet = true;

    constructor(cookie: string) {
        if (!cookie) {
            throw new Error('请提供知乎 Cookie');
        }
        this.cookie = cookie;
        this.canLoad = true;
    }

    /**
     * 设置 Cookie
     */
    setCookie(cookie: string) {
        this.cookie = cookie;
        this.canLoad = true;
        this.useSignedGet = true;
    }

    /**
     * 错误处理回调
     */
    handleError(code: number, content: string) {
        if (code === 403) {
            try {
                const data = JSON.parse(content);
                if (data.error && data.error.message) {
                    console.error('知乎返回 403:', data.error.message);
                    if (data.error.redirect) {
                        console.log('需要人机验证，请访问:', data.error.redirect);
                    }
                }
            } catch (e) {
                console.error('403 错误:', content);
            }
            this.canLoad = false;
            throw new Error('请求被拒绝，可能需要人机验证');
        } else if (code === 401) {
            console.error('登录状态已失效，请重新登录');
            throw new Error('登录状态已失效');
        } else if (code === 400) {
            try {
                const data = JSON.parse(content);
                if (data.error && data.error.message) {
                    throw new Error('知乎提示：' + data.error.message);
                }
            } catch (e) {
                throw new Error('请求参数错误');
            }
        }
    }

    /**
     * GET 请求
     */
    async get(url: string) {
        if (!this.canLoad) {
            throw new Error('请求已被阻止');
        }

        // 生成签名
        const { url: finalUrl, headers } = generateSignature(url, this.cookie);
        const browserHeaders = {
            cookie: this.cookie,
            'user-agent': headers['user-agent'],
        };

        try {
            let response = await fetch(finalUrl, {
                method: 'GET',
                headers: this.useSignedGet ? headers : browserHeaders,
                credentials: 'omit',
            });

            // 知乎会拒绝过期的本地 x-zse 算法，但同一 Cookie 仍可正常访问
            // Web GET 接口。仅在签名请求返回 401 时回退一次，保留原请求行为。
            if (response.status === 401 && this.useSignedGet) {
                this.useSignedGet = false;
                response = await fetch(finalUrl, {
                    method: 'GET',
                    headers: browserHeaders,
                    credentials: 'omit',
                });
            }

            const content = await response.text();

            if (!response.ok) {
                this.handleError(response.status, content);
            }

            return JSON.parse(content);
        } catch (error) {
            console.error('GET 请求失败:', error);
            throw error;
        }
    }

/**
     * POST 请求 (已支持 JSON)
     * @param {string} url 
     * @param {object} data 
     * @param {boolean} isJson - 是否使用 JSON 格式发送 (默认 false)
     */
    async post(url: string, data: any = {}, isJson: boolean = false) {
        if (!this.canLoad) {
            throw new Error('请求已被阻止');
        }

        const { url: finalUrl, headers } = generateSignature(url, this.cookie);

        // --- 核心修改开始 ---
        let body;
        if (isJson) {
            // 如果是 JSON 模式
            headers['content-type'] = 'application/json';
            body = JSON.stringify(data);
        } else {
            // 默认表单模式 (保持兼容)
            headers['content-type'] = 'application/x-www-form-urlencoded';
            body = typeof data === 'string' ? data : new URLSearchParams(data).toString();
        }
        // --- 核心修改结束 ---

        try {
            const response = await fetch(finalUrl, {
                method: 'POST',
                headers: headers,
                body: body,
                credentials: 'omit',
            });

            const content = await response.text();

            if (!response.ok) {
                this.handleError(response.status, content);
            }

            // 处理空响应 (有些操作成功后返回空字符串)
            if (!content || content.trim().length === 0) {
                return { success: true, status: 'ok (empty response)' };
            }

            try {
                return JSON.parse(content);
            } catch (e) {
                return { success: true, raw: content };
            }

        } catch (error) {
            console.error('POST 请求失败:', error);
            throw error;
        }
    }

    /**
     * PUT 请求
     */
    async put(url: string, data: any = {}) {
        if (!this.canLoad) {
            throw new Error('请求已被阻止');
        }

        const { url: finalUrl, headers } = generateSignature(url, this.cookie);
        headers['content-type'] = 'application/x-www-form-urlencoded';

        try {
            const response = await fetch(finalUrl, {
                method: 'PUT',
                headers: headers,
                body: typeof data === 'string' ? data : new URLSearchParams(data).toString(),
                credentials: 'omit',
            });

            const content = await response.text();

            if (!response.ok) {
                this.handleError(response.status, content);
            }

            return JSON.parse(content);
        } catch (error) {
            console.error('PUT 请求失败:', error);
            throw error;
        }
    }

    /**
     * DELETE 请求 (修复版 - 支持空响应)
     */
    async delete(url: string) {
        if (!this.canLoad) {
            throw new Error('请求已被阻止');
        }

        const { url: finalUrl, headers } = generateSignature(url, this.cookie);

        try {
            const response = await fetch(finalUrl, {
                method: 'DELETE',
                headers: headers,
                credentials: 'omit',
            });

            const content = await response.text();

            if (!response.ok) {
                this.handleError(response.status, content);
            }

            // --- 核心修复：处理空响应 ---
            // 取消点赞成功时，知乎通常返回空字符串，这里直接返回成功标记
            if (!content || content.trim().length === 0) {
                return { success: true, status: 'ok (empty response)' };
            }

            try {
                return JSON.parse(content);
            } catch (e) {
                // 如果无法解析 JSON，就返回原文
                return { success: true, raw: content };
            }

        } catch (error) {
            console.error('DELETE 请求失败:', error);
            throw error;
        }
    }

    /**
     * 通用请求方法
     */
    async request(url: string, method = 'GET', data: any = null) {
        method = method.toUpperCase();

        switch (method) {
            case 'GET':
                return this.get(url);
            case 'POST':
                return this.post(url, data);
            case 'PUT':
                return this.put(url, data);
            case 'DELETE':
                return this.delete(url);
            default:
                throw new Error(`不支持的请求方法: ${method}`);
        }
    }
}

// 导出
export default ZhihuClient;
