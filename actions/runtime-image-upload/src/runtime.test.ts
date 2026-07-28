import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  RUNTIME_IMAGE_UPLOAD_SESSION_DOMAIN,
  inspectRuntimeImage,
  uploadRuntimeImage,
  type RuntimeImageS3Upload,
  type RuntimeImageUploadDependencies,
  type RuntimeImageUploadInputs
} from "./runtime.js";

const AUTHORED = "a".repeat(64);
const RELEASE_INTENT = "b".repeat(64);

describe("runtime-image upload action", () => {
  it("hashes, binds, uploads, remints OIDC, finalizes, and projects safe outputs", async () => {
    const image = Buffer.from("manifest-bound-runtime-image");
    const imagePath = await temporaryImage(image);
    const imageHex = createHash("sha256").update(image).digest("hex");
    const oidcAudiences: string[] = [];
    const requests: Array<{ url: string; token: string; body: unknown }> = [];
    const uploads: RuntimeImageS3Upload[] = [];
    const masked: string[] = [];
    const dependencies = fakeDependencies({
      imagePath,
      oidcAudiences,
      requests,
      uploads,
      masked,
      postJson: async (url, token, body) => {
        requests.push({ url, token, body });
        return requests.length === 1
          ? sessionResponse()
          : finalizeResponse(`sha256:${imageHex}`, image.byteLength);
      }
    });

    const outputs = await uploadRuntimeImage({
      ...inputs(imagePath),
      expectedSha256: `SHA256:${imageHex.toUpperCase()}`,
      sourceImageUrl: "https://images.example/rootfs.tar.zst"
    }, dependencies);

    assert.deepEqual(oidcAudiences, [
      "liskov-runtime-image-upload",
      "liskov-runtime-image-upload"
    ]);
    assert.equal(requests.length, 2);
    assert.equal(
      requests[0]?.url,
      "https://liskov.test/base/api/applications/app/runtime-images/upload-session"
    );
    assert.equal(requests[0]?.token, "oidc-upload-token");
    assert.deepEqual(requests[0]?.body, {
      domain: RUNTIME_IMAGE_UPLOAD_SESSION_DOMAIN,
      authoredDigest: AUTHORED,
      releaseIntentDigest: RELEASE_INTENT
    });
    assert.equal(uploads.length, 1);
    assert.deepEqual(uploads[0], {
      endpointUrl: "https://s3.example",
      region: "auto",
      bucket: "runtime-images",
      objectKey: "images/app/session.tar.zst",
      accessKeyId: "tigris-access-key",
      secretAccessKey: "tigris-secret-key",
      imagePath,
      byteSize: image.byteLength,
      digest: `sha256:${imageHex}`
    });
    assert.equal(
      requests[1]?.url,
      "https://liskov.test/base/api/applications/app/runtime-images/upload-sessions/session-1/finalize"
    );
    assert.equal(requests[1]?.token, "oidc-finalize-token");
    assert.deepEqual(requests[1]?.body, {
      objectKey: "images/app/session.tar.zst",
      digest: `sha256:${imageHex}`,
      byteSize: image.byteLength,
      provenance: {
        repository: "proof-computer/app",
        ref: "refs/heads/main",
        sha: "0123456789abcdef",
        workflowRef: "proof-computer/app/.github/workflows/caller.yml@refs/heads/main",
        workflow: "Runtime image",
        runId: "123",
        runAttempt: "2",
        actor: "builder",
        eventName: "workflow_dispatch",
        sourceImageUrl: "https://images.example/rootfs.tar.zst"
      }
    });
    assert.deepEqual(masked, [
      "oidc-upload-token",
      "tigris-access-key",
      "tigris-secret-key",
      "oidc-finalize-token"
    ]);
    assert.deepEqual(outputs, {
      "image-digest": `sha256:${imageHex}`,
      "image-byte-size": String(image.byteLength),
      "upload-session-id": "session-1",
      "image-url": "https://liskov.test/runtime-images/session-1/image",
      "bootstrap-cid": "ipfs://bafybootstrap",
      "bootstrap-digest": `sha256:${"c".repeat(64)}`,
      "bootstrap-manifest-digest": `sha256:${"d".repeat(64)}`,
      "artifact-version-id": `av-${"e".repeat(64)}`,
      "artifact-mode": "runtime-image",
      "auto-published": "false",
      "cleanup-status": "succeeded",
      "provenance-json": JSON.stringify({
        repository: "proof-computer/app",
        ref: "refs/heads/main",
        sha: "0123456789abcdef",
        workflowRef: "proof-computer/app/.github/workflows/caller.yml@refs/heads/main"
      })
    });
    assert.doesNotMatch(
      JSON.stringify(outputs),
      /oidc-upload-token|oidc-finalize-token|tigris-access-key|tigris-secret-key/u
    );
  });

  it("makes no S3 call before the session echoes both manifest bindings", async () => {
    const imagePath = await temporaryImage(Buffer.from("runtime-image"));
    let s3Calls = 0;
    const dependencies = fakeDependencies({
      imagePath,
      postJson: async () => ({
        ...sessionResponse(),
        uploadSession: {
          ...sessionResponse().uploadSession as Record<string, unknown>,
          authoredDigest: "c".repeat(64)
        }
      }),
      putObject: async () => {
        s3Calls += 1;
      }
    });

    await assert.rejects(
      uploadRuntimeImage(inputs(imagePath), dependencies),
      /uploadSession\.authoredDigest did not echo the requested binding/u
    );
    assert.equal(s3Calls, 0);
  });

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
        ...inputs(imagePath),
        expectedSha256: "f".repeat(64)
      }, dependencies),
      /runtime image SHA-256 mismatch/u
    );
    assert.equal(oidcCalls, 0);
    assert.equal(s3Calls, 0);
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
      uploadRuntimeImage(inputs(imagePath), dependencies),
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

