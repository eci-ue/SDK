import AwsS3, {type AwsBody} from "@uppy/aws-s3";
import Uppy from "@uppy/core";
import {
  createFileUrl,
  createObjectUrl,
  createS3Endpoint,
  resolveS3Credentials,
} from "./config";
import {createAttachmentContentDisposition} from "./content-disposition";
import {createObjectName} from "./object-key";
import {registerContentDispositionHeader} from "./request-headers";
import type {
  S3UploadConfig,
  UploadedFile,
  UploadProgress,
} from "./types";

/** 使用 Uppy 和 AWS S3 插件完成单文件上传。 */
export async function uploadFileWithUppy(
    config: S3UploadConfig,
    file: File,
    change?: (progress: UploadProgress) => void,
): Promise<Omit<UploadedFile, "fingerprint">> {
    // 在初始化上传器之前完成凭证校验，缺少字段时立即终止流程。
    const {accessKeyId, secretAccessKey, sessionToken} =
        resolveS3Credentials(config);

    // 对象 Key 和 Endpoint 在一次上传生命周期内保持不变，避免分片请求目标不一致。
    // 中文文件名会在这里异步转换为 MD5，后续所有分片共享同一个对象 Key。
    const objectName = await createObjectName(config.dir, file.name);
    const s3Endpoint = createS3Endpoint(config);
    const objectUrl = createObjectUrl(s3Endpoint, objectName);
    // AWS S3 要求 Multipart 的分片通常至少为 5 MiB，因此小文件强制使用普通 PUT。
    const useMultipart =
        file.size >= config.multipartUploadThreshold && file.size > 5 * 1024 * 1024;
    // 每次调用创建独立 Uppy 实例，限制只接收当前这一个文件。
    const uppy = new Uppy<Record<string, unknown>, AwsBody>({
        autoProceed: false,
        restrictions: {maxNumberOfFiles: 1},
    });

    uppy.use(AwsS3, {
        s3Endpoint,
        region: config.region,
        // Uppy 在准备 S3 请求时读取凭证；这里使用业务接口下发的临时或长期凭证。
        getCredentials: async () => ({
            credentials: {
                accessKeyId,
                secretAccessKey,
                sessionToken,
                expiration: config.expiration,
            },
            region: config.region,
        }),
        // 固定对象 Key，保证普通上传和所有 Multipart 分片写入同一位置。
        generateObjectKey: () => objectName,
        shouldUseMultipart: () => useMultipart,
        // 分片大小和并发数由服务端配置，以适应不同 S3 兼容服务的限制。
        getChunkSize: () => config.partSize,
        limit: config.parallel,
        allowedMetaFields: false,
    });

    // Uppy 初始化成功后再注册 Header，避免初始化异常时遗留 XHR 拦截器。
    const unregisterContentDisposition = registerContentDispositionHeader(
        objectUrl,
        createAttachmentContentDisposition(file.name),
    );

    try {
        // 将原生 File 注册到 Uppy，并在浏览器未提供 MIME 时使用通用二进制类型。
        const fileId = uppy.addFile({
            name: file.name,
            type: file.type || "application/octet-stream",
            data: file,
        });

        // Uppy 实例只有一个文件，但仍校验 fileId，防止未来扩展时串用其他文件的进度。
        uppy.on("upload-progress", (uppyFile, progress) => {
            if (uppyFile?.id !== fileId) return;
            // 新版事件直接提供 percentage；缺失时根据已上传字节数兼容计算。
            const percent = progress.percentage ?? (
                progress.bytesTotal
                    ? Math.round((progress.bytesUploaded / progress.bytesTotal) * 100)
                    : 0
            );
            change?.({percent: clampPercent(percent)});
        });

        // 上传开始前主动发送 0%，确保调用方可以立即初始化进度 UI。
        change?.({percent: 0});
        const result = await uppy.upload();
        // Uppy 将失败项放入 failed 数组，需要显式转换为 rejected Promise。
        const failed = result?.failed?.[0];
        if (failed) {
            throw new Error(failed.error || "File upload failed");
        }

        // 单文件上传理论上只有一个成功项；缺失时视为第三方库返回异常。
        const successful = result?.successful?.[0];
        if (!successful) {
            throw new Error("Upload result not returned");
        }

        const body = successful.response?.body;
        // 部分 S3 兼容服务不返回 key，因此回退到客户端生成的对象 Key。
        const key = body?.key || objectName;
        change?.({percent: 100});
        return {
            objectName: key,
            // 优先采用服务端地址，其次使用 Uppy 地址，最后由本地配置拼接公开 URL。
            url: body?.location || successful.uploadURL || createFileUrl(config, s3Endpoint, key),
            uploadMode: useMultipart ? "multipart" : "put",
        };
    } finally {
        unregisterContentDisposition();
        // 无论成功还是异常都销毁实例，释放事件监听器及 Multipart 相关资源。
        uppy.destroy();
    }
}

/** 将第三方上传进度归一化为 0～100 的整数。 */
function clampPercent(percent: number): number {
    return Math.min(Math.max(Math.round(percent), 0), 100);
}
