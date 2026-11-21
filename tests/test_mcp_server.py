"""MCP entry-point tests."""

from __future__ import annotations

import pytest

import dt_ffmpeg.mcp_server as mcp_server


def test_main_explains_optional_dependency(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def missing_server() -> None:
        raise ModuleNotFoundError("No module named 'mcp'", name="mcp")

    monkeypatch.setattr(mcp_server, "_server", missing_server)

    with pytest.raises(SystemExit, match="1"):
        mcp_server.main()

    assert 'pip install "dt-ffmpeg[mcp]"' in capsys.readouterr().err
