export const DEFAULT_LISKOV_URL = "https://api.liskov.proof.computer";
export const DEFAULT_UPLOAD_AUDIENCE = "liskov-artifact-upload";

export interface UploadIntentInputs {
  readonly liskovUrl: string;
  readonly organizationId: string;
  readonly applicationId: string;
  readonly audience?: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly manifestDigest: string;
  readonly encryptionMode: string;
}

export interface UploadIntent {
  readonly uploadId: string;
  readonly token: string;
  readonly upload: { readonly url: string; readonly method: "POST"; readonly field: "file" };
  readonly gatewayUrlTemplate: string;
  readonly maxBytes: number;
  readonly encryptionMode: string;
  readonly expiresAtMs: number;
  readonly cidVersion: 0;
}

export interface UploadIntentDependencies {
  readonly getIdToken: (audience: string) => Promise<string>;
  readonly fetchImpl: typeof fetch;
}

export async function requestUploadIntent(
  inputs: UploadIntentInputs,
  dependencies: UploadIntentDependencies
): Promise<UploadIntent> {
  if (!inputs.organizationId.trim()) throw new Error("organization-id is required for Liskov uploads");
  if (!inputs.applicationId.trim()) throw new Error("app-name is required for Liskov uploads");
  const base = httpsUrl(inputs.liskovUrl, "liskov-url").replace(/\/+$/u, "");
  const url = `${base}/api/organizations/${encodeURIComponent(inputs.organizationId)}`
    + `/applications/${encodeURIComponent(inputs.applicationId)}/artifact-upload-intents`;
  let oidc: string;
  try {
    oidc = await dependencies.getIdToken(inputs.audience ?? DEFAULT_UPLOAD_AUDIENCE);
  } catch {
    throw new Error("Unable to mint GitHub OIDC token for Liskov upload; require permissions: id-token: write");
  }
  let response: Response;
  try {
    response = await dependencies.fetchImpl(url, {
      method: "POST",
      headers: { authorization: `Bearer ${oidc}`, "content-type": "application/json" },
      body: JSON.stringify({
        sha256: inputs.sha256,
        byteSize: inputs.byteSize,
        manifestDigest: inputs.manifestDigest,
        encryptionMode: inputs.encryptionMode
      })
    });
  } catch {
    throw new Error("Liskov upload intent request failed");
  }
  let payload: Record<string, unknown> = {};
  try {
    const value: unknown = await response.json();
    if (isRecord(value)) payload = value;
  } catch {
    // A non-JSON refusal still carries its HTTP status, without echoing its body.
  }
  if (!response.ok) {
    const secrets = [oidc, typeof payload.token === "string" ? payload.token : ""];
    const code = safeMessage(payload.error, secrets, "unknown_error", false);
    const reason = safeMessage(payload.reason, secrets, "request refused");
    throw new Error(`Liskov refused the upload intent (${response.status} ${code}): ${reason}`);
  }
  if (payload.ok !== true || typeof payload.uploadId !== "string" || !payload.uploadId
    || typeof payload.token !== "string" || !payload.token
    || !isRecord(payload.upload) || payload.upload.method !== "POST" || payload.upload.field !== "file"
    || typeof payload.upload.url !== "string" || typeof payload.gatewayUrlTemplate !== "string"
    || !Number.isSafeInteger(payload.maxBytes) || (payload.maxBytes as number) <= 0
    || !Number.isSafeInteger(payload.expiresAtMs) || (payload.expiresAtMs as number) <= 0
    || payload.encryptionMode !== inputs.encryptionMode || payload.cidVersion !== 0) {
    throw new Error("Liskov upload intent response is invalid");
  }
  httpsUrl(payload.upload.url, "Liskov upload URL");
  if (!payload.upload.url.endsWith("/pinning/pinFileToIPFS")) {
    throw new Error("Liskov upload intent response has an unsupported upload URL");
  }
  httpsUrl(payload.gatewayUrlTemplate, "Liskov gateway URL");
  return payload as unknown as UploadIntent;
}

function httpsUrl(value: string, field: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${field} must be an absolute HTTPS URL`); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error(`${field} must be a credential-free HTTPS URL without a query or fragment`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeMessage(value: unknown, secrets: readonly string[], fallback: string, redactLong = true): string {
  if (typeof value !== "string") return fallback;
  let text = value;
  for (const secret of secrets) if (secret.length > 0) text = text.replaceAll(secret, "[redacted]");
  return (redactLong ? text.replace(/[A-Za-z0-9_-]{24,}/gu, "[redacted]") : text).slice(0, 400);
}
