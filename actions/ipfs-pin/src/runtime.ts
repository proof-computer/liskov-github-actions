import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import AdmZip from "adm-zip";
import { encryptedCodeZip, ENCRYPTED_CODE_MODE } from "./encrypted-code.js";
import { DEFAULT_LISKOV_URL, DEFAULT_UPLOAD_AUDIENCE, requestUploadIntent } from "./liskov-upload.js";
import { requireValidPolicyManifest } from "../../shared/src/policy-contract.js";

import {
  safeRelativeArtifactPath,
  sanitizeDiagnosticMetadata,
  type JsonRecord
} from "../../shared/src/diagnostics.js";

export interface IpfsPinInputs {
  readonly workingDirectory: string;
  readonly appName: string;
  readonly entrypoint: string;
  readonly extraFiles: readonly string[];
  readonly restartPolicy: string;
  readonly endpoint: string;
  readonly apiKey: string;
  readonly organizationId?: string;
  readonly liskovUrl?: string;
  readonly audience?: string;
  readonly authoredManifestPath?: string;
  readonly artifactPath?: string;
  readonly metadataPath?: string;
  readonly scriptIpfs?: string;
  readonly gatewayUrl?: string;
  readonly manifestName?: string;
  readonly encryptionMode?: string;
  readonly encryptionSecretId?: string;
  readonly encryptionKey?: string;
}

