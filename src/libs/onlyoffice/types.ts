import type {LanguageType} from "../language";

export interface OnlyOfficeUser {
    /** 用户 ID。 */
    id?: string | number;
    /** 用户显示名称。 */
    name?: string;
}

export interface OnlyOfficeEditor {
    /** OnlyOffice 编辑器实例提供的销毁方法。 */
    destroyEditor?: () => void;
}

export interface OnlyOfficeConfig {
    /** 允许透传 OnlyOffice 后续版本新增的配置项。 */
    [key: string]: unknown;
}

export interface OnlyOfficeApi {
    /** OnlyOffice 提供的文档编辑器构造函数。 */
    DocEditor: new (placeholderId: string, config: OnlyOfficeConfig) => OnlyOfficeEditor;
}

export interface SpreadsheetPluginOptions {
    /** 是否启用日期格式单元格的日期选择插件。 */
    datePicker?: boolean;
    /** 是否启用列保护，并使用 lockedColumns 指定锁定列。 */
    columnLock?: boolean;
    /** 允许调用方覆盖内置插件的配置文件 URL。 */
    configUrls?: Partial<Record<"datePicker" | "columnLock", string>>;
}

export interface SpreadsheetEditorOptions {
    /** 宿主页面中用于挂载编辑器的容器 ID。 */
    containerId: string;
    /** 表格文件访问地址。 */
    documentUrl: string;
    /** OnlyOffice 用于识别文档版本的唯一键。 */
    documentKey: string;
    /** 文档标题。 */
    title?: string;
    /** 是否以只读模式打开。 */
    disabled?: boolean;
    /** 是否使用紧凑工具栏。 */
    compactToolbar?: boolean;
    /** 需要锁定的列名称列表。 */
    lockedColumns?: string[];
    /** OnlyOffice 使用的语言代码。 */
    language?: LanguageType;
    /** 文档保存回调地址。 */
    callbackUrl?: string;
    /** 当前编辑用户信息。 */
    user?: OnlyOfficeUser;
    /** SDK 静态资源的访问基础路径。 */
    staticBaseUrl?: string;
    /** 用于解析相对 URL 的宿主页面 origin。 */
    origin?: string;
    /** 按调用方选择需要启用的插件。 */
    plugins?: SpreadsheetPluginOptions;
    /** 可选的自定义 OnlyOffice API，便于测试或宿主环境注入。 */
    docsApi?: OnlyOfficeApi;
}

export interface SpreadsheetEditorHandle {
    /** 创建编辑器时使用的最终配置。 */
    readonly config: OnlyOfficeConfig;
    /** OnlyOffice 编辑器实例。 */
    readonly instance: OnlyOfficeEditor;
    /** 幂等销毁编辑器实例。 */
    destroy: () => void;
}
