import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeDiagnosticMetadata } from "./diagnostics.js";

test("diagnostic metadata preserves only the existing allowlisted evidence", () => {
  assert.deepEqual(sanitizeDiagnosticMetadata({
    devtools: { enabled: true, injected: true, uploadMode: "direct" },
    artifact: {
      format: "acurast-zip",
      entrypoint: "bundle.cjs",
      restartPolicy: "no"
    },
    sourceBundleSha256: "A".repeat(64),
    failure: { mode: "acurast-really-exit" },
    scenarioArtifact: { profile: "runnable-no-retry", fixture: "runnable" }
  }), {
    devtools: { enabled: true, injected: true, uploadMode: "direct" },
    artifact: {
      format: "acurast-zip",
      entrypoint: "bundle.cjs",
      restartPolicy: "no"
    },
    sourceBundleSha256: "a".repeat(64),
    failure: { mode: "acurast-really-exit" },
    scenarioArtifact: { profile: "runnable-no-retry", fixture: "runnable" }
  });
});

test("diagnostic metadata rejects unknown, spend-capable, and unsafe fields", () => {
  assert.throws(
    () => sanitizeDiagnosticMetadata({ token: "not-allowed" }),
    /token is not allowed/u
  );
  assert.throws(
    () => sanitizeDiagnosticMetadata({ devtools: { uploadMode: "cli" } }),
    /must be direct/u
  );
  assert.throws(
    () => sanitizeDiagnosticMetadata({ artifact: { entrypoint: "../bundle.cjs" } }),
    /safe relative artifact path/u
  );
  assert.throws(
    () => sanitizeDiagnosticMetadata({ failure: { mode: "shell" } }),
    /must be exit or acurast-really-exit/u
  );
});
