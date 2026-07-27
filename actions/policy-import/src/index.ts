// Mint a GitHub OIDC token and POST the repo's authored manifest to liskov-rs
// (/api/applications/<id>/policy-imports/github) so a manifest change on main
// becomes an immutable draft without a manual
// `proof liskov application import`. The server pins the recorded
// source.commit from the VERIFIED OIDC sha claim, so auto-imported versions
// are commit-pinned by construction. OIDC minting uses @actions/core.getIDToken
// (needs `permissions: id-token: write`).

import { readFile } from "node:fs/promises";
import * as core from "@actions/core";

const DEFAULT_URL = "https://liskov.proof.computer/api/applications/{applicationId}/policy-imports/github";

async function run(): Promise<void> {
  const applicationId = core.getInput("application-id", { required: true }).trim();
  const manifestPath = core.getInput("manifest-path", { required: true }).trim();
  const audience = core.getInput("audience") || "slipway-artifact-pin";
  const urlTemplate = core.getInput("import-url") || process.env.LISKOV_POLICY_IMPORT_URL || DEFAULT_URL;

  let document: unknown;
  try {
    document = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read manifest JSON from ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    throw new Error(`${manifestPath} must contain a JSON object application manifest`);
  }
  const documentId = (document as Record<string, unknown>).applicationId;
  if (typeof documentId === "string" && documentId !== applicationId) {
    throw new Error(`${manifestPath} declares applicationId ${documentId}, expected ${applicationId}`);
  }

  const token = await core.getIDToken(audience);
  const url = urlTemplate.replaceAll("{applicationId}", encodeURIComponent(applicationId));
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ document, path: manifestPath })
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
}

run().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
