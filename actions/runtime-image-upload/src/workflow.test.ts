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
  "provenance-json",
  "artifact-digest",
  "source-repository",
  "source-ref",
  "source-commit",
  "source-workflow-identity",
  "binding-revision",
  "revocation-epoch"
];

describe("runtime-image reusable workflow", () => {
  it("verifies optional source-bound provenance before the source-document upload", async () => {
    const { workflowCall, uploadJob, steps } = await loadWorkflow();
    const upload = steps.find((step) => step.id === "upload");
    const validationIndex = steps.findIndex(
      (step) => step.name === "Validate image provenance inputs"
    );
    const downloadIndex = steps.findIndex((step) => step.id === "download");
    const digestIndex = steps.findIndex(
      (step) => step.name === "Verify expected image digest"
    );
    const attestationIndex = steps.findIndex(
      (step) => step.name === "Verify source-bound artifact attestation"
    );
    const uploadIndex = steps.findIndex((step) => step.id === "upload");

    const inputs = object(workflowCall.inputs, "on.workflow_call.inputs");
    const manifestPath = object(inputs["manifest-path"], "input manifest-path");
    assert.equal(manifestPath.required, true);
    assert.equal(
      manifestPath.description,
      "Repo-relative V5 source document (`release.mode: source`, `runtime.kind: native_image`)."
    );
    const bootstrapMode = object(inputs["bootstrap-mode"], "input bootstrap-mode");
    assert.equal(bootstrapMode.required, false);
    assert.equal(bootstrapMode.default, "standard");
    for (const input of [
      "attestation-repository",
      "attestation-source-digest",
      "attestation-signer-workflow"
    ]) {
      const contract = object(inputs[input], `input ${input}`);
      assert.equal(contract.required, false);
      assert.equal(contract.default, "");
    }

    assert.ok(validationIndex >= 0);
    assert.ok(downloadIndex > validationIndex);
    assert.ok(digestIndex > downloadIndex);
    assert.ok(attestationIndex > digestIndex);
    assert.ok(uploadIndex > attestationIndex);
    // The V5 line imports nothing: no step is the V4 import, and the upload
    // is the last step of the job.
    assert.equal(steps.some((step) => step.id === "manifest"), false);
    assert.equal(steps.some((step) => step.name === "Import exact authored manifest"), false);
    assert.equal(steps.some((step) => String(step.uses ?? "").includes("policy-import")), false);
    assert.equal(uploadIndex, steps.length - 1);

    const validation = String(steps[validationIndex]?.run);
    assert.match(validation, /must be supplied together/u);
    assert.match(validation, /expected-sha256 is required/u);
    assert.match(validation, /supplied.*-ne 0.*-ne 3/su);

    const digest = steps[digestIndex];
    assert.equal(digest?.if, "${{ inputs.expected-sha256 != '' }}");
    assert.match(String(digest?.run), /sha256sum/u);

    const attestation = steps[attestationIndex];
    assert.equal(attestation?.if, "${{ inputs.attestation-repository != '' }}");
    const attestationRun = String(attestation?.run);
    assert.match(attestationRun, /gh attestation verify/u);
    assert.match(attestationRun, /--repo/u);
    assert.match(attestationRun, /--source-digest/u);
    assert.match(attestationRun, /--signer-workflow/u);

    assert.equal(
      upload?.uses,
      "proof-computer/liskov-github-actions/actions/runtime-image-upload@v2"
    );
    const uploadWith = object(upload?.with, "upload.with");
    assert.equal(uploadWith["manifest-path"], "${{ inputs.manifest-path }}");
    assert.equal("authored-digest" in uploadWith, false);
    assert.equal("release-intent-digest" in uploadWith, false);
    assert.equal(uploadWith["application-id"], "${{ inputs.application-id }}");
    assert.equal(uploadWith["expected-sha256"], "${{ inputs.expected-sha256 }}");
    assert.equal(uploadWith["source-image-url"], "${{ inputs.image-url }}");
    assert.equal(uploadWith["liskov-url"], "${{ inputs.liskov-url }}");
    assert.equal(uploadWith.audience, "${{ inputs.audience }}");
    assert.equal(uploadWith["bootstrap-mode"], "${{ inputs.bootstrap-mode }}");

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

  it("wires every output the upload action declares, and only those", async () => {
    const { uploadJob } = await loadWorkflow();
    const action = parse(await readFile(new URL("../action.yml", import.meta.url), "utf8")) as
      Record<string, unknown>;
    assert.deepEqual(Object.keys(object(action.outputs, "action outputs")), OUTPUTS);
    assert.deepEqual(Object.keys(object(uploadJob.outputs, "jobs.upload.outputs")), OUTPUTS);
    const actionInputs = object(action.inputs, "action inputs");
    for (const input of ["manifest-path", "authored-digest", "release-intent-digest"]) {
      const contract = object(actionInputs[input], `action input ${input}`);
      assert.equal(contract.required, false);
      assert.equal(contract.default, "");
    }
    for (const input of ["authored-digest", "release-intent-digest"]) {
      assert.match(
        String(object(actionInputs[input], input).description),
        /^V4 mode; removed when V4 import closes/u
      );
    }
  });

  it("preserves direct-URL mode when all provenance inputs are omitted", async () => {
    const { workflowCall } = await loadWorkflow();
    const inputs = object(workflowCall.inputs, "workflow_call.inputs");

    assert.equal(object(inputs["expected-sha256"], "expected-sha256").required, false);
    assert.equal(object(inputs["expected-sha256"], "expected-sha256").default, "");
    assert.equal(object(inputs["bootstrap-mode"], "bootstrap-mode").default, "standard");
    for (const input of [
      "attestation-repository",
      "attestation-source-digest",
      "attestation-signer-workflow"
    ]) {
      assert.equal(object(inputs[input], input).default, "");
    }
  });
});

async function loadWorkflow(): Promise<{
  workflowCall: Record<string, unknown>;
  uploadJob: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
}> {
  const workflowPath = new URL(
    "../../../.github/workflows/runtime-image.yml",
    import.meta.url
  );
  const workflow = parse(await readFile(workflowPath, "utf8")) as Record<string, unknown>;
  const workflowCall = object(object(workflow.on, "on").workflow_call, "workflow_call");
  const uploadJob = object(object(workflow.jobs, "jobs").upload, "jobs.upload");
  return {
    workflowCall,
    uploadJob,
    steps: uploadJob.steps as Array<Record<string, unknown>>
  };
}

function object(value: unknown, field: string): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), field);
  return value as Record<string, unknown>;
}
