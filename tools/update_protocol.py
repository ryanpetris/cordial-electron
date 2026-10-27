#!/usr/bin/env python3
"""Update committed protocol bindings and fixtures from a Cordial release archive."""
import argparse
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile
import tempfile
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "https://github.com/ryanpetris/cordial"
LATEST = "https://api.github.com/repos/ryanpetris/cordial/releases/latest"
FIXTURES = "rust/crates/cordial-protocol/tests/fixtures/"


def download(url):
    with urlopen(Request(url, headers={"User-Agent": "cordial-electron"}), timeout=60) as response:
        return response.read()


def extract_sources(data, destination):
    """Copy selected regular files without following archive links or parent paths."""
    seen = set()
    roots = set()
    with tarfile.open(fileobj=BytesIO(data), mode="r:gz") as archive:
        for member in archive:
            path = PurePosixPath(member.name)
            if path.is_absolute() or ".." in path.parts:
                raise ValueError(f"Unsafe archive path: {member.name}")
            if len(path.parts) < 2 or member.isdir():
                continue
            relative = PurePosixPath(*path.parts[1:])
            name = relative.as_posix()
            if not (name == "buf.yaml" or name.startswith("proto/")
                    or name == FIXTURES + "handshake.json" or name.startswith(FIXTURES + "fingerprint/")):
                continue
            if not member.isfile() or name in seen:
                raise ValueError(f"Expected a unique regular file: {member.name}")
            roots.add(path.parts[0])
            if len(roots) != 1:
                raise ValueError("Expected one source archive root")
            seen.add(name)
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(member) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)


def update(tag=None, root=ROOT):
    if tag is None:
        tag = json.loads(download(LATEST))["tag_name"]
    if not isinstance(tag, str) or not tag or tag in (".", "..") or tag.startswith("-"):
        raise ValueError("Expected a nonempty release tag")
    url = f"{REPOSITORY}/archive/refs/tags/{quote(tag, safe='')}.tar.gz"
    print(f"Downloading Cordial {tag}", flush=True)
    data = download(url)
    package = root / "desktop/packages/protocol"
    with tempfile.TemporaryDirectory(prefix="cordial-update-") as temporary:
        source = Path(temporary) / "source"
        output = Path(temporary) / "output"
        extract_sources(data, source)
        env = {**os.environ, "PATH": str(root / "desktop/node_modules/.bin") + os.pathsep + os.environ.get("PATH", "")}
        subprocess.run(["node", str(package / "scripts/generate.mjs"), str(source), str(output)],
                       cwd=package, env=env, check=True)
        fixtures = output / "test/fixtures"
        shutil.copytree(source / FIXTURES, fixtures)
        shutil.copyfile(source / "buf.yaml", fixtures / "buf.yaml")
        revision = (source / "proto/serial/current").read_text().strip()
        shutil.copyfile(source / f"proto/serial/v{revision}/schema.sha256", fixtures / "schema.sha256")
        # These fixtures are required by the TypeScript handshake and fingerprint tests.
        for required in ("handshake.json", "fingerprint/schema.sha256"):
            if not (fixtures / required).is_file():
                raise ValueError(f"Missing upstream fixture: {required}")
        metadata = {"tag": tag, "archive_url": url, "archive_sha256": sha256(data).hexdigest()}
        (output / "source.json").write_text(json.dumps(metadata, indent=2) + "\n")
        # Download, extraction and generation finish before committed outputs are replaced.
        for relative in ("src/gen", "test/fixtures"):
            target = package / relative
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(output / relative, target)
        for relative in ("src/current.ts", "source.json"):
            shutil.copyfile(output / relative, package / relative)
    print(f"Updated protocol bindings and fixtures to {tag}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tag", nargs="?", help="Cordial tag, such as v0.10.4; defaults to the latest GitHub release")
    args = parser.parse_args()
    update(args.tag)


if __name__ == "__main__":
    main()
