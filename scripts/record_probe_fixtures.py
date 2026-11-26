"""Record ffprobe fixtures and the Python reference's reading of them. Run on ENG-UK or Linux, never the Mac mini:

    cd reference/python && uv sync --locked --extra dev
    uv run python ../../scripts/record_probe_fixtures.py --out <dir>

Needs ffmpeg and ffprobe 8.1.2 on PATH. For each input it writes <name>.json (raw ffprobe output) and one
summaries.json with the values Python's ProbeResult derives from them.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from dt_ffmpeg.probe import ProbeResult

SAMPLES = Path(__file__).resolve().parent.parent / "reference" / "python" / "tests" / "sample_data"
FIELDS = {
    "durationSeconds": "duration_seconds",
    "bitrateBps": "bitrate_bps",
    "width": "width",
    "height": "height",
    "videoCodec": "video_codec",
    "audioCodec": "audio_codec",
    "fps": "fps",
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True)
    out = parser.parse_args().out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    version = subprocess.run(["ffprobe", "-version"], check=True, capture_output=True, text=True).stdout.splitlines()[0]
    if "8.1.2" not in version:
        raise SystemExit(f"need ffprobe 8.1.2, found: {version}")

    summaries = {}
    with tempfile.TemporaryDirectory() as tmp:
        tone = Path(tmp) / "tone.m4a"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=duration=1", "-metadata", "title=Tone", str(tone)],
            check=True,
        )
        for name, source in (
            ("video", SAMPLES / "in1.mp4"),
            ("image", SAMPLES / "overlay.png"),
            ("audio", tone),
        ):
            # Run from the file's directory so no host path lands in the fixture.
            raw = subprocess.run(
                ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", source.name],
                check=True,
                capture_output=True,
                text=True,
                cwd=source.parent,
            ).stdout
            (out / f"{name}.json").write_text(raw, encoding="utf-8")
            result = ProbeResult.model_validate_json(raw)
            summaries[name] = {key: getattr(result, attr) for key, attr in FIELDS.items()}
    (out / "summaries.json").write_text(json.dumps(summaries, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(version)


if __name__ == "__main__":
    main()
