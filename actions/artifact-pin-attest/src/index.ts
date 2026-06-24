// Mint a GitHub OIDC token and POST a GitHub-attested artifact pin to liskov-rs
// (/api/applications/<id>/artifact-pins/github). Ported from
// liskov-diagnostic/scripts/post-slipway-artifact-pin.ts; OIDC minting uses
// @actions/core.getIDToken (needs `permissions: id-token: write`).

import { readFile } from "node:fs/promises";
import * as core from "@actions/core";

const DEFAULT_URL = "https://liskov.proof.computer/api/applications/{applicationId}/artifact-pins/github";

async function run(): Promise<void> {
  const applicationIds = splitCsv(core.getInput("application-ids", { required: true }));
  if (applicationIds.length === 0) throw new Error("application-ids must include at least one Application id");
  const manifestPath = core.getInput("manifest-path", { required: true });
  const audience = core.getInput("audience") || "slipway-artifact-pin";
  const urlTemplate = core.getInput("pin-url") || process.env.SLIPWAY_ARTIFACT_PIN_URL || DEFAULT_URL;

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const scriptCid = str(manifest, "scriptIpfs") ?? str(manifest, "scriptCid");
  const bundleDigest = str(manifest, "scriptHash") ?? str(manifest, "bundleSha256");
  if (!scriptCid) throw new Error(`Manifest ${manifestPath} is missing scriptIpfs`);
  if (!bundleDigest) throw new Error(`Manifest ${manifestPath} is missing scriptHash/bundleSha256`);

  const token = await core.getIDToken(audience);

  for (const applicationId of applicationIds) {
    const url = urlTemplate.replaceAll("{applicationId}", encodeURIComponent(applicationId));
    const body = {
      domain: "proof.slipway.github-artifact-pin.v1",
      applicationId,
      scriptCid,
      bundleDigest,
      generatedAt: str(manifest, "generatedAt") ?? new Date().toISOString(),
      encryption: { mode: "none" },
      provenance: {
        repository: reqEnv("GITHUB_REPOSITORY"),
        ref: reqEnv("GITHUB_REF"),
        sha: reqEnv("GITHUB_SHA"),
        workflow: process.env.GITHUB_WORKFLOW,
        workflow_ref: process.env.GITHUB_WORKFLOW_REF,
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
    core.info(`Attested ${applicationId} -> ${scriptCid}`);
  }

  core.setOutput("cid", scriptCid);
  core.setOutput("digest", bundleDigest);
}

function splitCsv(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}
function str(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function reqEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

run().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
