SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.ONESHELL:
PYTHON ?= python3
export CORDIAL_HOMEPAGE ?= https://github.com/ryanpetris/cordial-electron
DEB_DISTRIBUTION ?= $(shell . /etc/os-release; echo "$${VERSION_CODENAME:-unstable}")
DEB_REVISION ?= 1~$(DEB_DISTRIBUTION)
RECIPE := desktop/packaging
OUTPUT_ROOT ?= $(CURDIR)/build/packages

define prepare
test "$$(uname -sm)" = 'Linux x86_64' || { echo 'Distribution packages require Linux x86-64' >&2; exit 1; }
version=$$("$(PYTHON)" tools/version.py)
export CORDIAL_VERSION="$$version"
archive="$(DESKTOP_ARCHIVE)"
if test -z "$$archive"; then
    archive="desktop/dist/cordial-desktop-$$version-x64.tar.gz"
fi
epoch=$$("$(PYTHON)" tools/check_release_archive.py "$$archive" desktop "$$version")
export SOURCE_DATE_EPOCH=$${SOURCE_DATE_EPOCH:-$$epoch}
output="$(OUTPUT_ROOT)/desktop-$@$(if $(filter deb,$@),/$(DEB_DISTRIBUTION))"
mkdir -p "$$output"
endef

.PHONY: arch deb
arch:
	command -v makepkg >/dev/null
	command -v fakeroot >/dev/null
	$(prepare)
	cp "$(RECIPE)/arch/PKGBUILD" "$$output/"
	filename="cordial-desktop-$$version-x64.tar.gz"
	test "$$archive" -ef "$$output/$$filename" || cp -- "$$archive" "$$output/$$filename"
	export CORDIAL_ARCHIVE_SHA256=$$(sha256sum "$$output/$$filename" | cut -d' ' -f1)
	cd "$$output"
	makepkg --force --cleanbuild --nosign "PKGDEST=$$output" PKGEXT=.pkg.tar.zst

deb:
	command -v dpkg-buildpackage >/dev/null
	command -v dch >/dev/null
	$(prepare)
	source="$$output/cordial-desktop-$$version"
	rm -rf -- "$$source"
	mkdir -p "$$source"
	mkdir "$$source/payload"
	tar --no-same-owner --strip-components=1 -C "$$source/payload" -xzf "$$archive"
	cp "$$source/payload/LICENSE" "$$source/LICENSE"
	cp -R "$(RECIPE)/debian" "$$source/debian"
	cd "$$source"
	cp LICENSE debian/copyright
	DEBEMAIL="$$(dpkg-parsechangelog -S Maintainer)" dch --no-auto-nmu --preserve --force-bad-version --newversion "$$version-$(DEB_REVISION)" --distribution '$(DEB_DISTRIBUTION)' "Cordial $$version."
	dpkg-buildpackage --build=binary --no-sign
