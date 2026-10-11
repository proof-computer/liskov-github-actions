import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

import {
  loadRuntimeImageSourceDocument,
  type RuntimeImageSourceDocument
} from "./source-document.js";

export const RUNTIME_IMAGE_UPLOAD_SESSION_DOMAIN =
  "proof.liskov.runtime-image-upload-session.v1";
export const RUNTIME_IMAGE_SOURCE_UPLOAD_SESSION_DOMAIN =
  "proof.liskov.runtime-image-source-upload-session.v1";

// Exactly one binding mode is supplied. V5 mode: `manifestPath`, the V5 source
// document in the checkout. V4 mode: both digests of an imported V4 manifest;
// it is removed when V4 import closes.
export interface RuntimeImageUploadInputs {
  applicationId: string;
  imagePath: string;
  manifestPath?: string;
  authoredDigest?: string;
  releaseIntentDigest?: string;
  bootstrapMode?: string;
  expectedSha256?: string;
  sourceImageUrl?: string;
  liskovUrl: string;
  audience: string;
}

export interface RuntimeImageInfo {
  digest: string;
  byteSize: number;
}

export interface RuntimeImageS3Upload {
  endpointUrl: string;
  region: string;
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  secretAccessKey: string;
  imagePath: string;
  byteSize: number;
  digest: string;
}

export interface RuntimeImageUploadDependencies {
  inspectImage(imagePath: string): Promise<RuntimeImageInfo>;
  getOidcToken(audience: string): Promise<string>;
  postJson(url: string, token: string, body: unknown): Promise<unknown>;
  putObject(upload: RuntimeImageS3Upload): Promise<void>;
  readFile(path: string): Promise<string>;
  mask(value: string): void;
  environment: NodeJS.ProcessEnv;
}

export interface RuntimeImageUploadOutputs {
  "image-digest": string;
  "image-byte-size": string;
  "upload-session-id": string;
  "image-url": string;
  "bootstrap-cid": string;
  "bootstrap-digest": string;
  "bootstrap-manifest-digest": string;
  "artifact-version-id": string;
  "artifact-mode": string;
  "auto-published": string;
  "cleanup-status": string;
  "provenance-json": string;
  "artifact-digest": string;
  "source-repository": string;
  "source-ref": string;
  "source-commit": string;
  "source-workflow-identity": string;
  "binding-revision": string;
  "revocation-epoch": string;
}

type RuntimeImageBootstrapMode = "standard" | "bridge-probe";

type RuntimeImageBindingInputs =
  | { mode: "v4"; authoredDigest: string; releaseIntentDigest: string }
  | { mode: "v5"; manifestPath: string };

interface ValidatedRuntimeImageUploadInputs {
  applicationId: string;
  imagePath: string;
  binding: RuntimeImageBindingInputs;
  bootstrapMode: RuntimeImageBootstrapMode;
  expectedSha256?: string;
  sourceImageUrl?: string;
  liskovUrl: string;
  audience: string;
}

type SourceOutputs = Pick<
  RuntimeImageUploadOutputs,
  | "artifact-digest"
  | "source-repository"
  | "source-ref"
  | "source-commit"
  | "source-workflow-identity"
  | "binding-revision"
  | "revocation-epoch"
>;

// One output shape for both modes: V4 mode sets the V5 evidence to "".
const NO_SOURCE_OUTPUTS: SourceOutputs = {
  "artifact-digest": "",
  "source-repository": "",
  "source-ref": "",
  "source-commit": "",
  "source-workflow-identity": "",
  "binding-revision": "",
  "revocation-epoch": ""
};

export async function inspectRuntimeImage(imagePath: string): Promise<RuntimeImageInfo> {
  const imageStat = await stat(imagePath);
  if (!imageStat.isFile() || imageStat.size <= 0 || !Number.isSafeInteger(imageStat.size)) {
    throw new Error("image-path must name a non-empty regular file with a safe byte size");
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(imagePath)) {
    hash.update(chunk as Buffer);
  }
  return {
    digest: `sha256:${hash.digest("hex")}`,
    byteSize: imageStat.size
  };
}

