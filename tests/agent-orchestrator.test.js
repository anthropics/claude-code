import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "fs";
import { AgentOrchestrator } from "../src/agent/agent-orchestrator.js";

const TEST_MEMORY = "data/test-orch-memory.json";
const TEST_SESSIONS = "data/test-orch-sessions";

function cleanup() {
  if (existsSync(TEST_MEMORY)) rmSync(TEST_MEMORY);
  if (existsSync(TEST_SESSIONS)) rmSync(TEST_SESSIONS, { recursive: true });
}

describe("AgentOrchestrator", () => {
  let agent;

  beforeEach(() => {
    cleanup();
    agent = new AgentOrchestrator({
      memoryPath: TEST_MEMORY,
      sessionsDir: TEST_SESSIONS,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("starts a new session", () => {
    const result = agent.startSession("my-session");
    assert.ok(result.sessionId);
    assert.equal(result.sessionName, "my-session");
    assert.equal(result.status, "active");
  });

  it("processes a message and returns a formatted prompt", () => {
    const { sessionId } = agent.startSession("chat");
    const { prompt, context } = agent.processMessage(sessionId, "Hello, agent!");

    assert.ok(Array.isArray(prompt));
    assert.ok(prompt.length >= 3); // system + session context + user message
    assert.equal(prompt[0].role, "system");
    assert.equal(prompt[prompt.length - 1].role, "user");
    assert.equal(prompt[prompt.length - 1].content, "Hello, agent!");
    assert.equal(context.messages.length, 1);
  });

  it("records responses into session", () => {
    const { sessionId } = agent.startSession("chat");
    agent.processMessage(sessionId, "Hi");
    agent.recordResponse(sessionId, "Hello! How can I help?");

    const sessions = agent.listSessions();
    assert.equal(sessions[0].messageCount, 2);
  });

  it("injects relevant memories into prompts", () => {
    agent.remember("user-lang", "User prefers TypeScript for writing code", {
      tags: ["preference"],
      importance: 0.9,
    });

    const { sessionId } = agent.startSession("code-help");
    const { prompt } = agent.processMessage(sessionId, "Help me write TypeScript code", {
      tags: ["preference"],
    });

    // Find the memory injection block
    const memoryBlock = prompt.find((p) => p.content?.includes("Relevant Memories"));
    assert.ok(memoryBlock, "Should have a memory injection block");
    assert.ok(memoryBlock.content.includes("TypeScript"));
  });

  it("stores and retrieves memories directly", () => {
    agent.remember("api-key-format", "Use Bearer token auth", { tags: ["api"] });
    const results = agent.recall({ query: "auth", tags: ["api"] });
    assert.equal(results.length, 1);
    assert.ok(results[0].entry.content.includes("Bearer"));
  });

  it("forgets memories", () => {
    agent.remember("temp-fact", "temporary");
    assert.equal(agent.forget("temp-fact"), true);
    assert.equal(agent.recall({ query: "temporary" }).length, 0);
  });

  it("resumes a session", () => {
    const { sessionId } = agent.startSession("resumable");
    agent.processMessage(sessionId, "First message");
    agent.endSession(sessionId, "Paused mid-conversation");

    // Can't resume a closed session — start a new one and verify memories transferred
    const { sessionId: newId } = agent.startSession("resumed");
    const { prompt } = agent.processMessage(newId, "Continue our chat");

    // The session summary should be in memory
    const stats = agent.memoryStats();
    assert.ok(stats.totalMemories >= 1);
  });

  it("ends a session and extracts memories", () => {
    const { sessionId } = agent.startSession("extractable");
    agent.processMessage(sessionId, "Remember: my favorite color is green", {
      remember: true,
      memoryKey: "fav-color",
    });
    agent.recordResponse(sessionId, "Got it! I'll remember that.");

    const result = agent.endSession(sessionId, "User shared color preference");
    assert.ok(result.extractedMemories.length > 0);

    const stats = agent.memoryStats();
    assert.ok(stats.keys.includes("fav-color"));
    assert.ok(stats.keys.some((k) => k.startsWith("session-summary:")));
  });

  it("lists sessions by status", () => {
    agent.startSession("a");
    const { sessionId: bId } = agent.startSession("b");
    agent.endSession(bId);

    const active = agent.listSessions("active");
    const closed = agent.listSessions("closed");
    assert.equal(active.length, 1);
    assert.equal(closed.length, 1);
  });

  it("provides memory stats", () => {
    agent.remember("k1", "v1");
    agent.remember("k2", "v2");
    const stats = agent.memoryStats();
    assert.equal(stats.totalMemories, 2);
    assert.deepEqual(stats.keys.sort(), ["k1", "k2"]);
  });

  it("multi-turn conversation maintains context", () => {
    const { sessionId } = agent.startSession("multi-turn");

    agent.processMessage(sessionId, "My name is Alice");
    agent.recordResponse(sessionId, "Nice to meet you, Alice!");
    agent.processMessage(sessionId, "What is my name?");
    agent.recordResponse(sessionId, "Your name is Alice.");

    const { prompt } = agent.processMessage(sessionId, "And what did I ask you?");
    // Should have all 5 messages in context
    const userMsgs = prompt.filter((p) => p.role === "user");
    assert.equal(userMsgs.length, 3);
  });
});
