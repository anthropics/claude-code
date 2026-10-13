import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync, mkdirSync } from "fs";
import { MemoryStore, MemoryEntry } from "../src/memory/memory-store.js";

const TEST_PATH = "data/test-memory-bank.json";

function cleanup() {
  if (existsSync(TEST_PATH)) rmSync(TEST_PATH);
}

describe("MemoryEntry", () => {
  it("creates an entry with defaults", () => {
    const entry = new MemoryEntry({ key: "fact-1", content: "The sky is blue" });
    assert.ok(entry.id);
    assert.equal(entry.key, "fact-1");
    assert.equal(entry.content, "The sky is blue");
    assert.deepEqual(entry.tags, []);
    assert.equal(entry.source, "agent");
    assert.equal(entry.importance, 0.5);
    assert.equal(entry.accessCount, 0);
  });

  it("touch increments access count and updates timestamp", () => {
    const entry = new MemoryEntry({ key: "k", content: "c" });
    const before = entry.lastAccessedAt;
    entry.touch();
    assert.equal(entry.accessCount, 1);
    assert.ok(entry.lastAccessedAt >= before);
  });

  it("serializes and deserializes correctly", () => {
    const entry = new MemoryEntry({
      key: "test",
      content: "hello",
      tags: ["a", "b"],
      metadata: { importance: 0.9 },
    });
    entry.touch();
    const json = entry.toJSON();
    const restored = MemoryEntry.fromJSON(json);
    assert.equal(restored.key, entry.key);
    assert.equal(restored.content, entry.content);
    assert.deepEqual(restored.tags, entry.tags);
    assert.equal(restored.importance, 0.9);
    assert.equal(restored.accessCount, 1);
  });
});

describe("MemoryStore", () => {
  let store;

  beforeEach(() => {
    cleanup();
    store = new MemoryStore(TEST_PATH);
  });

  afterEach(() => {
    cleanup();
  });

  it("stores and recalls a memory", () => {
    store.store("user-name", "Alice", { tags: ["preference"] });
    const entry = store.recall("user-name");
    assert.ok(entry);
    assert.equal(entry.content, "Alice");
    assert.deepEqual(entry.tags, ["preference"]);
  });

  it("returns null for unknown keys", () => {
    assert.equal(store.recall("nonexistent"), null);
  });

  it("updates existing memory by key", () => {
    store.store("color", "blue");
    store.store("color", "red");
    assert.equal(store.size, 1);
    assert.equal(store.recall("color").content, "red");
  });

  it("updates with explicit update method", () => {
    store.store("lang", "Python");
    store.update("lang", "TypeScript", { tags: ["code"] });
    const entry = store.recall("lang");
    assert.equal(entry.content, "TypeScript");
    assert.deepEqual(entry.tags, ["code"]);
  });

  it("deletes a memory", () => {
    store.store("temp", "data");
    assert.equal(store.forget("temp"), true);
    assert.equal(store.recall("temp"), null);
    assert.equal(store.size, 0);
  });

  it("returns false when forgetting unknown key", () => {
    assert.equal(store.forget("nope"), false);
  });

  it("searches by tag", () => {
    store.store("a", "apple", { tags: ["fruit"] });
    store.store("b", "banana", { tags: ["fruit"] });
    store.store("c", "carrot", { tags: ["vegetable"] });

    const results = store.search({ tags: ["fruit"] });
    assert.equal(results.length, 2);
    const keys = results.map((r) => r.entry.key);
    assert.ok(keys.includes("a"));
    assert.ok(keys.includes("b"));
  });

  it("searches by query string", () => {
    store.store("fact-1", "JavaScript was created in 1995");
    store.store("fact-2", "Python was created in 1991");
    store.store("fact-3", "The earth orbits the sun");

    const results = store.search({ query: "created" });
    assert.equal(results.length, 2);
  });

  it("limits search results", () => {
    for (let i = 0; i < 20; i++) {
      store.store(`key-${i}`, `value-${i}`);
    }
    const results = store.search({ limit: 5 });
    assert.equal(results.length, 5);
  });

  it("returns all keys", () => {
    store.store("x", "1");
    store.store("y", "2");
    const keys = store.keys();
    assert.deepEqual(keys.sort(), ["x", "y"]);
  });

  it("persists and reloads from disk", () => {
    store.store("persist-test", "durable", { tags: ["test"] });
    const store2 = new MemoryStore(TEST_PATH);
    assert.equal(store2.size, 1);
    assert.equal(store2.recall("persist-test").content, "durable");
  });

  it("compacts when over threshold", () => {
    for (let i = 0; i < 10; i++) {
      store.store(`k${i}`, `v${i}`);
    }
    const removed = store.compact(5);
    assert.equal(removed, 5);
    assert.equal(store.size, 5);
  });

  it("handles importance-based scoring", () => {
    store.store("low", "low importance", { metadata: { importance: 0.1 } });
    store.store("high", "high importance", { metadata: { importance: 1.0 } });

    const results = store.search({ limit: 2 });
    assert.equal(results[0].entry.key, "high");
    assert.ok(results[0].score > results[1].score);
  });
});
