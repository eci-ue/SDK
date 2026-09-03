/** 生成安全的对象 Key，并保留授权接口下发的目录前缀。 */
export function createObjectName(dir: string, fileName: string): string {
  // 对目录前后多余的“/”做归一化，但保留目录内部的层级结构。
  const cleanDir = dir.replace(/^\/+|\/+$/g, "");
  // 替换可能破坏 URL 或对象 Key 的字符，同时保留中文、字母、数字及常见文件名符号。
  const safeFileName = fileName.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_");
  const prefix = cleanDir ? `${cleanDir}/` : "";
  // 时间戳降低同一目录下同名文件互相覆盖的概率。
  return `${prefix}${Date.now()}-${safeFileName}`;
}
