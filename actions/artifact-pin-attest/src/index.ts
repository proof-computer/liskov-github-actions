// Mint a GitHub OIDC token and POST a GitHub-attested artifact pin to liskov-rs
// (/api/applications/<id>/artifact-pins/github). Ported from
// liskov-diagnostic/scripts/post-slipway-artifact-pin.ts; OIDC minting uses
// @actions/core.getIDToken (needs `permissions: id-token: write`).

import path from "node:path";
import * as core from "@actions/core";

import { runArtifactPinAttest } from "./runtime.js";

const DEFAULT_URL = "https://liskov.proof.computer/api/applications/{applicationId}/artifact-pins/github";

async function run(): Promise<void> {
  const applicationId = optionalInput("application-id");
  const buildManifestPath = core.getInput("build-manifest-path", { required: true });
  const authoredManifestPath = optionalInput("authored-manifest-path");
  const targetsPath = optionalInput("targets-path");
  const audience = core.getInput("audience") || "slipway-artifact-pin";
  const urlTemplate = core.getInput("pin-url") || process.env.SLIPWAY_ARTIFACT_PIN_URL || DEFAULT_URL;
  const result = await runArtifactPinAttest({
    applicationId,
    buildManifestPath,
    authoredManifestPath,
    targetsPath,
    audience,
    urlTemplate
  }, {
    getIdToken: (tokenAudience) => core.getIDToken(tokenAudience),
    fetchImpl: fetch,
    environment: process.env,
    now: () => new Date(),
    repositoryRoot: path.resolve(process.env.GITHUB_WORKSPACE || ".")
  });

  for (const item of result.results) {
    core.info(`Attested ${item.applicationId} -> ${item.artifactVersionId}`);
  }
  core.setOutput("cid", result.cid);
  core.setOutput("digest", result.digest);
  core.setOutput("artifact-version-id", result.artifactVersionId);
  core.setOutput("artifact-version-ids", JSON.stringify(result.artifactVersionIds));
  core.setOutput("results-json", JSON.stringify(result.results));
  core.setOutput("target-count", String(result.results.length));
}

function optionalInput(name: string): string | undefined {
  const value = core.getInput(name).trim();
  return value || undefined;
}
run().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
