import assert from "node:assert/strict";
import { test } from "node:test";

import { artifactProvenanceFromOidcToken } from "./oidc.js";

test("artifact provenance uses the claims the server will verify", () => {
  const claims = {
    repository: "proof-computer/offering",
    ref: "refs/heads/main",
    sha: "a".repeat(40),
    workflow_ref: "proof-computer/caller/.github/workflows/app.yml@refs/heads/main"
  };
  const token = `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;

  assert.deepEqual(artifactProvenanceFromOidcToken(token), {
    repository: claims.repository,
    ref: claims.ref,
    sha: claims.sha,
    workflowRef: claims.workflow_ref
  });
});

test("artifact provenance fails closed when a binding claim is absent", () => {
  const token = `header.${Buffer.from("{}").toString("base64url")}.signature`;
  assert.throws(() => artifactProvenanceFromOidcToken(token), /missing repository/u);
});
