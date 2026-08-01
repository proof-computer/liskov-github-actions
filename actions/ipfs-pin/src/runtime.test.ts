import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runIpfsPin, sha256, type IpfsPinInputs } from "./runtime.js";

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
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      assert.equal(init?.method, "POST");
      assert.ok(init?.body instanceof FormData);
      const file = init.body.get("file");
      assert.ok(file instanceof Blob);
      uploaded = Buffer.from(await file.arrayBuffer());
      return new Response(JSON.stringify({ IpfsHash: "QmPreparedArtifactCid" }), {
        status: 200
      });
    }) as typeof fetch;

    const result = await runIpfsPin({
      ...baseInputs(root),
      artifactPath: "artifact.zip",
      metadataPath: "metadata.json",
      manifestName: "evidence/build.json"
    }, {
      fetchImpl,
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
      artifactPath: "artifact.zip",
      scriptIpfs: "ipfs://QmExistingArtifactCid",
      gatewayUrl: "https://gateway.example/ipfs/{cid}"
    }, {
      fetchImpl,
      now: () => new Date("2026-08-01T19:00:00.000Z"),
      sleep: async () => undefined,
      environment: {}
    });

    assert.equal(result.uploadPerformed, false);
    assert.equal(result.digest, `sha256:${sha256(preparedBytes)}`);
    assert.deepEqual(requests, [
      "https://gateway.example/ipfs/QmExistingArtifactCid"
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
