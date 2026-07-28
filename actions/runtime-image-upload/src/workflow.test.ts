import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { parse } from "yaml";

const OUTPUTS = [
  "image-digest",
  "image-byte-size",
  "upload-session-id",
  "image-url",
  "bootstrap-cid",
  "bootstrap-digest",
  "bootstrap-manifest-digest",
  "artifact-version-id",
  "artifact-mode",
  "auto-published",
  "cleanup-status",
  "provenance-json"
];

describe("runtime-image reusable workflow", () => {
  it("wires manifest import digests into upload and mirrors every safe output", async () => {
    const workflowPath = new URL(
      "../../../.github/workflows/runtime-image.yml",
      import.meta.url
    );
    const workflow = parse(await readFile(workflowPath, "utf8")) as Record<string, unknown>;
    const on = object(workflow.on, "on");
    const workflowCall = object(on.workflow_call, "on.workflow_call");
    const jobs = object(workflow.jobs, "jobs");
    const uploadJob = object(jobs.upload, "jobs.upload");
    const steps = uploadJob.steps as Array<Record<string, unknown>>;
    const manifest = steps.find((step) => step.id === "manifest");
    const upload = steps.find((step) => step.id === "upload");

    assert.equal(
      manifest?.uses,
      "proof-computer/liskov-github-actions/actions/policy-import@main"
    );
    assert.equal(
      object(manifest?.with, "manifest.with")["liskov-url"],
      "${{ inputs.liskov-url }}"
    );
    assert.equal(
      upload?.uses,
      "proof-computer/liskov-github-actions/actions/runtime-image-upload@main"
    );
    const uploadWith = object(upload?.with, "upload.with");
    assert.equal(
      uploadWith["authored-digest"],
      "${{ steps.manifest.outputs.authored-digest }}"
    );
    assert.equal(
      uploadWith["release-intent-digest"],
      "${{ steps.manifest.outputs.release-intent-digest }}"
    );
    assert.equal(uploadWith["liskov-url"], "${{ inputs.liskov-url }}");
    assert.equal(uploadWith.audience, "${{ inputs.audience }}");

    const jobOutputs = object(uploadJob.outputs, "jobs.upload.outputs");
    const workflowOutputs = object(workflowCall.outputs, "on.workflow_call.outputs");
    assert.deepEqual(Object.keys(jobOutputs), OUTPUTS);
    assert.deepEqual(Object.keys(workflowOutputs), OUTPUTS);
    for (const output of OUTPUTS) {
      assert.equal(jobOutputs[output], `\${{ steps.upload.outputs.${output} }}`);
      assert.equal(
        object(workflowOutputs[output], `workflow output ${output}`).value,
        `\${{ jobs.upload.outputs.${output} }}`
      );
    }
  });
});

function object(value: unknown, field: string): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), field);
  return value as Record<string, unknown>;
}
