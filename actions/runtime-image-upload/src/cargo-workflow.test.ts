import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { parse } from "yaml";

describe("Cargo runtime-image reusable workflow", () => {
  it("opts into source assurance and preserves the disabled job graph", async () => {
    const path = new URL("../../../.github/workflows/cargo-runtime-image.yml", import.meta.url);
    const workflow = parse(await readFile(path, "utf8")) as Record<string, unknown>;
    const call = object(object(workflow.on, "on").workflow_call, "workflow_call");
    const input = object(object(call.inputs, "inputs")["source-assurance"], "source-assurance");
    assert.equal(input.type, "boolean");
    assert.equal(input.required, false);
    assert.equal(input.default, false);
    const jobs = object(workflow.jobs, "jobs");
    const job = object(jobs["build-upload"], "build-upload");
    const steps = job.steps as Array<Record<string, unknown>>;
    const assurance = steps.find((step) => step.id === "source-assurance");
    assert.ok(assurance);
    assert.equal(assurance.if, "${{ inputs.source-assurance }}");
    assert.equal(assurance.uses, "proof-computer/liskov-github-actions/actions/source-assurance@v2");
    assert.deepEqual(assurance.with, { "working-directory": "${{ inputs.working-directory }}" });
    assert.ok(steps.indexOf(assurance) < steps.findIndex((step) => step.id === "manifest"));
    const jobOutputs = object(job.outputs, "job outputs");
    for (const output of ["source-digest", "sbom-path"]) {
      assert.equal(jobOutputs[output], `\${{ steps.source-assurance.outputs.${output} }}`);
      assert.equal(object(object(call.outputs, "workflow outputs")[output], output).value,
        `\${{ jobs.build-upload.outputs.${output} }}`);
      delete jobOutputs[output];
    }
    job.steps = steps.filter((step) => step !== assurance);
    // Full jobs snapshot at 6e5f75a: runners, permissions, build/compose/upload
    // steps and all their inputs retain the existing graph when assurance is off.
    assert.equal(createHash("sha256").update(JSON.stringify(jobs)).digest("hex"),
      "a609b519eee3b719d0335ebd4baa5163467e69669f0e1dc7c618aad5bfbc5744");
  });

  it("pins inputs, proves two builds, optionally attests, then finalizes", async () => {
    const path = new URL("../../../.github/workflows/cargo-runtime-image.yml", import.meta.url);
    const workflow = parse(await readFile(path, "utf8")) as Record<string, unknown>;
    const trigger = object(workflow.on, "on");
    const workflowCall = object(trigger.workflow_call, "workflow_call");
    const inputs = object(workflowCall.inputs, "inputs");
    const attestInput = object(inputs["attest-runtime-image"], "attest-runtime-image");
    assert.equal(attestInput.type, "boolean");
    assert.equal(attestInput.default, true);
    const jobs = object(workflow.jobs, "jobs");
    const job = object(jobs["build-upload"], "build-upload");
    assert.equal(job["runs-on"], "ubuntu-24.04-arm");
    const steps = job.steps as Array<Record<string, unknown>>;
    const names = steps.map((step) => step.name);
    const locked = names.indexOf("Validate locked Cargo inputs and pinned toolchain");
    const base = names.indexOf("Download and verify helperless base rootfs");
    const build = names.indexOf("Build the static AArch64 MUSL binary twice");
    const compare = names.indexOf("Require identical image digests");
    const attest = names.indexOf("Attest deterministic Cargo runtime image");
    const manifest = names.indexOf("Import exact authored manifest");
    const upload = names.indexOf("Upload and finalize manifest-bound runtime image");
    assert.ok(locked >= 0 && base > locked && build > base);
    assert.ok(compare > build && attest > compare && manifest > attest && upload > manifest);
    assert.match(String(steps[locked]?.run), /Cargo\.lock/u);
    assert.match(String(steps[locked]?.run), /pin an exact version or dated channel/u);
    assert.match(String(steps[base]?.run), /gh attestation verify/u);
    assert.match(String(steps[build]?.run), /--locked/u);
    assert.match(String(steps[build]?.run), /aarch64-unknown-linux-musl/u);
    assert.match(String(steps[compare]?.run), /cmp/u);
    assert.equal(
      steps[attest]?.uses,
      "actions/attest-build-provenance@977bb373ede98d70efdf65b84cb5f73e068dcc2a"
    );
    assert.equal(steps[attest]?.if, "${{ inputs.attest-runtime-image }}");
    assert.equal(
      steps[upload]?.uses,
      "proof-computer/liskov-github-actions/actions/runtime-image-upload@v2"
    );
  });
});

function object(value: unknown, field: string): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), field);
  return value as Record<string, unknown>;
}
