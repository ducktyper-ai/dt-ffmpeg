# dt-ffmpeg development

UV := uv

.PHONY: help setup format lint type test build check verify doctor hooks clean

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

hooks:
	@mkdir -p .git/hooks
	@printf '#!/bin/sh\nexec make verify\n' > .git/hooks/pre-push
	@chmod +x .git/hooks/pre-push
	@echo "Installed .git/hooks/pre-push -> make verify"

clean:
	rm -rf build dist .coverage htmlcov .pytest_cache .ruff_cache
