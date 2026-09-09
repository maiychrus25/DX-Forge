# DX-Forge brand assets

## The mark

A geometric **F** built from three layer bars on one stem, plus a fourth bar that is not attached yet.
The four bars are the four layers of a DX-OS plan (H infrastructure, P process, D data, I intelligence).
The detached orange bar is the I layer: present in every plan, applied only when the organisation's
maturity gate opens. The letter and the method are the same drawing.

| File | Use |
|---|---|
| `logo.svg` | primary mark, ink on transparent |
| `logo-dark.svg` | mark for dark backgrounds |
| `logo-mono.svg` | single colour via `currentColor` (favicons, print, stamps) |
| `wordmark.svg`, `wordmark-dark.svg` | mark + "DX-Forge" (Inter 600, falls back to system sans) |
| `logo-{1024,512,256,128,64,32}.png`, `favicon-32.png` | raster exports |
| `banner.svg`, `banner.png` | README banner, 1280×320 |
| `architecture.py` → `architecture.excalidraw`, `architecture.png` | architecture overview (Excalidraw, regenerated with the BA diagram primitives) |
| `showcase.html` | the six explorations with rationale (`variants/`) |

## Palette

| Token | Value | Role |
|---|---|---|
| ink | `#0F172A` | mark, headings, body on light |
| paper | `#F8FAFC` | mark on dark, page background |
| forge | `#EA580C` | the gated layer, primary action, "apply" |
| verify | `#16A34A` | verify green (reports, checks) |
| layers H / P / D / I | `#64748B` / `#16A34A` / `#F59E0B` / `#7C3AED` | radar and plan-tree colours, fixed across every chart |

## Rules

- Minimum size 24 px; below that use `logo-mono.svg` without the accent.
- Keep the clear space equal to the stem width (10 % of the mark) on all sides.
- Do not rotate, outline, add gradients, or attach the fourth bar.
- The wordmark text is set in Inter; do not substitute a serif or a display face.

## Regenerating

```bash
cd docs/brand && uv run --with cairosvg python -c "import cairosvg; cairosvg.svg2png(url='logo.svg', write_to='logo-512.png', output_width=512, output_height=512)"
```
