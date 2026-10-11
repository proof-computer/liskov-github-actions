import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";

import { evaluatePolicyManifest, supportsRegisteredSourcePublication } from "./policy-contract.js";

// @ts-expect-error vendored CommonJS adapter has a separately hashed declaration
import policyClientAdapter from "../policy-client-bundle/policy-client.cjs";

const directory = path.resolve("actions/shared/policy-client-bundle");
const contract = (policyClientAdapter as {
  loadPolicyContract(directory: string): { evaluate(request: Record<string, unknown>): Record<string, unknown> };
}).loadPolicyContract(directory);
const corpus = JSON.parse(readFileSync(path.join(directory, "policy-client-conformance.json"), "utf8")) as {
  valid: Array<{ name: string; request: Record<string, unknown>; expected: Record<string, unknown> }>;
  invalid: Array<{ name: string; request: Record<string, unknown>; expectedCode: string; expectedPointer: string }>;
};

test("vendored policy contract matches the complete shared corpus", () => {
  for (const sample of corpus.valid) {
    const result = contract.evaluate(sample.request);
    assert.equal(result.disposition, "supported", sample.name);
    assert.equal(result.valid, true, sample.name);
    for (const [field, expected] of Object.entries(sample.expected)) {
      assert.deepEqual(result[field], expected, `${sample.name} ${field}`);
    }
  }
  for (const sample of corpus.invalid) {
    const result = contract.evaluate(sample.request) as { valid: boolean; errors: Array<{ code: string; pointer: string }> };
    assert.equal(result.valid, false, sample.name);
    assert.equal(result.errors[0]?.code, sample.expectedCode, sample.name);
    // The owner represents the root pointer as an empty string in diagnostics.
    const pointer = result.errors[0]?.pointer;
    assert.equal(pointer === "" ? "/" : pointer, sample.expectedPointer, sample.name);
  }
});

function v6PlacementDocument(placement: Record<string, unknown>, jobs = 2): Record<string, unknown> {
  const sample = corpus.valid.find((sample) => sample.name === "v6/benchmark-js");
  assert.ok(sample, "owner benchmark-js V6 corpus document exists");
  const document = parse(String(sample.request.document));
  // The owner's golden_v6_corpus/spread.rs applies these fragments to this draft.
  document.deployment.jobs = jobs;
  document.deployment.placement = placement;
  return document;
}

test("V6 country allow/exclude and manager/country spread validate without source publication", () => {
  for (const placement of [
    { allow: [{ by: "country", values: ["DE", "CH"] }] },
    { exclude: [{ by: "country", values: ["US"] }] },
    {
      allow: [{ by: "country", values: ["DE", "CH"] }],
      exclude: [{ by: "country", values: ["US"] }],
      spread: [
        { by: "manager", strength: "required" },
        { by: "country", strength: "preferred", minimumDistinct: 2 }
      ]
    },
    {
      spread: [
        { by: "country", strength: "required" },
        { by: "manager", strength: "preferred", minimumDistinct: 2 }
      ]
    }
  ]) {
    const result = evaluatePolicyManifest(v6PlacementDocument(placement));
    assert.equal(result.disposition, "supported");
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual((result.document?.deployment as Record<string, unknown>).placement, placement);
    assert.equal(supportsRegisteredSourcePublication(result), false);
  }
});

test("V6 refuses deferred region/network dimensions at owner diagnostic pointers", () => {
  const filter = corpus.invalid.find((sample) => sample.name === "v6/invalid/filter-dimension-beyond-manager-is-deferred");
  const spread = corpus.invalid.find((sample) => sample.name === "v6/invalid/spread-dimension-is-deferred");
  assert.ok(filter);
  assert.ok(spread);
  for (const by of ["region", "network"]) {
    const cases: Array<{ placement: Record<string, unknown>; expected: (typeof corpus.invalid)[number] }> = [
      { placement: { allow: [{ by, values: ["DE"] }] }, expected: filter },
      { placement: { spread: [{ by, strength: "required" }] }, expected: spread }
    ];
    for (const { placement, expected } of cases) {
      const result = evaluatePolicyManifest(v6PlacementDocument(placement));
      assert.equal(result.valid, false);
      assert.equal(result.errors[0]?.code, expected.expectedCode);
      assert.equal(result.errors[0]?.pointer, expected.expectedPointer);
    }
  }
});

test("V5 remains the only registered source-publication pair, with V7 also unpublished", () => {
  const manifest = JSON.parse(readFileSync(path.join(directory, "policy-client-bundle.json"), "utf8"));
  assert.deepEqual(manifest.publicationPairs, [
    { schema: "proof.liskov.application-manifest", schemaVersion: 5, releaseMode: "source" }
  ]);
  const document = v6PlacementDocument({ allow: [{ by: "country", values: ["DE"] }] });
  document.schemaVersion = 7;
  const result = evaluatePolicyManifest(document);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(supportsRegisteredSourcePublication(result), false);
});
