// Build the Acurast deploy zip from dist/ and pin it (no-spend, "direct" path) to
// the Acurast IPFS proxy, then write a script manifest. Ported from
// liskov-diagnostic/scripts/upload-ipfs.ts (the mnemonic/CLI + devtools paths are
// intentionally excluded — keep spend-capable upload out of the reusable surface).

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as core from "@actions/core";
import AdmZip from "adm-zip";

const DEFAULT_IPFS_ENDPOINT = "https://ipfs-proxy.acurast.prod.gke.papers.tech";

async function run(): Promise<void> {
  const workingDir = core.getInput("working-directory") || ".";
  const appName = core.getInput("app-name", { required: true });
  const entrypoint = core.getInput("entrypoint") || "app.cjs";
  const extraFiles = splitList(core.getInput("extra-files"));
  const restartPolicy = core.getInput("restart-policy") || "onFailure";
  const endpoint = (core.getInput("ipfs-endpoint") || process.env.ACURAST_IPFS_URL || DEFAULT_IPFS_ENDPOINT).replace(/\/+$/u, "");
  const apiKey = (process.env.ACURAST_IPFS_API_KEY || "").trim();

  const distDir = path.resolve(workingDir, "dist");
  const manifestPath = path.resolve(workingDir, core.getInput("manifest-name") || `${appName}-script-manifest.json`);

  // Acurast deploy zip: manifest.json + entrypoint + extra files (deterministic times).
  const zip = new AdmZip();
  const fixedTime = new Date("1980-01-01T00:00:00.000Z");
  zip.addFile("manifest.json", Buffer.from(JSON.stringify({ name: appName, version: 1, entrypoint, restartPolicy }), "utf8"));
  zip.addFile(entrypoint, await readFile(path.join(distDir, entrypoint)));
  for (const file of extraFiles) {
    if (file === entrypoint) continue;
    zip.addFile(file, await readFile(path.join(distDir, file)));
  }
  for (const entry of zip.getEntries()) entry.header.time = fixedTime;
  const zipBuffer = zip.toBuffer();
  const artifactSha256 = createHash("sha256").update(zipBuffer).digest("hex");

  // Direct upload (Pinata-style multipart) to the Acurast IPFS proxy.
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(zipBuffer)], { type: "application/zip" }), "script.js");
  form.append("pinataOptions", JSON.stringify({ cidVersion: 0 }));
  form.append("pinataMetadata", JSON.stringify({ name: "script.js" }));

  const response = await fetch(`${endpoint}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : undefined,
    body: form
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`IPFS upload failed (${response.status}): ${redact(text)}`);
  const cid = parseCid(text);
  if (!cid) throw new Error(`IPFS upload response missing IpfsHash: ${redact(text)}`);
  const scriptIpfs = `ipfs://${cid}`;

  const manifest = {
    version: 1,
    kind: `${appName}-script`,
    scriptIpfs,
    scriptHash: `sha256:${artifactSha256}`,
    bundleSha256: artifactSha256,
    generatedAt: new Date().toISOString(),
    artifact: { format: "acurast-zip", entrypoint },
    source: {
      repository: process.env.GITHUB_REPOSITORY,
      workflow: process.env.GITHUB_WORKFLOW,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT
    }
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  core.setOutput("cid", scriptIpfs);
  core.setOutput("digest", `sha256:${artifactSha256}`);
  core.setOutput("manifest-path", manifestPath);
  core.info(`Pinned ${appName}: ${scriptIpfs} (sha256:${artifactSha256})`);
}

function splitList(value: string): string[] {
  return value.split(/[\n,]+/u).map((s) => s.trim()).filter(Boolean);
}

function parseCid(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as { IpfsHash?: unknown; Hash?: unknown };
    const value = typeof parsed.IpfsHash === "string" ? parsed.IpfsHash : typeof parsed.Hash === "string" ? parsed.Hash : undefined;
    return value && /^[A-Za-z0-9]+$/u.test(value) ? value : undefined;
  } catch {
    const cid = text.match(/\bQm[1-9A-HJ-NP-Za-km-z]{44}\b/u)?.[0] ?? text.match(/\bbafy[A-Za-z0-9]+\b/u)?.[0];
    return cid && /^[A-Za-z0-9]+$/u.test(cid) ? cid : undefined;
  }
}

function redact(value: string): string {
  return value.replace(/[A-Za-z0-9_-]{24,}/gu, "[redacted]").slice(0, 400);
}

run().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
