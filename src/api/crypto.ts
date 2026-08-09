
import CryptoJS from 'crypto-js';

// ==================== 基础辅助函数 ====================

/**
 * 将字符串转换为字节数组
 */
function stringToBytes(str:string) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i));
    }
    return bytes;
}

/**
 * 将字节数组转换为字符串
 */
function bytesToString(bytes:number[]) {
    return String.fromCharCode(...bytes);
}

/**
 * 反转数组
 */
function reverseArray(arr:number[]) {
    return arr.slice().reverse();
}

/**
 * 将 32 位整数转换为大端字节数组（长度为4）
 */
function int32ToBytes(n:number) {
    return [
        (n >>> 24) & 0xFF,
        (n >>> 16) & 0xFF,
        (n >>> 8) & 0xFF,
        n & 0xFF
    ];
}

/**
 * 将长度为4的字节数组转换为 32 位整数（大端）
 */
function bytesToInt32(bytes:number[]) {
    return (((bytes[0] << 24) | (bytes[1] << 16)) | (bytes[2] << 8)) | bytes[3];
}

/**
 * 将数组按每 n 个元素分块
 */
function chunkArray(arr:number[], size:number) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

/**
 * PKCS7 填充：将数据填充到 blockSize 的倍数
 */
function pkcs7Pad(data:string, blockSize = 16) {
    const padLen = blockSize - (data.length % blockSize);
    const padding = String.fromCharCode(padLen).repeat(padLen);
    return data + padding;
}

/**
 * 去除 PKCS7 填充
 */
function pkcs7Unpad(data:string) {
    const padLen = data.charCodeAt(data.length - 1);
    return data.slice(0, data.length - padLen);
}

/**
 * 在 base64 字符串中查找字符的索引
 */
function base64Index(char:string, base64Chars:string) {
    const pos = base64Chars.indexOf(char);
    return pos >= 0 ? pos : null;
}

// ==================== XZSE96V3 类定义 ====================

interface XZSE96V3
{
    keyPad: number[];
    base64Chars: string;
    mapping: {
        zk: number[];
        zb: number[];
    };

    rotateXor(x:number, rot:number): number;
    transformValue(e:number): number;
    transformBlock(data:number[]): number[];
    processBlocks(data:number[], iv:number[]): number[];
    b64encode(md5Bytes:string, device?:number, seed?:number): string;
}


class XZSE96V3 implements XZSE96V3 {
    constructor() {
        // 密钥填充
        this.keyPad = [48, 53, 57, 48, 53, 51, 102, 55, 100, 49, 53, 101, 48, 49, 100, 55];

        // 自定义 Base64 字符表
        this.base64Chars = "6fpLRqJO8M/c3jnYxFkUVC4ZIG12SiH=5v0mXDazWBTsuw7QetbKdoPyAl+hN9rgE";

        // 映射表
        this.mapping = {
            zk: [1170614578, 1024848638, 1413669199, -343334464, -766094290, -1373058082, -143119608, -297228157, 1933479194, -971186181, -406453910, 460404854, -547427574, -1891326262, -1679095901, 2119585428, -2029270069, 2035090028, -1521520070, -5587175, -77751101, -2094365853, -1243052806, 1579901135, 1321810770, 456816404, -1391643889, -229302305, 330002838, -788960546, 363569021, -1947871109],
            zb: [20, 223, 245, 7, 248, 2, 194, 209, 87, 6, 227, 253, 240, 128, 222, 91, 237, 9, 125, 157, 230, 93, 252, 205, 90, 79, 144, 199, 159, 197, 186, 167, 39, 37, 156, 198, 38, 42, 43, 168, 217, 153, 15, 103, 80, 189, 71, 191, 97, 84, 247, 95, 36, 69, 14, 35, 12, 171, 28, 114, 178, 148, 86, 182, 32, 83, 158, 109, 22, 255, 94, 238, 151, 85, 77, 124, 254, 18, 4, 26, 123, 176, 232, 193, 131, 172, 143, 142, 150, 30, 10, 146, 162, 62, 224, 218, 196, 229, 1, 192, 213, 27, 110, 56, 231, 180, 138, 107, 242, 187, 54, 120, 19, 44, 117, 228, 215, 203, 53, 239, 251, 127, 81, 11, 133, 96, 204, 132, 41, 115, 73, 55, 249, 147, 102, 48, 122, 145, 106, 118, 74, 190, 29, 16, 174, 5, 177, 129, 63, 113, 99, 31, 161, 76, 246, 34, 211, 13, 60, 68, 207, 160, 65, 111, 82, 165, 67, 169, 225, 57, 112, 244, 155, 51, 236, 200, 233, 58, 61, 47, 100, 137, 185, 64, 17, 70, 234, 163, 219, 108, 170, 166, 59, 149, 52, 105, 24, 212, 78, 173, 45, 0, 116, 226, 119, 136, 206, 135, 175, 195, 25, 92, 121, 208, 126, 139, 3, 75, 141, 21, 130, 98, 241, 40, 154, 66, 184, 49, 181, 46, 243, 88, 101, 183, 8, 23, 72, 188, 104, 179, 210, 134, 250, 201, 164, 89, 216, 202, 220, 50, 221, 152, 140, 33, 235, 214]
        };
    }

    /**
     * 位旋转操作：将 x 左旋转 rot 位
     */
    rotateXor(x:number, rot:number) {
        rot = rot % 32;
        return ((x << rot) | (x >>> (32 - rot))) >>> 0;
    }

