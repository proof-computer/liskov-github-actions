import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { requireValidPolicyManifest } from "../../shared/src/policy-contract.js";
import {
  RUNTIME_IMAGE_SOURCE_UPLOAD_SESSION_DOMAIN,
  inspectRuntimeImage,
  uploadRuntimeImage,
  type RuntimeImageS3Upload,
  type RuntimeImageUploadDependencies,
  type RuntimeImageUploadInputs
} from "./runtime.js";

const SOURCE_MANIFEST_PATH = ".liskov/app.v5.json";
const SOURCE_DOCUMENT = {
  schema: "proof.liskov.application-manifest",
  schemaVersion: 5,
  applicationId: "app",
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
// The digest the bundled policy client computes; the fake server echoes it the
// way the real one echoes its own computation over the posted document.
const SOURCE_AUTHORED = requireValidPolicyManifest(SOURCE_DOCUMENT).authoredDigest!;
const SOURCE_RELEASE_INTENT = "f".repeat(64);
describe("runtime-image upload action", () => {
  it("hashes locally and fails an expected-digest mismatch before OIDC or S3", async () => {
    const imagePath = await temporaryImage(Buffer.from("runtime-image"));
    let oidcCalls = 0;
    let s3Calls = 0;
    const dependencies = fakeDependencies({
      imagePath,
      getOidcToken: async () => {
        oidcCalls += 1;
        return "unused";
      },
      putObject: async () => {
        s3Calls += 1;
      }
    });

    await assert.rejects(
      uploadRuntimeImage({
        ...sourceInputs(imagePath),
        expectedSha256: "f".repeat(64)
      }, dependencies),
      /runtime image SHA-256 mismatch/u
    );
    assert.equal(oidcCalls, 0);
    assert.equal(s3Calls, 0);
  });

  it("sends the exact internal bridge-probe mode only when requested", async () => {
    const image = Buffer.from("runtime-image");
    const imagePath = await temporaryImage(image);
    const imageHex = createHash("sha256").update(image).digest("hex");
    const requests: Array<{ url: string; token: string; body: unknown }> = [];
    const dependencies = fakeDependencies({
      imagePath,
      requests,
      postJson: async (url, token, body) => {
        requests.push({ url, token, body });
        return requests.length === 1
          ? sessionResponse()
          : finalizeResponse(`sha256:${imageHex}`, image.byteLength);
      }
    });

    await uploadRuntimeImage({
      ...sourceInputs(imagePath),
      bootstrapMode: "bridge-probe"
    }, dependencies);

    assert.equal(
      (requests[1]?.body as Record<string, unknown>).bootstrapMode,
      "bridge-probe"
    );
  });

  it("rejects an unknown bootstrap mode before inspection, OIDC, or S3", async () => {
    const imagePath = await temporaryImage(Buffer.from("runtime-image"));
    let inspectCalls = 0;
    let oidcCalls = 0;
    let s3Calls = 0;
    const dependencies = fakeDependencies({
      imagePath,
      getOidcToken: async () => {
        oidcCalls += 1;
        return "unused";
      },
      putObject: async () => {
        s3Calls += 1;
      }
    });
    dependencies.inspectImage = async () => {
      inspectCalls += 1;
      return { digest: `sha256:${"a".repeat(64)}`, byteSize: 1 };
    };

    await assert.rejects(
      uploadRuntimeImage({
        ...sourceInputs(imagePath),
        bootstrapMode: "bridge_probe"
      }, dependencies),
      /bootstrap-mode must be exactly standard or bridge-probe/u
    );
    assert.equal(inspectCalls, 0);
    assert.equal(oidcCalls, 0);
    assert.equal(s3Calls, 0);
  });

  it("binds a V5 source document, uploads, and returns the publication evidence", async () => {
    const image = Buffer.from("source-bound-runtime-image");
    const imagePath = await temporaryImage(image);
    const imageHex = createHash("sha256").update(image).digest("hex");
    const requests: Array<{ url: string; token: string; body: unknown }> = [];
    const uploads: RuntimeImageS3Upload[] = [];
    const read: string[] = [];
    const dependencies = fakeDependencies({
      imagePath,
      requests,
      uploads,
      readFile: async (file) => {
        read.push(file);
        return JSON.stringify(SOURCE_DOCUMENT, null, 2);
      },
      postJson: async (url, token, body) => {
        requests.push({ url, token, body });
        return requests.length === 1
          ? sessionResponse()
          : finalizeResponse(`sha256:${imageHex}`, image.byteLength);
      }
    });

    const outputs = await uploadRuntimeImage(sourceInputs(imagePath), dependencies);

    assert.deepEqual(read, [SOURCE_MANIFEST_PATH]);
    assert.equal(requests.length, 2);
    assert.equal(
      requests[0]?.url,
      "https://liskov.test/base/api/applications/app/runtime-images/upload-session"
    );
    assert.equal(requests[0]?.token, "oidc-upload-token");
    assert.deepEqual(requests[0]?.body, {
      domain: "proof.liskov.runtime-image-source-upload-session.v1",
      manifestPath: SOURCE_MANIFEST_PATH,
      document: SOURCE_DOCUMENT
    });
    assert.equal(
      RUNTIME_IMAGE_SOURCE_UPLOAD_SESSION_DOMAIN,
      "proof.liskov.runtime-image-source-upload-session.v1"
    );
    assert.deepEqual(Object.keys(requests[0]?.body as object), [
      "domain",
      "manifestPath",
      "document"
    ]);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0]?.objectKey, "images/app/session.tar.zst");
    assert.equal(uploads[0]?.digest, `sha256:${imageHex}`);
    assert.equal(
      requests[1]?.url,
      "https://liskov.test/base/api/applications/app/runtime-images/upload-sessions/session-1/finalize"
    );
    assert.equal(requests[1]?.token, "oidc-finalize-token");
    assert.deepEqual(Object.keys(requests[1]?.body as object), [
      "objectKey",
      "digest",
      "byteSize",
      "bootstrapMode",
      "provenance"
    ]);
    assert.deepEqual(outputs, {
      "image-digest": `sha256:${imageHex}`,
      "image-byte-size": String(image.byteLength),
      "upload-session-id": "session-1",
      "image-url": "https://liskov.test/runtime-images/session-1/image",
      "bootstrap-cid": "bafybootstrap",
      "bootstrap-digest": `sha256:${"c".repeat(64)}`,
      "bootstrap-manifest-digest": `sha256:${"d".repeat(64)}`,
      "artifact-version-id": `source-${"c".repeat(64)}`,
      "artifact-mode": "runtime-image",
      "auto-published": "false",
      "cleanup-status": "succeeded",
      "provenance-json": JSON.stringify({
        repository: "proof-computer/app",
        ref: "refs/heads/main",
        sha: "0123456789abcdef0123456789abcdef01234567",
        workflowRef: "proof-computer/app/.github/workflows/caller.yml@refs/heads/main"
      }),
      "artifact-digest": `sha256:${"c".repeat(64)}`,
      "source-repository": "proof-computer/app",
      "source-ref": "refs/heads/main",
      "source-commit": "0123456789abcdef0123456789abcdef01234567",
      "source-workflow-identity":
        "proof-computer/app/.github/workflows/caller.yml@refs/heads/main",
      "binding-revision": "3",
      "revocation-epoch": "0"
    });
  });

  it("makes no S3 call before a V5 session echoes the authored digest and manifest path", async () => {
    const imagePath = await temporaryImage(Buffer.from("runtime-image"));
    const session = sessionResponse().uploadSession as Record<string, unknown>;
    for (const [uploadSession, expected] of [
      [
        { ...session, authoredDigest: "c".repeat(64) },
        /uploadSession\.authoredDigest did not echo the requested binding/u
      ],
      [
        {
          ...session,
          source: { ...session.source as object, manifestPath: ".liskov/other.v5.json" }
        },
        /uploadSession\.source\.manifestPath did not echo the requested binding/u
      ],
      [
        { ...session, source: undefined },
        /uploadSession\.source must be an object/u
      ],
      [
        { ...session, status: "pending" },
        /uploadSession\.status did not echo the requested binding/u
      ]
    ] as Array<[Record<string, unknown>, RegExp]>) {
      let s3Calls = 0;
      const dependencies = fakeDependencies({
        imagePath,
        readFile: async () => JSON.stringify(SOURCE_DOCUMENT),
        postJson: async () => ({ ...sessionResponse(), uploadSession }),
        putObject: async () => {
          s3Calls += 1;
        }
      });

      await assert.rejects(uploadRuntimeImage(sourceInputs(imagePath), dependencies), expected);
      assert.equal(s3Calls, 0);
    }
  });

  it("requires the finalize response of a V5 session to carry the source evidence", async () => {
    const image = Buffer.from("runtime-image");
    const imagePath = await temporaryImage(image);
    const imageHex = createHash("sha256").update(image).digest("hex");
    const finalize = finalizeResponse(`sha256:${imageHex}`, image.byteLength);
    for (const [response, expected] of [
      [{ ...finalize, source: undefined }, /finalize\.source must be an object/u],
      [
        { ...finalize, source: { ...finalize.source as object, manifestPath: "other.json" } },
        /finalize\.source\.manifestPath did not echo the requested binding/u
      ],
      [
        { ...finalize, source: { ...finalize.source as object, revocationEpoch: "0" } },
        /finalize\.source\.revocationEpoch must be a non-negative safe integer/u
      ],
      [
        { ...finalize, artifact: { mode: "runtime-image" } },
        /finalize\.artifact\.digest must be a non-empty/u
      ]
    ] as Array<[Record<string, unknown>, RegExp]>) {
      let posts = 0;
      const dependencies = fakeDependencies({
        imagePath,
        readFile: async () => JSON.stringify(SOURCE_DOCUMENT),
        postJson: async () => {
          posts += 1;
          return posts === 1 ? sessionResponse() : response;
        }
      });
      await assert.rejects(uploadRuntimeImage(sourceInputs(imagePath), dependencies), expected);
    }
  });

  it("refuses a source document the server would refuse before OIDC or S3", async () => {
    const imagePath = await temporaryImage(Buffer.from("runtime-image"));
    let oidcCalls = 0;
    let s3Calls = 0;
    const dependencies = fakeDependencies({
      imagePath,
      readFile: async () => JSON.stringify({ ...SOURCE_DOCUMENT, applicationId: "other-app" }),
      getOidcToken: async () => {
        oidcCalls += 1;
        return "unused";
      },
      putObject: async () => {
        s3Calls += 1;
      }
    });

    await assert.rejects(
      uploadRuntimeImage(sourceInputs(imagePath), dependencies),
      /\/applicationId: must be app/u
    );
    assert.equal(oidcCalls, 0);
    assert.equal(s3Calls, 0);
  });

  it("requires a manifest-path before reading, inspection, OIDC, or S3", async () => {
    const imagePath = await temporaryImage(Buffer.from("runtime-image"));
    let calls = 0;
    const count = async (): Promise<never> => {
      calls += 1;
      throw new Error("must not be called");
    };
    const dependencies = fakeDependencies({
      imagePath,
      readFile: count,
      getOidcToken: count,
      postJson: count,
      putObject: count
    });
    dependencies.inspectImage = count;

    await assert.rejects(
      uploadRuntimeImage({ ...sourceInputs(imagePath), manifestPath: "" }, dependencies),
      /^Error: manifest-path is required$/u
    );
    assert.equal(calls, 0);
  });

  it("redacts minted tokens and Tigris credentials from failures", async () => {
    const imagePath = await temporaryImage(Buffer.from("runtime-image"));
    const dependencies = fakeDependencies({
      imagePath,
      putObject: async () => {
        throw new Error(
          "upload failed with oidc-upload-token tigris-access-key tigris-secret-key"
        );
      }
    });

    await assert.rejects(
      uploadRuntimeImage(sourceInputs(imagePath), dependencies),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.doesNotMatch(
          message,
          /oidc-upload-token|tigris-access-key|tigris-secret-key/u
        );
        assert.match(message, /\[REDACTED\]/u);
        return true;
      }
    );
  });
});

