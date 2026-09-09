---
name: DX-Forge wizard
version: 1
tokens:
  color:
    ink: "#0F172A"
    paper: "#F8FAFC"
    surface: "#FFFFFF"
    surface-dark: "#111827"
    paper-dark: "#0B1220"
    muted: "#64748B"
    border: "#E2E8F0"
    border-dark: "#1F2937"
    forge: "#EA580C"
    verify: "#16A34A"
    danger: "#DC2626"
    axis-h: "#64748B"
    axis-p: "#16A34A"
    axis-d: "#F59E0B"
    axis-i: "#7C3AED"
  font:
    sans: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif"
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    size: { xs: 12px, sm: 14px, base: 16px, lg: 18px, xl: 22px, 2xl: 28px }
  space: { 1: 4px, 2: 8px, 3: 12px, 4: 16px, 6: 24px, 8: 32px, 12: 48px }
  radius: { sm: 6px, md: 10px, lg: 16px, pill: 999px }
  elevation:
    card: "0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.1)"
    raised: "0 10px 30px rgba(15,23,42,.12)"
  motion: { fast: 120ms, base: 200ms, ease: "cubic-bezier(.2,.8,.2,1)" }
  breakpoints: { sm: 640px, md: 768px, lg: 1024px }
---

# Rationale

**Ink on paper.** The wizard is a measuring instrument, not a marketing site. Text is near-black on
off-white; colour is reserved for meaning: the four HPDI axes, the forge accent for the primary
action, green for verified, red for errors. Dark mode swaps paper/ink and keeps the axis colours.

**One primary action per screen.** Every page has exactly one `forge`-coloured button (open round,
close round, download kit, submit answer). Secondary actions are outlined.

**Survey is a phone screen.** One question, a 0–4 scale as five tappable cards (min 48 px tall),
a progress bar, previous/next. Drafts survive a refresh. Under eight minutes for twenty questions.

**Radar is the hero.** Four fixed axes (H grey, P green, D orange, I purple) in that order,
clockwise from top. Tier layers are toggleable, the merged polygon is filled. The shape badge and
level sit beside it, never over it.

**Tables breathe.** 12 px vertical padding, zebra rows off, right-aligned numbers, a coloured dot
before the pillar name. Discrepancy above 0.3 is marked with a warning chip, not a red row.

**States are designed.** Every list has an empty state with the next action; every fetch has a
skeleton; every error is a sentence in Vietnamese with what to do next.

**Accessibility.** Focus ring 2 px forge on all interactive elements; contrast ≥ 4.5:1 for text;
scale cards are radio buttons under the hood; the radar has a table twin for screen readers.
