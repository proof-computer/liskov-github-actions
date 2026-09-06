# liskov-github-actions

Reusable GitHub **workflows** + **actions** for Liskov CI, so each Liskov repo's CI is a
short `uses: …@v1` instead of copy-pasted YAML + scripts. Plan + decisions:
`liskov-agent-orchestrator` **BKLG-20260624-jn9l** (extracted from `liskov-diagnostic`'s
inline scripts).

## Reusable workflows (the one-liners)

### `acurast-app.yml` — build → IPFS-pin → OIDC attest

```yaml
# .github/workflows/<app>.yml in an Acurast app repo
on:
  push: { branches: [main], paths: ['<app-dir>/**'] }
  workflow_dispatch:
permissions: { id-token: write, contents: read }
jobs:
  artifact:
    uses: proof-computer/liskov-github-actions/.github/workflows/acurast-app.yml@v1
    with:
      app-id: uptime-prober
      working-directory: uptime-prober      # default "."
      entrypoint: app.cjs                    # default; use bundle.cjs + extra-files: app.cjs for a stage0 app
      authored-manifest-path: uptime-prober/.liskov/uptime-prober.policy.json
    secrets:
      ACURAST_IPFS_URL: ${{ secrets.ACURAST_IPFS_URL }}
      ACURAST_IPFS_API_KEY: ${{ secrets.ACURAST_IPFS_API_KEY }}
```

Runs `pnpm install --frozen-lockfile → typecheck → test → build` (optional `smoke`),
pins the Acurast deploy zip to IPFS **no-spend**, and posts a **GitHub-OIDC** artifact
pin. V4 targets remain bound to the exact authored and release-intent digests;
identity-only V5 source targets are fenced by the server-owned source binding and
never synthesize V4 digests or drafts. Existing callers keep
the generated-zip defaults with `app-id`, `authored-manifest-path`,
`working-directory`, `entrypoint`, `extra-files`, `node-version`, `smoke`, `attest`,
and `pin-url`. The workflow exposes the CID, digest, uploaded build-manifest path,
artifact-version IDs, per-Application result JSON, and target count.

Callers that already prepare deploy bytes may set `prepare-command` and
`artifact-path`. The path is relative to `working-directory`; `ipfs-pin` hashes and
uploads those exact bytes without repacking them. `artifact-metadata-path` accepts a
strict JSON sidecar containing only the currently supported Diagnostic evidence:
optional `devtools` (`enabled`, `injected`, and `uploadMode: "direct"`), `artifact`
(`format`, safe `entrypoint`, and `restartPolicy`), `sourceBundleSha256`, `failure`,
and `scenarioArtifact`. Unknown fields and unsafe paths fail closed. OIDC claims,
repository identity, refs, and workflow identity never come from this sidecar.

`script-ipfs` reuses an exact `ipfs://CID` without another upload while still hashing
the local bytes. Set `ipfs-gateway-url` to a credential-free HTTPS URL (with optional
`{cid}`) to require exact gateway-byte equality. Verification allows four propagation
attempts with ten seconds between attempts. The build manifest is always uploaded as
a GitHub Actions run artifact.

For one prepared artifact shared by multiple Applications, set
`artifact-targets-path` instead of `authored-manifest-path`. It is a repository-root
relative non-empty JSON array with no extra keys:

```json
[
  {"applicationId":"diagnostic-a","authoredManifestPath":".liskov/diagnostic-a.json"},
  {"applicationId":"diagnostic-b","authoredManifestPath":".liskov/diagnostic-b.json"}
]
```

Each exact target must name the matching Application and be either a V4 unencrypted
`ipfs_bundle` build manifest or a retained V5 JavaScript source document. The shared
action mints one OIDC token and posts one artifact per target. V4 requests retain the
deployed domain and byte shape; V5 requests use
`proof.liskov.github-source-artifact.v1` with manifest path, CID, and digest only, so
Liskov resolves repository/ref/workflow/commit authority from verified OIDC plus the
current source binding. The original single-target inputs and first
`artifact-version-id` output remain compatible.

