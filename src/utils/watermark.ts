import {Encode} from "./base64.ts";

/** Base64 SVG 水印的可选配置。 */
export interface WatermarkOptions {
    /** 文字大小，默认 20。 */
    fontSize?: number;
    /** 文字颜色，默认 `rgba(0,0,0,0.05)`。 */
    color?: string;
    /** SVG 最小宽度，默认 200。 */
    width?: number;
    /** SVG 高度，默认 160。 */
    height?: number;
    /** 文字旋转角度，默认 -25。 */
    rotate?: number;
}

const DEFAULT_OPTIONS: Required<WatermarkOptions> = {
    fontSize: 20,
    color: "rgba(0,0,0,0.05)",
    width: 200,
    height: 160,
    rotate: -25,
};

function escapeXml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        switch (character) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            case "'":
                return "&apos;";
            default:
                return character;
        }
    });
}

/**
 * 将文本生成 Base64 SVG 字符串。
 *
 * 返回值可以直接用作图片的 `src`，例如：
 * `background-image: url(${textToBase64SVG("内部资料")})`。
 */
export function textToBase64SVG(
    text: string,
    options: WatermarkOptions = {},
): string {
    const settings = {...DEFAULT_OPTIONS, ...options};
    const width = Math.max(text.length * 20, settings.width);
    const font = `<text x="0" y="${settings.height / 2}" font-size="${settings.fontSize}" fill="${escapeXml(settings.color)}" transform="rotate(${settings.rotate} ${width / 2} ${settings.height / 2})">${escapeXml(text)}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${settings.height}">${font.trim()}</svg>`;

    return `data:image/svg+xml;base64,${Encode(svg.trim())}`.trim();
}
