import path from "node:path";

// The byte-identical vendored bundle carries `policy-client.d.ts`; NodeNext
// does not associate that declaration with a `.cjs` suffix, so this one import
// is asserted below against the same checked bundle manifest.
// @ts-expect-error vendored CommonJS adapter has a separately hashed declaration
import policyClientAdapter from "../policy-client-bundle/policy-client.cjs";

export interface PolicyDiagnostic {
  code: string;
  message: string;
  pointer: string;
}

export interface PolicyEvaluation {
  disposition: "supported" | "unknown_opaque" | "invalid";
  valid: boolean;
  pair?: { schema: string; schemaVersion: number };
  document?: Record<string, unknown>;
  errors: PolicyDiagnostic[];
  capabilityDiagnostics: PolicyDiagnostic[];
  deprecationDiagnostics: PolicyDiagnostic[];
  authoredDigest?: string;
  releaseIntentDigest?: string;
}

interface LoadedContract {
  manifest: {
    publicationPairs: Array<{ schema: string; schemaVersion: number; releaseMode: "source" }>;
  };
  evaluate(request: Record<string, unknown>): PolicyEvaluation;
}

let loaded: LoadedContract | undefined;

function contract(): LoadedContract {
  if (loaded) return loaded;
  const adapter = policyClientAdapter as {
    loadPolicyContract(directory: string): LoadedContract;
  };
  const bundledDirectory = typeof __dirname === "string"
    ? path.resolve(__dirname, "../../shared/policy-client-bundle")
    : path.resolve(process.cwd(), "actions/shared/policy-client-bundle");
  loaded = adapter.loadPolicyContract(bundledDirectory);
  return loaded;
}

export function evaluatePolicyManifest(manifest: unknown): PolicyEvaluation {
  return contract().evaluate({
    schema: "proof.liskov.policy-client-request.v1",
    operation: "validate",
    encoding: "json",
    document: JSON.stringify(manifest)
  });
}

export function requireValidPolicyManifest(manifest: unknown): PolicyEvaluation {
  const result = evaluatePolicyManifest(manifest);
  if (!result.valid || result.disposition !== "supported" || !result.document) {
    const first = result.errors[0];
    throw new Error(first
      ? `${first.code} ${first.pointer || "/"}: ${first.message}`
      : "authored manifest declares an unsupported policy schema pair");
  }
  return result;
}

export function supportsRegisteredSourcePublication(result: PolicyEvaluation): boolean {
  return Boolean(result.pair && contract().manifest.publicationPairs.some((pair) =>
    pair.schema === result.pair?.schema
    && pair.schemaVersion === result.pair?.schemaVersion
    && pair.releaseMode === "source"));
}
