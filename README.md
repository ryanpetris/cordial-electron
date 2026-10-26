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
  <img src="https://img.shields.io/badge/desktop-Linux%20x86--64-informational" alt="Desktop app: Linux x86-64">
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

Download the `cordial-desktop` package for your Linux x86-64 distribution from
[the app releases](https://github.com/ryanpetris/cordial-electron/releases).

### Debian and Ubuntu

Choose the package matching your distribution:

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
