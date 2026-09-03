import type {S3UploadConfig} from "../src/index";

const MB = 1024 * 1024;

interface AuthorizationOptions {
  authUrl: string;
  token: string;
  multipartThresholdMb: number;
  partSizeMb: number;
}

/** 后端原始字段仅属于调用方，SDK 不感知 Aliyun 专有命名。 */
interface OssAuthorizationResponse {
  msg: string;
  code: number;
  data: {
    host: string;
    dir: string;
    accessId: string;
    accessKey: string;
    securityToken: string;
    containerName: string;
    fileName: string;
    region: string;
    origin: string;
  };
}

/** 获取 STS 临时凭证，并转换为 SDK 使用的 S3 兼容配置。 */
export async function getOssUploadConfig(
  file: File,
  options: AuthorizationOptions,
): Promise<S3UploadConfig> {
  const authorization = await requestOssAuthorization(file, options);
  const data = authorization.data;

  return {
    region: data.region,
    bucket: data.containerName,
    // 在调用方完成 Aliyun STS 字段到 AWS S3 标准字段的转换。
    accessKeyId: data.accessId,
    secretAccessKey: data.accessKey,
    sessionToken: data.securityToken,
    dir: data.dir,
    // Uppy 按 AWS SigV4 签名，Aliyun OSS 需要使用其 S3 兼容 Endpoint。
    endpoint: `https://s3.oss-${data.region}.aliyuncs.com`,
    publicBaseUrl: normalizeHost(data.host),
    forcePathStyle: false,
    secure: true,
    multipartUploadThreshold: Math.max(options.multipartThresholdMb, 5) * MB,
    partSize: Math.max(options.partSizeMb, 5) * MB,
    parallel: 4,
  };
}

async function requestOssAuthorization(
  file: File,
  {authUrl, token}: AuthorizationOptions,
): Promise<OssAuthorizationResponse> {
  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({fileSize: file.size, fileName: file.name}),
  });

  if (!response.ok) {
    throw new Error(`授权接口请求失败：${response.status} ${response.statusText}`);
  }

  const value = (await response.json()) as OssAuthorizationResponse;
  if (value.code !== 200) {
    throw new Error(value.msg || `授权接口业务错误：${value.code}`);
  }

  const data = value.data;
  if (
    !data?.host ||
    !data.dir ||
    !data.accessId ||
    !data.accessKey ||
    !data.containerName ||
    !data.securityToken ||
    !data.region
  ) {
    throw new Error("授权接口 data 字段不完整");
  }

  return value;
}

function normalizeHost(host: string): string {
  if (host.startsWith("//")) return `https:${host}`;
  if (/^https?:\/\//i.test(host)) return host;
  return `https://${host}`;
}
