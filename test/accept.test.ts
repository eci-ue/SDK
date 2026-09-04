import assert from "node:assert/strict";
import test from "node:test";

import AcceptCheck from "../src/libs/upload/accept.ts";

function createFile(name: string, type?: string) {
  return {name, type};
}

test("allows files when no accept condition is provided", async () => {
  assert.equal(AcceptCheck(undefined, createFile("anything.bin")), true);
});

test("supports wildcards and case-insensitive file extensions", async () => {
  assert.equal(AcceptCheck("*", createFile("archive.bin")), true);
  assert.equal(AcceptCheck("image/*", createFile("photo.PNG", "image/png")), true);
  assert.equal(AcceptCheck("video/*", createFile("clip.mp4", "video/mp4")), true);
  assert.equal(AcceptCheck("image/*", createFile("photo.PNG")), false);
  assert.equal(AcceptCheck(".png", createFile("photo.PNG")), true);
  assert.equal(AcceptCheck("PDF", createFile("manual.pdf")), true);
});

test("supports multiple conditions and rejects unmatched files", async () => {
  const file = createFile("manual.pdf", "application/pdf");

  assert.equal(AcceptCheck(".png、 .jpg，pdf txt", file), true);
  assert.equal(AcceptCheck(".png,.jpg", file), false);
  assert.equal(AcceptCheck(".pdf"), false);
});

test("preserves synchronous and asynchronous custom validator results", async () => {
  const file = createFile("manual.pdf");

  assert.equal(AcceptCheck((value) => value.name === "manual.pdf", file), true);
  assert.equal(await AcceptCheck(async () => false, file), false);
  assert.throws(
    () => AcceptCheck(() => { throw new Error("invalid"); }, file),
    /invalid/,
  );
});
