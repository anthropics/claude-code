import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "fs";
import { Session, SessionManager } from "../src/session/session-manager.js";
import { MemoryStore } from "../src/memory/memory-store.js";

const TEST_SESSIONS_DIR = "data/test-sessions";
const TEST_MEMORY_PATH = "data/test-sm-memory.json";

function cleanup() {
  if (existsSync(TEST_SESSIONS_DIR)) rmSync(TEST_SESSIONS_DIR, { recursive: true });
  if (existsSync(TEST_MEMORY_PATH)) rmSync(TEST_MEMORY_PATH);
}

describe("Session", () => {
  it("creates a session with defaults", () => {
    const session = new Session({ name: "test-session" });
    assert.ok(session.id);
    assert.equal(session.name, "test-session");
    assert.equal(session.status, "active");
    assert.deepEqual(session.messages, []);
  });

  it("adds messages", () => {
    const session = new Session({ name: "chat" });
    const msg = session.addMessage("user", "Hello!");
    assert.ok(msg.id);
    assert.equal(msg.role, "user");
    assert.equal(msg.content, "Hello!");
    assert.equal(session.messages.length, 1);
  });

  it("rejects messages on closed session", () => {
    const session = new Session({ name: "closed" });
    session.close();
    assert.throws(() => session.addMessage("user", "test"), /closed session/);
  });

  it("returns context window of last N messages", () => {
    const session = new Session({ name: "window" });
    for (let i = 0; i < 10; i++) session.addMessage("user", `msg-${i}`);
    const window = session.getContextWindow(3);
    assert.equal(window.length, 3);
    assert.equal(window[0].content, "msg-7");
    assert.equal(window[2].content, "msg-9");
  });

  it("pauses and resumes", () => {
    const session = new Session({ name: "lifecycle" });
    session.pause();
    assert.equal(session.status, "paused");
    session.resume();
    assert.equal(session.status, "active");
  });

  it("serializes and deserializes", () => {
    const session = new Session({ name: "serial", metadata: { project: "x" } });
    session.addMessage("user", "hi");
    session.addMessage("assistant", "hello");
    const json = session.toJSON();
    const restored = Session.fromJSON(json);
    assert.equal(restored.name, "serial");
    assert.equal(restored.messages.length, 2);
    assert.deepEqual(restored.metadata, { project: "x" });
  });
});

describe("SessionManager", () => {
  let manager;
  let memoryStore;

  beforeEach(() => {
    cleanup();
    memoryStore = new MemoryStore(TEST_MEMORY_PATH);
    manager = new SessionManager(TEST_SESSIONS_DIR, memoryStore);
  });

  afterEach(() => {
    cleanup();
  });

  it("creates a session and sets it active", () => {
    const session = manager.create("test");
    assert.ok(session.id);
    assert.equal(manager.getActive()?.id, session.id);
  });

  it("lists sessions", () => {
    manager.create("s1");
    manager.create("s2");
    assert.equal(manager.list().length, 2);
  });

  it("lists sessions by status", () => {
    const s1 = manager.create("s1");
    manager.create("s2");
    manager.pause(s1.id);
    assert.equal(manager.list("paused").length, 1);
    assert.equal(manager.list("active").length, 1);
  });

  it("pauses and resumes sessions", () => {
    const session = manager.create("pausable");
    manager.pause(session.id);
    assert.equal(manager.getActive(), null);

    manager.resume(session.id);
    assert.equal(manager.getActive()?.id, session.id);
  });

  it("throws when resuming a closed session", () => {
    const session = manager.create("closable");
    manager.close(session.id);
    assert.throws(() => manager.resume(session.id), /closed session/i);
  });

  it("adds messages to a session", () => {
    const session = manager.create("chat");
    manager.addMessage(session.id, "user", "Hey");
    manager.addMessage(session.id, "assistant", "Hi!");
    const s = manager.get(session.id);
    assert.equal(s.messages.length, 2);
  });

  it("throws when adding message to unknown session", () => {
    assert.throws(() => manager.addMessage("fake-id", "user", "test"), /not found/);
  });

  it("builds context with memory", () => {
    memoryStore.store("user-pref", "likes dark mode settings", { tags: ["pref"] });
    const session = manager.create("ctx-test");
    manager.addMessage(session.id, "user", "Update my dark mode settings please");

    const ctx = manager.buildContext(session.id, { memoryTags: ["pref"] });
    assert.ok(ctx.messages.length > 0);
    assert.ok(ctx.memories.length > 0);
    assert.equal(ctx.memories[0].key, "user-pref");
  });

  it("extracts memories on close", () => {
    const session = manager.create("extract-test");
    manager.addMessage(session.id, "user", "Remember my name is Bob", {
      remember: true,
      memoryKey: "user-name",
    });

    const result = manager.close(session.id, "User introduced themselves as Bob");
    assert.ok(result.extractedMemories.length > 0);

    // Verify memories are in the store
    assert.ok(memoryStore.recall("user-name"));
    assert.ok(memoryStore.recall(`session-summary:${session.id}`));
  });

  it("persists sessions to disk and reloads", () => {
    const session = manager.create("persist-test");
    manager.addMessage(session.id, "user", "durable message");

    const manager2 = new SessionManager(TEST_SESSIONS_DIR, memoryStore);
    const loaded = manager2.get(session.id);
    assert.ok(loaded);
    assert.equal(loaded.messages.length, 1);
    assert.equal(loaded.messages[0].content, "durable message");
  });
});