export async function uploadRuntimeImage(
  rawInputs: RuntimeImageUploadInputs,
  dependencies: RuntimeImageUploadDependencies
): Promise<RuntimeImageUploadOutputs> {
  const sensitive = new Set<string>();
  const mask = (value: string): string => {
    if (value.length > 0) {
      sensitive.add(value);
      dependencies.mask(value);
    }
    return value;
  };

  try {
    const inputs = validateInputs(rawInputs);
    const binding = inputs.binding;
    const source: RuntimeImageSourceDocument | undefined = binding.mode === "v5"
      ? await loadRuntimeImageSourceDocument(
        binding.manifestPath,
        inputs.applicationId,
        dependencies.readFile
      )
      : undefined;
    const image = await dependencies.inspectImage(inputs.imagePath);
    const expectedDigest = normalizeExpectedDigest(inputs.expectedSha256);
    if (expectedDigest && expectedDigest !== image.digest) {
      throw new Error(`runtime image SHA-256 mismatch: expected ${expectedDigest}, got ${image.digest}`);
    }

    const uploadToken = mask(await dependencies.getOidcToken(inputs.audience));
    const sessionUrl = endpointUrl(
      inputs.liskovUrl,
      `/api/applications/${encodeURIComponent(inputs.applicationId)}/runtime-images/upload-session`
    );
    const sessionBody = binding.mode === "v4"
      ? {
          domain: RUNTIME_IMAGE_UPLOAD_SESSION_DOMAIN,
          authoredDigest: binding.authoredDigest,
          releaseIntentDigest: binding.releaseIntentDigest
        }
      : {
          domain: RUNTIME_IMAGE_SOURCE_UPLOAD_SESSION_DOMAIN,
          manifestPath: source!.manifestPath,
          document: source!.document
        };
    const sessionResponse = record(
      await dependencies.postJson(sessionUrl, uploadToken, sessionBody),
      "upload-session response"
    );
    const uploadSession = record(sessionResponse.uploadSession, "uploadSession");
    const upload = record(sessionResponse.upload, "upload");
    const credentials = record(sessionResponse.credentials, "credentials");
    const accessKeyId = mask(requiredString(credentials.accessKeyId, "credentials.accessKeyId"));
    const secretAccessKey = mask(
      requiredString(credentials.secretAccessKey, "credentials.secretAccessKey")
    );

    if (binding.mode === "v4") {
      assertEqual(uploadSession.authoredDigest, binding.authoredDigest, "uploadSession.authoredDigest");
      assertEqual(
        uploadSession.releaseIntentDigest,
        binding.releaseIntentDigest,
        "uploadSession.releaseIntentDigest"
      );
    } else {
      assertEqual(uploadSession.authoredDigest, source!.authoredDigest, "uploadSession.authoredDigest");
      assertEqual(
        record(uploadSession.source, "uploadSession.source").manifestPath,
        source!.manifestPath,
        "uploadSession.source.manifestPath"
      );
    }
    assertEqual(uploadSession.applicationId, inputs.applicationId, "uploadSession.applicationId");
    assertEqual(uploadSession.status, "ready", "uploadSession.status");

    const uploadSessionId = requiredString(uploadSession.sessionId, "uploadSession.sessionId");
    const objectKey = requiredString(upload.objectKey, "upload.objectKey");
    await dependencies.putObject({
      endpointUrl: requiredHttpUrl(upload.endpointUrl, "upload.endpointUrl"),
      region: requiredString(upload.region, "upload.region"),
      bucket: requiredString(upload.bucket, "upload.bucket"),
      objectKey,
      accessKeyId,
      secretAccessKey,
      imagePath: inputs.imagePath,
      byteSize: image.byteSize,
      digest: image.digest
    });

    const finalizeToken = mask(await dependencies.getOidcToken(inputs.audience));
    const finalizeUrl = endpointUrl(
      inputs.liskovUrl,
      `/api/applications/${encodeURIComponent(inputs.applicationId)}/runtime-images/upload-sessions/${encodeURIComponent(uploadSessionId)}/finalize`
    );
    const provenance = githubProvenance(dependencies.environment, inputs.sourceImageUrl);
    const finalized = record(await dependencies.postJson(finalizeUrl, finalizeToken, {
      objectKey,
      digest: image.digest,
      byteSize: image.byteSize,
      bootstrapMode: inputs.bootstrapMode,
      provenance
    }), "finalize response");
    const finalizedSession = record(finalized.uploadSession, "finalize.uploadSession");
    const bootstrap = record(finalized.bootstrap, "finalize.bootstrap");
    const artifact = record(finalized.artifact, "finalize.artifact");
    const cleanup = record(finalized.cleanup, "finalize.cleanup");
    const serverProvenance = record(finalizedSession.provenance, "finalize.uploadSession.provenance");
    const autoPublished = requiredBoolean(finalized.autoPublished, "finalize.autoPublished");

    assertEqual(finalizedSession.sessionId, uploadSessionId, "finalize.uploadSession.sessionId");
    if (binding.mode === "v4") {
      assertEqual(finalizedSession.authoredDigest, binding.authoredDigest, "finalize.uploadSession.authoredDigest");
      assertEqual(
        finalizedSession.releaseIntentDigest,
        binding.releaseIntentDigest,
        "finalize.uploadSession.releaseIntentDigest"
      );
    } else {
      assertEqual(finalizedSession.authoredDigest, source!.authoredDigest, "finalize.uploadSession.authoredDigest");
    }
    assertEqual(finalizedSession.digest, image.digest, "finalize.uploadSession.digest");
    assertEqual(finalizedSession.byteSize, image.byteSize, "finalize.uploadSession.byteSize");
    const sourceOutputs = source
      ? sourceEvidenceOutputs(finalized, artifact, source.manifestPath)
      : NO_SOURCE_OUTPUTS;

    return {
      "image-digest": image.digest,
      "image-byte-size": String(image.byteSize),
      "upload-session-id": uploadSessionId,
      "image-url": requiredHttpUrl(finalizedSession.imageUrl, "finalize.uploadSession.imageUrl"),
      "bootstrap-cid": requiredString(bootstrap.scriptCid, "finalize.bootstrap.scriptCid"),
      "bootstrap-digest": requiredString(bootstrap.bundleDigest, "finalize.bootstrap.bundleDigest"),
      "bootstrap-manifest-digest": requiredString(
        bootstrap.manifestDigest,
        "finalize.bootstrap.manifestDigest"
      ),
      "artifact-version-id": requiredString(
        finalized.artifactVersionId,
        "finalize.artifactVersionId"
      ),
      "artifact-mode": requiredString(artifact.mode, "finalize.artifact.mode"),
      "auto-published": String(autoPublished),
      "cleanup-status": requiredString(cleanup.status, "finalize.cleanup.status"),
      "provenance-json": JSON.stringify(serverProvenance),
      ...sourceOutputs
    };
  } catch (error) {
    throw new Error(redactError(error, sensitive));
  }
}

