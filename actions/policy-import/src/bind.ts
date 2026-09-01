import {
  bindRetainedSourcePublication,
  observedGithubSource,
  type SourcePublicationContext,
  type SourcePublicationEvidence
} from "../../shared/src/source-publication.js";
import {
  requireValidPolicyManifest,
  supportsRegisteredSourcePublication
} from "../../shared/src/policy-contract.js";

export function bindPolicyImportManifest(input: {
  manifest: unknown;
  applicationId: string;
  manifestPath: string;
  env: NodeJS.ProcessEnv;
  expected?: Partial<SourcePublicationContext>;
}): { document: Record<string, unknown>; sourceEvidence?: SourcePublicationEvidence } {
  const result = requireValidPolicyManifest(input.manifest);
  const record = result.document!;
  const documentId = record.applicationId;
  if (typeof documentId === "string" && documentId !== input.applicationId) {
    throw new Error(`authored manifest applicationId must be ${input.applicationId}`);
  }
  if (!supportsRegisteredSourcePublication(result)) {
    return { document: record };
  }
  const observed = observedGithubSource(input.env, input.manifestPath);
  const expected: SourcePublicationContext = {
    repository: input.expected?.repository || observed.repository,
    ref: input.expected?.ref || observed.ref,
    workflowRef: input.expected?.workflowRef || observed.workflowRef,
    manifestPath: input.expected?.manifestPath || observed.manifestPath,
    artifactDigest: input.expected?.artifactDigest || observed.artifactDigest
  };
  return {
    document: record,
    sourceEvidence: bindRetainedSourcePublication({
      manifest: record,
      applicationId: input.applicationId,
      observed,
      expected
    })
  };
}
