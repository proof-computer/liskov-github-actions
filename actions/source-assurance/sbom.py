#!/usr/bin/env python3
"""Generate a CycloneDX SBOM for a pnpm workspace from its lockfile.

ADR-0106 requires every public Marketplace version to identify its third-party
dependencies and their licences. The lockfile is the right input: it is what the
build actually resolved, it is committed alongside the source a reviewer reads,
and deriving from it needs no network and no registry credentials — so the same
document can be produced in CI, by a publisher, and by a reviewer, and compared.

This is deliberately not a full dependency-analysis tool. It records what the
lockfile states and nothing more; a field the lockfile does not carry is left
absent rather than guessed.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# pnpm lockfiles are YAML, but the `packages:` section we need is a flat map of
# `name@version` keys to a small block of scalars. Parsing that shape directly
# avoids adding a YAML dependency to every offering's build.
PACKAGE_KEY = re.compile(r"^  '(?P<quoted>[^']+)':\s*$|^  (?P<bare>[^\s'][^:]*):\s*$")
INTEGRITY = re.compile(r"resolution:\s*\{integrity:\s*(?P<integrity>[^,}]+)")
TARBALL = re.compile(r"resolution:\s*\{tarball:\s*(?P<tarball>[^,}]+)")


def split_name_version(key: str) -> tuple[str, str]:
    """`@scope/name@1.2.3` -> (`@scope/name`, `1.2.3`)."""
    at = key.rfind("@")
    if at <= 0:
        return key, ""
    return key[:at], key[at + 1 :]


def parse_packages(lock_text: str) -> list[dict[str, str]]:
    lines = lock_text.splitlines()
    try:
        start = lines.index("packages:") + 1
    except ValueError:
        return []
    packages: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for line in lines[start:]:
        if line and not line.startswith(" "):
            break  # a new top-level section ends `packages:`
        match = PACKAGE_KEY.match(line)
        if match:
            key = match.group("quoted") or match.group("bare")
            name, version = split_name_version(key)
            current = {"name": name, "version": version}
            packages.append(current)
            continue
        if current is None:
            continue
        integrity = INTEGRITY.search(line)
        if integrity:
            current["integrity"] = integrity.group("integrity").strip()
        tarball = TARBALL.search(line)
        if tarball:
            current["tarball"] = tarball.group("tarball").strip()
    return packages


def hashes_for(package: dict[str, str]) -> list[dict[str, str]]:
    """CycloneDX hashes, only where the lockfile actually carries one."""
    integrity = package.get("integrity", "")
    if integrity.startswith("sha512-"):
        return [{"alg": "SHA-512", "content": integrity[len("sha512-") :]}]
    if integrity.startswith("sha256-"):
        return [{"alg": "SHA-256", "content": integrity[len("sha256-") :]}]
    return []


def purl(package: dict[str, str]) -> str:
    """A package URL for the component.

    A git/tarball dependency has a URL where a registry package has a semver, so
    it gets a `download_url` qualifier rather than a fabricated version — the
    exact bytes are still pinned, by the URL's commit.
    """
    name = package["name"]
    version = package["version"]
    encoded = name.replace("@", "%40", 1) if name.startswith("@") else name
    if "://" in version:
        return f"pkg:npm/{encoded}?download_url={version}"
    return f"pkg:npm/{encoded}@{version}"


def build_document(manifest: dict, packages: list[dict[str, str]]) -> dict:
    components = []
    for package in sorted(packages, key=lambda p: (p["name"], p["version"])):
        if not package.get("version"):
            continue
        component = {
            "type": "library",
            "name": package["name"],
            "version": package["version"],
            "purl": purl(package),
            "scope": "required",
        }
        hashes = hashes_for(package)
        if hashes:
            component["hashes"] = hashes
        if package.get("tarball"):
            component["externalReferences"] = [
                {"type": "distribution", "url": package["tarball"]}
            ]
        components.append(component)

    return {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "version": 1,
        "metadata": {
            "component": {
                "type": "application",
                "name": manifest.get("name", "application"),
                "version": manifest.get("version", "0.0.0"),
            },
            "tools": [
                {
                    "vendor": "PROOF",
                    "name": "liskov-source-assurance-sbom",
                    "version": "1",
                }
            ],
        },
        "components": components,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", default=".", help="app directory")
    parser.add_argument("--out", default="sbom.cdx.json", help="output path, relative to --directory")
    args = parser.parse_args()

    root = Path(args.directory)
    lock = root / "pnpm-lock.yaml"
    if not lock.is_file():
        print(f"no pnpm-lock.yaml in {root}", file=sys.stderr)
        return 2
    manifest_path = root / "package.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}

    document = build_document(manifest, parse_packages(lock.read_text()))
    out = root / args.out
    # Deterministic bytes: the SBOM is part of a digested snapshot, so the same
    # inputs must always produce the same file.
    out.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n")
    print(f"wrote {out} ({len(document['components'])} components)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
