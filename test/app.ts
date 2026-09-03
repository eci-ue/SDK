import {upload} from "../src/index";
import {getOssUploadConfig} from "./oss-authorization";
import {installLocalOssProxy} from "./oss-proxy";

const MB = 1024 * 1024;
const OSS_PROXY_ORIGIN = "https://lqabaseout.s3.oss-ap-southeast-1.aliyuncs.com";

installLocalOssProxy(OSS_PROXY_ORIGIN);

const form = getElement<HTMLFormElement>("upload-form");
const fileInput = getElement<HTMLInputElement>("file-input");
const uploadButton = getElement<HTMLButtonElement>("upload-button");
const resetButton = getElement<HTMLButtonElement>("reset-config");
const clearButton = getElement<HTMLButtonElement>("clear-output");
const dropZone = getElement<HTMLElement>("drop-zone");
const output = getElement<HTMLPreElement>("output");
const fileName = getElement<HTMLElement>("file-name");
const fileSize = getElement<HTMLElement>("file-size");
const progress = getElement<HTMLProgressElement>("upload-progress");
const progressValue = getElement<HTMLElement>("progress-value");
const progressLabel = getElement<HTMLElement>("progress-label");
const runtimeStatus = getElement<HTMLElement>("runtime-status");

let selectedFile: File | undefined;

fileInput.addEventListener("change", () => {
  setSelectedFile(fileInput.files?.[0]);
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
}

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files[0];
  if (file) setSelectedFile(file);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedFile) return;
  const file = selectedFile;

  setBusy(true);
  setProgress(0, "正在计算文件指纹");
  output.textContent = "正在准备上传…";

  try {
    const result = await upload(file, {
      checkFileSignature: async () => ({exists: false}),
      getUploadConfig: () => readConfig(file),
      change({percent}) {
        setProgress(percent, percent >= 100 ? "上传完成" : "正在上传到 S3");
      },
      error(error) {
        runtimeStatus.textContent = "上传异常";
        runtimeStatus.dataset.state = "error";
        output.textContent = formatError(error);
      },
    });

    runtimeStatus.textContent = "上传成功";
    runtimeStatus.dataset.state = "success";
    output.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    runtimeStatus.textContent = "测试失败";
    runtimeStatus.dataset.state = "error";
    output.textContent = formatError(error);
  } finally {
    setBusy(false);
  }
});

resetButton.addEventListener("click", () => {
  form.reset();
  runtimeStatus.textContent = "已恢复默认配置";
  delete runtimeStatus.dataset.state;
});

clearButton.addEventListener("click", () => {
  output.textContent = "等待下一次测试。";
  setProgress(0, "准备就绪");
  runtimeStatus.textContent = "等待配置";
  delete runtimeStatus.dataset.state;
});

async function readConfig(file: File) {
  runtimeStatus.textContent = "正在获取 OSS 临时凭证";
  return getOssUploadConfig(file, {
    authUrl: getInputValue("auth-url"),
    token: getInputValue("authorization"),
    multipartThresholdMb: Number(getInputValue("multipart-threshold")),
    partSizeMb: Number(getInputValue("part-size")),
  });
}

function setSelectedFile(file?: File) {
  selectedFile = file;
  uploadButton.disabled = !file;
  fileName.textContent = file?.name ?? "点击选择文件";
  fileSize.textContent = file ? formatBytes(file.size) : "尚未选择";
  setProgress(0, file ? "文件已就绪" : "准备就绪");
  runtimeStatus.textContent = file ? "可以开始测试" : "等待配置";
  delete runtimeStatus.dataset.state;
}

function setBusy(busy: boolean) {
  uploadButton.disabled = busy || !selectedFile;
  fileInput.disabled = busy;
  uploadButton.textContent = busy ? "上传处理中…" : "开始上传";
}

function setProgress(percent: number, label: string) {
  const value = Math.min(Math.max(Math.round(percent), 0), 100);
  progress.value = value;
  progress.textContent = `${value}%`;
  progressValue.textContent = `${value}%`;
  progressLabel.textContent = label;
}

function getInputValue(id: string) {
  return getElement<HTMLInputElement>(id).value.trim();
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`找不到页面元素：${id}`);
  return element as T;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(2)} MB`;
}

function formatError(error: unknown) {
  const value = error instanceof Error ? error : new Error(String(error));
  return JSON.stringify(
    {name: value.name, message: value.message, stack: value.stack},
    null,
    2,
  );
}
