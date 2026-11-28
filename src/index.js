/**
 * Agent Memory System — public API surface.
 *
 * Usage:
 *   import { AgentOrchestrator, MemoryStore, SessionManager } from "agent-memory-system";
 *
 *   const agent = new AgentOrchestrator();
 *   const { sessionId } = agent.startSession("my-session");
 *   const { prompt } = agent.processMessage(sessionId, "Hello!");
 *   // Send `prompt` to your LLM, get response, then:
 *   agent.recordResponse(sessionId, "Hi there!");
 */

export { MemoryStore, MemoryEntry } from "./memory/memory-store.js";
export { SessionManager, Session } from "./session/session-manager.js";
export { AgentOrchestrator } from "./agent/agent-orchestrator.js";
