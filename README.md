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
    secrets:
      ACURAST_IPFS_URL: ${{ secrets.ACURAST_IPFS_URL }}
      ACURAST_IPFS_API_KEY: ${{ secrets.ACURAST_IPFS_API_KEY }}
```

Runs `pnpm install --frozen-lockfile → typecheck → test → build` (optional `smoke`),
pins the Acurast deploy zip to IPFS **no-spend**, and posts a **GitHub-OIDC** artifact
pin to liskov-rs. Inputs: `app-id` (required), `working-directory`, `entrypoint`,
`extra-files`, `node-version`, `smoke`, `attest`, `pin-url`.

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

## À-la-carte actions

Compose your own job from these (`uses: proof-computer/liskov-github-actions/actions/<name>@v1`):

| Action | Kind | Does |
| --- | --- | --- |
| `setup` | composite | pnpm + Node + `install --frozen-lockfile` |
| `acurast-build` | composite | `typecheck → test → build` (+ optional `smoke`) |
| `ipfs-pin` | JS | build the Acurast deploy zip from `dist/`, pin no-spend → `cid`/`digest`/`manifest-path` |
| `artifact-pin-attest` | JS | OIDC → `POST /api/applications/<id>/artifact-pins/github` |
| `marketplace-ingest` | JS | OIDC → `POST /api/marketplace/ingest` |

## Versioning

- Tag releases `vX.Y.Z`; `release.yml` moves the **`vX`** major tag so consumers pin
  `@v1` and get the latest `v1.x`. Security-sensitive callers can pin a commit SHA.
- **Caveat:** the reusable workflows reference their own JS actions by a **literal**
  ref (`@main` today — GitHub doesn't allow an expression in `uses:`). On each release,
  bump those internal `@main` refs to the release tag so a pinned `@v1` workflow runs
  `@v1` actions. (Tracked in BKLG-20260624-jn9l.)

## Security posture

Only **no-spend** (IPFS pin) and **OIDC attest/ingest** operations are exposed; the
spend-capable `ACURAST_MNEMONIC` CLI-upload path is intentionally **not** ported. The
attest/ingest endpoints are gated server-side on a repo allowlist + `workflowRef`.

## Development

```sh
pnpm install
pnpm typecheck
pnpm build         # bundles each JS action src/ -> dist/index.js (committed)
pnpm check:dist    # build + fail if committed dist drifted (CI runs this)
```

`actions/*/dist/index.js` is **committed** (the node20 Actions runtime has no deps
installed). Edit `src/`, run `pnpm build`, commit both.
