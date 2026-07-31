import assert from "node:assert/strict";
import test from "node:test";

import { safeLiskovErrorDetail } from "./http-error.js";

test("formats bounded server error code and reason", () => {
  assert.equal(
    safeLiskovErrorDetail({
      error: "invalid_application",
      reason: "application manifest is invalid"
    }),
    " (invalid_application: application manifest is invalid)"
  );
});

test("omits untrusted or oversized response detail", () => {
  assert.equal(safeLiskovErrorDetail({ error: "bad\ncode", reason: "safe" }), "");
  assert.equal(safeLiskovErrorDetail({ error: "safe", reason: "secret=value" }), " (safe)");
  assert.equal(safeLiskovErrorDetail({ error: "x".repeat(81) }), "");
  assert.equal(safeLiskovErrorDetail("invalid_application"), "");
});
