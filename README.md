# @ue/sdk 使用指南

## 安装

```bash
npm install @ue/sdk
```

所有运行时方法和 TypeScript 类型均从 `@ue/sdk` 导入。

## 导出一览

当前包根入口提供以下运行时对象：

```ts
import {
    definePlugin,
    URL,
    path,
    base64,
    watermark,
    copy,
    FileFingerprint,
    FileHash,
    FileFullHash,
    hashFileByFixedSamples,
    MD5Hash,
    Sha256Hash,
    StackShaHash,
    AcceptCheck,
    upload,
    createFileUrl,
    createObjectName,
    createS3Endpoint,
    resolveS3Credentials,
} from "@ue/sdk";
```

提供以下 TypeScript 类型：

```ts
import type {
    Plugin,
    WatermarkOptions,
    AcceptFile,
    AcceptFun,
    FileSignaturePayload,
    FileSignatureResult,
    S3UploadConfig,
    UploadedFile,
    UploadCallbacks,
    UploadOptions,
    UploadProgress,
    UploadServices,
} from "@ue/sdk";
```

## 文件上传

### `AcceptCheck(accept, file)`

在上传前判断文件是否符合格式要求。`file` 只需提供文件名，可按需提供 MIME 类型，因此既可以传入浏览器原生 `File`，也可以传入普通文件信息对象。

```ts
import {AcceptCheck} from "@ue/sdk";

const input = document.querySelector<HTMLInputElement>("#file")!;
const file = input.files?.[0];

if (file && !(await AcceptCheck("image/*, .pdf", file))) {
    throw new Error("仅支持图片或 PDF 文件");
}
```

字符串规则支持以下写法：

| 写法 | 作用 |
| --- | --- |
| `*` | 接受任意文件 |
| `image/*` | 接受 MIME 类型为图片的文件 |
| `video/*` | 接受 MIME 类型为视频的文件 |
| `.png` 或 `png` | 按文件扩展名匹配，不区分大小写 |
| `.png,.jpg pdf` | 同时指定多个格式；支持中英文逗号、顿号和空白分隔 |

也可以传入同步或异步自定义校验函数。自定义函数可能返回 `Promise`，通用调用场景建议统一使用 `await`：

```ts
import {AcceptCheck} from "@ue/sdk";
import type {AcceptFun} from "@ue/sdk";

const checkFile: AcceptFun = async (file) => {
    const forbidden = await fetch(
        `/api/files/forbidden?name=${encodeURIComponent(file.name)}`,
    ).then((response) => response.json() as Promise<boolean>);
    return !forbidden;
};

const candidate = {name: "report.pdf", type: "application/pdf"};
if (!(await AcceptCheck(checkFile, candidate))) {
    throw new Error("文件未通过校验");
}
```

`accept` 为空时返回 `true`；规则不匹配、缺少待校验文件或文件没有通配规则所需的 MIME 类型时返回 `false`。自定义校验函数抛出的异常会继续向调用方抛出。

### `upload(file, options)`

`upload` 会依次计算文件指纹、查询服务端是否存在相同文件，并在未命中秒传时获取 S3 配置完成上传。

```ts
import {upload} from "@ue/sdk";
import type {
    FileSignaturePayload,
    FileSignatureResult,
    S3UploadConfig,
} from "@ue/sdk";

async function checkFileSignature(
    payload: FileSignaturePayload,
): Promise<FileSignatureResult> {
    const response = await fetch("/api/files/signature/check", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    });
    return response.json();
}

async function getUploadConfig(
    payload: FileSignaturePayload,
): Promise<S3UploadConfig> {
    const response = await fetch("/api/files/upload-config", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    });
    return response.json();
}

const input = document.querySelector<HTMLInputElement>("#file")!;
const file = input.files?.[0];

if (file) {
    try {
        const result = await upload(file, {
            checkFileSignature,
            getUploadConfig,
            change({percent}) {
                console.log(`上传进度：${percent}%`);
            },
            error(error) {
                console.error("上传过程发生异常", error);
            },
        });

        console.log(result.objectName);
        console.log(result.url);
        console.log(result.fingerprint);
        console.log(result.uploadMode); // "put" | "multipart" | "skip"
    } catch (error) {
        // error 回调执行后，upload 仍会抛出异常，调用方应按需捕获。
        console.error("上传失败", error);
    }
}
```

