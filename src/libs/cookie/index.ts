/**
 * js-cookie 公共入口。
 *
 * 保留 js-cookie 原始对象，外部调用方可以直接使用完整 API，包括 get、
 * set、remove、withAttributes 和 withConverter 等方法。
 */
import Cookies from "js-cookie";

/** 暴露完整的 js-cookie 对象，供 SDK 使用方直接进行 cookie 操作。 */
export {Cookies};

/** js-cookie.set 方法支持的 cookie 属性类型。 */
export type CookieAttributes = NonNullable<Parameters<typeof Cookies.set>[2]>;
