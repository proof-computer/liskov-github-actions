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
pin bound to the exact authored and release-intent digests. Inputs: `app-id` and
`authored-manifest-path` (required), `working-directory`, `entrypoint`,
`extra-files`, `node-version`, `smoke`, `attest`, `pin-url`. The attest action
returns Liskov's deterministic `artifact-version-id`.

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

## À-la-carte actions

Compose your own job from these (`uses: proof-computer/liskov-github-actions/actions/<name>@v1`):

| Action | Kind | Does |
| --- | --- | --- |
| `setup` | composite | pnpm + Node + `install --frozen-lockfile` |
| `acurast-build` | composite | `typecheck → test → build` (+ optional `smoke`) |
| `ipfs-pin` | JS | build the Acurast deploy zip from `dist/`, pin no-spend → `cid`/`digest`/`manifest-path` |
| `artifact-pin-attest` | JS | OIDC → `POST /api/applications/<id>/artifact-pins/github` |
| `marketplace-ingest` | JS | OIDC → `POST /api/marketplace/ingest` |
| `policy-import` | JS | OIDC → `POST /api/applications/<id>/policy-imports/github` (import the repo's authored manifest as a draft) |
| `runtime-image-upload` | JS | Hash → manifest-bound scoped Tigris upload → fresh-OIDC finalize |

## Versioning

- Tag releases `vX.Y.Z`; `release.yml` moves the **`vX`** major tag so consumers pin
  `@v1` and get the latest `v1.x`. Security-sensitive callers can pin a commit SHA.
- `v1.0.1` adds optional source-commit and signer-workflow verification for
  runtime images without changing existing direct-URL callers.
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
pnpm build         # bundles each JS action src/ -> dist/index.js (committed)
pnpm check:dist    # build + fail if committed dist drifted (CI runs this)
```

`actions/*/dist/index.js` is **committed** (the node20 Actions runtime has no deps
installed). Edit `src/`, run `pnpm build`, commit both.