服务调用顺序如下：

1. SDK 生成文件指纹。
2. 调用 `checkFileSignature(payload)` 查询相同文件。
3. 如果返回完整的 `objectName` 和 `url`，直接以 `uploadMode: "skip"` 完成秒传。
4. 未命中时调用 `getUploadConfig(payload)` 获取上传凭证。
5. 根据文件大小选择普通 PUT 或 Multipart 上传。

如果不需要秒传，可以始终返回 `{exists: false}`：

```ts
const result = await upload(file, {
    checkFileSignature: async () => ({exists: false}),
    getUploadConfig,
});
```

### S3 上传配置

`getUploadConfig` 需要返回以下结构：

```ts
const config: S3UploadConfig = {
    region: "us-east-1",
    bucket: "example-bucket",
    accessKeyId: "temporary-access-key-id",
    secretAccessKey: "temporary-secret-access-key",
    sessionToken: "temporary-session-token",
    expiration: "2026-09-03T12:00:00.000Z",
    dir: "uploads/images",

    // AWS S3 可省略；S3 兼容服务按需设置。
    endpoint: "https://s3.example.com",
    forcePathStyle: true,

    // 返回文件地址时优先使用此公开域名。
    publicBaseUrl: "https://cdn.example.com",

    // 达到阈值且文件大于 5 MiB 时启用 Multipart。
    multipartUploadThreshold: 100 * 1024 * 1024,
    partSize: 8 * 1024 * 1024,
    parallel: 4,
};
```

| 字段 | 说明 |
| --- | --- |
| `region` | S3 区域，用于请求路由和签名 |
| `bucket` | 目标存储桶 |
| `accessKeyId` | AWS S3 标准 Access Key ID |
| `secretAccessKey` | AWS S3 标准 Secret Access Key |
| `sessionToken` | STS 临时令牌，可选 |
| `expiration` | 临时凭证过期时间，可选 |
| `dir` | 对象 Key 的目录前缀 |
| `endpoint` | 自定义 S3 Endpoint，可选 |
| `publicBaseUrl` | 最终文件访问域名，可选 |
| `forcePathStyle` | 是否使用 `endpoint/bucket` 路径模式 |
| `cdnBaseUrl` | 已弃用的公开域名字段，请改用 `publicBaseUrl` |
| `secure` | Endpoint 未包含协议时是否使用 HTTPS，默认启用 |
| `multipartUploadThreshold` | Multipart 上传阈值，单位为字节 |
| `partSize` | Multipart 单个分片大小，单位为字节 |
| `parallel` | Multipart 最大并发请求数 |

阿里云 OSS 的授权字段需要转换为 AWS S3 标准名称：

```text
accessId      -> accessKeyId
accessKey     -> secretAccessKey
securityToken -> sessionToken
```

OSS S3 兼容模式可以使用：

