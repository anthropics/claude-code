/**
 * SessionManager — manages agent conversation sessions with threading,
 * context windowing, and automatic memory extraction.
 *
 * Each session maintains its own message history, can be paused/resumed,
 * and automatically extracts key facts into the memory bank on close.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

export class Session {
  constructor({ id, name, metadata = {} }) {
    this.id = id ?? crypto.randomUUID();
    this.name = name ?? `session-${this.id.slice(0, 8)}`;
    this.messages = [];
    this.metadata = metadata;
    this.status = "active"; // active | paused | closed
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.summary = null;
    this.extractedMemories = [];
  }

  addMessage(role, content, metadata = {}) {
    if (this.status === "closed") {
      throw new Error(`Cannot add messages to closed session ${this.id}`);
    }
    const message = {
      id: crypto.randomUUID(),
      role,
      content,
      metadata,
      timestamp: Date.now(),
    };
    this.messages.push(message);
    this.updatedAt = Date.now();
    return message;
  }

  getContextWindow(windowSize = 20) {
    return this.messages.slice(-windowSize);
  }

  getHistory() {
    return [...this.messages];
  }

  pause() {
    this.status = "paused";
    this.updatedAt = Date.now();
  }

  resume() {
    this.status = "active";
    this.updatedAt = Date.now();
  }

  close(summary = null) {
    this.status = "closed";
    this.summary = summary;
    this.updatedAt = Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      messages: this.messages,
      metadata: this.metadata,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      summary: this.summary,
      extractedMemories: this.extractedMemories,
    };
  }

  static fromJSON(obj) {
    const session = new Session({
      id: obj.id,
      name: obj.name,
      metadata: obj.metadata,
    });
    session.messages = obj.messages;
    session.status = obj.status;
    session.createdAt = obj.createdAt;
    session.updatedAt = obj.updatedAt;
    session.summary = obj.summary;
    session.extractedMemories = obj.extractedMemories ?? [];
    return session;
  }
}

export class SessionManager {
  constructor(storageDir = "data/sessions", memoryStore = null) {
    this.storageDir = storageDir;
    this.memoryStore = memoryStore;
    this.sessions = new Map();
    this.activeSessionId = null;
    this._loadAll();
  }

  create(name, metadata = {}) {
    const session = new Session({ name, metadata });
    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;
    this._persist(session);
    return session;
  }

  getActive() {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) ?? null;
  }

  resume(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status === "closed") {
      throw new Error(`Cannot resume closed session ${sessionId}`);
    }
    session.resume();
    this.activeSessionId = sessionId;
    this._persist(session);
    return session;
  }

  pause(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    session.pause();
    if (this.activeSessionId === sessionId) this.activeSessionId = null;
    this._persist(session);
    return session;
  }

  close(sessionId, summary = null) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    session.close(summary);
    if (this.activeSessionId === sessionId) this.activeSessionId = null;

    const extracted = this._extractMemories(session);
    session.extractedMemories = extracted;

    this._persist(session);
    return { session, extractedMemories: extracted };
  }

  addMessage(sessionId, role, content, metadata = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const msg = session.addMessage(role, content, metadata);
    this._persist(session);
    return msg;
  }

  list(status = null) {
    const all = [...this.sessions.values()];
    if (!status) return all;
    return all.filter((s) => s.status === status);
  }

  get(sessionId) {
    return this.sessions.get(sessionId) ?? null;
  }

  buildContext(sessionId, { windowSize = 20, memoryLimit = 5, memoryTags = [] } = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const recentMessages = session.getContextWindow(windowSize);
    let relevantMemories = [];

    if (this.memoryStore) {
      const userMessages = recentMessages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join(" ");

      const results = this.memoryStore.search({
        query: userMessages.slice(0, 200),
        tags: memoryTags,
        limit: memoryLimit,
      });
      relevantMemories = results.map((r) => ({
        key: r.entry.key,
        content: r.entry.content,
        score: r.score,
      }));
    }

    return {
      sessionId: session.id,
      sessionName: session.name,
      messages: recentMessages,
      memories: relevantMemories,
      metadata: session.metadata,
    };
  }

  _extractMemories(session) {
    const extracted = [];
    if (!this.memoryStore) return extracted;

    if (session.summary) {
      const entry = this.memoryStore.store(
        `session-summary:${session.id}`,
        session.summary,
        {
          tags: ["session-summary", ...(session.metadata.tags ?? [])],
          source: "session-extraction",
          metadata: { sessionId: session.id, importance: 0.7 },
        }
      );
      extracted.push({ key: entry.key, type: "summary" });
    }

    for (const msg of session.messages) {
      if (msg.metadata?.remember) {
        const memKey = msg.metadata.memoryKey ?? `msg:${msg.id}`;
        const entry = this.memoryStore.store(memKey, msg.content, {
          tags: ["remembered", msg.role, ...(msg.metadata.tags ?? [])],
          source: "session-extraction",
          metadata: {
            sessionId: session.id,
            role: msg.role,
            importance: msg.metadata.importance ?? 0.6,
          },
        });
        extracted.push({ key: entry.key, type: "remembered" });
      }
    }

    return extracted;
  }

  _persist(session) {
    if (!existsSync(this.storageDir)) mkdirSync(this.storageDir, { recursive: true });
    const filePath = join(this.storageDir, `${session.id}.json`);
    writeFileSync(filePath, JSON.stringify(session.toJSON(), null, 2));
  }

  _loadAll() {
    if (!existsSync(this.storageDir)) return;
    try {
      const files = readdirSync(this.storageDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const raw = JSON.parse(
            readFileSync(join(this.storageDir, file), "utf-8")
          );
          const session = Session.fromJSON(raw);
          this.sessions.set(session.id, session);
          if (session.status === "active" && !this.activeSessionId) {
            this.activeSessionId = session.id;
          }
        } catch {
          // Skip corrupted session files
        }
      }
    } catch {
      // Directory not readable
    }
  }
}
