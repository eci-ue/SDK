/**
 * 将字符串编码为 Base64。
 *
 * 使用 UTF-8 字节处理中文等非 ASCII 字符，避免直接调用 `btoa` 时
 * 产生的 Latin-1 字符范围错误。
 */
export function Encode(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = "";

    // 分块转换，避免对大字符串一次性展开过多函数参数。
    const chunkSize = 0x8000;
    for (let start = 0; start < bytes.length; start += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
    }

    return btoa(binary);
}

/**
 * 将 Base64 解码回原字符串。
 *
 * 非法 Base64 或非法 UTF-8 输入会继续抛出运行时异常，便于调用方发现
 * 数据损坏，而不是静默得到替换字符。
 */
export function Decode(value: string): string {
    const binary = atob(value);
    let encoded = "";

    for (let index = 0; index < binary.length; index += 1) {
        encoded += `%${binary.charCodeAt(index).toString(16).padStart(2, "0")}`;
    }

    return decodeURIComponent(encoded);
}
