/** 文件格式校验所需的最小文件信息。 */
export type AcceptFile = Pick<File, "name"> & Partial<Pick<File, "type">>;

/** 自定义文件接收条件；返回 true 时允许上传。 */
export type AcceptFun = (file: AcceptFile) => boolean | Promise<boolean>;

/** 校验单个 accept 条件是否与文件匹配。 */
function verifyAccept(accept: string, file: AcceptFile): boolean {
    const normalizedAccept = accept.trim().toLowerCase();

    // 星号表示允许任意文件。
    if (normalizedAccept === "*") return true;

    // 保留源实现支持的图片和视频 MIME 通配符。
    const fileType = file.type?.toLowerCase();
    if (normalizedAccept === "image/*" && fileType?.includes("image/")) {
        return true;
    }
    if (normalizedAccept === "video/*" && fileType?.includes("video/")) {
        return true;
    }

    // 同时兼容 "png" 和 ".png" 两种扩展名写法，比较时忽略大小写。
    const suffix = file.name.toLowerCase().split(".").at(-1) ?? "";
    return suffix === normalizedAccept || `.${suffix}` === normalizedAccept;
}

/**
 * 判断文件是否满足上传接收条件。
 *
 * accept 为空时默认允许；字符串可使用逗号、中文逗号、顿号或空白分隔。
 * 返回值保留自定义校验器的同步或异步形态。
 */
export const AcceptCheck = function (
    acceptCondition?: string | AcceptFun,
    file?: AcceptFile,
): boolean | Promise<boolean> {
    if (!acceptCondition) return true;

    if (file && typeof acceptCondition === "function") {
        return acceptCondition(file);
    }

    if (file && typeof acceptCondition === "string") {
        for (const item of acceptCondition.split(/[、,，\s]/g)) {
            if (verifyAccept(item, file)) return true;
        }
    }

    return false;
}