    /**
     * 变换 32 位整数
     */
    transformValue(e:number) {
        const packed = int32ToBytes(e);
        const transformed = packed.map(byte => this.mapping.zb[byte]);
        const r = bytesToInt32(transformed);
        const rx2 = this.rotateXor(r, 2);
        const rx10 = this.rotateXor(r, 10);
        const rx18 = this.rotateXor(r, 18);
        const rx24 = this.rotateXor(r, 24);
        return (r ^ rx2 ^ rx10 ^ rx18 ^ rx24) >>> 0;
    }

    /**
     * 对 16 字节的数据块进行加密变换
     */
    transformBlock(data:number[]) {
        const words = [
            bytesToInt32(data.slice(0, 4)),
            bytesToInt32(data.slice(4, 8)),
            bytesToInt32(data.slice(8, 12)),
            bytesToInt32(data.slice(12, 16))
        ];

        // 32 轮迭代
        for (let r = 0; r < 32; r++) {
            const zkVal = this.mapping.zk[r];
            const temp = (words[r + 1] ^ words[r + 2] ^ words[r + 3] ^ zkVal) >>> 0;
            const transformed = this.transformValue(temp);
            words[r + 4] = (words[r] ^ transformed) >>> 0;
        }

        // 提取最后 4 个字
        const resWords = [words[35], words[34], words[33], words[32]];
        const result: number[] = [];
        resWords.forEach(word => {
            result.push(...int32ToBytes(word));
        });
        return result;
    }

    /**
     * 对数据块按 16 字节分块加密
     */
    processBlocks(data:number[], iv:number[]): number[] {
        const output: number[] = [];
        let currentChain = iv;
        const chunks = chunkArray(data, 16);

        chunks.forEach(chunk => {
            // 补齐到 16 字节
            while (chunk.length < 16) chunk.push(0);

            // XOR 操作
            const xored = chunk.map((byte, i) => (byte ^ currentChain[i]) & 0xFF);
            currentChain = this.transformBlock(xored);
            output.push(...currentChain);
        });

        return output;
    }

    /**
     * 编码函数：生成 x-zse-96 签名
     */
    b64encode(md5Bytes: string, device = 0, seed = 63): string {
        const header = String.fromCharCode(seed, device) + md5Bytes;
        const padded = pkcs7Pad(header, 16);
        const paddedBytes = stringToBytes(padded);

        // 处理头部块
        const headerBlock = paddedBytes.slice(0, 16);
        const transformedHeader = headerBlock.map((byte, i) =>
            (byte ^ this.keyPad[i] ^ 42) & 0xFF
        );
        const iv = this.transformBlock(transformedHeader);

        // 处理主体
        const body = paddedBytes.slice(16);
        const transformedBody = this.processBlocks(body, iv);

        // 合并
        const combined = [...iv, ...transformedBody];

        // 补齐到 3 的倍数
        const padCount = (3 - (combined.length % 3)) % 3;
        for (let i = 0; i < padCount; i++) {
            combined.push(0);
        }

        // 自定义 Base64 编码
        let result = "";
        let shiftCounter = 0;

        for (let i = combined.length - 1; i >= 2; i -= 3) {
            const b0 = combined[i] ^ ((58 >>> (8 * (shiftCounter % 4))) & 0xFF);
            shiftCounter++;
            const b1 = combined[i - 1] ^ ((58 >>> (8 * (shiftCounter % 4))) & 0xFF);
            shiftCounter++;
            const b2 = combined[i - 2] ^ ((58 >>> (8 * (shiftCounter % 4))) & 0xFF);
            shiftCounter++;

            const num = b0 + (b1 << 8) + (b2 << 16);
            result += this.base64Chars[(num & 63)];
            result += this.base64Chars[(num >>> 6) & 63];
            result += this.base64Chars[(num >>> 12) & 63];
            result += this.base64Chars[(num >>> 18) & 63];
        }

        return result;
    }
}

// ==================== 主要导出函数 ====================

/**
 * 生成知乎 API 请求所需的加密签名
 * @param {string} url - API 完整 URL
 * @param {string} cookie - 知乎 Cookie（需包含 d_c0 字段）
 * @returns {object} 包含 url 和 headers 的对象
 */
function generateSignature(url: string, cookie: string): { url: string; headers: { [key: string]: string } } {
    // 提取 API 路径
    let path;
    if (url.includes('https://www.zhihu.com')) {
        const match = url.match(/zhihu\.com(.+)/);
        if (!match) {
            throw new Error('不支持的 URL 格式');
        }
        path = match[1];
    } else if (url.includes('https://api.zhihu.com')) {
        const match = url.match(/zhihu\.com(.+)/);
        if (!match) {
            throw new Error('不支持的 URL 格式');
        }
        path = '/api/v4' + match[1];
        url = 'https://www.zhihu.com' + path;
    } else {
        throw new Error('不支持的 URL 格式');
    }

    // 提取 d_c0
    const d_c0Match = cookie.match(/d_c0=([^;]+)/);
    if (!d_c0Match) {
        throw new Error('Cookie 中未找到 d_c0 字段，请先登录知乎');
    }
    const d_c0 = d_c0Match[1];

    // 构造加密前数据
    const preEncryptData = `101_3_3.0+${path}+${d_c0}`;

    // 计算 MD5
    const md5Hash = CryptoJS.MD5(preEncryptData).toString().toLowerCase();
    // 生成 x-zse-96 签名
    const xzse96 = new XZSE96V3();
    const signature = '2.0_' + xzse96.b64encode(md5Hash);

    // 返回请求头
    return {
        url: url,
        headers: {
            'cookie': cookie,
            'x-api-version': '3.0.91',
            'x-zse-93': '101_3_3.0',
            'x-zse-96': signature,
            'x-app-za': 'OS=Web',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    };
}

export { generateSignature, XZSE96V3 };
