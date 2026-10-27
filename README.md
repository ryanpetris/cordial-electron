<p align="center">
  <img src="desktop/assets/icons/app.svg" width="112" alt="">
</p>

<h1 align="center">Cordial Electron</h1>

<p align="center">
  <strong>Set up your Cordial adapter from your desktop.</strong>
</p>

<p align="center">
  The desktop app for <a href="https://github.com/ryanpetris/cordial">Cordial</a>,
  the Bluetooth-to-USB keyboard and mouse adapter. Pair your devices, configure
  device and adapter settings, and check connection status, battery levels and
  charging status when available.
</p>

<p align="center">
  Device and adapter settings stay on your adapter, so your keyboard and mouse
  keep working when the app is closed or you move the adapter to another computer.
</p>

<p align="center">
  <a href="https://github.com/ryanpetris/cordial-electron/releases/latest"><img src="https://img.shields.io/github/v/release/ryanpetris/cordial-electron?label=latest" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/desktop-Linux%20%7C%20Windows%20%7C%20macOS-informational" alt="Desktop app: Linux, Windows and macOS">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://github.com/ryanpetris/cordial-electron/releases/latest"><b>Download</b></a>
  &nbsp;&middot;&nbsp;
  <a href="#install">Install</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/ryanpetris/cordial">Cordial project</a>
</p>

## Install

Download the `cordial-desktop` package for your operating system from
[the app releases](https://github.com/ryanpetris/cordial-electron/releases).

### Windows

Download `cordial-desktop-*-windows-x64.exe` and run the installer. The installer
is unsigned, so Windows may show an unknown-publisher or SmartScreen warning.
Install only a package you trust. Cordial uses the standard USB serial driver;
no separate driver installation is expected.

### macOS

Download `cordial-desktop-*-macos-arm64.dmg` for Apple Silicon or
`cordial-desktop-*-macos-x64.dmg` for Intel. Open the disk image and drag Cordial
to Applications.

These packages are unsigned and not notarized. If macOS blocks a trusted download,
try opening Cordial, then use System Settings > Privacy & Security > Open Anyway
if offered. An unsigned build can also be rejected as damaged; downloading and
opening the release on a separate Mac needs manual validation before distribution.
See [Apple's instructions](https://support.apple.com/en-us/102445).
Start at Login may not work reliably with an unsigned app. Apple Silicon laptops
may also ask you to allow the USB adapter to connect.

### Debian and Ubuntu

Choose the Linux x86-64 package matching your distribution:

- Debian 13 Trixie: `cordial-desktop_*trixie_amd64.deb`
- Ubuntu 24.04 Noble: `cordial-desktop_*noble_amd64.deb`
- Ubuntu 26.04 Resolute: `cordial-desktop_*resolute_amd64.deb`

In the directory containing the downloaded package, run:

```sh
sudo apt install ./cordial-desktop_*_amd64.deb
```

### Arch Linux

Download `cordial-desktop-*-x86_64.pkg.tar.zst`, then run in that directory:

```sh
sudo pacman -U ./cordial-desktop-*-x86_64.pkg.tar.zst
```

## Connect

Launch Cordial from your application menu and connect an adapter running Cordial
firmware by USB. Choose Add Device to pair a keyboard or mouse, or select an
existing device to view its status and settings.

## Development

Install Node.js (`^22.12.0 || ^24.0.0 || >=26.0.0`), npm, Python 3, Git, Make, a C++ compiler, `pkg-config`,
and the libudev development headers. On Debian and Ubuntu, the native build
prerequisites are `build-essential`, `pkg-config`, and `libudev-dev`.

Clone and build:

```sh
git clone https://github.com/ryanpetris/cordial-electron.git
cd cordial-electron
make check build web
```

Protocol bindings and shared wire fixtures are committed in
`desktop/packages/protocol/`. Builds and tests use those files without downloading
Cordial. Release compatibility checks run in the main Cordial repository.

To update the bindings, install dependencies and run the update script:

```sh
make deps
python3 tools/update_protocol.py
```

The script finds the latest published release through GitHub's releases API and
downloads its source tar archive. To select a tag explicitly, pass it as an
argument:

```sh
python3 tools/update_protocol.py v0.10.4
```

`npm --prefix desktop run update:protocol -- v0.10.4` runs the same script.
The script extracts schemas, Buf configuration, and shared test fixtures into a
temporary directory. It lints the schemas, verifies the upstream fingerprints,
and generates TypeScript before replacing the committed outputs.
`desktop/packages/protocol/source.json` records the tag, archive URL, and SHA-256.
The schemas themselves are not committed.

Review and commit `src/gen/`, `src/current.ts`, `test/fixtures/`, and `source.json`
together after running `make check build web`. See `AGENTS.md` for the binding
update procedure.

`make check` runs TypeScript checks, desktop and client tests, offline generator
tests, and repository tool tests. `make package-desktop package-web` builds
portable packages. Native package and installed desktop checks run in
`.github/workflows/release.yml`.

### Windows and macOS builds

Install Node.js and npm using the versions above. From `desktop/`, run:

```sh
npm ci --include=dev
node node_modules/electron/install.js
npm run check
npm run package
```

`npm run package` builds for the current operating system and CPU architecture,
using the bundled native dependencies. It writes packages to `desktop/dist/`.
Set `CORDIAL_VERSION` to a release version such as `1.2.3` before building;
it defaults to `0.0.0`. Windows builds produce an unsigned NSIS installer, and
macOS builds produce an unsigned, unnotarized disk image. Neither requires
signing credentials. Linux builds produce an AppImage and tar archive.

GitHub Actions builds Windows x64 and separate macOS x64 and arm64 packages.
Each job installs its package, loads the native serial and USB modules, and runs
the simulated UI checks.

The release workflow runs when a tag such as `v1.2.3` is pushed. Tags must use
`vMAJOR.MINOR.PATCH` without leading zeroes or prerelease suffixes. The workflow
uses the tag's version (`1.2.3`) for application metadata and package names. After
all checks pass, it publishes a GitHub Release with Linux AppImage, tar, Arch and
Debian/Ubuntu packages, the Windows installer, both macOS disk images, the web
archive, and `SHA256SUMS`. Windows and macOS packages remain unsigned. Branch
pushes and pull requests do not run CI; run `make check build web` locally.

If publication fails after creating a draft release, delete the incomplete draft
before rerunning the publish job.

Before releasing on a new platform, check a real adapter: discovery, pairing,
unplug/replug, a settings change that restarts USB, and reconnecting after the app
exits. Also check tray menus, notifications, starting hidden at login and sleep/wake.
Hosted CI uses simulated adapters and cannot verify physical USB communication.
