export type JsonRecord = Record<string, unknown>;

const TOP_LEVEL_FIELDS = new Set([
  "artifact",
  "devtools",
  "failure",
  "scenarioArtifact",
  "sourceBundleSha256"
]);

/**
 * Validate and copy only the Diagnostic artifact metadata accepted by Liskov's
 * existing per-repository publisher. This data is evidence, never authority:
 * repository/ref/SHA/workflow continue to come from the verified OIDC token.
 */
export function sanitizeDiagnosticMetadata(
  value: unknown,
  source = "diagnostic metadata"
): JsonRecord | undefined {
  if (value === undefined || value === null) return undefined;
  const input = exactRecord(value, source, TOP_LEVEL_FIELDS);
  const output: JsonRecord = {};

  if (input.devtools !== undefined) {
    const devtools = exactRecord(
      input.devtools,
      `${source}.devtools`,
      new Set(["enabled", "injected", "uploadMode"])
    );
    const sanitized: JsonRecord = {};
    optionalBoolean(devtools, sanitized, "enabled", `${source}.devtools`);
    optionalBoolean(devtools, sanitized, "injected", `${source}.devtools`);
    if (devtools.uploadMode !== undefined) {
      if (devtools.uploadMode !== "direct") {
        throw new Error(`${source}.devtools.uploadMode must be direct`);
      }
      sanitized.uploadMode = "direct";
    }
    if (Object.keys(sanitized).length > 0) output.devtools = sanitized;
  }

  if (input.artifact !== undefined) {
    const artifact = exactRecord(
      input.artifact,
      `${source}.artifact`,
      new Set(["format", "entrypoint", "restartPolicy"])
    );
    const sanitized: JsonRecord = {};
    if (artifact.format !== undefined) {
      if (artifact.format !== "raw-cjs" && artifact.format !== "acurast-zip") {
        throw new Error(`${source}.artifact.format must be raw-cjs or acurast-zip`);
      }
      sanitized.format = artifact.format;
    }
    if (artifact.entrypoint !== undefined) {
      sanitized.entrypoint = safeRelativeArtifactPath(
        artifact.entrypoint,
        `${source}.artifact.entrypoint`
      );
    }
    if (artifact.restartPolicy !== undefined) {
      if (artifact.restartPolicy !== "no" && artifact.restartPolicy !== "onFailure") {
        throw new Error(`${source}.artifact.restartPolicy must be no or onFailure`);
      }
      sanitized.restartPolicy = artifact.restartPolicy;
    }
    if (Object.keys(sanitized).length > 0) output.artifact = sanitized;
  }

  if (input.sourceBundleSha256 !== undefined) {
    if (
      typeof input.sourceBundleSha256 !== "string"
      || !/^[0-9a-f]{64}$/iu.test(input.sourceBundleSha256)
    ) {
      throw new Error(`${source}.sourceBundleSha256 must be a 64-character SHA-256`);
    }
    output.sourceBundleSha256 = input.sourceBundleSha256.toLowerCase();
  }

  if (input.failure !== undefined) {
    const failure = exactRecord(
      input.failure,
      `${source}.failure`,
      new Set(["mode"])
    );
    if (failure.mode !== undefined) {
      if (failure.mode !== "exit" && failure.mode !== "acurast-really-exit") {
        throw new Error(`${source}.failure.mode must be exit or acurast-really-exit`);
      }
      output.failure = { mode: failure.mode };
    }
  }

  if (input.scenarioArtifact !== undefined) {
    const scenario = exactRecord(
      input.scenarioArtifact,
      `${source}.scenarioArtifact`,
      new Set(["profile", "fixture"])
    );
    const sanitized: JsonRecord = {};
    if (scenario.profile !== undefined) {
      if (
        typeof scenario.profile !== "string"
        || !/^[A-Za-z0-9._-]{1,128}$/u.test(scenario.profile)
      ) {
        throw new Error(
          `${source}.scenarioArtifact.profile must be a bounded identifier`
        );
      }
      sanitized.profile = scenario.profile;
    }
    if (scenario.fixture !== undefined) {
      if (scenario.fixture !== "runnable" && scenario.fixture !== "missing-entrypoint") {
        throw new Error(
          `${source}.scenarioArtifact.fixture must be runnable or missing-entrypoint`
        );
      }
      sanitized.fixture = scenario.fixture;
    }
    if (Object.keys(sanitized).length > 0) output.scenarioArtifact = sanitized;
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

export function exactRecord(
  value: unknown,
  source: string,
  allowedFields: ReadonlySet<string>
): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be an object`);
  }
  const record = value as JsonRecord;
  for (const key of Object.keys(record)) {
    if (!allowedFields.has(key)) throw new Error(`${source}.${key} is not allowed`);
  }
  return record;
}

export function safeRelativeArtifactPath(value: unknown, source: string): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 256
    || value.includes("\\")
    || value.startsWith("/")
    || value.split("/").some((part) => part === "" || part === "." || part === "..")
    || !/^[A-Za-z0-9._/-]+$/u.test(value)
  ) {
    throw new Error(`${source} must be a safe relative artifact path`);
  }
  return value;
}

function optionalBoolean(
  input: JsonRecord,
  output: JsonRecord,
  field: string,
  source: string
): void {
  const value = input[field];
  if (value === undefined) return;
  if (typeof value !== "boolean") throw new Error(`${source}.${field} must be boolean`);
  output[field] = value;
}
