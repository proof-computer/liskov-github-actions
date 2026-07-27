// Mint a GitHub OIDC token and POST a GitHub-attested artifact pin to liskov-rs
// (/api/applications/<id>/artifact-pins/github). Ported from
// liskov-diagnostic/scripts/post-slipway-artifact-pin.ts; OIDC minting uses
// @actions/core.getIDToken (needs `permissions: id-token: write`).

import { readFile } from "node:fs/promises";
import * as core from "@actions/core";

import { artifactPinBindings } from "./manifest.js";
import { artifactProvenanceFromOidcToken } from "./oidc.js";

const DEFAULT_URL = "https://liskov.proof.computer/api/applications/{applicationId}/artifact-pins/github";

async function run(): Promise<void> {
  const applicationId = core.getInput("application-id", { required: true }).trim();
  const buildManifestPath = core.getInput("build-manifest-path", { required: true });
  const authoredManifestPath = core.getInput("authored-manifest-path", { required: true });
  const audience = core.getInput("audience") || "slipway-artifact-pin";
  const urlTemplate = core.getInput("pin-url") || process.env.SLIPWAY_ARTIFACT_PIN_URL || DEFAULT_URL;

  const buildManifest = JSON.parse(await readFile(buildManifestPath, "utf8")) as Record<string, unknown>;
  const authoredManifest = JSON.parse(
    await readFile(authoredManifestPath, "utf8")
  ) as Record<string, unknown>;
  const bindings = artifactPinBindings(authoredManifest, applicationId);
  const scriptCid = str(buildManifest, "scriptIpfs") ?? str(buildManifest, "scriptCid");
  const bundleDigest = str(buildManifest, "scriptHash") ?? str(buildManifest, "bundleSha256");
  if (!scriptCid) throw new Error(`Manifest ${buildManifestPath} is missing scriptIpfs`);
  if (!bundleDigest) throw new Error(`Manifest ${buildManifestPath} is missing scriptHash/bundleSha256`);

  const token = await core.getIDToken(audience);
  const oidcProvenance = artifactProvenanceFromOidcToken(token);

  const url = urlTemplate.replaceAll("{applicationId}", encodeURIComponent(applicationId));
  const body = {
    domain: "proof.slipway.github-artifact-pin.v1",
    applicationId,
    scriptCid,
    bundleDigest,
    authoredDigest: bindings.authoredDigest,
    releaseIntentDigest: bindings.releaseIntentDigest,
    generatedAt: str(buildManifest, "generatedAt") ?? new Date().toISOString(),
    encryption: { mode: bindings.encryptionMode },
    provenance: {
      repository: oidcProvenance.repository,
      ref: oidcProvenance.ref,
      sha: oidcProvenance.sha,
      workflow: process.env.GITHUB_WORKFLOW,
      workflow_ref: oidcProvenance.workflowRef,
      run_id: process.env.GITHUB_RUN_ID,
      run_attempt: process.env.GITHUB_RUN_ATTEMPT,
      actor: process.env.GITHUB_ACTOR,
      event_name: process.env.GITHUB_EVENT_NAME
    }
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Artifact pin post failed for ${applicationId}: ${response.status} ${responseText}`);
  const result = responseText ? JSON.parse(responseText) as Record<string, unknown> : {};
  const artifactVersionId = str(result, "artifactVersionId");
  if (!artifactVersionId) {
    throw new Error(`Artifact pin response for ${applicationId} omitted artifactVersionId`);
  }
  core.info(`Attested ${applicationId} -> ${artifactVersionId}`);

  core.setOutput("cid", scriptCid);
  core.setOutput("digest", bundleDigest);
  core.setOutput("artifact-version-id", artifactVersionId);
}
function str(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
run().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
