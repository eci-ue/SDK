import {createMd5Hash} from "../hash/md5";

const CHINESE_CHARACTER_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const ASCII_EXTENSION_PATTERN = /^\.[a-z0-9]+$/i;

/** 生成安全的对象 Key，并保留授权接口下发的目录前缀。 */
export async function createObjectName(
  dir: string,
  fileName: string,
): Promise<string> {
  // 对目录前后多余的“/”做归一化，但保留目录内部的层级结构。
  const cleanDir = dir.replace(/^\/+|\/+$/g, "");
  const safeFileName = await normalizeFileName(fileName);
  const prefix = cleanDir ? `${cleanDir}/` : "";
  // 时间戳降低同一目录下同名文件互相覆盖的概率。
  return `${prefix}${Date.now()}-${safeFileName}`;
}

/**
 * 中文文件名统一转换为 MD5，避免不同 S3 兼容服务对 Unicode Key 的处理差异。
 * 扩展名不参与展示名称，但会保留在哈希值之后，便于对象存储识别文件类型。
 */
async function normalizeFileName(fileName: string): Promise<string> {
  if (CHINESE_CHARACTER_PATTERN.test(fileName)) {
    const extension = getAsciiExtension(fileName);
    return `${await createMd5Hash(fileName)}${extension}`;
  }

  // 非中文名称沿用原规则，将可能破坏 URL 或对象 Key 的字符替换为下划线。
  return fileName.replace(/[^\w.\-]/g, "_");
}

/** 仅保留常见 ASCII 扩展名，避免中文扩展名重新进入对象 Key。 */
function getAsciiExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return "";

  const extension = fileName.slice(dotIndex);
  return ASCII_EXTENSION_PATTERN.test(extension) ? extension.toLowerCase() : "";
}
