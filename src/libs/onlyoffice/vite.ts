import fs from "node:fs";
import nodePath from "node:path";
import type {Plugin} from "vite";

export interface OnlyOfficeAssetsPluginOptions {
    /** 覆盖 SDK 内置资源目录，用于本地或自定义部署。 */
    sourceDirectory?: string;
    /** 编辑器 pluginsData 配置使用的 URL 前缀。 */
    publicPath?: string;
}

function collectAssets(directory: string): Array<{relativePath: string; source: Buffer}> {
    const result: Array<{relativePath: string; source: Buffer}> = [];

    function visit(currentDirectory: string, relativeDirectory: string): void {
        for (const entry of fs.readdirSync(currentDirectory, {withFileTypes: true})) {
            const currentPath = nodePath.join(currentDirectory, entry.name);
            const relativePath = nodePath.join(relativeDirectory, entry.name);
            if (entry.isDirectory()) {
                visit(currentPath, relativePath);
            } else if (entry.isFile()) {
                result.push({
                    relativePath: relativePath.split(nodePath.sep).join("/"),
                    source: fs.readFileSync(currentPath),
                });
            }
        }
    }

    if (fs.existsSync(directory)) {
        visit(directory, "");
    }
    return result;
}

function resolveAssetsDirectory(sourceDirectory?: string): string | undefined {
    if (sourceDirectory) {
        return fs.existsSync(sourceDirectory) ? sourceDirectory : undefined;
    }

    // 从应用工作目录解析已发布的 SDK，兼容 ESM 和 CJS 格式的 Vite 配置文件。
    const packageDirectory = nodePath.resolve(
        process.cwd(),
        "node_modules/@ue/sdk/dist/onlyoffice",
    );
    return fs.existsSync(packageDirectory) ? packageDirectory : undefined;
}

function getContentType(filePath: string): string {
    const extension = nodePath.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
    };
    return contentTypes[extension] || "application/octet-stream";
}

/**
 * 在开发环境提供 OnlyOffice 插件文件，并在应用构建时输出这些资源。
 * 应用层只需要在 Vite 配置中注册该插件即可。
 */
export function onlyOfficeAssetsPlugin(options: OnlyOfficeAssetsPluginOptions = {}): Plugin {
    const sourceDirectory = resolveAssetsDirectory(options.sourceDirectory);
    const publicPath = `/${(options.publicPath || "onlyoffice").replace(/^\/+|\/+$/g, "")}`;

    return {
        name: "onlyoffice-assets",
        configureServer(server) {
            if (!sourceDirectory) {
                return;
            }

            server.middlewares.use(publicPath, function (request, response, next) {
                let requestPath: string;
                try {
                    requestPath = decodeURIComponent(String(request.url || "/").split("?", 1)[0]);
                } catch (_error) {
                    next();
                    return;
                }

                const relativePath = requestPath.replace(/^[/\\]+/, "");
                const filePath = nodePath.resolve(sourceDirectory, relativePath);
                const sourceRoot = nodePath.resolve(sourceDirectory) + nodePath.sep;
                if (!filePath.startsWith(sourceRoot) || !fs.existsSync(filePath)) {
                    next();
                    return;
                }

                const stat = fs.statSync(filePath);
                if (!stat.isFile()) {
                    next();
                    return;
                }

                response.setHeader("Access-Control-Allow-Origin", "*");
                response.setHeader("Content-Type", getContentType(filePath));
                response.end(fs.readFileSync(filePath));
            });
        },
        generateBundle() {
            if (!sourceDirectory) {
                return;
            }

            for (const asset of collectAssets(sourceDirectory)) {
                this.emitFile({
                    type: "asset",
                    fileName: `${publicPath.slice(1)}/${asset.relativePath}`,
                    source: asset.source,
                });
            }
        },
    };
}
