import { createCipheriv, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { ENCRYPTED_CODE_DOMAIN, encryptedCodeAad, MAX_ENCRYPTED_CODE_BYTES,
  parseEncryptedCodeDescriptor, type EncryptedCodeDescriptor } from "@proof-computer/liskov-runtime/encrypted-code";
import type { IpfsPinInputs } from "./runtime.js";

export const ENCRYPTED_CODE_MODE = "aes-256-gcm-payload-v1";

export async function encryptedCodeZip(root: string, inputs: IpfsPinInputs, loader: Uint8Array, iv: Uint8Array): Promise<{
  bytes: Buffer; descriptor: EncryptedCodeDescriptor;
}> {
  if (!/^[a-zA-Z0-9_-]+\.cjs$/u.test(inputs.entrypoint)
    || inputs.extraFiles.length > 0 || inputs.artifactPath || inputs.metadataPath || inputs.scriptIpfs) {
    throw new Error("encrypted code requires a single self-contained .cjs entrypoint and no extras, prepared artifact, metadata or reused CID");
  }
  if (inputs.restartPolicy !== "no" && inputs.restartPolicy !== "onFailure") {
    throw new Error("restart-policy must be no or onFailure");
  }
  const key = Buffer.from(inputs.encryptionKey ?? "", "base64");
  if (key.length !== 32 || key.toString("base64") !== inputs.encryptionKey) {
    throw new Error("LISKOV_CODE_ENCRYPTION_KEY must be canonical base64 of 32 bytes");
  }
  if (iv.length !== 12 || loader.length === 0) throw new Error("encrypted code loader or nonce is missing");
  const plaintext = await readFile(path.join(root, "dist", inputs.entrypoint));
  try {
    if (plaintext.length === 0 || plaintext.length > MAX_ENCRYPTED_CODE_BYTES) {
      throw new Error("encrypted code must contain 1 to 16777216 bytes");
    }
    const descriptor: EncryptedCodeDescriptor = {
      domain: ENCRYPTED_CODE_DOMAIN, algorithm: "aes-256-gcm", keySecretId: inputs.encryptionSecretId ?? "",
      iv: Buffer.from(iv).toString("base64"), authTag: Buffer.alloc(16).toString("base64"),
      plaintextDigest: sha256(plaintext), ciphertextDigest: `sha256:${"0".repeat(64)}`
    };
    parseEncryptedCodeDescriptor(descriptor);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(encryptedCodeAad(descriptor));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    descriptor.authTag = cipher.getAuthTag().toString("base64");
    descriptor.ciphertextDigest = sha256(ciphertext);
    parseEncryptedCodeDescriptor(descriptor);
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from(JSON.stringify({ name: inputs.appName, version: 1,
      entrypoint: inputs.entrypoint, restartPolicy: inputs.restartPolicy })));
    zip.addFile(inputs.entrypoint, Buffer.from(loader));
    zip.addFile("encrypted-code.json", Buffer.from(JSON.stringify(descriptor)));
    zip.addFile("encrypted-code.bin", ciphertext);
    for (const entry of zip.getEntries()) entry.header.time = new Date("1980-01-01T00:00:00.000Z");
    return { bytes: zip.toBuffer(), descriptor };
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
