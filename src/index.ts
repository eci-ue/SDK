/** A framework-agnostic plugin contract. */
export interface Plugin {
    readonly name: string;

    setup(): void | Promise<void>;

    teardown?(): void | Promise<void>;
}

/** Defines a plugin while preserving its concrete type. */
export function definePlugin<T extends Plugin>(plugin: T): T {
    return plugin;
}

export {URL} from "./utils/url";
export * as path from "./utils/path";
export {createFileFingerprint as FileFingerprint} from "./libs/fingerprint";
export {
    MD5Hash,
    FileHash,
    hashFileByFixedSamples,
    Sha256Hash,
    StackShaHash,
    FileFullHash,
} from "./libs/hash";
export {
    AcceptCheck,
    createAttachmentContentDisposition,
    createFileUrl,
    createObjectName,
    createS3Endpoint,
    resolveS3Credentials,
    upload,
} from "./libs/upload";
export type {
    AcceptFile,
    AcceptFun,
    FileSignaturePayload,
    FileSignatureResult,
    S3UploadConfig,
    UploadedFile,
    UploadCallbacks,
    UploadOptions,
    UploadProgress,
    UploadServices,
} from "./libs/upload";
