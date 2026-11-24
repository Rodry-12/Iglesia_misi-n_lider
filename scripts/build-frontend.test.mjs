import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "node:util";
import { resolveApiBaseUrl } from "./build-frontend.mjs";

test("hosting environment overrides frontend .env", () => {
  assert.equal(
    resolveApiBaseUrl(
      { MLP_API_BASE_URL: "https://api.host.org/api/v1/" },
      { MLP_API_BASE_URL: "https://api.file.org/api/v1" },
    ),
    "https://api.host.org/api/v1",
  );
});

test("reads a quoted dotenv value and preserves the same-origin default", () => {
  assert.equal(
    resolveApiBaseUrl(
      {},
      parseEnv('MLP_API_BASE_URL="https://api.example.org/api/v1"'),
    ),
    "https://api.example.org/api/v1",
  );
  assert.equal(resolveApiBaseUrl({}), "/api/v1");
});

for (const value of [
  "",
  "http://api.example.org/api/v1",
  "https://user:password@api.example.org/api/v1",
  "https://api.example.org/api/v1?secret=value",
  "https://api.example.org/api/v1#fragment",
  "https://api.example.org/wrong",
]) {
  test(`rejects an invalid build destination: ${value}`, () => {
    assert.throws(
      () => resolveApiBaseUrl({ MLP_API_BASE_URL: value }),
      /MLP_API_BASE_URL/,
    );
  });
}
