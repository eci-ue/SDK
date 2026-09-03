export interface S3UploadConfig {
  /** 存储桶所在区域，用于请求路由和 SigV4 签名。 */
  region: string;
  /** 文件最终写入的存储桶名称。 */
  bucket: string;
  /** AWS S3 兼容的 Access Key ID。 */
  accessKeyId: string;
  /** AWS S3 兼容的 Secret Access Key。 */
  secretAccessKey: string;
  /** 使用 STS 临时凭证时传入 Session Token。 */
  sessionToken?: string;
  /** STS 临时凭证的过期时间。 */
  expiration?: string;
  /** 上传对象的目录前缀。 */
  dir: string;
  /** S3 或兼容存储服务的自定义 Endpoint。 */
  endpoint?: string;
  /** 文件上传完成后对外返回的访问域名。 */
  publicBaseUrl?: string;
  /** 是否使用 endpoint/bucket 形式的路径模式。 */
  forcePathStyle?: boolean;
  /** @deprecated 请使用 publicBaseUrl。 */
  cdnBaseUrl?: string;
  /** 自定义 Endpoint 未携带协议时是否启用 HTTPS，默认为 true。 */
  secure?: boolean;
  /** 达到此字节数后尝试使用 Multipart 上传。 */
  multipartUploadThreshold: number;
  /** Multipart 上传中每个分片的字节数。 */
  partSize: number;
  /** Multipart 分片的最大并发请求数。 */
  parallel: number;
}

export interface UploadedFile {
  /** 文件在存储桶中的完整对象 Key。 */
  objectName: string;
  /** 可供业务侧访问的最终文件地址。 */
  url: string;
  /** 实际采用的上传方式；skip 表示命中秒传。 */
  uploadMode: "put" | "multipart" | "skip";
  /** 本次文件内容的稳定指纹。 */
  fingerprint: string;
}

export interface FileSignaturePayload {
  /** 原始文件名，仅作为业务信息，不直接决定内容指纹。 */
  fileName: string;
  /** 文件字节数。 */
  fileSize: number;
  /** 浏览器提供的最后修改时间。 */
  lastModified: number;
  /** 客户端根据文件内容生成的指纹。 */
  fingerprint: string;
}

export interface FileSignatureResult {
  /** 服务端是否已存在相同文件。 */
  exists: boolean;
  /** 命中秒传时返回的对象 Key。 */
  objectName?: string;
  /** 命中秒传时返回的文件访问地址。 */
  url?: string;
}

export interface UploadProgress {
  /** 0 到 100 之间的上传百分比。 */
  percent: number;
}

export interface UploadCallbacks {
  /** 接收上传进度。简单上传只触发 0 和 100，分片上传会持续更新。 */
  change?: (progress: UploadProgress) => void;
  /** 接收指纹计算、接口请求或 S3 上传过程中的异常。 */
  error?: (error: Error) => void;
}

export interface UploadServices {
  /** 根据当前文件信息获取一次性或短期有效的 S3 上传配置。 */
  getUploadConfig: (
    payload: FileSignaturePayload,
  ) => Promise<S3UploadConfig>;
  /** 根据文件指纹检查服务端是否已有可复用的上传结果。 */
  checkFileSignature: (
    payload: FileSignaturePayload,
  ) => Promise<FileSignatureResult>;
}

/** upload() 单次调用所需的服务实现和事件回调。 */
export interface UploadOptions extends UploadCallbacks, UploadServices {}