// The build evidence a V5 `release.mode: source` publication supplies, read
// from the finalize response of a session bound to a source document.
function sourceEvidenceOutputs(
  finalized: Record<string, unknown>,
  artifact: Record<string, unknown>,
  manifestPath: string
): SourceOutputs {
  const evidence = record(finalized.source, "finalize.source");
  assertEqual(evidence.manifestPath, manifestPath, "finalize.source.manifestPath");
  return {
    "artifact-digest": requiredString(artifact.digest, "finalize.artifact.digest"),
    "source-repository": requiredString(evidence.repository, "finalize.source.repository"),
    "source-ref": requiredString(evidence.ref, "finalize.source.ref"),
    "source-commit": requiredString(evidence.commit, "finalize.source.commit"),
    "source-workflow-identity": requiredString(
      evidence.workflowIdentity,
      "finalize.source.workflowIdentity"
    ),
    "binding-revision": requiredCounter(
      evidence.bindingRevision,
      "finalize.source.bindingRevision"
    ),
    "revocation-epoch": requiredCounter(
      evidence.revocationEpoch,
      "finalize.source.revocationEpoch"
    )
  };
}

function validateInputs(input: RuntimeImageUploadInputs): ValidatedRuntimeImageUploadInputs {
  const applicationId = nonEmpty(input.applicationId, "application-id");
  const imagePath = nonEmpty(input.imagePath, "image-path");
  const binding = validateBinding(input);
  const audience = nonEmpty(input.audience, "audience");
  const bootstrapMode = validateBootstrapMode(input.bootstrapMode);
  return {
    applicationId,
    imagePath,
    binding,
    bootstrapMode,
    expectedSha256: input.expectedSha256,
    sourceImageUrl: input.sourceImageUrl,
    audience,
    liskovUrl: normalizedBaseUrl(input.liskovUrl)
  };
}

