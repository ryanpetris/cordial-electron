.DEFAULT_GOAL := help
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.ONESHELL:
PYTHON ?= python3
DOCKER ?= docker
export CORDIAL_VERSION ?= 0.0.0
export npm_config_cache ?= $(CURDIR)/.cache/npm
export electron_config_cache ?= $(CURDIR)/.cache/electron
export ELECTRON_BUILDER_CACHE ?= $(CURDIR)/.cache/electron-builder
DESKTOP_TARGETS ?= AppImage tar.gz
desktop_archive = $(or $(DESKTOP_ARCHIVE),desktop/dist/cordial-desktop-$(CORDIAL_VERSION)-x64.tar.gz)
DEB_DISTRIBUTION ?= trixie
DEB_BASE_trixie := debian:13
DEB_BASE_noble := ubuntu:24.04
DEB_BASE_resolute := ubuntu:26.04
DEB_BASE = $(or $(DEB_BASE_$(DEB_DISTRIBUTION)),$(error Unknown DEB_DISTRIBUTION $(DEB_DISTRIBUTION)))

.PHONY: help deps build desktop web start simulate check check-desktop check-tools \
	package-desktop package-desktop-tar package-web package-desktop-arch package-desktop-deb \
	image-arch image-deb smoke version clean

help:
	@echo 'Cordial Electron: deps build web start simulate check smoke clean'
	@echo 'Packages: package-desktop package-desktop-tar package-web package-desktop-arch package-desktop-deb'
	@echo 'Options: CORDIAL_VERSION=$(CORDIAL_VERSION) DEB_DISTRIBUTION=$(DEB_DISTRIBUTION)'

desktop/node_modules/.cordial-deps: desktop/package.json desktop/package-lock.json $(wildcard desktop/packages/*/package.json)
	npm ci --include=dev --prefix desktop
	node desktop/node_modules/electron/install.js
	touch $@

deps: desktop/node_modules/.cordial-deps
build desktop: deps
	npm --prefix desktop run build
	cp THIRD_PARTY_NOTICES.txt desktop/out/main/
web: deps
	npm --prefix desktop run build:web
	cp THIRD_PARTY_NOTICES.txt desktop/out/web/
start: build
	cd desktop
	npm exec -- electron .
simulate: build
	cd desktop
	CORDIAL_DESKTOP_SIMULATE=2 npm exec -- electron .

check: check-desktop check-tools
check-desktop: deps
	npm --prefix desktop run check
check-tools: deps
	$(PYTHON) -m unittest discover -s tools -p 'test_*.py'

package-desktop-tar: DESKTOP_TARGETS = tar.gz
package-desktop package-desktop-tar: deps
	npm --prefix desktop run package -- $(DESKTOP_TARGETS)

package-web: web
	version=$$($(PYTHON) tools/version.py)
	destination="build/packages/web/cordial-web-$$version"
	rm -rf "$$destination"
	mkdir -p "$$destination"
	cp -R desktop/out/web/. "$$destination/"
	cp LICENSE "$$destination/"
	printf '%s\n' "$$version" > "$$destination/VERSION"

image-arch:
	$(DOCKER) build -t cordial-electron-arch -f docker/arch.Dockerfile desktop/packaging/arch
image-deb:
	$(DOCKER) build -t cordial-electron-deb-$(DEB_DISTRIBUTION) --build-arg BASE=$(DEB_BASE) -f docker/deb.Dockerfile desktop/packaging/debian

package-desktop-arch: image-arch $(if $(DESKTOP_ARCHIVE),,package-desktop-tar)
package-desktop-deb: image-deb $(if $(DESKTOP_ARCHIVE),,package-desktop-tar)
package-desktop-arch package-desktop-deb:
	output="build/packages/desktop-$(if $(filter package-desktop-arch,$@),arch,deb/$(DEB_DISTRIBUTION))"
	mkdir -p "$$output"
	archive=$$(realpath --relative-to="$(CURDIR)" "$(desktop_archive)")
	case "$$archive" in ../*|/*) echo 'DESKTOP_ARCHIVE must be inside this checkout' >&2; exit 1 ;; esac
	$(DOCKER) run --rm -v "$(CURDIR):/src:ro" -v "$(CURDIR)/$$output:/out/$${output#build/packages/}" -w /src \
		-e CORDIAL_VERSION -e SOURCE_DATE_EPOCH -e CORDIAL_HOMEPAGE \
		-e OUTPUT_OWNER="$$(id -u):$$(id -g)" \
		$(if $(filter package-desktop-arch,$@),cordial-electron-arch,cordial-electron-deb-$(DEB_DISTRIBUTION)) \
		bash -eu -c 'trap '\''chown -hR "$$OUTPUT_OWNER" /out'\'' EXIT; "$$@"' bash \
		$(if $(filter package-desktop-arch,$@),/opt/cordial-run) \
		make -f packaging/Makefile $(if $(filter package-desktop-arch,$@),arch,deb) \
		DESKTOP_ARCHIVE="$$archive" OUTPUT_ROOT=/out DEB_DISTRIBUTION=$(DEB_DISTRIBUTION) $(if $(DEB_REVISION),DEB_REVISION=$(DEB_REVISION))

smoke: build
	cd desktop
	xvfb-run -a dbus-run-session -- node scripts/smoke.mjs out/smoke
version:
	@$(PYTHON) tools/version.py
clean:
	rm -rf desktop/out desktop/dist build/packages
