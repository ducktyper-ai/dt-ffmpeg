---
name: dt-ffmpeg
description: >-
  Build and run FFmpeg filter graphs with dt-ffmpeg. Probe first, compile before
  run, prefer recipes, never invent filter names.
---

# dt-ffmpeg (Claude Code)

Same workflow as the Cursor skill: doctor → probe → recipe or Graph JSON → compile → run.

Python: `from dt_ffmpeg import input, probe, convert`

CLI: `uv run dt-ffmpeg probe FILE --json`

MCP tools: `doctor`, `probe_file`, `compile_graph_json`, `run_graph`, `convert_file`, `list_ffmpeg_filters`, `run_named_recipe`.
