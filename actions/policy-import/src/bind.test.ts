import assert from "node:assert/strict";
import test from "node:test";

import { bindPolicyImportManifest } from "./bind.js";

const env = {
  GITHUB_REPOSITORY: "proof-computer/uptime-prober",
  GITHUB_REF: "refs/heads/main",
  GITHUB_WORKFLOW_REF: "proof-computer/uptime-prober/.github/workflows/policy-sync.yml@refs/heads/main"
};

test("V4 policy import stays explicit and does not require source evidence", () => {
  const bound = bindPolicyImportManifest({
    manifest: {
      schema: "proof.liskov.application-manifest",
      schemaVersion: 4,
      applicationId: "example",
      release: {
        mode: "pinned",
        artifact: {
          kind: "ipfs_bundle",
          cid: "ipfs://QmExample",
          digest: `sha256:${"a".repeat(64)}`,
          encryption: { mode: "none" }
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
    },
    applicationId: "example",
    manifestPath: ".liskov/app.json",
    env: {}
  });
  assert.equal(bound.sourceEvidence, undefined);
  assert.equal(bound.document.schemaVersion, 4);
});

test("V5 source import binds GitHub evidence and refuses a stale repository", () => {
  const manifest = {
    schema: "proof.liskov.application-manifest",
    schemaVersion: 5,
    applicationId: "example",
    release: { mode: "source" },
    runtime: { kind: "javascript", entrypoint: { file: "bundle.js" } },
    execution: { mode: "once" },
    deployment: {
      schedule: { duration: "10m" },
      spend: { unit: "service_credit_micros", perJob: "1" }
    },
    state: { mode: "off" }
  };
  const bound = bindPolicyImportManifest({
    manifest,
    applicationId: "example",
    manifestPath: ".liskov/app.json",
    env
  });
  assert.equal(bound.sourceEvidence?.repository, "proof-computer/uptime-prober");
  assert.equal(bound.sourceEvidence?.ref, "refs/heads/main");
  assert.throws(
    () => bindPolicyImportManifest({
      manifest,
      applicationId: "example",
      manifestPath: ".liskov/app.json",
      env,
      expected: { repository: "proof-computer/other" }
    }),
    /mismatched repository/u
  );
});