export interface IpfsPinDependencies {
  readonly fetchImpl: typeof fetch;
  readonly now: () => Date;
  readonly environment: NodeJS.ProcessEnv;
  readonly repositoryRoot?: string;
  readonly getIdToken?: (audience: string) => Promise<string>;
  readonly maskSecret?: (secret: string) => void;
  readonly encryptedCodeLoader?: Uint8Array;
  readonly randomBytes?: (size: number) => Uint8Array;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

export interface IpfsPinResult {
  readonly scriptIpfs: string;
  readonly digest: string;
  readonly manifestPath: string;
  readonly uploadPerformed: boolean;
  readonly uploadId: string;
  readonly uploadPath: "liskov" | "proxy" | "reused";
  readonly manifest: JsonRecord;
}

const DEFAULT_DEPENDENCIES: IpfsPinDependencies = {
  fetchImpl: fetch,
  now: () => new Date(),
  environment: process.env,
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
};

const GATEWAY_ATTEMPTS = 4;
const GATEWAY_RETRY_DELAY_MS = 10_000;

export async function runIpfsPin(
  inputs: IpfsPinInputs,
  dependencies: IpfsPinDependencies = DEFAULT_DEPENDENCIES
): Promise<IpfsPinResult> {
  const root = path.resolve(inputs.workingDirectory || ".");
  const mode = inputs.encryptionMode ?? "none";
  if (mode !== "none" && mode !== ENCRYPTED_CODE_MODE) throw new Error("unsupported code encryption mode");
  if (mode === "none" && (inputs.encryptionKey || inputs.encryptionSecretId)) {
    throw new Error("code encryption inputs require aes-256-gcm-payload-v1 mode");
  }
  const encrypted = mode === ENCRYPTED_CODE_MODE
    ? await encryptedCodeZip(root, inputs, dependencies.encryptedCodeLoader ?? new Uint8Array(),
      (dependencies.randomBytes ?? randomBytes)(12)) : undefined;
  const artifactBytes = encrypted?.bytes ?? (inputs.artifactPath
    ? await readFile(resolveWithin(root, inputs.artifactPath, "artifact-path"))
    : await generatedZip(root, inputs));
  const artifactSha256 = sha256(artifactBytes);

  const diagnostics = inputs.metadataPath
    ? sanitizeDiagnosticMetadata(
        JSON.parse(
          await readFile(resolveWithin(root, inputs.metadataPath, "metadata-path"), "utf8")
        ),
        `metadata ${inputs.metadataPath}`
      )
    : undefined;

  const suppliedCid = inputs.scriptIpfs?.trim();
  let scriptIpfs: string;
  let uploadId = "";
  let uploadPath: IpfsPinResult["uploadPath"];
  let gatewayUrl = inputs.gatewayUrl?.trim();
  if (suppliedCid) {
    scriptIpfs = validateScriptIpfs(suppliedCid);
    uploadPath = "reused";
  } else if (inputs.endpoint.trim()) {
    scriptIpfs = await uploadArtifact(artifactBytes, inputs, dependencies.fetchImpl, "proxy");
    uploadPath = "proxy";
  } else {
    let manifestDigest = `sha256:${artifactSha256}`;
    if (inputs.authoredManifestPath?.trim()) {
      const manifestPath = resolveWithin(dependencies.repositoryRoot ?? root,
        inputs.authoredManifestPath, "authored-manifest-path");
      const evaluated = requireValidPolicyManifest(JSON.parse(await readFile(manifestPath, "utf8")));
      if (evaluated.authoredDigest === undefined) throw new Error("authored manifest digest is missing");
      manifestDigest = `sha256:${evaluated.authoredDigest}`;
    }
    if (dependencies.getIdToken === undefined) throw new Error("Liskov uploads require a GitHub OIDC token provider");
    const intent = await requestUploadIntent({
      liskovUrl: inputs.liskovUrl ?? DEFAULT_LISKOV_URL,
      organizationId: inputs.organizationId ?? "",
      applicationId: inputs.appName,
      audience: inputs.audience ?? DEFAULT_UPLOAD_AUDIENCE,
      sha256: artifactSha256,
      byteSize: artifactBytes.length,
      manifestDigest,
      encryptionMode: mode
    }, { getIdToken: dependencies.getIdToken, fetchImpl: dependencies.fetchImpl });
    dependencies.maskSecret?.(intent.token);
    scriptIpfs = await uploadArtifact(artifactBytes, {
      endpoint: intent.upload.url.slice(0, -"/pinning/pinFileToIPFS".length),
      apiKey: intent.token
    }, dependencies.fetchImpl, "liskov");
    uploadId = intent.uploadId;
    uploadPath = "liskov";
    gatewayUrl ||= intent.gatewayUrlTemplate;
  }
  const uploadPerformed = !suppliedCid;

  if (gatewayUrl) {
    await verifyGatewayBytes(
      artifactBytes,
      scriptIpfs,
      gatewayUrl,
      dependencies.fetchImpl,
      dependencies.sleep
    );
  }

  const metadataArtifact = diagnostics?.artifact;
  const metadataArtifactRecord = metadataArtifact
    && typeof metadataArtifact === "object"
    && !Array.isArray(metadataArtifact)
      ? metadataArtifact as JsonRecord
      : undefined;
  const artifact = {
    format: metadataArtifactRecord?.format ?? "acurast-zip",
    entrypoint: metadataArtifactRecord?.entrypoint ?? inputs.entrypoint
  };
  const manifest: JsonRecord = {
    version: 1,
    kind: `${inputs.appName}-script`,
    scriptIpfs,
    scriptHash: `sha256:${artifactSha256}`,
    bundleSha256: artifactSha256,
    generatedAt: dependencies.now().toISOString(),
    artifact,
    source: {
      repository: dependencies.environment.GITHUB_REPOSITORY,
      workflow: dependencies.environment.GITHUB_WORKFLOW,
      runId: dependencies.environment.GITHUB_RUN_ID,
      runAttempt: dependencies.environment.GITHUB_RUN_ATTEMPT
    }
  };
  if (diagnostics) manifest.diagnostics = diagnostics;
  if (encrypted) manifest.encryptedCode = encrypted.descriptor;

  const manifestName = inputs.manifestName?.trim() || `${inputs.appName}-script-manifest.json`;
  const manifestPath = resolveWithin(root, manifestName, "manifest-name");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    scriptIpfs,
    digest: `sha256:${artifactSha256}`,
    manifestPath,
    uploadPerformed,
    uploadId,
    uploadPath,
    manifest
  };
}

async function generatedZip(root: string, inputs: IpfsPinInputs): Promise<Buffer> {
  const entrypoint = safeRelativeArtifactPath(inputs.entrypoint, "entrypoint");
  if (inputs.restartPolicy !== "no" && inputs.restartPolicy !== "onFailure") {
    throw new Error("restart-policy must be no or onFailure");
  }
  const distDir = path.join(root, "dist");
  const zip = new AdmZip();
  const fixedTime = new Date("1980-01-01T00:00:00.000Z");
  zip.addFile(
    "manifest.json",
    Buffer.from(JSON.stringify({
      name: inputs.appName,
      version: 1,
      entrypoint,
      restartPolicy: inputs.restartPolicy
    }), "utf8")
  );
  zip.addFile(entrypoint, await readFile(resolveWithin(distDir, entrypoint, "entrypoint")));
  for (const rawFile of inputs.extraFiles) {
    const file = safeRelativeArtifactPath(rawFile, "extra-files");
    if (file === entrypoint) continue;
    zip.addFile(file, await readFile(resolveWithin(distDir, file, "extra-files")));
  }
  for (const entry of zip.getEntries()) entry.header.time = fixedTime;
  return zip.toBuffer();
}