```ts
const config: S3UploadConfig = {
    region: authorization.region,
    bucket: authorization.containerName,
    accessKeyId: authorization.accessId,
    secretAccessKey: authorization.accessKey,
    sessionToken: authorization.securityToken,
    dir: authorization.dir,
    endpoint: `https://s3.oss-${authorization.region}.aliyuncs.com`,
    forcePathStyle: false,
    multipartUploadThreshold: 100 * 1024 * 1024,
    partSize: 8 * 1024 * 1024,
    parallel: 4,
};
```

浏览器直传需要存储桶正确配置 CORS。Multipart 上传还应允许所需请求方法，并暴露 `ETag` 和 `Location` 响应头。由于上传请求会自动写入 `Content-Disposition`，CORS 的 `AllowedHeaders` 还需要包含 `Content-Disposition`。SDK 使用 `hash-wasm` 生成 SigV4 预签名 URL，因此普通 HTTP 页面也能上传，不依赖仅在安全上下文中可用的 `crypto.subtle`。`upload()` 依赖浏览器的 `File` 与 `XMLHttpRequest`，不适用于纯 Node.js 进程。

上传时 SDK 会保存以下对象元数据，使浏览器直接访问文件地址时按附件下载：

```http
Content-Disposition: attachment; filename="example.txt"
```

中文文件名会同时写入符合 RFC 5987 的 `filename*` 参数，确保下载时恢复原始名称：

```http
Content-Disposition: attachment; filename="download.txt"; filename*=UTF-8''%E7%A4%BA%E4%BE%8B.txt
```

### 上传相关类型

| 类型 | 用途 |
| --- | --- |
| `AcceptFile` | `AcceptCheck` 所需的最小文件信息，包含 `name` 和可选的 `type` |
| `AcceptFun` | 自定义同步或异步文件格式校验函数 |
| `FileSignaturePayload` | 传给指纹检查和上传配置服务的文件信息 |
| `FileSignatureResult` | 指纹检查结果；命中时可携带对象 Key 和访问地址 |
| `S3UploadConfig` | S3 凭证、Endpoint、分片及并发配置 |
| `UploadedFile` | `upload()` 成功后的对象信息、地址、指纹和上传模式 |
| `UploadProgress` | 上传百分比对象，范围为 0～100 |
| `UploadCallbacks` | `change` 和 `error` 回调集合 |
| `UploadServices` | `checkFileSignature` 和 `getUploadConfig` 服务集合 |
| `UploadOptions` | `UploadCallbacks` 与 `UploadServices` 的组合类型 |

## 文件指纹

### `FileFingerprint(file)`

根据文件大小生成稳定指纹。指纹不包含文件名、路径和最后修改时间，因此复制文件不会仅因修改时间变化而产生不同结果。

```ts
import {FileFingerprint} from "@ue/sdk";

const fingerprint = await FileFingerprint(file);
console.log(fingerprint);
```

- 小于 5 MiB 的文件会分块读取全部内容。
- 大于或等于 5 MiB 的文件会根据文件大小动态抽样。
- 大文件指纹用于快速识别，不等同于完整文件的 SHA-256 完整性校验。
- 指纹包含算法版本和文件大小，不能当作文件原始内容的标准 SHA-256 值。

## Hash 方法

包根入口导出 `MD5Hash`、`Sha256Hash`、`StackShaHash`、`FileHash`、`FileFullHash` 和 `hashFileByFixedSamples`；其他内部的 Hash 创建函数不属于对外 API。

### `MD5Hash(content)`

计算字符串或 `ArrayBuffer` 的 MD5：

```ts
import {MD5Hash} from "@ue/sdk";

const textHash = await MD5Hash("hello");
const fileHash = await MD5Hash(await file.arrayBuffer());
```

### `Sha256Hash(content)`

计算字符串或 `ArrayBuffer` 的 SHA-256：

```ts
import {Sha256Hash} from "@ue/sdk";

const textHash = await Sha256Hash("hello");
const fileHash = await Sha256Hash(await file.arrayBuffer());
```

该方法优先使用 `globalThis.crypto.subtle`。如果运行环境不支持 Web Crypto，当前实现会回退到 MD5。

### `StackShaHash()`

创建增量 SHA-256 计算器，适合大文件或流式数据。每次 `update` 会立即更新内部 Hash 状态，不会累计保存全部输入内容。

```ts
import {StackShaHash} from "@ue/sdk";

const hash = await StackShaHash();
const chunkSize = 512 * 1024;

for (let start = 0; start < file.size; start += chunkSize) {
    const end = Math.min(start + chunkSize, file.size);
    const buffer = await file.slice(start, end).arrayBuffer();
    hash.update(new Uint8Array(buffer));
}

const digest = hash.digest();
```

`digest()` 会结束本轮计算；需要计算新内容时应重新调用 `StackShaHash()`。

### `FileHash(file)`

计算浏览器 `File` 对象的 SHA-256 Hash：

```ts
import {FileHash} from "@ue/sdk";

