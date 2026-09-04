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


if __name__ == "__main__":
    unittest.main()
