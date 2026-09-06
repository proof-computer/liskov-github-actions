import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const vector = JSON.parse(await readFile(new URL("../fixtures/encrypted-code-v1.json", import.meta.url), "utf8"));

test("public bootstrap loads encrypted code within the processor's job filesystem permission", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "encrypted-permission-"));
  try {
    await writeFile(path.join(root, "encrypted-code.json"), JSON.stringify(vector.descriptor));
    await writeFile(path.join(root, "encrypted-code.bin"), Buffer.from(vector.ciphertext, "base64"));
    // Replace only network/bootstrap setup. The public action entrypoint and
    // pinned SDK's actual encrypted loader run unchanged under Node permission.
    const bootstrap = `export async function bootstrapSlipwayRuntime(options) {
      const secret = {secretId: "application-code-key", name: "LISKOV_CODE_KEY", versionId: "test-version", target: "env"};
      return {
        home: options.home ?? process.env.HOME + "/.slipway",
        whenReady: async () => {}, stop: () => {},
        status: () => ({applicationUid: "test-app", deploymentId: "test-job"}),
        lockbox: {installed: {env: [secret]}, response: {applicationUid: "test-app", deploymentId: "test-job", secretVersions: [secret]}},
        env: {require: () => ${JSON.stringify(vector.key)}},
        diagnostics: {report: async e => console.log(e.stage), fatal: async e => console.log(e.code)},
        log: async message => console.log(message)
      };
    }`;
    await build({
      entryPoints: [fileURLToPath(new URL("./encrypted-loader.ts", import.meta.url))],
      outfile: path.join(root, "loader.cjs"), bundle: true, platform: "node", format: "cjs", target: "node22",
      plugins: [{name: "authenticated-bootstrap-fixture", setup(builder) {
        builder.onResolve({filter: /^@proof-computer\/liskov-runtime$/}, () => ({path: "bootstrap", namespace: "fixture"}));
        builder.onLoad({filter: /.*/, namespace: "fixture"}, () => ({contents: bootstrap, loader: "js"}));
      }}]
    });
    const child = spawnSync(process.execPath, ["--permission", `--allow-fs-read=${root}`, `--allow-fs-write=${root}`,
      path.join(root, "loader.cjs")], {encoding: "utf8", cwd: root, env: {...process.env, HOME: "/unavailable-processor-home"}});
    assert.equal(child.status, 0, child.stdout + child.stderr);
    assert.deepEqual(child.stdout.trim().split("\n"), ["application.encrypted_code.loaded", "encrypted-canary"]);
    assert.deepEqual(await readdir(path.join(root, ".liskov")), []);
    assert.equal(child.stdout.includes(vector.key), false);
  } finally { await rm(root, {recursive: true, force: true}); }
});
