import {ONLYOFFICE_PLUGIN_CONFIG_PATH} from "./constants";

function getOrigin(origin?: string): string {
    if (origin) {
        return origin;
    }
    if (typeof window !== "undefined" && window.location.origin) {
        return window.location.origin;
    }
    return "http://localhost";
}

function normalizePath(value: string): string {
    return value.replace(/^\/+|\/+$/g, "");
}

/** 将应用语言代码转换为 OnlyOffice 使用的语言代码。 */
export function getOnlyOfficeLanguage(language?: string): string {
    switch (String(language ?? "").trim()) {
        case "zh-cn":
            return "zh";
        case "hk":
            return "zh-TW";
        case "ja":
            return "ja";
        case "ka":
            return "ko";
        case "en":
        default:
            return "en";
    }
}

/** 根据部署基础路径（例如 /lint 或 /user/）解析静态资源 URL。 */
export function resolveStaticAssetUrl(
    baseUrl: string | undefined,
    assetPath: string,
    origin?: string,
): string {
    const base = String(baseUrl || "/");
    const baseWithSlash = base.endsWith("/") ? base : `${base}/`;
    const root = new URL(baseWithSlash, getOrigin(origin));
    return new URL(normalizePath(assetPath), root).toString();
}

/** 在保留宿主应用查询参数约定的同时构建回调 URL。 */
export function createCallbackUrl(options: {
    officeBase?: string;
    callbackPath: string;
    query?: Record<string, string | number | boolean | undefined>;
    origin?: string;
}): string {
    const base = new URL(String(options.officeBase || "/"), getOrigin(options.origin));
    const basePath = normalizePath(base.pathname);
    const callbackPath = normalizePath(options.callbackPath);
    base.pathname = `/${[basePath, callbackPath].filter(Boolean).join("/")}`;

    for (const [key, value] of Object.entries(options.query || {})) {
        if (value !== undefined) {
            base.searchParams.set(key, String(value));
        }
    }
    return base.toString();
}

/** 获取两个内置插件的默认配置地址。 */
export function getDefaultPluginUrls(
    staticBaseUrl?: string,
    origin?: string,
): string[] {
    return [
        resolveStaticAssetUrl(staticBaseUrl, ONLYOFFICE_PLUGIN_CONFIG_PATH.datePicker, origin),
        resolveStaticAssetUrl(staticBaseUrl, ONLYOFFICE_PLUGIN_CONFIG_PATH.columnLock, origin),
    ];
}
