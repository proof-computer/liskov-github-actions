// Upload exact artifact bytes with a Liskov-issued token by default, or to an
// explicitly selected proxy, then write a script manifest. Requires
// permissions: id-token: write for the Liskov path.

import * as core from "@actions/core";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { runIpfsPin } from "./runtime.js";
import { DEFAULT_LISKOV_URL, DEFAULT_UPLOAD_AUDIENCE } from "./liskov-upload.js";

async function run(): Promise<void> {
  const workingDir = core.getInput("working-directory") || ".";
  const appName = core.getInput("app-name", { required: true });
  const entrypoint = core.getInput("entrypoint") || "app.cjs";
  const extraFiles = splitList(core.getInput("extra-files"));
  const restartPolicy = core.getInput("restart-policy") || "onFailure";
  const endpoint = core.getInput("ipfs-endpoint").trim().replace(/\/+$/u, "");
  const apiKey = (process.env.LISKOV_IPFS_API_KEY || "").trim();
  const encryptionMode = core.getInput("encryption-mode") || "none";
  const encryptionKey = process.env.LISKOV_CODE_ENCRYPTION_KEY;
  if (encryptionKey) core.setSecret(encryptionKey);
  const result = await runIpfsPin({
    workingDirectory: workingDir,
    appName,
    entrypoint,
    extraFiles,
    restartPolicy,
    endpoint,
    apiKey,
    organizationId: optionalInput("organization-id"),
    liskovUrl: core.getInput("liskov-url") || DEFAULT_LISKOV_URL,
    audience: core.getInput("audience") || DEFAULT_UPLOAD_AUDIENCE,
    authoredManifestPath: optionalInput("authored-manifest-path"),
    artifactPath: optionalInput("artifact-path"),
    metadataPath: optionalInput("metadata-path"),
    scriptIpfs: optionalInput("script-ipfs"),
    gatewayUrl: optionalInput("gateway-url"),
    manifestName: optionalInput("manifest-name"),
    encryptionMode, encryptionKey, encryptionSecretId: optionalInput("encryption-secret-id")
  }, {
    fetchImpl: fetch, now: () => new Date(), environment: process.env,
    repositoryRoot: path.resolve(process.env.GITHUB_WORKSPACE || "."),
    getIdToken: (audience) => core.getIDToken(audience),
    maskSecret: (token) => core.setSecret(token),
    encryptedCodeLoader: encryptionMode === "none" ? undefined
      : await readFile(path.join(__dirname, "encrypted-loader.cjs"))
  });

  core.setOutput("cid", result.scriptIpfs);
  core.setOutput("digest", result.digest);
  core.setOutput("manifest-path", result.manifestPath);
  core.setOutput("upload-performed", String(result.uploadPerformed));
  core.setOutput("upload-id", result.uploadId);
  core.setOutput("upload-path", result.uploadPath);
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
