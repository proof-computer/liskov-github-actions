import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import AdmZip from "adm-zip";
import { decryptEncryptedCode } from "@proof-computer/liskov-runtime/encrypted-code";
import { runIpfsPin, sha256, type IpfsPinInputs } from "./runtime.js";
import { runArtifactPinAttest } from "../../artifact-pin-attest/src/runtime.js";
import { artifactPinBindings } from "../../artifact-pin-attest/src/manifest.js";

const vector = JSON.parse(await readFile(new URL("../fixtures/encrypted-code-v1.json", import.meta.url), "utf8"));
const publicLoader = Buffer.from("// Public runtime bootstrap, no application source or key.\n");
const authored = {
  schema: "proof.liskov.application-manifest", schemaVersion: 5, applicationId: "encrypted-canary",
  release: { mode: "source" }, runtime: { kind: "javascript", engine: "nodejs", entrypoint: { file: "app.cjs" } },
  execution: { mode: "once" }, deployment: { schedule: { duration: "10m" },
    spend: { unit: "service_credit_micros", perJob: "50000" } }, state: { mode: "off" },
  configuration: { secrets: [{ secretId: "application-code-key", required: true,
    destination: { kind: "environment", name: "LISKOV_CODE_KEY" } }] }
};

test("build, pin and attest encrypted bytes with the runtime's exact independent vector", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "encrypted-action-"));
  try {
    await mkdir(path.join(root, "dist"));
    await writeFile(path.join(root, "dist/app.cjs"), vector.plaintext);
    await writeFile(path.join(root, "liskov.json"), JSON.stringify(authored));
    let uploaded: Buffer | undefined;
    const pinned = await runIpfsPin(inputs(root), {
      fetchImpl: (async (_url, init) => {
        const file = (init!.body as FormData).get("file") as Blob;
        uploaded = Buffer.from(await file.arrayBuffer());
        return Response.json({ IpfsHash: "QmEncryptedBootstrap" });
      }) as typeof fetch,
      now: () => new Date("2026-09-04T00:00:00Z"), environment: {}, encryptedCodeLoader: publicLoader,
      randomBytes: () => Buffer.from(vector.descriptor.iv, "base64")
    });
    assert.ok(uploaded);
    const zip = new AdmZip(uploaded);
    assert.deepEqual(zip.getEntries().map((entry) => entry.entryName).sort(),
      ["app.cjs", "encrypted-code.bin", "encrypted-code.json", "manifest.json"]);
    assert.deepEqual(zip.readFile("app.cjs"), publicLoader);
    assert.deepEqual(JSON.parse(zip.readAsText("encrypted-code.json")), vector.descriptor);
    assert.deepEqual(pinned.manifest.encryptedCode, vector.descriptor);
    assert.equal(zip.readFile("encrypted-code.bin")!.toString("base64"), vector.ciphertext);
    assert.equal(decryptEncryptedCode(zip.readFile("encrypted-code.bin")!, vector.key, pinned.manifest.encryptedCode).toString(), vector.plaintext);
    assert.equal(pinned.digest, `sha256:${sha256(uploaded)}`);
    assert.notEqual(pinned.digest, vector.descriptor.ciphertextDigest);
    assert.ok(!uploaded.includes(Buffer.from(vector.key)));
    for (const entry of zip.getEntries()) assert.ok(!entry.getData().includes(Buffer.from(vector.plaintext)));
    let attested: Record<string, unknown> | undefined;
    await runArtifactPinAttest({ applicationId: "encrypted-canary", authoredManifestPath: "liskov.json",
      buildManifestPath: pinned.manifestPath, audience: "test", urlTemplate: "https://liskov.test/{applicationId}" }, {
      repositoryRoot: root, environment: {}, now: () => new Date("2026-09-04T00:00:00Z"),
      getIdToken: async () => `header.${Buffer.from(JSON.stringify({ repository: "proof-computer/test", ref: "refs/heads/main",
        sha: "a".repeat(40), workflow_ref: "proof-computer/test/.github/workflows/release.yml@refs/heads/main" })).toString("base64url")}.sig`,
      fetchImpl: (async (_url, init) => { attested = JSON.parse(String(init!.body));
        return Response.json({ artifactVersionId: "source-encrypted" }); }) as typeof fetch
    });
    assert.equal(attested!.domain, "proof.liskov.github-source-artifact.v1");
    assert.equal(attested!.bundleDigest, pinned.digest);
    assert.deepEqual(attested!.encryptedCode, vector.descriptor);
    assert.ok(!JSON.stringify(attested).includes(vector.key));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("rejects plaintext leak hazards and bad encryption settings before upload", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "encrypted-action-refuse-"));
  try {
    await mkdir(path.join(root, "dist"));
    await writeFile(path.join(root, "dist/app.cjs"), vector.plaintext);
    for (const change of [{ extraFiles: ["source.cjs"] }, { artifactPath: "plaintext.zip" },
      { metadataPath: "metadata.json" }, { scriptIpfs: "ipfs://QmOld" }, { encryptionKey: "invalid" },
      { encryptionSecretId: "" }, { encryptionMode: "none" }, { encryptionMode: "future" }, { entrypoint: "../app.cjs" }]) {
      let uploads = 0;
      await assert.rejects(runIpfsPin({ ...inputs(root), ...change }, {
        fetchImpl: (async () => { uploads++; throw new Error("must not upload"); }) as typeof fetch,
        now: () => new Date(0), environment: {}, encryptedCodeLoader: publicLoader
      }));
      assert.equal(uploads, 0);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("attestation requires the policy's exact required key destination and bootstrap entrypoint", () => {
  assert.deepEqual(artifactPinBindings(authored, "encrypted-canary", vector.descriptor, "app.cjs"), { kind: "registered-source" });
  for (const change of [
    { configuration: { secrets: [] } },
    { configuration: { secrets: [{ ...authored.configuration.secrets[0], required: false }] } },
    { configuration: { secrets: [{ ...authored.configuration.secrets[0], secretId: "wrong-key" }] } },
    { configuration: { secrets: [{ ...authored.configuration.secrets[0], destination: { kind: "environment", name: "WRONG" } }] } }
  ]) assert.throws(() => artifactPinBindings({ ...authored, ...change }, "encrypted-canary", vector.descriptor, "app.cjs"));
  assert.throws(() => artifactPinBindings(authored, "encrypted-canary", vector.descriptor, "other.cjs"));
});

function inputs(root: string): IpfsPinInputs {
  return { workingDirectory: root, appName: "encrypted-canary", entrypoint: "app.cjs", extraFiles: [], restartPolicy: "no",
    endpoint: "https://ipfs.test", apiKey: "", encryptionMode: "aes-256-gcm-payload-v1",
    encryptionSecretId: "application-code-key", encryptionKey: vector.key };
}
