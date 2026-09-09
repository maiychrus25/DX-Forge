// SPDX-License-Identifier: AGPL-3.0-or-later
export function KitTree({ paths }: { paths: string[] }) {
  return (
    <pre className="text-xs font-mono overflow-x-auto p-3 rounded-md border border-border">
      {paths.map((p) => { const depth = p.split("/").length - 1; return `${"  ".repeat(depth)}${depth ? "└ " : ""}${p.split("/").pop()}\n`; }).join("")}
    </pre>
  );
}
