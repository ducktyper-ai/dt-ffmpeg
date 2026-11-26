"""One-time export of golden (graph, argv) pairs from the frozen Python reference.

Run by Runtime on ENG-UK or Linux, never on the Mac mini (design SOW 3.3):

    cd reference/python && uv sync --locked --extra dev
    uv run python ../../scripts/export_golden.py --out ../../tests/golden

What it records, so the TypeScript parity suite has something exact to compare against:

* compile.json  every graph that `tests/test_compile.py` compiles, with the argv Python produced. The tests
                are run in-process under pytest; the compile entry points are wrapped to record each call,
                so no graph is transcribed by hand.
* recipes.json  each of the nine recipes called directly with fixed arguments (test_recipes.py has only three
                tests and does not cover them): graph and argv.
* escape.json   `escape_chars` on the inputs the Python tests use plus a few edge cases.

Calls that raise are not recorded (error text is not part of parity). The script fails if pytest reports a
failing test, so a broken reference cannot silently produce partial goldens. Output is deterministic: sorted
keys, no timestamps. `meta.json` records the reference commit read from reference/python/SOURCE-COMMIT.
"""

from __future__ import annotations

import argparse
import importlib
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
REFERENCE = HERE.parent / "reference" / "python"


class Recorder:
    """Pytest plugin: wraps the compile entry points and records each successful call."""

    def __init__(self) -> None:
        self.cases: list[dict[str, Any]] = []
        self._seen: set[str] = set()
        self._current = ""

    def pytest_runtest_setup(self, item: Any) -> None:
        self._current = item.nodeid

    def record(self, graph: Any, overwrite: Any, argv: list[str]) -> None:
        entry = {
            "source": self._current,
            "graph": graph.model_dump(mode="json"),
            "overwrite": overwrite,
            "argv": list(argv),
        }
        key = json.dumps({k: entry[k] for k in ("graph", "overwrite", "argv")}, sort_keys=True)
        if key in self._seen:
            return
        self._seen.add(key)
        self.cases.append(entry)


def install(recorder: Recorder) -> None:
    # importlib, not `import dt_ffmpeg.compile as ...`: the package re-exports a function named `compile`,
    # which shadows the submodule as an attribute.
    compile_mod = importlib.import_module("dt_ffmpeg.compile")
    fluent_mod = importlib.import_module("dt_ffmpeg.fluent")

    original = compile_mod.get_args

    def wrapped(graph: Any, *, overwrite: bool | None = None) -> list[str]:
        argv = original(graph, overwrite=overwrite)
        recorder.record(graph, overwrite, argv)
        return argv

    compile_mod.get_args = wrapped  # type: ignore[assignment]
    if hasattr(fluent_mod, "get_args_ir"):
        fluent_mod.get_args_ir = wrapped  # type: ignore[assignment]


def export_recipes() -> list[dict[str, Any]]:
    recipes = importlib.import_module("dt_ffmpeg.recipes")
    get_args = importlib.import_module("dt_ffmpeg.compile").get_args

    calls: list[tuple[str, dict[str, Any]]] = [
        ("convert", {"src": "in.mov", "dst": "out.mp4"}),
        ("convert", {"src": "in.mov", "dst": "out.mp4", "overwrite": "never"}),
        ("thumbnail", {"src": "in.mp4", "dst": "thumb.jpg"}),
        ("thumbnail", {"src": "in.mp4", "dst": "thumb.jpg", "time": 12.5}),
        ("transcode_h264", {"src": "in.mov", "dst": "out.mp4"}),
        ("transcode_h264", {"src": "in.mov", "dst": "out.mp4", "crf": 18, "preset": "slow"}),
        ("extract_audio", {"src": "in.mp4", "dst": "out.m4a"}),
        ("extract_audio", {"src": "in.mp4", "dst": "out.mp3", "codec": "libmp3lame"}),
        ("extract_cover", {"src": "in.mp3", "dst": "cover.jpg"}),
        ("scale", {"src": "in.mp4", "dst": "out.mp4"}),
        ("scale", {"src": "in.mp4", "dst": "out.mp4", "width": 640, "height": 360}),
        ("clip", {"src": "in.mp4", "dst": "out.mp4", "start": 5}),
        ("clip", {"src": "in.mp4", "dst": "out.mp4", "start": "00:00:05", "end": "00:00:09.5"}),
        ("burn_subtitles", {"src": "in.mp4", "dst": "out.mp4", "subtitles": "subs.srt"}),
        ("concat_demuxer", {"paths": ["a.mp4", "b.mp4", "c.mp4"], "dst": "out.mp4"}),
    ]
    covered = {name for name, _ in calls}
    missing = set(recipes.RECIPES) - covered
    if missing:
        raise SystemExit(f"recipes without an export case: {sorted(missing)}")
    out = []
    for name, kwargs in calls:
        graph = recipes.run_recipe(name, **kwargs)
        out.append(
            {
                "recipe": name,
                "kwargs": kwargs,
                "graph": graph.model_dump(mode="json"),
                "argv": get_args(graph),
            }
        )
    return out


def export_escape() -> list[dict[str, Any]]:
    escape_chars = importlib.import_module("dt_ffmpeg.escape").escape_chars

    cases: list[tuple[Any, str]] = [
        ("a:b", ":"),
        ("a\\:b", ":\\"),
        ("a:b,c[d]e%{}f'g'h\\i", "\\':,[]%"),
        (123, ":\\"),
        ("", ":"),
        ("plain", ":,"),
        ("c:\\path\\to,file", ":\\,"),
    ]
    return [{"value": value, "chars": chars, "escaped": escape_chars(value, chars)} for value, chars in cases]


def write(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True, help="directory for tests/golden/*.json")
    args = parser.parse_args()

    sys.path.insert(0, str(REFERENCE / "src"))
    import pytest

    recorder = Recorder()
    install(recorder)
    code = pytest.main(
        ["-q", "-o", "addopts=", "-p", "no:cacheprovider", str(REFERENCE / "tests" / "test_compile.py"), f"--rootdir={REFERENCE}"],
        plugins=[recorder],
    )
    if code != 0:
        print(f"test_compile.py did not pass (pytest exit {code}); no goldens written", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    recipes = export_recipes()
    escape = export_escape()
    commit = (REFERENCE / "SOURCE-COMMIT").read_text(encoding="utf-8").strip()
    write(args.out / "compile.json", recorder.cases)
    write(args.out / "recipes.json", recipes)
    write(args.out / "escape.json", escape)
    write(
        args.out / "meta.json",
        {
            "reference_commit": commit,
            "compile_cases": len(recorder.cases),
            "recipe_cases": len(recipes),
            "escape_cases": len(escape),
        },
    )
    print(f"wrote {len(recorder.cases)} compile, {len(recipes)} recipe, {len(escape)} escape cases to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
