import {md5} from "hash-wasm";

/** 使用 hash-wasm 生成 MD5，兼容字符串和 ArrayBuffer。 */
export function createMd5Hash(content: string | ArrayBuffer): Promise<string> {
    return md5(
        typeof content === "string" ? content : new Uint8Array(content),
    );
}
