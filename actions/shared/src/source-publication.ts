import { createHash } from "node:crypto";

export const SOURCE_PUBLICATION_SCHEMA = "proof.liskov.source-publication-evidence.v1";
export const APPLICATION_MANIFEST_SCHEMA = "proof.liskov.application-manifest";

const DEFERRED_ROOTS = ["ingress", "cohort", "hooks", "integrations"] as const;

export interface SourcePublicationContext {
  repository: string;
  ref: string;
  workflowRef: string;
  manifestPath: string;
  artifactDigest?: string;
}

export interface SourcePublicationEvidence {
  schema: typeof SOURCE_PUBLICATION_SCHEMA;
  applicationId: string;
  authoredDigest: string;
  repository: string;
  ref: string;
  workflowRef: string;
  manifestPath: string;
  artifactDigest?: string;
}

export function observedGithubSource(env: NodeJS.ProcessEnv, manifestPath: string): SourcePublicationContext {
  const repository = requiredEnv(env, "GITHUB_REPOSITORY");
  const ref = requiredEnv(env, "GITHUB_REF");
  const workflowRef = requiredEnv(env, "GITHUB_WORKFLOW_REF");
  return {
    repository,
    ref,
    workflowRef,
    manifestPath,
    artifactDigest: optional(env.LISKOV_ARTIFACT_DIGEST)
  };
}

export function bindRetainedSourcePublication(input: {
  manifest: unknown;
  applicationId: string;
  observed: SourcePublicationContext;
  expected: SourcePublicationContext;
}): SourcePublicationEvidence {
  const manifest = asObject(input.manifest);
  if (!manifest) throw new Error("authored manifest must be an object");
  if (manifest.schema !== APPLICATION_MANIFEST_SCHEMA) {
    throw new Error(`authored manifest schema must be ${APPLICATION_MANIFEST_SCHEMA}`);
  }
  if (manifest.schemaVersion !== 5) {
    throw new Error("retained source publication requires schemaVersion 5");
  }
  if (manifest.applicationId !== input.applicationId) {
    throw new Error(`authored manifest applicationId must be ${input.applicationId}`);
  }
  const release = asObject(manifest.release);
  if (!release || release.mode !== "source") {
    throw new Error("retained source publication requires release.mode source");
  }
  for (const key of DEFERRED_ROOTS) {
    if (key in manifest) {
      throw new Error(`${key} is deferred from thin V5 and is not accepted as live source evidence`);
    }
  }
  bindExact("repository", input.observed.repository, input.expected.repository);
  bindExact("ref", input.observed.ref, input.expected.ref);
  bindExact("workflow", input.observed.workflowRef, input.expected.workflowRef);
  bindExact("manifest", input.observed.manifestPath, input.expected.manifestPath);
  if (input.expected.artifactDigest) {
    if (!input.observed.artifactDigest) {
      throw new Error("stale or mismatched artifact evidence: observed artifact digest is missing");
    }
    bindExact("artifact", input.observed.artifactDigest, input.expected.artifactDigest);
  }
  const evidence: SourcePublicationEvidence = {
    schema: SOURCE_PUBLICATION_SCHEMA,
    applicationId: input.applicationId,
    authoredDigest: canonicalDigest(manifest),
    repository: input.observed.repository,
    ref: input.observed.ref,
    workflowRef: input.observed.workflowRef,
    manifestPath: input.observed.manifestPath
  };
  if (input.observed.artifactDigest) evidence.artifactDigest = input.observed.artifactDigest;
  return evidence;
}

function bindExact(name: string, observed: string, expected: string): void {
  if (!expected.trim() || !observed.trim()) {
    throw new Error(`${name} evidence must be a non-empty exact value`);
  }
  if (observed !== expected) {
    throw new Error(`stale or mismatched ${name} evidence: observed ${observed}, expected ${expected}`);
  }
}

function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = optional(env[key]);
  if (!value) throw new Error(`${key} is required to bind source publication evidence`);
  return value;
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function canonicalDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("value is not canonical JSON");
  return serialized;
}
