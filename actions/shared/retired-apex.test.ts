import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/** The flat apex was withdrawn by BKLG-20260822-84f5 — its Cloudflare record was
 *  removed, so a request to it fails at DNS with `fetch failed` rather than
 *  returning an HTTP error a caller could read. Every default in this repo must
 *  name the live control-plane hostname instead. */
const RETIRED_APEX = "https://liskov.proof.computer";
const ROOTS = ["actions", ".github/workflows"];
const SKIP_DIRS = new Set(["node_modules", "dist"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|yml|yaml|json)$/.test(entry)) out.push(path);
  }
  return out;
}

test("no action or workflow points at the retired apex", () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      if (file.endsWith("retired-apex.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      // `api.liskov.proof.computer` contains the apex as a suffix, so match the
      // scheme-anchored form only.
      if (text.includes(RETIRED_APEX)) offenders.push(file);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these still name the withdrawn apex; use https://api.liskov.proof.computer:\n${offenders.join("\n")}`
  );
});
