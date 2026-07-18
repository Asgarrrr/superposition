import { describe, expect, it } from "vitest";
import { Lru } from "./lru.ts";

describe("Lru", () => {
  it("evicts the oldest key past the cap", () => {
    const lru = new Lru<string, number>(2);
    lru.set("a", 1);
    lru.set("b", 2);
    lru.set("c", 3); // evicts "a", the oldest
    expect(lru.size).toBe(2);
    expect(lru.get("a")).toBeUndefined();
    expect(lru.get("b")).toBe(2);
    expect(lru.get("c")).toBe(3);
  });

  it("a get refreshes recency, sparing the touched key from eviction", () => {
    const lru = new Lru<string, number>(2);
    lru.set("a", 1);
    lru.set("b", 2);
    lru.get("a"); // "a" is now the most recent, "b" the oldest
    lru.set("c", 3); // evicts "b"
    expect(lru.get("a")).toBe(1);
    expect(lru.get("b")).toBeUndefined();
    expect(lru.get("c")).toBe(3);
  });

  it("re-setting a key updates its value without growing size", () => {
    const lru = new Lru<string, number>(2);
    lru.set("a", 1);
    lru.set("a", 9);
    expect(lru.size).toBe(1);
    expect(lru.get("a")).toBe(9);
  });
});
