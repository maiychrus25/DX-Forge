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

/** Replace every `{{ a.b.c }}` with the context value; arrays join with ", ". Missing path → TemplateError. */
export function render(text: string, ctx: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path: string) => {
    const v = lookup(ctx, path);
    if (v === undefined) throw new TemplateError(path);
    return Array.isArray(v) ? v.join(", ") : String(v);
  });
}
