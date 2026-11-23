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
# Output: dist/dt-ffmpeg-<version>-darwin-arm64.tar.gz and .sha256. The tag v<version> must be on MAIN_REF; the archive is made from the tagged commit.
VERSION := $(shell sed -n 's/^__version__ = "\(.*\)"/\1/p' src/dt_ffmpeg/__init__.py | head -1)
ARCHIVE := dist/dt-ffmpeg-$(VERSION)-darwin-arm64.tar.gz

# MAIN_REF is the canonical main; fetch it first (git fetch upstream main). Override on hosts with another remote name.
MAIN_REF ?= upstream/main

release:
	@set -e; tag="v$(VERSION)"; \
	git rev-parse -q --verify "refs/tags/$$tag" >/dev/null || { echo "tag $$tag does not exist" >&2; exit 1; }; \
	commit=$$(git rev-list -n1 "$$tag"); \
	git merge-base --is-ancestor "$$commit" "$(MAIN_REF)" || { echo "$$tag ($$commit) is not on $(MAIN_REF)" >&2; exit 1; }; \
	tagged=$$(git show "$$commit:src/dt_ffmpeg/__init__.py" | sed -n 's/^__version__ = "\(.*\)"/\1/p' | head -1); \
	test "$$tagged" = "$(VERSION)" || { echo "tagged __version__ $$tagged != $(VERSION)" >&2; exit 1; }; \
	git show "$$commit:CHANGELOG.md" | grep -q "^## \[$(VERSION)\]" || { echo "tagged CHANGELOG has no $(VERSION) entry" >&2; exit 1; }; \
	test ! -e $(ARCHIVE) || { echo "$(ARCHIVE) exists; refusing to overwrite a release" >&2; exit 1; }; \
	mkdir -p dist; \
	git archive --format=tar.gz --prefix=dt-ffmpeg-$(VERSION)/ -o $(ARCHIVE) "$$commit"; \
	(cd dist && shasum -a 256 $(notdir $(ARCHIVE)) > $(notdir $(ARCHIVE)).sha256); \
	echo "archived $$tag = $$commit"; cat $(ARCHIVE).sha256

hooks:
	@d="$$(git rev-parse --git-path hooks)"; mkdir -p "$$d"; \
	if [ -e "$$d/pre-push" ] && ! grep -q "make verify" "$$d/pre-push"; then \
	  echo "existing pre-push hook kept; add 'make verify' to it by hand" >&2; exit 1; fi; \
	printf '#!/bin/sh\nexec make verify\n' > "$$d/pre-push"; chmod +x "$$d/pre-push"; \
	echo "pre-push -> make verify ($$d)"

clean:
	rm -rf build dist .coverage htmlcov .pytest_cache .ruff_cache
