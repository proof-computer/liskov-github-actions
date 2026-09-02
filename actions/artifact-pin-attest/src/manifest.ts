import { requireValidPolicyManifest } from "../../shared/src/policy-contract.js";

export interface V4ArtifactPinBindings {
  readonly kind: "v4";
  readonly authoredDigest: string;
  readonly releaseIntentDigest: string;
  readonly encryptionMode: "none" | "aes-256-gcm-bundle-v1";
}

export interface RegisteredSourceArtifactBindings {
  readonly kind: "registered-source";
}

export type ArtifactPinBindings = V4ArtifactPinBindings | RegisteredSourceArtifactBindings;

export function artifactPinBindings(
  manifest: Record<string, unknown>,
  applicationId: string
): ArtifactPinBindings {
  const result = requireValidPolicyManifest(manifest);
  const document = result.document!;
  if (document.applicationId !== applicationId) {
    throw new Error(`authored manifest applicationId must be ${applicationId}`);
  }
  const release = recordField(document, "release");
  if (release.mode === "source") {
    const runtime = recordField(document, "runtime");
    if (runtime.kind !== "javascript") {
      throw new Error("the registered IPFS artifact workflow currently requires runtime.kind javascript");
    }
    return { kind: "registered-source" };
  }
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

  return {
    kind: "v4",
    authoredDigest: result.authoredDigest!,
    releaseIntentDigest: result.releaseIntentDigest!,
    encryptionMode: "none"
  };
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
