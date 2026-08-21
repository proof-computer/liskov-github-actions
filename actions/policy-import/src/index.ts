// Mint a GitHub OIDC token and POST the repo's authored manifest to liskov-rs
// (/api/applications/<id>/policy-imports/github) so a manifest change on main
// becomes an immutable draft without a manual
// `proof liskov application import`. The server pins the recorded
// source.commit from the VERIFIED OIDC sha claim, so auto-imported versions
// are commit-pinned by construction. OIDC minting uses @actions/core.getIDToken
// (needs `permissions: id-token: write`).

import { readFile } from "node:fs/promises";
import * as core from "@actions/core";

import { resolvePolicyImportUrl } from "./url.js";
import { bindPolicyImportManifest } from "./bind.js";

async function run(): Promise<void> {
  const applicationId = core.getInput("application-id", { required: true }).trim();
  const manifestPath = core.getInput("manifest-path", { required: true }).trim();
  const audience = core.getInput("audience") || "slipway-artifact-pin";
  const importUrl = core.getInput("import-url");
  const liskovUrl = core.getInput("liskov-url");

  let document: unknown;
  try {
    document = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read manifest JSON from ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const bound = bindPolicyImportManifest({
    manifest: document,
    applicationId,
    manifestPath,
    env: process.env,
    expected: {
      repository: optionalInput("repository"),
      ref: optionalInput("ref"),
      workflowRef: optionalInput("workflow-ref"),
      manifestPath: optionalInput("expected-manifest-path") || manifestPath,
      artifactDigest: optionalInput("artifact-digest")
    }
  });

  const token = await core.getIDToken(audience);
  core.setSecret(token);
  const url = resolvePolicyImportUrl({
    applicationId,
    importUrl,
    liskovUrl,
    environmentUrl: process.env.LISKOV_POLICY_IMPORT_URL
  });
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      document: bound.document,
      path: manifestPath
    })
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Policy import failed for ${applicationId}: ${response.status} ${responseText}`);

  let result: Record<string, unknown> = {};
  try {
    result = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    // Non-JSON 2xx is unexpected but not a failure; outputs stay empty.
  }
  const authoredDigest = typeof result.authoredDigest === "string" ? result.authoredDigest : "";
  const releaseIntentDigest =
    typeof result.releaseIntentDigest === "string" ? result.releaseIntentDigest : "";
  if (!authoredDigest || !releaseIntentDigest) {
    throw new Error("Manifest import response omitted authoredDigest or releaseIntentDigest");
  }

  const warnings = Array.isArray(result.diagnostics) ? (result.diagnostics as Record<string, unknown>[]) : [];
  for (const diagnostic of warnings) {
    if (diagnostic.level === "warning" && typeof diagnostic.message === "string") {
      core.warning(`${String(diagnostic.code ?? "policy_import")}: ${diagnostic.message}`);
    }
  }

  core.info(`Imported ${manifestPath} for ${applicationId} as an authored manifest draft`);
  core.setOutput("authored-digest", authoredDigest);
  core.setOutput("release-intent-digest", releaseIntentDigest);
  if (bound.sourceEvidence) {
    core.setOutput("source-repository", bound.sourceEvidence.repository);
    core.setOutput("source-ref", bound.sourceEvidence.ref);
    core.setOutput("source-workflow-ref", bound.sourceEvidence.workflowRef);
    core.setOutput("source-manifest-path", bound.sourceEvidence.manifestPath);
  }
}

function optionalInput(name: string): string | undefined {
  const value = core.getInput(name).trim();
  return value || undefined;
}

run().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
