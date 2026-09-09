# SPDX-License-Identifier: AGPL-3.0-or-later
"""Architecture overview diagram for the README, built with the BA diagram primitives (Excalidraw)."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ba" / "diagrams"))
from build_diagrams import base, shape, arrow, text, PALETTE, TITLE, BODY  # noqa: E402

els = []
import build_diagrams as bd
bd.SHAPE["end"] = "rectangle"   # targets read better as boxes than ellipses
def group(x, y, w, h, label):
    els.append(base("rectangle", x, y, w, h, strokeColor="#94a3b8", strokeStyle="dashed", strokeWidth=1.5, roundness={"type": 3}))
    els.append(text(x + 12, y + 8, label, size=13, color="#475569"))
def node(kind, x, y, w, h, label, nid):
    els.extend(shape(kind, x, y, w, h, label, nid))
    return {"id": nid, "x": x, "y": y, "w": w, "h": h, "cx": x + w / 2, "cy": y + h / 2}
def hlink(a, b, label=None, y=None, color="#1e3a5f"):
    y = a["cy"] if y is None else y
    els.extend(arrow([(a["x"] + a["w"], y), (b["x"], y)], color, label, sb=a["id"], eb=b["id"]))
def elbow(a, b, xmid, ya, color="#1e3a5f"):
    els.extend(arrow([(a["x"] + a["w"], ya), (xmid, ya), (xmid, b["cy"]), (b["x"], b["cy"])], color, None, sb=a["id"], eb=b["id"]))

els.append(text(24, 20, "DX-Forge — kiến trúc tổng thể", size=22, color=TITLE))
els.append(text(24, 52, "Forge là CLI + wizard mỏng gọi cùng một thư viện; phần nặng nằm ở đích.", size=13, color=BODY))

group(24, 96, 220, 300, "Giao diện")
group(280, 96, 420, 440, "Thư viện Forge")
group(736, 96, 220, 440, "Providers (apply · verify)")
group(992, 96, 330, 440, "Đích (DX-Lab chạy thật)")

cli = node("task", 44, 140, 180, 60, "CLI dxforge", "cli")
web = node("task", 44, 230, 180, 60, "Wizard web\n(Next.js + SQLite)", "web")
org = node("actor", 44, 420, 180, 60, "Tổ chức\n(3 tầng trả lời)", "org")

core = node("system", 300, 140, 380, 150, "forge-core\nschema · planner · validator · differ", "core")
eng = node("system", 300, 330, 180, 70, "hpdi-engine\n(đo lường)", "eng")
packs = node("system", 500, 330, 180, 70, "packs\ncore · dx-ticket", "packs")
ai = node("ai", 300, 440, 380, 70, "Lớp AI: interview · đề xuất plan · handbook\n(Gemini | Anthropic | Ollama | none)", "ai")

oss = node("system", 756, 140, 180, 60, "oss", "oss")
gws = node("system", 756, 290, 180, 60, "gws", "gws")
man = node("system", 756, 440, 180, 60, "manifest", "man")

lab = node("end", 1012, 130, 290, 80, "Keycloak · Nextcloud · Postgres\nn8n · Appsmith · Metabase\nQdrant · Telegram / Mattermost", "lab")
gsuite = node("end", 1012, 280, 290, 80, "Google Workspace\nDrive · Sheets · Forms\nApps Script · Looker Studio", "gsuite")
out = node("end", 1012, 440, 290, 60, "Thư mục manifest\ncho nền tảng khác", "out")

hlink(cli, core, "intent.yaml")
hlink(web, core)
els.extend(arrow([(org["cx"], org["y"]), (org["cx"], web["y"] + web["h"])], PALETTE["actor"][1], "khảo sát", sb="org", eb="web"))
els.extend(arrow([(eng["cx"], eng["y"]), (eng["cx"], core["y"] + core["h"])], "#1e3a5f", "ResultV1", sb="eng", eb="core"))
els.extend(arrow([(packs["cx"], packs["y"]), (packs["cx"], core["y"] + core["h"])], "#1e3a5f", "template", sb="packs", eb="core"))
els.extend(arrow([(ai["x"] + 40, ai["y"]), (ai["x"] + 40, eng["y"] + eng["h"])], "#6d28d9", None, dashed=True, sb="ai", eb="eng"))
els.append(text(ai["x"] + 52, ai["y"] - 26, "AI đề xuất, validator quyết định", size=12, color="#6d28d9"))
hlink(core, oss, "plan.yaml", y=oss["cy"])
elbow(core, gws, 718, core["cy"] + 20)
elbow(core, man, 706, core["cy"] + 45)
hlink(oss, lab)
hlink(gws, gsuite)
hlink(man, out, "export")
els.append(text(24, 560, "state.json ánh xạ id tài nguyên → id thật trên đích; apply idempotent, có dry-run, resume và prune.", size=12, color=BODY))

doc = {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com", "elements": els,
       "appState": {"viewBackgroundColor": "#ffffff", "gridSize": 20}, "files": {}}
Path(__file__).with_name("architecture.excalidraw").write_text(json.dumps(doc, ensure_ascii=False, indent=1))
print("wrote architecture.excalidraw")
