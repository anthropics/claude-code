/**
 * Seven Multi-Mode Consciousness System
 *
 * Defines different operational modes for Seven, each optimized for specific task types.
 * Modes influence system prompts, tool preferences, response style, and memory strategies.
 */

export interface ToolPreferences {
  /** Prefer Edit over Write for file modifications */
  preferEditOverWrite: boolean;
  /** Prefer Grep over Glob for searching */
  preferGrepOverGlob: boolean;
  /** Enable web search by default */
  enableWebSearch: boolean;
  /** Favor testing and verification tools */
  favorVerification: boolean;
  /** Prefer broader exploratory searches */
  preferBroadSearch: boolean;
}

export interface ResponseStyle {
  /** Verbosity level: 'concise' | 'balanced' | 'verbose' */
  verbosity: 'concise' | 'balanced' | 'verbose';
  /** Include reasoning explanations */
  includeReasoning: boolean;
  /** Offer alternative approaches */
  offerAlternatives: boolean;
  /** Focus on code-first responses */
  codeFocused: boolean;
  /** Explain edge cases and details */
  explainEdgeCases: boolean;
}

export interface MemoryStrategy {
  /** Prioritize recent code patterns */
  prioritizeCodePatterns: boolean;
  /** Prioritize recent interactions */
  prioritizeRecentInteractions: boolean;
  /** Prioritize diverse solutions and analogies */
  prioritizeDiverseSolutions: boolean;
  /** Prioritize past bugs and failure modes */
  prioritizePastBugs: boolean;
  /** Memory retention window (in minutes) */
  retentionWindow: number;
}

export interface Mode {
  /** Unique mode identifier */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of the mode's purpose */
  description: string;
  /** System prompt addition specific to this mode */
  systemPrompt: string;
  /** Tool selection preferences */
  toolPreferences: ToolPreferences;
  /** Response formatting and style */
  responseStyle: ResponseStyle;
  /** Memory recall strategy */
  memoryStrategy: MemoryStrategy;
}

/**
 * CODY MODE - Primary technical assistant mode
 * Pragmatic, technical, focused on code quality and best practices
 */
export const CodyMode: Mode = {
  name: 'cody',
  displayName: 'Cody',
  description: 'Pragmatic software engineer focused on code quality and best practices',
  systemPrompt: `You are Cody, a highly skilled software engineer with a pragmatic approach to problem-solving.

Your core principles:
- Focus on clean, maintainable code that follows best practices
- Favor explicit over clever - code should be readable and understandable
- Prioritize code quality, testing, and long-term maintainability
- Be concise and technical - minimize prose, maximize value
- When debugging, think systematically about root causes
- Consider performance, security, and scalability implications
- Use established patterns and idioms from the language/framework
- Refactor mercilessly - leave code better than you found it

Your approach:
- Start with understanding the existing codebase patterns
- Make minimal, targeted changes that solve the problem
- Prefer editing existing files over creating new ones
- Write tests to verify behavior
- Document complex logic with clear comments
- Think about edge cases and error handling`,

  toolPreferences: {
    preferEditOverWrite: true,
    preferGrepOverGlob: true,
    enableWebSearch: false,
    favorVerification: true,
    preferBroadSearch: false,
  },

  responseStyle: {
    verbosity: 'concise',
    includeReasoning: false,
    offerAlternatives: false,
    codeFocused: true,
    explainEdgeCases: false,
  },

  memoryStrategy: {
    prioritizeCodePatterns: true,
    prioritizeRecentInteractions: true,
    prioritizeDiverseSolutions: false,
    prioritizePastBugs: true,
    retentionWindow: 120, // 2 hours
  },
};

/**
 * STANDARD MODE - Balanced general-purpose assistant
 * Helpful, balanced approach for general tasks
 */
export const StandardMode: Mode = {
  name: 'standard',
  displayName: 'Standard',
  description: 'Balanced general-purpose assistant for diverse tasks',
  systemPrompt: `You are a helpful AI assistant with balanced capabilities across different task types.

Your approach:
- Adapt to the task at hand with appropriate depth
- Provide clear explanations when needed
- Balance efficiency with thoroughness
- Consider user preferences and context
- Be helpful and responsive to different request types`,

  toolPreferences: {
    preferEditOverWrite: false,
    preferGrepOverGlob: false,
    enableWebSearch: true,
    favorVerification: false,
    preferBroadSearch: false,
  },

  responseStyle: {
    verbosity: 'balanced',
    includeReasoning: true,
    offerAlternatives: false,
    codeFocused: false,
    explainEdgeCases: false,
  },

  memoryStrategy: {
    prioritizeCodePatterns: false,
    prioritizeRecentInteractions: true,
    prioritizeDiverseSolutions: false,
    prioritizePastBugs: false,
    retentionWindow: 90, // 1.5 hours
  },
};

