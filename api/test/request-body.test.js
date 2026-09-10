import test from "node:test";
import assert from "node:assert/strict";
import { readBody } from "../src/lib/ai.js";

test("request limits hold without a Content-Length header", async () => {
  await assert.rejects(readBody(new Request("http://localhost", { method: "POST", body: JSON.stringify({ value: "x".repeat(100) }) }), 50), { status: 413 });
});

test("request bodies must be JSON objects", async () => {
  for (const body of ["null", "[]", '"text"', "{"]) {
    await assert.rejects(readBody(new Request("http://localhost", { method: "POST", body })), { status: 400 });
  }
});
