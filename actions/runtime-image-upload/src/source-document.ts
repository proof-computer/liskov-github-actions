// The V5 source document a runtime-image upload session binds to
// (BKLG-20261008-v5rb). The action validates the document in the checkout with
// the bundled policy client before it mints a token, so a document the server
// would refuse costs no OIDC round trip and no scoped Tigris session.

import {
  requireValidPolicyManifest,
  supportsRegisteredSourcePublication
} from "../../shared/src/policy-contract.js";

export interface RuntimeImageSourceDocument {
  manifestPath: string;
  document: Record<string, unknown>;
  authoredDigest: string;
}

export async function loadRuntimeImageSourceDocument(
  manifestPath: string,
  applicationId: string,
  readFile: (path: string) => Promise<string>
): Promise<RuntimeImageSourceDocument> {
  const safePath = repositoryPath(manifestPath);
  const refuse = (pointer: string, message: string): Error =>
    new Error(`V5 source document ${safePath} ${pointer}: ${message}`);

  let text: string;
  try {
    text = await readFile(safePath);
  } catch (error) {
    throw new Error(
      `could not read V5 source document ${safePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  let authored: unknown;
  try {
    authored = JSON.parse(text);
  } catch (error) {
    throw refuse("/", `is not JSON (${error instanceof Error ? error.message : String(error)})`);
  }
  if (authored === null || typeof authored !== "object" || Array.isArray(authored)) {
    throw refuse("/", "must be a JSON object");
  }

  let result: ReturnType<typeof requireValidPolicyManifest>;
  try {
    result = requireValidPolicyManifest(authored);
  } catch (error) {
    // The policy client's message already reads `<code> <pointer>: <message>`.
    throw new Error(
      `V5 source document ${safePath} is invalid: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const document = result.document!;
  if (!supportsRegisteredSourcePublication(result)) {
    throw refuse(
      "/schemaVersion",
      `${String(result.pair?.schema)} version ${String(result.pair?.schemaVersion)} is not registered for source publication`
    );
  }
  if (document.applicationId !== applicationId) {
    throw refuse("/applicationId", `must be ${applicationId}`);
  }
  if (objectField(document, "release")?.mode !== "source") {
    throw refuse(
      "/release/mode",
      "must be source; a pinned release names an artifact, it does not build one"
    );
  }
  if (objectField(document, "runtime")?.kind !== "native_image") {
    throw refuse("/runtime/kind", "must be native_image");
  }
  const authoredDigest = result.authoredDigest;
  if (typeof authoredDigest !== "string" || !/^[0-9a-f]{64}$/u.test(authoredDigest)) {
    throw refuse("/", "the policy client returned no authored digest");
  }

  return {
    manifestPath: safePath,
    // The exact authored object is what the server digests; it is sent as read.
    document: authored as Record<string, unknown>,
    authoredDigest
  };
}

function repositoryPath(value: string): string {
  const candidate = value.trim();
  if (
    candidate.length === 0
    || candidate.length > 512
    || /[\\\r\n\u0000]/u.test(candidate)
    || candidate.startsWith("/")
    || candidate.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error("manifest-path must be a safe repository-relative path");
  }
  return candidate;
}

function objectField(
  record: Record<string, unknown>,
  field: string
): Record<string, unknown> | undefined {
  const value = record[field];
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
