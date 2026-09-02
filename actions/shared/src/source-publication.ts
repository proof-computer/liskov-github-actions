import {
  requireValidPolicyManifest,
  supportsRegisteredSourcePublication
} from "./policy-contract.js";

export const SOURCE_PUBLICATION_SCHEMA = "proof.liskov.source-publication-evidence.v1";
export const APPLICATION_MANIFEST_SCHEMA = "proof.liskov.application-manifest";

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
  const result = requireValidPolicyManifest(input.manifest);
  const manifest = result.document!;
  if (!supportsRegisteredSourcePublication(result)) {
    throw new Error("the exact policy pair is not registered for source publication");
  }
  if (manifest.applicationId !== input.applicationId) {
    throw new Error(`authored manifest applicationId must be ${input.applicationId}`);
  }
  const release = asObject(manifest.release);
  if (!release || release.mode !== "source") {
    throw new Error("registered source publication requires release.mode source");
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
    authoredDigest: result.authoredDigest!,
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
