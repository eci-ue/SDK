import {createSHA256} from "hash-wasm";

import type {IHasher} from "hash-wasm";
import {createMd5Hash} from "./md5";

/**
 * 优先使用浏览器与现代 Node.js 提供的原生 Web Crypto 生成 SHA-256。
 * 旧运行环境缺少 SubtleCrypto 时使用 MD5 兜底，保证指纹流程仍可运行。
 */
export async function createSha256Hash(content: string | ArrayBuffer): Promise<string> {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return createMd5Hash(content);

    const bytes = typeof content === "string"
        ? new TextEncoder().encode(content)
        : new Uint8Array(content);
    const digest = await subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("");
}

/** 创建适合大数据分段写入的增量 SHA-256 计算器。 */
export const createStackShaHash = async function (): Promise<IHasher> {
    const hasher = await createSHA256();
    hasher.init();
    return hasher;
}
