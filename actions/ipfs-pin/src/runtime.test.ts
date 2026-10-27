import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runIpfsPin, sha256, type IpfsPinInputs } from "./runtime.js";
import { requireValidPolicyManifest } from "../../shared/src/policy-contract.js";

const preparedBytes = Buffer.from("caller-prepared-exact-artifact\n", "utf8");

test("prebuilt artifact uploads exact bytes and emits their exact digest plus sanitized metadata", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "liskov-ipfs-pin-"));
  try {
    await writeFile(path.join(root, "artifact.zip"), preparedBytes);
    await writeFile(path.join(root, "metadata.json"), JSON.stringify({
      artifact: {
        format: "acurast-zip",
        entrypoint: "bundle.cjs",
        restartPolicy: "no"
      },
      failure: { mode: "exit" },
      scenarioArtifact: {
        profile: "runnable-no-retry",
        fixture: "runnable"
      },
      sourceBundleSha256: "B".repeat(64)
    }));
    let uploaded: Buffer | undefined;
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(input), "https://ipfs.example/pinning/pinFileToIPFS");
      assert.equal(init?.method, "POST");
      assert.deepEqual(init.headers, { authorization: "Bearer proxy-key" });
      assert.ok(init?.body instanceof FormData);
      assert.deepEqual([...init.body.keys()], ["file", "pinataOptions", "pinataMetadata"]);
      assert.equal(init.body.get("pinataOptions"), JSON.stringify({ cidVersion: 0 }));
      assert.equal(init.body.get("pinataMetadata"), JSON.stringify({ name: "script.js" }));
      const file = init.body.get("file");
      assert.ok(file instanceof Blob);
      assert.equal(file.type, "application/zip");
      assert.equal((file as File).name, "script.js");
      uploaded = Buffer.from(await file.arrayBuffer());
      return new Response(JSON.stringify({ IpfsHash: "QmPreparedArtifactCid" }), {
        status: 200
      });
    }) as typeof fetch;

    const result = await runIpfsPin({
      ...baseInputs(root),
      apiKey: "proxy-key",
      artifactPath: "artifact.zip",
      metadataPath: "metadata.json",
      manifestName: "evidence/build.json"
    }, {
      fetchImpl,
      getIdToken: async () => { assert.fail("proxy must not mint OIDC"); },
      now: () => new Date("2026-08-01T19:00:00.000Z"),
      sleep: async () => undefined,
      environment: {
        GITHUB_REPOSITORY: "proof-computer/example",
        GITHUB_WORKFLOW: "release",
        GITHUB_RUN_ID: "123",
        GITHUB_RUN_ATTEMPT: "1"
      }
    });

    assert.deepEqual(uploaded, preparedBytes);
    assert.equal(result.digest, `sha256:${sha256(preparedBytes)}`);
    assert.equal(result.scriptIpfs, "ipfs://QmPreparedArtifactCid");
    assert.equal(result.uploadPerformed, true);
    assert.equal(result.uploadPath, "proxy");
    assert.equal(result.uploadId, "");
    assert.equal(result.manifestPath, path.join(root, "evidence/build.json"));
    assert.deepEqual(result.manifest.diagnostics, {
      artifact: {
        format: "acurast-zip",
        entrypoint: "bundle.cjs",
        restartPolicy: "no"
      },
      sourceBundleSha256: "b".repeat(64),
      failure: { mode: "exit" },
      scenarioArtifact: {
        profile: "runnable-no-retry",
        fixture: "runnable"
      }
    });
    assert.deepEqual(
      JSON.parse(await readFile(result.manifestPath, "utf8")),
      result.manifest
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("existing CID skips upload and exact gateway verification compares local bytes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "liskov-ipfs-reuse-"));
  try {
    await writeFile(path.join(root, "artifact.zip"), preparedBytes);
    const requests: string[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(init, undefined);
      requests.push(String(input));
      return new Response(preparedBytes, { status: 200 });
    }) as typeof fetch;
    const result = await runIpfsPin({
      ...baseInputs(root),
      endpoint: "",
      artifactPath: "artifact.zip",
      scriptIpfs: "ipfs://QmExistingArtifactCid",
      gatewayUrl: "https://gateway.example/ipfs/{cid}"
    }, {
      fetchImpl,
      getIdToken: async () => { assert.fail("reused must not mint OIDC"); },
      now: () => new Date("2026-08-01T19:00:00.000Z"),
      sleep: async () => undefined,
      environment: {}
    });

    assert.equal(result.uploadPerformed, false);
    assert.equal(result.uploadPath, "reused");
    assert.equal(result.uploadId, "");
    assert.equal(result.digest, `sha256:${sha256(preparedBytes)}`);
    assert.deepEqual(requests, [
      "https://gateway.example/ipfs/QmExistingArtifactCid"
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const uploadIntent = {
  ok: true, uploadId: "upl-default", token: "upload-key",
  upload: { url: "https://upload.example/pinning/pinFileToIPFS", method: "POST", field: "file" },
  gatewayUrlTemplate: "https://upload.example/ipfs/{cid}", maxBytes: 8388608,
  encryptionMode: "none", expiresAtMs: 1791797000000, cidVersion: 0
};

test("Liskov default uploads exact bytes, masks token, and verifies its gateway", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "liskov-upload-"));
  try {
    await writeFile(path.join(root, "artifact.zip"), preparedBytes);
    const calls: string[] = [];
    let masked = false;
    const result = await runIpfsPin({
      ...baseInputs(root), endpoint: "", organizationId: "org-test", artifactPath: "artifact.zip"
    }, {
      now: () => new Date("2026-10-12T09:00:00Z"), environment: {},
      getIdToken: async (audience) => { assert.equal(audience, "liskov-artifact-upload"); return "oidc-key"; },
      maskSecret: (token) => { assert.equal(token, "upload-key"); masked = true; },
      fetchImpl: (async (url, init) => {
        calls.push(String(url));
        if (calls.length === 1) {
          assert.equal(init?.method, "POST");
          assert.deepEqual(init.headers, { authorization: "Bearer oidc-key", "content-type": "application/json" });
          assert.deepEqual(JSON.parse(String(init.body)), {
            sha256: sha256(preparedBytes), byteSize: preparedBytes.length,
            manifestDigest: `sha256:${sha256(preparedBytes)}`, encryptionMode: "none"
          });
          return Response.json(uploadIntent);
        }
        if (calls.length === 2) {
          assert.equal(masked, true, "token must be masked before upload");
          assert.equal(init?.method, "POST");
          assert.deepEqual(init.headers, { authorization: "Bearer upload-key" });
          assert.ok(init.body instanceof FormData);
          const file = init.body.get("file");
          assert.ok(file instanceof Blob);
          assert.deepEqual(Buffer.from(await file.arrayBuffer()), preparedBytes);
          assert.deepEqual(init.body.getAll("file"), [file]);
          // The Liskov upload service refuses any non-file field (LIA4010).
          assert.deepEqual([...init.body.keys()], ["file"]);
          return Response.json({ IpfsHash: "QmDefaultCid" });
        }
        assert.equal(init, undefined);
        return new Response(preparedBytes);
      }) as typeof fetch
    });
    assert.deepEqual(calls, [
      "https://api.liskov.proof.computer/api/organizations/org-test/applications/diagnostic/artifact-upload-intents",
      uploadIntent.upload.url, "https://upload.example/ipfs/QmDefaultCid"
    ]);
    assert.equal(result.uploadId, "upl-default");
    assert.equal(result.uploadPath, "liskov");
    assert.equal(result.uploadPerformed, true);
    assert.equal(result.digest, `sha256:${sha256(preparedBytes)}`);
    assert.ok(!JSON.stringify(result).includes("upload-key"));
    assert.ok(!JSON.stringify(result).includes("oidc-key"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("authored digest matches attestation's owner contract and caller gateway wins", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "liskov-authored-upload-"));
  try {
    const manifest = {
      schema: "proof.liskov.application-manifest", schemaVersion: 5, applicationId: "diagnostic",
      release: { mode: "source" },
      runtime: { kind: "javascript", engine: "nodejs", entrypoint: { file: "bundle.cjs" } },
      execution: { mode: "once" },
      deployment: { schedule: { duration: "10m" }, spend: { unit: "service_credit_micros", perJob: "50000" } },
      state: { mode: "off" }
    };
    await mkdir(path.join(root, "app"));
    await writeFile(path.join(root, "app/artifact.zip"), preparedBytes);
    await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
    const requests: string[] = [];
    await runIpfsPin({
      ...baseInputs(path.join(root, "app")), endpoint: "", organizationId: "org-test",
      artifactPath: "artifact.zip", authoredManifestPath: "manifest.json",
      gatewayUrl: "https://caller.example/ipfs/{cid}", liskovUrl: "https://custom-api.example"
    }, {
      now: () => new Date(), environment: {}, repositoryRoot: root, getIdToken: async () => "oidc",
      fetchImpl: (async (url, init) => {
        requests.push(String(url));
        if (requests.length === 1) {
          assert.equal(JSON.parse(String(init?.body)).manifestDigest,
            `sha256:${requireValidPolicyManifest(manifest).authoredDigest}`);
          return Response.json(uploadIntent);
        }
        if (requests.length === 2) return Response.json({ IpfsHash: "QmAuthoredCid" });
        return new Response(preparedBytes);
      }) as typeof fetch
    });
    assert.equal(requests[0], "https://custom-api.example/api/organizations/org-test/applications/diagnostic/artifact-upload-intents");
    assert.equal(requests[2], "https://caller.example/ipfs/QmAuthoredCid");
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const [status, code] of [
  [403, "source_repository_mismatch"], [409, "source_binding_revoked"],
  [413, "artifact_too_large"], [503, "artifact_upload_unavailable"]
] as const) {
  test(`Liskov ${status} ${code} prevents upload and proxy fallback`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "liskov-refused-upload-"));
    try {
      await writeFile(path.join(root, "artifact.zip"), preparedBytes);
      let calls = 0;
      await assert.rejects(runIpfsPin({
        ...baseInputs(root), endpoint: "", organizationId: "org-test", artifactPath: "artifact.zip"
      }, {
        now: () => new Date(), environment: {}, getIdToken: async () => "oidc-key",
        fetchImpl: (async () => {
          calls += 1;
          return Response.json({ error: code, reason: "refused oidc-key" }, { status });
        }) as typeof fetch
      }), (error: Error) => {
        assert.ok(error.message.includes(`(${status} ${code})`));
        assert.ok(!error.message.includes("oidc-key"));
        return true;
      });
      assert.equal(calls, 1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

test("Liskov upload failure redacts even short upload tokens", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "liskov-failed-upload-"));
  try {
    await writeFile(path.join(root, "artifact.zip"), preparedBytes);
    let calls = 0;
    await assert.rejects(runIpfsPin({
      ...baseInputs(root), endpoint: "", organizationId: "org-test", artifactPath: "artifact.zip"
    }, {
      now: () => new Date(), environment: {}, getIdToken: async () => "oidc-key",
      fetchImpl: (async () => {
        calls += 1;
        return calls === 1 ? Response.json(uploadIntent)
          : new Response("refused upload-key", { status: 401 });
      }) as typeof fetch
    }), (error: Error) => {
      assert.ok(error.message.includes("IPFS upload failed (401)"));
      assert.ok(!error.message.includes("upload-key"));
      return true;
    });
    assert.equal(calls, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Liskov intent describes the encrypted artifact bytes that are uploaded and verified", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "liskov-encrypted-upload-"));
  try {
    const vector = JSON.parse(await readFile(new URL("../fixtures/encrypted-code-v1.json", import.meta.url), "utf8"));
    await mkdir(path.join(root, "dist"));
    await writeFile(path.join(root, "dist/bundle.cjs"), vector.plaintext);
    let body: Record<string, unknown> | undefined;
    let uploaded: Buffer | undefined;
    let calls = 0;
    const result = await runIpfsPin({
      ...baseInputs(root), endpoint: "", organizationId: "org-test",
      encryptionMode: "aes-256-gcm-payload-v1", encryptionKey: vector.key,
      encryptionSecretId: "code-key"
    }, {
      now: () => new Date(), environment: {}, getIdToken: async () => "oidc-key",
      encryptedCodeLoader: Buffer.from("// Public loader\n"),
      randomBytes: () => Buffer.from(vector.descriptor.iv, "base64"),
      fetchImpl: (async (_url, init) => {
        calls += 1;
        if (calls === 1) {
          body = JSON.parse(String(init?.body));
          return Response.json({ ...uploadIntent, encryptionMode: "aes-256-gcm-payload-v1" });
        }
        if (calls === 2) {
          const file = (init?.body as FormData).get("file") as Blob;
          uploaded = Buffer.from(await file.arrayBuffer());
          return Response.json({ IpfsHash: "QmEncryptedCid" });
        }
        assert.ok(uploaded);
        return new Response(uploaded);
      }) as typeof fetch
    });
    assert.ok(uploaded);
    assert.deepEqual(body, {
      sha256: sha256(uploaded), byteSize: uploaded.length,
      manifestDigest: `sha256:${sha256(uploaded)}`, encryptionMode: "aes-256-gcm-payload-v1"
    });
    assert.equal(result.digest, `sha256:${sha256(uploaded)}`);
    assert.equal(result.uploadPath, "liskov");
    assert.equal(calls, 3);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("gateway verification rejects bytes that differ from the prepared artifact", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "liskov-ipfs-mismatch-"));
  try {
    await writeFile(path.join(root, "artifact.zip"), preparedBytes);
    let attempts = 0;
    const delays: number[] = [];
    const fetchImpl = (async () => {
      attempts += 1;
      return new Response("different", { status: 200 });
    }) as typeof fetch;
    await assert.rejects(
      runIpfsPin({
        ...baseInputs(root),
        artifactPath: "artifact.zip",
        scriptIpfs: "ipfs://QmExistingArtifactCid",
        gatewayUrl: "https://gateway.example/ipfs/{cid}"
      }, {
        fetchImpl,
        now: () => new Date("2026-08-01T19:00:00.000Z"),
        sleep: async (milliseconds) => { delays.push(milliseconds); },
        environment: {}
      }),
      /failed after 4 attempts.*gateway bytes mismatch/u
    );
    assert.equal(attempts, 4);
    assert.deepEqual(delays, [10_000, 10_000, 10_000]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("gateway verification tolerates bounded CID propagation delay", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "liskov-ipfs-propagation-"));
  try {
    await writeFile(path.join(root, "artifact.zip"), preparedBytes);
    let attempts = 0;
    const delays: number[] = [];
    const fetchImpl = (async () => {
      attempts += 1;
      return attempts < 3
        ? new Response("not ready", { status: 404 })
        : new Response(preparedBytes, { status: 200 });
    }) as typeof fetch;

    await runIpfsPin({
      ...baseInputs(root),
      artifactPath: "artifact.zip",
      scriptIpfs: "ipfs://QmExistingArtifactCid",
      gatewayUrl: "https://gateway.example/ipfs/{cid}"
    }, {
      fetchImpl,
      now: () => new Date("2026-08-01T19:00:00.000Z"),
      sleep: async (milliseconds) => { delays.push(milliseconds); },
      environment: {}
    });

    assert.equal(attempts, 3);
    assert.deepEqual(delays, [10_000, 10_000]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function baseInputs(root: string): IpfsPinInputs {
  return {
    workingDirectory: root,
    appName: "diagnostic",
    entrypoint: "bundle.cjs",
    extraFiles: [],
    restartPolicy: "onFailure",
    endpoint: "https://ipfs.example",
    apiKey: ""
  };
}
