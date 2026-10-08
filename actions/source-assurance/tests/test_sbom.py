from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "sbom.py"
SPEC = importlib.util.spec_from_file_location("source_assurance_sbom", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
SBOM = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SBOM)

LOCKFILE = """lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      '@proof-computer/liskov-runtime':
        specifier: github:proof-computer/liskov-runtime-js#v0.3.22
        version: https://codeload.github.com/proof-computer/liskov-runtime-js/tar.gz/1ec38b8

packages:

  '@proof-computer/liskov-runtime@https://codeload.github.com/proof-computer/liskov-runtime-js/tar.gz/1ec38b8':
    resolution: {tarball: https://codeload.github.com/proof-computer/liskov-runtime-js/tar.gz/1ec38b8}

  typescript@5.9.3:
    resolution: {integrity: sha512-AAAA==}
    engines: {node: '>=14.17'}

snapshots:

  typescript@5.9.3: {}
"""


class SbomTests(unittest.TestCase):
    def _document(self) -> dict:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "pnpm-lock.yaml").write_text(LOCKFILE)
            (root / "package.json").write_text(
                json.dumps({"name": "@proof-computer/uptime-prober", "version": "0.0.0"})
            )
            manifest = json.loads((root / "package.json").read_text())
            packages = SBOM.parse_packages((root / "pnpm-lock.yaml").read_text())
            return SBOM.build_document(manifest, packages)

    def test_a_git_dependency_is_recorded_with_its_pinned_url(self) -> None:
        # The most important dependency of a first-party offering is the runtime
        # it is built against, and it is resolved from a git tarball rather than
        # the registry. An SBOM that silently dropped it would understate exactly
        # the code a reviewer most needs to see.
        document = self._document()
        names = [component["name"] for component in document["components"]]
        self.assertIn("@proof-computer/liskov-runtime", names)
        runtime = next(
            c for c in document["components"] if c["name"] == "@proof-computer/liskov-runtime"
        )
        self.assertIn("download_url=", runtime["purl"])
        self.assertEqual(
            runtime["externalReferences"][0]["url"],
            "https://codeload.github.com/proof-computer/liskov-runtime-js/tar.gz/1ec38b8",
        )

    def test_a_registry_dependency_keeps_its_integrity_hash(self) -> None:
        document = self._document()
        typescript = next(
            c for c in document["components"] if c["name"] == "typescript"
        )
        self.assertEqual(typescript["version"], "5.9.3")
        self.assertEqual(typescript["hashes"], [{"alg": "SHA-512", "content": "AAAA=="}])
        self.assertEqual(typescript["purl"], "pkg:npm/typescript@5.9.3")

    def test_the_document_is_deterministic_and_sorted(self) -> None:
        # The SBOM lives inside a digested source snapshot, so identical inputs
        # must produce identical bytes or the source digest moves on its own.
        first = json.dumps(self._document(), indent=2, sort_keys=True)
        second = json.dumps(self._document(), indent=2, sort_keys=True)
        self.assertEqual(first, second)
        names = [c["name"] for c in self._document()["components"]]
        self.assertEqual(names, sorted(names))


class CargoSbomTests(unittest.TestCase):
    LOCKFILE = '''version = 4

[[package]]
name = "serde"
version = "1.0.228"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

[[package]]
name = "local-app"
version = "0.1.0"

[[package]]
name = "git-helper"
version = "0.2.0"
source = "git+https://example.com/helper?rev=abc#abc"
'''

    def _run(self, root: Path):
        import subprocess
        import sys

        return subprocess.run(
            [sys.executable, str(MODULE_PATH), "--directory", str(root)],
            capture_output=True, text=True,
        )

    def test_cargo_components_and_bytes_are_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "Cargo.lock").write_text(self.LOCKFILE)
            (root / "Cargo.toml").write_text('[package]\nname = "local-app"\nversion = "0.1.0"\n')
            self.assertEqual(self._run(root).returncode, 0)
            first = (root / "sbom.cdx.json").read_bytes()
            self.assertEqual(self._run(root).returncode, 0)
            self.assertEqual(first, (root / "sbom.cdx.json").read_bytes())
            document = json.loads(first)
            self.assertEqual(document["bomFormat"], "CycloneDX")
            self.assertEqual(document["metadata"]["component"]["name"], "local-app")
            self.assertEqual(document["components"], [
                {"type": "library", "scope": "required", "name": "git-helper",
                 "version": "0.2.0", "purl": "pkg:cargo/git-helper@0.2.0"},
                {"type": "library", "scope": "required", "name": "local-app",
                 "version": "0.1.0", "purl": "pkg:cargo/local-app@0.1.0"},
                {"type": "library", "scope": "required", "name": "serde",
                 "version": "1.0.228", "purl": "pkg:cargo/serde@1.0.228",
                 "hashes": [{"alg": "SHA-256", "content": "0123456789abcdef" * 4}]},
            ])

    def test_pnpm_bytes_are_preserved_even_with_a_cargo_lockfile(self) -> None:
        import hashlib

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "pnpm-lock.yaml").write_text(LOCKFILE)
            (root / "package.json").write_text(json.dumps(
                {"name": "@proof-computer/uptime-prober", "version": "0.0.0"}
            ))
            self.assertEqual(self._run(root).returncode, 0)
            original = (root / "sbom.cdx.json").read_bytes()
            # Frozen from the original generator at 6e5f75a, including whitespace.
            self.assertEqual(hashlib.sha256(original).hexdigest(),
                             "f4ff9e500f218c6da6b1d974c97f411a71e85d2bea331775f0f73a1681fa6ab0")
            (root / "Cargo.lock").write_text("invalid TOML must not be parsed")
            self.assertEqual(self._run(root).returncode, 0)
            self.assertEqual(original, (root / "sbom.cdx.json").read_bytes())

    def test_neither_lockfile_exits_two_without_writing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result = self._run(root)
            self.assertEqual(result.returncode, 2)
            self.assertIn("no pnpm-lock.yaml or Cargo.lock", result.stderr)
            self.assertFalse((root / "sbom.cdx.json").exists())

    def test_workspace_metadata_does_not_emit_an_inherited_version_table(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "Cargo.lock").write_text(self.LOCKFILE)
            (root / "Cargo.toml").write_text('[package]\nname = "local-app"\nversion.workspace = true\n')
            self.assertEqual(self._run(root).returncode, 0)
            document = json.loads((root / "sbom.cdx.json").read_text())
            self.assertIsInstance(document["metadata"]["component"]["version"], str)


if __name__ == "__main__":
    unittest.main()
