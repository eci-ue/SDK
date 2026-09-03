import assert from "node:assert/strict";
import test from "node:test";

import {createSigV4Presigner} from "../src/libs/upload/signer.ts";

const FIXED_DATE = new Date("2026-09-03T06:30:00.000Z");
const createPresigner = () => createSigV4Presigner({
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret",
  sessionToken: "token",
  region: "ap-southeast-1",
  endpoint: "https://bucket.s3.oss-ap-southeast-1.aliyuncs.com",
}, () => FIXED_DATE);

test("presigns a PUT request without Web Crypto", async () => {
  const result = await createPresigner()({
    method: "PUT",
    key: "目录/a b.txt",
  });

  assert.equal(
    result.url,
    "https://bucket.s3.oss-ap-southeast-1.aliyuncs.com/%E7%9B%AE%E5%BD%95/a%20b.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIDEXAMPLE%2F20260903%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20260903T063000Z&X-Amz-Expires=3600&X-Amz-Security-Token=token&X-Amz-SignedHeaders=host&X-Amz-Signature=89c8593a2e58db8b99bae4afd9f83fe5007523b9ee92119cccd612febfe800cf",
  );
});

test("presigns a multipart creation request", async () => {
  const result = await createPresigner()({
    method: "POST",
    key: "uploads/a.bin",
  });

  assert.equal(
    result.url,
    "https://bucket.s3.oss-ap-southeast-1.aliyuncs.com/uploads/a.bin?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIDEXAMPLE%2F20260903%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20260903T063000Z&X-Amz-Expires=3600&X-Amz-Security-Token=token&X-Amz-SignedHeaders=host&uploads=&X-Amz-Signature=c87500d7799774b25415a4ca81549aa5dcaaacc2f8bae072cda2a93649acc167",
  );
});
