// SPDX-License-Identifier: AGPL-3.0-or-later
export class TemplateError extends Error {
  constructor(path: string) {
    super(`Template variable not found: ${path}`);
    this.name = "TemplateError";
  }
}

function lookup(ctx: Record<string, unknown>, path: string): unknown {
  let cur: unknown = ctx;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object" || !(key in (cur as object))) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * Replace every `{{ a.b.c }}` with the context value; arrays join with ", ". Missing path → TemplateError.
 * Values are escaped for YAML double-quoted scalars (JSON and YAML double-quoted escaping agree) so a
 * substituted value containing `"` or a newline cannot break the surrounding YAML; a plain number such
 * as `24` is unchanged.
 */
export function render(text: string, ctx: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path: string) => {
    const v = lookup(ctx, path);
    if (v === undefined) throw new TemplateError(path);
    const s = Array.isArray(v) ? v.join(", ") : String(v);
    return JSON.stringify(s).slice(1, -1);
  });
}
