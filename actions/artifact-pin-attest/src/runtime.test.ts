import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runArtifactPinAttest } from "./runtime.js";

const bundleSha256 = "a".repeat(64);

test("multi-target attestation binds each exact V4 manifest and carries allowlisted diagnostics", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "liskov-artifact-attest-"));
  try {
    await mkdir(path.join(root, ".liskov"));
    await writeJson(path.join(root, "build.json"), {
      scriptIpfs: "ipfs://QmExactDiagnosticArtifact",
      scriptHash: `sha256:${bundleSha256}`,
      generatedAt: "2026-08-01T20:00:00.000Z",
      diagnostics: {
        devtools: { enabled: true, injected: true, uploadMode: "direct" },
        artifact: {
          format: "raw-cjs",
          entrypoint: "bundle.cjs",
          restartPolicy: "no"
        },
        sourceBundleSha256: "B".repeat(64),
        failure: { mode: "acurast-really-exit" },
        scenarioArtifact: { profile: "missing-entrypoint", fixture: "missing-entrypoint" }
      }
    });
    await writeJson(path.join(root, ".liskov", "first.json"), authoredManifest("first"));
    await writeJson(path.join(root, ".liskov", "second.json"), authoredManifest("second"));
    await writeJson(path.join(root, "targets.json"), [
      { applicationId: "first", authoredManifestPath: ".liskov/first.json" },
      { applicationId: "second", authoredManifestPath: ".liskov/second.json" }
    ]);

    let tokenRequests = 0;
    const posts: Array<{ url: string; body: Record<string, unknown> }> = [];
    const result = await runArtifactPinAttest({
      buildManifestPath: path.join(root, "build.json"),
      targetsPath: "targets.json",
      audience: "slipway-artifact-pin",
      urlTemplate: "https://liskov.example/api/applications/{applicationId}/artifact-pins/github"
    }, {
      getIdToken: async (audience) => {
        tokenRequests += 1;
        assert.equal(audience, "slipway-artifact-pin");
        return oidcToken();
      },
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        assert.equal(init?.method, "POST");
        assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${oidcToken()}`);
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        posts.push({ url: String(input), body });
        return Response.json({ artifactVersionId: `version-${body.applicationId}` });
      }) as typeof fetch,
      environment: {
        GITHUB_WORKFLOW: "diagnostic release",
        GITHUB_RUN_ID: "123",
        GITHUB_RUN_ATTEMPT: "2",
        GITHUB_ACTOR: "proof-bot",
        GITHUB_EVENT_NAME: "push"
      },
      now: () => new Date("2026-08-01T20:01:00.000Z"),
      repositoryRoot: root
    });

    assert.equal(tokenRequests, 1);
    assert.deepEqual(posts.map(({ url }) => url), [
      "https://liskov.example/api/applications/first/artifact-pins/github",
      "https://liskov.example/api/applications/second/artifact-pins/github"
    ]);
    assert.deepEqual(posts.map(({ body }) => body.applicationId), ["first", "second"]);
    for (const { body } of posts) {
      assert.equal(body.scriptCid, "ipfs://QmExactDiagnosticArtifact");
      assert.equal(body.bundleDigest, `sha256:${bundleSha256}`);
      assert.match(String(body.authoredDigest), /^[0-9a-f]{64}$/u);
      assert.match(String(body.releaseIntentDigest), /^[0-9a-f]{64}$/u);
      assert.deepEqual(body.diagnostics, {
        devtools: { enabled: true, injected: true, uploadMode: "direct" },
        artifact: {
          format: "raw-cjs",
          entrypoint: "bundle.cjs",
          restartPolicy: "no"
        },
        sourceBundleSha256: "b".repeat(64),
        failure: { mode: "acurast-really-exit" },
        scenarioArtifact: { profile: "missing-entrypoint", fixture: "missing-entrypoint" }
      });
    }
    assert.notEqual(posts[0]?.body.authoredDigest, posts[1]?.body.authoredDigest);
    assert.deepEqual(result, {
      cid: "ipfs://QmExactDiagnosticArtifact",
      digest: `sha256:${bundleSha256}`,
      artifactVersionId: "version-first",
      artifactVersionIds: ["version-first", "version-second"],
      results: [
        { applicationId: "first", artifactVersionId: "version-first" },
        { applicationId: "second", artifactVersionId: "version-second" }
      ]
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("targets file rejects duplicate applications, extra keys, and manifest id drift", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "liskov-artifact-targets-"));
  try {
    await mkdir(path.join(root, ".liskov"));
    await writeJson(path.join(root, "build.json"), {
      scriptIpfs: "ipfs://QmExactDiagnosticArtifact",
      bundleSha256
    });
    await writeJson(path.join(root, ".liskov", "wrong.json"), authoredManifest("wrong"));

    const dependencies = {
      getIdToken: async () => oidcToken(),
      fetchImpl: (async () => Response.json({ artifactVersionId: "unexpected" })) as typeof fetch,
      environment: {},
      now: () => new Date("2026-08-01T20:01:00.000Z"),
      repositoryRoot: root
    };
    const inputs = {
      buildManifestPath: path.join(root, "build.json"),
      audience: "slipway-artifact-pin",
      urlTemplate: "https://liskov.example/{applicationId}"
    };

    await writeJson(path.join(root, "targets.json"), [
      { applicationId: "same", authoredManifestPath: ".liskov/wrong.json" },
      { applicationId: "same", authoredManifestPath: ".liskov/wrong.json" }
    ]);
    await assert.rejects(
      runArtifactPinAttest({ ...inputs, targetsPath: "targets.json" }, dependencies),
      /repeats applicationId same/u
    );

    await writeJson(path.join(root, "targets.json"), [{
      applicationId: "expected",
      authoredManifestPath: ".liskov/wrong.json",
      token: "must-not-pass"
    }]);
    await assert.rejects(
      runArtifactPinAttest({ ...inputs, targetsPath: "targets.json" }, dependencies),
      /targets\[0\]\.token is not allowed/u
    );

    await writeJson(path.join(root, "targets.json"), [{
      applicationId: "expected",
      authoredManifestPath: ".liskov/wrong.json"
    }]);
    await assert.rejects(
      runArtifactPinAttest({ ...inputs, targetsPath: "targets.json" }, dependencies),
      /applicationId must be expected/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("one attestation run keeps V4 bytes and emits the distinct V5 source domain", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "liskov-artifact-mixed-v4-v5-"));
  try {
    await mkdir(path.join(root, ".liskov"));
    await writeJson(path.join(root, "build.json"), {
      scriptIpfs: "ipfs://QmExactDiagnosticArtifact",
      scriptHash: bundleSha256,
      diagnostics: { failure: { mode: "exit" } }
    });
    await writeJson(path.join(root, ".liskov", "compat-v4.json"), authoredManifest("compat-v4"));
    await writeJson(path.join(root, ".liskov", "diagnostic-v5.json"), v5Manifest("diagnostic-v5"));
    await writeJson(path.join(root, "targets.json"), [
      { applicationId: "compat-v4", authoredManifestPath: ".liskov/compat-v4.json" },
      { applicationId: "diagnostic-v5", authoredManifestPath: ".liskov/diagnostic-v5.json" }
    ]);

    const posts: Array<Record<string, unknown>> = [];
    const result = await runArtifactPinAttest({
      buildManifestPath: path.join(root, "build.json"),
      targetsPath: "targets.json",
      audience: "slipway-artifact-pin",
      urlTemplate: "https://liskov.example/api/applications/{applicationId}/artifact-pins/github"
    }, {
      getIdToken: async () => oidcToken(),
      fetchImpl: (async (_input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        posts.push(body);
        return Response.json({ artifactVersionId: `version-${body.applicationId}` });
      }) as typeof fetch,
      environment: {},
      now: () => new Date("2026-08-27T12:00:00.000Z"),
      repositoryRoot: root
    });

    assert.equal(posts[0]?.domain, "proof.slipway.github-artifact-pin.v1");
    assert.match(String(posts[0]?.authoredDigest), /^[0-9a-f]{64}$/u);
    assert.match(String(posts[0]?.releaseIntentDigest), /^[0-9a-f]{64}$/u);
    assert.equal(posts[1]?.domain, "proof.liskov.github-source-artifact.v1");
    assert.deepEqual(posts[1], {
      domain: "proof.liskov.github-source-artifact.v1",
      applicationId: "diagnostic-v5",
      manifestPath: ".liskov/diagnostic-v5.json",
      scriptCid: "ipfs://QmExactDiagnosticArtifact",
      bundleDigest: `sha256:${bundleSha256}`
    });
    assert.equal("authoredDigest" in posts[1]!, false);
    assert.equal("releaseIntentDigest" in posts[1]!, false);
    assert.equal("diagnostics" in posts[1]!, false);
    assert.deepEqual(result.artifactVersionIds, ["version-compat-v4", "version-diagnostic-v5"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function authoredManifest(applicationId: string): Record<string, unknown> {
  return {
    schema: "proof.liskov.application-manifest",
    schemaVersion: 4,
    applicationId,
    metadata: { description: applicationId },
    release: {
      mode: "build",
      artifact: { kind: "ipfs_bundle", encryption: { mode: "none" } },
      builder: {
        kind: "github",
        repository: "proof-computer/liskov-diagnostic",
        allowedRefs: ["refs/heads/main"],
        workflowRef: "proof-computer/liskov-diagnostic/.github/workflows/release.yml@refs/heads/main",
        manifestPath: `.liskov/${applicationId}.json`
      }
    },
    runtime: { command: "node index.js" },
    deployment: {
      parallelism: 1,
      schedule: { durationMs: 1_800_000 },
      lifecycle: {
        renewal: { mode: "after_scheduled_end" },
        update: { timing: "immediate", existingJobs: { mode: "run_until_scheduled_end" } },
        recovery: { runtimeFailure: { mode: "wait_until_scheduled_end" } }
      }
    }
  };
}

function v5Manifest(applicationId: string): Record<string, unknown> {
  return {
    schema: "proof.liskov.application-manifest",
    schemaVersion: 5,
    applicationId,
    release: { mode: "source" },
    runtime: {
      kind: "javascript",
      engine: "nodejs",
      entrypoint: { file: "bundle.cjs" }
    },
    execution: { mode: "once" },
    deployment: {
      schedule: { duration: "10m" },
      spend: { unit: "service_credit_micros", perJob: "50000" }
    },
    state: { mode: "off" }
  };
}

function oidcToken(): string {
  const payload = {
    repository: "proof-computer/liskov-diagnostic",
    ref: "refs/heads/main",
    sha: "c".repeat(40),
    workflow_ref: "proof-computer/liskov-diagnostic/.github/workflows/release.yml@refs/heads/main"
  };
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
