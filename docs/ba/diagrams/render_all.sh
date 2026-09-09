#!/usr/bin/env bash
# Copyright (c) 2026 DX-Pulse Team
# SPDX-License-Identifier: AGPL-3.0-or-later
# Render every .excalidraw in this folder to PNG using the excalidraw-diagram skill renderer.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REF="$HOME/.claude/skills/excalidraw-diagram/references"
cd "$HERE" && python3 build_diagrams.py >/dev/null
cd "$REF" || exit 1
for f in "$HERE"/*.excalidraw; do uv run python render_excalidraw.py "$f" >/dev/null 2>&1 || echo "FAIL $f"; done
echo "rendered $(ls "$HERE"/*.png | wc -l) png"
