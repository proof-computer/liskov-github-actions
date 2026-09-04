// The control plane's hostname. The flat apex `liskov.proof.computer` was
// withdrawn by BKLG-20260822-84f5 (its Cloudflare record was removed), so a
// caller falling back to it got `fetch failed` rather than an HTTP error.
const DEFAULT_LISKOV_URL = "https://api.liskov.proof.computer";

export interface PolicyImportUrlInput {
  applicationId: string;
  importUrl?: string;
  liskovUrl?: string;
  environmentUrl?: string;
}

export function resolvePolicyImportUrl(input: PolicyImportUrlInput): string {
  const applicationId = encodeURIComponent(input.applicationId);
  const explicitImportUrl = input.importUrl?.trim();
  if (explicitImportUrl) {
    return explicitImportUrl.replaceAll("{applicationId}", applicationId);
  }

  const baseUrl = input.liskovUrl?.trim();
  if (baseUrl) {
    return runtimeImportUrl(baseUrl, applicationId);
  }

  const environmentUrl = input.environmentUrl?.trim();
  if (environmentUrl) {
    return environmentUrl.replaceAll("{applicationId}", applicationId);
  }
  return runtimeImportUrl(DEFAULT_LISKOV_URL, applicationId);
}

function runtimeImportUrl(baseUrl: string, encodedApplicationId: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("liskov-url must use http or https");
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/api/applications/${encodedApplicationId}/policy-imports/github`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
