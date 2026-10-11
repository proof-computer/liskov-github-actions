# Changelog

## Unreleased — next v2 minor

- **`runtime-image.yml` and `cargo-runtime-image.yml` upload a V5 source
  document and import nothing** (BKLG-20261008-v5rb). `manifest-path` is now a
  repo-relative V5 source document (`release.mode: source`,
  `runtime.kind: native_image`); the `policy-import` step is removed from both
  workflows and the upload step passes `manifest-path`. A caller that still
  builds from a V4 manifest stays on `@v1`, which keeps the V4 import path
  until V4 import closes, and moves to `@v2` together with a V5 document.
- `runtime-image-upload` gains the `manifest-path` input. With it the action
  validates the document with the bundled policy client, opens the session
  with `{domain: "proof.liskov.runtime-image-source-upload-session.v1",
  manifestPath, document}`, and requires the session to echo the authored
  digest and manifest path before uploading. `authored-digest` and
  `release-intent-digest` are no longer required: they are the V4 mode,
  unchanged, mutually exclusive with `manifest-path`, and removed when V4
  import closes. Exactly one mode is required.
- Seven new outputs on the action and both workflows carry the build evidence
  of a V5 publication, read from the finalize response: `artifact-digest` (the
  bootstrap bundle digest), `source-repository`, `source-ref`, `source-commit`,
  `source-workflow-identity`, `binding-revision` and `revocation-epoch`. They
  are empty in V4 mode. Publish afterwards with
  `proof liskov application policy publish <app> --file <document>
  --artifact-digest <artifact-digest> --binding-revision <binding-revision>
  --revocation-epoch <revocation-epoch> --source-ref <source-ref>
  --source-commit <source-commit> --workflow-identity
  <source-workflow-identity> --expected-pointer-version <n> --yes`, or with a
  `pinned` document naming `artifact-digest`.
- **Required server release:** the Liskov control plane must carry
  BKLG-20261008-k2hx (liskov-rs #1632), which adds the V5 arm of the
  runtime-image upload-session and finalize routes. Against an older server
  the V5 mode fails closed at the upload session with `domain_mismatch`.
- Generate deterministic CycloneDX SBOMs from `Cargo.lock` when no
  `pnpm-lock.yaml` is present. Registry crates use Cargo package URLs and
  lockfile SHA-256 checksums; path and git crates have no hash. Existing pnpm
  SBOM bytes are unchanged.
- Add the optional `source-assurance` input to `cargo-runtime-image.yml`,
  defaulting to `false`, and expose `source-digest` and relative `sbom-path`
  outputs when enabled.
- Expose `sbom-path` from the source-assurance action, support its default
  repository-root directory, and reject untracked or staged stale SBOMs.