const hash = await FileHash(file);
```

- 不超过 20 MiB 的文件计算完整内容。
- 大于 20 MiB 的文件按 1 MiB 分成多份，每份取前 10 KiB；最后一份不足 10 KiB 时读取整个分片。
- 最终结果是所有分片 Hash 拼接后再次计算得到的 SHA-256 Hash。

### `FileFullHash(file, fullFileHashMaxSize?)`

计算浏览器 `File` 对象的 SHA-256 Hash：

```ts
import {FileFullHash} from "@ue/sdk";

const hash = await FileFullHash(file);
```

- 不传 `fullFileHashMaxSize` 时，默认不超过 1 GiB 的文件读取完整内容，并以 512 KiB 为单位分块处理，避免一次性将整个文件载入内存。
- 传入 `fullFileHashMaxSize` 可以自定义完整计算的大小上限，单位为字节；超过该上限后采用分段采样。
- 超过完整计算上限的文件按 1 MiB 分成多份，每份取前 10 KiB 计算 Hash；最后一份不足 10 KiB 时读取整个分片。
- 最终结果是所有分片 Hash 拼接后再次计算得到的 SHA-256 Hash。

由于不同设备的 CPU、内存和磁盘读取性能存在差异，大文件完整计算可能占用较多系统资源并影响页面响应。建议根据目标设备性能合理设置 `fullFileHashMaxSize`；性能较弱的设备应适当降低该值，让大文件更早采用分段采样。

### `hashFileByFixedSamples(file)`

直接按固定分片规则计算文件采样 Hash，适合需要主动控制采样策略的场景：

```ts
import {hashFileByFixedSamples} from "@ue/sdk";

const hash = await hashFileByFixedSamples(file);
```

- 文件按 1 MiB 分成多份，每份取前 10 KiB 计算 Hash。
- 最后一份不足 10 KiB 时读取整个分片。
- 最终结果是所有分片 Hash 拼接后再次计算得到的 SHA-256 Hash。

## URL 方法

### `URL`

SDK 的 `URL` 继承自原生 `globalThis.URL`，额外提供查询参数读写和格式化方法。建议导入时设置别名，避免与全局 `URL` 混淆。

```ts
import {URL as SDKURL} from "@ue/sdk";

const url = new SDKURL("/api/users?page=1", "https://example.com");

console.log(url.getQuery("page")); // "1"

url.setQuery("page", 2);
url.setQuery("keyword", "测试");
url.setQuery("keyword", undefined); // 删除该参数

console.log(url.pathname); // "/api/users"
console.log(url.query);    // Map<string, string | number | undefined>
console.log(url.format()); // "https://example.com/api/users?page=2"
```

构造参数：

```ts
new SDKURL(value?, domain?)
```

- `value`：绝对地址或相对路径，默认 `/`。
- `domain`：相对路径使用的基础域名；浏览器中默认使用当前页面域名，非浏览器环境默认使用 `http://localhost`。

## Base64 与水印

Base64 与水印功能分别通过 `base64` 和 `watermark` 命名空间导出：

```ts
import {base64, watermark} from "@ue/sdk";
```

### `base64.Encode(value)` / `base64.Decode(value)`

按 UTF-8 编码转换字符串，支持中文等非 ASCII 字符：

```ts
const encoded = base64.Encode("内部资料");
const value = base64.Decode(encoded);
```

### `watermark.textToBase64SVG(text, options?)`

将文本生成可直接用于图片 `src` 或 CSS `background-image` 的 Base64 SVG 水印。

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `fontSize` | `number` | `20` | 文字大小 |
| `color` | `string` | `rgba(0,0,0,0.05)` | 文字颜色 |
| `width` | `number` | `200` | SVG 最小宽度，文字较长时会自动扩展 |
| `height` | `number` | `160` | SVG 高度 |
| `rotate` | `number` | `-25` | 文字旋转角度 |

```ts
const value = watermark.textToBase64SVG("内部资料", {
    color: "rgba(0,0,0,0.05)",
    rotate: -25,
});
```

