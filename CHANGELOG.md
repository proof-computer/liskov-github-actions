# Changelog

## Unreleased — next v2 minor

- Generate deterministic CycloneDX SBOMs from `Cargo.lock` when no
  `pnpm-lock.yaml` is present. Registry crates use Cargo package URLs and
  lockfile SHA-256 checksums; path and git crates have no hash. Existing pnpm
  SBOM bytes are unchanged.
- Add the optional `source-assurance` input to `cargo-runtime-image.yml`,
  defaulting to `false`, and expose `source-digest` and relative `sbom-path`
  outputs when enabled.
- Expose `sbom-path` from the source-assurance action, support its default
  repository-root directory, and reject untracked or staged stale SBOMs.
