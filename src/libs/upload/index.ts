import {createFileFingerprint} from "../fingerprint";
import {uploadFileWithUppy} from "./uppy";
import type {UploadedFile, UploadOptions} from "./types";

/**
 * 上传一个文件。
 *
 * 异常会先通过 error 回调通知调用方，然后继续以 rejected Promise 抛出。
 */
export async function upload(
    file: File,
    {
        getUploadConfig,
        checkFileSignature,
        change,
        error,
    }: UploadOptions,
): Promise<UploadedFile> {
    try {
        // 指纹检查先于凭证获取：命中秒传时既不会申请临时凭证，也不会产生 S3 请求。
        const fingerprint = await createFileFingerprint(file);
        // 将文件基础信息与内容指纹一并交给业务服务，用于查询已上传的相同文件。
        const payload = {
            fileName: file.name,
            fileSize: file.size,
            lastModified: file.lastModified,
            fingerprint,
        };
        const signature = await checkFileSignature(payload);

        // 只有服务端明确返回完整对象信息时才执行秒传，避免残缺响应产生无效结果。
        if (signature.exists && signature.objectName && signature.url) {
            // 秒传没有真实的网络上传过程，直接通知调用方任务已完成。
            change?.({percent: 100});
            return {
                objectName: signature.objectName,
                url: signature.url,
                uploadMode: "skip",
                fingerprint,
            };
        }

        // 未命中秒传后再获取短期上传配置，减少不必要的凭证签发。
        const config = await getUploadConfig(payload);

        // 底层上传函数负责选择普通 PUT 或 Multipart，并返回最终对象信息。
        const result = await uploadFileWithUppy(config, file, change);
        return {...result, fingerprint};
    } catch (cause) {
        // 统一 unknown 异常类型，并保证回调通知与 Promise 拒绝使用同一个 Error 实例。
        const uploadError = toError(cause);
        error?.(uploadError);
        throw uploadError;
    }
}

/** 将第三方库或业务回调抛出的任意值规范化为 Error。 */
function toError(cause: unknown): Error {
    if (cause instanceof Error) return cause;
    return new Error(typeof cause === "string" ? cause : "upload error");
}

export {createFileUrl, createS3Endpoint, resolveS3Credentials} from "./config";
export {createAttachmentContentDisposition} from "./content-disposition";
export {createObjectName} from "./object-key";
export type {
    FileSignaturePayload,
    FileSignatureResult,
    S3UploadConfig,
    UploadedFile,
    UploadCallbacks,
    UploadOptions,
    UploadProgress,
    UploadServices,
} from "./types";
