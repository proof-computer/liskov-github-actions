import assert from "node:assert/strict";
import test from "node:test";

import { requestUploadIntent, type UploadIntentInputs } from "./liskov-upload.js";

const inputs: UploadIntentInputs = {
  liskovUrl: "https://api.example/",
  organizationId: "org/a",
  applicationId: "app b",
  sha256: "a".repeat(64), byteSize: 123,
  manifestDigest: `sha256:${"b".repeat(64)}`, encryptionMode: "none"
};
const intent = {
  ok: true, uploadId: "upl-test", token: "upload-secret",
  upload: { url: "https://upload.example/pinning/pinFileToIPFS", method: "POST", field: "file" },
  gatewayUrlTemplate: "https://upload.example/ipfs/{cid}", maxBytes: 8388608,
  encryptionMode: "none", expiresAtMs: 1791797000000, cidVersion: 0
};

test("upload intent sends the exact org-qualified request and configurable audience", async () => {
  const result = await requestUploadIntent({ ...inputs, audience: "custom-audience" }, {
    getIdToken: async (audience) => { assert.equal(audience, "custom-audience"); return "oidc-secret"; },
    fetchImpl: (async (url, init) => {
      assert.equal(url, "https://api.example/api/organizations/org%2Fa/applications/app%20b/artifact-upload-intents");
      assert.equal(init?.method, "POST");
      assert.deepEqual(init?.headers, { authorization: "Bearer oidc-secret", "content-type": "application/json" });
      assert.deepEqual(JSON.parse(String(init?.body)), {
        sha256: inputs.sha256, byteSize: 123, manifestDigest: inputs.manifestDigest, encryptionMode: "none"
      });
      return Response.json(intent);
    }) as typeof fetch
  });
  assert.deepEqual(result, intent);
});

for (const [status, code] of [
  [401, "invalid_github_oidc_token"],
  [403, "source_repository_mismatch"],
  [403, "source_ref_not_allowed"],
  [403, "source_workflow_identity_mismatch"],
  [409, "source_binding_missing"],
  [409, "source_binding_revoked"],
  [413, "artifact_too_large"],
  [503, "artifact_upload_unavailable"]
] as const) {
  test(`intent refusal preserves ${status} ${code} and hides credentials`, async () => {
    await assert.rejects(requestUploadIntent(inputs, {
      getIdToken: async (audience) => { assert.equal(audience, "liskov-artifact-upload"); return "oidc-secret"; },
      fetchImpl: (async () => Response.json({
        error: code, reason: "refused oidc-secret upload-secret", token: "upload-secret"
      }, { status })) as typeof fetch
    }), (error: Error) => {
      assert.ok(error.message.includes(`(${status} ${code})`));
      assert.ok(error.message.includes("refused"));
      assert.ok(!error.message.includes("oidc-secret"));
      assert.ok(!error.message.includes("upload-secret"));
      return true;
    });
  });
}

test("invalid intent shape fails without disclosing the response token", async () => {
  for (const patch of [
    { upload: { ...intent.upload, method: "PUT" } },
    { upload: { ...intent.upload, field: "other" } },
    { upload: { ...intent.upload, url: "https://user:upload-secret@upload.example/pinning/pinFileToIPFS" } },
    { gatewayUrlTemplate: "http://upload.example/ipfs/{cid}" },
    { cidVersion: 1 }, { encryptionMode: "different" }, { maxBytes: 0 }, { expiresAtMs: 0 }
  ]) {
    await assert.rejects(requestUploadIntent(inputs, {
      getIdToken: async () => "oidc-secret",
      fetchImpl: (async () => Response.json({ ...intent, ...patch })) as typeof fetch
    }), (error: Error) => { assert.ok(!error.message.includes("upload-secret")); return true; });
  }
});

test("missing organization and insecure API URL fail before minting or sending credentials", async () => {
  for (const patch of [{ organizationId: "" }, { liskovUrl: "http://api.example" }]) {
    await assert.rejects(requestUploadIntent({ ...inputs, ...patch }, {
      getIdToken: async () => { assert.fail("must not mint"); },
      fetchImpl: (async () => { assert.fail("must not fetch"); }) as typeof fetch
    }));
  }
});

test("transport and non-JSON failures never echo credentials or arbitrary bodies", async () => {
  await assert.rejects(requestUploadIntent(inputs, {
    getIdToken: async () => "oidc-secret",
    fetchImpl: (async () => { throw new Error("failed Bearer oidc-secret"); }) as typeof fetch
  }), /^Error: Liskov upload intent request failed$/u);
  await assert.rejects(requestUploadIntent(inputs, {
    getIdToken: async () => "oidc-secret",
    fetchImpl: (async () => new Response("oidc-secret arbitrary upstream body", { status: 503 })) as typeof fetch
  }), /^Error: Liskov refused the upload intent \(503 unknown_error\): request refused$/u);
});
