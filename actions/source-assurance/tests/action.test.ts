import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { it } from "node:test";

import { parse } from "yaml";

it("emits a committed Cargo SBOM path and HEAD tree digest, rejecting stale or uncommitted bytes", () => {
  const actionPath = fileURLToPath(new URL("../", import.meta.url));
  const action = parse(readFileSync(join(actionPath, "action.yml"), "utf8"));
  for (const output of ["source-digest", "sbom-path"]) {
    assert.equal(action.outputs[output].value, `\${{ steps.assure.outputs.${output} }}`);
  }
  const root = mkdtempSync(join(tmpdir(), "liskov-source-assurance-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  try {
    git("init", "--quiet");
    git("config", "user.name", "Source assurance test");
    git("config", "user.email", "test@example.invalid");
    const lock = 'version = 4\n[[package]]\nname = "app"\nversion = "0.1.0"\n';
    writeFileSync(join(root, "Cargo.lock"), lock);
    execFileSync("python3", [join(actionPath, "sbom.py"), "--directory", root]);
    mkdirSync(join(root, "nested app"));
    writeFileSync(join(root, "nested app", "Cargo.lock"), lock);
    execFileSync("python3", [join(actionPath, "sbom.py"), "--directory", join(root, "nested app"),
      "--out", "inventory.json"]);
    git("add", "Cargo.lock", "sbom.cdx.json", "nested app/Cargo.lock", "nested app/inventory.json");
    git("commit", "--quiet", "-m", "Fixture");
    const output = join(root, "outputs");
    const run = (directory = ".", sbomPath = "sbom.cdx.json") => {
      writeFileSync(output, "");
      return spawnSync("bash", ["-c", action.runs.steps[0].run], {
        cwd: root, encoding: "utf8",
        env: { ...process.env, GITHUB_ACTION_PATH: actionPath,
          LISKOV_WORKING_DIRECTORY: directory, LISKOV_SBOM_PATH: sbomPath,
          GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: join(root, "summary") }
      });
    };
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, "utf8"),
      `source-digest=git-tree:${git("rev-parse", "HEAD^{tree}")}\nsbom-path=sbom.cdx.json\n`);
    const nested = run("./nested app/", "inventory.json");
    assert.equal(nested.status, 0, nested.stderr);
    assert.equal(readFileSync(output, "utf8"),
      `source-digest=git-tree:${git("rev-parse", "HEAD:nested app")}\nsbom-path=inventory.json\n`);
    writeFileSync(join(root, "Cargo.lock"), lock.replace("0.1.0", "0.2.0"));
    assert.equal(run().status, 1);
    assert.equal(readFileSync(output, "utf8"), "");
    git("add", "sbom.cdx.json");
    assert.equal(run().status, 1); // staged regeneration still differs from HEAD
    git("rm", "--cached", "--force", "sbom.cdx.json");
    const missing = run();
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /Commit .* before requesting source assurance/u);
    assert.equal(readFileSync(output, "utf8"), "");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
