import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  exactRecord,
  sanitizeDiagnosticMetadata,
  type JsonRecord
} from "../../shared/src/diagnostics.js";
import { artifactPinBindings } from "./manifest.js";
import { artifactProvenanceFromOidcToken } from "./oidc.js";

export interface ArtifactPinAttestInputs {
  readonly applicationId?: string;
  readonly buildManifestPath: string;
  readonly authoredManifestPath?: string;
  readonly targetsPath?: string;
  readonly audience: string;
  readonly urlTemplate: string;
}

export interface ArtifactPinAttestDependencies {
  readonly getIdToken: (audience: string) => Promise<string>;
  readonly fetchImpl: typeof fetch;
  readonly environment: NodeJS.ProcessEnv;
  readonly now: () => Date;
  readonly repositoryRoot: string;
}

export interface ArtifactPinTarget {
  readonly applicationId: string;
  readonly authoredManifestPath: string;
}

export interface ArtifactPinAttestResult {
  readonly cid: string;
  readonly digest: string;
  readonly artifactVersionId: string;
  readonly artifactVersionIds: readonly string[];
  readonly results: ReadonlyArray<{
    applicationId: string;
    artifactVersionId: string;
  }>;
}

export async function runArtifactPinAttest(
  inputs: ArtifactPinAttestInputs,
  dependencies: ArtifactPinAttestDependencies
): Promise<ArtifactPinAttestResult> {
  const buildManifest = jsonRecord(
    JSON.parse(await readFile(inputs.buildManifestPath, "utf8")),
    `build manifest ${inputs.buildManifestPath}`
  );
  const scriptCid = stringField(buildManifest, "scriptIpfs")
    ?? stringField(buildManifest, "scriptCid");
  const bundleDigest = stringField(buildManifest, "scriptHash")
    ?? stringField(buildManifest, "bundleSha256");
  if (!scriptCid || !/^ipfs:\/\/[A-Za-z0-9]+$/u.test(scriptCid)) {
    throw new Error(`Manifest ${inputs.buildManifestPath} is missing a valid scriptIpfs`);
  }
  if (!bundleDigest || !/^(?:sha256:)?[0-9a-f]{64}$/iu.test(bundleDigest)) {
    throw new Error(
      `Manifest ${inputs.buildManifestPath} is missing a valid scriptHash/bundleSha256`
    );
  }
  const diagnostics = sanitizeDiagnosticMetadata(
    buildManifest.diagnostics,
    `build manifest ${inputs.buildManifestPath}.diagnostics`
  );
  const targets = await resolveArtifactPinTargets(inputs, dependencies.repositoryRoot);
  const preparedTargets = await Promise.all(targets.map(async (target) => {
    const manifestFile = resolveWithin(
      dependencies.repositoryRoot,
      target.authoredManifestPath,
      "authoredManifestPath"
    );
    const authoredManifest = jsonRecord(
      JSON.parse(await readFile(manifestFile, "utf8")),
      `authored manifest ${target.authoredManifestPath}`
    );
    return {
      target,
      bindings: artifactPinBindings(authoredManifest, target.applicationId)
    };
  }));
  const token = await dependencies.getIdToken(inputs.audience);
  const oidcProvenance = artifactProvenanceFromOidcToken(token);
  const results: Array<{ applicationId: string; artifactVersionId: string }> = [];

  for (const { target, bindings } of preparedTargets) {
    const body: JsonRecord = bindings.kind === "v5-source"
      ? {
          domain: "proof.liskov.github-source-artifact.v1",
          applicationId: target.applicationId,
          manifestPath: target.authoredManifestPath,
          scriptCid,
          bundleDigest: canonicalSha256(bundleDigest)
        }
      : {
          domain: "proof.slipway.github-artifact-pin.v1",
          applicationId: target.applicationId,
          scriptCid,
          bundleDigest,
          authoredDigest: bindings.authoredDigest,
          releaseIntentDigest: bindings.releaseIntentDigest,
          generatedAt: stringField(buildManifest, "generatedAt")
            ?? dependencies.now().toISOString(),
          encryption: { mode: bindings.encryptionMode },
          provenance: {
            repository: oidcProvenance.repository,
            ref: oidcProvenance.ref,
            sha: oidcProvenance.sha,
            workflow: dependencies.environment.GITHUB_WORKFLOW,
            workflow_ref: oidcProvenance.workflowRef,
            run_id: dependencies.environment.GITHUB_RUN_ID,
            run_attempt: dependencies.environment.GITHUB_RUN_ATTEMPT,
            actor: dependencies.environment.GITHUB_ACTOR,
            event_name: dependencies.environment.GITHUB_EVENT_NAME
          }
        };
    if (bindings.kind === "v4" && diagnostics) body.diagnostics = diagnostics;

    const url = inputs.urlTemplate.replaceAll(
      "{applicationId}",
      encodeURIComponent(target.applicationId)
    );
    const response = await dependencies.fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(
        `Artifact pin post failed for ${target.applicationId}: `
          + `${response.status} ${redact(responseText)}`
      );
    }
    const result = responseText
      ? jsonRecord(JSON.parse(responseText), `artifact pin response for ${target.applicationId}`)
      : {};
    const artifactVersionId = stringField(result, "artifactVersionId");
    if (!artifactVersionId) {
      throw new Error(
        `Artifact pin response for ${target.applicationId} omitted artifactVersionId`
      );
    }
    results.push({ applicationId: target.applicationId, artifactVersionId });
  }

  const artifactVersionIds = results.map((result) => result.artifactVersionId);
  return {
    cid: scriptCid,
    digest: bundleDigest,
    artifactVersionId: artifactVersionIds[0]!,
    artifactVersionIds,
    results
  };
}

