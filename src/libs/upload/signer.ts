import {createHMAC, createSHA256} from "hash-wasm";

interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  endpoint: string;
}

interface PresignableRequest {
  method: "POST" | "GET" | "HEAD" | "PUT" | "DELETE";
  key: string;
  expiresIn?: number;
  uploadId?: string;
  partNumber?: number;
}

interface PresignedResponse {
  url: string;
}

const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const AWS_REQUEST_TYPE = "aws4_request";
const S3_SERVICE = "s3";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
const DEFAULT_EXPIRES_IN = 3600;

/**
 * 创建不依赖 Web Crypto 的 AWS SigV4 预签名器。
 * hash-wasm 可在普通 HTTP 页面运行，避免 Uppy 在请求发出前因 crypto.subtle 缺失而失败。
 */
export function createSigV4Presigner(
  credentials: SigV4Credentials,
  now: () => Date = () => new Date(),
): (request: PresignableRequest) => Promise<PresignedResponse> {
  const {
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region,
    endpoint,
  } = credentials;
  let signingKeyDate = "";
  let signingKey: Uint8Array | undefined;

  async function getSigningKey(dateStamp: string): Promise<Uint8Array> {
    if (signingKey && signingKeyDate === dateStamp) return signingKey;

    const dateKey = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
    const regionKey = await hmacSha256(dateKey, region);
    const serviceKey = await hmacSha256(regionKey, S3_SERVICE);
    signingKey = await hmacSha256(serviceKey, AWS_REQUEST_TYPE);
    signingKeyDate = dateStamp;
    return signingKey;
  }

  return async function presign(request: PresignableRequest): Promise<PresignedResponse> {
    const url = new URL(endpoint);
    const normalizedKey = request.key.replace(/^\/+/, "");
    const encodedKey = encodeObjectKey(normalizedKey);
    const canonicalPath = encodedKey
      ? `${url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`}${encodedKey}`
      : url.pathname;

    const current = now();
    const shortDate = current.toISOString().slice(0, 10).replace(/-/g, "");
    const fullDatetime = `${shortDate}T${current.toISOString().slice(11, 19).replace(/:/g, "")}Z`;
    const scope = `${shortDate}/${region}/${S3_SERVICE}/${AWS_REQUEST_TYPE}`;
    const credential = `${accessKeyId}/${scope}`;

    url.searchParams.set("X-Amz-Algorithm", AWS_ALGORITHM);
    url.searchParams.set("X-Amz-Content-Sha256", UNSIGNED_PAYLOAD);
    url.searchParams.set("X-Amz-Credential", credential);
    url.searchParams.set("X-Amz-Date", fullDatetime);
    url.searchParams.set("X-Amz-Expires", String(request.expiresIn ?? DEFAULT_EXPIRES_IN));
    url.searchParams.set("X-Amz-SignedHeaders", "host");
    if (sessionToken) url.searchParams.set("X-Amz-Security-Token", sessionToken);
    if (request.uploadId) url.searchParams.set("uploadId", request.uploadId);
    if (request.partNumber !== undefined) {
      url.searchParams.set("partNumber", String(request.partNumber));
    }
    if (request.method === "POST" && !request.uploadId) {
      url.searchParams.set("uploads", "");
    }
    url.searchParams.sort();

    const canonicalQuery = url.searchParams.toString().replace(/\+/g, "%20");
    const canonicalRequest = [
      request.method,
      canonicalPath,
      canonicalQuery,
      `host:${url.host}`,
      "",
      "host",
      UNSIGNED_PAYLOAD,
    ].join("\n");
    const stringToSign = [
      AWS_ALGORITHM,
      fullDatetime,
      scope,
      await sha256Hex(canonicalRequest),
    ].join("\n");
    const signature = toHex(await hmacSha256(await getSigningKey(shortDate), stringToSign));

    return {
      url: `${url.origin}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    };
  };
}

async function sha256Hex(value: string): Promise<string> {
  const hasher = await createSHA256();
  hasher.init();
  hasher.update(value);
  return hasher.digest("hex") as string;
}

async function hmacSha256(key: string | Uint8Array, value: string): Promise<Uint8Array> {
  const hasher = await createHMAC(createSHA256(), key);
  hasher.update(value);
  return hasher.digest("binary") as Uint8Array;
}

function encodeObjectKey(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, encodeCharacter)
    .replace(/%2F/gi, "/");
}

function encodeCharacter(value: string): string {
  return `%${value.charCodeAt(0).toString(16).toUpperCase()}`;
}

function toHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
