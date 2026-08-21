import {
  bindRetainedSourcePublication,
  observedGithubSource,
  type SourcePublicationContext,
  type SourcePublicationEvidence
} from "../../shared/src/source-publication.js";

export function bindPolicyImportManifest(input: {
  manifest: unknown;
  applicationId: string;
  manifestPath: string;
  env: NodeJS.ProcessEnv;
  expected?: Partial<SourcePublicationContext>;
}): { document: Record<string, unknown>; sourceEvidence?: SourcePublicationEvidence } {
  const document = input.manifest;
  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    throw new Error("authored manifest must contain a JSON object");
  }
  const record = document as Record<string, unknown>;
  const documentId = record.applicationId;
  if (typeof documentId === "string" && documentId !== input.applicationId) {
    throw new Error(`authored manifest applicationId must be ${input.applicationId}`);
  }
  if (record.schemaVersion === 4) {
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