async function uploadArtifact(
  artifactBytes: Buffer,
  inputs: Pick<IpfsPinInputs, "endpoint" | "apiKey">,
  fetchImpl: typeof fetch,
  target: "proxy" | "liskov"
): Promise<string> {
  const endpoint = inputs.endpoint.replace(/\/+$/u, "");
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(artifactBytes)], { type: "application/zip" }),
    "script.js"
  );
  // The Acurast proxy is Pinata-compatible and takes these hints. The Liskov
  // upload service accepts exactly one `file` part and refuses any other field
  // (LIA4010); its token already fixes CIDv0.
  if (target === "proxy") {
    form.append("pinataOptions", JSON.stringify({ cidVersion: 0 }));
    form.append("pinataMetadata", JSON.stringify({ name: "script.js" }));
  }
  let response: Response;
  try {
    response = await fetchImpl(`${endpoint}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: inputs.apiKey ? { authorization: `Bearer ${inputs.apiKey}` } : undefined,
      body: form
    });
  } catch {
    throw new Error("IPFS upload request failed");
  }
  let text: string;
  try { text = await response.text(); } catch { throw new Error("IPFS upload response could not be read"); }
  const safeText = inputs.apiKey ? text.replaceAll(inputs.apiKey, "[redacted]") : text;
  if (!response.ok) throw new Error(`IPFS upload failed (${response.status}): ${redact(safeText)}`);
  const cid = parseCid(text);
  if (!cid) throw new Error(`IPFS upload response missing IpfsHash: ${redact(safeText)}`);
  return `ipfs://${cid}`;
}

async function verifyGatewayBytes(
  expected: Buffer,
  scriptIpfs: string,
  gatewayTemplate: string,
  fetchImpl: typeof fetch,
  sleep: IpfsPinDependencies["sleep"]
): Promise<void> {
  const cid = validateScriptIpfs(scriptIpfs).slice("ipfs://".length);
  const rendered = gatewayTemplate.replaceAll("{cid}", encodeURIComponent(cid));
  let url: URL;
  try {
    url = new URL(rendered);
  } catch {
    throw new Error("gateway-url must be an absolute HTTPS URL");
  }
  if (
    url.protocol !== "https:"
    || url.username.length > 0
    || url.password.length > 0
    || url.hash.length > 0
  ) {
    throw new Error("gateway-url must be a credential-free HTTPS URL without a fragment");
  }
  let finalError: Error | undefined;
  for (let attempt = 1; attempt <= GATEWAY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`IPFS gateway verification failed with HTTP ${response.status}`);
      }
      const observed = Buffer.from(await response.arrayBuffer());
      if (!expected.equals(observed)) {
        throw new Error(
          `IPFS gateway bytes mismatch: expected sha256:${sha256(expected)}, `
            + `got sha256:${sha256(observed)}`
        );
      }
      return;
    } catch (error) {
      finalError = error instanceof Error ? error : new Error(String(error));
      if (attempt < GATEWAY_ATTEMPTS) {
        await (sleep ?? DEFAULT_DEPENDENCIES.sleep)!(GATEWAY_RETRY_DELAY_MS);
      }
    }
  }
  throw new Error(
    `IPFS gateway verification failed after ${GATEWAY_ATTEMPTS} attempts: ${finalError?.message}`
  );
}

export function validateScriptIpfs(value: string): string {
  if (!/^ipfs:\/\/[A-Za-z0-9]+$/u.test(value)) {
    throw new Error("script-ipfs must be an exact ipfs:// CID URI");
  }
  return value;
}

export function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function resolveWithin(root: string, candidate: string, field: string): string {
  if (!candidate.trim()) throw new Error(`${field} must not be empty`);
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${field} must stay within working-directory`);
  }
  return resolved;
}

function parseCid(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as { IpfsHash?: unknown; Hash?: unknown };
    const value = typeof parsed.IpfsHash === "string"
      ? parsed.IpfsHash
      : typeof parsed.Hash === "string"
        ? parsed.Hash
        : undefined;
    return value && /^[A-Za-z0-9]+$/u.test(value) ? value : undefined;
  } catch {
    const cid = text.match(/\bQm[1-9A-HJ-NP-Za-km-z]{44}\b/u)?.[0]
      ?? text.match(/\bbafy[A-Za-z0-9]+\b/u)?.[0];
    return cid && /^[A-Za-z0-9]+$/u.test(cid) ? cid : undefined;
  }
}

function redact(value: string): string {
  return value.replace(/[A-Za-z0-9_-]{24,}/gu, "[redacted]").slice(0, 400);
}
