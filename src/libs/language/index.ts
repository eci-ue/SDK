/**
 * 与框架无关的语言状态工具。
 *
 * cookie 持久化统一使用 SDK 公共入口提供的 js-cookie 对象。
 * 所有浏览器环境访问都经过判断，因此可以安全地在 SSR 或 Node.js 环境中导入。
 */

import {Cookies} from "../cookie";

/** 语言状态使用的默认 cookie 名称。 */
export const LANGUAGE_COOKIE_KEY = "APP_LANG";

/** SDK 支持的语言类型。 */
export enum LanguageType {
    Chinese = "zh-cn",
    English = "en",
    HkChinese = "hk",
    Korean = "ka",
    Japanese = "ja",
}

/** 语言状态读写配置。 */
export interface LanguageOptions {
    /** cookie 名称，默认使用 `APP_LANG`。 */
    cookieKey?: string;
    /** cookie 生效路径，默认使用 `/`。 */
    cookiePath?: string;
    /** 可选的 cookie 生效域名。 */
    cookieDomain?: string;
    /** cookie 不存在时使用的回退语言。 */
    defaultLanguage?: string | LanguageType;
}

/** 使用 js-cookie 读取指定名称的 cookie。 */
function getCookie(name: string): string {
    if (typeof document === "undefined") {
        return "";
    }

    return Cookies.get(name) || "";
}

/** 使用 js-cookie 写入语言 cookie。 */
function setCookie(name: string, value: string, options: LanguageOptions): void {
    if (typeof document === "undefined") {
        return;
    }

    Cookies.set(name, value, {
        path: options.cookiePath || "/",
        ...(options.cookieDomain ? {domain: options.cookieDomain} : {}),
    });
}

/** 判断传入值是否为 SDK 支持的语言。 */
function isLanguage(value: string | LanguageType): value is LanguageType {
    switch (value) {
        case LanguageType.Chinese:
        case LanguageType.English:
        case LanguageType.HkChinese:
        case LanguageType.Korean:
        case LanguageType.Japanese:
            return true;
        default:
            return false;
    }
}

/**
 * 获取当前语言。
 *
 * 如果 cookie 尚未写入，则使用配置的回退语言，并将其初始化到 cookie。
 */
export function currentType(options: LanguageOptions = {}): string {
    const cookieKey = options.cookieKey || LANGUAGE_COOKIE_KEY;
    let value = getCookie(cookieKey);

    if (!value) {
        value = options.defaultLanguage || LanguageType.Chinese;
        changeType(value, options);
    }

    return String(value).trim();
}

/**
 * 切换并持久化语言。
 *
 * 只有 SDK 支持的语言值才会写入 cookie，并通过返回值报告校验结果。
 */
export function changeType(
    value: string | LanguageType,
    options: LanguageOptions = {},
): boolean {
    if (!isLanguage(value)) {
        return false;
    }

    const cookieKey = options.cookieKey || LANGUAGE_COOKIE_KEY;
    setCookie(cookieKey, value, options);
    return true;
}
