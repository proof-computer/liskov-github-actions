// Public bootstrap only. The build embeds the exact pinned SDK, never app code.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { bootstrapSlipwayRuntime } from "@proof-computer/liskov-runtime";
import { startEncryptedApplication } from "@proof-computer/liskov-runtime/encrypted-code";

async function run(): Promise<void> {
  const descriptor = JSON.parse(await readFile(path.join(__dirname, "encrypted-code.json"), "utf8"));
  // Acurast grants filesystem access to the job directory, not the device
  // HOME or a global /tmp. Keep runtime files inside this immutable bundle
  // directory; the SDK creates fresh private module directories below it.
  const runtime = await bootstrapSlipwayRuntime({ home: path.join(__dirname, ".liskov"), bootstrap: { mode: "signed" }, secrets: { mode: "required" },
    component: "encrypted-application" });
  try {
    await startEncryptedApplication({ runtime, descriptor, ciphertextPath: path.join(__dirname, "encrypted-code.bin") });
  } catch {
    runtime.stop();
    process.exitCode = 1;
  }
}

void run().catch(() => { console.error("encrypted_code_bootstrap_failed"); process.exitCode = 1; });
