// Mint a GitHub OIDC token and notify liskov-rs to reconcile the marketplace
// catalog to this commit (ADR-0006 §A1 / the catalog schema spec, Part 2).
// The server derives repository/ref/sha from the VERIFIED OIDC claims and reads
// the <provider>/<offering>.json tree at that sha — the body below is advisory.
//
// NOTE: the /api/marketplace/ingest endpoint is not built yet (schema-spec Part 2);
// this action is ready for it.

import * as core from "@actions/core";

const DEFAULT_URL = "https://liskov.proof.computer/api/marketplace/ingest";

async function run(): Promise<void> {
  const ingestUrl = core.getInput("ingest-url") || process.env.LISKOV_MARKETPLACE_INGEST_URL || DEFAULT_URL;
  const audience = core.getInput("audience") || "liskov-marketplace-ingest";

  const token = await core.getIDToken(audience);
  const body = {
    repository: process.env.GITHUB_REPOSITORY,
    ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
    workflowRef: process.env.GITHUB_WORKFLOW_REF
  };

  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Marketplace ingest failed: ${response.status} ${responseText}`);

  core.info(`Marketplace ingest ok: ${process.env.GITHUB_REPOSITORY}@${(process.env.GITHUB_SHA || "").slice(0, 8)}`);
  try {
    core.setOutput("result", JSON.stringify(JSON.parse(responseText)));
  } catch {
    /* non-JSON response — ignore */
  }
}

run().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
