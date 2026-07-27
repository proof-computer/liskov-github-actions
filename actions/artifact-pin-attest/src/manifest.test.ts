import assert from "node:assert/strict";
import test from "node:test";

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

  assert.match(first.authoredDigest, /^[0-9a-f]{64}$/u);
  assert.match(first.releaseIntentDigest, /^[0-9a-f]{64}$/u);
  assert.notEqual(first.authoredDigest, reordered.authoredDigest);
  assert.equal(first.releaseIntentDigest, reordered.releaseIntentDigest);
  assert.equal(first.encryptionMode, "none");
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
