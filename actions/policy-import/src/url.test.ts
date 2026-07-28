import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePolicyImportUrl } from "./url.js";

describe("policy-import URL resolution", () => {
  it("prefers an explicit import URL over the base and environment", () => {
    assert.equal(resolvePolicyImportUrl({
      applicationId: "app/name",
      importUrl: "https://import.test/{applicationId}",
      liskovUrl: "https://base.test",
      environmentUrl: "https://environment.test/{applicationId}"
    }), "https://import.test/app%2Fname");
  });

  it("uses liskov-url as the shared custom endpoint before the environment override", () => {
    assert.equal(resolvePolicyImportUrl({
      applicationId: "app",
      liskovUrl: "https://liskov.test/custom/",
      environmentUrl: "https://environment.test/{applicationId}"
    }), "https://liskov.test/custom/api/applications/app/policy-imports/github");
  });
});
