# dt-ffmpeg development

UV := uv

.PHONY: help setup format lint type test build check verify doctor hooks release clean

help:
	@echo "dt-ffmpeg"
	@echo "  make setup    Install dev + mcp extras via uv"
	@echo "  make format   Format with ruff"
	@echo "  make lint     Ruff lint and format check"
	@echo "  make type     ty type check"
	@echo "  make test     pytest with coverage gate"
	@echo "  make build    Build sdist and wheel"
	@echo "  make verify   lint + type + test + build (the release gate)"
	@echo "  make doctor   dt-ffmpeg doctor (ffmpeg/ffprobe resolution)"
	@echo "  make hooks    Install a git pre-push hook that runs make verify"
	@echo "  make release  Archive of the tagged HEAD + .sha256 (darwin-arm64 naming)"
	@echo "  make clean    Remove build and cache output"

setup:
	$(UV) sync --extra dev --extra mcp

format:
	$(UV) run ruff format src tests examples

lint:
	$(UV) run ruff check src tests examples
	$(UV) run ruff format --check src tests examples

type:
	$(UV) run ty check

test:
	$(UV) run pytest

build:
	$(UV) build

verify: lint type test build

# Kept as an alias for the previous target name.
check: verify

doctor:
	$(UV) run dt-ffmpeg doctor

# Release archive of the exact commit. No build step: pure Python, installed with uv from the archive.
# Output: dist/dt-ffmpeg-<version>-darwin-arm64.tar.gz and .sha256. HEAD must carry tag v<version>.
VERSION := $(shell sed -n 's/^__version__ = "\(.*\)"/\1/p' src/dt_ffmpeg/__init__.py | head -1)
ARCHIVE := dist/dt-ffmpeg-$(VERSION)-darwin-arm64.tar.gz

release:
	@test -z "$$(git status --porcelain)" || { echo "tree not clean" >&2; exit 1; }
	@git describe --exact-match --tags HEAD 2>/dev/null | grep -qx "v$(VERSION)" || { echo "HEAD must be tagged v$(VERSION)" >&2; exit 1; }
	@grep -q "^## \[$(VERSION)\]" CHANGELOG.md || { echo "CHANGELOG has no $(VERSION) entry" >&2; exit 1; }
	@mkdir -p dist
	git archive --format=tar.gz --prefix=dt-ffmpeg-$(VERSION)/ -o $(ARCHIVE) HEAD
	cd dist && shasum -a 256 $(notdir $(ARCHIVE)) > $(notdir $(ARCHIVE)).sha256
	@cat $(ARCHIVE).sha256

hooks:
	@mkdir -p .git/hooks
	@printf '#!/bin/sh\nexec make verify\n' > .git/hooks/pre-push
	@chmod +x .git/hooks/pre-push
	@echo "Installed .git/hooks/pre-push -> make verify"

clean:
	rm -rf build dist .coverage htmlcov .pytest_cache .ruff_cache
