import assert from "node:assert/strict";
import test from "node:test";

import {
  SOURCE_PUBLICATION_SCHEMA,
  bindRetainedSourcePublication,
  observedGithubSource
} from "./source-publication.js";

const v5Source = {
  schema: "proof.liskov.application-manifest",
  schemaVersion: 5,
  applicationId: "benchmark-js",
  release: { mode: "source" },
  runtime: { kind: "javascript", entrypoint: { file: "bundle.js" } },
  execution: { mode: "once" },
  deployment: {
    schedule: { duration: "10m" },
    spend: { unit: "service_credit_micros", perJob: "50000" }
  },
  state: { mode: "off" }
};

const context = {
  repository: "proof-computer/uptime-prober",
  ref: "refs/heads/main",
  workflowRef: "proof-computer/uptime-prober/.github/workflows/policy-sync.yml@refs/heads/main",
  manifestPath: ".liskov/application-manifest.json",
  artifactDigest: `sha256:${"a".repeat(64)}`
};

test("retained V5 source publication binds exact repository, ref, workflow, manifest, and artifact", () => {
  const evidence = bindRetainedSourcePublication({
    manifest: v5Source,
    applicationId: "benchmark-js",
    observed: context,
    expected: context
  });
  assert.equal(evidence.schema, SOURCE_PUBLICATION_SCHEMA);
  assert.equal(evidence.applicationId, "benchmark-js");
  assert.match(evidence.authoredDigest, /^[0-9a-f]{64}$/u);
  assert.equal(evidence.repository, context.repository);
  assert.equal(evidence.ref, context.ref);
  assert.equal(evidence.workflowRef, context.workflowRef);
  assert.equal(evidence.manifestPath, context.manifestPath);
  assert.equal(evidence.artifactDigest, context.artifactDigest);
});

test("retained V5 source publication refuses stale or mismatched evidence", () => {
  assert.throws(
    () => bindRetainedSourcePublication({
      manifest: v5Source,
      applicationId: "benchmark-js",
      observed: context,
      expected: { ...context, repository: "proof-computer/other" }
    }),
    /mismatched repository/u
  );
  assert.throws(
    () => bindRetainedSourcePublication({
      manifest: v5Source,
      applicationId: "benchmark-js",
      observed: context,
      expected: { ...context, ref: "refs/heads/stale" }
    }),
    /mismatched ref/u
  );
  assert.throws(
    () => bindRetainedSourcePublication({
      manifest: v5Source,
      applicationId: "benchmark-js",
      observed: context,
      expected: { ...context, workflowRef: "proof-computer/uptime-prober/.github/workflows/other.yml@refs/heads/main" }
    }),
    /mismatched workflow/u
  );
  assert.throws(
    () => bindRetainedSourcePublication({
      manifest: v5Source,
      applicationId: "benchmark-js",
      observed: context,
      expected: { ...context, manifestPath: ".liskov/other.json" }
    }),
    /mismatched manifest/u
  );
  assert.throws(
    () => bindRetainedSourcePublication({
      manifest: v5Source,
      applicationId: "benchmark-js",
      observed: { ...context, artifactDigest: `sha256:${"b".repeat(64)}` },
      expected: context
    }),
    /mismatched artifact/u
  );
});

test("retained V5 source publication refuses deferred arms and V4 documents", () => {
  assert.throws(
    () => bindRetainedSourcePublication({
      manifest: { ...v5Source, ingress: { http: { mode: "required", port: 8080 } } },
      applicationId: "benchmark-js",
      observed: context,
      expected: context
    }),
    /unknown_field \/ingress/u
  );
  assert.throws(
    () => bindRetainedSourcePublication({
      manifest: { ...v5Source, schemaVersion: 4, release: { mode: "build" } },
      applicationId: "benchmark-js",
      observed: context,
      expected: context
    }),
    /invalid_manifest/u
  );
});

test("observed GitHub source reads exact GITHUB_* claims and does not emit secrets", () => {
  const observed = observedGithubSource({
    GITHUB_REPOSITORY: "proof-computer/uptime-prober",
    GITHUB_REF: "refs/heads/main",
    GITHUB_WORKFLOW_REF: context.workflowRef,
    LISKOV_ARTIFACT_DIGEST: context.artifactDigest,
    GITHUB_TOKEN: "ghs_must_not_be_copied"
  }, ".liskov/application-manifest.json");
  assert.equal(observed.repository, "proof-computer/uptime-prober");
  assert.equal(observed.ref, "refs/heads/main");
  assert.equal(observed.workflowRef, context.workflowRef);
  assert.equal(JSON.stringify(observed).includes("ghs_must_not_be_copied"), false);
});
