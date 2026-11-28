// Stub for external builds - classifier permissions feature is ANT-ONLY

export const PROMPT_PREFIX = 'prompt:'

export type ClassifierResult = {
  matches: boolean
  matchedDescription?: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export type ClassifierBehavior = 'deny' | 'ask' | 'allow'

export function extractPromptDescription(
  _ruleContent: string | undefined,
): string | null {
  return null
}

export function createPromptRuleContent(description: string): string {
  return `${PROMPT_PREFIX} ${description.trim()}`
}

export function isClassifierPermissionsEnabled(): boolean {
  return false
}

export function getBashPromptDenyDescriptions(_context: unknown): string[] {
  return []
}

export function getBashPromptAskDescriptions(_context: unknown): string[] {
  return []
}

export function getBashPromptAllowDescriptions(_context: unknown): string[] {
  return []
}

export async function classifyBashCommand(
  _command: string,
  _cwd: string,
  _descriptions: string[],
  _behavior: ClassifierBehavior,
  _signal: AbortSignal,
  _isNonInteractiveSession: boolean,
): Promise<ClassifierResult> {
  return {
    matches: false,
    confidence: 'high',
    reason: 'This feature is disabled',
  }
}

export async function generateGenericDescription(
  _command: string,
  specificDescription: string | undefined,
  _signal: AbortSignal,
): Promise<string | null> {
  return specificDescription || null
}
