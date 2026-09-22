import {buildSpreadsheetConfig} from "./config";

import type {OnlyOfficeApi, SpreadsheetEditorHandle, SpreadsheetEditorOptions} from "./types";

let containerSequence = 0;

/** 创建唯一的占位容器 ID，实际容器由宿主框架负责渲染。 */
export function createEditorContainerId(prefix = "onlyoffice-editor"): string {
    containerSequence += 1;
    return `${prefix}-${Date.now()}-${containerSequence}`;
}

function getDocsApi(): OnlyOfficeApi {
    const api = (globalThis as typeof globalThis & {DocsAPI?: OnlyOfficeApi}).DocsAPI;
    if (!api?.DocEditor) {
        throw new Error("OnlyOffice DocsAPI is not available. Load api.js before creating the editor.");
    }
    return api;
}

/** 创建编辑器实例，宿主框架负责提供与销毁占位容器。 */
export function createSpreadsheetEditor(
    options: SpreadsheetEditorOptions,
): SpreadsheetEditorHandle {
    const config = buildSpreadsheetConfig(options);
    const api = options.docsApi || getDocsApi();
    const instance = new api.DocEditor(options.containerId, config);
    let destroyed = false;

    return {
        config,
        instance,
        destroy() {
            if (destroyed) {
                return;
            }
            destroyed = true;
            // OnlyOffice 的销毁方法可能不存在，使用可选调用保持兼容。
            instance.destroyEditor?.();
        },
    };
}
