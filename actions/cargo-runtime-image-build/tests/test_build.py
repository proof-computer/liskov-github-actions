from __future__ import annotations

import importlib.util
import io
import tarfile
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "build.py"
SPEC = importlib.util.spec_from_file_location("cargo_runtime_image_build", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)


class CargoRuntimeImageBuildTests(unittest.TestCase):
    def test_archive_requires_one_safe_helperless_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive_path = Path(temporary) / "root.tar.xz"
            with tarfile.open(archive_path, "w:xz") as archive:
                root = tarfile.TarInfo("root")
                root.type = tarfile.DIRTYPE
                archive.addfile(root)
                file = tarfile.TarInfo("root/etc/issue")
                content = b"Liskov\n"
                file.size = len(content)
                archive.addfile(file, io.BytesIO(content))
            self.assertEqual(BUILD.inspect_archive(archive_path), "root")

    def test_archive_rejects_helper_and_traversal(self) -> None:
        for name in ["root/usr/bin/liskov-runtime-contact", "../escape"]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temporary:
                archive_path = Path(temporary) / "bad.tar"
                with tarfile.open(archive_path, "w") as archive:
                    member = tarfile.TarInfo(name)
                    member.size = 1
                    archive.addfile(member, io.BytesIO(b"x"))
                with self.assertRaises(BUILD.BuildError):
                    BUILD.inspect_archive(archive_path)

    def test_static_aarch64_elf_validation_is_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            binary = Path(temporary) / "app"
            elf = bytearray(64)
            elf[:6] = b"\x7fELF\x02\x01"
            elf[18:20] = (183).to_bytes(2, "little")
            elf[32:40] = (64).to_bytes(8, "little")
            elf[54:56] = (56).to_bytes(2, "little")
            elf[56:58] = (0).to_bytes(2, "little")
            binary.write_bytes(elf)
            BUILD.validate_binary(binary)
            elf[18:20] = (62).to_bytes(2, "little")
            binary.write_bytes(elf)
            with self.assertRaises(BUILD.BuildError):
                BUILD.validate_binary(binary)


if __name__ == "__main__":
    unittest.main()
