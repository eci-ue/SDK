import assert from "node:assert/strict";
import test from "node:test";

import {text} from "../src/utils/copy.ts";

test("uses the Clipboard API when it is available", async () => {
    const originalNavigator = globalThis.navigator;
    const copied: string[] = [];

    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {clipboard: {writeText: async (value: string) => copied.push(value)}},
    });

    try {
        assert.equal(await text("复制内容"), true);
        assert.deepEqual(copied, ["复制内容"]);
    } finally {
        Object.defineProperty(globalThis, "navigator", {
            configurable: true,
            value: originalNavigator,
        });
    }
});

test("returns false when no browser document is available", async () => {
    const originalNavigator = globalThis.navigator;

    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
    });

    try {
        assert.equal(await text("复制内容"), false);
    } finally {
        Object.defineProperty(globalThis, "navigator", {
            configurable: true,
            value: originalNavigator,
        });
    }
});
