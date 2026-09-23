import assert from "node:assert/strict";
import test from "node:test";

import {Decode, Encode} from "../src/utils/base64.ts";
import {textToBase64SVG} from "../src/utils/watermark.ts";

test("encodes and decodes Unicode text as Base64", () => {
    const value = "SDK 水印 – 演示";
    const encoded = Encode(value);

    assert.equal(encoded, "U0RLIOawtOWNsCDigJMg5ryU56S6");
    assert.equal(Decode(encoded), value);
});

test("generates a configurable SVG watermark data URL", () => {
    const result = textToBase64SVG("内部 <资料>", {
        fontSize: 16,
        color: "rgba(1,2,3,0.2)",
        width: 240,
        height: 120,
        rotate: -10,
    });
    const prefix = "data:image/svg+xml;base64,";

    assert.equal(result.startsWith(prefix), true);
    assert.equal(
        Decode(result.slice(prefix.length)),
        '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><text x="0" y="60" font-size="16" fill="rgba(1,2,3,0.2)" transform="rotate(-10 120 60)">内部 &lt;资料&gt;</text></svg>',
    );
});
