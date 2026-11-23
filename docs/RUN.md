# Running dt-ffmpeg from a release

dt-ffmpeg is a **Python library with a command-line tool and a stdio MCP server, not a network server.** It has no listener, no port and no health URL. Read from `pyproject.toml`, `Makefile` and `src/dt_ffmpeg/cli.py`; not yet run on ENG-UK (UNVERIFIED until the first deployment).

## Runtime
Python >= 3.12, `uv`, and `ffmpeg` + `ffprobe` (on PATH, or `dt-ffmpeg doctor --download` fetches an LGPL build into the cache). From the extracted release archive (never from a checkout):

```
uv sync --no-dev --extra mcp
uv run dt-ffmpeg doctor     # preflight: JSON with ok, ffmpeg and ffprobe paths; exit 0 when usable
```

## Start command
No daemon. On demand:

```
uv run dt-ffmpeg probe INPUT.mp4
uv run dt-ffmpeg --help
uv run dt-ffmpeg-mcp        # MCP over stdio; started by the MCP client, not by launchd
```

A launchd job is not applicable.

## Configuration (environment, names only)
| Variable | Meaning |
|---|---|
| `FFMPEG_BINARY`, `FFPROBE_BINARY` | optional absolute paths to the binaries; `dt-ffmpeg doctor` shows which are in effect |
| `XDG_CACHE_HOME` | cache root for downloaded binaries |

No secrets are needed.

## Port and health
None. The health check is `uv run dt-ffmpeg doctor` returning `"ok": true`.

## Data directory
No persistent data. Only a binary cache when `doctor --download` is used (location printed by `doctor`).
