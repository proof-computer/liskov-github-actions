#!/usr/bin/env python3
"""Create a normalized Cargo/PRoot image from a helperless base rootfs."""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import stat
import subprocess
import tarfile
import tempfile
from pathlib import Path, PurePosixPath

HELPER_BASENAME = "liskov-runtime-contact"


class BuildError(RuntimeError):
    """An input cannot satisfy the deterministic image contract."""


def normalized_name(raw: str) -> str:
    name = raw
    while name.startswith("./"):
        name = name[2:]
    path = PurePosixPath(name)
    if not name or path.is_absolute() or ".." in path.parts or "\x00" in name:
        raise BuildError(f"unsafe or empty rootfs member path: {raw!r}")
    return str(path)


def inspect_archive(path: Path) -> str:
    seen: set[str] = set()
    links: set[str] = set()
    roots: set[str] = set()
    with tarfile.open(path, mode="r:*") as archive:
        for member in archive:
            name = normalized_name(member.name)
            if name in seen:
                raise BuildError(f"duplicate rootfs member: {name}")
            seen.add(name)
            parts = PurePosixPath(name).parts
            roots.add(parts[0])
            if any(part in links for part in ancestor_names(parts[:-1])):
                raise BuildError(f"rootfs member traverses an archive link parent: {name}")
            if PurePosixPath(name).name == HELPER_BASENAME or PurePosixPath(name).name.startswith(
                f"{HELPER_BASENAME}-"
            ):
                raise BuildError("base rootfs embeds the runtime-contact helper")
            if member.issym() or member.islnk():
                links.add(name)
                validate_link(name, member.linkname)
    if len(roots) != 1:
        raise BuildError("rootfs archive must contain exactly one top-level directory")
    return next(iter(roots))


def ancestor_names(parts: tuple[str, ...]) -> list[str]:
    return [str(PurePosixPath(*parts[:index])) for index in range(1, len(parts) + 1)]


def validate_link(name: str, raw_target: str) -> None:
    if "\x00" in raw_target:
        raise BuildError(f"rootfs link contains NUL: {name}")
    target = PurePosixPath(raw_target)
    if target.is_absolute():
        target = PurePosixPath(*target.parts[1:])
    else:
        target = PurePosixPath(name).parent / target
    depth = 0
    for part in target.parts:
        if part in ("", "."):
            continue
        if part == "..":
            depth -= 1
            if depth < 0:
                raise BuildError(f"rootfs link escapes archive root: {name}")
        else:
            depth += 1


def validate_binary(path: Path) -> None:
    data = path.read_bytes()
    if len(data) < 64 or data[:6] != b"\x7fELF\x02\x01":
        raise BuildError("Cargo binary must be ELF64 little-endian")
    if int.from_bytes(data[18:20], "little") != 183:
        raise BuildError("Cargo binary must target AArch64")
    program_offset = int.from_bytes(data[32:40], "little")
    entry_size = int.from_bytes(data[54:56], "little")
    entry_count = int.from_bytes(data[56:58], "little")
    if entry_size < 4 or program_offset + entry_size * entry_count > len(data):
        raise BuildError("Cargo binary has malformed program headers")
    for index in range(entry_count):
        offset = program_offset + index * entry_size
        if int.from_bytes(data[offset : offset + 4], "little") == 3:
            raise BuildError("Cargo binary must be static and contain no PT_INTERP")


def safe_install_target(root: Path, archive_root: str, install_path: str) -> Path:
    path = PurePosixPath(install_path)
    if not path.is_absolute() or ".." in path.parts or path.name in ("", "."):
        raise BuildError("install-path must be an absolute normalized file path")
    relative = PurePosixPath(*path.parts[1:])
    target = root / archive_root / Path(*relative.parts)
    current = root / archive_root
    for part in relative.parts[:-1]:
        current = current / part
        if current.exists() and stat.S_ISLNK(current.lstat().st_mode):
            raise BuildError("install-path traverses a symlink in the base rootfs")
    return target


def create_archive(source: Path, archive_root: str, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f".{output.name}.{os.getpid()}.tmp")
    temporary.unlink(missing_ok=True)
    tar_command = [
        "tar",
        "--format=posix",
        "--sort=name",
        "--mtime=@0",
        "--clamp-mtime",
        "--owner=0",
        "--group=0",
        "--numeric-owner",
        "--pax-option=delete=atime,delete=ctime",
        "-C",
        str(source),
        "-cf",
        "-",
        archive_root,
    ]
    with temporary.open("wb") as destination:
        tar_process = subprocess.Popen(tar_command, stdout=subprocess.PIPE)
        assert tar_process.stdout is not None
        xz_process = subprocess.run(
            ["xz", "--threads=1", "--check=crc64", "-9e", "-c"],
            stdin=tar_process.stdout,
            stdout=destination,
            check=False,
        )
        tar_process.stdout.close()
        tar_status = tar_process.wait()
    if tar_status != 0 or xz_process.returncode != 0:
        temporary.unlink(missing_ok=True)
        raise BuildError("deterministic rootfs archive creation failed")
    temporary.replace(output)


def build(rootfs: Path, binary: Path, install_path: str, output: Path) -> None:
    if not rootfs.is_file() or rootfs.stat().st_size == 0:
        raise BuildError("rootfs archive is missing or empty")
    if not binary.is_file() or binary.stat().st_size == 0:
        raise BuildError("Cargo binary is missing or empty")
    archive_root = inspect_archive(rootfs)
    validate_binary(binary)
    with tempfile.TemporaryDirectory(prefix="liskov-cargo-image-") as temporary:
        extracted = Path(temporary) / "rootfs"
        extracted.mkdir()
        subprocess.run(
            [
                "tar",
                "--extract",
                "--file",
                str(rootfs),
                "--directory",
                str(extracted),
                "--no-same-owner",
                "--same-permissions",
            ],
            check=True,
        )
        target = safe_install_target(extracted, archive_root, install_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and not target.is_file():
            raise BuildError("install-path replaces a non-regular rootfs entry")
        shutil.copyfile(binary, target)
        target.chmod(0o755)
        os.utime(target, ns=(0, 0), follow_symlinks=False)
        create_archive(extracted, archive_root, output)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rootfs", type=Path, required=True)
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--install-path", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        build(args.rootfs, args.binary, args.install_path, args.output)
    except (BuildError, OSError, subprocess.SubprocessError, tarfile.TarError) as error:
        raise SystemExit(f"cargo runtime image build failed: {error}") from error
    print(f"sha256:{sha256(args.output)}")


if __name__ == "__main__":
    main()
