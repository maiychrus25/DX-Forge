# Copyright (c) 2026 DX-Pulse Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Build Excalidraw diagrams for the BA document set from declarative specs.

Usage: python3 build_diagrams.py            # writes *.excalidraw next to this file
Layout grammar: lanes (horizontal bands), nodes placed on a (col, row) grid inside a lane,
edges as orthogonal arrows. Colors follow the excalidraw-diagram skill palette.
"""
from __future__ import annotations
import json, sys
from pathlib import Path

PALETTE = {
    "task":     ("#3b82f6", "#1e3a5f", "#ffffff"),
    "system":   ("#93c5fd", "#1e3a5f", "#374151"),
    "start":    ("#fed7aa", "#c2410c", "#374151"),
    "end":      ("#a7f3d0", "#047857", "#374151"),
    "decision": ("#fef3c7", "#b45309", "#374151"),
    "ai":       ("#ddd6fe", "#6d28d9", "#374151"),
    "error":    ("#fecaca", "#b91c1c", "#374151"),
    "state":    ("#dbeafe", "#1e40af", "#374151"),
    "actor":    ("#fed7aa", "#c2410c", "#374151"),
    "usecase":  ("#93c5fd", "#1e3a5f", "#374151"),
}
SHAPE = {"task": "rectangle", "system": "rectangle", "ai": "rectangle", "error": "rectangle",
         "start": "ellipse", "end": "ellipse", "decision": "diamond", "state": "ellipse",
         "actor": "ellipse", "usecase": "ellipse"}
TITLE, SUB, BODY, LINE = "#1e40af", "#3b82f6", "#64748b", "#64748b"
FONT = 14; CHAR = 8.6; LH = 1.25
COL_W, ROW_H, LANE_PAD, X0 = 250, 110, 28, 60

_seed = [1000]
def base(el_type, x, y, w, h, **kw):
    _seed[0] += 1
    d = dict(type=el_type, id=kw.pop("id", f"e{_seed[0]}"), x=x, y=y, width=w, height=h,
             strokeColor="#1e3a5f", backgroundColor="transparent", fillStyle="solid",
             strokeWidth=2, strokeStyle="solid", roughness=0, opacity=100, angle=0,
             seed=_seed[0], version=1, versionNonce=_seed[0] * 7, isDeleted=False,
             groupIds=[], boundElements=None, link=None, locked=False)
    d.update(kw); return d

def text(x, y, s, size=FONT, color=BODY, align="left", container=None, w=None):
    lines = s.split("\n"); w = w or max(len(l) for l in lines) * CHAR * size / FONT + 4
    h = len(lines) * size * LH
    return base("text", x, y, w, h, text=s, originalText=s, fontSize=size, fontFamily=3,
                textAlign=align, verticalAlign="middle" if container else "top",
                strokeColor=color, strokeWidth=1, containerId=container, lineHeight=LH)

def node_size(kind, label):
    lines = label.split("\n"); tw = max(len(l) for l in lines) * CHAR + 28
    th = len(lines) * FONT * LH + 24
    if kind == "decision": return max(tw + 40, 150), max(th + 30, 80)
    if kind in ("start", "end", "state", "actor", "usecase"): return max(tw + 24, 120), max(th + 12, 56)
    return max(tw, 130), max(th, 54)

def shape(kind, x, y, w, h, label, nid):
    fill, stroke, tcol = PALETTE[kind]
    s = base(SHAPE[kind], x, y, w, h, id=nid, strokeColor=stroke, backgroundColor=fill,
             boundElements=[{"id": nid + "_t", "type": "text"}])
    if SHAPE[kind] == "rectangle": s["roundness"] = {"type": 3}
    if kind == "actor": s["strokeStyle"] = "solid"; s["strokeWidth"] = 3
    t = text(x + 10, y + h / 2 - FONT * LH * len(label.split("\n")) / 2, label, color=tcol,
             align="center", container=nid, w=w - 20)
    t["id"] = nid + "_t"
    return [s, t]

def arrow(pts, color, label=None, dashed=False, head="arrow", aid=None, sb=None, eb=None, label_left=False, label_below=False, on_back=False, shift=(0, 0)):
    x0, y0 = pts[0]; rel = [[px - x0, py - y0] for px, py in pts]
    w = max(p[0] for p in rel) - min(p[0] for p in rel); h = max(p[1] for p in rel) - min(p[1] for p in rel)
    a = base("arrow", x0, y0, w, h, id=aid, strokeColor=color, points=rel, startArrowhead=None,
             endArrowhead=head, strokeStyle="dashed" if dashed else "solid",
             startBinding={"elementId": sb, "focus": 0, "gap": 2} if sb else None,
             endBinding={"elementId": eb, "focus": 0, "gap": 2} if eb else None)
    out = [a]
    if label:
        mid = len(pts) // 2
        if len(pts) >= 3 and not on_back: mid = len(pts) - 1   # elbow: label on the last (horizontal) segment near the target
        (ax, ay), (bx, by) = pts[mid - 1], pts[mid]
        mx, my = (ax + bx) / 2, (ay + by) / 2
        tw = len(label) * 7.9 + 4
        mx += shift[0]; my += shift[1]
        if abs(ay - by) < 2:   # horizontal segment: label above, centered; lift clear of nodes when longer than the segment
            lift = 44 if tw > abs(bx - ax) - 8 else 20
            out.append(text(mx - tw / 2, my + 34 if label_below else my - lift, label, size=12, color=BODY))
        else:                  # vertical segment: label beside, centered vertically
            x = mx - tw - 12 if label_left else mx + 12
            out.append(text(x, my - 20, label, size=12, color=BODY))
    return out

def build(spec: dict) -> dict:
    els = []
    lanes = spec.get("lanes") or [None]
    nodes = {n["id"]: dict(n) for n in spec["nodes"]}
    # lane geometry
    lane_rows = {}
    for n in nodes.values():
        lane_rows[n.get("lane")] = max(lane_rows.get(n.get("lane"), 0), n.get("row", 0) + 1)
    ncols = max(n["col"] for n in nodes.values()) + 1
    width = X0 + ncols * COL_W + 40
    y = 90
    lane_top = {}
    for ln in lanes:
        rows = lane_rows.get(ln, 1)
        h = rows * ROW_H + LANE_PAD
        lane_top[ln] = y
        if ln is not None:
            els.append(base("rectangle", 20, y, width, h, strokeColor=LINE, strokeWidth=1,
                            strokeStyle="dashed", backgroundColor="transparent"))
            els.append(text(30, y + 6, ln, size=13, color=SUB))
        y += h + 24
    total_h = y
    # nodes
    for n in nodes.values():
        w, h = node_size(n["kind"], n["label"])
        cx = X0 + n["col"] * COL_W + COL_W / 2
        cy = lane_top[n.get("lane")] + LANE_PAD / 2 + 14 + n.get("row", 0) * ROW_H + ROW_H / 2
        n.update(x=cx - w / 2, y=cy - h / 2, w=w, h=h, cx=cx, cy=cy)
        els += shape(n["kind"], n["x"], n["y"], w, h, n["label"], n["id"])
    # edges
    pairs = {(e["from"], e["to"]) for e in spec.get("edges", [])}
    for e in spec.get("edges", []):
        s, t = nodes[e["from"]], nodes[e["to"]]
        reverse = (e["to"], e["from"]) in pairs and e["from"] > e["to"]
        twin = (e["to"], e["from"]) in pairs
        lab_left = bool(e.get("left")); lab_below = bool(e.get("below"))
        color = PALETTE[s["kind"]][1]
        style = e.get("style", "arrow")
        head = None if style == "line" else "arrow"
        dashed = style in ("dashed", "include")
        if style != "line" and e.get("back") and t["col"] != s["col"]:
            off = e.get("offset", 26)
            by = max(s["y"] + s["h"], t["y"] + t["h"]) + off
            pts = [(s["cx"], s["y"] + s["h"]), (s["cx"], by), (t["cx"], by), (t["cx"], t["y"] + t["h"])]
        elif e.get("via") == "top":  # leave from the top, turn at the target row, enter the target side
            tx = t["x"] + t["w"] if t["cx"] < s["cx"] else t["x"]
            pts = [(s["cx"], s["y"]), (s["cx"], t["cy"]), (tx, t["cy"])]
        elif style == "line":
            pts = [(s["cx"], s["cy"]), (t["cx"], t["cy"])]
            # trim to boundaries (approximate ellipse as box)
            if abs(t["cx"] - s["cx"]) < 10:
                pts = [(s["cx"], s["y"] + s["h"]), (t["cx"], t["y"])] if t["cy"] > s["cy"] else [(s["cx"], s["y"]), (t["cx"], t["y"] + t["h"])]
            elif t["cx"] > s["cx"]: pts = [(s["x"] + s["w"], s["cy"]), (t["x"], t["cy"])]
            else: pts = [(s["x"], s["cy"]), (t["x"] + t["w"], t["cy"])]
        elif t["col"] > s["col"]:
            dy = (12 if reverse else -12) if twin and abs(s["cy"] - t["cy"]) < 2 else 0
            lab_below = lab_below or bool(twin and reverse)
            sx, sy = s["x"] + s["w"], s["cy"] + dy; tx, ty = t["x"], t["cy"] + dy
            mx = sx + (tx - sx) / 2
            pts = [(sx, sy), (tx, ty)] if abs(sy - ty) < 2 else [(sx, sy), (mx, sy), (mx, ty), (tx, ty)]
        elif t["col"] == s["col"] and e.get("back") and not twin:  # return edge in the same column: loop around the left side
            gx = s["x"] - 40; lab_left = True
            pts = [(s["x"], s["cy"]), (gx, s["cy"]), (gx, t["cy"]), (t["x"], t["cy"])]
        elif t["col"] == s["col"]:
            dx = (14 if reverse else -14) if twin else 0
            lab_left = lab_left or bool(twin and reverse)
            if t["cy"] > s["cy"]:
                pts = [(s["cx"] + dx, s["y"] + s["h"]), (t["cx"] + dx, t["y"])]
            else:
                pts = [(s["cx"] + dx, s["y"]), (t["cx"] + dx, t["y"] + t["h"])]
        elif not e.get("back"):  # leftward edge on a grid: elbow from left side to right side
            dy = (12 if reverse else -12) if twin and abs(s["cy"] - t["cy"]) < 2 else 0
            lab_below = lab_below or bool(twin and reverse)
            sx, sy = s["x"], s["cy"] + dy; tx, ty = t["x"] + t["w"], t["cy"] + dy
            mx = sx - (sx - tx) / 2
            pts = [(sx, sy), (tx, ty)] if abs(sy - ty) < 2 else [(sx, sy), (mx, sy), (mx, ty), (tx, ty)]
        else:  # explicit back edge: leave from bottom, travel under, enter target bottom
            off = e.get("offset", 26)
            by = max(s["y"] + s["h"], t["y"] + t["h"]) + off
            pts = [(s["cx"], s["y"] + s["h"]), (s["cx"], by), (t["cx"], by), (t["cx"], t["y"] + t["h"])]
        els += arrow(pts, color, e.get("label"), dashed=dashed, head=head, sb=s["id"], eb=t["id"], label_left=lab_left, label_below=lab_below, on_back=bool(e.get("back")), shift=tuple(e.get("shift", (0, 0))))
    # title
    els.insert(0, text(20, 20, spec["title"], size=22, color=TITLE))
    if spec.get("subtitle"): els.insert(1, text(20, 52, spec["subtitle"], size=13, color=BODY))
    if spec.get("legend"):
        els.append(text(20, total_h + 4, spec["legend"], size=12, color=BODY))
    return {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com", "elements": els,
            "appState": {"viewBackgroundColor": "#ffffff", "gridSize": 20}, "files": {}}

if __name__ == "__main__":
    here = Path(__file__).parent
    sys.path.insert(0, str(here))
    import specs  # noqa: E402
    only = sys.argv[1:]  # optional filter by name
    for name, spec in specs.DIAGRAMS.items():
        if only and name not in only: continue
        _seed[0] = 1000
        (here / f"{name}.excalidraw").write_text(json.dumps(build(spec), ensure_ascii=False, indent=1))
        print("wrote", name)