## 剪贴板

### `copy.text(value)`

将文本复制到系统剪贴板，返回 `Promise<boolean>` 表示是否复制成功。SDK 优先使用 Clipboard API，并在不可用时使用原生 `textarea` 方案回退，不依赖 jQuery 或 UI 框架。

复制操作应直接由用户点击、键盘操作等交互事件触发；Clipboard API 通常要求 HTTPS 等安全上下文。复制成功或失败后的通知由业务层自行处理。

```ts
import {copy} from "@ue/sdk";

const success = await copy.text("内部资料");
if (!success) {
    console.error("复制失败");
}
```

## 路径方法

路径方法以 `path` 命名空间导出：

```ts
import {path} from "@ue/sdk";

path.isHttp("https://example.com/a"); // true
path.isAbsolute("/images/a.png");     // true

path.normalize("/api/./users/../profile/");
// "/api/profile/"

path.join("/api", "users", "../profile");
// "/api/profile"
```

| 方法 | 作用 |
| --- | --- |
| `path.isHttp(value)` | 判断字符串是否以 HTTP 或 HTTPS 协议开头 |
| `path.isAbsolute(value)` | 判断路径是否以 `/` 开头 |
| `path.normalize(value)` | 清理空路径段、`.` 和 `..`，并保留绝对路径与末尾 `/` |
| `path.join(...values)` | 拼接多个路径段并执行规范化 |

## S3 辅助方法

### `resolveS3Credentials(config)`

校验并提取标准 S3 凭证。缺少 `accessKeyId` 或 `secretAccessKey` 时会抛出异常。

```ts
import {resolveS3Credentials} from "@ue/sdk";

const credentials = resolveS3Credentials(config);
// {accessKeyId, secretAccessKey, sessionToken}
```

### `createS3Endpoint(config)`

根据配置生成最终上传 Endpoint：

```ts
import {createS3Endpoint} from "@ue/sdk";

const endpoint = createS3Endpoint(config);
```

- 未配置 `endpoint`：生成 AWS S3 标准虚拟主机地址。
- `forcePathStyle: false`：生成 `https://bucket.example.com` 形式。
- `forcePathStyle: true`：生成 `https://example.com/bucket` 形式。

### `createFileUrl(config, s3Endpoint, objectName)`

根据公开域名和对象 Key 生成最终访问地址。路径中的每一级都会单独 URL 编码。

```ts
import {createFileUrl} from "@ue/sdk";

const url = createFileUrl(
    config,
    "https://example-bucket.s3.us-east-1.amazonaws.com",
    "uploads/示例图片.png",
);
```

访问域名按 `publicBaseUrl`、旧版 `cdnBaseUrl`、`s3Endpoint` 的顺序选择。

### `createObjectName(dir, fileName)`

生成带目录前缀和时间戳的安全对象 Key：

```ts
import {createObjectName} from "@ue/sdk";

const objectName = await createObjectName("uploads/images", "产品 图.png");
// 示例："uploads/images/1788422400000-<32 位 MD5>.png"
```

包含中文的完整文件名会转换为 MD5，并保留合法的 ASCII 扩展名；其他文件名中的
非常用字符会被替换为 `_`。该方法是异步方法，并使用当前时间戳，因此相同参数在
不同时间调用可能返回不同结果。

## 插件辅助方法

### `definePlugin(plugin)`

定义符合 SDK 插件约定的对象，同时保留传入对象的具体 TypeScript 类型。

```ts
import {definePlugin} from "@ue/sdk";
import type {Plugin} from "@ue/sdk";

const plugin = definePlugin({
    name: "logger",
    setup() {
        console.log("插件已启动");
    },
    teardown() {
        console.log("插件已销毁");
    },
});

await plugin.setup();
await plugin.teardown?.();

const anotherPlugin: Plugin = {
    name: "analytics",
    setup: async () => {},
};
```

`setup` 为必填方法，`teardown` 为可选方法，两者都可以同步执行或返回 `Promise`。