interface FakeOptions {
  imagePath: string;
  oidcAudiences?: string[];
  requests?: Array<{ url: string; token: string; body: unknown }>;
  uploads?: RuntimeImageS3Upload[];
  masked?: string[];
  postJson?: RuntimeImageUploadDependencies["postJson"];
  putObject?: RuntimeImageUploadDependencies["putObject"];
  getOidcToken?: RuntimeImageUploadDependencies["getOidcToken"];
  readFile?: RuntimeImageUploadDependencies["readFile"];
}

function fakeDependencies(options: FakeOptions): RuntimeImageUploadDependencies {
  let tokenCount = 0;
  return {
    inspectImage: inspectRuntimeImage,
    getOidcToken: options.getOidcToken ?? (async (audience) => {
      options.oidcAudiences?.push(audience);
      tokenCount += 1;
      return tokenCount === 1 ? "oidc-upload-token" : "oidc-finalize-token";
    }),
    postJson: options.postJson ?? (async (url, token, body) => {
      options.requests?.push({ url, token, body });
      return sessionResponse();
    }),
    putObject: options.putObject ?? (async (upload) => {
      options.uploads?.push(upload);
    }),
    readFile: options.readFile ?? (async () => JSON.stringify(SOURCE_DOCUMENT, null, 2)),
    mask: (value) => options.masked?.push(value),
    environment: {
      GITHUB_REPOSITORY: "proof-computer/app",
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: "0123456789abcdef",
      GITHUB_WORKFLOW_REF:
        "proof-computer/app/.github/workflows/caller.yml@refs/heads/main",
      GITHUB_WORKFLOW: "Runtime image",
      GITHUB_RUN_ID: "123",
      GITHUB_RUN_ATTEMPT: "2",
      GITHUB_ACTOR: "builder",
      GITHUB_EVENT_NAME: "workflow_dispatch"
    }
  };
}

