/**
 * Uppy 必须使用真实 OSS Host 生成 SigV4 签名。开发测试时仅替换实际 XHR
 * 的 origin，让请求先到当前 Vite 服务；对象路径和签名查询参数保持不变。
 */
export function installLocalOssProxy(ossOrigin: string): void {
  if (typeof XMLHttpRequest === "undefined") return;

  const normalizedOrigin = new URL(ossOrigin).origin;
  const nativeOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    const requestUrl = new URL(String(url), window.location.href);
    const proxiedUrl = requestUrl.origin === normalizedOrigin
      ? `${window.location.origin}${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`
      : url;
    return Reflect.apply(nativeOpen, this, [method, proxiedUrl, ...rest]);
  } as typeof XMLHttpRequest.prototype.open;
}
