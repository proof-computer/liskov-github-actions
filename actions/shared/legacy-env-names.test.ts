import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/** BKLG-20261002-u1rc: every environment name is LISKOV_*, with no alias and no
 *  fallback. The IPFS endpoint is the `ipfs-endpoint` input (it is not a
 *  secret), its key is LISKOV_IPFS_API_KEY, and the artifact-pin URL override is
 *  LISKOV_ARTIFACT_PIN_URL. These spellings shipped only in v1. */
const LEGACY_NAMES = ["ACURAST_IPFS_URL", "ACURAST_IPFS_API_KEY", "SLIPWAY_ARTIFACT_PIN_URL"];
const ROOTS = ["actions", ".github/workflows"];
const SKIP_DIRS = new Set(["node_modules", "dist"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

test("no action or workflow names a retired v1 environment name", () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      if (file.endsWith("legacy-env-names.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const name of LEGACY_NAMES) {
        if (text.includes(name)) offenders.push(`${file}: ${name}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these still name a retired v1 name; use ipfs-endpoint, LISKOV_IPFS_API_KEY or LISKOV_ARTIFACT_PIN_URL:\n${offenders.join("\n")}`
  );
});
