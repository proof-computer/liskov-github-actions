// Mint a GitHub OIDC token and POST the repo's policy file to liskov-rs
// (/api/applications/<id>/policy-imports/github) so a policy change on main
// becomes a new (optionally published) policy version without a manual
// `proof liskov application import`. The server pins the recorded
// source.commit from the VERIFIED OIDC sha claim, so auto-imported versions
// are commit-pinned by construction. OIDC minting uses @actions/core.getIDToken
// (needs `permissions: id-token: write`).

import { readFile } from "node:fs/promises";
import * as core from "@actions/core";

const DEFAULT_URL = "https://liskov.proof.computer/api/applications/{applicationId}/policy-imports/github";

async function run(): Promise<void> {
  const applicationId = core.getInput("application-id", { required: true }).trim();
  const policyPath = core.getInput("policy-path", { required: true }).trim();
  const publish = (core.getInput("publish") || "true").trim().toLowerCase() !== "false";
  const audience = core.getInput("audience") || "slipway-artifact-pin";
  const urlTemplate = core.getInput("import-url") || process.env.LISKOV_POLICY_IMPORT_URL || DEFAULT_URL;

  let document: unknown;
  try {
    document = JSON.parse(await readFile(policyPath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read policy JSON from ${policyPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    throw new Error(`${policyPath} must contain a JSON object policy document`);
  }
  const documentId = (document as Record<string, unknown>).applicationId;
  if (typeof documentId === "string" && documentId !== applicationId) {
    throw new Error(`${policyPath} declares applicationId ${documentId}, expected ${applicationId}`);
  }

  const token = await core.getIDToken(audience);
  const url = urlTemplate.replaceAll("{applicationId}", encodeURIComponent(applicationId));
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ document, path: policyPath, publish })
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Policy import failed for ${applicationId}: ${response.status} ${responseText}`);

  let result: Record<string, unknown> = {};
  try {
    result = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    // Non-JSON 2xx is unexpected but not a failure; outputs stay empty.
  }
  const policies = Array.isArray(result.policies) ? (result.policies as Record<string, unknown>[]) : [];
  const version = typeof policies[0]?.policyVersionId === "string" ? (policies[0].policyVersionId as string) : "";
  const digest = typeof result.documentDigest === "string" ? result.documentDigest : "";

  const warnings = Array.isArray(result.diagnostics) ? (result.diagnostics as Record<string, unknown>[]) : [];
  for (const diagnostic of warnings) {
    if (diagnostic.level === "warning" && typeof diagnostic.message === "string") {
      core.warning(`${String(diagnostic.code ?? "policy_import")}: ${diagnostic.message}`);
    }
  }

  core.info(
    version
      ? `Imported ${policyPath} for ${applicationId} -> ${version}${publish ? " (published)" : ""}`
      : `Imported ${policyPath} for ${applicationId} as a draft (publish=${publish})`
  );
  core.setOutput("policy-version", version);
  core.setOutput("document-digest", digest);
}

run().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