function sourceInputs(imagePath: string): RuntimeImageUploadInputs {
  return {
    applicationId: "app",
    imagePath,
    manifestPath: SOURCE_MANIFEST_PATH,
    liskovUrl: "https://liskov.test/base/",
    audience: "liskov-runtime-image-upload"
  };
}

// The k2hx (liskov-rs) upload-session response for a V5 source document.
function sessionResponse(): Record<string, unknown> {
  return {
    upload: {
      endpointUrl: "https://s3.example",
      region: "auto",
      bucket: "runtime-images",
      objectKey: "images/app/session.tar.zst"
    },
    credentials: {
      accessKeyId: "tigris-access-key",
      secretAccessKey: "tigris-secret-key"
    },
    uploadSession: {
      sessionId: "session-1",
      status: "ready",
      applicationId: "app",
      organizationId: "org-app",
      authoredDigest: SOURCE_AUTHORED,
      releaseIntentDigest: SOURCE_RELEASE_INTENT,
      source: {
        manifestPath: SOURCE_MANIFEST_PATH,
        applicationUid: "uid-app",
        bindingRevision: 3,
        revocationEpoch: 0,
        repository: "proof-computer/app",
        sourceRef: "refs/heads/main",
        sourceCommit: "0123456789abcdef0123456789abcdef01234567",
        workflowIdentity: "proof-computer/app/.github/workflows/caller.yml@refs/heads/main",
        command: "/usr/local/bin/liskov-demo lab"
      }
    }
  };
}

