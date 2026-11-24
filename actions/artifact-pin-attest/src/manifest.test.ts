import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";

import { artifactPinBindings } from "./manifest.js";

const manifest = {
  schema: "proof.liskov.application-manifest",
  schemaVersion: 4,
  applicationId: "example",
  metadata: { labels: ["ordered", "evidence"] },
  release: {
    mode: "build",
    artifact: { kind: "ipfs_bundle", encryption: { mode: "none" } },
    builder: {
      kind: "github",
      repository: "proof-computer/example",
      allowedRefs: ["refs/tags/v1", "refs/heads/main"],
      workflowRef: "proof-computer/example/.github/workflows/release.yml@refs/heads/main",
      manifestPath: ".liskov/example.manifest.json"
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

test("artifact evidence binds the exact manifest and normalized release intent", () => {
  const first = artifactPinBindings(manifest, "example");
  const reordered = artifactPinBindings({
    ...manifest,
    release: {
      ...manifest.release,
      builder: {
        ...manifest.release.builder,
        allowedRefs: [...manifest.release.builder.allowedRefs].reverse()
      }
    }
  }, "example");

  assert.equal(first.kind, "v4");
  assert.equal(reordered.kind, "v4");
  if (first.kind !== "v4" || reordered.kind !== "v4") {
    throw new Error("V4 manifests must keep V4 artifact bindings");
  }
  assert.match(first.authoredDigest, /^[0-9a-f]{64}$/u);
  assert.match(first.releaseIntentDigest, /^[0-9a-f]{64}$/u);
  assert.notEqual(first.authoredDigest, reordered.authoredDigest);
  assert.equal(first.releaseIntentDigest, reordered.releaseIntentDigest);
  assert.equal(first.encryptionMode, "none");
});

test("retained V5 source artifacts carry no synthesized V4 digests", () => {
  const bindings = artifactPinBindings({
    schema: "proof.liskov.application-manifest",
    schemaVersion: 5,
    applicationId: "diagnostic-v5",
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
  }, "diagnostic-v5");
  assert.deepEqual(bindings, { kind: "registered-source" });
  assert.throws(
    () => artifactPinBindings({
      schema: "proof.liskov.application-manifest",
      schemaVersion: 5,
      applicationId: "diagnostic-v5",
      release: { mode: "source" },
      runtime: { kind: "native_image", image: { name: "debian-trixie", version: "0.1" }, entrypoint: { executable: "/bin/sh" } },
      execution: { mode: "once" },
      deployment: {
        schedule: { duration: "10m" },
        spend: { unit: "service_credit_micros", perJob: "50000" }
      },
      state: { mode: "off" }
    }, "diagnostic-v5"),
    /runtime.kind javascript/u
  );
});

test("artifact evidence accepts the V6 source manifest and refuses the same manifest at V7", () => {
  const corpus = JSON.parse(readFileSync("actions/shared/policy-client-bundle/policy-client-conformance.json", "utf8")) as {
    valid: Array<{ name: string; request: { document: string } }>;
  };
  const sample = corpus.valid.find((sample) => sample.name === "v6/benchmark-js");
  assert.ok(sample, "owner benchmark-js V6 corpus document exists");
  const document = parse(sample.request.document);
  assert.deepEqual(artifactPinBindings(document, document.applicationId), { kind: "registered-source" });
  assert.throws(
    () => artifactPinBindings({ ...document, schemaVersion: 7 }, document.applicationId),
    { message: "the exact policy pair is not registered for source publication" }
  );
});

test("artifact evidence rejects pinned or wrong-kind release arms", () => {
  assert.throws(
    () => artifactPinBindings({
      ...manifest,
      release: {
        mode: "pinned",
        artifact: {
          kind: "ipfs_bundle",
          cid: "ipfs://QmExample",
          digest: `sha256:${"1".repeat(64)}`,
          encryption: { mode: "none" }
        }
      }
    }, "example"),
    /build release/u
  );
  assert.throws(
    () => artifactPinBindings({
      ...manifest,
      release: {
        ...manifest.release,
        artifact: { kind: "runtime_image" }
      }
    }, "example"),
    /kind ipfs_bundle/u
  );
});

test("artifact evidence rejects encrypted requirements for the unencrypted pin action", () => {
  assert.throws(
    () => artifactPinBindings({
      ...manifest,
      release: {
        ...manifest.release,
        artifact: {
          kind: "ipfs_bundle",
          encryption: { mode: "aes256_gcm" }
        }
      }
    }, "example"),
    /produces unencrypted bundles/u
  );
});
