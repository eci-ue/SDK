interface UploadHeaderRule {
  origin: string;
  pathname: string;
  contentDisposition: string;
}

type XhrOpen = typeof XMLHttpRequest.prototype.open;

const rules = new Map<symbol, UploadHeaderRule>();
let originalOpen: XhrOpen | undefined;
let patchedOpen: XhrOpen | undefined;

/**
 * 为当前对象上传临时注册 Content-Disposition。
 * Uppy 6 的客户端凭证模式没有自定义对象 Header 接口，因此在 XHR open 后、send 前注入。
 */
export function registerContentDispositionHeader(
  objectUrl: string,
  contentDisposition: string,
): () => void {
  if (typeof XMLHttpRequest === "undefined") return () => undefined;

  installInterceptor();
  const url = new URL(objectUrl);
  const id = Symbol("upload-header-rule");
  rules.set(id, {
    origin: url.origin,
    pathname: url.pathname,
    contentDisposition,
  });

  return () => {
    rules.delete(id);
    restoreInterceptorWhenIdle();
  };
}

function installInterceptor(): void {
  if (originalOpen) return;

  originalOpen = XMLHttpRequest.prototype.open;
  const nativeOpen = originalOpen;
  patchedOpen = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    const requestUrl = new URL(String(url), globalThis.location?.href);
    const result = Reflect.apply(nativeOpen, this, [method, url, ...rest]);

    for (const rule of rules.values()) {
      if (matchesObjectWrite(method, requestUrl, rule)) {
        this.setRequestHeader("Content-Disposition", rule.contentDisposition);
        break;
      }
    }

    return result;
  } as XhrOpen;
  XMLHttpRequest.prototype.open = patchedOpen;
}

/** 只在普通 PUT 或 Multipart 初始化阶段写入对象元数据。 */
function matchesObjectWrite(
  method: string,
  requestUrl: URL,
  rule: UploadHeaderRule,
): boolean {
  if (requestUrl.origin !== rule.origin || requestUrl.pathname !== rule.pathname) {
    return false;
  }

  const normalizedMethod = method.toUpperCase();
  const isSinglePut = normalizedMethod === "PUT" &&
    !requestUrl.searchParams.has("uploadId") &&
    !requestUrl.searchParams.has("partNumber");
  const isMultipartCreate = normalizedMethod === "POST" &&
    requestUrl.searchParams.has("uploads") &&
    !requestUrl.searchParams.has("uploadId");
  return isSinglePut || isMultipartCreate;
}

function restoreInterceptorWhenIdle(): void {
  if (rules.size !== 0 || !originalOpen || !patchedOpen) return;

  // 仅当原型仍由本模块持有时恢复，避免覆盖其他库后续安装的 XHR 包装器。
  if (XMLHttpRequest.prototype.open === patchedOpen) {
    XMLHttpRequest.prototype.open = originalOpen;
  }
  originalOpen = undefined;
  patchedOpen = undefined;
}
