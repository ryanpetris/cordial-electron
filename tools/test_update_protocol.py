"""Exercise release selection, archive safety and replacement of generated outputs."""
from io import BytesIO
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

from update_protocol import FIXTURES, LATEST, extract_sources, update


def archive(files, links=()):
    data = BytesIO()
    with tarfile.open(fileobj=data, mode="w:gz") as tar:
        for name, content in files:
            info = tarfile.TarInfo(name)
            info.size = len(content)
            tar.addfile(info, BytesIO(content))
        for name in links:
            info = tarfile.TarInfo(name)
            info.type = tarfile.SYMTYPE
            info.linkname = "/outside"
            tar.addfile(info)
    return data.getvalue()


class ProtocolUpdate(unittest.TestCase):
    def test_extracts_only_sources_and_rejects_unsafe_archives(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            extract_sources(archive([
                ("cordial/proto/handshake.proto", b"schema"),
                ("cordial/buf.yaml", b"config"),
                (f"cordial/{FIXTURES}handshake.json", b"[]"),
                (f"cordial/{FIXTURES}options/custom.proto", b"unused fixture"),
                ("cordial/AGENTS.md", b"unrelated instructions"),
            ]), root)
            self.assertEqual((root / "proto/handshake.proto").read_bytes(), b"schema")
            self.assertFalse((root / "AGENTS.md").exists())
            self.assertFalse((root / FIXTURES / "options").exists())
            bad = [
                archive([("cordial/../outside", b"bad")]),
                archive([("/absolute", b"bad")]),
                archive([], ["cordial/proto/linked.proto"]),
                archive([("cordial/buf.yaml", b"one"), ("cordial/buf.yaml", b"two")]),
                archive([("one/buf.yaml", b"one"), ("two/proto/a.proto", b"two")]),
            ]
            for data in bad:
                with self.subTest(data=data), self.assertRaises(ValueError):
                    extract_sources(data, root)

    def test_latest_and_explicit_tags_replace_outputs_only_after_success(self):
        data = archive([
            ("cordial/buf.yaml", b"config"),
            ("cordial/proto/serial/current", b"1\n"),
            ("cordial/proto/serial/v1/schema.sha256", b"digest\n"),
            (f"cordial/{FIXTURES}handshake.json", b"[]"),
            (f"cordial/{FIXTURES}fingerprint/schema.sha256", b"fixture\n"),
        ])

        def generate(command, **kwargs):
            output = Path(command[-1])
            (output / "src/gen").mkdir(parents=True)
            (output / "src/gen/messages.ts").write_text("generated")
            (output / "src/current.ts").write_text("current")

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / "desktop/packages/protocol"
            (package / "src/gen").mkdir(parents=True)
            stale = package / "src/gen/stale.ts"
            stale.write_text("stale")
            with patch("update_protocol.download", side_effect=[b'{"tag_name":"v1.2.3"}', data]) as get, patch("update_protocol.subprocess.run", side_effect=generate):
                update(root=root)
            self.assertEqual(get.call_args_list[0].args, (LATEST,))
            self.assertEqual(get.call_args_list[1].args, ("https://github.com/ryanpetris/cordial/archive/refs/tags/v1.2.3.tar.gz",))
            self.assertFalse(stale.exists())
            metadata = json.loads((package / "source.json").read_text())
            self.assertEqual(metadata["tag"], "v1.2.3")
            self.assertEqual(len(metadata["archive_sha256"]), 64)
            self.assertEqual((package / "test/fixtures/handshake.json").read_text(), "[]")
            before = {p.relative_to(package): p.read_bytes() for p in package.rglob("*") if p.is_file()}
            for failure in (RuntimeError("download failed"), subprocess.CalledProcessError(1, "node")):
                with patch("update_protocol.download", side_effect=failure if isinstance(failure, RuntimeError) else None, return_value=data), patch("update_protocol.subprocess.run", side_effect=failure), self.assertRaises(type(failure)):
                    update("v2.0.0", root=root)
                self.assertEqual(before, {p.relative_to(package): p.read_bytes() for p in package.rglob("*") if p.is_file()})
            with patch("update_protocol.download", return_value=data) as get, patch("update_protocol.subprocess.run", side_effect=generate):
                update("v2.0.0", root=root)
            get.assert_called_once_with("https://github.com/ryanpetris/cordial/archive/refs/tags/v2.0.0.tar.gz")
            self.assertEqual(json.loads((package / "source.json").read_text())["tag"], "v2.0.0")
