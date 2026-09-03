const HEADER_UNSAFE_PATTERN = /[\r\n]/g;
const NON_ASCII_FILENAME_PATTERN = /[^\x20-\x7e]/;

/**
 * 生成用于强制下载的 Content-Disposition。
 * 中文等非 ASCII 名称使用 RFC 5987 filename*，避免浏览器写入 Header 时抛错。
 */
export function createAttachmentContentDisposition(fileName: string): string {
  const normalizedName = fileName.replace(HEADER_UNSAFE_PATTERN, "").trim() || "download";
  const fallbackName = createAsciiFallback(normalizedName);
  const disposition = `attachment; filename="${escapeQuotedValue(fallbackName)}"`;

  if (!NON_ASCII_FILENAME_PATTERN.test(normalizedName)) return disposition;

  return `${disposition}; filename*=UTF-8''${encodeRfc5987Value(normalizedName)}`;
}

function createAsciiFallback(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const extension = dotIndex > 0 ? fileName.slice(dotIndex).replace(/[^.a-z0-9]/gi, "") : "";
  const baseName = (dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName)
    .replace(/[^a-z0-9._-]/gi, "_")
    .replace(/^_+|_+$/g, "");
  return `${baseName || "download"}${extension}`;
}

function escapeQuotedValue(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
