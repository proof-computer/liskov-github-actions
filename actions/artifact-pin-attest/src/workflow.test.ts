import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parse } from "yaml";

const OUTPUTS = [
  "cid",
  "digest",
  "build-manifest-path",
  "artifact-version-id",
  "artifact-version-ids",
  "attestation-results",
  "target-count"
];

test("Acurast reusable workflow preserves defaults and wires prepared multi-target artifacts", async () => {
  const workflowPath = new URL(
    "../../../.github/workflows/acurast-app.yml",
    import.meta.url
  );
  const workflow = parse(await readFile(workflowPath, "utf8")) as Record<string, unknown>;
  const workflowCall = object(object(workflow.on, "on").workflow_call, "workflow_call");
  const inputs = object(workflowCall.inputs, "workflow_call.inputs");
  const job = object(object(workflow.jobs, "jobs")["build-pin-attest"], "build job");
  const steps = job.steps as Array<Record<string, unknown>>;

  for (const name of [
    "prepare-command",
    "artifact-path",
    "artifact-metadata-path",
    "artifact-targets-path",
    "script-ipfs",
    "ipfs-gateway-url",
    "upload-manifest-path"
  ]) {
    const input = object(inputs[name], `input ${name}`);
    assert.equal(input.required, false);
    assert.equal(input.default, "");
  }
  assert.equal(object(inputs.entrypoint, "entrypoint").default, "app.cjs");
  assert.equal(object(inputs["authored-manifest-path"], "authored path").required, false);
  assert.equal(object(inputs["pnpm-version"], "pnpm version").default, "");

  const pnpmFromCaller = stepNamed(steps, "Set up pnpm from caller packageManager");
  const pnpmExplicit = stepNamed(steps, "Set up explicit pnpm version");
  const prepare = stepNamed(steps, "Prepare caller artifact");
  const pin = stepNamed(steps, "IPFS pin (no-spend)");
  const upload = stepNamed(steps, "Upload build manifest");
  const attest = stepNamed(steps, "Attest artifact pin");
  assert.equal(pnpmFromCaller.if, "${{ inputs.pnpm-version == '' }}");
  assert.equal(pnpmFromCaller.uses, "pnpm/action-setup@v4");
  assert.equal(
    object(pnpmFromCaller.with, "caller pnpm.with").package_json_file,
    "${{ inputs.working-directory }}/package.json"
  );
  assert.equal(pnpmExplicit.if, "${{ inputs.pnpm-version != '' }}");
  assert.equal(pnpmExplicit.uses, "pnpm/action-setup@v4");
  assert.equal(object(pnpmExplicit.with, "explicit pnpm.with").version, "${{ inputs.pnpm-version }}");
  assert.equal(prepare.if, "${{ inputs.prepare-command != '' }}");
  assert.equal(prepare["working-directory"], "${{ inputs.working-directory }}");
  assert.match(String(prepare.run), /bash -euo pipefail -c/u);

  assert.equal(pin.uses, "proof-computer/liskov-github-actions/actions/ipfs-pin@v1");
  const pinWith = object(pin.with, "pin.with");
  assert.equal(pinWith["artifact-path"], "${{ inputs.artifact-path }}");
  assert.equal(pinWith["metadata-path"], "${{ inputs.artifact-metadata-path }}");
  assert.equal(pinWith["script-ipfs"], "${{ inputs.script-ipfs }}");
  assert.equal(pinWith["gateway-url"], "${{ inputs.ipfs-gateway-url }}");
  assert.equal(pinWith["manifest-name"], "${{ inputs.upload-manifest-path }}");

  assert.equal(upload.uses, "actions/upload-artifact@v4");
  assert.equal(object(upload.with, "upload.with").path, "${{ steps.pin.outputs.manifest-path }}");
  assert.equal(attest.uses, "proof-computer/liskov-github-actions/actions/artifact-pin-attest@v1");
  const attestWith = object(attest.with, "attest.with");
  assert.equal(attestWith["targets-path"], "${{ inputs.artifact-targets-path }}");
  assert.equal(
    attestWith["application-id"],
    "${{ inputs.artifact-targets-path == '' && inputs.app-id || '' }}"
  );

  const jobOutputs = object(job.outputs, "job.outputs");
  const workflowOutputs = object(workflowCall.outputs, "workflow_call.outputs");
  assert.deepEqual(Object.keys(jobOutputs), OUTPUTS);
  assert.deepEqual(Object.keys(workflowOutputs), OUTPUTS);
  for (const output of OUTPUTS) {
    assert.equal(
      object(workflowOutputs[output], `workflow output ${output}`).value,
      `\${{ jobs.build-pin-attest.outputs.${output} }}`
    );
  }
  assert.equal(jobOutputs.cid, "${{ steps.pin.outputs.cid }}");
  assert.equal(jobOutputs["artifact-version-ids"], "${{ steps.attest.outputs.artifact-version-ids }}");
  assert.equal(jobOutputs["attestation-results"], "${{ steps.attest.outputs.results-json }}");
});

function stepNamed(
  steps: Array<Record<string, unknown>>,
  name: string
): Record<string, unknown> {
  const step = steps.find((candidate) => candidate.name === name);
  assert.ok(step, `missing step ${name}`);
  return step;
}

function object(value: unknown, field: string): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), field);
  return value as Record<string, unknown>;
}
