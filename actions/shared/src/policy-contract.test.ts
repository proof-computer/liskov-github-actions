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

// BKLG-20261123-i021: liskov-rs main at packet claim (ADR-0063).
const vendoredProducerCommit = "bf93a1f675f3adbf5ff1abefc62fb3b24bb33d7c";
test("vendored bundle retains the exact producer manifest and artifact hashes", () => {
  const digest = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const manifestBytes = readFileSync(path.join(directory, "policy-client-bundle.json"));
  assert.equal(
    digest(manifestBytes),
    "sha256:d081e6de316015b58e2be8eb9bddd63cbc3a345955be13eb85e87a33637d7e9a",
    `bundle manifest from liskov-rs ${vendoredProducerCommit}`
  );
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.equal(manifest.sourceDigest, "sha256:1da16ea6817fde65dfe19ff2f06510d2255b309890e113846d89c076924733f1");
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

test("V6 country allow/exclude and manager/country spread validate for source publication", () => {
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
    assert.equal(supportsRegisteredSourcePublication(result), true);
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

test("V6 refuses an authored deployment reservation block as an unknown field", () => {
  const sample = corpus.valid.find((entry) => entry.name === "v6/benchmark-js");
  assert.ok(sample, "owner benchmark-js V6 corpus document exists");
  for (const block of [
    { mode: "ahead_of_time", horizon: "6h" },
    { mode: "just_in_time" }
  ]) {
    const authored = parse(String(sample.request.document)) as { deployment: Record<string, unknown> };
    authored.deployment.booking = block;
    assert.equal("booking" in authored.deployment, true);
    const refused = evaluatePolicyManifest(authored);
    assert.equal(refused.valid, false, JSON.stringify(refused.errors));
    assert.equal(refused.errors[0]?.code, "unknown_field");
    assert.equal(refused.errors[0]?.pointer, "/deployment/booking");
    const without = structuredClone(authored);
    delete without.deployment.booking;
    assert.equal("booking" in without.deployment, false);
    const accepted = evaluatePolicyManifest(without);
    assert.equal(accepted.valid, true, JSON.stringify(accepted.errors));
    assert.equal(supportsRegisteredSourcePublication(accepted), true);
  }
});

test("the owner bundle registers exactly V5 and V6 for source publication", () => {
  const manifest = JSON.parse(readFileSync(path.join(directory, "policy-client-bundle.json"), "utf8"));
  assert.deepEqual(manifest.publicationPairs, [
    { schema: "proof.liskov.application-manifest", schemaVersion: 5, releaseMode: "source" },
    { schema: "proof.liskov.application-manifest", schemaVersion: 6, releaseMode: "source" }
  ]);
  const v6 = v6PlacementDocument({ allow: [{ by: "country", values: ["DE"] }] });
  const registered = evaluatePolicyManifest(v6);
  assert.equal(registered.valid, true, JSON.stringify(registered.errors));
  assert.equal(supportsRegisteredSourcePublication(registered), true);

  const unregistered = evaluatePolicyManifest({ ...v6, schemaVersion: 7 });
  assert.equal(unregistered.valid, true, JSON.stringify(unregistered.errors));
  assert.equal(supportsRegisteredSourcePublication(unregistered), false);
});
