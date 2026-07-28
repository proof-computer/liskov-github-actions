import { createReadStream } from "node:fs";

import * as core from "@actions/core";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import {
  inspectRuntimeImage,
  uploadRuntimeImage,
  type RuntimeImageS3Upload,
  type RuntimeImageUploadInputs
} from "./runtime.js";

async function run(): Promise<void> {
  const inputs: RuntimeImageUploadInputs = {
    applicationId: core.getInput("application-id", { required: true }),
    imagePath: core.getInput("image-path", { required: true }),
    authoredDigest: core.getInput("authored-digest", { required: true }),
    releaseIntentDigest: core.getInput("release-intent-digest", { required: true }),
    expectedSha256: core.getInput("expected-sha256"),
    sourceImageUrl: core.getInput("source-image-url"),
    liskovUrl: core.getInput("liskov-url") || "https://liskov.proof.computer",
    audience: core.getInput("audience") || "liskov-runtime-image-upload"
  };
  const outputs = await uploadRuntimeImage(inputs, {
    inspectImage: inspectRuntimeImage,
    getOidcToken: (audience) => core.getIDToken(audience),
    postJson,
    putObject,
    mask: (value) => core.setSecret(value),
    environment: process.env
  });
  for (const [name, value] of Object.entries(outputs)) {
    core.setOutput(name, value);
  }
  core.info(
    `Finalized runtime image ${outputs["image-digest"]} as ${outputs["artifact-version-id"]}`
  );
}

async function postJson(url: string, token: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  let parsed: unknown;
  try {
    parsed = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`Liskov request failed with HTTP ${response.status} and a non-JSON response`);
  }
  if (!response.ok) {
    const responseRecord =
      parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    const code =
      typeof responseRecord.error === "string" && /^[A-Za-z0-9_.-]+$/u.test(responseRecord.error)
        ? ` (${responseRecord.error})`
        : "";
    throw new Error(`Liskov request failed with HTTP ${response.status}${code}`);
  }
  return parsed;
}

async function putObject(upload: RuntimeImageS3Upload): Promise<void> {
  const client = new S3Client({
    endpoint: upload.endpointUrl,
    region: upload.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: upload.accessKeyId,
      secretAccessKey: upload.secretAccessKey
    }
  });
  try {
    await client.send(new PutObjectCommand({
      Bucket: upload.bucket,
      Key: upload.objectKey,
      Body: createReadStream(upload.imagePath),
      ContentLength: upload.byteSize,
      Metadata: { sha256: upload.digest }
    }));
  } finally {
    client.destroy();
  }
}

run().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
