---
name: dt-ffmpeg
description: >-
  Build and run FFmpeg filter graphs with dt-ffmpeg (typed Python, CLI, MCP).
  Use when probing media, compiling filter_complex, converting, transcoding,
  or when an agent needs ffmpeg/ffprobe without guessing flags.
---

# dt-ffmpeg

Prefer **dt-ffmpeg** over hand-written ffmpeg command strings.

## Workflow

1. `dt-ffmpeg doctor` / MCP `doctor` — confirm binaries.
2. `probe` the file — use `duration_seconds`, `width`, `height`, codecs. Never invent metadata.
3. Prefer a **recipe** (`convert`, `thumbnail`, `clip`, `extract_audio`, `extract_cover`, `transcode_h264`, `scale`, `burn_subtitles`, `concat_demuxer`).
4. For custom graphs, build Graph JSON or Python, then **compile before run**.
5. List filters with `catalog filters` / `list_ffmpeg_filters`. Do not invent filter names.

## Python

```python
from dt_ffmpeg import input, convert, probe

info = probe("in.mp4")
graph = (
    input("in.mp4")
    .filter("scale", 1280, -2)
    .output("out.mp4", vcodec="libx264")
    .overwrite("always")
    .build()
)
print(graph.model_dump_json())
```

## CLI

```bash
dt-ffmpeg probe in.mp4 --json
dt-ffmpeg convert in.mp4 out.mp3
dt-ffmpeg compile graph.json
dt-ffmpeg run graph.json --json
```

Overwrite is `always` or `never` — never prompt.
