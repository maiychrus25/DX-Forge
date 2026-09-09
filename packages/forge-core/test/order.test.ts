// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { CyclicDependency, topoSort } from "../src/order.js";
import type { Resource } from "../src/schema/plan.js";

const r = (id: string, layer: Resource["layer"], depends_on: string[] = []): Resource => ({ id, layer, type: "x.y", spec: {}, reason: "t", depends_on, gate: { allowed: true } });

describe("topoSort", () => {
  it("orders by layer H → P → D → I, then by dependencies, keeping input order otherwise", () => {
    const out = topoSort([r("i1", "I"), r("d1", "D", ["p1"]), r("p1", "P", ["h2"]), r("h2", "H", ["h1"]), r("h1", "H"), r("h3", "H")]).map((x) => x.id);
    expect(out).toEqual(["h1", "h2", "h3", "p1", "d1", "i1"]);
  });
  it("lets a dependency inside the same layer come first even if listed later", () => {
    expect(topoSort([r("b", "H", ["a"]), r("a", "H")]).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("throws on a cycle", () => {
    expect(() => topoSort([r("a", "H", ["b"]), r("b", "H", ["a"])])).toThrow(CyclicDependency);
  });
});
