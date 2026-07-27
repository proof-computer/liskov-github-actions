import { createHash } from "node:crypto";

export interface ArtifactPinBindings {
  readonly authoredDigest: string;
  readonly releaseIntentDigest: string;
  readonly encryptionMode: "none" | "aes-256-gcm-bundle-v1";
}

export function artifactPinBindings(
  manifest: Record<string, unknown>,
  applicationId: string
): ArtifactPinBindings {
  if (
    manifest.schema !== "proof.liskov.application-manifest"
    || manifest.schemaVersion !== 4
  ) {
    throw new Error("authored manifest must declare proof.liskov.application-manifest v4");
  }
  if (manifest.applicationId !== applicationId) {
    throw new Error(`authored manifest applicationId must be ${applicationId}`);
  }
  const release = recordField(manifest, "release");
  if (release.mode !== "build") {
    throw new Error("artifact pins require an authored build release");
  }
  const artifact = recordField(release, "artifact");
  if (artifact.kind !== "ipfs_bundle") {
    throw new Error("IPFS artifact pins require a build release with kind ipfs_bundle");
  }
  const encryption = recordField(artifact, "encryption");
  if (encryption.mode !== "none") {
    throw new Error(
      "the reusable ipfs-pin action produces unencrypted bundles; the build release must require encryption mode none"
    );
  }

  const normalizedRelease = structuredClone(release);
  const builder = recordField(normalizedRelease, "builder");
  if (!Array.isArray(builder.allowedRefs)) {
    throw new Error("GitHub builder allowedRefs must be an array");
  }
  builder.allowedRefs = [...builder.allowedRefs].sort();

  return {
    authoredDigest: canonicalDigest(manifest),
    releaseIntentDigest: canonicalDigest({
      schema: "proof.liskov.release-intent",
      schemaVersion: 4,
      applicationId,
      release: normalizedRelease
    }),
    encryptionMode: "none"
  };
}

export function canonicalDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("value is not canonical JSON");
  return serialized;
}

function recordField(
  record: Record<string, unknown>,
  field: string
): Record<string, unknown> {
  const value = record[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}
