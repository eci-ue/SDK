/** 日期选择插件的 OnlyOffice 标识。 */
export const DATE_PICKER_PLUGIN_GUID = "asc.{66B5BFEB-80B8-45AB-A7EE-C0C341E6F3D6}";

/** 列锁定插件的 OnlyOffice 标识。 */
export const COLUMN_LOCK_PLUGIN_GUID = "asc.{98CBCAA1-3113-4A12-AE5F-2B6801F71F3C}";

/** 内置插件配置文件相对于静态资源根目录的路径。 */
export const ONLYOFFICE_PLUGIN_CONFIG_PATH = {
    datePicker: "onlyoffice/date-picker/config.json",
    columnLock: "onlyoffice/column-lock/config.json",
} as const;
