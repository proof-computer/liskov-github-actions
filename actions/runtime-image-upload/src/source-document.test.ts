import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requireValidPolicyManifest } from "../../shared/src/policy-contract.js";
import { loadRuntimeImageSourceDocument } from "./source-document.js";

const MANIFEST_PATH = ".liskov/lab-inference-shell.v5.json";

const SOURCE_DOCUMENT = {
  schema: "proof.liskov.application-manifest",
  schemaVersion: 5,
  applicationId: "lab-inference-shell",
  release: { mode: "source" },
  runtime: {
    kind: "native_image",
    image: { name: "debian", version: "12" },
    entrypoint: { executable: "/usr/local/bin/liskov-demo", args: ["lab"] }
  },
  execution: { mode: "continuous" },
  deployment: {
    schedule: { duration: "6h" },
    spend: {
      unit: "service_credit_micros",
      perJob: "1000000",
      rate: { amount: "30000000", window: "30d" }
    }
  },
  state: { mode: "off" }
};

const V4_DOCUMENT = {
  schema: "proof.liskov.application-manifest",
  schemaVersion: 4,
  applicationId: "lab-inference-shell",
  release: {
    mode: "build",
    artifact: { kind: "runtime_image" },
    builder: {
      kind: "github",
      repository: "proof-computer/lab-inference-shell",
      allowedRefs: ["refs/heads/main"],
      workflowRef:
        "proof-computer/lab-inference-shell/.github/workflows/image.yml@refs/heads/main",
      manifestPath: ".liskov/lab-inference-shell.json"
    }
  },
  deployment: {
    parallelism: 1,
    schedule: { durationMs: 1_800_000 },
    lifecycle: {
      renewal: { mode: "after_scheduled_end" },
      update: { timing: "immediate", existingJobs: { mode: "run_until_scheduled_end" } },
      recovery: { runtimeFailure: { mode: "wait_until_scheduled_end" } }
    }
  }
};

function reads(document: unknown): (path: string) => Promise<string> {
  return async () => (typeof document === "string" ? document : JSON.stringify(document, null, 2));
}

function load(document: unknown, applicationId = "lab-inference-shell") {
  return loadRuntimeImageSourceDocument(MANIFEST_PATH, applicationId, reads(document));
}

describe("runtime-image V5 source document", () => {
  it("loads a V5 native-image source document and yields its authored digest", async () => {
    const read: string[] = [];
    const loaded = await loadRuntimeImageSourceDocument(
      `  ${MANIFEST_PATH} `,
      "lab-inference-shell",
      async (file) => {
        read.push(file);
        return JSON.stringify(SOURCE_DOCUMENT, null, 2);
      }
    );

    assert.deepEqual(read, [MANIFEST_PATH]);
    assert.equal(loaded.manifestPath, MANIFEST_PATH);
    assert.deepEqual(loaded.document, SOURCE_DOCUMENT);
    assert.match(loaded.authoredDigest, /^[0-9a-f]{64}$/u);
    assert.equal(
      loaded.authoredDigest,
      requireValidPolicyManifest(SOURCE_DOCUMENT).authoredDigest
    );
    // The digest follows the authored document, not the path it was read from.
    const changed = await load({
      ...SOURCE_DOCUMENT,
      deployment: {
        ...SOURCE_DOCUMENT.deployment,
        spend: { ...SOURCE_DOCUMENT.deployment.spend, perJob: "2000000" }
      }
    });
    assert.notEqual(changed.authoredDigest, loaded.authoredDigest);
  });

  it("refuses a pinned release with its pointer", async () => {
    await assert.rejects(
      load({
        ...SOURCE_DOCUMENT,
        release: { mode: "pinned", artifact: { digest: `sha256:${"a".repeat(64)}` } }
      }),
      /V5 source document \.liskov\/lab-inference-shell\.v5\.json \/release\/mode: must be source/u
    );
  });

  it("refuses a javascript runtime with its pointer", async () => {
    await assert.rejects(
      load({
        ...SOURCE_DOCUMENT,
        runtime: { kind: "javascript", engine: "nodejs", entrypoint: { file: "bundle.cjs" } }
      }),
      /V5 source document \.liskov\/lab-inference-shell\.v5\.json \/runtime\/kind: must be native_image/u
    );
  });

  it("refuses a document for another application with its pointer", async () => {
    await assert.rejects(
      load(SOURCE_DOCUMENT, "other-app"),
      /V5 source document \.liskov\/lab-inference-shell\.v5\.json \/applicationId: must be other-app/u
    );
  });

  it("refuses a V4 document with its pointer", async () => {
    // The V4 manifest is valid for the bundled client; it is the pair that is
    // not a source publication.
    assert.equal(requireValidPolicyManifest(V4_DOCUMENT).pair?.schemaVersion, 4);
    await assert.rejects(
      load(V4_DOCUMENT),
      /V5 source document \.liskov\/lab-inference-shell\.v5\.json \/schemaVersion: proof\.liskov\.application-manifest version 4 is not registered for source publication/u
    );
  });

  it("names the policy client's pointer for an invalid document", async () => {
    await assert.rejects(
      load({ ...SOURCE_DOCUMENT, runtime: { kind: "native_image" } }),
      /V5 source document \.liskov\/lab-inference-shell\.v5\.json is invalid: \S+ \/runtime/u
    );
  });

  it("refuses unreadable, non-JSON and non-object documents", async () => {
    await assert.rejects(
      loadRuntimeImageSourceDocument(MANIFEST_PATH, "lab-inference-shell", async () => {
        throw new Error("ENOENT: no such file");
      }),
      /could not read V5 source document \.liskov\/lab-inference-shell\.v5\.json: ENOENT/u
    );
    await assert.rejects(load("schema: yaml"), /\/: is not JSON/u);
    await assert.rejects(load([SOURCE_DOCUMENT]), /\/: must be a JSON object/u);
  });

  it("refuses a path that leaves the repository before reading anything", async () => {
    for (const unsafe of ["", "/etc/passwd", "../other/app.json", ".liskov//app.json", "a\\b.json"]) {
      let read = 0;
      await assert.rejects(
        loadRuntimeImageSourceDocument(unsafe, "lab-inference-shell", async () => {
          read += 1;
          return "{}";
        }),
        /manifest-path must be a safe repository-relative path/u
      );
      assert.equal(read, 0);
    }
  });
});
