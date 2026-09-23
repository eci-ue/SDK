/**
 * 将文本复制到系统剪贴板。
 *
 * 优先使用异步 Clipboard API；在 API 不可用或被浏览器拒绝时，回退到
 * 原生 textarea 与 `document.execCommand("copy")`，以兼容较旧浏览器。
 * 此模块不依赖 jQuery 或任何 UI 框架。
 */
export async function text(value: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch {
            // Clipboard API 可能因非安全上下文或权限限制失败，继续尝试回退方案。
        }
    }

    return copyWithTextarea(value);
}

/** 使用原生 DOM 临时节点执行兼容性复制。 */
function copyWithTextarea(value: string): boolean {
    if (typeof document === "undefined" || !document.body) {
        return false;
    }

    const textarea = document.createElement("textarea");
    const activeElement = document.activeElement as HTMLElement | null;
    const selection = document.getSelection?.();
    const ranges = selection
        ? Array.from({length: selection.rangeCount}, (_, index) =>
            selection.getRangeAt(index).cloneRange())
        : [];

    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

    document.body.appendChild(textarea);

    try {
        textarea.focus({preventScroll: true});
        textarea.select();
        return document.execCommand("copy");
    } catch {
        return false;
    } finally {
        textarea.remove();

        if (selection && ranges.length > 0) {
            selection.removeAllRanges();
            for (const range of ranges) {
                selection.addRange(range);
            }
        }

        if (activeElement?.isConnected) {
            activeElement.focus({preventScroll: true});
        }
    }
}