// The k2hx finalize response for a V5 session, in the server's key order:
// `draft: null`, `policy: null`, `autoPublished: false`, the six-key
// artifact, and the appended `source` evidence.
function finalizeResponse(digest: string, byteSize: number): Record<string, unknown> {
  const bootstrap = {
    scriptCid: "bafybootstrap",
    bundleDigest: `sha256:${"c".repeat(64)}`,
    manifestDigest: `sha256:${"d".repeat(64)}`,
    imageUrl: "https://liskov.test/runtime-images/session-1/image",
    entrypoint: "acurast.sh",
    command: "/usr/local/bin/liskov-demo lab",
    publishedAtMs: 3
  };
  return {
    ok: true,
    applicationId: "app",
    uploadSession: {
      ...sessionResponse().uploadSession as Record<string, unknown>,
      status: "finalized",
      provenance: {
        repository: "proof-computer/app",
        ref: "refs/heads/main",
        sha: "0123456789abcdef0123456789abcdef01234567",
        workflowRef: "proof-computer/app/.github/workflows/caller.yml@refs/heads/main"
      },
      digest,
      byteSize,
      imageUrl: "https://liskov.test/runtime-images/session-1/image",
      bootstrap
    },
    cleanup: { status: "succeeded", attemptedAtMs: 2, reason: "finalize" },
    bootstrap,
    artifactVersionId: `source-${"c".repeat(64)}`,
    artifact: {
      mode: "runtime-image",
      status: "ready",
      kind: "runtime_image",
      cid: "bafybootstrap",
      digest: `sha256:${"c".repeat(64)}`,
      imageDigest: digest
    },
    draft: null,
    policy: null,
    autoPublished: false,
    source: {
      repository: "proof-computer/app",
      ref: "refs/heads/main",
      commit: "0123456789abcdef0123456789abcdef01234567",
      workflowIdentity: "proof-computer/app/.github/workflows/caller.yml@refs/heads/main",
      manifestPath: SOURCE_MANIFEST_PATH,
      bindingRevision: 3,
      revocationEpoch: 0
    }
  };
}

async function temporaryImage(contents: Buffer): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "liskov-runtime-image-action-"));
  const imagePath = path.join(directory, "image.tar.zst");
  await writeFile(imagePath, contents);
  return imagePath;
}
