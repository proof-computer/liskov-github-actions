// Bundle each JS action's src/index.ts into a self-contained dist/index.js
// (the node20 Actions runtime has no deps installed, so @actions/core + adm-zip
// must be bundled in). dist/ is committed; ci.yml re-runs this and fails if the
// committed dist drifts from source.

import path from "node:path";
import { build } from "esbuild";

const JS_ACTIONS = ["ipfs-pin", "artifact-pin-attest", "marketplace-ingest"];

for (const action of JS_ACTIONS) {
  // Emit .cjs so Node always treats the bundle as CommonJS — the repo root
  // package.json is `type: module`, which would otherwise make a `.js` CJS bundle
  // fail with "require is not defined in ES module scope".
  await build({
    entryPoints: [path.join("actions", action, "src", "index.ts")],
    outfile: path.join("actions", action, "dist", "index.cjs"),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    minify: false,
    sourcemap: false,
    legalComments: "none"
  });
  console.log(`built actions/${action}/dist/index.cjs`);
}