function validateBinding(input: RuntimeImageUploadInputs): RuntimeImageBindingInputs {
  const manifestPath = input.manifestPath?.trim() ?? "";
  const authoredDigest = input.authoredDigest ?? "";
  const releaseIntentDigest = input.releaseIntentDigest ?? "";
  const anyDigest = authoredDigest.trim() !== "" || releaseIntentDigest.trim() !== "";
  if (manifestPath !== "") {
    if (anyDigest) {
      throw new Error("manifest-path and the V4 digest inputs are mutually exclusive");
    }
    return { mode: "v5", manifestPath };
  }
  if (!anyDigest) {
    throw new Error(
      "exactly one of manifest-path (a V5 source document) or authored-digest with release-intent-digest (V4 mode) is required"
    );
  }
  return {
    mode: "v4",
    authoredDigest: contractDigest(authoredDigest, "authored-digest"),
    releaseIntentDigest: contractDigest(releaseIntentDigest, "release-intent-digest")
  };
}

function validateBootstrapMode(value?: string): RuntimeImageBootstrapMode {
  const mode = value?.trim() || "standard";
  if (mode !== "standard" && mode !== "bridge-probe") {
    throw new Error("bootstrap-mode must be exactly standard or bridge-probe");
  }
  return mode;
}

function contractDigest(value: string, field: string): string {
  const digest = value.trim();
  if (!/^[0-9a-f]{64}$/u.test(digest)) {
    throw new Error(`${field} must be exactly 64 lowercase hexadecimal characters without a prefix`);
  }
  return digest;
}

function normalizeExpectedDigest(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const hex = trimmed.replace(/^sha256:/iu, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(hex)) {
    throw new Error("expected-sha256 must be 64 hexadecimal characters with an optional sha256: prefix");
  }
  return `sha256:${hex}`;
}

function normalizedBaseUrl(value: string): string {
  const url = new URL(nonEmpty(value, "liskov-url"));
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("liskov-url must use http or https");
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/u, "");
}

function endpointUrl(baseUrl: string, pathname: string): string {
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/u, "")}${pathname}`;
  return url.toString();
}

function githubProvenance(environment: NodeJS.ProcessEnv, sourceImageUrl?: string): Record<string, string> {
  const provenance: Record<string, string> = {};
  for (const [field, name] of [
    ["repository", "GITHUB_REPOSITORY"],
    ["ref", "GITHUB_REF"],
    ["sha", "GITHUB_SHA"],
    ["workflowRef", "GITHUB_WORKFLOW_REF"],
    ["workflow", "GITHUB_WORKFLOW"],
    ["runId", "GITHUB_RUN_ID"],
    ["runAttempt", "GITHUB_RUN_ATTEMPT"],
    ["actor", "GITHUB_ACTOR"],
    ["eventName", "GITHUB_EVENT_NAME"]
  ]) {
    const value = environment[name]?.trim();
    if (value) provenance[field] = value;
  }
  if (sourceImageUrl?.trim()) provenance.sourceImageUrl = sourceImageUrl.trim();
  return provenance;
}

function nonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value || /[\r\n\u0000]/u.test(value)) {
    throw new Error(`${field} must be a non-empty control-character-free string`);
  }
  return value;
}

function requiredHttpUrl(value: unknown, field: string): string {
  const stringValue = requiredString(value, field);
  const url = new URL(stringValue);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${field} must use http or https`);
  }
  return stringValue;
}

// A non-negative counter the server sends as a JSON number. Zero is a
// legitimate value (a binding that was never revoked has epoch 0).
function requiredCounter(value: unknown, field: string): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }
  return String(value);
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${field} must be a boolean`);
  return value;
}

function assertEqual(actual: unknown, expected: unknown, field: string): void {
  if (actual !== expected) throw new Error(`${field} did not echo the requested binding`);
}

function redactError(error: unknown, sensitive: Set<string>): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const value of sensitive) {
    message = message.replaceAll(value, "[REDACTED]");
  }
  return message;
}
