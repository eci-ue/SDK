import {createStackShaHash} from "./sha256";

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;
const FILE_HASH_FULL_MAX_SIZE = 20 * MB;
const FULL_FILE_HASH_MAX_SIZE = GB;
const FIXED_SAMPLE_PART_SIZE = MB;
const FIXED_SAMPLE_SIZE = 10 * KB;
const FULL_HASH_CHUNK_SIZE = 512 * KB;

async function hashChunk(file: File, start: number, end: number): Promise<string> {
    const content = await file.slice(start, end).arrayBuffer();
    const hash = await createStackShaHash();
    hash.update(new Uint8Array(content));
    return hash.digest();
}

async function hashFullFileContent(file: File): Promise<string> {
    const hash = await createStackShaHash();

    for (let start = 0; start < file.size; start += FULL_HASH_CHUNK_SIZE) {
        const end = Math.min(start + FULL_HASH_CHUNK_SIZE, file.size);
        const content = await file.slice(start, end).arrayBuffer();
        hash.update(new Uint8Array(content));
    }

    return hash.digest();
}

/** 按 1 MiB 分片并取每片前 10 KiB，计算文件的采样 SHA-256 Hash。 */
export async function hashFileByFixedSamples(file: File): Promise<string> {
    const finalHash = await createStackShaHash();

    for (let start = 0; start < file.size; start += FIXED_SAMPLE_PART_SIZE) {
        const end = Math.min(start + FIXED_SAMPLE_PART_SIZE, file.size);
        const sampleEnd = Math.min(start + FIXED_SAMPLE_SIZE, end);
        const partHash = await hashChunk(file, start, sampleEnd);
        finalHash.update(partHash);
    }

    return finalHash.digest();
}

/**
 * 计算文件完整内容的 SHA-256 Hash；超过指定大小时改用固定分片抽样，避免
 * 为超大文件执行完整读取。
 */
export async function hashFullFile(
    file: File,
    fullFileHashMaxSize = FULL_FILE_HASH_MAX_SIZE,
): Promise<string> {
    if (file.size <= fullFileHashMaxSize) {
        return hashFullFileContent(file);
    }

    return hashFileByFixedSamples(file);
}

/**
 * 为浏览器 File 对象计算 SHA-256 Hash。
 *
 * 不超过 20 MiB 的文件计算完整内容；更大的文件按 1 MiB 分片抽样，每个
 * 分片最多读取前 10 KiB，然后对所有分片 Hash 的拼接结果再次计算 SHA-256。
 */
export async function createFileHash(file: File): Promise<string> {
    if (file.size <= FILE_HASH_FULL_MAX_SIZE) {
        return hashFullFile(file);
    }

    return hashFileByFixedSamples(file);
}
