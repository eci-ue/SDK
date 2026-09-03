import type {S3UploadConfig} from "./types";

export interface ResolvedS3Credentials {
  /** 用于标识调用方身份的访问密钥 ID。 */
  accessKeyId: string;
  /** 用于计算请求签名的私有密钥。 */
  secretAccessKey: string;
  /** STS 临时凭证对应的安全令牌；长期凭证时为空字符串。 */
  sessionToken: string;
}

/** 校验并提取符合 AWS S3 命名规范的上传凭证。 */
export function resolveS3Credentials(
  config: S3UploadConfig,
): ResolvedS3Credentials {
  // 将可选的 sessionToken 统一为空字符串，简化 Uppy 凭证对象的组装逻辑。
  const {accessKeyId, secretAccessKey, sessionToken = ""} = config;

  // Access Key 和 Secret Key 是签名请求的必填项，尽早报错可避免创建无效上传任务。
  if (!accessKeyId) {
    throw new Error("Missing accessKeyId in configuration");
  }
  if (!secretAccessKey) {
    throw new Error("Missing secretAccessKey in configuration");
  }

  return {accessKeyId, secretAccessKey, sessionToken};
}

/**
 * 生成最终参与 SigV4 签名的 S3 Endpoint。
 * 同时兼容虚拟主机模式（bucket.example.com）和路径模式（example.com/bucket）。
 */
export function createS3Endpoint(config: S3UploadConfig): string {
  // 未提供自定义 Endpoint 时，使用 AWS S3 标准虚拟主机地址。
  if (!config.endpoint) {
    return `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
  }

  // 兼容授权接口返回的完整 URL 或单纯域名，并允许私有环境显式使用 HTTP。
  const endpoint = /^https?:\/\//i.test(config.endpoint)
    ? config.endpoint
    : `${config.secure === false ? "http" : "https"}://${config.endpoint}`;
  const url = new URL(endpoint);

  if (config.forcePathStyle) {
    // 路径模式示例：https://s3.example.com/bucket。
    url.pathname = joinUrlPath(url.pathname, config.bucket);
  } else if (!url.hostname.startsWith(`${config.bucket}.`)) {
    // 授权接口可能直接返回带 bucket 的域名，此时不能重复拼接。
    url.hostname = `${config.bucket}.${url.hostname}`;
  }

  return url.toString().replace(/\/$/, "");
}

/** 根据公开域名和对象 Key 生成最终访问地址。 */
export function createFileUrl(
  config: S3UploadConfig,
  s3Endpoint: string,
  objectName: string,
): string {
  // 访问地址优先使用业务公开域名，其次兼容旧版 CDN 配置，最后回退到上传端点。
  const publicBaseUrl = config.publicBaseUrl ?? config.cdnBaseUrl ?? s3Endpoint;
  return createObjectUrl(publicBaseUrl, objectName);
}

/** 使用指定 Endpoint 生成对象请求地址，不受 publicBaseUrl 配置影响。 */
export function createObjectUrl(baseUrl: string, objectName: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${encodeObjectKey(objectName)}`;
}

/** 对对象 Key 的每一级路径分别编码，避免将目录分隔符“/”编码掉。 */
function encodeObjectKey(objectName: string): string {
  return objectName.split("/").map(encodeURIComponent).join("/");
}

/** 合并 Endpoint 原有路径与 bucket，并清理重复的路径分隔符。 */
function joinUrlPath(...parts: string[]): string {
  return `/${parts
    .flatMap((part) => part.split("/"))
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/")}`;
}
