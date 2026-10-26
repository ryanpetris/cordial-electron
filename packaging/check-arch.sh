#!/usr/bin/env bash
# Checks desktop installation, reinstallation and removal in a clean Arch container.
# Collects the package and its checksum in release/. Run as root from the repository root.
set -euxo pipefail
install_owner=(-o "$(stat -c %u .)" -g "$(stat -c %g .)")
pacman -Syu --noconfirm namcap python
sed -i '/^NoExtract.*usr\/share\/doc/d' /etc/pacman.conf
test ! -e /usr/bin/cordial-desktop
pacman -U --noconfirm build/packages/desktop-arch/cordial-desktop-*.pkg.tar.zst
python tools/check_linux_package.py cordial-desktop --version "$CORDIAL_VERSION"
test ! -e /usr/bin/cordial
test ! -e /opt/cordial-desktop/cordial
# Bundled Electron belongs in /opt under the Arch Electron guidelines.
install "${install_owner[@]}" -m 644 /dev/null namcap.log
namcap -e elfpaths build/packages/desktop-arch/cordial-desktop-*.pkg.tar.zst > namcap.log
cat namcap.log
if grep -q ' E:' namcap.log; then exit 1; fi
pacman -U --noconfirm build/packages/desktop-arch/cordial-desktop-*.pkg.tar.zst
test ! -e /usr/bin/cordial
python tools/check_linux_package.py cordial-desktop --version "$CORDIAL_VERSION"
pacman -R --noconfirm cordial-desktop
test ! -e /usr/bin/cordial-desktop
install "${install_owner[@]}" -d release
install "${install_owner[@]}" -m 644 build/packages/desktop-arch/*.pkg.tar.zst release/
install "${install_owner[@]}" -m 644 /dev/null release/SHA256SUMS-arch
cd release
sha256sum ./*.pkg.tar.zst > SHA256SUMS-arch
