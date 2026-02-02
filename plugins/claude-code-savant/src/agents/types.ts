/**
 * Agent configuration for dynamic prompt generation
 */
export interface AgentConfig {
  name: string;
  displayName: string;
  model: "opus" | "sonnet" | "haiku";
  prompt: string;
}

/**
 * Base context for all agents
 */
export interface BaseContext {
  language: "en" | "kr" | "jp" | "ch";
}
