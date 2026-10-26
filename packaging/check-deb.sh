#!/usr/bin/env bash
# Checks desktop installation, reinstallation and removal in a clean DEB_DISTRIBUTION container.
# Collects the package and its checksum in release/. Run as root from the repository root.
set -euxo pipefail
install_owner=(-o "$(stat -c %u .)" -g "$(stat -c %g .)")
export DEBIAN_FRONTEND=noninteractive
packages=build/packages
apt-get update
apt-get install -y --no-install-recommends lintian python3
echo 'path-include=/usr/share/doc/cordial-*' > /etc/dpkg/dpkg.cfg.d/zz-cordial-check
test ! -e /usr/bin/cordial-desktop
apt-get install -y --no-install-recommends ./$packages/desktop-deb/"$DEB_DISTRIBUTION"/cordial-desktop_*_amd64.deb
python3 tools/check_linux_package.py cordial-desktop --debian --version "$CORDIAL_VERSION"
test ! -e /usr/bin/cordial
test ! -e /opt/cordial-desktop/cordial
# Vendor ELF files retain their published bytes under /opt.
lintian --suppress-tags dir-or-file-in-opt,embedded-library,shared-library-is-executable,unstripped-binary-or-object $packages/desktop-deb/"$DEB_DISTRIBUTION"/*.deb
apt-get install -y --reinstall ./$packages/desktop-deb/"$DEB_DISTRIBUTION"/*.deb
test ! -e /usr/bin/cordial
python3 tools/check_linux_package.py cordial-desktop --debian --version "$CORDIAL_VERSION"
apt-get purge -y cordial-desktop
test ! -e /usr/bin/cordial-desktop
install "${install_owner[@]}" -d release
install "${install_owner[@]}" -m 644 $packages/desktop-deb/"$DEB_DISTRIBUTION"/*.deb release/
install "${install_owner[@]}" -m 644 /dev/null "release/SHA256SUMS-$DEB_DISTRIBUTION"
cd release
sha256sum ./*.deb > "SHA256SUMS-$DEB_DISTRIBUTION"
