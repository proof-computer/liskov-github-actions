// Build the Acurast deploy zip from dist/ and pin it (no-spend, "direct" path) to
// the Acurast IPFS proxy, then write a script manifest. Ported from
// liskov-diagnostic/scripts/upload-ipfs.ts (the mnemonic/CLI + devtools paths are
// intentionally excluded — keep spend-capable upload out of the reusable surface).

import * as core from "@actions/core";

import { runIpfsPin } from "./runtime.js";

const DEFAULT_IPFS_ENDPOINT = "https://ipfs-proxy.acurast.prod.gke.papers.tech";

async function run(): Promise<void> {
  const workingDir = core.getInput("working-directory") || ".";
  const appName = core.getInput("app-name", { required: true });
  const entrypoint = core.getInput("entrypoint") || "app.cjs";
  const extraFiles = splitList(core.getInput("extra-files"));
  const restartPolicy = core.getInput("restart-policy") || "onFailure";
  const endpoint = (core.getInput("ipfs-endpoint") || process.env.ACURAST_IPFS_URL || DEFAULT_IPFS_ENDPOINT).replace(/\/+$/u, "");
  const apiKey = (process.env.ACURAST_IPFS_API_KEY || "").trim();
  const result = await runIpfsPin({
    workingDirectory: workingDir,
    appName,
    entrypoint,
    extraFiles,
    restartPolicy,
    endpoint,
    apiKey,
    artifactPath: optionalInput("artifact-path"),
    metadataPath: optionalInput("metadata-path"),
    scriptIpfs: optionalInput("script-ipfs"),
    gatewayUrl: optionalInput("gateway-url"),
    manifestName: optionalInput("manifest-name")
  });

  core.setOutput("cid", result.scriptIpfs);
  core.setOutput("digest", result.digest);
  core.setOutput("manifest-path", result.manifestPath);
  core.setOutput("upload-performed", String(result.uploadPerformed));
  core.info(
    `${result.uploadPerformed ? "Pinned" : "Reused"} ${appName}: `
      + `${result.scriptIpfs} (${result.digest})`
  );
}

function splitList(value: string): string[] {
  return value.split(/[\n,]+/u).map((s) => s.trim()).filter(Boolean);
}

function optionalInput(name: string): string | undefined {
  const value = core.getInput(name).trim();
  return value || undefined;
}

run().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