### `marketplace-ingest.yml` — catalog OIDC push (ADR-0006 §A1)

```yaml
on: { push: { branches: [main] } }
permissions: { id-token: write, contents: read }
jobs:
  publish:
    uses: proof-computer/liskov-github-actions/.github/workflows/marketplace-ingest.yml@v1
```

Mints an OIDC token and tells liskov-rs to reconcile the catalog to this commit. **The
`/api/marketplace/ingest` endpoint is not built yet** (catalog schema spec, Part 2) —
this is ready for it.

### `policy-sync.yml` — authored manifest → imported draft

```yaml
# .github/workflows/liskov-policy.yml in an app repo
on:
  push: { branches: [main], paths: ['.liskov/**'] }
permissions: { id-token: write, contents: read }
jobs:
  manifest:
    uses: proof-computer/liskov-github-actions/.github/workflows/policy-sync.yml@v1
    with:
      application-id: slipway-diagnostic
      manifest-path: .liskov/slipway-diagnostic.policy.json
```

Checks out the repo, mints an OIDC token, and POSTs the authored manifest to
`POST /api/applications/<id>/policy-imports/github`. The server verifies the token,
requires the Application to already be bound to THIS repository, pins the recorded
`source.commit` from the **verified** `sha` claim (auto-imports are commit-pinned by
construction), and imports a draft. Publication and artifact selection are separate.

### `runtime-image.yml` — manifest import → scoped image upload → bootstrap

```yaml
on:
  workflow_dispatch:
    inputs:
      image_url: { description: Pinned PRoot image URL, required: true, type: string }
      expected_sha256: { description: Optional SHA-256, required: false, type: string }
permissions: { id-token: write, contents: read }
jobs:
  runtime-image:
    uses: proof-computer/liskov-github-actions/.github/workflows/runtime-image.yml@v1
    with:
      application-id: my-app
      manifest-path: .liskov/my-app.json
      image-url: ${{ inputs.image_url }}
      expected-sha256: ${{ inputs.expected_sha256 }}
      attestation-repository: proof-computer/liskov-runtime-images
      attestation-source-digest: ${{ inputs.image_source_commit }}
      attestation-signer-workflow: proof-computer/liskov-runtime-images/.github/workflows/ci.yml
```

Downloads the supplied image and locally verifies its SHA-256 before any import
or upload. When `attestation-repository`, `attestation-source-digest`, and
`attestation-signer-workflow` are supplied, the workflow requires
`expected-sha256` and verifies the downloaded file's GitHub artifact attestation
against that exact source commit and signer workflow before any state-changing
step. The three attestation inputs are all-or-none. Omitting all three preserves
the existing unattested direct-URL migration/debug path.

The workflow then imports the exact V4 runtime-image build manifest and passes the server-authoritative
`authoredDigest` and `releaseIntentDigest` to a scoped upload action. Liskov verifies
that exact binding before creating one-object Tigris credentials; the action uploads
without exposing the credentials, remints OIDC, finalizes, and returns the image,
bootstrap, artifact-version, cleanup, and safe provenance outputs. Set `liskov-url`
to use the same custom Liskov base for both import and upload.

### `cargo-runtime-image.yml` — locked Rust build → deterministic image → upload

This workflow is the reusable supply-chain path for native Cargo applications.
It requires `Cargo.lock`, an exact `rust-toolchain.toml` channel, and an
attested, digest-pinned helperless Liskov rootfs. On a native ARM64 runner it
builds the selected binary twice for `aarch64-unknown-linux-musl`, rejects a
dynamic interpreter, and requires identical binary bytes. It then overlays
each build at the declared absolute path, normalizes the rootfs archive, rejects
any embedded `liskov-runtime-contact`, and requires both complete images to
have the same digest and bytes.