function canonicalSha256(value: string): string {
  const hex = value.replace(/^sha256:/iu, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(hex)) {
    throw new Error("bundle digest must be one canonical SHA-256 digest");
  }
  return `sha256:${hex}`;
}

export async function resolveArtifactPinTargets(
  inputs: Pick<ArtifactPinAttestInputs, "applicationId" | "authoredManifestPath" | "targetsPath">,
  repositoryRoot: string
): Promise<readonly ArtifactPinTarget[]> {
  const targetsPath = inputs.targetsPath?.trim();
  const applicationId = inputs.applicationId?.trim();
  const authoredManifestPath = inputs.authoredManifestPath?.trim();
  if (!targetsPath) {
    if (!applicationId || !authoredManifestPath) {
      throw new Error(
        "application-id and authored-manifest-path are required when targets-path is absent"
      );
    }
    return [{
      applicationId: validateApplicationId(applicationId),
      authoredManifestPath: validateRepositoryPath(authoredManifestPath, "authored-manifest-path")
    }];
  }
  if (applicationId || authoredManifestPath) {
    throw new Error(
      "targets-path is mutually exclusive with application-id and authored-manifest-path"
    );
  }
  const parsed: unknown = JSON.parse(
    await readFile(resolveWithin(repositoryRoot, targetsPath, "targets-path"), "utf8")
  );
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("targets-path must contain a non-empty JSON array");
  }
  const seen = new Set<string>();
  return parsed.map((value, index) => {
    const target = exactRecord(
      value,
      `targets[${index}]`,
      new Set(["applicationId", "authoredManifestPath"])
    );
    const id = validateApplicationId(target.applicationId);
    if (seen.has(id)) throw new Error(`targets-path repeats applicationId ${id}`);
    seen.add(id);
    return {
      applicationId: id,
      authoredManifestPath: validateRepositoryPath(
        target.authoredManifestPath,
        `targets[${index}].authoredManifestPath`
      )
    };
  });
}

function validateApplicationId(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 160
    || value.trim() !== value
    || /[\s/\\]/u.test(value)
  ) {
    throw new Error("applicationId must be a bounded non-whitespace identifier");
  }
  return value;
}

function validateRepositoryPath(value: unknown, source: string): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 512
    || value.includes("\\")
    || value.startsWith("/")
    || value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${source} must be a safe repository-relative path`);
  }
  return value;
}

function resolveWithin(root: string, candidate: string, field: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, candidate);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${field} must stay within the repository`);
  }
  return resolved;
}

function jsonRecord(value: unknown, source: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be a JSON object`);
  }
  return value as JsonRecord;
}

function stringField(record: JsonRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function redact(value: string): string {
  return value.replace(/[A-Za-z0-9_-]{24,}/gu, "[redacted]").slice(0, 400);
}