function inputs(imagePath: string): RuntimeImageUploadInputs {
  return {
    applicationId: "app",
    imagePath,
    authoredDigest: AUTHORED,
    releaseIntentDigest: RELEASE_INTENT,
    liskovUrl: "https://liskov.test/base/",
    audience: "liskov-runtime-image-upload"
  };
}

function sessionResponse(): Record<string, unknown> {
  return {
    uploadSession: {
      sessionId: "session-1",
      status: "ready",
      applicationId: "app",
      authoredDigest: AUTHORED,
      releaseIntentDigest: RELEASE_INTENT
    },
    upload: {
      endpointUrl: "https://s3.example",
      region: "auto",
      bucket: "runtime-images",
      objectKey: "images/app/session.tar.zst"
    },
    credentials: {
      accessKeyId: "tigris-access-key",
      secretAccessKey: "tigris-secret-key"
    }
  };
}

function finalizeResponse(digest: string, byteSize: number): Record<string, unknown> {
  return {
    uploadSession: {
      sessionId: "session-1",
      applicationId: "app",
      authoredDigest: AUTHORED,
      releaseIntentDigest: RELEASE_INTENT,
      digest,
      byteSize,
      imageUrl: "https://liskov.test/runtime-images/session-1/image",
      provenance: {
        repository: "proof-computer/app",
        ref: "refs/heads/main",
        sha: "0123456789abcdef",
        workflowRef: "proof-computer/app/.github/workflows/caller.yml@refs/heads/main"
      }
    },
    cleanup: { status: "succeeded" },
    bootstrap: {
      scriptCid: "ipfs://bafybootstrap",
      bundleDigest: `sha256:${"c".repeat(64)}`,
      manifestDigest: `sha256:${"d".repeat(64)}`
    },
    artifactVersionId: `av-${"e".repeat(64)}`,
    artifact: { mode: "runtime-image" },
    autoPublished: false
  };
}

async function temporaryImage(contents: Buffer): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "liskov-runtime-image-action-"));
  const imagePath = path.join(directory, "image.tar.zst");
  await writeFile(imagePath, contents);
  return imagePath;
}
