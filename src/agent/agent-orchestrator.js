/**
 * AgentOrchestrator — the brain that ties sessions and memory together.
 *
 * Responsible for:
 * - Routing user prompts through the memory-augmented pipeline
 * - Building rich context from session history + memory bank
 * - Formatting prompts with injected memory context
 * - Processing responses and extracting learnings
 * - Managing the agent lifecycle (start, interact, end)
 */

import { MemoryStore } from "../memory/memory-store.js";
import { SessionManager } from "../session/session-manager.js";

export class AgentOrchestrator {
  constructor({
    memoryPath = "data/memory-bank.json",
    sessionsDir = "data/sessions",
    systemPrompt = null,
    contextWindowSize = 20,
    memoryLimit = 5,
  } = {}) {
    this.memoryStore = new MemoryStore(memoryPath);
    this.sessionManager = new SessionManager(sessionsDir, this.memoryStore);
    this.systemPrompt = systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.contextWindowSize = contextWindowSize;
    this.memoryLimit = memoryLimit;
    this.responseHandler = null; // plug in your LLM call here
  }

  /** Start a new agent session. */
  startSession(name, metadata = {}) {
    const session = this.sessionManager.create(name, metadata);
    return {
      sessionId: session.id,
      sessionName: session.name,
      status: session.status,
    };
  }

  /** Resume an existing session. */
  resumeSession(sessionId) {
    const session = this.sessionManager.resume(sessionId);
    return {
      sessionId: session.id,
      sessionName: session.name,
      status: session.status,
      messageCount: session.messages.length,
    };
  }

  /** End a session with an optional summary. */
  endSession(sessionId, summary = null) {
    const result = this.sessionManager.close(sessionId, summary);
    return {
      sessionId: result.session.id,
      status: result.session.status,
      extractedMemories: result.extractedMemories,
    };
  }

  /**
   * Process a user message: build context, format prompt, handle response.
   * Returns the formatted prompt object ready to send to an LLM.
   */
  processMessage(sessionId, userMessage, { tags = [], remember = false, memoryKey = null } = {}) {
    // Record the user message
    const msgMeta = {};
    if (remember) {
      msgMeta.remember = true;
      if (memoryKey) msgMeta.memoryKey = memoryKey;
      if (tags.length) msgMeta.tags = tags;
    }
    this.sessionManager.addMessage(sessionId, "user", userMessage, msgMeta);

    // Build augmented context
    const context = this.sessionManager.buildContext(sessionId, {
      windowSize: this.contextWindowSize,
      memoryLimit: this.memoryLimit,
      memoryTags: tags,
    });

    // Format the prompt with memory injection
    const formattedPrompt = this._buildPrompt(context);

    return {
      prompt: formattedPrompt,
      context,
    };
  }

  /** Record an assistant response back into the session. */
  recordResponse(sessionId, assistantMessage, { remember = false, memoryKey = null, tags = [] } = {}) {
    const meta = {};
    if (remember) {
      meta.remember = true;
      if (memoryKey) meta.memoryKey = memoryKey;
      if (tags.length) meta.tags = tags;
    }
    this.sessionManager.addMessage(sessionId, "assistant", assistantMessage, meta);
  }

  /** Directly store a fact in the memory bank. */
  remember(key, content, { tags = [], importance = 0.5 } = {}) {
    return this.memoryStore.store(key, content, {
      tags,
      source: "direct",
      metadata: { importance },
    });
  }

  /** Search the memory bank. */
  recall({ query = "", tags = [], limit = 5 } = {}) {
    return this.memoryStore.search({ query, tags, limit });
  }

  /** Forget a specific memory. */
  forget(key) {
    return this.memoryStore.forget(key);
  }

  /** List all sessions. */
  listSessions(status = null) {
    return this.sessionManager.list(status).map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      messageCount: s.messages.length,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  /** Get memory bank stats. */
  memoryStats() {
    return {
      totalMemories: this.memoryStore.size,
      keys: this.memoryStore.keys(),
    };
  }

  /** Build the full prompt with system prompt, memory context, and messages. */
  _buildPrompt(context) {
    const parts = [];

    // System prompt
    parts.push({ role: "system", content: this.systemPrompt });

    // Memory injection block
    if (context.memories.length > 0) {
      const memoryBlock = context.memories
        .map((m) => `- [${m.key}] (relevance: ${m.score.toFixed(2)}): ${m.content}`)
        .join("\n");

      parts.push({
        role: "system",
        content: `## Relevant Memories\nThe following facts from your memory bank may be relevant:\n${memoryBlock}`,
      });
    }

    // Session context metadata
    parts.push({
      role: "system",
      content: `## Session Context\nSession: ${context.sessionName} (${context.sessionId})\nMessages in context: ${context.messages.length}`,
    });

    // Conversation messages
    for (const msg of context.messages) {
      parts.push({ role: msg.role, content: msg.content });
    }

    return parts;
  }
}

const DEFAULT_SYSTEM_PROMPT = `You are an intelligent agent with persistent memory across sessions.

Key capabilities:
- You remember facts, preferences, and decisions from previous conversations.
- You can store new information for future reference when asked.
- You maintain context within and across sessions.

When the user shares important information, preferences, or decisions, note them for memory storage.
When answering questions, draw on relevant memories to provide personalized, context-aware responses.`;
