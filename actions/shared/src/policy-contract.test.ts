import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
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
  refused: Array<{ name: string; request: Record<string, unknown> }>;
  unknown: { request: Record<string, unknown> };
};

// BKLG-20261107-rs1z: complete bundle from BKLG-20261115-2cpd's merged
// liskov-rs commit d0d7a4f896c78fbc28e4b5abd36d959fb49abb2a (ADR-0229).
test("vendored V6 booking bundle retains the exact producer manifest and artifact hashes", () => {
  const digest = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const manifestBytes = readFileSync(path.join(directory, "policy-client-bundle.json"));
  assert.equal(digest(manifestBytes), "sha256:ed6a1d8a615f510e2454b06baf2dca37556754437d84fdfaabe134a25bc43ef6");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.equal(manifest.sourceDigest, "sha256:3d5fdfa7eee58ecc7cb1849238ab2b3a9e62a8676543f329b5fc884d4a8c80c4");
  for (const key of ["artifact", "adapter", "types", "conformance"]) {
    const entry = manifest[key];
    assert.equal(digest(readFileSync(path.join(directory, entry.file))), entry.sha256, key);
  }
  assert.equal(digest(gunzipSync(readFileSync(path.join(directory, manifest.artifact.file)))), manifest.artifact.uncompressedSha256);
});

test("V7 materialization retains matching server Access evidence through the vendored wrapper", () => {
  const sample = corpus.valid.find((sample) => sample.name === "v7/materialize/cloudflare-provider-gated");
  assert.ok(sample, "producer matching-observation vector exists");
  assert.equal(sample.request.operation, "materialize");
  const validation = evaluatePolicyManifest(parse(String(sample.request.document)));
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(supportsRegisteredSourcePublication(validation), false);

  const result = contract.evaluate(sample.request);
  assert.equal(result.disposition, "supported");
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(sample.expected.effective, "producer pins the retained observation in the effective policy");
  assert.ok(sample.expected.policyDigest, "producer pins the materialized digest");
  for (const [field, expected] of Object.entries(sample.expected)) {
    assert.deepEqual(result[field], expected, field);
  }
});

for (const suffix of ["absent", "hostname", "path"]) {
  test(`V7 materialization refuses ${suffix} Access evidence at the producer diagnostic`, () => {
    const sample = corpus.invalid.find((sample) => sample.name === `v7/materialize/cloudflare-provider-gated/access-${suffix}`);
    assert.ok(sample, `producer ${suffix}-observation vector exists`);
    assert.equal(sample.request.operation, "materialize");
    // Authored validation succeeds for this same document; only materialization
    // can establish whether the server-resolved observation matches its use site.
    const validation = evaluatePolicyManifest(parse(String(sample.request.document)));
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
    assert.equal(supportsRegisteredSourcePublication(validation), false);
    const result = contract.evaluate(sample.request) as { valid: boolean; errors: Array<{ code: string; pointer: string }>; effective?: unknown; policyDigest?: string };
    assert.equal(result.valid, false);
    assert.equal(result.errors[0]?.code, sample.expectedCode);
    assert.equal(result.errors[0]?.pointer, sample.expectedPointer);
    assert.equal(result.effective, undefined);
    assert.equal(result.policyDigest, undefined);
  });
}

test("vendored bundle preserves the producer's additional refusals and opaque future version", () => {
  assert.ok(corpus.refused.length > 0);
  for (const sample of corpus.refused) {
    const result = contract.evaluate(sample.request);
    assert.equal(result.valid, false, sample.name);
    assert.equal(result.disposition, "invalid", sample.name);
  }
  const unknown = contract.evaluate(corpus.unknown.request);
  assert.equal(unknown.disposition, "unknown_opaque");
  assert.equal(unknown.valid, false);
});

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

test("V6 accepts managed continuous booking without source publication", () => {
  const sample = corpus.invalid.find((sample) => sample.name === "v6/invalid/booking-horizon-1d");
  assert.ok(sample, "owner continuous managed-custody booking fixture exists");
  for (const booking of [
    { mode: "ahead_of_time", horizon: "6h" },
    { mode: "just_in_time" }
  ]) {
    const document = parse(String(sample.request.document));
    document.deployment.booking = booking;
    const result = evaluatePolicyManifest(document);
    assert.equal(result.disposition, "supported");
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual((result.document?.deployment as Record<string, unknown>).booking, booking);
    assert.equal(supportsRegisteredSourcePublication(result), false);
  }
});

for (const name of ["booking-horizon-1d", "booking-self-custody"]) {
  test(`V6 refuses ${name} at the owner booking diagnostic`, () => {
    const sample = corpus.invalid.find((sample) => sample.name === `v6/invalid/${name}`);
    assert.ok(sample, `owner ${name} booking fixture exists`);
    const document = parse(String(sample.request.document));
    if (name === "booking-horizon-1d") document.deployment.booking.horizon = "24h";
    const result = evaluatePolicyManifest(document);
    assert.equal(result.valid, false);
    assert.equal(result.errors[0]?.code, sample.expectedCode);
    assert.equal(result.errors[0]?.pointer, sample.expectedPointer);
    assert.equal(supportsRegisteredSourcePublication(result), false);
  });
}

test("V5 remains the only registered source-publication pair, with V6 and V7 unpublished", () => {
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
