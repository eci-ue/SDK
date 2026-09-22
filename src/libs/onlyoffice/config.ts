import {LanguageType} from "../language";
import {resolveStaticAssetUrl} from "./url";
import {COLUMN_LOCK_PLUGIN_GUID, DATE_PICKER_PLUGIN_GUID, ONLYOFFICE_PLUGIN_CONFIG_PATH} from "./constants";

import type {OnlyOfficeConfig, SpreadsheetEditorOptions} from "./types";

function decodeFileName(value?: string): string {
    if (!value) {
        return "";
    }
    try {
        return decodeURIComponent(value);
    } catch (_error) {
        return value;
    }
}

/** 根据调用方启用的插件生成 OnlyOffice 插件配置。 */
function buildPluginConfig(options: SpreadsheetEditorOptions): OnlyOfficeConfig | undefined {
    const pluginOptions = options.plugins;
    if (!pluginOptions) {
        return undefined;
    }

    const autostart: string[] = [];
    const pluginsData: string[] = [];
    const pluginConfig: Record<string, unknown> = {};
    const configUrls = pluginOptions.configUrls || {};

    if (pluginOptions.datePicker) {
        autostart.push(DATE_PICKER_PLUGIN_GUID);
        pluginsData.push(
            configUrls.datePicker ||
            resolveStaticAssetUrl(
                options.staticBaseUrl,
                ONLYOFFICE_PLUGIN_CONFIG_PATH.datePicker,
                options.origin,
            ),
        );
    }

    if (pluginOptions.columnLock) {
        autostart.push(COLUMN_LOCK_PLUGIN_GUID);
        pluginsData.push(
            configUrls.columnLock ||
            resolveStaticAssetUrl(
                options.staticBaseUrl,
                ONLYOFFICE_PLUGIN_CONFIG_PATH.columnLock,
                options.origin,
            ),
        );
        pluginConfig[COLUMN_LOCK_PLUGIN_GUID] = {
            lockedColumns: options.lockedColumns || [],
        };
    }

    if (!autostart.length) {
        return undefined;
    }

    return {
        autostart,
        ...(Object.keys(pluginConfig).length ? {options: pluginConfig} : {}),
        pluginsData,
    };
}

/** 构建 OnlyOffice 表格配置，不负责创建或渲染视图。 */
export function buildSpreadsheetConfig(options: SpreadsheetEditorOptions): OnlyOfficeConfig {
    const disabled = Boolean(options.disabled);
    const plugins = buildPluginConfig(options);
    const editorConfig: OnlyOfficeConfig = {
        lang: options.language || LanguageType.English,
        mode: disabled ? "view" : "edit",
        ...(options.callbackUrl ? {callbackUrl: options.callbackUrl} : {}),
        ...(plugins ? {plugins} : {}),
        customization: {
            about: true,
            forcesave: true,
            feedback: true,
            compactToolbar: disabled ? true : Boolean(options.compactToolbar),
            layout: {
                toolbar: !disabled,
                statusBar: false,
            },
        },
        ...(options.user ? {user: options.user} : {}),
    };

    return {
        width: "100%",
        height: "100%",
        type: "desktop",
        documentType: "cell",
        document: {
            fileType: "xlsx",
            key: options.documentKey,
            permissions: {
                chat: false,
                comment: false,
                edit: !disabled,
                copy: true,
                download: true,
                fillForms: true,
                modifyFilter: true,
                modifyContentControl: true,
                review: true,
                print: true,
            },
            title: decodeFileName(options.title),
            url: options.documentUrl,
        },
        editorConfig,
    };
}
