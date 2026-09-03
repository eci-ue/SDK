import {StackShaHash} from "../hash";

const MB = 1024 * 1024;
const GB = 1024 * MB;
const FULL_HASH_MAX_SIZE = 5 * MB;
const FULL_HASH_CHUNK_SIZE = 512 * 1024;
const SAMPLE_SIZE = 10 * 1024;
const FINGERPRINT_VERSION = "v2";
const PART_RULES = [
    {maxSize: 10 * MB, partCount: 10},
    {maxSize: 100 * MB, partCount: 50},
    {maxSize: GB, partCount: 100},
    {maxSize: Number.POSITIVE_INFINITY, partCount: 200},
] as const;

/**
 * 小于 5 MiB 时分块读取完整内容，否则根据文件大小动态抽样，生成稳定的 SHA-256 指纹。
 *
 * 指纹仅依赖算法版本、文件大小和抽样内容，不包含文件名、路径或修改时间。
 */
export async function createFileFingerprint(file: File): Promise<string> {
    const hash = await StackShaHash();
    // 使用版本号隔离未来的算法调整；文件大小可降低抽样内容相同导致的碰撞概率。
    hash.update(`file-fingerprint:${FINGERPRINT_VERSION}\0size:${file.size}\0`);
    if (file.size === 0) {
        return hash.digest();
    }
    if (file.size < FULL_HASH_MAX_SIZE) {
        // 小文件全量计算 Hash
        for (let start = 0; start < file.size; start += FULL_HASH_CHUNK_SIZE) {
            const end = Math.min(start + FULL_HASH_CHUNK_SIZE, file.size);
            const content = await file.slice(start, end).arrayBuffer();
            hash.update(new Uint8Array(content));
        }
    } else {
        // 稍大文件与大文件使用抽量计算 Hash
        const partCount = PART_RULES.find((rule) => file.size <= rule.maxSize)?.partCount ?? 200;
        for (let index = 0; index < partCount; index += 1) {
            const partStart = Math.floor((file.size * index) / partCount);
            const partEnd = Math.floor((file.size * (index + 1)) / partCount);
            const end = partStart + Math.min(partEnd - partStart, SAMPLE_SIZE);
            const content = await file.slice(partStart, end).arrayBuffer();
            hash.update(new Uint8Array(content));
        }
    }
    return hash.digest();
}