Only after that proof does the workflow optionally attest the generated image,
import the exact authored manifest, and invoke the existing scoped
upload/finalization action. Generated-image attestation defaults on. Set
`attest-runtime-image: false` when GitHub artifact attestations are unavailable,
including private repositories whose organization plan does not provide them.
This skips only publication of GitHub build provenance for the derived image:
Liskov still verifies the caller's GitHub OIDC identity and binds the exact
Application, manifest digest pair, source commit, workflow, and image digest.
The base image remains digest- and attestation-verified in both modes.
GitHub requires the caller to grant every permission declared by a reusable
workflow, so callers must retain `attestations: write` even when this input is
false; the skipped step creates no attestation.

Callers must pin the base image's SHA-256, source commit, repository, and signer
workflow. Release callers should use the maintained promoted rootfs; a
release-candidate rootfs remains suitable only for an explicitly controlled
canary.

```yaml
permissions:
  attestations: write
  contents: read
  id-token: write

jobs:
  image:
    uses: proof-computer/liskov-github-actions/.github/workflows/cargo-runtime-image.yml@v1
    with:
      application-id: rust-hello-world
      manifest-path: .liskov/rust-hello-world.policy.json
      working-directory: rust-hello-world
      binary-name: rust-hello-world
      install-path: /usr/local/bin/rust-hello-world
      base-image-url: <immutable release asset URL>
      base-image-sha256: <64 lowercase hexadecimal characters>
      base-attestation-repository: proof-computer/liskov-runtime-images
      base-attestation-source-digest: <exact source commit>
      base-attestation-signer-workflow: proof-computer/liskov-runtime-images/.github/workflows/ci.yml
      attest-runtime-image: false # optional; defaults to true
```

## À-la-carte actions

Compose your own job from these (`uses: proof-computer/liskov-github-actions/actions/<name>@v1`):