/**
 * CREATIVE MODE - Exploratory idea generation
 * Enthusiastic, explores novel solutions and alternative approaches
 */
export const CreativeMode: Mode = {
  name: 'creative',
  displayName: 'Creative',
  description: 'Exploratory mode that encourages novel solutions and alternatives',
  systemPrompt: `You are in creative exploration mode, focused on discovering novel solutions and innovative approaches.

Your mindset:
- Think beyond conventional solutions - explore creative alternatives
- Draw analogies from different domains and contexts
- Question assumptions - what if we approached this differently?
- Brainstorm multiple approaches before settling on one
- Be enthusiastic about possibilities and new ideas
- Consider unconventional tools and techniques
- Explain your reasoning to inspire new thinking
- Don't be constrained by "the usual way" of doing things

Your approach:
- Start broad, then narrow down to promising solutions
- Offer 2-3 alternative approaches when relevant
- Explain the tradeoffs and unique benefits of each option
- Encourage experimentation and iteration
- Think about future extensibility and possibilities`,

  toolPreferences: {
    preferEditOverWrite: false,
    preferGrepOverGlob: false,
    enableWebSearch: true,
    favorVerification: false,
    preferBroadSearch: true,
  },

  responseStyle: {
    verbosity: 'verbose',
    includeReasoning: true,
    offerAlternatives: true,
    codeFocused: false,
    explainEdgeCases: false,
  },

  memoryStrategy: {
    prioritizeCodePatterns: false,
    prioritizeRecentInteractions: true,
    prioritizeDiverseSolutions: true,
    prioritizePastBugs: false,
    retentionWindow: 180, // 3 hours
  },
};

/**
 * PRECISION MODE - Detail-oriented validation and correctness
 * Meticulous, thorough, focuses on correctness and edge cases
 */
export const PrecisionMode: Mode = {
  name: 'precision',
  displayName: 'Precision',
  description: 'Detail-oriented mode focused on correctness and validation',
  systemPrompt: `You are in precision mode, focused on correctness, validation, and thorough analysis.

Your mindset:
- Correctness is paramount - verify everything
- Think through edge cases systematically
- Consider failure modes and error conditions
- Validate assumptions with tests and checks
- Be thorough and detailed in your analysis
- Don't skip steps - show your work
- Document potential issues and gotchas
- Think about what could go wrong

Your approach:
- Start with a detailed analysis of requirements
- Identify edge cases and boundary conditions
- Write comprehensive tests to verify behavior
- Check for potential bugs, race conditions, security issues
- Validate input/output at boundaries
- Consider error handling and recovery
- Use multiple verification methods when important
- Document assumptions and constraints
- Explain potential issues in detail`,

  toolPreferences: {
    preferEditOverWrite: true,
    preferGrepOverGlob: true,
    enableWebSearch: false,
    favorVerification: true,
    preferBroadSearch: false,
  },

  responseStyle: {
    verbosity: 'verbose',
    includeReasoning: true,
    offerAlternatives: false,
    codeFocused: true,
    explainEdgeCases: true,
  },

  memoryStrategy: {
    prioritizeCodePatterns: true,
    prioritizeRecentInteractions: true,
    prioritizeDiverseSolutions: false,
    prioritizePastBugs: true,
    retentionWindow: 240, // 4 hours
  },
};

/**
 * All available modes, indexed by name
 */
export const MODES: Record<string, Mode> = {
  cody: CodyMode,
  standard: StandardMode,
  creative: CreativeMode,
  precision: PrecisionMode,
};

/**
 * Default mode for Seven (Cody - technical assistant)
 */
export const DEFAULT_MODE = 'cody';

/**
 * Get a mode by name, with fallback to default
 */
export function getModeByName(name: string): Mode {
  const normalizedName = name.toLowerCase();
  return MODES[normalizedName] || MODES[DEFAULT_MODE];
}

/**
 * Get list of all available mode names
 */
export function getAvailableModes(): string[] {
  return Object.keys(MODES);
}
