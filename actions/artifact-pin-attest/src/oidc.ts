export interface ArtifactOidcProvenance {
  repository: string;
  ref: string;
  sha: string;
  workflowRef: string;
}

export function artifactProvenanceFromOidcToken(token: string): ArtifactOidcProvenance {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("GitHub OIDC token is not a JWT");
  }
  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("GitHub OIDC token payload is invalid");
  }
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
    throw new Error("GitHub OIDC token payload must be an object");
  }
  const record = claims as Record<string, unknown>;
  return {
    repository: requiredClaim(record, "repository"),
    ref: requiredClaim(record, "ref"),
    sha: requiredClaim(record, "sha"),
    workflowRef: requiredClaim(record, "workflow_ref")
  };
}

function requiredClaim(claims: Record<string, unknown>, name: string): string {
  const value = claims[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`GitHub OIDC token is missing ${name}`);
  }
  return value;
}