| Action | Kind | Does |
| --- | --- | --- |
| `setup` | composite | pnpm + Node + `install --frozen-lockfile` |
| `acurast-build` | composite | `typecheck → test → build` (+ optional `smoke`) |
| `ipfs-pin` | JS | generate a zip or read exact prepared bytes, optionally reuse/verify a CID, pin no-spend → `cid`/`digest`/`manifest-path` |
| `artifact-pin-attest` | JS | OIDC → one or more manifest-bound `POST /api/applications/<id>/artifact-pins/github` calls |
| `marketplace-ingest` | JS | OIDC → `POST /api/marketplace/ingest` |
| `policy-import` | JS | OIDC → `POST /api/applications/<id>/policy-imports/github` (import the repo's authored manifest as a draft) |
| `runtime-image-upload` | JS | Hash → manifest-bound scoped Tigris upload → fresh-OIDC finalize |
| `cargo-runtime-image-build` | composite + Python | Safely overlay one static AArch64 binary and emit a normalized helperless-rootfs-derived `tar.xz` |

## Versioning

- Tag releases `vX.Y.Z`; `release.yml` moves the **`vX`** major tag so consumers pin
  `@v1` and get the latest `v1.x`. Security-sensitive callers can pin a commit SHA.
- `v1.0.1` adds optional source-commit and signer-workflow verification for
  runtime images without changing existing direct-URL callers.
- `v1.0.2` adds the default-standard runtime-image `bootstrap-mode` input; the
  `bridge-probe` value remains restricted by Liskov to its exact internal
  canary workflow.
- `v1.2.0` adds backward-compatible caller-prepared artifact bytes, sanitized
  Diagnostic metadata, existing-CID gateway verification, multi-target artifact-pin
  attestation, reusable-workflow outputs, and durable build-manifest run artifacts.
- `v1.2.3` allows Cargo callers to skip publishing derived-image GitHub build
  provenance while retaining deterministic byte proof, base-image attestation,
  and Liskov's exact OIDC/manifest/image binding.
- `v1.2.4` lets one attested IPFS bundle target both existing V4 build manifests and
  identity-only V5 source documents without creating a V4 compatibility draft.
- Reusable workflows reference their own JS actions by the literal `@v1` major tag,
  so a caller pinned to `@v1` executes the matching released action surface.

## Security posture

Only **no-spend** (IPFS pin), **OIDC attest/ingest**, and scoped runtime-image upload
operations are exposed; the spend-capable `ACURAST_MNEMONIC` CLI-upload path is
intentionally **not** ported. Runtime-image sessions require the exact imported
manifest digest pair, and upload credentials are masked, retained only in memory,
scoped to one object, and never emitted as outputs. The attest/ingest/upload endpoints
are gated server-side on repository, ref, workflow, and manifest authority.

## Development

```sh
pnpm install
pnpm typecheck
pnpm build         # bundles each JS action src/ -> dist/index.cjs (committed)
pnpm check:dist    # build + fail if committed dist drifted (CI runs this)
```

`actions/*/dist/index.cjs` is **committed** (the node24 Actions runtime has no deps
installed). Edit `src/`, run `pnpm build`, commit both.

## Encrypted JavaScript delivery (8ho7 release candidate)

`encryption-mode: aes-256-gcm-payload-v1` packages a public bootstrap and an
AES-256-GCM encrypted, self-contained CommonJS payload. The payload exports
`async start(runtime)` and uses the handle supplied by the bootstrap. It must
not start another runtime. The default `none` path is unchanged. The historical
V4 `aes256_gcm` whole-bundle requirement remains a different, unsupported format.

```yaml
jobs:
  artifact:
    uses: proof-computer/liskov-github-actions/.github/workflows/acurast-app.yml@v1
    with:
      app-id: encrypted-worker
      authored-manifest-path: .liskov/encrypted-worker.json
      entrypoint: app.cjs
      encryption-mode: aes-256-gcm-payload-v1
      encryption-secret-id: application-code-key
    secrets:
      LISKOV_CODE_ENCRYPTION_KEY: ${{ secrets.LISKOV_CODE_ENCRYPTION_KEY }}
```

This path requires a V5 `release.mode: source`, Node.js, the same authored
entrypoint file, and a required `configuration.secrets` declaration for
`application-code-key` with destination
`{ "kind": "environment", "name": "LISKOV_CODE_KEY" }`. Supply canonical standard
base64 encoding of a random 32-byte key in the GitHub secret, and install that
same value through the existing managed Lockbox secret path. The workflow does
not generate, upload or rotate customer secrets, publish policy, or authorize
spend. It refuses extra files, prepared archives and reused CIDs in encrypted
mode, so those inputs cannot quietly publish plaintext or reuse a nonce.

The runtime needs a processor with a working P-256 grant-response key. The
Android implementation requires Android 12 or later, and a `DataEncryption`
advertisement alone does not establish support. Select compatible candidates
in the Application manifest. Follow the [encrypted JavaScript guide](https://docs.proof.computer/liskov/build/encrypted-javascript)
to publish paused, confirm the managed key save, then resume within the reviewed
spend cap and verify signed loader and application outcomes.

The action embeds the immutable runtime SDK commit recorded in `package.json`
and commits the built public loader beside its action bundle. Only the loader,
public descriptor, ciphertext and Acurast manifest enter the ZIP. OIDC evidence
binds the ZIP digest and `encryptedCode` metadata; payload digests are separate
from the ZIP digest. The runtime requires the key to have been installed by an
authenticated Lockbox grant and verifies both digests and the GCM tag before
loading a local file. The fixed AESGCM vector is shared with Rust and the SDK.

The customer availability claim remains gated on 8ho7's deployed metadata
validator, released workflow and production canary. Do not infer Cargo image
confidentiality, PROOF operator blindness, or zero-knowledge custody from this
loader. A private repository alone does not protect ordinary `none` artifacts.
