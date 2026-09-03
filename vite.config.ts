import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://lqa.dev.ecigames.buzz",
        changeOrigin: true,
      },
      "/": {
        target: "https://lqabaseout.s3.oss-ap-southeast-1.aliyuncs.com",
        changeOrigin: true,
        secure: true,
        // AWS SigV4 会签入完整对象路径和 OSS Host，不能重写上传路径。
        // 仅代理测试页改写到本地、且携带 SigV4 查询签名的请求。
        bypass(request) {
          const url = request.url ?? "/";
          return /(?:^|[?&])X-Amz-Algorithm=/i.test(url) ? undefined : url;
        },
      },
    },
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: [
        "@uppy/aws-s3",
        "@uppy/core",
        "hash-wasm",
      ],
    },
  },
});
