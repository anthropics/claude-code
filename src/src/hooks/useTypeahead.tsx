import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotifications } from 'src/context/notifications.js';
import { Text } from 'src/ink.js';
import { logEvent } from 'src/services/analytics/index.js';
import { useDebounceCallback } from 'usehooks-ts';
import { type Command, getCommandName } from '../commands.js';
import { getModeFromInput, getValueFromInput } from '../components/PromptInput/inputModes.js';
import type { SuggestionItem, SuggestionType } from '../components/PromptInput/PromptInputFooterSuggestions.js';
import { useIsModalOverlayActive, useRegisterOverlay } from '../context/overlayContext.js';
import { KeyboardEvent } from '../ink/events/keyboard-event.js';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- backward-compat bridge until consumers wire handleKeyDown to <Box onKeyDown>
import { useInput } from '../ink.js';
import { useOptionalKeybindingContext, useRegisterKeybindingContext } from '../keybindings/KeybindingContext.js';
import { useKeybindings } from '../keybindings/useKeybinding.js';
import { useShortcutDisplay } from '../keybindings/useShortcutDisplay.js';
import { useAppState, useAppStateStore } from '../state/AppState.js';
import type { AgentDefinition } from '../tools/AgentTool/loadAgentsDir.js';
import type { InlineGhostText, PromptInputMode } from '../types/textInputTypes.js';
import { isAgentSwarmsEnabled } from '../utils/agentSwarmsEnabled.js';
import { generateProgressiveArgumentHint, parseArguments } from '../utils/argumentSubstitution.js';
import { getShellCompletions, type ShellCompletionType } from '../utils/bash/shellCompletion.js';
import { formatLogMetadata } from '../utils/format.js';
import { getSessionIdFromLog, searchSessionsByCustomTitle } from '../utils/sessionStorage.js';
import { applyCommandSuggestion, findMidInputSlashCommand, generateCommandSuggestions, getBestCommandMatch, isCommandInput } from '../utils/suggestions/commandSuggestions.js';
import { getDirectoryCompletions, getPathCompletions, isPathLikeToken } from '../utils/suggestions/directoryCompletion.js';
import { getShellHistoryCompletion } from '../utils/suggestions/shellHistoryCompletion.js';
import { getSlackChannelSuggestions, hasSlackMcpServer } from '../utils/suggestions/slackChannelSuggestions.js';
import { TEAM_LEAD_NAME } from '../utils/swarm/constants.js';
import { applyFileSuggestion, findLongestCommonPrefix, onIndexBuildComplete, startBackgroundCacheRefresh } from './fileSuggestions.js';
import { generateUnifiedSuggestions } from './unifiedSuggestions.js';

// Unicode-aware character class for file path tokens:
// \p{L} = letters (CJK, Latin, Cyrillic, etc.)
// \p{N} = numbers (incl. fullwidth)
// \p{M} = combining marks (macOS NFD accents, Devanagari vowel signs)
const AT_TOKEN_HEAD_RE = /^@[\p{L}\p{N}\p{M}_\-./\\()[\]~:]*/u;
const PATH_CHAR_HEAD_RE = /^[\p{L}\p{N}\p{M}_\-./\\()[\]~:]+/u;
const TOKEN_WITH_AT_RE = /(@[\p{L}\p{N}\p{M}_\-./\\()[\]~:]*|[\p{L}\p{N}\p{M}_\-./\\()[\]~:]+)$/u;
const TOKEN_WITHOUT_AT_RE = /[\p{L}\p{N}\p{M}_\-./\\()[\]~:]+$/u;
const HAS_AT_SYMBOL_RE = /(^|\s)@([\p{L}\p{N}\p{M}_\-./\\()[\]~:]*|"[^"]*"?)$/u;
const HASH_CHANNEL_RE = /(^|\s)#([a-z0-9][a-z0-9_-]*)$/;

// Type guard for path completion metadata
function isPathMetadata(metadata: unknown): metadata is {
  type: 'directory' | 'file';
} {
  return typeof metadata === 'object' && metadata !== null && 'type' in metadata && (metadata.type === 'directory' || metadata.type === 'file');
}

// Helper to determine selectedSuggestion when updating suggestions
function getPreservedSelection(prevSuggestions: SuggestionItem[], prevSelection: number, newSuggestions: SuggestionItem[]): number {
  // No new suggestions
  if (newSuggestions.length === 0) {
    return -1;
  }

  // No previous selection
  if (prevSelection < 0) {
    return 0;
  }

  // Get the previously selected item
  const prevSelectedItem = prevSuggestions[prevSelection];
  if (!prevSelectedItem) {
    return 0;
  }

  // Try to find the same item in the new list by ID
  const newIndex = newSuggestions.findIndex(item => item.id === prevSelectedItem.id);

  // Return the new index if found, otherwise default to 0
  return newIndex >= 0 ? newIndex : 0;
}
function buildResumeInputFromSuggestion(suggestion: SuggestionItem): string {
  const metadata = suggestion.metadata as {
    sessionId: string;
  } | undefined;
  return metadata?.sessionId ? `/resume ${metadata.sessionId}` : `/resume ${suggestion.displayText}`;
}
type Props = {
  onInputChange: (value: string) => void;
  onSubmit: (value: string, isSubmittingSlashCommand?: boolean) => void;
  setCursorOffset: (offset: number) => void;
  input: string;
  cursorOffset: number;
  commands: Command[];
  mode: string;
  agents: AgentDefinition[];
  setSuggestionsState: (f: (previousSuggestionsState: {
    suggestions: SuggestionItem[];
    selectedSuggestion: number;
    commandArgumentHint?: string;
  }) => {
    suggestions: SuggestionItem[];
    selectedSuggestion: number;
    commandArgumentHint?: string;
  }) => void;
  suggestionsState: {
    suggestions: SuggestionItem[];
    selectedSuggestion: number;
    commandArgumentHint?: string;
  };
  suppressSuggestions?: boolean;
  markAccepted: () => void;
  onModeChange?: (mode: PromptInputMode) => void;
};
type UseTypeaheadResult = {
  suggestions: SuggestionItem[];
  selectedSuggestion: number;
  suggestionType: SuggestionType;
  maxColumnWidth?: number;
  commandArgumentHint?: string;
  inlineGhostText?: InlineGhostText;
  handleKeyDown: (e: KeyboardEvent) => void;
};

/**
 * Extract search token from a completion token by removing @ prefix and quotes
 * @param completionToken The completion token
 * @returns The search token with @ and quotes removed
 */
export function extractSearchToken(completionToken: {
  token: string;
  isQuoted?: boolean;
}): string {
  if (completionToken.isQuoted) {
    // Remove @" prefix and optional closing "
    return completionToken.token.slice(2).replace(/"$/, '');
  } else if (completionToken.token.startsWith('@')) {
    return completionToken.token.substring(1);
  } else {
    return completionToken.token;
  }
}

/**
 * Format a replacement value with proper @ prefix and quotes based on context
 * @param options Configuration for formatting
 * @param options.displayText The text to display
 * @param options.mode The current mode (bash or prompt)
 * @param options.hasAtPrefix Whether the original token has @ prefix
 * @param options.needsQuotes Whether the text needs quotes (contains spaces)
 * @param options.isQuoted Whether the original token was already quoted (user typed @"...)
 * @param options.isComplete Whether this is a complete suggestion (adds trailing space)
 * @returns The formatted replacement value
 */
export function formatReplacementValue(options: {
  displayText: string;
  mode: string;
  hasAtPrefix: boolean;
  needsQuotes: boolean;
  isQuoted?: boolean;
  isComplete: boolean;
}): string {
  const {
    displayText,
    mode,
    hasAtPrefix,
    needsQuotes,
    isQuoted,
    isComplete
  } = options;
  const space = isComplete ? ' ' : '';
  if (isQuoted || needsQuotes) {
    // Use quoted format
    return mode === 'bash' ? `"${displayText}"${space}` : `@"${displayText}"${space}`;
  } else if (hasAtPrefix) {
    return mode === 'bash' ? `${displayText}${space}` : `@${displayText}${space}`;
  } else {
    return displayText;
  }
}

/**
 * Apply a shell completion suggestion by replacing the current word
 */
export function applyShellSuggestion(suggestion: SuggestionItem, input: string, cursorOffset: number, onInputChange: (value: string) => void, setCursorOffset: (offset: number) => void, completionType: ShellCompletionType | undefined): void {
  const beforeCursor = input.slice(0, cursorOffset);
  const lastSpaceIndex = beforeCursor.lastIndexOf(' ');
  const wordStart = lastSpaceIndex + 1;

  // Prepare the replacement text based on completion type
  let replacementText: string;
  if (completionType === 'variable') {
    replacementText = '$' + suggestion.displayText + ' ';
  } else if (completionType === 'command') {
    replacementText = suggestion.displayText + ' ';
  } else {
    replacementText = suggestion.displayText;
  }
  const newInput = input.slice(0, wordStart) + replacementText + input.slice(cursorOffset);
  onInputChange(newInput);
  setCursorOffset(wordStart + replacementText.length);
}
const DM_MEMBER_RE = /(^|\s)@[\w-]*$/;
function applyTriggerSuggestion(suggestion: SuggestionItem, input: string, cursorOffset: number, triggerRe: RegExp, onInputChange: (value: string) => void, setCursorOffset: (offset: number) => void): void {
  const m = input.slice(0, cursorOffset).match(triggerRe);
  if (!m || m.index === undefined) return;
  const prefixStart = m.index + (m[1]?.length ?? 0);
  const before = input.slice(0, prefixStart);
  const newInput = before + suggestion.displayText + ' ' + input.slice(cursorOffset);
  onInputChange(newInput);
  setCursorOffset(before.length + suggestion.displayText.length + 1);
}
let currentShellCompletionAbortController: AbortController | null = null;

/**
 * Generate bash shell completion suggestions
 */
async function generateBashSuggestions(input: string, cursorOffset: number): Promise<SuggestionItem[]> {
  try {
    if (currentShellCompletionAbortController) {
      currentShellCompletionAbortController.abort();
    }
    currentShellCompletionAbortController = new AbortController();
    const suggestions = await getShellCompletions(input, cursorOffset, currentShellCompletionAbortController.signal);
    return suggestions;
  } catch {
    // Silent failure - don't break UX
    logEvent('tengu_shell_completion_failed', {});
    return [];
  }
}

/**
 * Apply a directory/path completion suggestion to the input
 * Always adds @ prefix since we're replacing the entire token (including any existing @)
 *
 * @param input The current input text
 * @param suggestionId The ID of the suggestion to apply
 * @param tokenStartPos The start position of the token being replaced
 * @param tokenLength The length of the token being replaced
 * @param isDirectory Whether the suggestion is a directory (adds / suffix) or file (adds space)
 * @returns Object with the new input text and cursor position
 */
export function applyDirectorySuggestion(input: string, suggestionId: string, tokenStartPos: number, tokenLength: number, isDirectory: boolean): {
  newInput: string;
  cursorPos: number;
} {
  const suffix = isDirectory ? '/' : ' ';
  const before = input.slice(0, tokenStartPos);
  const after = input.slice(tokenStartPos + tokenLength);
  // Always add @ prefix - if token already has it, we're replacing
  // the whole token (including @) with @suggestion.id
  const replacement = '@' + suggestionId + suffix;
  const newInput = before + replacement + after;
  return {
    newInput,
    cursorPos: before.length + replacement.length
  };
}

/**
 * Extract a completable token at the cursor position
 * @param text The input text
 * @param cursorPos The cursor position
 * @param includeAtSymbol Whether to consider @ symbol as part of the token
 * @returns The completable token and its start position, or null if not found
 */
export function extractCompletionToken(text: string, cursorPos: number, includeAtSymbol = false): {
  token: string;
  startPos: number;
  isQuoted?: boolean;
} | null {
  // Empty input check
  if (!text) return null;

  // Get text up to cursor
  const textBeforeCursor = text.substring(0, cursorPos);

  // Check for quoted @ mention first (e.g., @"my file with spaces")
  if (includeAtSymbol) {
    const quotedAtRegex = /@"([^"]*)"?$/;
    const quotedMatch = textBeforeCursor.match(quotedAtRegex);
    if (quotedMatch && quotedMatch.index !== undefined) {
      // Include any remaining quoted content after cursor until closing quote or end
      const textAfterCursor = text.substring(cursorPos);
      const afterQuotedMatch = textAfterCursor.match(/^[^"]*"?/);
      const quotedSuffix = afterQuotedMatch ? afterQuotedMatch[0] : '';
      return {
        token: quotedMatch[0] + quotedSuffix,
        startPos: quotedMatch.index,
        isQuoted: true
      };
    }
  }

  // Fast path for @ tokens: use lastIndexOf to avoid expensive $ anchor scan
  if (includeAtSymbol) {
    const atIdx = textBeforeCursor.lastIndexOf('@');
    if (atIdx >= 0 && (atIdx === 0 || /\s/.test(textBeforeCursor[atIdx - 1]!))) {
      const fromAt = textBeforeCursor.substring(atIdx);
      const atHeadMatch = fromAt.match(AT_TOKEN_HEAD_RE);
      if (atHeadMatch && atHeadMatch[0].length === fromAt.length) {
        const textAfterCursor = text.substring(cursorPos);
        const afterMatch = textAfterCursor.match(PATH_CHAR_HEAD_RE);
        const tokenSuffix = afterMatch ? afterMatch[0] : '';
        return {
          token: atHeadMatch[0] + tokenSuffix,
          startPos: atIdx,
          isQuoted: false
        };
      }
    }
  }

  // Non-@ token or cursor outside @ token — use $ anchor on (short) tail
  const tokenRegex = includeAtSymbol ? TOKEN_WITH_AT_RE : TOKEN_WITHOUT_AT_RE;
  const match = textBeforeCursor.match(tokenRegex);
  if (!match || match.index === undefined) {
    return null;
  }

  // Check if cursor is in the MIDDLE of a token (more word characters after cursor)
  // If so, extend the token to include all characters until whitespace or end of string
  const textAfterCursor = text.substring(cursorPos);
  const afterMatch = textAfterCursor.match(PATH_CHAR_HEAD_RE);
  const tokenSuffix = afterMatch ? afterMatch[0] : '';
  return {
    token: match[0] + tokenSuffix,
    startPos: match.index,
    isQuoted: false
  };
}
function extractCommandNameAndArgs(value: string): {
  commandName: string;
  args: string;
} | null {
  if (isCommandInput(value)) {
    const spaceIndex = value.indexOf(' ');
    if (spaceIndex === -1) return {
      commandName: value.slice(1),
      args: ''
    };
    return {
      commandName: value.slice(1, spaceIndex),
      args: value.slice(spaceIndex + 1)
    };
  }
  return null;
}
function hasCommandWithArguments(isAtEndWithWhitespace: boolean, value: string) {
  // If value.endsWith(' ') but the user is not at the end, then the user has
  // potentially gone back to the command in an effort to edit the command name
  // (but preserve the arguments).
  return !isAtEndWithWhitespace && value.includes(' ') && !value.endsWith(' ');
}

/**
 * Hook for handling typeahead functionality for both commands and file paths
 */
export function useTypeahead({
  commands,
  onInputChange,
  onSubmit,
  setCursorOffset,
  input,
  cursorOffset,
  mode,
  agents,
  setSuggestionsState,
  suggestionsState: {
    suggestions,
    selectedSuggestion,
    commandArgumentHint
  },
  suppressSuggestions = false,
  markAccepted,
  onModeChange
}: Props): UseTypeaheadResult {
  const {
    addNotification
  } = useNotifications();
  const thinkingToggleShortcut = useShortcutDisplay('chat:thinkingToggle', 'Chat', 'alt+t');
  const [suggestionType, setSuggestionType] = useState<SuggestionType>('none');

  // Compute max column width from ALL commands once (not filtered results)
  // This prevents layout shift when filtering
  const allCommandsMaxWidth = useMemo(() => {
    const visibleCommands = commands.filter(cmd => !cmd.isHidden);
    if (visibleCommands.length === 0) return undefined;
    const maxLen = Math.max(...visibleCommands.map(cmd => getCommandName(cmd).length));
    return maxLen + 6; // +1 for "/" prefix, +5 for padding
  }, [commands]);
  const [maxColumnWidth, setMaxColumnWidth] = useState<number | undefined>(undefined);
  const mcpResources = useAppState(s => s.mcp.resources);
  const store = useAppStateStore();
  const promptSuggestion = useAppState(s => s.promptSuggestion);
  // PromptInput hides suggestion ghost text in teammate view — mirror that
  // gate here so Tab/rightArrow can't accept what isn't displayed.
  const isViewingTeammate = useAppState(s => !!s.viewingAgentTaskId);

  // Access keybinding context to check for pending chord sequences
  const keybindingContext = useOptionalKeybindingContext();

  // State for inline ghost text (bash history completion - async)
  const [inlineGhostText, setInlineGhostText] = useState<InlineGhostText | undefined>(undefined);

  // Synchronous ghost text for prompt mode mid-input slash commands.
  // Computed during render via useMemo to eliminate the one-frame flicker
  // that occurs when using useState + useEffect (effect runs after render).
  const syncPromptGhostText = useMemo((): InlineGhostText | undefined => {
    if (mode !== 'prompt' || suppressSuggestions) return undefined;
    const midInputCommand = findMidInputSlashCommand(input, cursorOffset);
    if (!midInputCommand) return undefined;
    const match = getBestCommandMatch(midInputCommand.partialCommand, commands);
    if (!match) return undefined;
    return {
      text: match.suffix,
      fullCommand: match.fullCommand,
      insertPosition: midInputCommand.startPos + 1 + midInputCommand.partialCommand.length
    };
  }, [input, cursorOffset, mode, commands, suppressSuggestions]);

  // Merged ghost text: prompt mode uses synchronous useMemo, bash mode uses async useState
  const effectiveGhostText = suppressSuggestions ? undefined : mode === 'prompt' ? syncPromptGhostText : inlineGhostText;

  // Use a ref for cursorOffset to avoid re-triggering suggestions on cursor movement alone
  // We only want to re-fetch suggestions when the actual search token changes
  const cursorOffsetRef = useRef(cursorOffset);
  cursorOffsetRef.current = cursorOffset;

  // Track the latest search token to discard stale results from slow async operations
  const latestSearchTokenRef = useRef<string | null>(null);
  // Track previous input to detect actual text changes vs. callback recreations
  const prevInputRef = useRef('');
  // Track the latest path token to discard stale results from path completion
  const latestPathTokenRef = useRef('');
  // Track the latest bash input to discard stale results from history completion
  const latestBashInputRef = useRef('');
  // Track the latest slack channel token to discard stale results from MCP
  const latestSlackTokenRef = useRef('');
  // Track suggestions via ref to avoid updateSuggestions being recreated on selection changes
  const suggestionsRef = useRef(suggestions);
  suggestionsRef.current = suggestions;
  // Track the input value when suggestions were manually dismissed to prevent re-triggering
  const dismissedForInputRef = useRef<string | null>(null);

  // Clear all suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestionsState(() => ({
      commandArgumentHint: undefined,
      suggestions: [],
      selectedSuggestion: -1
    }));
    setSuggestionType('none');
    setMaxColumnWidth(undefined);
    setInlineGhostText(undefined);
  }, [setSuggestionsState]);

  // Expensive async operation to fetch file/resource suggestions
  const fetchFileSuggestions = useCallback(async (searchToken: string, isAtSymbol = false): Promise<void> => {
    latestSearchTokenRef.current = searchToken;
    const combinedItems = await generateUnifiedSuggestions(searchToken, mcpResources, agents, isAtSymbol);
    // Discard stale results if a newer query was initiated while waiting
    if (latestSearchTokenRef.current !== searchToken) {
      return;
    }
    if (combinedItems.length === 0) {
      // Inline clearSuggestions logic to avoid needing debouncedFetchFileSuggestions
      setSuggestionsState(() => ({
        commandArgumentHint: undefined,
        suggestions: [],
        selectedSuggestion: -1
      }));
      setSuggestionType('none');
      setMaxColumnWidth(undefined);
      return;
    }
    setSuggestionsState(prev => ({
      commandArgumentHint: undefined,
      suggestions: combinedItems,
      selectedSuggestion: getPreservedSelection(prev.suggestions, prev.selectedSuggestion, combinedItems)
    }));
    setSuggestionType(combinedItems.length > 0 ? 'file' : 'none');
    setMaxColumnWidth(undefined); // No fixed width for file suggestions
  }, [mcpResources, setSuggestionsState, setSuggestionType, setMaxColumnWidth, agents]);

  // Pre-warm the file index on mount so the first @-mention doesn't block.
  // The build runs in background with ~4ms event-loop yields, so it doesn't
  // delay first render — it just races the user's first @ keystroke.
  //
  // If the user types before the build finishes, they get partial results
  // from the ready chunks; when the build completes, re-fire the last
  // search so partial upgrades to full. Clears the token ref so the same
  // query isn't discarded as stale.
  //
  // Skipped under NODE_ENV=test: REPL-mounting tests would spawn git ls-files
  // against the real CI workspace (270k+ files on Windows runners), and the
  // background build outlives the test — its setImmediate chain leaks into
  // subsequent tests in the shard. The subscriber still registers so
  // fileSuggestions tests that trigger a refresh directly work correctly.
  useEffect(() => {
    if ("production" !== 'test') {
      startBackgroundCacheRefresh();
    }
    return onIndexBuildComplete(() => {
      const token = latestSearchTokenRef.current;
      if (token !== null) {
        latestSearchTokenRef.current = null;
        void fetchFileSuggestions(token, token === '');
      }
    });
  }, [fetchFileSuggestions]);

  // Debounce the file fetch operation. 50ms sits just above macOS default
  // key-repeat (~33ms) so held-delete/backspace coalesces into one search
  // instead of stuttering on each repeated key. The search itself is ~8–15ms
  // on a 270k-file index.
  const debouncedFetchFileSuggestions = useDebounceCallback(fetchFileSuggestions, 50);
  const fetchSlackChannels = useCallback(async (partial: string): Promise<void> => {
    latestSlackTokenRef.current = partial;
    const channels = await getSlackChannelSuggestions(store.getState().mcp.clients, partial);
    if (latestSlackTokenRef.current !== partial) return;
    setSuggestionsState(prev => ({
      commandArgumentHint: undefined,
      suggestions: channels,
      selectedSuggestion: getPreservedSelection(prev.suggestions, prev.selectedSuggestion, channels)
    }));
    setSuggestionType(channels.length > 0 ? 'slack-channel' : 'none');
    setMaxColumnWidth(undefined);
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps -- store is a stable context ref
  [setSuggestionsState]);

  // First keystroke after # needs the MCP round-trip; subsequent keystrokes
  // that share the same first-word segment hit the cache synchronously.
  const debouncedFetchSlackChannels = useDebounceCallback(fetchSlackChannels, 150);

  // Handle immediate suggestion logic (cheap operations)
  // biome-ignore lint/correctness/useExhaustiveDependencies: store is a stable context ref, read imperatively at call-time
  const updateSuggestions = useCallback(async (value: string, inputCursorOffset?: number): Promise<void> => {
    // Use provided cursor offset or fall back to ref (avoids dependency on cursorOffset)
    const effectiveCursorOffset = inputCursorOffset ?? cursorOffsetRef.current;
    if (suppressSuggestions) {
      debouncedFetchFileSuggestions.cancel();
      clearSuggestions();
      return;
    }

    // Check for mid-input slash command (e.g., "help me /com")
    // Only in prompt mode, not when input starts with "/" (handled separately)
    // Note: ghost text for prompt mode is computed synchronously via syncPromptGhostText useMemo.
    // We only need to clear dropdown suggestions here when ghost text is active.
    if (mode === 'prompt') {
      const midInputCommand = findMidInputSlashCommand(value, effectiveCursorOffset);
      if (midInputCommand) {
        const match = getBestCommandMatch(midInputCommand.partialCommand, commands);
        if (match) {
          // Clear dropdown suggestions when showing ghost text
          setSuggestionsState(() => ({
            commandArgumentHint: undefined,
            suggestions: [],
            selectedSuggestion: -1
          }));
          setSuggestionType('none');
          setMaxColumnWidth(undefined);
          return;
        }
      }
    }

    // Bash mode: check for history-based ghost text completion
    if (mode === 'bash' && value.trim()) {
      latestBashInputRef.current = value;
      const historyMatch = await getShellHistoryCompletion(value);
      // Discard stale results if input changed while waiting
      if (latestBashInputRef.current !== value) {
        return;
      }
      if (historyMatch) {
        setInlineGhostText({
          text: historyMatch.suffix,
          fullCommand: historyMatch.fullCommand,
          insertPosition: value.length
        });
        // Clear dropdown suggestions when showing ghost text
        setSuggestionsState(() => ({
          commandArgumentHint: undefined,
          suggestions: [],
          selectedSuggestion: -1
        }));
        setSuggestionType('none');
        setMaxColumnWidth(undefined);
        return;
      } else {
        // No history match, clear ghost text
        setInlineGhostText(undefined);
      }
    }

    // Check for @ to trigger team member / named subagent suggestions
    // Must check before @ file symbol to prevent conflict
    // Skip in bash mode - @ has no special meaning in shell commands
    const atMatch = mode !== 'bash' ? value.substring(0, effectiveCursorOffset).match(/(^|\s)@([\w-]*)$/) : null;
    if (atMatch) {
      const partialName = (atMatch[2] ?? '').toLowerCase();
      // Imperative read — reading at call-time fixes staleness for
      // teammates/subagents added mid-session.
      const state = store.getState();
      const members: SuggestionItem[] = [];
      const seen = new Set<string>();
      if (isAgentSwarmsEnabled() && state.teamContext) {
        for (const t of Object.values(state.teamContext.teammates ?? {})) {
          if (t.name === TEAM_LEAD_NAME) continue;
          if (!t.name.toLowerCase().startsWith(partialName)) continue;
          seen.add(t.name);
          members.push({
            id: `dm-${t.name}`,
            displayText: `@${t.name}`,
            description: 'send message'
          });
        }
      }
      for (const [name, agentId] of state.agentNameRegistry) {
        if (seen.has(name)) continue;
        if (!name.toLowerCase().startsWith(partialName)) continue;
        const status = state.tasks[agentId]?.status;
        members.push({
          id: `dm-${name}`,
          displayText: `@${name}`,
          description: status ? `send message · ${status}` : 'send message'
        });
      }
      if (members.length > 0) {
        debouncedFetchFileSuggestions.cancel();
        setSuggestionsState(prev => ({
          commandArgumentHint: undefined,
          suggestions: members,
          selectedSuggestion: getPreservedSelection(prev.suggestions, prev.selectedSuggestion, members)
        }));
        setSuggestionType('agent');
        setMaxColumnWidth(undefined);
        return;
      }
    }

    // Check for # to trigger Slack channel suggestions (requires Slack MCP server)
    if (mode === 'prompt') {
      const hashMatch = value.substring(0, effectiveCursorOffset).match(HASH_CHANNEL_RE);
      if (hashMatch && hasSlackMcpServer(store.getState().mcp.clients)) {
        debouncedFetchSlackChannels(hashMatch[2]!);
        return;
      } else if (suggestionType === 'slack-channel') {
        debouncedFetchSlackChannels.cancel();
        clearSuggestions();
      }
    }

    // Check for @ symbol to trigger file suggestions (including quoted paths)
    // Includes colon for MCP resources (e.g., server:resource/path)
    const hasAtSymbol = value.substring(0, effectiveCursorOffset).match(HAS_AT_SYMBOL_RE);

    // First, check for slash command suggestions (higher priority than @ symbol)
    // Only show slash command selector if cursor is not on the "/" character itself
    // Also don't show if cursor is at end of line with whitespace before it
    // Don't show slash commands in bash mode
    const isAtEndWithWhitespace = effectiveCursorOffset === value.length && effectiveCursorOffset > 0 && value.length > 0 && value[effectiveCursorOffset - 1] === ' ';

    // Handle directory completion for commands
    if (mode === 'prompt' && isCommandInput(value) && effectiveCursorOffset > 0) {
      const parsedCommand = extractCommandNameAndArgs(value);
      if (parsedCommand && parsedCommand.commandName === 'add-dir' && parsedCommand.args) {
        const {
          args
        } = parsedCommand;

        // Clear suggestions if args end with whitespace (user is done with path)
        if (args.match(/\s+$/)) {
          debouncedFetchFileSuggestions.cancel();
          clearSuggestions();
          return;
        }
        const dirSuggestions = await getDirectoryCompletions(args);
        if (dirSuggestions.length > 0) {
          setSuggestionsState(prev => ({
            suggestions: dirSuggestions,
            selectedSuggestion: getPreservedSelection(prev.suggestions, prev.selectedSuggestion, dirSuggestions),
            commandArgumentHint: undefined
          }));
          setSuggestionType('directory');
          return;
        }

        // No suggestions found - clear and return
        debouncedFetchFileSuggestions.cancel();
        clearSuggestions();
        return;
      }

      // Handle custom title completion for /resume command
      if (parsedCommand && parsedCommand.commandName === 'resume' && parsedCommand.args !== undefined && value.includes(' ')) {
        const {
          args
        } = parsedCommand;

        // Get custom title suggestions using partial match
        const matches = await searchSessionsByCustomTitle(args, {
          limit: 10
        });
        const suggestions = matches.map(log => {
          const sessionId = getSessionIdFromLog(log);
          return {
            id: `resume-title-${sessionId}`,
            displayText: log.customTitle!,
            description: formatLogMetadata(log),
            metadata: {
              sessionId
            }
          };
        });
        if (suggestions.length > 0) {
          setSuggestionsState(prev => ({
            suggestions,
            selectedSuggestion: getPreservedSelection(prev.suggestions, prev.selectedSuggestion, suggestions),
            commandArgumentHint: undefined
          }));
          setSuggestionType('custom-title');
          return;
        }

        // No suggestions found - clear and return
        clearSuggestions();
        return;
      }
    }

    // Determine whether to display the argument hint and command suggestions.
    if (mode === 'prompt' && isCommandInput(value) && effectiveCursorOffset > 0 && !hasCommandWithArguments(isAtEndWithWhitespace, value)) {
      let commandArgumentHint: string | undefined = undefined;
      if (value.length > 1) {
        // We have a partial or complete command without arguments
        // Check if it matches a command exactly and has an argument hint

        // Extract command name: everything after / until the first space (or end)
        const spaceIndex = value.indexOf(' ');
        const commandName = spaceIndex === -1 ? value.slice(1) : value.slice(1, spaceIndex);

        // Check if there are real arguments (non-whitespace after the command)
        const hasRealArguments = spaceIndex !== -1 && value.slice(spaceIndex + 1).trim().length > 0;

        // Check if input is exactly "command + single space" (ready for arguments)
        const hasExactlyOneTrailingSpace = spaceIndex !== -1 && value.length === spaceIndex + 1;

        // If input has a space after the command, don't show suggestions
        // This prevents Enter from selecting a different command after Tab completion
        if (spaceIndex !== -1) {
          const exactMatch = commands.find(cmd => getCommandName(cmd) === commandName);
          if (exactMatch || hasRealArguments) {
            // Priority 1: Static argumentHint (only on first trailing space for backwards compat)
            if (exactMatch?.argumentHint && hasExactlyOneTrailingSpace) {
              commandArgumentHint = exactMatch.argumentHint;
            }
            // Priority 2: Progressive hint from argNames (show when trailing space)
            else if (exactMatch?.type === 'prompt' && exactMatch.argNames?.length && value.endsWith(' ')) {
              const argsText = value.slice(spaceIndex + 1);
              const typedArgs = parseArguments(argsText);
              commandArgumentHint = generateProgressiveArgumentHint(exactMatch.argNames, typedArgs);
            }
            setSuggestionsState(() => ({
              commandArgumentHint,
              suggestions: [],
              selectedSuggestion: -1
            }));
            setSuggestionType('none');
            setMaxColumnWidth(undefined);
            return;
          }
        }

        // Note: argument hint is only shown when there's exactly one trailing space
        // (set above when hasExactlyOneTrailingSpace is true)
      }
      const commandItems = generateCommandSuggestions(value, commands);
      setSuggestionsState(() => ({
        commandArgumentHint,
        suggestions: commandItems,
        selectedSuggestion: commandItems.length > 0 ? 0 : -1
      }));
      setSuggestionType(commandItems.length > 0 ? 'command' : 'none');

      // Use stable width from all commands (prevents layout shift when filtering)
      if (commandItems.length > 0) {
        setMaxColumnWidth(allCommandsMaxWidth);
      }
      return;
    }
    if (suggestionType === 'command') {
      // If we had command suggestions but the input no longer starts with '/'
      // we need to clear the suggestions. However, we should not return
      // because there may be relevant @ symbol and file suggestions.
      debouncedFetchFileSuggestions.cancel();
      clearSuggestions();
    } else if (isCommandInput(value) && hasCommandWithArguments(isAtEndWithWhitespace, value)) {
      // If we have a command with arguments (no trailing space), clear any stale hint
      // This prevents the hint from flashing when transitioning between states
      setSuggestionsState(prev => prev.commandArgumentHint ? {
        ...prev,
        commandArgumentHint: undefined
      } : prev);
    }
    if (suggestionType === 'custom-title') {
      // If we had custom-title suggestions but the input is no longer /resume
      // we need to clear the suggestions.
      clearSuggestions();
    }
    if (suggestionType === 'agent' && suggestionsRef.current.some((s: SuggestionItem) => s.id?.startsWith('dm-'))) {
      // If we had team member suggestions but the input no longer has @
      // we need to clear the suggestions.
      const hasAt = value.substring(0, effectiveCursorOffset).match(/(^|\s)@([\w-]*)$/);
      if (!hasAt) {
        clearSuggestions();
      }
    }

    // Check for @ symbol to trigger file and MCP resource suggestions
    // Skip @ autocomplete in bash mode - @ has no special meaning in shell commands
    if (hasAtSymbol && mode !== 'bash') {
      // Get the @ token (including the @ symbol)
      const completionToken = extractCompletionToken(value, effectiveCursorOffset, true);
      if (completionToken && completionToken.token.startsWith('@')) {
        const searchToken = extractSearchToken(completionToken);

        // If the token after @ is path-like, use path completion instead of fuzzy search
        // This handles cases like @~/path, @./path, @/path for directory traversal
        if (isPathLikeToken(searchToken)) {
          latestPathTokenRef.current = searchToken;
          const pathSuggestions = await getPathCompletions(searchToken, {
            maxResults: 10
          });
          // Discard stale results if a newer query was initiated while waiting
          if (latestPathTokenRef.current !== searchToken) {
            return;
          }
          if (pathSuggestions.length > 0) {
            setSuggestionsState(prev => ({
              suggestions: pathSuggestions,
              selectedSuggestion: getPreservedSelection(prev.suggestions, prev.selectedSuggestion, pathSuggestions),
              commandArgumentHint: undefined
            }));
            setSuggestionType('directory');
            return;
          }
        }

        // Skip if we already fetched for this exact token (prevents loop from
        // suggestions dependency causing updateSuggestions to be recreated)
        if (latestSearchTokenRef.current === searchToken) {
          return;
        }
        void debouncedFetchFileSuggestions(searchToken, true);
        return;
      }
    }

    // If we have active file suggestions or the input changed, check for file suggestions
    if (suggestionType === 'file') {
      const completionToken = extractCompletionToken(value, effectiveCursorOffset, true);
      if (completionToken) {
        const searchToken = extractSearchToken(completionToken);
        // Skip if we already fetched for this exact token
        if (latestSearchTokenRef.current === searchToken) {
          return;
        }
        void debouncedFetchFileSuggestions(searchToken, false);
      } else {
        // If we had file suggestions but now there's no completion token
        debouncedFetchFileSuggestions.cancel();
        clearSuggestions();
      }
    }

    // Clear shell suggestions if not in bash mode OR if input has changed
    if (suggestionType === 'shell') {
      const inputSnapshot = (suggestionsRef.current[0]?.metadata as {
        inputSnapshot?: string;
      })?.inputSnapshot;
      if (mode !== 'bash' || value !== inputSnapshot) {
        debouncedFetchFileSuggestions.cancel();
        clearSuggestions();
      }
    }
  }, [suggestionType, commands, setSuggestionsState, clearSuggestions, debouncedFetchFileSuggestions, debouncedFetchSlackChannels, mode, suppressSuggestions,
  // Note: using suggestionsRef instead of suggestions to avoid recreating
  // this callback when only selectedSuggestion changes (not the suggestions list)
  allCommandsMaxWidth]);

  // Update suggestions when input changes
  // Note: We intentionally don't depend on cursorOffset here - cursor movement alone
  // shouldn't re-trigger suggestions. The cursorOffsetRef is used to get the current
  // position when needed without causing re-renders.
  useEffect(() => {
    // If suggestions were dismissed for this exact input, don't re-trigger
    if (dismissedForInputRef.current === input) {
      return;
    }
    // When the actual input text changes (not just updateSuggestions being recreated),
    // reset the search token ref so the same query can be re-fetched.
    // This fixes: type @readme.md, clear, retype @readme.md → no suggestions.
    if (prevInputRef.current !== input) {
      prevInputRef.current = input;
      latestSearchTokenRef.current = null;
    }
    // Clear the dismissed state when input changes
    dismissedForInputRef.current = null;
    void updateSuggestions(input);
  }, [input, updateSuggestions]);

  // Handle tab key press - complete suggestions or trigger file suggestions
  const handleTab = useCallback(async () => {
    // If we have inline ghost text, apply it
    if (effectiveGhostText) {
      // Check for bash mode history completion first
      if (mode === 'bash') {
        // Replace the input with the full command from history
        onInputChange(effectiveGhostText.fullCommand);
        setCursorOffset(effectiveGhostText.fullCommand.length);
        setInlineGhostText(undefined);
        return;
      }

      // Find the mid-input command to get its position (for prompt mode)
      const midInputCommand = findMidInputSlashCommand(input, cursorOffset);
      if (midInputCommand) {
        // Replace the partial command with the full command + space
        const before = input.slice(0, midInputCommand.startPos);
        const after = input.slice(midInputCommand.startPos + midInputCommand.token.length);
        const newInput = before + '/' + effectiveGhostText.fullCommand + ' ' + after;
        const newCursorOffset = midInputCommand.startPos + 1 + effectiveGhostText.fullCommand.length + 1;
        onInputChange(newInput);
        setCursorOffset(newCursorOffset);
        return;
      }
    }

    // If we have active suggestions, select one
    if (suggestions.length > 0) {
      // Cancel any pending debounced fetches to prevent flicker when accepting
      debouncedFetchFileSuggestions.cancel();
      debouncedFetchSlackChannels.cancel();
      const index = selectedSuggestion === -1 ? 0 : selectedSuggestion;
      const suggestion = suggestions[index];
      if (suggestionType === 'command' && index < suggestions.length) {
        if (suggestion) {
          applyCommandSuggestion(suggestion, false,
          // don't execute on tab
          commands, onInputChange, setCursorOffset, onSubmit);
          clearSuggestions();
        }
      } else if (suggestionType === 'custom-title' && suggestions.length > 0) {
        // Apply custom title to /resume command with sessionId
        if (suggestion) {
          const newInput = buildResumeInputFromSuggestion(suggestion);
          onInputChange(newInput);
          setCursorOffset(newInput.length);
          clearSuggestions();
        }
      } else if (suggestionType === 'directory' && suggestions.length > 0) {
        const suggestion = suggestions[index];
        if (suggestion) {
          // Check if this is a command context (e.g., /add-dir) or general path completion
          const isInCommandContext = isCommandInput(input);
          let newInput: string;
          if (isInCommandContext) {
            // Command context: replace just the argument portion
            const spaceIndex = input.indexOf(' ');
            const commandPart = input.slice(0, spaceIndex + 1); // Include the space
            const cmdSuffix = isPathMetadata(suggestion.metadata) && suggestion.metadata.type === 'directory' ? '/' : ' ';
            newInput = commandPart + suggestion.id + cmdSuffix;
            onInputChange(newInput);
            setCursorOffset(newInput.length);
            if (isPathMetadata(suggestion.metadata) && suggestion.metadata.type === 'directory') {
              // For directories, fetch new suggestions for the updated path
              setSuggestionsState(prev => ({
                ...prev,
                commandArgumentHint: undefined
              }));
              void updateSuggestions(newInput, newInput.length);
            } else {
              clearSuggestions();
            }
          } else {
            // General path completion: replace the path token in input with @-prefixed path
            // Try to get token with @ prefix first to check if already prefixed
            const completionTokenWithAt = extractCompletionToken(input, cursorOffset, true);
            const completionToken = completionTokenWithAt ?? extractCompletionToken(input, cursorOffset, false);
            if (completionToken) {
              const isDir = isPathMetadata(suggestion.metadata) && suggestion.metadata.type === 'directory';
              const result = applyDirectorySuggestion(input, suggestion.id, completionToken.startPos, completionToken.token.length, isDir);
              newInput = result.newInput;
              onInputChange(newInput);
              setCursorOffset(result.cursorPos);
              if (isDir) {
                // For directories, fetch new suggestions for the updated path
                setSuggestionsState(prev => ({
                  ...prev,
                  commandArgumentHint: undefined
                }));
                void updateSuggestions(newInput, result.cursorPos);
              } else {
                // For files, clear suggestions
                clearSuggestions();
              }
            } else {
              // No completion token found (e.g., cursor after space) - just clear suggestions
              // without modifying input to avoid data loss
              clearSuggestions();
            }
          }
        }
      } else if (suggestionType === 'shell' && suggestions.length > 0) {
        const suggestion = suggestions[index];
        if (suggestion) {
          const metadata = suggestion.metadata as {
            completionType: ShellCompletionType;
          } | undefined;
          applyShellSuggestion(suggestion, input, cursorOffset, onInputChange, setCursorOffset, metadata?.completionType);
          clearSuggestions();
        }
      } else if (suggestionType === 'agent' && suggestions.length > 0 && suggestions[index]?.id?.startsWith('dm-')) {
        const suggestion = suggestions[index];
        if (suggestion) {
          applyTriggerSuggestion(suggestion, input, cursorOffset, DM_MEMBER_RE, onInputChange, setCursorOffset);
          clearSuggestions();
        }
      } else if (suggestionType === 'slack-channel' && suggestions.length > 0) {
        const suggestion = suggestions[index];
        if (suggestion) {
          applyTriggerSuggestion(suggestion, input, cursorOffset, HASH_CHANNEL_RE, onInputChange, setCursorOffset);
          clearSuggestions();
        }
      } else if (suggestionType === 'file' && suggestions.length > 0) {
        const completionToken = extractCompletionToken(input, cursorOffset, true);
        if (!completionToken) {
          clearSuggestions();
          return;
        }

        // Check if all suggestions share a common prefix longer than the current input
        const commonPrefix = findLongestCommonPrefix(suggestions);

        // Determine if token starts with @ to preserve it during replacement
        const hasAtPrefix = completionToken.token.startsWith('@');
        // The effective token length excludes the @ and quotes if present
        let effectiveTokenLength: number;
        if (completionToken.isQuoted) {
          // Remove @" prefix and optional closing " to get effective length
          effectiveTokenLength = completionToken.token.slice(2).replace(/"$/, '').length;
        } else if (hasAtPrefix) {
          effectiveTokenLength = completionToken.token.length - 1;
        } else {
          effectiveTokenLength = completionToken.token.length;
        }

        // If there's a common prefix longer than what the user has typed,
        // replace the current input with the common prefix
        if (commonPrefix.length > effectiveTokenLength) {
          const replacementValue = formatReplacementValue({
            displayText: commonPrefix,
            mode,
            hasAtPrefix,
            needsQuotes: false,
            // common prefix doesn't need quotes unless already quoted
            isQuoted: completionToken.isQuoted,
            isComplete: false // partial completion
          });
          applyFileSuggestion(replacementValue, input, completionToken.token, completionToken.startPos, onInputChange, setCursorOffset);
          // Don't clear suggestions so user can continue typing or select a specific option
          // Instead, update for the new prefix
          void updateSuggestions(input.replace(completionToken.token, replacementValue), cursorOffset);
        } else if (index < suggestions.length) {
          // Otherwise, apply the selected suggestion
          const suggestion = suggestions[index];
          if (suggestion) {
            const needsQuotes = suggestion.displayText.includes(' ');
            const replacementValue = formatReplacementValue({
              displayText: suggestion.displayText,
              mode,
              hasAtPrefix,
              needsQuotes,
              isQuoted: completionToken.isQuoted,
              isComplete: true // complete suggestion
            });
            applyFileSuggestion(replacementValue, input, completionToken.token, completionToken.startPos, onInputChange, setCursorOffset);
            clearSuggestions();
          }
        }
      }
    } else if (input.trim() !== '') {
      let suggestionType: SuggestionType;
      let suggestionItems: SuggestionItem[];
      if (mode === 'bash') {
        suggestionType = 'shell';
        // This should be very fast, taking <10ms
        const bashSuggestions = await generateBashSuggestions(input, cursorOffset);
        if (bashSuggestions.length === 1) {
          // If single suggestion, apply it immediately
          const suggestion = bashSuggestions[0];
          if (suggestion) {
            const metadata = suggestion.metadata as {
              completionType: ShellCompletionType;
            } | undefined;
            applyShellSuggestion(suggestion, input, cursorOffset, onInputChange, setCursorOffset, metadata?.completionType);
          }
          suggestionItems = [];
        } else {
          suggestionItems = bashSuggestions;
        }
      } else {
        suggestionType = 'file';
        // If no suggestions, fetch file and MCP resource suggestions
        const completionInfo = extractCompletionToken(input, cursorOffset, true);
        if (completionInfo) {
          // If token starts with @, search without the @ prefix
          const isAtSymbol = completionInfo.token.startsWith('@');
          const searchToken = isAtSymbol ? completionInfo.token.substring(1) : completionInfo.token;
          suggestionItems = await generateUnifiedSuggestions(searchToken, mcpResources, agents, isAtSymbol);
        } else {
          suggestionItems = [];
        }
      }
      if (suggestionItems.length > 0) {
        // Multiple suggestions or not bash mode: show list
        setSuggestionsState(prev => ({
          commandArgumentHint: undefined,
          suggestions: suggestionItems,
          selectedSuggestion: getPreservedSelection(prev.suggestions, prev.selectedSuggestion, suggestionItems)
        }));
        setSuggestionType(suggestionType);
        setMaxColumnWidth(undefined);
      }
    }
  }, [suggestions, selectedSuggestion, input, suggestionType, commands, mode, onInputChange, setCursorOffset, onSubmit, clearSuggestions, cursorOffset, updateSuggestions, mcpResources, setSuggestionsState, agents, debouncedFetchFileSuggestions, debouncedFetchSlackChannels, effectiveGhostText]);

  // Handle enter key press - apply and execute suggestions
  const handleEnter = useCallback(() => {
    if (selectedSuggestion < 0 || suggestions.length === 0) return;
    const suggestion = suggestions[selectedSuggestion];
    if (suggestionType === 'command' && selectedSuggestion < suggestions.length) {
      if (suggestion) {
        applyCommandSuggestion(suggestion, true,
        // execute on return
        commands, onInputChange, setCursorOffset, onSubmit);
        debouncedFetchFileSuggestions.cancel();
        clearSuggestions();
      }
    } else if (suggestionType === 'custom-title' && selectedSuggestion < suggestions.length) {
      // Apply custom title and execute /resume command with sessionId
      if (suggestion) {
        const newInput = buildResumeInputFromSuggestion(suggestion);
        onInputChange(newInput);
        setCursorOffset(newInput.length);
        onSubmit(newInput, /* isSubmittingSlashCommand */true);
        debouncedFetchFileSuggestions.cancel();
        clearSuggestions();
      }
    } else if (suggestionType === 'shell' && selectedSuggestion < suggestions.length) {
      const suggestion = suggestions[selectedSuggestion];
      if (suggestion) {
        const metadata = suggestion.metadata as {
          completionType: ShellCompletionType;
        } | undefined;
        applyShellSuggestion(suggestion, input, cursorOffset, onInputChange, setCursorOffset, metadata?.completionType);
        debouncedFetchFileSuggestions.cancel();
        clearSuggestions();
      }
    } else if (suggestionType === 'agent' && selectedSuggestion < suggestions.length && suggestion?.id?.startsWith('dm-')) {
      applyTriggerSuggestion(suggestion, input, cursorOffset, DM_MEMBER_RE, onInputChange, setCursorOffset);
      debouncedFetchFileSuggestions.cancel();
      clearSuggestions();
    } else if (suggestionType === 'slack-channel' && selectedSuggestion < suggestions.length) {
      if (suggestion) {
        applyTriggerSuggestion(suggestion, input, cursorOffset, HASH_CHANNEL_RE, onInputChange, setCursorOffset);
        debouncedFetchSlackChannels.cancel();
        clearSuggestions();
      }
    } else if (suggestionType === 'file' && selectedSuggestion < suggestions.length) {
      // Extract completion token directly when needed
      const completionInfo = extractCompletionToken(input, cursorOffset, true);
      if (completionInfo) {
        if (suggestion) {
          const hasAtPrefix = completionInfo.token.startsWith('@');
          const needsQuotes = suggestion.displayText.includes(' ');
          const replacementValue = formatReplacementValue({
            displayText: suggestion.displayText,
            mode,
            hasAtPrefix,
            needsQuotes,
            isQuoted: completionInfo.isQuoted,
            isComplete: true // complete suggestion
          });
          applyFileSuggestion(replacementValue, input, completionInfo.token, completionInfo.startPos, onInputChange, setCursorOffset);
          debouncedFetchFileSuggestions.cancel();
          clearSuggestions();
        }
      }
    } else if (suggestionType === 'directory' && selectedSuggestion < suggestions.length) {
      if (suggestion) {
        // In command context (e.g., /add-dir), Enter submits the command
        // rather than applying the directory suggestion. Just clear
        // suggestions and let the submit handler process the current input.
        if (isCommandInput(input)) {
          debouncedFetchFileSuggestions.cancel();
          clearSuggestions();
          return;
        }

        // General path completion: replace the path token
        const completionTokenWithAt = extractCompletionToken(input, cursorOffset, true);
        const completionToken = completionTokenWithAt ?? extractCompletionToken(input, cursorOffset, false);
        if (completionToken) {
          const isDir = isPathMetadata(suggestion.metadata) && suggestion.metadata.type === 'directory';
          const result = applyDirectorySuggestion(input, suggestion.id, completionToken.startPos, completionToken.token.length, isDir);
          onInputChange(result.newInput);
          setCursorOffset(result.cursorPos);
        }
        // If no completion token found (e.g., cursor after space), don't modify input
        // to avoid data loss - just clear suggestions

        debouncedFetchFileSuggestions.cancel();
        clearSuggestions();
      }
    }
  }, [suggestions, selectedSuggestion, suggestionType, commands, input, cursorOffset, mode, onInputChange, setCursorOffset, onSubmit, clearSuggestions, debouncedFetchFileSuggestions, debouncedFetchSlackChannels]);

  // Handler for autocomplete:accept - accepts current suggestion via Tab or Right Arrow
  const handleAutocompleteAccept = useCallback(() => {
    void handleTab();
  }, [handleTab]);

  // Handler for autocomplete:dismiss - clears suggestions and prevents re-triggering
  const handleAutocompleteDismiss = useCallback(() => {
    debouncedFetchFileSuggestions.cancel();
    debouncedFetchSlackChannels.cancel();
    clearSuggestions();
    // Remember the input when dismissed to prevent immediate re-triggering
    dismissedForInputRef.current = input;
  }, [debouncedFetchFileSuggestions, debouncedFetchSlackChannels, clearSuggestions, input]);

  // Handler for autocomplete:previous - selects previous suggestion
  const handleAutocompletePrevious = useCallback(() => {
    setSuggestionsState(prev => ({
      ...prev,
      selectedSuggestion: prev.selectedSuggestion <= 0 ? suggestions.length - 1 : prev.selectedSuggestion - 1
    }));
  }, [suggestions.length, setSuggestionsState]);

  // Handler for autocomplete:next - selects next suggestion
  const handleAutocompleteNext = useCallback(() => {
    setSuggestionsState(prev => ({
      ...prev,
      selectedSuggestion: prev.selectedSuggestion >= suggestions.length - 1 ? 0 : prev.selectedSuggestion + 1
    }));
  }, [suggestions.length, setSuggestionsState]);

  // Autocomplete context keybindings - only active when suggestions are visible
  const autocompleteHandlers = useMemo(() => ({
    'autocomplete:accept': handleAutocompleteAccept,
    'autocomplete:dismiss': handleAutocompleteDismiss,
    'autocomplete:previous': handleAutocompletePrevious,
    'autocomplete:next': handleAutocompleteNext
  }), [handleAutocompleteAccept, handleAutocompleteDismiss, handleAutocompletePrevious, handleAutocompleteNext]);

  // Register autocomplete as an overlay so CancelRequestHandler defers ESC handling
  // This ensures ESC dismisses autocomplete before canceling running tasks
  const isAutocompleteActive = suggestions.length > 0 || !!effectiveGhostText;
  const isModalOverlayActive = useIsModalOverlayActive();
  useRegisterOverlay('autocomplete', isAutocompleteActive);
  // Register Autocomplete context so it appears in activeContexts for other handlers.
  // This allows Chat's resolver to see Autocomplete and defer to its bindings for up/down.
  useRegisterKeybindingContext('Autocomplete', isAutocompleteActive);

  // Disable autocomplete keybindings when a modal overlay (e.g., DiffDialog) is active,
  // so escape reaches the overlay's handler instead of dismissing autocomplete
  useKeybindings(autocompleteHandlers, {
    context: 'Autocomplete',
    isActive: isAutocompleteActive && !isModalOverlayActive
  });
  function acceptSuggestionText(text: string): void {
    const detectedMode = getModeFromInput(text);
    if (detectedMode !== 'prompt' && onModeChange) {
      onModeChange(detectedMode);
      const stripped = getValueFromInput(text);
      onInputChange(stripped);
      setCursorOffset(stripped.length);
    } else {
      onInputChange(text);
      setCursorOffset(text.length);
    }
  }

  // Handle keyboard input for behaviors not covered by keybindings
  const handleKeyDown = (e: KeyboardEvent): void => {
    // Handle right arrow to accept prompt suggestion ghost text
    if (e.key === 'right' && !isViewingTeammate) {
      const suggestionText = promptSuggestion.text;
      const suggestionShownAt = promptSuggestion.shownAt;
      if (suggestionText && suggestionShownAt > 0 && input === '') {
        markAccepted();
        acceptSuggestionText(suggestionText);
        e.stopImmediatePropagation();
        return;
      }
    }

    // Handle Tab key fallback behaviors when no autocomplete suggestions
    // Don't handle tab if shift is pressed (used for mode cycle)
    if (e.key === 'tab' && !e.shift) {
      // Skip if autocomplete is handling this (suggestions or ghost text exist)
      if (suggestions.length > 0 || effectiveGhostText) {
        return;
      }
      // Accept prompt suggestion if it exists in AppState
      const suggestionText = promptSuggestion.text;
      const suggestionShownAt = promptSuggestion.shownAt;
      if (suggestionText && suggestionShownAt > 0 && input === '' && !isViewingTeammate) {
        e.preventDefault();
        markAccepted();
        acceptSuggestionText(suggestionText);
        return;
      }
      // Remind user about thinking toggle shortcut if empty input
      if (input.trim() === '') {
        e.preventDefault();
        addNotification({
          key: 'thinking-toggle-hint',
          jsx: <Text dimColor>
              Use {thinkingToggleShortcut} to toggle thinking
            </Text>,
          priority: 'immediate',
          timeoutMs: 3000
        });
      }
      return;
    }

    // Only continue with navigation if we have suggestions
    if (suggestions.length === 0) return;

    // Handle Ctrl-N/P for navigation (arrows handled by keybindings)
    // Skip if we're in the middle of a chord sequence to allow chords like ctrl+f n
    const hasPendingChord = keybindingContext?.pendingChord != null;
    if (e.ctrl && e.key === 'n' && !hasPendingChord) {
      e.preventDefault();
      handleAutocompleteNext();
      return;
    }
    if (e.ctrl && e.key === 'p' && !hasPendingChord) {
      e.preventDefault();
      handleAutocompletePrevious();
      return;
    }

    // Handle selection and execution via return/enter
    // Shift+Enter and Meta+Enter insert newlines (handled by useTextInput),
    // so don't accept the suggestion for those.
    if (e.key === 'return' && !e.shift && !e.meta) {
      e.preventDefault();
      handleEnter();
    }
  };

  // Backward-compat bridge: PromptInput doesn't yet wire handleKeyDown to
  // <Box onKeyDown>. Subscribe via useInput and adapt InputEvent →
  // KeyboardEvent until the consumer is migrated (separate PR).
  // TODO(onKeyDown-migration): remove once PromptInput passes handleKeyDown.
  useInput((_input, _key, event) => {
    const kbEvent = new KeyboardEvent(event.keypress);
    handleKeyDown(kbEvent);
    if (kbEvent.didStopImmediatePropagation()) {
      event.stopImmediatePropagation();
    }
  });
  return {
    suggestions,
    selectedSuggestion,
    suggestionType,
    maxColumnWidth,
    commandArgumentHint,
    inlineGhostText: effectiveGhostText,
    handleKeyDown
  };
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsInVzZUNhbGxiYWNrIiwidXNlRWZmZWN0IiwidXNlTWVtbyIsInVzZVJlZiIsInVzZVN0YXRlIiwidXNlTm90aWZpY2F0aW9ucyIsIlRleHQiLCJsb2dFdmVudCIsInVzZURlYm91bmNlQ2FsbGJhY2siLCJDb21tYW5kIiwiZ2V0Q29tbWFuZE5hbWUiLCJnZXRNb2RlRnJvbUlucHV0IiwiZ2V0VmFsdWVGcm9tSW5wdXQiLCJTdWdnZXN0aW9uSXRlbSIsIlN1Z2dlc3Rpb25UeXBlIiwidXNlSXNNb2RhbE92ZXJsYXlBY3RpdmUiLCJ1c2VSZWdpc3Rlck92ZXJsYXkiLCJLZXlib2FyZEV2ZW50IiwidXNlSW5wdXQiLCJ1c2VPcHRpb25hbEtleWJpbmRpbmdDb250ZXh0IiwidXNlUmVnaXN0ZXJLZXliaW5kaW5nQ29udGV4dCIsInVzZUtleWJpbmRpbmdzIiwidXNlU2hvcnRjdXREaXNwbGF5IiwidXNlQXBwU3RhdGUiLCJ1c2VBcHBTdGF0ZVN0b3JlIiwiQWdlbnREZWZpbml0aW9uIiwiSW5saW5lR2hvc3RUZXh0IiwiUHJvbXB0SW5wdXRNb2RlIiwiaXNBZ2VudFN3YXJtc0VuYWJsZWQiLCJnZW5lcmF0ZVByb2dyZXNzaXZlQXJndW1lbnRIaW50IiwicGFyc2VBcmd1bWVudHMiLCJnZXRTaGVsbENvbXBsZXRpb25zIiwiU2hlbGxDb21wbGV0aW9uVHlwZSIsImZvcm1hdExvZ01ldGFkYXRhIiwiZ2V0U2Vzc2lvbklkRnJvbUxvZyIsInNlYXJjaFNlc3Npb25zQnlDdXN0b21UaXRsZSIsImFwcGx5Q29tbWFuZFN1Z2dlc3Rpb24iLCJmaW5kTWlkSW5wdXRTbGFzaENvbW1hbmQiLCJnZW5lcmF0ZUNvbW1hbmRTdWdnZXN0aW9ucyIsImdldEJlc3RDb21tYW5kTWF0Y2giLCJpc0NvbW1hbmRJbnB1dCIsImdldERpcmVjdG9yeUNvbXBsZXRpb25zIiwiZ2V0UGF0aENvbXBsZXRpb25zIiwiaXNQYXRoTGlrZVRva2VuIiwiZ2V0U2hlbGxIaXN0b3J5Q29tcGxldGlvbiIsImdldFNsYWNrQ2hhbm5lbFN1Z2dlc3Rpb25zIiwiaGFzU2xhY2tNY3BTZXJ2ZXIiLCJURUFNX0xFQURfTkFNRSIsImFwcGx5RmlsZVN1Z2dlc3Rpb24iLCJmaW5kTG9uZ2VzdENvbW1vblByZWZpeCIsIm9uSW5kZXhCdWlsZENvbXBsZXRlIiwic3RhcnRCYWNrZ3JvdW5kQ2FjaGVSZWZyZXNoIiwiZ2VuZXJhdGVVbmlmaWVkU3VnZ2VzdGlvbnMiLCJBVF9UT0tFTl9IRUFEX1JFIiwiUEFUSF9DSEFSX0hFQURfUkUiLCJUT0tFTl9XSVRIX0FUX1JFIiwiVE9LRU5fV0lUSE9VVF9BVF9SRSIsIkhBU19BVF9TWU1CT0xfUkUiLCJIQVNIX0NIQU5ORUxfUkUiLCJpc1BhdGhNZXRhZGF0YSIsIm1ldGFkYXRhIiwidHlwZSIsImdldFByZXNlcnZlZFNlbGVjdGlvbiIsInByZXZTdWdnZXN0aW9ucyIsInByZXZTZWxlY3Rpb24iLCJuZXdTdWdnZXN0aW9ucyIsImxlbmd0aCIsInByZXZTZWxlY3RlZEl0ZW0iLCJuZXdJbmRleCIsImZpbmRJbmRleCIsIml0ZW0iLCJpZCIsImJ1aWxkUmVzdW1lSW5wdXRGcm9tU3VnZ2VzdGlvbiIsInN1Z2dlc3Rpb24iLCJzZXNzaW9uSWQiLCJkaXNwbGF5VGV4dCIsIlByb3BzIiwib25JbnB1dENoYW5nZSIsInZhbHVlIiwib25TdWJtaXQiLCJpc1N1Ym1pdHRpbmdTbGFzaENvbW1hbmQiLCJzZXRDdXJzb3JPZmZzZXQiLCJvZmZzZXQiLCJpbnB1dCIsImN1cnNvck9mZnNldCIsImNvbW1hbmRzIiwibW9kZSIsImFnZW50cyIsInNldFN1Z2dlc3Rpb25zU3RhdGUiLCJmIiwicHJldmlvdXNTdWdnZXN0aW9uc1N0YXRlIiwic3VnZ2VzdGlvbnMiLCJzZWxlY3RlZFN1Z2dlc3Rpb24iLCJjb21tYW5kQXJndW1lbnRIaW50Iiwic3VnZ2VzdGlvbnNTdGF0ZSIsInN1cHByZXNzU3VnZ2VzdGlvbnMiLCJtYXJrQWNjZXB0ZWQiLCJvbk1vZGVDaGFuZ2UiLCJVc2VUeXBlYWhlYWRSZXN1bHQiLCJzdWdnZXN0aW9uVHlwZSIsIm1heENvbHVtbldpZHRoIiwiaW5saW5lR2hvc3RUZXh0IiwiaGFuZGxlS2V5RG93biIsImUiLCJleHRyYWN0U2VhcmNoVG9rZW4iLCJjb21wbGV0aW9uVG9rZW4iLCJ0b2tlbiIsImlzUXVvdGVkIiwic2xpY2UiLCJyZXBsYWNlIiwic3RhcnRzV2l0aCIsInN1YnN0cmluZyIsImZvcm1hdFJlcGxhY2VtZW50VmFsdWUiLCJvcHRpb25zIiwiaGFzQXRQcmVmaXgiLCJuZWVkc1F1b3RlcyIsImlzQ29tcGxldGUiLCJzcGFjZSIsImFwcGx5U2hlbGxTdWdnZXN0aW9uIiwiY29tcGxldGlvblR5cGUiLCJiZWZvcmVDdXJzb3IiLCJsYXN0U3BhY2VJbmRleCIsImxhc3RJbmRleE9mIiwid29yZFN0YXJ0IiwicmVwbGFjZW1lbnRUZXh0IiwibmV3SW5wdXQiLCJETV9NRU1CRVJfUkUiLCJhcHBseVRyaWdnZXJTdWdnZXN0aW9uIiwidHJpZ2dlclJlIiwiUmVnRXhwIiwibSIsIm1hdGNoIiwiaW5kZXgiLCJ1bmRlZmluZWQiLCJwcmVmaXhTdGFydCIsImJlZm9yZSIsImN1cnJlbnRTaGVsbENvbXBsZXRpb25BYm9ydENvbnRyb2xsZXIiLCJBYm9ydENvbnRyb2xsZXIiLCJnZW5lcmF0ZUJhc2hTdWdnZXN0aW9ucyIsIlByb21pc2UiLCJhYm9ydCIsInNpZ25hbCIsImFwcGx5RGlyZWN0b3J5U3VnZ2VzdGlvbiIsInN1Z2dlc3Rpb25JZCIsInRva2VuU3RhcnRQb3MiLCJ0b2tlbkxlbmd0aCIsImlzRGlyZWN0b3J5IiwiY3Vyc29yUG9zIiwic3VmZml4IiwiYWZ0ZXIiLCJyZXBsYWNlbWVudCIsImV4dHJhY3RDb21wbGV0aW9uVG9rZW4iLCJ0ZXh0IiwiaW5jbHVkZUF0U3ltYm9sIiwic3RhcnRQb3MiLCJ0ZXh0QmVmb3JlQ3Vyc29yIiwicXVvdGVkQXRSZWdleCIsInF1b3RlZE1hdGNoIiwidGV4dEFmdGVyQ3Vyc29yIiwiYWZ0ZXJRdW90ZWRNYXRjaCIsInF1b3RlZFN1ZmZpeCIsImF0SWR4IiwidGVzdCIsImZyb21BdCIsImF0SGVhZE1hdGNoIiwiYWZ0ZXJNYXRjaCIsInRva2VuU3VmZml4IiwidG9rZW5SZWdleCIsImV4dHJhY3RDb21tYW5kTmFtZUFuZEFyZ3MiLCJjb21tYW5kTmFtZSIsImFyZ3MiLCJzcGFjZUluZGV4IiwiaW5kZXhPZiIsImhhc0NvbW1hbmRXaXRoQXJndW1lbnRzIiwiaXNBdEVuZFdpdGhXaGl0ZXNwYWNlIiwiaW5jbHVkZXMiLCJlbmRzV2l0aCIsInVzZVR5cGVhaGVhZCIsImFkZE5vdGlmaWNhdGlvbiIsInRoaW5raW5nVG9nZ2xlU2hvcnRjdXQiLCJzZXRTdWdnZXN0aW9uVHlwZSIsImFsbENvbW1hbmRzTWF4V2lkdGgiLCJ2aXNpYmxlQ29tbWFuZHMiLCJmaWx0ZXIiLCJjbWQiLCJpc0hpZGRlbiIsIm1heExlbiIsIk1hdGgiLCJtYXgiLCJtYXAiLCJzZXRNYXhDb2x1bW5XaWR0aCIsIm1jcFJlc291cmNlcyIsInMiLCJtY3AiLCJyZXNvdXJjZXMiLCJzdG9yZSIsInByb21wdFN1Z2dlc3Rpb24iLCJpc1ZpZXdpbmdUZWFtbWF0ZSIsInZpZXdpbmdBZ2VudFRhc2tJZCIsImtleWJpbmRpbmdDb250ZXh0Iiwic2V0SW5saW5lR2hvc3RUZXh0Iiwic3luY1Byb21wdEdob3N0VGV4dCIsIm1pZElucHV0Q29tbWFuZCIsInBhcnRpYWxDb21tYW5kIiwiZnVsbENvbW1hbmQiLCJpbnNlcnRQb3NpdGlvbiIsImVmZmVjdGl2ZUdob3N0VGV4dCIsImN1cnNvck9mZnNldFJlZiIsImN1cnJlbnQiLCJsYXRlc3RTZWFyY2hUb2tlblJlZiIsInByZXZJbnB1dFJlZiIsImxhdGVzdFBhdGhUb2tlblJlZiIsImxhdGVzdEJhc2hJbnB1dFJlZiIsImxhdGVzdFNsYWNrVG9rZW5SZWYiLCJzdWdnZXN0aW9uc1JlZiIsImRpc21pc3NlZEZvcklucHV0UmVmIiwiY2xlYXJTdWdnZXN0aW9ucyIsImZldGNoRmlsZVN1Z2dlc3Rpb25zIiwic2VhcmNoVG9rZW4iLCJpc0F0U3ltYm9sIiwiY29tYmluZWRJdGVtcyIsInByZXYiLCJkZWJvdW5jZWRGZXRjaEZpbGVTdWdnZXN0aW9ucyIsImZldGNoU2xhY2tDaGFubmVscyIsInBhcnRpYWwiLCJjaGFubmVscyIsImdldFN0YXRlIiwiY2xpZW50cyIsImRlYm91bmNlZEZldGNoU2xhY2tDaGFubmVscyIsInVwZGF0ZVN1Z2dlc3Rpb25zIiwiaW5wdXRDdXJzb3JPZmZzZXQiLCJlZmZlY3RpdmVDdXJzb3JPZmZzZXQiLCJjYW5jZWwiLCJ0cmltIiwiaGlzdG9yeU1hdGNoIiwiYXRNYXRjaCIsInBhcnRpYWxOYW1lIiwidG9Mb3dlckNhc2UiLCJzdGF0ZSIsIm1lbWJlcnMiLCJzZWVuIiwiU2V0IiwidGVhbUNvbnRleHQiLCJ0IiwiT2JqZWN0IiwidmFsdWVzIiwidGVhbW1hdGVzIiwibmFtZSIsImFkZCIsInB1c2giLCJkZXNjcmlwdGlvbiIsImFnZW50SWQiLCJhZ2VudE5hbWVSZWdpc3RyeSIsImhhcyIsInN0YXR1cyIsInRhc2tzIiwiaGFzaE1hdGNoIiwiaGFzQXRTeW1ib2wiLCJwYXJzZWRDb21tYW5kIiwiZGlyU3VnZ2VzdGlvbnMiLCJtYXRjaGVzIiwibGltaXQiLCJsb2ciLCJjdXN0b21UaXRsZSIsImhhc1JlYWxBcmd1bWVudHMiLCJoYXNFeGFjdGx5T25lVHJhaWxpbmdTcGFjZSIsImV4YWN0TWF0Y2giLCJmaW5kIiwiYXJndW1lbnRIaW50IiwiYXJnTmFtZXMiLCJhcmdzVGV4dCIsInR5cGVkQXJncyIsImNvbW1hbmRJdGVtcyIsInNvbWUiLCJoYXNBdCIsInBhdGhTdWdnZXN0aW9ucyIsIm1heFJlc3VsdHMiLCJpbnB1dFNuYXBzaG90IiwiaGFuZGxlVGFiIiwibmV3Q3Vyc29yT2Zmc2V0IiwiaXNJbkNvbW1hbmRDb250ZXh0IiwiY29tbWFuZFBhcnQiLCJjbWRTdWZmaXgiLCJjb21wbGV0aW9uVG9rZW5XaXRoQXQiLCJpc0RpciIsInJlc3VsdCIsImNvbW1vblByZWZpeCIsImVmZmVjdGl2ZVRva2VuTGVuZ3RoIiwicmVwbGFjZW1lbnRWYWx1ZSIsInN1Z2dlc3Rpb25JdGVtcyIsImJhc2hTdWdnZXN0aW9ucyIsImNvbXBsZXRpb25JbmZvIiwiaGFuZGxlRW50ZXIiLCJoYW5kbGVBdXRvY29tcGxldGVBY2NlcHQiLCJoYW5kbGVBdXRvY29tcGxldGVEaXNtaXNzIiwiaGFuZGxlQXV0b2NvbXBsZXRlUHJldmlvdXMiLCJoYW5kbGVBdXRvY29tcGxldGVOZXh0IiwiYXV0b2NvbXBsZXRlSGFuZGxlcnMiLCJpc0F1dG9jb21wbGV0ZUFjdGl2ZSIsImlzTW9kYWxPdmVybGF5QWN0aXZlIiwiY29udGV4dCIsImlzQWN0aXZlIiwiYWNjZXB0U3VnZ2VzdGlvblRleHQiLCJkZXRlY3RlZE1vZGUiLCJzdHJpcHBlZCIsImtleSIsInN1Z2dlc3Rpb25UZXh0Iiwic3VnZ2VzdGlvblNob3duQXQiLCJzaG93bkF0Iiwic3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIiwic2hpZnQiLCJwcmV2ZW50RGVmYXVsdCIsImpzeCIsInByaW9yaXR5IiwidGltZW91dE1zIiwiaGFzUGVuZGluZ0Nob3JkIiwicGVuZGluZ0Nob3JkIiwiY3RybCIsIm1ldGEiLCJfaW5wdXQiLCJfa2V5IiwiZXZlbnQiLCJrYkV2ZW50Iiwia2V5cHJlc3MiLCJkaWRTdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24iXSwic291cmNlcyI6WyJ1c2VUeXBlYWhlYWQudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlTWVtbywgdXNlUmVmLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlTm90aWZpY2F0aW9ucyB9IGZyb20gJ3NyYy9jb250ZXh0L25vdGlmaWNhdGlvbnMuanMnXG5pbXBvcnQgeyBUZXh0IH0gZnJvbSAnc3JjL2luay5qcydcbmltcG9ydCB7IGxvZ0V2ZW50IH0gZnJvbSAnc3JjL3NlcnZpY2VzL2FuYWx5dGljcy9pbmRleC5qcydcbmltcG9ydCB7IHVzZURlYm91bmNlQ2FsbGJhY2sgfSBmcm9tICd1c2Vob29rcy10cydcbmltcG9ydCB7IHR5cGUgQ29tbWFuZCwgZ2V0Q29tbWFuZE5hbWUgfSBmcm9tICcuLi9jb21tYW5kcy5qcydcbmltcG9ydCB7XG4gIGdldE1vZGVGcm9tSW5wdXQsXG4gIGdldFZhbHVlRnJvbUlucHV0LFxufSBmcm9tICcuLi9jb21wb25lbnRzL1Byb21wdElucHV0L2lucHV0TW9kZXMuanMnXG5pbXBvcnQgdHlwZSB7XG4gIFN1Z2dlc3Rpb25JdGVtLFxuICBTdWdnZXN0aW9uVHlwZSxcbn0gZnJvbSAnLi4vY29tcG9uZW50cy9Qcm9tcHRJbnB1dC9Qcm9tcHRJbnB1dEZvb3RlclN1Z2dlc3Rpb25zLmpzJ1xuaW1wb3J0IHtcbiAgdXNlSXNNb2RhbE92ZXJsYXlBY3RpdmUsXG4gIHVzZVJlZ2lzdGVyT3ZlcmxheSxcbn0gZnJvbSAnLi4vY29udGV4dC9vdmVybGF5Q29udGV4dC5qcydcbmltcG9ydCB7IEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi9pbmsvZXZlbnRzL2tleWJvYXJkLWV2ZW50LmpzJ1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9wcmVmZXItdXNlLWtleWJpbmRpbmdzIC0tIGJhY2t3YXJkLWNvbXBhdCBicmlkZ2UgdW50aWwgY29uc3VtZXJzIHdpcmUgaGFuZGxlS2V5RG93biB0byA8Qm94IG9uS2V5RG93bj5cbmltcG9ydCB7IHVzZUlucHV0IH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHtcbiAgdXNlT3B0aW9uYWxLZXliaW5kaW5nQ29udGV4dCxcbiAgdXNlUmVnaXN0ZXJLZXliaW5kaW5nQ29udGV4dCxcbn0gZnJvbSAnLi4va2V5YmluZGluZ3MvS2V5YmluZGluZ0NvbnRleHQuanMnXG5pbXBvcnQgeyB1c2VLZXliaW5kaW5ncyB9IGZyb20gJy4uL2tleWJpbmRpbmdzL3VzZUtleWJpbmRpbmcuanMnXG5pbXBvcnQgeyB1c2VTaG9ydGN1dERpc3BsYXkgfSBmcm9tICcuLi9rZXliaW5kaW5ncy91c2VTaG9ydGN1dERpc3BsYXkuanMnXG5pbXBvcnQgeyB1c2VBcHBTdGF0ZSwgdXNlQXBwU3RhdGVTdG9yZSB9IGZyb20gJy4uL3N0YXRlL0FwcFN0YXRlLmpzJ1xuaW1wb3J0IHR5cGUgeyBBZ2VudERlZmluaXRpb24gfSBmcm9tICcuLi90b29scy9BZ2VudFRvb2wvbG9hZEFnZW50c0Rpci5qcydcbmltcG9ydCB0eXBlIHtcbiAgSW5saW5lR2hvc3RUZXh0LFxuICBQcm9tcHRJbnB1dE1vZGUsXG59IGZyb20gJy4uL3R5cGVzL3RleHRJbnB1dFR5cGVzLmpzJ1xuaW1wb3J0IHsgaXNBZ2VudFN3YXJtc0VuYWJsZWQgfSBmcm9tICcuLi91dGlscy9hZ2VudFN3YXJtc0VuYWJsZWQuanMnXG5pbXBvcnQge1xuICBnZW5lcmF0ZVByb2dyZXNzaXZlQXJndW1lbnRIaW50LFxuICBwYXJzZUFyZ3VtZW50cyxcbn0gZnJvbSAnLi4vdXRpbHMvYXJndW1lbnRTdWJzdGl0dXRpb24uanMnXG5pbXBvcnQge1xuICBnZXRTaGVsbENvbXBsZXRpb25zLFxuICB0eXBlIFNoZWxsQ29tcGxldGlvblR5cGUsXG59IGZyb20gJy4uL3V0aWxzL2Jhc2gvc2hlbGxDb21wbGV0aW9uLmpzJ1xuaW1wb3J0IHsgZm9ybWF0TG9nTWV0YWRhdGEgfSBmcm9tICcuLi91dGlscy9mb3JtYXQuanMnXG5pbXBvcnQge1xuICBnZXRTZXNzaW9uSWRGcm9tTG9nLFxuICBzZWFyY2hTZXNzaW9uc0J5Q3VzdG9tVGl0bGUsXG59IGZyb20gJy4uL3V0aWxzL3Nlc3Npb25TdG9yYWdlLmpzJ1xuaW1wb3J0IHtcbiAgYXBwbHlDb21tYW5kU3VnZ2VzdGlvbixcbiAgZmluZE1pZElucHV0U2xhc2hDb21tYW5kLFxuICBnZW5lcmF0ZUNvbW1hbmRTdWdnZXN0aW9ucyxcbiAgZ2V0QmVzdENvbW1hbmRNYXRjaCxcbiAgaXNDb21tYW5kSW5wdXQsXG59IGZyb20gJy4uL3V0aWxzL3N1Z2dlc3Rpb25zL2NvbW1hbmRTdWdnZXN0aW9ucy5qcydcbmltcG9ydCB7XG4gIGdldERpcmVjdG9yeUNvbXBsZXRpb25zLFxuICBnZXRQYXRoQ29tcGxldGlvbnMsXG4gIGlzUGF0aExpa2VUb2tlbixcbn0gZnJvbSAnLi4vdXRpbHMvc3VnZ2VzdGlvbnMvZGlyZWN0b3J5Q29tcGxldGlvbi5qcydcbmltcG9ydCB7IGdldFNoZWxsSGlzdG9yeUNvbXBsZXRpb24gfSBmcm9tICcuLi91dGlscy9zdWdnZXN0aW9ucy9zaGVsbEhpc3RvcnlDb21wbGV0aW9uLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0U2xhY2tDaGFubmVsU3VnZ2VzdGlvbnMsXG4gIGhhc1NsYWNrTWNwU2VydmVyLFxufSBmcm9tICcuLi91dGlscy9zdWdnZXN0aW9ucy9zbGFja0NoYW5uZWxTdWdnZXN0aW9ucy5qcydcbmltcG9ydCB7IFRFQU1fTEVBRF9OQU1FIH0gZnJvbSAnLi4vdXRpbHMvc3dhcm0vY29uc3RhbnRzLmpzJ1xuaW1wb3J0IHtcbiAgYXBwbHlGaWxlU3VnZ2VzdGlvbixcbiAgZmluZExvbmdlc3RDb21tb25QcmVmaXgsXG4gIG9uSW5kZXhCdWlsZENvbXBsZXRlLFxuICBzdGFydEJhY2tncm91bmRDYWNoZVJlZnJlc2gsXG59IGZyb20gJy4vZmlsZVN1Z2dlc3Rpb25zLmpzJ1xuaW1wb3J0IHsgZ2VuZXJhdGVVbmlmaWVkU3VnZ2VzdGlvbnMgfSBmcm9tICcuL3VuaWZpZWRTdWdnZXN0aW9ucy5qcydcblxuLy8gVW5pY29kZS1hd2FyZSBjaGFyYWN0ZXIgY2xhc3MgZm9yIGZpbGUgcGF0aCB0b2tlbnM6XG4vLyBcXHB7TH0gPSBsZXR0ZXJzIChDSkssIExhdGluLCBDeXJpbGxpYywgZXRjLilcbi8vIFxccHtOfSA9IG51bWJlcnMgKGluY2wuIGZ1bGx3aWR0aClcbi8vIFxccHtNfSA9IGNvbWJpbmluZyBtYXJrcyAobWFjT1MgTkZEIGFjY2VudHMsIERldmFuYWdhcmkgdm93ZWwgc2lnbnMpXG5jb25zdCBBVF9UT0tFTl9IRUFEX1JFID0gL15AW1xccHtMfVxccHtOfVxccHtNfV9cXC0uL1xcXFwoKVtcXF1+Ol0qL3VcbmNvbnN0IFBBVEhfQ0hBUl9IRUFEX1JFID0gL15bXFxwe0x9XFxwe059XFxwe019X1xcLS4vXFxcXCgpW1xcXX46XSsvdVxuY29uc3QgVE9LRU5fV0lUSF9BVF9SRSA9XG4gIC8oQFtcXHB7TH1cXHB7Tn1cXHB7TX1fXFwtLi9cXFxcKClbXFxdfjpdKnxbXFxwe0x9XFxwe059XFxwe019X1xcLS4vXFxcXCgpW1xcXX46XSspJC91XG5jb25zdCBUT0tFTl9XSVRIT1VUX0FUX1JFID0gL1tcXHB7TH1cXHB7Tn1cXHB7TX1fXFwtLi9cXFxcKClbXFxdfjpdKyQvdVxuY29uc3QgSEFTX0FUX1NZTUJPTF9SRSA9IC8oXnxcXHMpQChbXFxwe0x9XFxwe059XFxwe019X1xcLS4vXFxcXCgpW1xcXX46XSp8XCJbXlwiXSpcIj8pJC91XG5jb25zdCBIQVNIX0NIQU5ORUxfUkUgPSAvKF58XFxzKSMoW2EtejAtOV1bYS16MC05Xy1dKikkL1xuXG4vLyBUeXBlIGd1YXJkIGZvciBwYXRoIGNvbXBsZXRpb24gbWV0YWRhdGFcbmZ1bmN0aW9uIGlzUGF0aE1ldGFkYXRhKFxuICBtZXRhZGF0YTogdW5rbm93bixcbik6IG1ldGFkYXRhIGlzIHsgdHlwZTogJ2RpcmVjdG9yeScgfCAnZmlsZScgfSB7XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIG1ldGFkYXRhID09PSAnb2JqZWN0JyAmJlxuICAgIG1ldGFkYXRhICE9PSBudWxsICYmXG4gICAgJ3R5cGUnIGluIG1ldGFkYXRhICYmXG4gICAgKG1ldGFkYXRhLnR5cGUgPT09ICdkaXJlY3RvcnknIHx8IG1ldGFkYXRhLnR5cGUgPT09ICdmaWxlJylcbiAgKVxufVxuXG4vLyBIZWxwZXIgdG8gZGV0ZXJtaW5lIHNlbGVjdGVkU3VnZ2VzdGlvbiB3aGVuIHVwZGF0aW5nIHN1Z2dlc3Rpb25zXG5mdW5jdGlvbiBnZXRQcmVzZXJ2ZWRTZWxlY3Rpb24oXG4gIHByZXZTdWdnZXN0aW9uczogU3VnZ2VzdGlvbkl0ZW1bXSxcbiAgcHJldlNlbGVjdGlvbjogbnVtYmVyLFxuICBuZXdTdWdnZXN0aW9uczogU3VnZ2VzdGlvbkl0ZW1bXSxcbik6IG51bWJlciB7XG4gIC8vIE5vIG5ldyBzdWdnZXN0aW9uc1xuICBpZiAobmV3U3VnZ2VzdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIC0xXG4gIH1cblxuICAvLyBObyBwcmV2aW91cyBzZWxlY3Rpb25cbiAgaWYgKHByZXZTZWxlY3Rpb24gPCAwKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuXG4gIC8vIEdldCB0aGUgcHJldmlvdXNseSBzZWxlY3RlZCBpdGVtXG4gIGNvbnN0IHByZXZTZWxlY3RlZEl0ZW0gPSBwcmV2U3VnZ2VzdGlvbnNbcHJldlNlbGVjdGlvbl1cbiAgaWYgKCFwcmV2U2VsZWN0ZWRJdGVtKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuXG4gIC8vIFRyeSB0byBmaW5kIHRoZSBzYW1lIGl0ZW0gaW4gdGhlIG5ldyBsaXN0IGJ5IElEXG4gIGNvbnN0IG5ld0luZGV4ID0gbmV3U3VnZ2VzdGlvbnMuZmluZEluZGV4KFxuICAgIGl0ZW0gPT4gaXRlbS5pZCA9PT0gcHJldlNlbGVjdGVkSXRlbS5pZCxcbiAgKVxuXG4gIC8vIFJldHVybiB0aGUgbmV3IGluZGV4IGlmIGZvdW5kLCBvdGhlcndpc2UgZGVmYXVsdCB0byAwXG4gIHJldHVybiBuZXdJbmRleCA+PSAwID8gbmV3SW5kZXggOiAwXG59XG5cbmZ1bmN0aW9uIGJ1aWxkUmVzdW1lSW5wdXRGcm9tU3VnZ2VzdGlvbihzdWdnZXN0aW9uOiBTdWdnZXN0aW9uSXRlbSk6IHN0cmluZyB7XG4gIGNvbnN0IG1ldGFkYXRhID0gc3VnZ2VzdGlvbi5tZXRhZGF0YSBhcyB7IHNlc3Npb25JZDogc3RyaW5nIH0gfCB1bmRlZmluZWRcbiAgcmV0dXJuIG1ldGFkYXRhPy5zZXNzaW9uSWRcbiAgICA/IGAvcmVzdW1lICR7bWV0YWRhdGEuc2Vzc2lvbklkfWBcbiAgICA6IGAvcmVzdW1lICR7c3VnZ2VzdGlvbi5kaXNwbGF5VGV4dH1gXG59XG5cbnR5cGUgUHJvcHMgPSB7XG4gIG9uSW5wdXRDaGFuZ2U6ICh2YWx1ZTogc3RyaW5nKSA9PiB2b2lkXG4gIG9uU3VibWl0OiAodmFsdWU6IHN0cmluZywgaXNTdWJtaXR0aW5nU2xhc2hDb21tYW5kPzogYm9vbGVhbikgPT4gdm9pZFxuICBzZXRDdXJzb3JPZmZzZXQ6IChvZmZzZXQ6IG51bWJlcikgPT4gdm9pZFxuICBpbnB1dDogc3RyaW5nXG4gIGN1cnNvck9mZnNldDogbnVtYmVyXG4gIGNvbW1hbmRzOiBDb21tYW5kW11cbiAgbW9kZTogc3RyaW5nXG4gIGFnZW50czogQWdlbnREZWZpbml0aW9uW11cbiAgc2V0U3VnZ2VzdGlvbnNTdGF0ZTogKFxuICAgIGY6IChwcmV2aW91c1N1Z2dlc3Rpb25zU3RhdGU6IHtcbiAgICAgIHN1Z2dlc3Rpb25zOiBTdWdnZXN0aW9uSXRlbVtdXG4gICAgICBzZWxlY3RlZFN1Z2dlc3Rpb246IG51bWJlclxuICAgICAgY29tbWFuZEFyZ3VtZW50SGludD86IHN0cmluZ1xuICAgIH0pID0+IHtcbiAgICAgIHN1Z2dlc3Rpb25zOiBTdWdnZXN0aW9uSXRlbVtdXG4gICAgICBzZWxlY3RlZFN1Z2dlc3Rpb246IG51bWJlclxuICAgICAgY29tbWFuZEFyZ3VtZW50SGludD86IHN0cmluZ1xuICAgIH0sXG4gICkgPT4gdm9pZFxuICBzdWdnZXN0aW9uc1N0YXRlOiB7XG4gICAgc3VnZ2VzdGlvbnM6IFN1Z2dlc3Rpb25JdGVtW11cbiAgICBzZWxlY3RlZFN1Z2dlc3Rpb246IG51bWJlclxuICAgIGNvbW1hbmRBcmd1bWVudEhpbnQ/OiBzdHJpbmdcbiAgfVxuICBzdXBwcmVzc1N1Z2dlc3Rpb25zPzogYm9vbGVhblxuICBtYXJrQWNjZXB0ZWQ6ICgpID0+IHZvaWRcbiAgb25Nb2RlQ2hhbmdlPzogKG1vZGU6IFByb21wdElucHV0TW9kZSkgPT4gdm9pZFxufVxuXG50eXBlIFVzZVR5cGVhaGVhZFJlc3VsdCA9IHtcbiAgc3VnZ2VzdGlvbnM6IFN1Z2dlc3Rpb25JdGVtW11cbiAgc2VsZWN0ZWRTdWdnZXN0aW9uOiBudW1iZXJcbiAgc3VnZ2VzdGlvblR5cGU6IFN1Z2dlc3Rpb25UeXBlXG4gIG1heENvbHVtbldpZHRoPzogbnVtYmVyXG4gIGNvbW1hbmRBcmd1bWVudEhpbnQ/OiBzdHJpbmdcbiAgaW5saW5lR2hvc3RUZXh0PzogSW5saW5lR2hvc3RUZXh0XG4gIGhhbmRsZUtleURvd246IChlOiBLZXlib2FyZEV2ZW50KSA9PiB2b2lkXG59XG5cbi8qKlxuICogRXh0cmFjdCBzZWFyY2ggdG9rZW4gZnJvbSBhIGNvbXBsZXRpb24gdG9rZW4gYnkgcmVtb3ZpbmcgQCBwcmVmaXggYW5kIHF1b3Rlc1xuICogQHBhcmFtIGNvbXBsZXRpb25Ub2tlbiBUaGUgY29tcGxldGlvbiB0b2tlblxuICogQHJldHVybnMgVGhlIHNlYXJjaCB0b2tlbiB3aXRoIEAgYW5kIHF1b3RlcyByZW1vdmVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0U2VhcmNoVG9rZW4oY29tcGxldGlvblRva2VuOiB7XG4gIHRva2VuOiBzdHJpbmdcbiAgaXNRdW90ZWQ/OiBib29sZWFuXG59KTogc3RyaW5nIHtcbiAgaWYgKGNvbXBsZXRpb25Ub2tlbi5pc1F1b3RlZCkge1xuICAgIC8vIFJlbW92ZSBAXCIgcHJlZml4IGFuZCBvcHRpb25hbCBjbG9zaW5nIFwiXG4gICAgcmV0dXJuIGNvbXBsZXRpb25Ub2tlbi50b2tlbi5zbGljZSgyKS5yZXBsYWNlKC9cIiQvLCAnJylcbiAgfSBlbHNlIGlmIChjb21wbGV0aW9uVG9rZW4udG9rZW4uc3RhcnRzV2l0aCgnQCcpKSB7XG4gICAgcmV0dXJuIGNvbXBsZXRpb25Ub2tlbi50b2tlbi5zdWJzdHJpbmcoMSlcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gY29tcGxldGlvblRva2VuLnRva2VuXG4gIH1cbn1cblxuLyoqXG4gKiBGb3JtYXQgYSByZXBsYWNlbWVudCB2YWx1ZSB3aXRoIHByb3BlciBAIHByZWZpeCBhbmQgcXVvdGVzIGJhc2VkIG9uIGNvbnRleHRcbiAqIEBwYXJhbSBvcHRpb25zIENvbmZpZ3VyYXRpb24gZm9yIGZvcm1hdHRpbmdcbiAqIEBwYXJhbSBvcHRpb25zLmRpc3BsYXlUZXh0IFRoZSB0ZXh0IHRvIGRpc3BsYXlcbiAqIEBwYXJhbSBvcHRpb25zLm1vZGUgVGhlIGN1cnJlbnQgbW9kZSAoYmFzaCBvciBwcm9tcHQpXG4gKiBAcGFyYW0gb3B0aW9ucy5oYXNBdFByZWZpeCBXaGV0aGVyIHRoZSBvcmlnaW5hbCB0b2tlbiBoYXMgQCBwcmVmaXhcbiAqIEBwYXJhbSBvcHRpb25zLm5lZWRzUXVvdGVzIFdoZXRoZXIgdGhlIHRleHQgbmVlZHMgcXVvdGVzIChjb250YWlucyBzcGFjZXMpXG4gKiBAcGFyYW0gb3B0aW9ucy5pc1F1b3RlZCBXaGV0aGVyIHRoZSBvcmlnaW5hbCB0b2tlbiB3YXMgYWxyZWFkeSBxdW90ZWQgKHVzZXIgdHlwZWQgQFwiLi4uKVxuICogQHBhcmFtIG9wdGlvbnMuaXNDb21wbGV0ZSBXaGV0aGVyIHRoaXMgaXMgYSBjb21wbGV0ZSBzdWdnZXN0aW9uIChhZGRzIHRyYWlsaW5nIHNwYWNlKVxuICogQHJldHVybnMgVGhlIGZvcm1hdHRlZCByZXBsYWNlbWVudCB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0UmVwbGFjZW1lbnRWYWx1ZShvcHRpb25zOiB7XG4gIGRpc3BsYXlUZXh0OiBzdHJpbmdcbiAgbW9kZTogc3RyaW5nXG4gIGhhc0F0UHJlZml4OiBib29sZWFuXG4gIG5lZWRzUXVvdGVzOiBib29sZWFuXG4gIGlzUXVvdGVkPzogYm9vbGVhblxuICBpc0NvbXBsZXRlOiBib29sZWFuXG59KTogc3RyaW5nIHtcbiAgY29uc3QgeyBkaXNwbGF5VGV4dCwgbW9kZSwgaGFzQXRQcmVmaXgsIG5lZWRzUXVvdGVzLCBpc1F1b3RlZCwgaXNDb21wbGV0ZSB9ID1cbiAgICBvcHRpb25zXG4gIGNvbnN0IHNwYWNlID0gaXNDb21wbGV0ZSA/ICcgJyA6ICcnXG5cbiAgaWYgKGlzUXVvdGVkIHx8IG5lZWRzUXVvdGVzKSB7XG4gICAgLy8gVXNlIHF1b3RlZCBmb3JtYXRcbiAgICByZXR1cm4gbW9kZSA9PT0gJ2Jhc2gnXG4gICAgICA/IGBcIiR7ZGlzcGxheVRleHR9XCIke3NwYWNlfWBcbiAgICAgIDogYEBcIiR7ZGlzcGxheVRleHR9XCIke3NwYWNlfWBcbiAgfSBlbHNlIGlmIChoYXNBdFByZWZpeCkge1xuICAgIHJldHVybiBtb2RlID09PSAnYmFzaCdcbiAgICAgID8gYCR7ZGlzcGxheVRleHR9JHtzcGFjZX1gXG4gICAgICA6IGBAJHtkaXNwbGF5VGV4dH0ke3NwYWNlfWBcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZGlzcGxheVRleHRcbiAgfVxufVxuXG4vKipcbiAqIEFwcGx5IGEgc2hlbGwgY29tcGxldGlvbiBzdWdnZXN0aW9uIGJ5IHJlcGxhY2luZyB0aGUgY3VycmVudCB3b3JkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVNoZWxsU3VnZ2VzdGlvbihcbiAgc3VnZ2VzdGlvbjogU3VnZ2VzdGlvbkl0ZW0sXG4gIGlucHV0OiBzdHJpbmcsXG4gIGN1cnNvck9mZnNldDogbnVtYmVyLFxuICBvbklucHV0Q2hhbmdlOiAodmFsdWU6IHN0cmluZykgPT4gdm9pZCxcbiAgc2V0Q3Vyc29yT2Zmc2V0OiAob2Zmc2V0OiBudW1iZXIpID0+IHZvaWQsXG4gIGNvbXBsZXRpb25UeXBlOiBTaGVsbENvbXBsZXRpb25UeXBlIHwgdW5kZWZpbmVkLFxuKTogdm9pZCB7XG4gIGNvbnN0IGJlZm9yZUN1cnNvciA9IGlucHV0LnNsaWNlKDAsIGN1cnNvck9mZnNldClcbiAgY29uc3QgbGFzdFNwYWNlSW5kZXggPSBiZWZvcmVDdXJzb3IubGFzdEluZGV4T2YoJyAnKVxuICBjb25zdCB3b3JkU3RhcnQgPSBsYXN0U3BhY2VJbmRleCArIDFcblxuICAvLyBQcmVwYXJlIHRoZSByZXBsYWNlbWVudCB0ZXh0IGJhc2VkIG9uIGNvbXBsZXRpb24gdHlwZVxuICBsZXQgcmVwbGFjZW1lbnRUZXh0OiBzdHJpbmdcbiAgaWYgKGNvbXBsZXRpb25UeXBlID09PSAndmFyaWFibGUnKSB7XG4gICAgcmVwbGFjZW1lbnRUZXh0ID0gJyQnICsgc3VnZ2VzdGlvbi5kaXNwbGF5VGV4dCArICcgJ1xuICB9IGVsc2UgaWYgKGNvbXBsZXRpb25UeXBlID09PSAnY29tbWFuZCcpIHtcbiAgICByZXBsYWNlbWVudFRleHQgPSBzdWdnZXN0aW9uLmRpc3BsYXlUZXh0ICsgJyAnXG4gIH0gZWxzZSB7XG4gICAgcmVwbGFjZW1lbnRUZXh0ID0gc3VnZ2VzdGlvbi5kaXNwbGF5VGV4dFxuICB9XG5cbiAgY29uc3QgbmV3SW5wdXQgPVxuICAgIGlucHV0LnNsaWNlKDAsIHdvcmRTdGFydCkgKyByZXBsYWNlbWVudFRleHQgKyBpbnB1dC5zbGljZShjdXJzb3JPZmZzZXQpXG5cbiAgb25JbnB1dENoYW5nZShuZXdJbnB1dClcbiAgc2V0Q3Vyc29yT2Zmc2V0KHdvcmRTdGFydCArIHJlcGxhY2VtZW50VGV4dC5sZW5ndGgpXG59XG5cbmNvbnN0IERNX01FTUJFUl9SRSA9IC8oXnxcXHMpQFtcXHctXSokL1xuXG5mdW5jdGlvbiBhcHBseVRyaWdnZXJTdWdnZXN0aW9uKFxuICBzdWdnZXN0aW9uOiBTdWdnZXN0aW9uSXRlbSxcbiAgaW5wdXQ6IHN0cmluZyxcbiAgY3Vyc29yT2Zmc2V0OiBudW1iZXIsXG4gIHRyaWdnZXJSZTogUmVnRXhwLFxuICBvbklucHV0Q2hhbmdlOiAodmFsdWU6IHN0cmluZykgPT4gdm9pZCxcbiAgc2V0Q3Vyc29yT2Zmc2V0OiAob2Zmc2V0OiBudW1iZXIpID0+IHZvaWQsXG4pOiB2b2lkIHtcbiAgY29uc3QgbSA9IGlucHV0LnNsaWNlKDAsIGN1cnNvck9mZnNldCkubWF0Y2godHJpZ2dlclJlKVxuICBpZiAoIW0gfHwgbS5pbmRleCA9PT0gdW5kZWZpbmVkKSByZXR1cm5cbiAgY29uc3QgcHJlZml4U3RhcnQgPSBtLmluZGV4ICsgKG1bMV0/Lmxlbmd0aCA/PyAwKVxuICBjb25zdCBiZWZvcmUgPSBpbnB1dC5zbGljZSgwLCBwcmVmaXhTdGFydClcbiAgY29uc3QgbmV3SW5wdXQgPVxuICAgIGJlZm9yZSArIHN1Z2dlc3Rpb24uZGlzcGxheVRleHQgKyAnICcgKyBpbnB1dC5zbGljZShjdXJzb3JPZmZzZXQpXG4gIG9uSW5wdXRDaGFuZ2UobmV3SW5wdXQpXG4gIHNldEN1cnNvck9mZnNldChiZWZvcmUubGVuZ3RoICsgc3VnZ2VzdGlvbi5kaXNwbGF5VGV4dC5sZW5ndGggKyAxKVxufVxuXG5sZXQgY3VycmVudFNoZWxsQ29tcGxldGlvbkFib3J0Q29udHJvbGxlcjogQWJvcnRDb250cm9sbGVyIHwgbnVsbCA9IG51bGxcblxuLyoqXG4gKiBHZW5lcmF0ZSBiYXNoIHNoZWxsIGNvbXBsZXRpb24gc3VnZ2VzdGlvbnNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVCYXNoU3VnZ2VzdGlvbnMoXG4gIGlucHV0OiBzdHJpbmcsXG4gIGN1cnNvck9mZnNldDogbnVtYmVyLFxuKTogUHJvbWlzZTxTdWdnZXN0aW9uSXRlbVtdPiB7XG4gIHRyeSB7XG4gICAgaWYgKGN1cnJlbnRTaGVsbENvbXBsZXRpb25BYm9ydENvbnRyb2xsZXIpIHtcbiAgICAgIGN1cnJlbnRTaGVsbENvbXBsZXRpb25BYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuICAgIH1cblxuICAgIGN1cnJlbnRTaGVsbENvbXBsZXRpb25BYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcbiAgICBjb25zdCBzdWdnZXN0aW9ucyA9IGF3YWl0IGdldFNoZWxsQ29tcGxldGlvbnMoXG4gICAgICBpbnB1dCxcbiAgICAgIGN1cnNvck9mZnNldCxcbiAgICAgIGN1cnJlbnRTaGVsbENvbXBsZXRpb25BYm9ydENvbnRyb2xsZXIuc2lnbmFsLFxuICAgIClcblxuICAgIHJldHVybiBzdWdnZXN0aW9uc1xuICB9IGNhdGNoIHtcbiAgICAvLyBTaWxlbnQgZmFpbHVyZSAtIGRvbid0IGJyZWFrIFVYXG4gICAgbG9nRXZlbnQoJ3Rlbmd1X3NoZWxsX2NvbXBsZXRpb25fZmFpbGVkJywge30pXG4gICAgcmV0dXJuIFtdXG4gIH1cbn1cblxuLyoqXG4gKiBBcHBseSBhIGRpcmVjdG9yeS9wYXRoIGNvbXBsZXRpb24gc3VnZ2VzdGlvbiB0byB0aGUgaW5wdXRcbiAqIEFsd2F5cyBhZGRzIEAgcHJlZml4IHNpbmNlIHdlJ3JlIHJlcGxhY2luZyB0aGUgZW50aXJlIHRva2VuIChpbmNsdWRpbmcgYW55IGV4aXN0aW5nIEApXG4gKlxuICogQHBhcmFtIGlucHV0IFRoZSBjdXJyZW50IGlucHV0IHRleHRcbiAqIEBwYXJhbSBzdWdnZXN0aW9uSWQgVGhlIElEIG9mIHRoZSBzdWdnZXN0aW9uIHRvIGFwcGx5XG4gKiBAcGFyYW0gdG9rZW5TdGFydFBvcyBUaGUgc3RhcnQgcG9zaXRpb24gb2YgdGhlIHRva2VuIGJlaW5nIHJlcGxhY2VkXG4gKiBAcGFyYW0gdG9rZW5MZW5ndGggVGhlIGxlbmd0aCBvZiB0aGUgdG9rZW4gYmVpbmcgcmVwbGFjZWRcbiAqIEBwYXJhbSBpc0RpcmVjdG9yeSBXaGV0aGVyIHRoZSBzdWdnZXN0aW9uIGlzIGEgZGlyZWN0b3J5IChhZGRzIC8gc3VmZml4KSBvciBmaWxlIChhZGRzIHNwYWNlKVxuICogQHJldHVybnMgT2JqZWN0IHdpdGggdGhlIG5ldyBpbnB1dCB0ZXh0IGFuZCBjdXJzb3IgcG9zaXRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5RGlyZWN0b3J5U3VnZ2VzdGlvbihcbiAgaW5wdXQ6IHN0cmluZyxcbiAgc3VnZ2VzdGlvbklkOiBzdHJpbmcsXG4gIHRva2VuU3RhcnRQb3M6IG51bWJlcixcbiAgdG9rZW5MZW5ndGg6IG51bWJlcixcbiAgaXNEaXJlY3Rvcnk6IGJvb2xlYW4sXG4pOiB7IG5ld0lucHV0OiBzdHJpbmc7IGN1cnNvclBvczogbnVtYmVyIH0ge1xuICBjb25zdCBzdWZmaXggPSBpc0RpcmVjdG9yeSA/ICcvJyA6ICcgJ1xuICBjb25zdCBiZWZvcmUgPSBpbnB1dC5zbGljZSgwLCB0b2tlblN0YXJ0UG9zKVxuICBjb25zdCBhZnRlciA9IGlucHV0LnNsaWNlKHRva2VuU3RhcnRQb3MgKyB0b2tlbkxlbmd0aClcbiAgLy8gQWx3YXlzIGFkZCBAIHByZWZpeCAtIGlmIHRva2VuIGFscmVhZHkgaGFzIGl0LCB3ZSdyZSByZXBsYWNpbmdcbiAgLy8gdGhlIHdob2xlIHRva2VuIChpbmNsdWRpbmcgQCkgd2l0aCBAc3VnZ2VzdGlvbi5pZFxuICBjb25zdCByZXBsYWNlbWVudCA9ICdAJyArIHN1Z2dlc3Rpb25JZCArIHN1ZmZpeFxuICBjb25zdCBuZXdJbnB1dCA9IGJlZm9yZSArIHJlcGxhY2VtZW50ICsgYWZ0ZXJcblxuICByZXR1cm4ge1xuICAgIG5ld0lucHV0LFxuICAgIGN1cnNvclBvczogYmVmb3JlLmxlbmd0aCArIHJlcGxhY2VtZW50Lmxlbmd0aCxcbiAgfVxufVxuXG4vKipcbiAqIEV4dHJhY3QgYSBjb21wbGV0YWJsZSB0b2tlbiBhdCB0aGUgY3Vyc29yIHBvc2l0aW9uXG4gKiBAcGFyYW0gdGV4dCBUaGUgaW5wdXQgdGV4dFxuICogQHBhcmFtIGN1cnNvclBvcyBUaGUgY3Vyc29yIHBvc2l0aW9uXG4gKiBAcGFyYW0gaW5jbHVkZUF0U3ltYm9sIFdoZXRoZXIgdG8gY29uc2lkZXIgQCBzeW1ib2wgYXMgcGFydCBvZiB0aGUgdG9rZW5cbiAqIEByZXR1cm5zIFRoZSBjb21wbGV0YWJsZSB0b2tlbiBhbmQgaXRzIHN0YXJ0IHBvc2l0aW9uLCBvciBudWxsIGlmIG5vdCBmb3VuZFxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdENvbXBsZXRpb25Ub2tlbihcbiAgdGV4dDogc3RyaW5nLFxuICBjdXJzb3JQb3M6IG51bWJlcixcbiAgaW5jbHVkZUF0U3ltYm9sID0gZmFsc2UsXG4pOiB7IHRva2VuOiBzdHJpbmc7IHN0YXJ0UG9zOiBudW1iZXI7IGlzUXVvdGVkPzogYm9vbGVhbiB9IHwgbnVsbCB7XG4gIC8vIEVtcHR5IGlucHV0IGNoZWNrXG4gIGlmICghdGV4dCkgcmV0dXJuIG51bGxcblxuICAvLyBHZXQgdGV4dCB1cCB0byBjdXJzb3JcbiAgY29uc3QgdGV4dEJlZm9yZUN1cnNvciA9IHRleHQuc3Vic3RyaW5nKDAsIGN1cnNvclBvcylcblxuICAvLyBDaGVjayBmb3IgcXVvdGVkIEAgbWVudGlvbiBmaXJzdCAoZS5nLiwgQFwibXkgZmlsZSB3aXRoIHNwYWNlc1wiKVxuICBpZiAoaW5jbHVkZUF0U3ltYm9sKSB7XG4gICAgY29uc3QgcXVvdGVkQXRSZWdleCA9IC9AXCIoW15cIl0qKVwiPyQvXG4gICAgY29uc3QgcXVvdGVkTWF0Y2ggPSB0ZXh0QmVmb3JlQ3Vyc29yLm1hdGNoKHF1b3RlZEF0UmVnZXgpXG4gICAgaWYgKHF1b3RlZE1hdGNoICYmIHF1b3RlZE1hdGNoLmluZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIEluY2x1ZGUgYW55IHJlbWFpbmluZyBxdW90ZWQgY29udGVudCBhZnRlciBjdXJzb3IgdW50aWwgY2xvc2luZyBxdW90ZSBvciBlbmRcbiAgICAgIGNvbnN0IHRleHRBZnRlckN1cnNvciA9IHRleHQuc3Vic3RyaW5nKGN1cnNvclBvcylcbiAgICAgIGNvbnN0IGFmdGVyUXVvdGVkTWF0Y2ggPSB0ZXh0QWZ0ZXJDdXJzb3IubWF0Y2goL15bXlwiXSpcIj8vKVxuICAgICAgY29uc3QgcXVvdGVkU3VmZml4ID0gYWZ0ZXJRdW90ZWRNYXRjaCA/IGFmdGVyUXVvdGVkTWF0Y2hbMF0gOiAnJ1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b2tlbjogcXVvdGVkTWF0Y2hbMF0gKyBxdW90ZWRTdWZmaXgsXG4gICAgICAgIHN0YXJ0UG9zOiBxdW90ZWRNYXRjaC5pbmRleCxcbiAgICAgICAgaXNRdW90ZWQ6IHRydWUsXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gRmFzdCBwYXRoIGZvciBAIHRva2VuczogdXNlIGxhc3RJbmRleE9mIHRvIGF2b2lkIGV4cGVuc2l2ZSAkIGFuY2hvciBzY2FuXG4gIGlmIChpbmNsdWRlQXRTeW1ib2wpIHtcbiAgICBjb25zdCBhdElkeCA9IHRleHRCZWZvcmVDdXJzb3IubGFzdEluZGV4T2YoJ0AnKVxuICAgIGlmIChcbiAgICAgIGF0SWR4ID49IDAgJiZcbiAgICAgIChhdElkeCA9PT0gMCB8fCAvXFxzLy50ZXN0KHRleHRCZWZvcmVDdXJzb3JbYXRJZHggLSAxXSEpKVxuICAgICkge1xuICAgICAgY29uc3QgZnJvbUF0ID0gdGV4dEJlZm9yZUN1cnNvci5zdWJzdHJpbmcoYXRJZHgpXG4gICAgICBjb25zdCBhdEhlYWRNYXRjaCA9IGZyb21BdC5tYXRjaChBVF9UT0tFTl9IRUFEX1JFKVxuICAgICAgaWYgKGF0SGVhZE1hdGNoICYmIGF0SGVhZE1hdGNoWzBdLmxlbmd0aCA9PT0gZnJvbUF0Lmxlbmd0aCkge1xuICAgICAgICBjb25zdCB0ZXh0QWZ0ZXJDdXJzb3IgPSB0ZXh0LnN1YnN0cmluZyhjdXJzb3JQb3MpXG4gICAgICAgIGNvbnN0IGFmdGVyTWF0Y2ggPSB0ZXh0QWZ0ZXJDdXJzb3IubWF0Y2goUEFUSF9DSEFSX0hFQURfUkUpXG4gICAgICAgIGNvbnN0IHRva2VuU3VmZml4ID0gYWZ0ZXJNYXRjaCA/IGFmdGVyTWF0Y2hbMF0gOiAnJ1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHRva2VuOiBhdEhlYWRNYXRjaFswXSArIHRva2VuU3VmZml4LFxuICAgICAgICAgIHN0YXJ0UG9zOiBhdElkeCxcbiAgICAgICAgICBpc1F1b3RlZDogZmFsc2UsXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBOb24tQCB0b2tlbiBvciBjdXJzb3Igb3V0c2lkZSBAIHRva2VuIOKAlCB1c2UgJCBhbmNob3Igb24gKHNob3J0KSB0YWlsXG4gIGNvbnN0IHRva2VuUmVnZXggPSBpbmNsdWRlQXRTeW1ib2wgPyBUT0tFTl9XSVRIX0FUX1JFIDogVE9LRU5fV0lUSE9VVF9BVF9SRVxuICBjb25zdCBtYXRjaCA9IHRleHRCZWZvcmVDdXJzb3IubWF0Y2godG9rZW5SZWdleClcbiAgaWYgKCFtYXRjaCB8fCBtYXRjaC5pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIC8vIENoZWNrIGlmIGN1cnNvciBpcyBpbiB0aGUgTUlERExFIG9mIGEgdG9rZW4gKG1vcmUgd29yZCBjaGFyYWN0ZXJzIGFmdGVyIGN1cnNvcilcbiAgLy8gSWYgc28sIGV4dGVuZCB0aGUgdG9rZW4gdG8gaW5jbHVkZSBhbGwgY2hhcmFjdGVycyB1bnRpbCB3aGl0ZXNwYWNlIG9yIGVuZCBvZiBzdHJpbmdcbiAgY29uc3QgdGV4dEFmdGVyQ3Vyc29yID0gdGV4dC5zdWJzdHJpbmcoY3Vyc29yUG9zKVxuICBjb25zdCBhZnRlck1hdGNoID0gdGV4dEFmdGVyQ3Vyc29yLm1hdGNoKFBBVEhfQ0hBUl9IRUFEX1JFKVxuICBjb25zdCB0b2tlblN1ZmZpeCA9IGFmdGVyTWF0Y2ggPyBhZnRlck1hdGNoWzBdIDogJydcblxuICByZXR1cm4ge1xuICAgIHRva2VuOiBtYXRjaFswXSArIHRva2VuU3VmZml4LFxuICAgIHN0YXJ0UG9zOiBtYXRjaC5pbmRleCxcbiAgICBpc1F1b3RlZDogZmFsc2UsXG4gIH1cbn1cblxuZnVuY3Rpb24gZXh0cmFjdENvbW1hbmROYW1lQW5kQXJncyh2YWx1ZTogc3RyaW5nKToge1xuICBjb21tYW5kTmFtZTogc3RyaW5nXG4gIGFyZ3M6IHN0cmluZ1xufSB8IG51bGwge1xuICBpZiAoaXNDb21tYW5kSW5wdXQodmFsdWUpKSB7XG4gICAgY29uc3Qgc3BhY2VJbmRleCA9IHZhbHVlLmluZGV4T2YoJyAnKVxuICAgIGlmIChzcGFjZUluZGV4ID09PSAtMSlcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvbW1hbmROYW1lOiB2YWx1ZS5zbGljZSgxKSxcbiAgICAgICAgYXJnczogJycsXG4gICAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbW1hbmROYW1lOiB2YWx1ZS5zbGljZSgxLCBzcGFjZUluZGV4KSxcbiAgICAgIGFyZ3M6IHZhbHVlLnNsaWNlKHNwYWNlSW5kZXggKyAxKSxcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGxcbn1cblxuZnVuY3Rpb24gaGFzQ29tbWFuZFdpdGhBcmd1bWVudHMoXG4gIGlzQXRFbmRXaXRoV2hpdGVzcGFjZTogYm9vbGVhbixcbiAgdmFsdWU6IHN0cmluZyxcbikge1xuICAvLyBJZiB2YWx1ZS5lbmRzV2l0aCgnICcpIGJ1dCB0aGUgdXNlciBpcyBub3QgYXQgdGhlIGVuZCwgdGhlbiB0aGUgdXNlciBoYXNcbiAgLy8gcG90ZW50aWFsbHkgZ29uZSBiYWNrIHRvIHRoZSBjb21tYW5kIGluIGFuIGVmZm9ydCB0byBlZGl0IHRoZSBjb21tYW5kIG5hbWVcbiAgLy8gKGJ1dCBwcmVzZXJ2ZSB0aGUgYXJndW1lbnRzKS5cbiAgcmV0dXJuICFpc0F0RW5kV2l0aFdoaXRlc3BhY2UgJiYgdmFsdWUuaW5jbHVkZXMoJyAnKSAmJiAhdmFsdWUuZW5kc1dpdGgoJyAnKVxufVxuXG4vKipcbiAqIEhvb2sgZm9yIGhhbmRsaW5nIHR5cGVhaGVhZCBmdW5jdGlvbmFsaXR5IGZvciBib3RoIGNvbW1hbmRzIGFuZCBmaWxlIHBhdGhzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1c2VUeXBlYWhlYWQoe1xuICBjb21tYW5kcyxcbiAgb25JbnB1dENoYW5nZSxcbiAgb25TdWJtaXQsXG4gIHNldEN1cnNvck9mZnNldCxcbiAgaW5wdXQsXG4gIGN1cnNvck9mZnNldCxcbiAgbW9kZSxcbiAgYWdlbnRzLFxuICBzZXRTdWdnZXN0aW9uc1N0YXRlLFxuICBzdWdnZXN0aW9uc1N0YXRlOiB7IHN1Z2dlc3Rpb25zLCBzZWxlY3RlZFN1Z2dlc3Rpb24sIGNvbW1hbmRBcmd1bWVudEhpbnQgfSxcbiAgc3VwcHJlc3NTdWdnZXN0aW9ucyA9IGZhbHNlLFxuICBtYXJrQWNjZXB0ZWQsXG4gIG9uTW9kZUNoYW5nZSxcbn06IFByb3BzKTogVXNlVHlwZWFoZWFkUmVzdWx0IHtcbiAgY29uc3QgeyBhZGROb3RpZmljYXRpb24gfSA9IHVzZU5vdGlmaWNhdGlvbnMoKVxuICBjb25zdCB0aGlua2luZ1RvZ2dsZVNob3J0Y3V0ID0gdXNlU2hvcnRjdXREaXNwbGF5KFxuICAgICdjaGF0OnRoaW5raW5nVG9nZ2xlJyxcbiAgICAnQ2hhdCcsXG4gICAgJ2FsdCt0JyxcbiAgKVxuICBjb25zdCBbc3VnZ2VzdGlvblR5cGUsIHNldFN1Z2dlc3Rpb25UeXBlXSA9IHVzZVN0YXRlPFN1Z2dlc3Rpb25UeXBlPignbm9uZScpXG5cbiAgLy8gQ29tcHV0ZSBtYXggY29sdW1uIHdpZHRoIGZyb20gQUxMIGNvbW1hbmRzIG9uY2UgKG5vdCBmaWx0ZXJlZCByZXN1bHRzKVxuICAvLyBUaGlzIHByZXZlbnRzIGxheW91dCBzaGlmdCB3aGVuIGZpbHRlcmluZ1xuICBjb25zdCBhbGxDb21tYW5kc01heFdpZHRoID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgdmlzaWJsZUNvbW1hbmRzID0gY29tbWFuZHMuZmlsdGVyKGNtZCA9PiAhY21kLmlzSGlkZGVuKVxuICAgIGlmICh2aXNpYmxlQ29tbWFuZHMubGVuZ3RoID09PSAwKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgY29uc3QgbWF4TGVuID0gTWF0aC5tYXgoXG4gICAgICAuLi52aXNpYmxlQ29tbWFuZHMubWFwKGNtZCA9PiBnZXRDb21tYW5kTmFtZShjbWQpLmxlbmd0aCksXG4gICAgKVxuICAgIHJldHVybiBtYXhMZW4gKyA2IC8vICsxIGZvciBcIi9cIiBwcmVmaXgsICs1IGZvciBwYWRkaW5nXG4gIH0sIFtjb21tYW5kc10pXG5cbiAgY29uc3QgW21heENvbHVtbldpZHRoLCBzZXRNYXhDb2x1bW5XaWR0aF0gPSB1c2VTdGF0ZTxudW1iZXIgfCB1bmRlZmluZWQ+KFxuICAgIHVuZGVmaW5lZCxcbiAgKVxuICBjb25zdCBtY3BSZXNvdXJjZXMgPSB1c2VBcHBTdGF0ZShzID0+IHMubWNwLnJlc291cmNlcylcbiAgY29uc3Qgc3RvcmUgPSB1c2VBcHBTdGF0ZVN0b3JlKClcbiAgY29uc3QgcHJvbXB0U3VnZ2VzdGlvbiA9IHVzZUFwcFN0YXRlKHMgPT4gcy5wcm9tcHRTdWdnZXN0aW9uKVxuICAvLyBQcm9tcHRJbnB1dCBoaWRlcyBzdWdnZXN0aW9uIGdob3N0IHRleHQgaW4gdGVhbW1hdGUgdmlldyDigJQgbWlycm9yIHRoYXRcbiAgLy8gZ2F0ZSBoZXJlIHNvIFRhYi9yaWdodEFycm93IGNhbid0IGFjY2VwdCB3aGF0IGlzbid0IGRpc3BsYXllZC5cbiAgY29uc3QgaXNWaWV3aW5nVGVhbW1hdGUgPSB1c2VBcHBTdGF0ZShzID0+ICEhcy52aWV3aW5nQWdlbnRUYXNrSWQpXG5cbiAgLy8gQWNjZXNzIGtleWJpbmRpbmcgY29udGV4dCB0byBjaGVjayBmb3IgcGVuZGluZyBjaG9yZCBzZXF1ZW5jZXNcbiAgY29uc3Qga2V5YmluZGluZ0NvbnRleHQgPSB1c2VPcHRpb25hbEtleWJpbmRpbmdDb250ZXh0KClcblxuICAvLyBTdGF0ZSBmb3IgaW5saW5lIGdob3N0IHRleHQgKGJhc2ggaGlzdG9yeSBjb21wbGV0aW9uIC0gYXN5bmMpXG4gIGNvbnN0IFtpbmxpbmVHaG9zdFRleHQsIHNldElubGluZUdob3N0VGV4dF0gPSB1c2VTdGF0ZTxcbiAgICBJbmxpbmVHaG9zdFRleHQgfCB1bmRlZmluZWRcbiAgPih1bmRlZmluZWQpXG5cbiAgLy8gU3luY2hyb25vdXMgZ2hvc3QgdGV4dCBmb3IgcHJvbXB0IG1vZGUgbWlkLWlucHV0IHNsYXNoIGNvbW1hbmRzLlxuICAvLyBDb21wdXRlZCBkdXJpbmcgcmVuZGVyIHZpYSB1c2VNZW1vIHRvIGVsaW1pbmF0ZSB0aGUgb25lLWZyYW1lIGZsaWNrZXJcbiAgLy8gdGhhdCBvY2N1cnMgd2hlbiB1c2luZyB1c2VTdGF0ZSArIHVzZUVmZmVjdCAoZWZmZWN0IHJ1bnMgYWZ0ZXIgcmVuZGVyKS5cbiAgY29uc3Qgc3luY1Byb21wdEdob3N0VGV4dCA9IHVzZU1lbW8oKCk6IElubGluZUdob3N0VGV4dCB8IHVuZGVmaW5lZCA9PiB7XG4gICAgaWYgKG1vZGUgIT09ICdwcm9tcHQnIHx8IHN1cHByZXNzU3VnZ2VzdGlvbnMpIHJldHVybiB1bmRlZmluZWRcbiAgICBjb25zdCBtaWRJbnB1dENvbW1hbmQgPSBmaW5kTWlkSW5wdXRTbGFzaENvbW1hbmQoaW5wdXQsIGN1cnNvck9mZnNldClcbiAgICBpZiAoIW1pZElucHV0Q29tbWFuZCkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIGNvbnN0IG1hdGNoID0gZ2V0QmVzdENvbW1hbmRNYXRjaChtaWRJbnB1dENvbW1hbmQucGFydGlhbENvbW1hbmQsIGNvbW1hbmRzKVxuICAgIGlmICghbWF0Y2gpIHJldHVybiB1bmRlZmluZWRcbiAgICByZXR1cm4ge1xuICAgICAgdGV4dDogbWF0Y2guc3VmZml4LFxuICAgICAgZnVsbENvbW1hbmQ6IG1hdGNoLmZ1bGxDb21tYW5kLFxuICAgICAgaW5zZXJ0UG9zaXRpb246XG4gICAgICAgIG1pZElucHV0Q29tbWFuZC5zdGFydFBvcyArIDEgKyBtaWRJbnB1dENvbW1hbmQucGFydGlhbENvbW1hbmQubGVuZ3RoLFxuICAgIH1cbiAgfSwgW2lucHV0LCBjdXJzb3JPZmZzZXQsIG1vZGUsIGNvbW1hbmRzLCBzdXBwcmVzc1N1Z2dlc3Rpb25zXSlcblxuICAvLyBNZXJnZWQgZ2hvc3QgdGV4dDogcHJvbXB0IG1vZGUgdXNlcyBzeW5jaHJvbm91cyB1c2VNZW1vLCBiYXNoIG1vZGUgdXNlcyBhc3luYyB1c2VTdGF0ZVxuICBjb25zdCBlZmZlY3RpdmVHaG9zdFRleHQgPSBzdXBwcmVzc1N1Z2dlc3Rpb25zXG4gICAgPyB1bmRlZmluZWRcbiAgICA6IG1vZGUgPT09ICdwcm9tcHQnXG4gICAgICA/IHN5bmNQcm9tcHRHaG9zdFRleHRcbiAgICAgIDogaW5saW5lR2hvc3RUZXh0XG5cbiAgLy8gVXNlIGEgcmVmIGZvciBjdXJzb3JPZmZzZXQgdG8gYXZvaWQgcmUtdHJpZ2dlcmluZyBzdWdnZXN0aW9ucyBvbiBjdXJzb3IgbW92ZW1lbnQgYWxvbmVcbiAgLy8gV2Ugb25seSB3YW50IHRvIHJlLWZldGNoIHN1Z2dlc3Rpb25zIHdoZW4gdGhlIGFjdHVhbCBzZWFyY2ggdG9rZW4gY2hhbmdlc1xuICBjb25zdCBjdXJzb3JPZmZzZXRSZWYgPSB1c2VSZWYoY3Vyc29yT2Zmc2V0KVxuICBjdXJzb3JPZmZzZXRSZWYuY3VycmVudCA9IGN1cnNvck9mZnNldFxuXG4gIC8vIFRyYWNrIHRoZSBsYXRlc3Qgc2VhcmNoIHRva2VuIHRvIGRpc2NhcmQgc3RhbGUgcmVzdWx0cyBmcm9tIHNsb3cgYXN5bmMgb3BlcmF0aW9uc1xuICBjb25zdCBsYXRlc3RTZWFyY2hUb2tlblJlZiA9IHVzZVJlZjxzdHJpbmcgfCBudWxsPihudWxsKVxuICAvLyBUcmFjayBwcmV2aW91cyBpbnB1dCB0byBkZXRlY3QgYWN0dWFsIHRleHQgY2hhbmdlcyB2cy4gY2FsbGJhY2sgcmVjcmVhdGlvbnNcbiAgY29uc3QgcHJldklucHV0UmVmID0gdXNlUmVmKCcnKVxuICAvLyBUcmFjayB0aGUgbGF0ZXN0IHBhdGggdG9rZW4gdG8gZGlzY2FyZCBzdGFsZSByZXN1bHRzIGZyb20gcGF0aCBjb21wbGV0aW9uXG4gIGNvbnN0IGxhdGVzdFBhdGhUb2tlblJlZiA9IHVzZVJlZignJylcbiAgLy8gVHJhY2sgdGhlIGxhdGVzdCBiYXNoIGlucHV0IHRvIGRpc2NhcmQgc3RhbGUgcmVzdWx0cyBmcm9tIGhpc3RvcnkgY29tcGxldGlvblxuICBjb25zdCBsYXRlc3RCYXNoSW5wdXRSZWYgPSB1c2VSZWYoJycpXG4gIC8vIFRyYWNrIHRoZSBsYXRlc3Qgc2xhY2sgY2hhbm5lbCB0b2tlbiB0byBkaXNjYXJkIHN0YWxlIHJlc3VsdHMgZnJvbSBNQ1BcbiAgY29uc3QgbGF0ZXN0U2xhY2tUb2tlblJlZiA9IHVzZVJlZignJylcbiAgLy8gVHJhY2sgc3VnZ2VzdGlvbnMgdmlhIHJlZiB0byBhdm9pZCB1cGRhdGVTdWdnZXN0aW9ucyBiZWluZyByZWNyZWF0ZWQgb24gc2VsZWN0aW9uIGNoYW5nZXNcbiAgY29uc3Qgc3VnZ2VzdGlvbnNSZWYgPSB1c2VSZWYoc3VnZ2VzdGlvbnMpXG4gIHN1Z2dlc3Rpb25zUmVmLmN1cnJlbnQgPSBzdWdnZXN0aW9uc1xuICAvLyBUcmFjayB0aGUgaW5wdXQgdmFsdWUgd2hlbiBzdWdnZXN0aW9ucyB3ZXJlIG1hbnVhbGx5IGRpc21pc3NlZCB0byBwcmV2ZW50IHJlLXRyaWdnZXJpbmdcbiAgY29uc3QgZGlzbWlzc2VkRm9ySW5wdXRSZWYgPSB1c2VSZWY8c3RyaW5nIHwgbnVsbD4obnVsbClcblxuICAvLyBDbGVhciBhbGwgc3VnZ2VzdGlvbnNcbiAgY29uc3QgY2xlYXJTdWdnZXN0aW9ucyA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBzZXRTdWdnZXN0aW9uc1N0YXRlKCgpID0+ICh7XG4gICAgICBjb21tYW5kQXJndW1lbnRIaW50OiB1bmRlZmluZWQsXG4gICAgICBzdWdnZXN0aW9uczogW10sXG4gICAgICBzZWxlY3RlZFN1Z2dlc3Rpb246IC0xLFxuICAgIH0pKVxuICAgIHNldFN1Z2dlc3Rpb25UeXBlKCdub25lJylcbiAgICBzZXRNYXhDb2x1bW5XaWR0aCh1bmRlZmluZWQpXG4gICAgc2V0SW5saW5lR2hvc3RUZXh0KHVuZGVmaW5lZClcbiAgfSwgW3NldFN1Z2dlc3Rpb25zU3RhdGVdKVxuXG4gIC8vIEV4cGVuc2l2ZSBhc3luYyBvcGVyYXRpb24gdG8gZmV0Y2ggZmlsZS9yZXNvdXJjZSBzdWdnZXN0aW9uc1xuICBjb25zdCBmZXRjaEZpbGVTdWdnZXN0aW9ucyA9IHVzZUNhbGxiYWNrKFxuICAgIGFzeW5jIChzZWFyY2hUb2tlbjogc3RyaW5nLCBpc0F0U3ltYm9sID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgIGxhdGVzdFNlYXJjaFRva2VuUmVmLmN1cnJlbnQgPSBzZWFyY2hUb2tlblxuICAgICAgY29uc3QgY29tYmluZWRJdGVtcyA9IGF3YWl0IGdlbmVyYXRlVW5pZmllZFN1Z2dlc3Rpb25zKFxuICAgICAgICBzZWFyY2hUb2tlbixcbiAgICAgICAgbWNwUmVzb3VyY2VzLFxuICAgICAgICBhZ2VudHMsXG4gICAgICAgIGlzQXRTeW1ib2wsXG4gICAgICApXG4gICAgICAvLyBEaXNjYXJkIHN0YWxlIHJlc3VsdHMgaWYgYSBuZXdlciBxdWVyeSB3YXMgaW5pdGlhdGVkIHdoaWxlIHdhaXRpbmdcbiAgICAgIGlmIChsYXRlc3RTZWFyY2hUb2tlblJlZi5jdXJyZW50ICE9PSBzZWFyY2hUb2tlbikge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGlmIChjb21iaW5lZEl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBJbmxpbmUgY2xlYXJTdWdnZXN0aW9ucyBsb2dpYyB0byBhdm9pZCBuZWVkaW5nIGRlYm91bmNlZEZldGNoRmlsZVN1Z2dlc3Rpb25zXG4gICAgICAgIHNldFN1Z2dlc3Rpb25zU3RhdGUoKCkgPT4gKHtcbiAgICAgICAgICBjb21tYW5kQXJndW1lbnRIaW50OiB1bmRlZmluZWQsXG4gICAgICAgICAgc3VnZ2VzdGlvbnM6IFtdLFxuICAgICAgICAgIHNlbGVjdGVkU3VnZ2VzdGlvbjogLTEsXG4gICAgICAgIH0pKVxuICAgICAgICBzZXRTdWdnZXN0aW9uVHlwZSgnbm9uZScpXG4gICAgICAgIHNldE1heENvbHVtbldpZHRoKHVuZGVmaW5lZClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBzZXRTdWdnZXN0aW9uc1N0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgY29tbWFuZEFyZ3VtZW50SGludDogdW5kZWZpbmVkLFxuICAgICAgICBzdWdnZXN0aW9uczogY29tYmluZWRJdGVtcyxcbiAgICAgICAgc2VsZWN0ZWRTdWdnZXN0aW9uOiBnZXRQcmVzZXJ2ZWRTZWxlY3Rpb24oXG4gICAgICAgICAgcHJldi5zdWdnZXN0aW9ucyxcbiAgICAgICAgICBwcmV2LnNlbGVjdGVkU3VnZ2VzdGlvbixcbiAgICAgICAgICBjb21iaW5lZEl0ZW1zLFxuICAgICAgICApLFxuICAgICAgfSkpXG4gICAgICBzZXRTdWdnZXN0aW9uVHlwZShjb21iaW5lZEl0ZW1zLmxlbmd0aCA+IDAgPyAnZmlsZScgOiAnbm9uZScpXG4gICAgICBzZXRNYXhDb2x1bW5XaWR0aCh1bmRlZmluZWQpIC8vIE5vIGZpeGVkIHdpZHRoIGZvciBmaWxlIHN1Z2dlc3Rpb25zXG4gICAgfSxcbiAgICBbXG4gICAgICBtY3BSZXNvdXJjZXMsXG4gICAgICBzZXRTdWdnZXN0aW9uc1N0YXRlLFxuICAgICAgc2V0U3VnZ2VzdGlvblR5cGUsXG4gICAgICBzZXRNYXhDb2x1bW5XaWR0aCxcbiAgICAgIGFnZW50cyxcbiAgICBdLFxuICApXG5cbiAgLy8gUHJlLXdhcm0gdGhlIGZpbGUgaW5kZXggb24gbW91bnQgc28gdGhlIGZpcnN0IEAtbWVudGlvbiBkb2Vzbid0IGJsb2NrLlxuICAvLyBUaGUgYnVpbGQgcnVucyBpbiBiYWNrZ3JvdW5kIHdpdGggfjRtcyBldmVudC1sb29wIHlpZWxkcywgc28gaXQgZG9lc24ndFxuICAvLyBkZWxheSBmaXJzdCByZW5kZXIg4oCUIGl0IGp1c3QgcmFjZXMgdGhlIHVzZXIncyBmaXJzdCBAIGtleXN0cm9rZS5cbiAgLy9cbiAgLy8gSWYgdGhlIHVzZXIgdHlwZXMgYmVmb3JlIHRoZSBidWlsZCBmaW5pc2hlcywgdGhleSBnZXQgcGFydGlhbCByZXN1bHRzXG4gIC8vIGZyb20gdGhlIHJlYWR5IGNodW5rczsgd2hlbiB0aGUgYnVpbGQgY29tcGxldGVzLCByZS1maXJlIHRoZSBsYXN0XG4gIC8vIHNlYXJjaCBzbyBwYXJ0aWFsIHVwZ3JhZGVzIHRvIGZ1bGwuIENsZWFycyB0aGUgdG9rZW4gcmVmIHNvIHRoZSBzYW1lXG4gIC8vIHF1ZXJ5IGlzbid0IGRpc2NhcmRlZCBhcyBzdGFsZS5cbiAgLy9cbiAgLy8gU2tpcHBlZCB1bmRlciBOT0RFX0VOVj10ZXN0OiBSRVBMLW1vdW50aW5nIHRlc3RzIHdvdWxkIHNwYXduIGdpdCBscy1maWxlc1xuICAvLyBhZ2FpbnN0IHRoZSByZWFsIENJIHdvcmtzcGFjZSAoMjcwaysgZmlsZXMgb24gV2luZG93cyBydW5uZXJzKSwgYW5kIHRoZVxuICAvLyBiYWNrZ3JvdW5kIGJ1aWxkIG91dGxpdmVzIHRoZSB0ZXN0IOKAlCBpdHMgc2V0SW1tZWRpYXRlIGNoYWluIGxlYWtzIGludG9cbiAgLy8gc3Vic2VxdWVudCB0ZXN0cyBpbiB0aGUgc2hhcmQuIFRoZSBzdWJzY3JpYmVyIHN0aWxsIHJlZ2lzdGVycyBzb1xuICAvLyBmaWxlU3VnZ2VzdGlvbnMgdGVzdHMgdGhhdCB0cmlnZ2VyIGEgcmVmcmVzaCBkaXJlY3RseSB3b3JrIGNvcnJlY3RseS5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoXCJwcm9kdWN0aW9uXCIgIT09ICd0ZXN0Jykge1xuICAgICAgc3RhcnRCYWNrZ3JvdW5kQ2FjaGVSZWZyZXNoKClcbiAgICB9XG4gICAgcmV0dXJuIG9uSW5kZXhCdWlsZENvbXBsZXRlKCgpID0+IHtcbiAgICAgIGNvbnN0IHRva2VuID0gbGF0ZXN0U2VhcmNoVG9rZW5SZWYuY3VycmVudFxuICAgICAgaWYgKHRva2VuICE9PSBudWxsKSB7XG4gICAgICAgIGxhdGVzdFNlYXJjaFRva2VuUmVmLmN1cnJlbnQgPSBudWxsXG4gICAgICAgIHZvaWQgZmV0Y2hGaWxlU3VnZ2VzdGlvbnModG9rZW4sIHRva2VuID09PSAnJylcbiAgICAgIH1cbiAgICB9KVxuICB9LCBbZmV0Y2hGaWxlU3VnZ2VzdGlvbnNdKVxuXG4gIC8vIERlYm91bmNlIHRoZSBmaWxlIGZldGNoIG9wZXJhdGlvbi4gNTBtcyBzaXRzIGp1c3QgYWJvdmUgbWFjT1MgZGVmYXVsdFxuICAvLyBrZXktcmVwZWF0ICh+MzNtcykgc28gaGVsZC1kZWxldGUvYmFja3NwYWNlIGNvYWxlc2NlcyBpbnRvIG9uZSBzZWFyY2hcbiAgLy8gaW5zdGVhZCBvZiBzdHV0dGVyaW5nIG9uIGVhY2ggcmVwZWF0ZWQga2V5LiBUaGUgc2VhcmNoIGl0c2VsZiBpcyB+OOKAkzE1bXNcbiAgLy8gb24gYSAyNzBrLWZpbGUgaW5kZXguXG4gIGNvbnN0IGRlYm91bmNlZEZldGNoRmlsZVN1Z2dlc3Rpb25zID0gdXNlRGVib3VuY2VDYWxsYmFjayhcbiAgICBmZXRjaEZpbGVTdWdnZXN0aW9ucyxcbiAgICA1MCxcbiAgKVxuXG4gIGNvbnN0IGZldGNoU2xhY2tDaGFubmVscyA9IHVzZUNhbGxiYWNrKFxuICAgIGFzeW5jIChwYXJ0aWFsOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgIGxhdGVzdFNsYWNrVG9rZW5SZWYuY3VycmVudCA9IHBhcnRpYWxcbiAgICAgIGNvbnN0IGNoYW5uZWxzID0gYXdhaXQgZ2V0U2xhY2tDaGFubmVsU3VnZ2VzdGlvbnMoXG4gICAgICAgIHN0b3JlLmdldFN0YXRlKCkubWNwLmNsaWVudHMsXG4gICAgICAgIHBhcnRpYWwsXG4gICAgICApXG4gICAgICBpZiAobGF0ZXN0U2xhY2tUb2tlblJlZi5jdXJyZW50ICE9PSBwYXJ0aWFsKSByZXR1cm5cbiAgICAgIHNldFN1Z2dlc3Rpb25zU3RhdGUocHJldiA9PiAoe1xuICAgICAgICBjb21tYW5kQXJndW1lbnRIaW50OiB1bmRlZmluZWQsXG4gICAgICAgIHN1Z2dlc3Rpb25zOiBjaGFubmVscyxcbiAgICAgICAgc2VsZWN0ZWRTdWdnZXN0aW9uOiBnZXRQcmVzZXJ2ZWRTZWxlY3Rpb24oXG4gICAgICAgICAgcHJldi5zdWdnZXN0aW9ucyxcbiAgICAgICAgICBwcmV2LnNlbGVjdGVkU3VnZ2VzdGlvbixcbiAgICAgICAgICBjaGFubmVscyxcbiAgICAgICAgKSxcbiAgICAgIH0pKVxuICAgICAgc2V0U3VnZ2VzdGlvblR5cGUoY2hhbm5lbHMubGVuZ3RoID4gMCA/ICdzbGFjay1jaGFubmVsJyA6ICdub25lJylcbiAgICAgIHNldE1heENvbHVtbldpZHRoKHVuZGVmaW5lZClcbiAgICB9LFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSByZWFjdC1ob29rcy9leGhhdXN0aXZlLWRlcHMgLS0gc3RvcmUgaXMgYSBzdGFibGUgY29udGV4dCByZWZcbiAgICBbc2V0U3VnZ2VzdGlvbnNTdGF0ZV0sXG4gIClcblxuICAvLyBGaXJzdCBrZXlzdHJva2UgYWZ0ZXIgIyBuZWVkcyB0aGUgTUNQIHJvdW5kLXRyaXA7IHN1YnNlcXVlbnQga2V5c3Ryb2tlc1xuICAvLyB0aGF0IHNoYXJlIHRoZSBzYW1lIGZpcnN0LXdvcmQgc2VnbWVudCBoaXQgdGhlIGNhY2hlIHN5bmNocm9ub3VzbHkuXG4gIGNvbnN0IGRlYm91bmNlZEZldGNoU2xhY2tDaGFubmVscyA9IHVzZURlYm91bmNlQ2FsbGJhY2soXG4gICAgZmV0Y2hTbGFja0NoYW5uZWxzLFxuICAgIDE1MCxcbiAgKVxuXG4gIC8vIEhhbmRsZSBpbW1lZGlhdGUgc3VnZ2VzdGlvbiBsb2dpYyAoY2hlYXAgb3BlcmF0aW9ucylcbiAgLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlRXhoYXVzdGl2ZURlcGVuZGVuY2llczogc3RvcmUgaXMgYSBzdGFibGUgY29udGV4dCByZWYsIHJlYWQgaW1wZXJhdGl2ZWx5IGF0IGNhbGwtdGltZVxuICBjb25zdCB1cGRhdGVTdWdnZXN0aW9ucyA9IHVzZUNhbGxiYWNrKFxuICAgIGFzeW5jICh2YWx1ZTogc3RyaW5nLCBpbnB1dEN1cnNvck9mZnNldD86IG51bWJlcik6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgLy8gVXNlIHByb3ZpZGVkIGN1cnNvciBvZmZzZXQgb3IgZmFsbCBiYWNrIHRvIHJlZiAoYXZvaWRzIGRlcGVuZGVuY3kgb24gY3Vyc29yT2Zmc2V0KVxuICAgICAgY29uc3QgZWZmZWN0aXZlQ3Vyc29yT2Zmc2V0ID0gaW5wdXRDdXJzb3JPZmZzZXQgPz8gY3Vyc29yT2Zmc2V0UmVmLmN1cnJlbnRcbiAgICAgIGlmIChzdXBwcmVzc1N1Z2dlc3Rpb25zKSB7XG4gICAgICAgIGRlYm91bmNlZEZldGNoRmlsZVN1Z2dlc3Rpb25zLmNhbmNlbCgpXG4gICAgICAgIGNsZWFyU3VnZ2VzdGlvbnMoKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgZm9yIG1pZC1pbnB1dCBzbGFzaCBjb21tYW5kIChlLmcuLCBcImhlbHAgbWUgL2NvbVwiKVxuICAgICAgLy8gT25seSBpbiBwcm9tcHQgbW9kZSwgbm90IHdoZW4gaW5wdXQgc3RhcnRzIHdpdGggXCIvXCIgKGhhbmRsZWQgc2VwYXJhdGVseSlcbiAgICAgIC8vIE5vdGU6IGdob3N0IHRleHQgZm9yIHByb21wdCBtb2RlIGlzIGNvbXB1dGVkIHN5bmNocm9ub3VzbHkgdmlhIHN5bmNQcm9tcHRHaG9zdFRleHQgdXNlTWVtby5cbiAgICAgIC8vIFdlIG9ubHkgbmVlZCB0byBjbGVhciBkcm9wZG93biBzdWdnZXN0aW9ucyBoZXJlIHdoZW4gZ2hvc3QgdGV4dCBpcyBhY3RpdmUuXG4gICAgICBpZiAobW9kZSA9PT0gJ3Byb21wdCcpIHtcbiAgICAgICAgY29uc3QgbWlkSW5wdXRDb21tYW5kID0gZmluZE1pZElucHV0U2xhc2hDb21tYW5kKFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIGVmZmVjdGl2ZUN1cnNvck9mZnNldCxcbiAgICAgICAgKVxuICAgICAgICBpZiAobWlkSW5wdXRDb21tYW5kKSB7XG4gICAgICAgICAgY29uc3QgbWF0Y2ggPSBnZXRCZXN0Q29tbWFuZE1hdGNoKFxuICAgICAgICAgICAgbWlkSW5wdXRDb21tYW5kLnBhcnRpYWxDb21tYW5kLFxuICAgICAgICAgICAgY29tbWFuZHMsXG4gICAgICAgICAgKVxuICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgLy8gQ2xlYXIgZHJvcGRvd24gc3VnZ2VzdGlvbnMgd2hlbiBzaG93aW5nIGdob3N0IHRleHRcbiAgICAgICAgICAgIHNldFN1Z2dlc3Rpb25zU3RhdGUoKCkgPT4gKHtcbiAgICAgICAgICAgICAgY29tbWFuZEFyZ3VtZW50SGludDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICBzdWdnZXN0aW9uczogW10sXG4gICAgICAgICAgICAgIHNlbGVjdGVkU3VnZ2VzdGlvbjogLTEsXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIHNldFN1Z2dlc3Rpb25UeXBlKCdub25lJylcbiAgICAgICAgICAgIHNldE1heENvbHVtbldpZHRoKHVuZGVmaW5lZClcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBCYXNoIG1vZGU6IGNoZWNrIGZvciBoaXN0b3J5LWJhc2VkIGdob3N0IHRleHQgY29tcGxldGlvblxuICAgICAgaWYgKG1vZGUgPT09ICdiYXNoJyAmJiB2YWx1ZS50cmltKCkpIHtcbiAgICAgICAgbGF0ZXN0QmFzaElucHV0UmVmLmN1cnJlbnQgPSB2YWx1ZVxuICAgICAgICBjb25zdCBoaXN0b3J5TWF0Y2ggPSBhd2FpdCBnZXRTaGVsbEhpc3RvcnlDb21wbGV0aW9uKHZhbHVlKVxuICAgICAgICAvLyBEaXNjYXJkIHN0YWxlIHJlc3VsdHMgaWYgaW5wdXQgY2hhbmdlZCB3aGlsZSB3YWl0aW5nXG4gICAgICAgIGlmIChsYXRlc3RCYXNoSW5wdXRSZWYuY3VycmVudCAhPT0gdmFsdWUpIHtcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBpZiAoaGlzdG9yeU1hdGNoKSB7XG4gICAgICAgICAgc2V0SW5saW5lR2hvc3RUZXh0KHtcbiAgICAgICAgICAgIHRleHQ6IGhpc3RvcnlNYXRjaC5zdWZmaXgsXG4gICAgICAgICAgICBmdWxsQ29tbWFuZDogaGlzdG9yeU1hdGNoLmZ1bGxDb21tYW5kLFxuICAgICAgICAgICAgaW5zZXJ0UG9zaXRpb246IHZhbHVlLmxlbmd0aCxcbiAgICAgICAgICB9KVxuICAgICAgICAgIC8vIENsZWFyIGRyb3Bkb3duIHN1Z2dlc3Rpb25zIHdoZW4gc2hvd2luZyBnaG9zdCB0ZXh0XG4gICAgICAgICAgc2V0U3VnZ2VzdGlvbnNTdGF0ZSgoKSA9PiAoe1xuICAgICAgICAgICAgY29tbWFuZEFyZ3VtZW50SGludDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IFtdLFxuICAgICAgICAgICAgc2VsZWN0ZWRTdWdnZXN0aW9uOiAtMSxcbiAgICAgICAgICB9KSlcbiAgICAgICAgICBzZXRTdWdnZXN0aW9uVHlwZSgnbm9uZScpXG4gICAgICAgICAgc2V0TWF4Q29sdW1uV2lkdGgodW5kZWZpbmVkKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE5vIGhpc3RvcnkgbWF0Y2gsIGNsZWFyIGdob3N0IHRleHRcbiAgICAgICAgICBzZXRJbmxpbmVHaG9zdFRleHQodW5kZWZpbmVkKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIGZvciBAIHRvIHRyaWdnZXIgdGVhbSBtZW1iZXIgLyBuYW1lZCBzdWJhZ2VudCBzdWdnZXN0aW9uc1xuICAgICAgLy8gTXVzdCBjaGVjayBiZWZvcmUgQCBmaWxlIHN5bWJvbCB0byBwcmV2ZW50IGNvbmZsaWN0XG4gICAgICAvLyBTa2lwIGluIGJhc2ggbW9kZSAtIEAgaGFzIG5vIHNwZWNpYWwgbWVhbmluZyBpbiBzaGVsbCBjb21tYW5kc1xuICAgICAgY29uc3QgYXRNYXRjaCA9XG4gICAgICAgIG1vZGUgIT09ICdiYXNoJ1xuICAgICAgICAgID8gdmFsdWUuc3Vic3RyaW5nKDAsIGVmZmVjdGl2ZUN1cnNvck9mZnNldCkubWF0Y2goLyhefFxccylAKFtcXHctXSopJC8pXG4gICAgICAgICAgOiBudWxsXG4gICAgICBpZiAoYXRNYXRjaCkge1xuICAgICAgICBjb25zdCBwYXJ0aWFsTmFtZSA9IChhdE1hdGNoWzJdID8/ICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIC8vIEltcGVyYXRpdmUgcmVhZCDigJQgcmVhZGluZyBhdCBjYWxsLXRpbWUgZml4ZXMgc3RhbGVuZXNzIGZvclxuICAgICAgICAvLyB0ZWFtbWF0ZXMvc3ViYWdlbnRzIGFkZGVkIG1pZC1zZXNzaW9uLlxuICAgICAgICBjb25zdCBzdGF0ZSA9IHN0b3JlLmdldFN0YXRlKClcbiAgICAgICAgY29uc3QgbWVtYmVyczogU3VnZ2VzdGlvbkl0ZW1bXSA9IFtdXG4gICAgICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKVxuXG4gICAgICAgIGlmIChpc0FnZW50U3dhcm1zRW5hYmxlZCgpICYmIHN0YXRlLnRlYW1Db250ZXh0KSB7XG4gICAgICAgICAgZm9yIChjb25zdCB0IG9mIE9iamVjdC52YWx1ZXMoc3RhdGUudGVhbUNvbnRleHQudGVhbW1hdGVzID8/IHt9KSkge1xuICAgICAgICAgICAgaWYgKHQubmFtZSA9PT0gVEVBTV9MRUFEX05BTUUpIGNvbnRpbnVlXG4gICAgICAgICAgICBpZiAoIXQubmFtZS50b0xvd2VyQ2FzZSgpLnN0YXJ0c1dpdGgocGFydGlhbE5hbWUpKSBjb250aW51ZVxuICAgICAgICAgICAgc2Vlbi5hZGQodC5uYW1lKVxuICAgICAgICAgICAgbWVtYmVycy5wdXNoKHtcbiAgICAgICAgICAgICAgaWQ6IGBkbS0ke3QubmFtZX1gLFxuICAgICAgICAgICAgICBkaXNwbGF5VGV4dDogYEAke3QubmFtZX1gLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ3NlbmQgbWVzc2FnZScsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgW25hbWUsIGFnZW50SWRdIG9mIHN0YXRlLmFnZW50TmFtZVJlZ2lzdHJ5KSB7XG4gICAgICAgICAgaWYgKHNlZW4uaGFzKG5hbWUpKSBjb250aW51ZVxuICAgICAgICAgIGlmICghbmFtZS50b0xvd2VyQ2FzZSgpLnN0YXJ0c1dpdGgocGFydGlhbE5hbWUpKSBjb250aW51ZVxuICAgICAgICAgIGNvbnN0IHN0YXR1cyA9IHN0YXRlLnRhc2tzW2FnZW50SWRdPy5zdGF0dXNcbiAgICAgICAgICBtZW1iZXJzLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGBkbS0ke25hbWV9YCxcbiAgICAgICAgICAgIGRpc3BsYXlUZXh0OiBgQCR7bmFtZX1gLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IHN0YXR1cyA/IGBzZW5kIG1lc3NhZ2UgwrcgJHtzdGF0dXN9YCA6ICdzZW5kIG1lc3NhZ2UnLFxuICAgICAgICAgIH0pXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWVtYmVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgZGVib3VuY2VkRmV0Y2hGaWxlU3VnZ2VzdGlvbnMuY2FuY2VsKClcbiAgICAgICAgICBzZXRTdWdnZXN0aW9uc1N0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAgIGNvbW1hbmRBcmd1bWVudEhpbnQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiBtZW1iZXJzLFxuICAgICAgICAgICAgc2VsZWN0ZWRTdWdnZXN0aW9uOiBnZXRQcmVzZXJ2ZWRTZWxlY3Rpb24oXG4gICAgICAgICAgICAgIHByZXYuc3VnZ2VzdGlvbnMsXG4gICAgICAgICAgICAgIHByZXYuc2VsZWN0ZWRTdWdnZXN0aW9uLFxuICAgICAgICAgICAgICBtZW1iZXJzLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB9KSlcbiAgICAgICAgICBzZXRTdWdnZXN0aW9uVHlwZSgnYWdlbnQnKVxuICAgICAgICAgIHNldE1heENvbHVtbldpZHRoKHVuZGVmaW5lZClcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBDaGVjayBmb3IgIyB0byB0cmlnZ2VyIFNsYWNrIGNoYW5uZWwgc3VnZ2VzdGlvbnMgKHJlcXVpcmVzIFNsYWNrIE1DUCBzZXJ2ZXIpXG4gICAgICBpZiAobW9kZSA9PT0gJ3Byb21wdCcpIHtcbiAgICAgICAgY29uc3QgaGFzaE1hdGNoID0gdmFsdWVcbiAgICAgICAgICAuc3Vic3RyaW5nKDAsIGVmZmVjdGl2ZUN1cnNvck9mZnNldClcbiAgICAgICAgICAubWF0Y2goSEFTSF9DSEFOTkVMX1JFKVxuICAgICAgICBpZiAoaGFzaE1hdGNoICYmIGhhc1NsYWNrTWNwU2VydmVyKHN0b3JlLmdldFN0YXRlKCkubWNwLmNsaWVudHMpKSB7XG4gICAgICAgICAgZGVib3VuY2VkRmV0Y2hTbGFja0NoYW5uZWxzKGhhc2hNYXRjaFsyXSEpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH0gZWxzZSBpZiAoc3VnZ2VzdGlvblR5cGUgPT09ICdzbGFjay1jaGFubmVsJykge1xuICAgICAgICAgIGRlYm91bmNlZEZldGNoU2xhY2tDaGFubmVscy5jYW5jZWwoKVxuICAgICAgICAgIGNsZWFyU3VnZ2VzdGlvbnMoKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIGZvciBAIHN5bWJvbCB0byB0cmlnZ2VyIGZpbGUgc3VnZ2VzdGlvbnMgKGluY2x1ZGluZyBxdW90ZWQgcGF0aHMpXG4gICAgICAvLyBJbmNsdWRlcyBjb2xvbiBmb3IgTUNQIHJlc291cmNlcyAoZS5nLiwgc2VydmVyOnJlc291cmNlL3BhdGgpXG4gICAgICBjb25zdCBoYXNBdFN5bWJvbCA9IHZhbHVlXG4gICAgICAgIC5zdWJzdHJpbmcoMCwgZWZmZWN0aXZlQ3Vyc29yT2Zmc2V0KVxuICAgICAgICAubWF0Y2goSEFTX0FUX1NZTUJPTF9SRSlcblxuICAgICAgLy8gRmlyc3QsIGNoZWNrIGZvciBzbGFzaCBjb21tYW5kIHN1Z2dlc3Rpb25zIChoaWdoZXIgcHJpb3JpdHkgdGhhbiBAIHN5bWJvbClcbiAgICAgIC8vIE9ubHkgc2hvdyBzbGFzaCBjb21tYW5kIHNlbGVjdG9yIGlmIGN1cnNvciBpcyBub3Qgb24gdGhlIFwiL1wiIGNoYXJhY3RlciBpdHNlbGZcbiAgICAgIC8vIEFsc28gZG9uJ3Qgc2hvdyBpZiBjdXJzb3IgaXMgYXQgZW5kIG9mIGxpbmUgd2l0aCB3aGl0ZXNwYWNlIGJlZm9yZSBpdFxuICAgICAgLy8gRG9uJ3Qgc2hvdyBzbGFzaCBjb21tYW5kcyBpbiBiYXNoIG1vZGVcbiAgICAgIGNvbnN0IGlzQXRFbmRXaXRoV2hpdGVzcGFjZSA9XG4gICAgICAgIGVmZmVjdGl2ZUN1cnNvck9mZnNldCA9PT0gdmFsdWUubGVuZ3RoICYmXG4gICAgICAgIGVmZmVjdGl2ZUN1cnNvck9mZnNldCA+IDAgJiZcbiAgICAgICAgdmFsdWUubGVuZ3RoID4gMCAmJlxuICAgICAgICB2YWx1ZVtlZmZlY3RpdmVDdXJzb3JPZmZzZXQgLSAxXSA9PT0gJyAnXG5cbiAgICAgIC8vIEhhbmRsZSBkaXJlY3RvcnkgY29tcGxldGlvbiBmb3IgY29tbWFuZHNcbiAgICAgIGlmIChcbiAgICAgICAgbW9kZSA9PT0gJ3Byb21wdCcgJiZcbiAgICAgICAgaXNDb21tYW5kSW5wdXQodmFsdWUpICYmXG4gICAgICAgIGVmZmVjdGl2ZUN1cnNvck9mZnNldCA+IDBcbiAgICAgICkge1xuICAgICAgICBjb25zdCBwYXJzZWRDb21tYW5kID0gZXh0cmFjdENvbW1hbmROYW1lQW5kQXJncyh2YWx1ZSlcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgcGFyc2VkQ29tbWFuZCAmJlxuICAgICAgICAgIHBhcnNlZENvbW1hbmQuY29tbWFuZE5hbWUgPT09ICdhZGQtZGlyJyAmJlxuICAgICAgICAgIHBhcnNlZENvbW1hbmQuYXJnc1xuICAgICAgICApIHtcbiAgICAgICAgICBjb25zdCB7IGFyZ3MgfSA9IHBhcnNlZENvbW1hbmRcblxuICAgICAgICAgIC8vIENsZWFyIHN1Z2dlc3Rpb25zIGlmIGFyZ3MgZW5kIHdpdGggd2hpdGVzcGFjZSAodXNlciBpcyBkb25lIHdpdGggcGF0aClcbiAgICAgICAgICBpZiAoYXJncy5tYXRjaCgvXFxzKyQvKSkge1xuICAgICAgICAgICAgZGVib3VuY2VkRmV0Y2hGaWxlU3VnZ2VzdGlvbnMuY2FuY2VsKClcbiAgICAgICAgICAgIGNsZWFyU3VnZ2VzdGlvbnMoKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZGlyU3VnZ2VzdGlvbnMgPSBhd2FpdCBnZXREaXJlY3RvcnlDb21wbGV0aW9ucyhhcmdzKVxuICAgICAgICAgIGlmIChkaXJTdWdnZXN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBzZXRTdWdnZXN0aW9uc1N0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IGRpclN1Z2dlc3Rpb25zLFxuICAgICAgICAgICAgICBzZWxlY3RlZFN1Z2dlc3Rpb246IGdldFByZXNlcnZlZFNlbGVjdGlvbihcbiAgICAgICAgICAgICAgICBwcmV2LnN1Z2dlc3Rpb25zLFxuICAgICAgICAgICAgICAgIHByZXYuc2VsZWN0ZWRTdWdnZXN0aW9uLFxuICAgICAgICAgICAgICAgIGRpclN1Z2dlc3Rpb25zLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICBjb21tYW5kQXJndW1lbnRIaW50OiB1bmRlZmluZWQsXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIHNldFN1Z2dlc3Rpb25UeXBlKCdkaXJlY3RvcnknKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm8gc3VnZ2VzdGlvbnMgZm91bmQgLSBjbGVhciBhbmQgcmV0dXJuXG4gICAgICAgICAgZGVib3VuY2VkRmV0Y2hGaWxlU3VnZ2VzdGlvbnMuY2FuY2VsKClcbiAgICAgICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEhhbmRsZSBjdXN0b20gdGl0bGUgY29tcGxldGlvbiBmb3IgL3Jlc3VtZSBjb21tYW5kXG4gICAgICAgIGlmIChcbiAgICAgICAgICBwYXJzZWRDb21tYW5kICYmXG4gICAgICAgICAgcGFyc2VkQ29tbWFuZC5jb21tYW5kTmFtZSA9PT0gJ3Jlc3VtZScgJiZcbiAgICAgICAgICBwYXJzZWRDb21tYW5kLmFyZ3MgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgIHZhbHVlLmluY2x1ZGVzKCcgJylcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc3QgeyBhcmdzIH0gPSBwYXJzZWRDb21tYW5kXG5cbiAgICAgICAgICAvLyBHZXQgY3VzdG9tIHRpdGxlIHN1Z2dlc3Rpb25zIHVzaW5nIHBhcnRpYWwgbWF0Y2hcbiAgICAgICAgICBjb25zdCBtYXRjaGVzID0gYXdhaXQgc2VhcmNoU2Vzc2lvbnNCeUN1c3RvbVRpdGxlKGFyZ3MsIHtcbiAgICAgICAgICAgIGxpbWl0OiAxMCxcbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgY29uc3Qgc3VnZ2VzdGlvbnMgPSBtYXRjaGVzLm1hcChsb2cgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbklkID0gZ2V0U2Vzc2lvbklkRnJvbUxvZyhsb2cpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBpZDogYHJlc3VtZS10aXRsZS0ke3Nlc3Npb25JZH1gLFxuICAgICAgICAgICAgICBkaXNwbGF5VGV4dDogbG9nLmN1c3RvbVRpdGxlISxcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGZvcm1hdExvZ01ldGFkYXRhKGxvZyksXG4gICAgICAgICAgICAgIG1ldGFkYXRhOiB7IHNlc3Npb25JZCB9LFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICBpZiAoc3VnZ2VzdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgc2V0U3VnZ2VzdGlvbnNTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgIHN1Z2dlc3Rpb25zLFxuICAgICAgICAgICAgICBzZWxlY3RlZFN1Z2dlc3Rpb246IGdldFByZXNlcnZlZFNlbGVjdGlvbihcbiAgICAgICAgICAgICAgICBwcmV2LnN1Z2dlc3Rpb25zLFxuICAgICAgICAgICAgICAgIHByZXYuc2VsZWN0ZWRTdWdnZXN0aW9uLFxuICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICBjb21tYW5kQXJndW1lbnRIaW50OiB1bmRlZmluZWQsXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIHNldFN1Z2dlc3Rpb25UeXBlKCdjdXN0b20tdGl0bGUnKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm8gc3VnZ2VzdGlvbnMgZm91bmQgLSBjbGVhciBhbmQgcmV0dXJuXG4gICAgICAgICAgY2xlYXJTdWdnZXN0aW9ucygpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRGV0ZXJtaW5lIHdoZXRoZXIgdG8gZGlzcGxheSB0aGUgYXJndW1lbnQgaGludCBhbmQgY29tbWFuZCBzdWdnZXN0aW9ucy5cbiAgICAgIGlmIChcbiAgICAgICAgbW9kZSA9PT0gJ3Byb21wdCcgJiZcbiAgICAgICAgaXNDb21tYW5kSW5wdXQodmFsdWUpICYmXG4gICAgICAgIGVmZmVjdGl2ZUN1cnNvck9mZnNldCA+IDAgJiZcbiAgICAgICAgIWhhc0NvbW1hbmRXaXRoQXJndW1lbnRzKGlzQXRFbmRXaXRoV2hpdGVzcGFjZSwgdmFsdWUpXG4gICAgICApIHtcbiAgICAgICAgbGV0IGNvbW1hbmRBcmd1bWVudEhpbnQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuICAgICAgICBpZiAodmFsdWUubGVuZ3RoID4gMSkge1xuICAgICAgICAgIC8vIFdlIGhhdmUgYSBwYXJ0aWFsIG9yIGNvbXBsZXRlIGNvbW1hbmQgd2l0aG91dCBhcmd1bWVudHNcbiAgICAgICAgICAvLyBDaGVjayBpZiBpdCBtYXRjaGVzIGEgY29tbWFuZCBleGFjdGx5IGFuZCBoYXMgYW4gYXJndW1lbnQgaGludFxuXG4gICAgICAgICAgLy8gRXh0cmFjdCBjb21tYW5kIG5hbWU6IGV2ZXJ5dGhpbmcgYWZ0ZXIgLyB1bnRpbCB0aGUgZmlyc3Qgc3BhY2UgKG9yIGVuZClcbiAgICAgICAgICBjb25zdCBzcGFjZUluZGV4ID0gdmFsdWUuaW5kZXhPZignICcpXG4gICAgICAgICAgY29uc3QgY29tbWFuZE5hbWUgPVxuICAgICAgICAgICAgc3BhY2VJbmRleCA9PT0gLTEgPyB2YWx1ZS5zbGljZSgxKSA6IHZhbHVlLnNsaWNlKDEsIHNwYWNlSW5kZXgpXG5cbiAgICAgICAgICAvLyBDaGVjayBpZiB0aGVyZSBhcmUgcmVhbCBhcmd1bWVudHMgKG5vbi13aGl0ZXNwYWNlIGFmdGVyIHRoZSBjb21tYW5kKVxuICAgICAgICAgIGNvbnN0IGhhc1JlYWxBcmd1bWVudHMgPVxuICAgICAgICAgICAgc3BhY2VJbmRleCAhPT0gLTEgJiYgdmFsdWUuc2xpY2Uoc3BhY2VJbmRleCArIDEpLnRyaW0oKS5sZW5ndGggPiAwXG5cbiAgICAgICAgICAvLyBDaGVjayBpZiBpbnB1dCBpcyBleGFjdGx5IFwiY29tbWFuZCArIHNpbmdsZSBzcGFjZVwiIChyZWFkeSBmb3IgYXJndW1lbnRzKVxuICAgICAgICAgIGNvbnN0IGhhc0V4YWN0bHlPbmVUcmFpbGluZ1NwYWNlID1cbiAgICAgICAgICAgIHNwYWNlSW5kZXggIT09IC0xICYmIHZhbHVlLmxlbmd0aCA9PT0gc3BhY2VJbmRleCArIDFcblxuICAgICAgICAgIC8vIElmIGlucHV0IGhhcyBhIHNwYWNlIGFmdGVyIHRoZSBjb21tYW5kLCBkb24ndCBzaG93IHN1Z2dlc3Rpb25zXG4gICAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBFbnRlciBmcm9tIHNlbGVjdGluZyBhIGRpZmZlcmVudCBjb21tYW5kIGFmdGVyIFRhYiBjb21wbGV0aW9uXG4gICAgICAgICAgaWYgKHNwYWNlSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICBjb25zdCBleGFjdE1hdGNoID0gY29tbWFuZHMuZmluZChcbiAgICAgICAgICAgICAgY21kID0+IGdldENvbW1hbmROYW1lKGNtZCkgPT09IGNvbW1hbmROYW1lLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgaWYgKGV4YWN0TWF0Y2ggfHwgaGFzUmVhbEFyZ3VtZW50cykge1xuICAgICAgICAgICAgICAvLyBQcmlvcml0eSAxOiBTdGF0aWMgYXJndW1lbnRIaW50IChvbmx5IG9uIGZpcnN0IHRyYWlsaW5nIHNwYWNlIGZvciBiYWNrd2FyZHMgY29tcGF0KVxuICAgICAgICAgICAgICBpZiAoZXhhY3RNYXRjaD8uYXJndW1lbnRIaW50ICYmIGhhc0V4YWN0bHlPbmVUcmFpbGluZ1NwYWNlKSB7XG4gICAgICAgICAgICAgICAgY29tbWFuZEFyZ3VtZW50SGludCA9IGV4YWN0TWF0Y2guYXJndW1lbnRIaW50XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gUHJpb3JpdHkgMjogUHJvZ3Jlc3NpdmUgaGludCBmcm9tIGFyZ05hbWVzIChzaG93IHdoZW4gdHJhaWxpbmcgc3BhY2UpXG4gICAgICAgICAgICAgIGVsc2UgaWYgKFxuICAgICAgICAgICAgICAgIGV4YWN0TWF0Y2g/LnR5cGUgPT09ICdwcm9tcHQnICYmXG4gICAgICAgICAgICAgICAgZXhhY3RNYXRjaC5hcmdOYW1lcz8ubGVuZ3RoICYmXG4gICAgICAgICAgICAgICAgdmFsdWUuZW5kc1dpdGgoJyAnKVxuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhcmdzVGV4dCA9IHZhbHVlLnNsaWNlKHNwYWNlSW5kZXggKyAxKVxuICAgICAgICAgICAgICAgIGNvbnN0IHR5cGVkQXJncyA9IHBhcnNlQXJndW1lbnRzKGFyZ3NUZXh0KVxuICAgICAgICAgICAgICAgIGNvbW1hbmRBcmd1bWVudEhpbnQgPSBnZW5lcmF0ZVByb2dyZXNzaXZlQXJndW1lbnRIaW50KFxuICAgICAgICAgICAgICAgICAgZXhhY3RNYXRjaC5hcmdOYW1lcyxcbiAgICAgICAgICAgICAgICAgIHR5cGVkQXJncyxcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgc2V0U3VnZ2VzdGlvbnNTdGF0ZSgoKSA9PiAoe1xuICAgICAgICAgICAgICAgIGNvbW1hbmRBcmd1bWVudEhpbnQsXG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IFtdLFxuICAgICAgICAgICAgICAgIHNlbGVjdGVkU3VnZ2VzdGlvbjogLTEsXG4gICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICBzZXRTdWdnZXN0aW9uVHlwZSgnbm9uZScpXG4gICAgICAgICAgICAgIHNldE1heENvbHVtbldpZHRoKHVuZGVmaW5lZClcbiAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm90ZTogYXJndW1lbnQgaGludCBpcyBvbmx5IHNob3duIHdoZW4gdGhlcmUncyBleGFjdGx5IG9uZSB0cmFpbGluZyBzcGFjZVxuICAgICAgICAgIC8vIChzZXQgYWJvdmUgd2hlbiBoYXNFeGFjdGx5T25lVHJhaWxpbmdTcGFjZSBpcyB0cnVlKVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29tbWFuZEl0ZW1zID0gZ2VuZXJhdGVDb21tYW5kU3VnZ2VzdGlvbnModmFsdWUsIGNvbW1hbmRzKVxuICAgICAgICBzZXRTdWdnZXN0aW9uc1N0YXRlKCgpID0+ICh7XG4gICAgICAgICAgY29tbWFuZEFyZ3VtZW50SGludCxcbiAgICAgICAgICBzdWdnZXN0aW9uczogY29tbWFuZEl0ZW1zLFxuICAgICAgICAgIHNlbGVjdGVkU3VnZ2VzdGlvbjogY29tbWFuZEl0ZW1zLmxlbmd0aCA+IDAgPyAwIDogLTEsXG4gICAgICAgIH0pKVxuICAgICAgICBzZXRTdWdnZXN0aW9uVHlwZShjb21tYW5kSXRlbXMubGVuZ3RoID4gMCA/ICdjb21tYW5kJyA6ICdub25lJylcblxuICAgICAgICAvLyBVc2Ugc3RhYmxlIHdpZHRoIGZyb20gYWxsIGNvbW1hbmRzIChwcmV2ZW50cyBsYXlvdXQgc2hpZnQgd2hlbiBmaWx0ZXJpbmcpXG4gICAgICAgIGlmIChjb21tYW5kSXRlbXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHNldE1heENvbHVtbldpZHRoKGFsbENvbW1hbmRzTWF4V2lkdGgpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGlmIChzdWdnZXN0aW9uVHlwZSA9PT0gJ2NvbW1hbmQnKSB7XG4gICAgICAgIC8vIElmIHdlIGhhZCBjb21tYW5kIHN1Z2dlc3Rpb25zIGJ1dCB0aGUgaW5wdXQgbm8gbG9uZ2VyIHN0YXJ0cyB3aXRoICcvJ1xuICAgICAgICAvLyB3ZSBuZWVkIHRvIGNsZWFyIHRoZSBzdWdnZXN0aW9ucy4gSG93ZXZlciwgd2Ugc2hvdWxkIG5vdCByZXR1cm5cbiAgICAgICAgLy8gYmVjYXVzZSB0aGVyZSBtYXkgYmUgcmVsZXZhbnQgQCBzeW1ib2wgYW5kIGZpbGUgc3VnZ2VzdGlvbnMuXG4gICAgICAgIGRlYm91bmNlZEZldGNoRmlsZVN1Z2dlc3Rpb25zLmNhbmNlbCgpXG4gICAgICAgIGNsZWFyU3VnZ2VzdGlvbnMoKVxuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgaXNDb21tYW5kSW5wdXQodmFsdWUpICYmXG4gICAgICAgIGhhc0NvbW1hbmRXaXRoQXJndW1lbnRzKGlzQXRFbmRXaXRoV2hpdGVzcGFjZSwgdmFsdWUpXG4gICAgICApIHtcbiAgICAgICAgLy8gSWYgd2UgaGF2ZSBhIGNvbW1hbmQgd2l0aCBhcmd1bWVudHMgKG5vIHRyYWlsaW5nIHNwYWNlKSwgY2xlYXIgYW55IHN0YWxlIGhpbnRcbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyB0aGUgaGludCBmcm9tIGZsYXNoaW5nIHdoZW4gdHJhbnNpdGlvbmluZyBiZXR3ZWVuIHN0YXRlc1xuICAgICAgICBzZXRTdWdnZXN0aW9uc1N0YXRlKHByZXYgPT5cbiAgICAgICAgICBwcmV2LmNvbW1hbmRBcmd1bWVudEhpbnRcbiAgICAgICAgICAgID8geyAuLi5wcmV2LCBjb21tYW5kQXJndW1lbnRIaW50OiB1bmRlZmluZWQgfVxuICAgICAgICAgICAgOiBwcmV2LFxuICAgICAgICApXG4gICAgICB9XG5cbiAgICAgIGlmIChzdWdnZXN0aW9uVHlwZSA9PT0gJ2N1c3RvbS10aXRsZScpIHtcbiAgICAgICAgLy8gSWYgd2UgaGFkIGN1c3RvbS10aXRsZSBzdWdnZXN0aW9ucyBidXQgdGhlIGlucHV0IGlzIG5vIGxvbmdlciAvcmVzdW1lXG4gICAgICAgIC8vIHdlIG5lZWQgdG8gY2xlYXIgdGhlIHN1Z2dlc3Rpb25zLlxuICAgICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBzdWdnZXN0aW9uVHlwZSA9PT0gJ2FnZW50JyAmJlxuICAgICAgICBzdWdnZXN0aW9uc1JlZi5jdXJyZW50LnNvbWUoKHM6IFN1Z2dlc3Rpb25JdGVtKSA9PlxuICAgICAgICAgIHMuaWQ/LnN0YXJ0c1dpdGgoJ2RtLScpLFxuICAgICAgICApXG4gICAgICApIHtcbiAgICAgICAgLy8gSWYgd2UgaGFkIHRlYW0gbWVtYmVyIHN1Z2dlc3Rpb25zIGJ1dCB0aGUgaW5wdXQgbm8gbG9uZ2VyIGhhcyBAXG4gICAgICAgIC8vIHdlIG5lZWQgdG8gY2xlYXIgdGhlIHN1Z2dlc3Rpb25zLlxuICAgICAgICBjb25zdCBoYXNBdCA9IHZhbHVlXG4gICAgICAgICAgLnN1YnN0cmluZygwLCBlZmZlY3RpdmVDdXJzb3JPZmZzZXQpXG4gICAgICAgICAgLm1hdGNoKC8oXnxcXHMpQChbXFx3LV0qKSQvKVxuICAgICAgICBpZiAoIWhhc0F0KSB7XG4gICAgICAgICAgY2xlYXJTdWdnZXN0aW9ucygpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgZm9yIEAgc3ltYm9sIHRvIHRyaWdnZXIgZmlsZSBhbmQgTUNQIHJlc291cmNlIHN1Z2dlc3Rpb25zXG4gICAgICAvLyBTa2lwIEAgYXV0b2NvbXBsZXRlIGluIGJhc2ggbW9kZSAtIEAgaGFzIG5vIHNwZWNpYWwgbWVhbmluZyBpbiBzaGVsbCBjb21tYW5kc1xuICAgICAgaWYgKGhhc0F0U3ltYm9sICYmIG1vZGUgIT09ICdiYXNoJykge1xuICAgICAgICAvLyBHZXQgdGhlIEAgdG9rZW4gKGluY2x1ZGluZyB0aGUgQCBzeW1ib2wpXG4gICAgICAgIGNvbnN0IGNvbXBsZXRpb25Ub2tlbiA9IGV4dHJhY3RDb21wbGV0aW9uVG9rZW4oXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgZWZmZWN0aXZlQ3Vyc29yT2Zmc2V0LFxuICAgICAgICAgIHRydWUsXG4gICAgICAgIClcbiAgICAgICAgaWYgKGNvbXBsZXRpb25Ub2tlbiAmJiBjb21wbGV0aW9uVG9rZW4udG9rZW4uc3RhcnRzV2l0aCgnQCcpKSB7XG4gICAgICAgICAgY29uc3Qgc2VhcmNoVG9rZW4gPSBleHRyYWN0U2VhcmNoVG9rZW4oY29tcGxldGlvblRva2VuKVxuXG4gICAgICAgICAgLy8gSWYgdGhlIHRva2VuIGFmdGVyIEAgaXMgcGF0aC1saWtlLCB1c2UgcGF0aCBjb21wbGV0aW9uIGluc3RlYWQgb2YgZnV6enkgc2VhcmNoXG4gICAgICAgICAgLy8gVGhpcyBoYW5kbGVzIGNhc2VzIGxpa2UgQH4vcGF0aCwgQC4vcGF0aCwgQC9wYXRoIGZvciBkaXJlY3RvcnkgdHJhdmVyc2FsXG4gICAgICAgICAgaWYgKGlzUGF0aExpa2VUb2tlbihzZWFyY2hUb2tlbikpIHtcbiAgICAgICAgICAgIGxhdGVzdFBhdGhUb2tlblJlZi5jdXJyZW50ID0gc2VhcmNoVG9rZW5cbiAgICAgICAgICAgIGNvbnN0IHBhdGhTdWdnZXN0aW9ucyA9IGF3YWl0IGdldFBhdGhDb21wbGV0aW9ucyhzZWFyY2hUb2tlbiwge1xuICAgICAgICAgICAgICBtYXhSZXN1bHRzOiAxMCxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAvLyBEaXNjYXJkIHN0YWxlIHJlc3VsdHMgaWYgYSBuZXdlciBxdWVyeSB3YXMgaW5pdGlhdGVkIHdoaWxlIHdhaXRpbmdcbiAgICAgICAgICAgIGlmIChsYXRlc3RQYXRoVG9rZW5SZWYuY3VycmVudCAhPT0gc2VhcmNoVG9rZW4pIHtcbiAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocGF0aFN1Z2dlc3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgc2V0U3VnZ2VzdGlvbnNTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IHBhdGhTdWdnZXN0aW9ucyxcbiAgICAgICAgICAgICAgICBzZWxlY3RlZFN1Z2dlc3Rpb246IGdldFByZXNlcnZlZFNlbGVjdGlvbihcbiAgICAgICAgICAgICAgICAgIHByZXYuc3VnZ2VzdGlvbnMsXG4gICAgICAgICAgICAgICAgICBwcmV2LnNlbGVjdGVkU3VnZ2VzdGlvbixcbiAgICAgICAgICAgICAgICAgIHBhdGhTdWdnZXN0aW9ucyxcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIGNvbW1hbmRBcmd1bWVudEhpbnQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgIHNldFN1Z2dlc3Rpb25UeXBlKCdkaXJlY3RvcnknKVxuICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTa2lwIGlmIHdlIGFscmVhZHkgZmV0Y2hlZCBmb3IgdGhpcyBleGFjdCB0b2tlbiAocHJldmVudHMgbG9vcCBmcm9tXG4gICAgICAgICAgLy8gc3VnZ2VzdGlvbnMgZGVwZW5kZW5jeSBjYXVzaW5nIHVwZGF0ZVN1Z2dlc3Rpb25zIHRvIGJlIHJlY3JlYXRlZClcbiAgICAgICAgICBpZiAobGF0ZXN0U2VhcmNoVG9rZW5SZWYuY3VycmVudCA9PT0gc2VhcmNoVG9rZW4pIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgICB2b2lkIGRlYm91bmNlZEZldGNoRmlsZVN1Z2dlc3Rpb25zKHNlYXJjaFRva2VuLCB0cnVlKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHdlIGhhdmUgYWN0aXZlIGZpbGUgc3VnZ2VzdGlvbnMgb3IgdGhlIGlucHV0IGNoYW5nZWQsIGNoZWNrIGZvciBmaWxlIHN1Z2dlc3Rpb25zXG4gICAgICBpZiAoc3VnZ2VzdGlvblR5cGUgPT09ICdmaWxlJykge1xuICAgICAgICBjb25zdCBjb21wbGV0aW9uVG9rZW4gPSBleHRyYWN0Q29tcGxldGlvblRva2VuKFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIGVmZmVjdGl2ZUN1cnNvck9mZnNldCxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICApXG4gICAgICAgIGlmIChjb21wbGV0aW9uVG9rZW4pIHtcbiAgICAgICAgICBjb25zdCBzZWFyY2hUb2tlbiA9IGV4dHJhY3RTZWFyY2hUb2tlbihjb21wbGV0aW9uVG9rZW4pXG4gICAgICAgICAgLy8gU2tpcCBpZiB3ZSBhbHJlYWR5IGZldGNoZWQgZm9yIHRoaXMgZXhhY3QgdG9rZW5cbiAgICAgICAgICBpZiAobGF0ZXN0U2VhcmNoVG9rZW5SZWYuY3VycmVudCA9PT0gc2VhcmNoVG9rZW4pIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgICB2b2lkIGRlYm91bmNlZEZldGNoRmlsZVN1Z2dlc3Rpb25zKHNlYXJjaFRva2VuLCBmYWxzZSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBJZiB3ZSBoYWQgZmlsZSBzdWdnZXN0aW9ucyBidXQgbm93IHRoZXJlJ3Mgbm8gY29tcGxldGlvbiB0b2tlblxuICAgICAgICAgIGRlYm91bmNlZEZldGNoRmlsZVN1Z2dlc3Rpb25zLmNhbmNlbCgpXG4gICAgICAgICAgY2xlYXJTdWdnZXN0aW9ucygpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQ2xlYXIgc2hlbGwgc3VnZ2VzdGlvbnMgaWYgbm90IGluIGJhc2ggbW9kZSBPUiBpZiBpbnB1dCBoYXMgY2hhbmdlZFxuICAgICAgaWYgKHN1Z2dlc3Rpb25UeXBlID09PSAnc2hlbGwnKSB7XG4gICAgICAgIGNvbnN0IGlucHV0U25hcHNob3QgPSAoXG4gICAgICAgICAgc3VnZ2VzdGlvbnNSZWYuY3VycmVudFswXT8ubWV0YWRhdGEgYXMgeyBpbnB1dFNuYXBzaG90Pzogc3RyaW5nIH1cbiAgICAgICAgKT8uaW5wdXRTbmFwc2hvdFxuXG4gICAgICAgIGlmIChtb2RlICE9PSAnYmFzaCcgfHwgdmFsdWUgIT09IGlucHV0U25hcHNob3QpIHtcbiAgICAgICAgICBkZWJvdW5jZWRGZXRjaEZpbGVTdWdnZXN0aW9ucy5jYW5jZWwoKVxuICAgICAgICAgIGNsZWFyU3VnZ2VzdGlvbnMoKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBbXG4gICAgICBzdWdnZXN0aW9uVHlwZSxcbiAgICAgIGNvbW1hbmRzLFxuICAgICAgc2V0U3VnZ2VzdGlvbnNTdGF0ZSxcbiAgICAgIGNsZWFyU3VnZ2VzdGlvbnMsXG4gICAgICBkZWJvdW5jZWRGZXRjaEZpbGVTdWdnZXN0aW9ucyxcbiAgICAgIGRlYm91bmNlZEZldGNoU2xhY2tDaGFubmVscyxcbiAgICAgIG1vZGUsXG4gICAgICBzdXBwcmVzc1N1Z2dlc3Rpb25zLFxuICAgICAgLy8gTm90ZTogdXNpbmcgc3VnZ2VzdGlvbnNSZWYgaW5zdGVhZCBvZiBzdWdnZXN0aW9ucyB0byBhdm9pZCByZWNyZWF0aW5nXG4gICAgICAvLyB0aGlzIGNhbGxiYWNrIHdoZW4gb25seSBzZWxlY3RlZFN1Z2dlc3Rpb24gY2hhbmdlcyAobm90IHRoZSBzdWdnZXN0aW9ucyBsaXN0KVxuICAgICAgYWxsQ29tbWFuZHNNYXhXaWR0aCxcbiAgICBdLFxuICApXG5cbiAgLy8gVXBkYXRlIHN1Z2dlc3Rpb25zIHdoZW4gaW5wdXQgY2hhbmdlc1xuICAvLyBOb3RlOiBXZSBpbnRlbnRpb25hbGx5IGRvbid0IGRlcGVuZCBvbiBjdXJzb3JPZmZzZXQgaGVyZSAtIGN1cnNvciBtb3ZlbWVudCBhbG9uZVxuICAvLyBzaG91bGRuJ3QgcmUtdHJpZ2dlciBzdWdnZXN0aW9ucy4gVGhlIGN1cnNvck9mZnNldFJlZiBpcyB1c2VkIHRvIGdldCB0aGUgY3VycmVudFxuICAvLyBwb3NpdGlvbiB3aGVuIG5lZWRlZCB3aXRob3V0IGNhdXNpbmcgcmUtcmVuZGVycy5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAvLyBJZiBzdWdnZXN0aW9ucyB3ZXJlIGRpc21pc3NlZCBmb3IgdGhpcyBleGFjdCBpbnB1dCwgZG9uJ3QgcmUtdHJpZ2dlclxuICAgIGlmIChkaXNtaXNzZWRGb3JJbnB1dFJlZi5jdXJyZW50ID09PSBpbnB1dCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIC8vIFdoZW4gdGhlIGFjdHVhbCBpbnB1dCB0ZXh0IGNoYW5nZXMgKG5vdCBqdXN0IHVwZGF0ZVN1Z2dlc3Rpb25zIGJlaW5nIHJlY3JlYXRlZCksXG4gICAgLy8gcmVzZXQgdGhlIHNlYXJjaCB0b2tlbiByZWYgc28gdGhlIHNhbWUgcXVlcnkgY2FuIGJlIHJlLWZldGNoZWQuXG4gICAgLy8gVGhpcyBmaXhlczogdHlwZSBAcmVhZG1lLm1kLCBjbGVhciwgcmV0eXBlIEByZWFkbWUubWQg4oaSIG5vIHN1Z2dlc3Rpb25zLlxuICAgIGlmIChwcmV2SW5wdXRSZWYuY3VycmVudCAhPT0gaW5wdXQpIHtcbiAgICAgIHByZXZJbnB1dFJlZi5jdXJyZW50ID0gaW5wdXRcbiAgICAgIGxhdGVzdFNlYXJjaFRva2VuUmVmLmN1cnJlbnQgPSBudWxsXG4gICAgfVxuICAgIC8vIENsZWFyIHRoZSBkaXNtaXNzZWQgc3RhdGUgd2hlbiBpbnB1dCBjaGFuZ2VzXG4gICAgZGlzbWlzc2VkRm9ySW5wdXRSZWYuY3VycmVudCA9IG51bGxcbiAgICB2b2lkIHVwZGF0ZVN1Z2dlc3Rpb25zKGlucHV0KVxuICB9LCBbaW5wdXQsIHVwZGF0ZVN1Z2dlc3Rpb25zXSlcblxuICAvLyBIYW5kbGUgdGFiIGtleSBwcmVzcyAtIGNvbXBsZXRlIHN1Z2dlc3Rpb25zIG9yIHRyaWdnZXIgZmlsZSBzdWdnZXN0aW9uc1xuICBjb25zdCBoYW5kbGVUYWIgPSB1c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XG4gICAgLy8gSWYgd2UgaGF2ZSBpbmxpbmUgZ2hvc3QgdGV4dCwgYXBwbHkgaXRcbiAgICBpZiAoZWZmZWN0aXZlR2hvc3RUZXh0KSB7XG4gICAgICAvLyBDaGVjayBmb3IgYmFzaCBtb2RlIGhpc3RvcnkgY29tcGxldGlvbiBmaXJzdFxuICAgICAgaWYgKG1vZGUgPT09ICdiYXNoJykge1xuICAgICAgICAvLyBSZXBsYWNlIHRoZSBpbnB1dCB3aXRoIHRoZSBmdWxsIGNvbW1hbmQgZnJvbSBoaXN0b3J5XG4gICAgICAgIG9uSW5wdXRDaGFuZ2UoZWZmZWN0aXZlR2hvc3RUZXh0LmZ1bGxDb21tYW5kKVxuICAgICAgICBzZXRDdXJzb3JPZmZzZXQoZWZmZWN0aXZlR2hvc3RUZXh0LmZ1bGxDb21tYW5kLmxlbmd0aClcbiAgICAgICAgc2V0SW5saW5lR2hvc3RUZXh0KHVuZGVmaW5lZClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIEZpbmQgdGhlIG1pZC1pbnB1dCBjb21tYW5kIHRvIGdldCBpdHMgcG9zaXRpb24gKGZvciBwcm9tcHQgbW9kZSlcbiAgICAgIGNvbnN0IG1pZElucHV0Q29tbWFuZCA9IGZpbmRNaWRJbnB1dFNsYXNoQ29tbWFuZChpbnB1dCwgY3Vyc29yT2Zmc2V0KVxuICAgICAgaWYgKG1pZElucHV0Q29tbWFuZCkge1xuICAgICAgICAvLyBSZXBsYWNlIHRoZSBwYXJ0aWFsIGNvbW1hbmQgd2l0aCB0aGUgZnVsbCBjb21tYW5kICsgc3BhY2VcbiAgICAgICAgY29uc3QgYmVmb3JlID0gaW5wdXQuc2xpY2UoMCwgbWlkSW5wdXRDb21tYW5kLnN0YXJ0UG9zKVxuICAgICAgICBjb25zdCBhZnRlciA9IGlucHV0LnNsaWNlKFxuICAgICAgICAgIG1pZElucHV0Q29tbWFuZC5zdGFydFBvcyArIG1pZElucHV0Q29tbWFuZC50b2tlbi5sZW5ndGgsXG4gICAgICAgIClcbiAgICAgICAgY29uc3QgbmV3SW5wdXQgPVxuICAgICAgICAgIGJlZm9yZSArICcvJyArIGVmZmVjdGl2ZUdob3N0VGV4dC5mdWxsQ29tbWFuZCArICcgJyArIGFmdGVyXG4gICAgICAgIGNvbnN0IG5ld0N1cnNvck9mZnNldCA9XG4gICAgICAgICAgbWlkSW5wdXRDb21tYW5kLnN0YXJ0UG9zICtcbiAgICAgICAgICAxICtcbiAgICAgICAgICBlZmZlY3RpdmVHaG9zdFRleHQuZnVsbENvbW1hbmQubGVuZ3RoICtcbiAgICAgICAgICAxXG5cbiAgICAgICAgb25JbnB1dENoYW5nZShuZXdJbnB1dClcbiAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0KG5ld0N1cnNvck9mZnNldClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgaGF2ZSBhY3RpdmUgc3VnZ2VzdGlvbnMsIHNlbGVjdCBvbmVcbiAgICBpZiAoc3VnZ2VzdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gQ2FuY2VsIGFueSBwZW5kaW5nIGRlYm91bmNlZCBmZXRjaGVzIHRvIHByZXZlbnQgZmxpY2tlciB3aGVuIGFjY2VwdGluZ1xuICAgICAgZGVib3VuY2VkRmV0Y2hGaWxlU3VnZ2VzdGlvbnMuY2FuY2VsKClcbiAgICAgIGRlYm91bmNlZEZldGNoU2xhY2tDaGFubmVscy5jYW5jZWwoKVxuXG4gICAgICBjb25zdCBpbmRleCA9IHNlbGVjdGVkU3VnZ2VzdGlvbiA9PT0gLTEgPyAwIDogc2VsZWN0ZWRTdWdnZXN0aW9uXG4gICAgICBjb25zdCBzdWdnZXN0aW9uID0gc3VnZ2VzdGlvbnNbaW5kZXhdXG5cbiAgICAgIGlmIChzdWdnZXN0aW9uVHlwZSA9PT0gJ2NvbW1hbmQnICYmIGluZGV4IDwgc3VnZ2VzdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgIGlmIChzdWdnZXN0aW9uKSB7XG4gICAgICAgICAgYXBwbHlDb21tYW5kU3VnZ2VzdGlvbihcbiAgICAgICAgICAgIHN1Z2dlc3Rpb24sXG4gICAgICAgICAgICBmYWxzZSwgLy8gZG9uJ3QgZXhlY3V0ZSBvbiB0YWJcbiAgICAgICAgICAgIGNvbW1hbmRzLFxuICAgICAgICAgICAgb25JbnB1dENoYW5nZSxcbiAgICAgICAgICAgIHNldEN1cnNvck9mZnNldCxcbiAgICAgICAgICAgIG9uU3VibWl0LFxuICAgICAgICAgIClcbiAgICAgICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzdWdnZXN0aW9uVHlwZSA9PT0gJ2N1c3RvbS10aXRsZScgJiYgc3VnZ2VzdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBBcHBseSBjdXN0b20gdGl0bGUgdG8gL3Jlc3VtZSBjb21tYW5kIHdpdGggc2Vzc2lvbklkXG4gICAgICAgIGlmIChzdWdnZXN0aW9uKSB7XG4gICAgICAgICAgY29uc3QgbmV3SW5wdXQgPSBidWlsZFJlc3VtZUlucHV0RnJvbVN1Z2dlc3Rpb24oc3VnZ2VzdGlvbilcbiAgICAgICAgICBvbklucHV0Q2hhbmdlKG5ld0lucHV0KVxuICAgICAgICAgIHNldEN1cnNvck9mZnNldChuZXdJbnB1dC5sZW5ndGgpXG4gICAgICAgICAgY2xlYXJTdWdnZXN0aW9ucygpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoc3VnZ2VzdGlvblR5cGUgPT09ICdkaXJlY3RvcnknICYmIHN1Z2dlc3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3Qgc3VnZ2VzdGlvbiA9IHN1Z2dlc3Rpb25zW2luZGV4XVxuICAgICAgICBpZiAoc3VnZ2VzdGlvbikge1xuICAgICAgICAgIC8vIENoZWNrIGlmIHRoaXMgaXMgYSBjb21tYW5kIGNvbnRleHQgKGUuZy4sIC9hZGQtZGlyKSBvciBnZW5lcmFsIHBhdGggY29tcGxldGlvblxuICAgICAgICAgIGNvbnN0IGlzSW5Db21tYW5kQ29udGV4dCA9IGlzQ29tbWFuZElucHV0KGlucHV0KVxuXG4gICAgICAgICAgbGV0IG5ld0lucHV0OiBzdHJpbmdcbiAgICAgICAgICBpZiAoaXNJbkNvbW1hbmRDb250ZXh0KSB7XG4gICAgICAgICAgICAvLyBDb21tYW5kIGNvbnRleHQ6IHJlcGxhY2UganVzdCB0aGUgYXJndW1lbnQgcG9ydGlvblxuICAgICAgICAgICAgY29uc3Qgc3BhY2VJbmRleCA9IGlucHV0LmluZGV4T2YoJyAnKVxuICAgICAgICAgICAgY29uc3QgY29tbWFuZFBhcnQgPSBpbnB1dC5zbGljZSgwLCBzcGFjZUluZGV4ICsgMSkgLy8gSW5jbHVkZSB0aGUgc3BhY2VcbiAgICAgICAgICAgIGNvbnN0IGNtZFN1ZmZpeCA9XG4gICAgICAgICAgICAgIGlzUGF0aE1ldGFkYXRhKHN1Z2dlc3Rpb24ubWV0YWRhdGEpICYmXG4gICAgICAgICAgICAgIHN1Z2dlc3Rpb24ubWV0YWRhdGEudHlwZSA9PT0gJ2RpcmVjdG9yeSdcbiAgICAgICAgICAgICAgICA/ICcvJ1xuICAgICAgICAgICAgICAgIDogJyAnXG4gICAgICAgICAgICBuZXdJbnB1dCA9IGNvbW1hbmRQYXJ0ICsgc3VnZ2VzdGlvbi5pZCArIGNtZFN1ZmZpeFxuXG4gICAgICAgICAgICBvbklucHV0Q2hhbmdlKG5ld0lucHV0KVxuICAgICAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0KG5ld0lucHV0Lmxlbmd0aClcblxuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBpc1BhdGhNZXRhZGF0YShzdWdnZXN0aW9uLm1ldGFkYXRhKSAmJlxuICAgICAgICAgICAgICBzdWdnZXN0aW9uLm1ldGFkYXRhLnR5cGUgPT09ICdkaXJlY3RvcnknXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgLy8gRm9yIGRpcmVjdG9yaWVzLCBmZXRjaCBuZXcgc3VnZ2VzdGlvbnMgZm9yIHRoZSB1cGRhdGVkIHBhdGhcbiAgICAgICAgICAgICAgc2V0U3VnZ2VzdGlvbnNTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICBjb21tYW5kQXJndW1lbnRIaW50OiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICB2b2lkIHVwZGF0ZVN1Z2dlc3Rpb25zKG5ld0lucHV0LCBuZXdJbnB1dC5sZW5ndGgpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gR2VuZXJhbCBwYXRoIGNvbXBsZXRpb246IHJlcGxhY2UgdGhlIHBhdGggdG9rZW4gaW4gaW5wdXQgd2l0aCBALXByZWZpeGVkIHBhdGhcbiAgICAgICAgICAgIC8vIFRyeSB0byBnZXQgdG9rZW4gd2l0aCBAIHByZWZpeCBmaXJzdCB0byBjaGVjayBpZiBhbHJlYWR5IHByZWZpeGVkXG4gICAgICAgICAgICBjb25zdCBjb21wbGV0aW9uVG9rZW5XaXRoQXQgPSBleHRyYWN0Q29tcGxldGlvblRva2VuKFxuICAgICAgICAgICAgICBpbnB1dCxcbiAgICAgICAgICAgICAgY3Vyc29yT2Zmc2V0LFxuICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgY29uc3QgY29tcGxldGlvblRva2VuID1cbiAgICAgICAgICAgICAgY29tcGxldGlvblRva2VuV2l0aEF0ID8/XG4gICAgICAgICAgICAgIGV4dHJhY3RDb21wbGV0aW9uVG9rZW4oaW5wdXQsIGN1cnNvck9mZnNldCwgZmFsc2UpXG5cbiAgICAgICAgICAgIGlmIChjb21wbGV0aW9uVG9rZW4pIHtcbiAgICAgICAgICAgICAgY29uc3QgaXNEaXIgPVxuICAgICAgICAgICAgICAgIGlzUGF0aE1ldGFkYXRhKHN1Z2dlc3Rpb24ubWV0YWRhdGEpICYmXG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbi5tZXRhZGF0YS50eXBlID09PSAnZGlyZWN0b3J5J1xuICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhcHBseURpcmVjdG9yeVN1Z2dlc3Rpb24oXG4gICAgICAgICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbi5pZCxcbiAgICAgICAgICAgICAgICBjb21wbGV0aW9uVG9rZW4uc3RhcnRQb3MsXG4gICAgICAgICAgICAgICAgY29tcGxldGlvblRva2VuLnRva2VuLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBpc0RpcixcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICBuZXdJbnB1dCA9IHJlc3VsdC5uZXdJbnB1dFxuXG4gICAgICAgICAgICAgIG9uSW5wdXRDaGFuZ2UobmV3SW5wdXQpXG4gICAgICAgICAgICAgIHNldEN1cnNvck9mZnNldChyZXN1bHQuY3Vyc29yUG9zKVxuXG4gICAgICAgICAgICAgIGlmIChpc0Rpcikge1xuICAgICAgICAgICAgICAgIC8vIEZvciBkaXJlY3RvcmllcywgZmV0Y2ggbmV3IHN1Z2dlc3Rpb25zIGZvciB0aGUgdXBkYXRlZCBwYXRoXG4gICAgICAgICAgICAgICAgc2V0U3VnZ2VzdGlvbnNTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICAgICAgY29tbWFuZEFyZ3VtZW50SGludDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgIHZvaWQgdXBkYXRlU3VnZ2VzdGlvbnMobmV3SW5wdXQsIHJlc3VsdC5jdXJzb3JQb3MpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gRm9yIGZpbGVzLCBjbGVhciBzdWdnZXN0aW9uc1xuICAgICAgICAgICAgICAgIGNsZWFyU3VnZ2VzdGlvbnMoKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBObyBjb21wbGV0aW9uIHRva2VuIGZvdW5kIChlLmcuLCBjdXJzb3IgYWZ0ZXIgc3BhY2UpIC0ganVzdCBjbGVhciBzdWdnZXN0aW9uc1xuICAgICAgICAgICAgICAvLyB3aXRob3V0IG1vZGlmeWluZyBpbnB1dCB0byBhdm9pZCBkYXRhIGxvc3NcbiAgICAgICAgICAgICAgY2xlYXJTdWdnZXN0aW9ucygpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHN1Z2dlc3Rpb25UeXBlID09PSAnc2hlbGwnICYmIHN1Z2dlc3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3Qgc3VnZ2VzdGlvbiA9IHN1Z2dlc3Rpb25zW2luZGV4XVxuICAgICAgICBpZiAoc3VnZ2VzdGlvbikge1xuICAgICAgICAgIGNvbnN0IG1ldGFkYXRhID0gc3VnZ2VzdGlvbi5tZXRhZGF0YSBhc1xuICAgICAgICAgICAgfCB7IGNvbXBsZXRpb25UeXBlOiBTaGVsbENvbXBsZXRpb25UeXBlIH1cbiAgICAgICAgICAgIHwgdW5kZWZpbmVkXG4gICAgICAgICAgYXBwbHlTaGVsbFN1Z2dlc3Rpb24oXG4gICAgICAgICAgICBzdWdnZXN0aW9uLFxuICAgICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgICBjdXJzb3JPZmZzZXQsXG4gICAgICAgICAgICBvbklucHV0Q2hhbmdlLFxuICAgICAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0LFxuICAgICAgICAgICAgbWV0YWRhdGE/LmNvbXBsZXRpb25UeXBlLFxuICAgICAgICAgIClcbiAgICAgICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgc3VnZ2VzdGlvblR5cGUgPT09ICdhZ2VudCcgJiZcbiAgICAgICAgc3VnZ2VzdGlvbnMubGVuZ3RoID4gMCAmJlxuICAgICAgICBzdWdnZXN0aW9uc1tpbmRleF0/LmlkPy5zdGFydHNXaXRoKCdkbS0nKVxuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IHN1Z2dlc3Rpb24gPSBzdWdnZXN0aW9uc1tpbmRleF1cbiAgICAgICAgaWYgKHN1Z2dlc3Rpb24pIHtcbiAgICAgICAgICBhcHBseVRyaWdnZXJTdWdnZXN0aW9uKFxuICAgICAgICAgICAgc3VnZ2VzdGlvbixcbiAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgY3Vyc29yT2Zmc2V0LFxuICAgICAgICAgICAgRE1fTUVNQkVSX1JFLFxuICAgICAgICAgICAgb25JbnB1dENoYW5nZSxcbiAgICAgICAgICAgIHNldEN1cnNvck9mZnNldCxcbiAgICAgICAgICApXG4gICAgICAgICAgY2xlYXJTdWdnZXN0aW9ucygpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoc3VnZ2VzdGlvblR5cGUgPT09ICdzbGFjay1jaGFubmVsJyAmJiBzdWdnZXN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IHN1Z2dlc3Rpb24gPSBzdWdnZXN0aW9uc1tpbmRleF1cbiAgICAgICAgaWYgKHN1Z2dlc3Rpb24pIHtcbiAgICAgICAgICBhcHBseVRyaWdnZXJTdWdnZXN0aW9uKFxuICAgICAgICAgICAgc3VnZ2VzdGlvbixcbiAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgY3Vyc29yT2Zmc2V0LFxuICAgICAgICAgICAgSEFTSF9DSEFOTkVMX1JFLFxuICAgICAgICAgICAgb25JbnB1dENoYW5nZSxcbiAgICAgICAgICAgIHNldEN1cnNvck9mZnNldCxcbiAgICAgICAgICApXG4gICAgICAgICAgY2xlYXJTdWdnZXN0aW9ucygpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoc3VnZ2VzdGlvblR5cGUgPT09ICdmaWxlJyAmJiBzdWdnZXN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGNvbXBsZXRpb25Ub2tlbiA9IGV4dHJhY3RDb21wbGV0aW9uVG9rZW4oXG4gICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgY3Vyc29yT2Zmc2V0LFxuICAgICAgICAgIHRydWUsXG4gICAgICAgIClcbiAgICAgICAgaWYgKCFjb21wbGV0aW9uVG9rZW4pIHtcbiAgICAgICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIGlmIGFsbCBzdWdnZXN0aW9ucyBzaGFyZSBhIGNvbW1vbiBwcmVmaXggbG9uZ2VyIHRoYW4gdGhlIGN1cnJlbnQgaW5wdXRcbiAgICAgICAgY29uc3QgY29tbW9uUHJlZml4ID0gZmluZExvbmdlc3RDb21tb25QcmVmaXgoc3VnZ2VzdGlvbnMpXG5cbiAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIHRva2VuIHN0YXJ0cyB3aXRoIEAgdG8gcHJlc2VydmUgaXQgZHVyaW5nIHJlcGxhY2VtZW50XG4gICAgICAgIGNvbnN0IGhhc0F0UHJlZml4ID0gY29tcGxldGlvblRva2VuLnRva2VuLnN0YXJ0c1dpdGgoJ0AnKVxuICAgICAgICAvLyBUaGUgZWZmZWN0aXZlIHRva2VuIGxlbmd0aCBleGNsdWRlcyB0aGUgQCBhbmQgcXVvdGVzIGlmIHByZXNlbnRcbiAgICAgICAgbGV0IGVmZmVjdGl2ZVRva2VuTGVuZ3RoOiBudW1iZXJcbiAgICAgICAgaWYgKGNvbXBsZXRpb25Ub2tlbi5pc1F1b3RlZCkge1xuICAgICAgICAgIC8vIFJlbW92ZSBAXCIgcHJlZml4IGFuZCBvcHRpb25hbCBjbG9zaW5nIFwiIHRvIGdldCBlZmZlY3RpdmUgbGVuZ3RoXG4gICAgICAgICAgZWZmZWN0aXZlVG9rZW5MZW5ndGggPSBjb21wbGV0aW9uVG9rZW4udG9rZW5cbiAgICAgICAgICAgIC5zbGljZSgyKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1wiJC8sICcnKS5sZW5ndGhcbiAgICAgICAgfSBlbHNlIGlmIChoYXNBdFByZWZpeCkge1xuICAgICAgICAgIGVmZmVjdGl2ZVRva2VuTGVuZ3RoID0gY29tcGxldGlvblRva2VuLnRva2VuLmxlbmd0aCAtIDFcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlZmZlY3RpdmVUb2tlbkxlbmd0aCA9IGNvbXBsZXRpb25Ub2tlbi50b2tlbi5sZW5ndGhcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHRoZXJlJ3MgYSBjb21tb24gcHJlZml4IGxvbmdlciB0aGFuIHdoYXQgdGhlIHVzZXIgaGFzIHR5cGVkLFxuICAgICAgICAvLyByZXBsYWNlIHRoZSBjdXJyZW50IGlucHV0IHdpdGggdGhlIGNvbW1vbiBwcmVmaXhcbiAgICAgICAgaWYgKGNvbW1vblByZWZpeC5sZW5ndGggPiBlZmZlY3RpdmVUb2tlbkxlbmd0aCkge1xuICAgICAgICAgIGNvbnN0IHJlcGxhY2VtZW50VmFsdWUgPSBmb3JtYXRSZXBsYWNlbWVudFZhbHVlKHtcbiAgICAgICAgICAgIGRpc3BsYXlUZXh0OiBjb21tb25QcmVmaXgsXG4gICAgICAgICAgICBtb2RlLFxuICAgICAgICAgICAgaGFzQXRQcmVmaXgsXG4gICAgICAgICAgICBuZWVkc1F1b3RlczogZmFsc2UsIC8vIGNvbW1vbiBwcmVmaXggZG9lc24ndCBuZWVkIHF1b3RlcyB1bmxlc3MgYWxyZWFkeSBxdW90ZWRcbiAgICAgICAgICAgIGlzUXVvdGVkOiBjb21wbGV0aW9uVG9rZW4uaXNRdW90ZWQsXG4gICAgICAgICAgICBpc0NvbXBsZXRlOiBmYWxzZSwgLy8gcGFydGlhbCBjb21wbGV0aW9uXG4gICAgICAgICAgfSlcblxuICAgICAgICAgIGFwcGx5RmlsZVN1Z2dlc3Rpb24oXG4gICAgICAgICAgICByZXBsYWNlbWVudFZhbHVlLFxuICAgICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgICBjb21wbGV0aW9uVG9rZW4udG9rZW4sXG4gICAgICAgICAgICBjb21wbGV0aW9uVG9rZW4uc3RhcnRQb3MsXG4gICAgICAgICAgICBvbklucHV0Q2hhbmdlLFxuICAgICAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0LFxuICAgICAgICAgIClcbiAgICAgICAgICAvLyBEb24ndCBjbGVhciBzdWdnZXN0aW9ucyBzbyB1c2VyIGNhbiBjb250aW51ZSB0eXBpbmcgb3Igc2VsZWN0IGEgc3BlY2lmaWMgb3B0aW9uXG4gICAgICAgICAgLy8gSW5zdGVhZCwgdXBkYXRlIGZvciB0aGUgbmV3IHByZWZpeFxuICAgICAgICAgIHZvaWQgdXBkYXRlU3VnZ2VzdGlvbnMoXG4gICAgICAgICAgICBpbnB1dC5yZXBsYWNlKGNvbXBsZXRpb25Ub2tlbi50b2tlbiwgcmVwbGFjZW1lbnRWYWx1ZSksXG4gICAgICAgICAgICBjdXJzb3JPZmZzZXQsXG4gICAgICAgICAgKVxuICAgICAgICB9IGVsc2UgaWYgKGluZGV4IDwgc3VnZ2VzdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgLy8gT3RoZXJ3aXNlLCBhcHBseSB0aGUgc2VsZWN0ZWQgc3VnZ2VzdGlvblxuICAgICAgICAgIGNvbnN0IHN1Z2dlc3Rpb24gPSBzdWdnZXN0aW9uc1tpbmRleF1cbiAgICAgICAgICBpZiAoc3VnZ2VzdGlvbikge1xuICAgICAgICAgICAgY29uc3QgbmVlZHNRdW90ZXMgPSBzdWdnZXN0aW9uLmRpc3BsYXlUZXh0LmluY2x1ZGVzKCcgJylcbiAgICAgICAgICAgIGNvbnN0IHJlcGxhY2VtZW50VmFsdWUgPSBmb3JtYXRSZXBsYWNlbWVudFZhbHVlKHtcbiAgICAgICAgICAgICAgZGlzcGxheVRleHQ6IHN1Z2dlc3Rpb24uZGlzcGxheVRleHQsXG4gICAgICAgICAgICAgIG1vZGUsXG4gICAgICAgICAgICAgIGhhc0F0UHJlZml4LFxuICAgICAgICAgICAgICBuZWVkc1F1b3RlcyxcbiAgICAgICAgICAgICAgaXNRdW90ZWQ6IGNvbXBsZXRpb25Ub2tlbi5pc1F1b3RlZCxcbiAgICAgICAgICAgICAgaXNDb21wbGV0ZTogdHJ1ZSwgLy8gY29tcGxldGUgc3VnZ2VzdGlvblxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgYXBwbHlGaWxlU3VnZ2VzdGlvbihcbiAgICAgICAgICAgICAgcmVwbGFjZW1lbnRWYWx1ZSxcbiAgICAgICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgICAgIGNvbXBsZXRpb25Ub2tlbi50b2tlbixcbiAgICAgICAgICAgICAgY29tcGxldGlvblRva2VuLnN0YXJ0UG9zLFxuICAgICAgICAgICAgICBvbklucHV0Q2hhbmdlLFxuICAgICAgICAgICAgICBzZXRDdXJzb3JPZmZzZXQsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlucHV0LnRyaW0oKSAhPT0gJycpIHtcbiAgICAgIGxldCBzdWdnZXN0aW9uVHlwZTogU3VnZ2VzdGlvblR5cGVcbiAgICAgIGxldCBzdWdnZXN0aW9uSXRlbXM6IFN1Z2dlc3Rpb25JdGVtW11cblxuICAgICAgaWYgKG1vZGUgPT09ICdiYXNoJykge1xuICAgICAgICBzdWdnZXN0aW9uVHlwZSA9ICdzaGVsbCdcbiAgICAgICAgLy8gVGhpcyBzaG91bGQgYmUgdmVyeSBmYXN0LCB0YWtpbmcgPDEwbXNcbiAgICAgICAgY29uc3QgYmFzaFN1Z2dlc3Rpb25zID0gYXdhaXQgZ2VuZXJhdGVCYXNoU3VnZ2VzdGlvbnMoXG4gICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgY3Vyc29yT2Zmc2V0LFxuICAgICAgICApXG4gICAgICAgIGlmIChiYXNoU3VnZ2VzdGlvbnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgLy8gSWYgc2luZ2xlIHN1Z2dlc3Rpb24sIGFwcGx5IGl0IGltbWVkaWF0ZWx5XG4gICAgICAgICAgY29uc3Qgc3VnZ2VzdGlvbiA9IGJhc2hTdWdnZXN0aW9uc1swXVxuICAgICAgICAgIGlmIChzdWdnZXN0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBtZXRhZGF0YSA9IHN1Z2dlc3Rpb24ubWV0YWRhdGEgYXNcbiAgICAgICAgICAgICAgfCB7IGNvbXBsZXRpb25UeXBlOiBTaGVsbENvbXBsZXRpb25UeXBlIH1cbiAgICAgICAgICAgICAgfCB1bmRlZmluZWRcbiAgICAgICAgICAgIGFwcGx5U2hlbGxTdWdnZXN0aW9uKFxuICAgICAgICAgICAgICBzdWdnZXN0aW9uLFxuICAgICAgICAgICAgICBpbnB1dCxcbiAgICAgICAgICAgICAgY3Vyc29yT2Zmc2V0LFxuICAgICAgICAgICAgICBvbklucHV0Q2hhbmdlLFxuICAgICAgICAgICAgICBzZXRDdXJzb3JPZmZzZXQsXG4gICAgICAgICAgICAgIG1ldGFkYXRhPy5jb21wbGV0aW9uVHlwZSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG4gICAgICAgICAgc3VnZ2VzdGlvbkl0ZW1zID0gW11cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdWdnZXN0aW9uSXRlbXMgPSBiYXNoU3VnZ2VzdGlvbnNcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3VnZ2VzdGlvblR5cGUgPSAnZmlsZSdcbiAgICAgICAgLy8gSWYgbm8gc3VnZ2VzdGlvbnMsIGZldGNoIGZpbGUgYW5kIE1DUCByZXNvdXJjZSBzdWdnZXN0aW9uc1xuICAgICAgICBjb25zdCBjb21wbGV0aW9uSW5mbyA9IGV4dHJhY3RDb21wbGV0aW9uVG9rZW4oaW5wdXQsIGN1cnNvck9mZnNldCwgdHJ1ZSlcbiAgICAgICAgaWYgKGNvbXBsZXRpb25JbmZvKSB7XG4gICAgICAgICAgLy8gSWYgdG9rZW4gc3RhcnRzIHdpdGggQCwgc2VhcmNoIHdpdGhvdXQgdGhlIEAgcHJlZml4XG4gICAgICAgICAgY29uc3QgaXNBdFN5bWJvbCA9IGNvbXBsZXRpb25JbmZvLnRva2VuLnN0YXJ0c1dpdGgoJ0AnKVxuICAgICAgICAgIGNvbnN0IHNlYXJjaFRva2VuID0gaXNBdFN5bWJvbFxuICAgICAgICAgICAgPyBjb21wbGV0aW9uSW5mby50b2tlbi5zdWJzdHJpbmcoMSlcbiAgICAgICAgICAgIDogY29tcGxldGlvbkluZm8udG9rZW5cblxuICAgICAgICAgIHN1Z2dlc3Rpb25JdGVtcyA9IGF3YWl0IGdlbmVyYXRlVW5pZmllZFN1Z2dlc3Rpb25zKFxuICAgICAgICAgICAgc2VhcmNoVG9rZW4sXG4gICAgICAgICAgICBtY3BSZXNvdXJjZXMsXG4gICAgICAgICAgICBhZ2VudHMsXG4gICAgICAgICAgICBpc0F0U3ltYm9sLFxuICAgICAgICAgIClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdWdnZXN0aW9uSXRlbXMgPSBbXVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzdWdnZXN0aW9uSXRlbXMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBNdWx0aXBsZSBzdWdnZXN0aW9ucyBvciBub3QgYmFzaCBtb2RlOiBzaG93IGxpc3RcbiAgICAgICAgc2V0U3VnZ2VzdGlvbnNTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgY29tbWFuZEFyZ3VtZW50SGludDogdW5kZWZpbmVkLFxuICAgICAgICAgIHN1Z2dlc3Rpb25zOiBzdWdnZXN0aW9uSXRlbXMsXG4gICAgICAgICAgc2VsZWN0ZWRTdWdnZXN0aW9uOiBnZXRQcmVzZXJ2ZWRTZWxlY3Rpb24oXG4gICAgICAgICAgICBwcmV2LnN1Z2dlc3Rpb25zLFxuICAgICAgICAgICAgcHJldi5zZWxlY3RlZFN1Z2dlc3Rpb24sXG4gICAgICAgICAgICBzdWdnZXN0aW9uSXRlbXMsXG4gICAgICAgICAgKSxcbiAgICAgICAgfSkpXG4gICAgICAgIHNldFN1Z2dlc3Rpb25UeXBlKHN1Z2dlc3Rpb25UeXBlKVxuICAgICAgICBzZXRNYXhDb2x1bW5XaWR0aCh1bmRlZmluZWQpXG4gICAgICB9XG4gICAgfVxuICB9LCBbXG4gICAgc3VnZ2VzdGlvbnMsXG4gICAgc2VsZWN0ZWRTdWdnZXN0aW9uLFxuICAgIGlucHV0LFxuICAgIHN1Z2dlc3Rpb25UeXBlLFxuICAgIGNvbW1hbmRzLFxuICAgIG1vZGUsXG4gICAgb25JbnB1dENoYW5nZSxcbiAgICBzZXRDdXJzb3JPZmZzZXQsXG4gICAgb25TdWJtaXQsXG4gICAgY2xlYXJTdWdnZXN0aW9ucyxcbiAgICBjdXJzb3JPZmZzZXQsXG4gICAgdXBkYXRlU3VnZ2VzdGlvbnMsXG4gICAgbWNwUmVzb3VyY2VzLFxuICAgIHNldFN1Z2dlc3Rpb25zU3RhdGUsXG4gICAgYWdlbnRzLFxuICAgIGRlYm91bmNlZEZldGNoRmlsZVN1Z2dlc3Rpb25zLFxuICAgIGRlYm91bmNlZEZldGNoU2xhY2tDaGFubmVscyxcbiAgICBlZmZlY3RpdmVHaG9zdFRleHQsXG4gIF0pXG5cbiAgLy8gSGFuZGxlIGVudGVyIGtleSBwcmVzcyAtIGFwcGx5IGFuZCBleGVjdXRlIHN1Z2dlc3Rpb25zXG4gIGNvbnN0IGhhbmRsZUVudGVyID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmIChzZWxlY3RlZFN1Z2dlc3Rpb24gPCAwIHx8IHN1Z2dlc3Rpb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgICBjb25zdCBzdWdnZXN0aW9uID0gc3VnZ2VzdGlvbnNbc2VsZWN0ZWRTdWdnZXN0aW9uXVxuXG4gICAgaWYgKFxuICAgICAgc3VnZ2VzdGlvblR5cGUgPT09ICdjb21tYW5kJyAmJlxuICAgICAgc2VsZWN0ZWRTdWdnZXN0aW9uIDwgc3VnZ2VzdGlvbnMubGVuZ3RoXG4gICAgKSB7XG4gICAgICBpZiAoc3VnZ2VzdGlvbikge1xuICAgICAgICBhcHBseUNvbW1hbmRTdWdnZXN0aW9uKFxuICAgICAgICAgIHN1Z2dlc3Rpb24sXG4gICAgICAgICAgdHJ1ZSwgLy8gZXhlY3V0ZSBvbiByZXR1cm5cbiAgICAgICAgICBjb21tYW5kcyxcbiAgICAgICAgICBvbklucHV0Q2hhbmdlLFxuICAgICAgICAgIHNldEN1cnNvck9mZnNldCxcbiAgICAgICAgICBvblN1Ym1pdCxcbiAgICAgICAgKVxuICAgICAgICBkZWJvdW5jZWRGZXRjaEZpbGVTdWdnZXN0aW9ucy5jYW5jZWwoKVxuICAgICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgc3VnZ2VzdGlvblR5cGUgPT09ICdjdXN0b20tdGl0bGUnICYmXG4gICAgICBzZWxlY3RlZFN1Z2dlc3Rpb24gPCBzdWdnZXN0aW9ucy5sZW5ndGhcbiAgICApIHtcbiAgICAgIC8vIEFwcGx5IGN1c3RvbSB0aXRsZSBhbmQgZXhlY3V0ZSAvcmVzdW1lIGNvbW1hbmQgd2l0aCBzZXNzaW9uSWRcbiAgICAgIGlmIChzdWdnZXN0aW9uKSB7XG4gICAgICAgIGNvbnN0IG5ld0lucHV0ID0gYnVpbGRSZXN1bWVJbnB1dEZyb21TdWdnZXN0aW9uKHN1Z2dlc3Rpb24pXG4gICAgICAgIG9uSW5wdXRDaGFuZ2UobmV3SW5wdXQpXG4gICAgICAgIHNldEN1cnNvck9mZnNldChuZXdJbnB1dC5sZW5ndGgpXG4gICAgICAgIG9uU3VibWl0KG5ld0lucHV0LCAvKiBpc1N1Ym1pdHRpbmdTbGFzaENvbW1hbmQgKi8gdHJ1ZSlcbiAgICAgICAgZGVib3VuY2VkRmV0Y2hGaWxlU3VnZ2VzdGlvbnMuY2FuY2VsKClcbiAgICAgICAgY2xlYXJTdWdnZXN0aW9ucygpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIHN1Z2dlc3Rpb25UeXBlID09PSAnc2hlbGwnICYmXG4gICAgICBzZWxlY3RlZFN1Z2dlc3Rpb24gPCBzdWdnZXN0aW9ucy5sZW5ndGhcbiAgICApIHtcbiAgICAgIGNvbnN0IHN1Z2dlc3Rpb24gPSBzdWdnZXN0aW9uc1tzZWxlY3RlZFN1Z2dlc3Rpb25dXG4gICAgICBpZiAoc3VnZ2VzdGlvbikge1xuICAgICAgICBjb25zdCBtZXRhZGF0YSA9IHN1Z2dlc3Rpb24ubWV0YWRhdGEgYXNcbiAgICAgICAgICB8IHsgY29tcGxldGlvblR5cGU6IFNoZWxsQ29tcGxldGlvblR5cGUgfVxuICAgICAgICAgIHwgdW5kZWZpbmVkXG4gICAgICAgIGFwcGx5U2hlbGxTdWdnZXN0aW9uKFxuICAgICAgICAgIHN1Z2dlc3Rpb24sXG4gICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgY3Vyc29yT2Zmc2V0LFxuICAgICAgICAgIG9uSW5wdXRDaGFuZ2UsXG4gICAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0LFxuICAgICAgICAgIG1ldGFkYXRhPy5jb21wbGV0aW9uVHlwZSxcbiAgICAgICAgKVxuICAgICAgICBkZWJvdW5jZWRGZXRjaEZpbGVTdWdnZXN0aW9ucy5jYW5jZWwoKVxuICAgICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgc3VnZ2VzdGlvblR5cGUgPT09ICdhZ2VudCcgJiZcbiAgICAgIHNlbGVjdGVkU3VnZ2VzdGlvbiA8IHN1Z2dlc3Rpb25zLmxlbmd0aCAmJlxuICAgICAgc3VnZ2VzdGlvbj8uaWQ/LnN0YXJ0c1dpdGgoJ2RtLScpXG4gICAgKSB7XG4gICAgICBhcHBseVRyaWdnZXJTdWdnZXN0aW9uKFxuICAgICAgICBzdWdnZXN0aW9uLFxuICAgICAgICBpbnB1dCxcbiAgICAgICAgY3Vyc29yT2Zmc2V0LFxuICAgICAgICBETV9NRU1CRVJfUkUsXG4gICAgICAgIG9uSW5wdXRDaGFuZ2UsXG4gICAgICAgIHNldEN1cnNvck9mZnNldCxcbiAgICAgIClcbiAgICAgIGRlYm91bmNlZEZldGNoRmlsZVN1Z2dlc3Rpb25zLmNhbmNlbCgpXG4gICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgc3VnZ2VzdGlvblR5cGUgPT09ICdzbGFjay1jaGFubmVsJyAmJlxuICAgICAgc2VsZWN0ZWRTdWdnZXN0aW9uIDwgc3VnZ2VzdGlvbnMubGVuZ3RoXG4gICAgKSB7XG4gICAgICBpZiAoc3VnZ2VzdGlvbikge1xuICAgICAgICBhcHBseVRyaWdnZXJTdWdnZXN0aW9uKFxuICAgICAgICAgIHN1Z2dlc3Rpb24sXG4gICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgY3Vyc29yT2Zmc2V0LFxuICAgICAgICAgIEhBU0hfQ0hBTk5FTF9SRSxcbiAgICAgICAgICBvbklucHV0Q2hhbmdlLFxuICAgICAgICAgIHNldEN1cnNvck9mZnNldCxcbiAgICAgICAgKVxuICAgICAgICBkZWJvdW5jZWRGZXRjaFNsYWNrQ2hhbm5lbHMuY2FuY2VsKClcbiAgICAgICAgY2xlYXJTdWdnZXN0aW9ucygpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIHN1Z2dlc3Rpb25UeXBlID09PSAnZmlsZScgJiZcbiAgICAgIHNlbGVjdGVkU3VnZ2VzdGlvbiA8IHN1Z2dlc3Rpb25zLmxlbmd0aFxuICAgICkge1xuICAgICAgLy8gRXh0cmFjdCBjb21wbGV0aW9uIHRva2VuIGRpcmVjdGx5IHdoZW4gbmVlZGVkXG4gICAgICBjb25zdCBjb21wbGV0aW9uSW5mbyA9IGV4dHJhY3RDb21wbGV0aW9uVG9rZW4oaW5wdXQsIGN1cnNvck9mZnNldCwgdHJ1ZSlcbiAgICAgIGlmIChjb21wbGV0aW9uSW5mbykge1xuICAgICAgICBpZiAoc3VnZ2VzdGlvbikge1xuICAgICAgICAgIGNvbnN0IGhhc0F0UHJlZml4ID0gY29tcGxldGlvbkluZm8udG9rZW4uc3RhcnRzV2l0aCgnQCcpXG4gICAgICAgICAgY29uc3QgbmVlZHNRdW90ZXMgPSBzdWdnZXN0aW9uLmRpc3BsYXlUZXh0LmluY2x1ZGVzKCcgJylcbiAgICAgICAgICBjb25zdCByZXBsYWNlbWVudFZhbHVlID0gZm9ybWF0UmVwbGFjZW1lbnRWYWx1ZSh7XG4gICAgICAgICAgICBkaXNwbGF5VGV4dDogc3VnZ2VzdGlvbi5kaXNwbGF5VGV4dCxcbiAgICAgICAgICAgIG1vZGUsXG4gICAgICAgICAgICBoYXNBdFByZWZpeCxcbiAgICAgICAgICAgIG5lZWRzUXVvdGVzLFxuICAgICAgICAgICAgaXNRdW90ZWQ6IGNvbXBsZXRpb25JbmZvLmlzUXVvdGVkLFxuICAgICAgICAgICAgaXNDb21wbGV0ZTogdHJ1ZSwgLy8gY29tcGxldGUgc3VnZ2VzdGlvblxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICBhcHBseUZpbGVTdWdnZXN0aW9uKFxuICAgICAgICAgICAgcmVwbGFjZW1lbnRWYWx1ZSxcbiAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgY29tcGxldGlvbkluZm8udG9rZW4sXG4gICAgICAgICAgICBjb21wbGV0aW9uSW5mby5zdGFydFBvcyxcbiAgICAgICAgICAgIG9uSW5wdXRDaGFuZ2UsXG4gICAgICAgICAgICBzZXRDdXJzb3JPZmZzZXQsXG4gICAgICAgICAgKVxuICAgICAgICAgIGRlYm91bmNlZEZldGNoRmlsZVN1Z2dlc3Rpb25zLmNhbmNlbCgpXG4gICAgICAgICAgY2xlYXJTdWdnZXN0aW9ucygpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgc3VnZ2VzdGlvblR5cGUgPT09ICdkaXJlY3RvcnknICYmXG4gICAgICBzZWxlY3RlZFN1Z2dlc3Rpb24gPCBzdWdnZXN0aW9ucy5sZW5ndGhcbiAgICApIHtcbiAgICAgIGlmIChzdWdnZXN0aW9uKSB7XG4gICAgICAgIC8vIEluIGNvbW1hbmQgY29udGV4dCAoZS5nLiwgL2FkZC1kaXIpLCBFbnRlciBzdWJtaXRzIHRoZSBjb21tYW5kXG4gICAgICAgIC8vIHJhdGhlciB0aGFuIGFwcGx5aW5nIHRoZSBkaXJlY3Rvcnkgc3VnZ2VzdGlvbi4gSnVzdCBjbGVhclxuICAgICAgICAvLyBzdWdnZXN0aW9ucyBhbmQgbGV0IHRoZSBzdWJtaXQgaGFuZGxlciBwcm9jZXNzIHRoZSBjdXJyZW50IGlucHV0LlxuICAgICAgICBpZiAoaXNDb21tYW5kSW5wdXQoaW5wdXQpKSB7XG4gICAgICAgICAgZGVib3VuY2VkRmV0Y2hGaWxlU3VnZ2VzdGlvbnMuY2FuY2VsKClcbiAgICAgICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYWwgcGF0aCBjb21wbGV0aW9uOiByZXBsYWNlIHRoZSBwYXRoIHRva2VuXG4gICAgICAgIGNvbnN0IGNvbXBsZXRpb25Ub2tlbldpdGhBdCA9IGV4dHJhY3RDb21wbGV0aW9uVG9rZW4oXG4gICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgY3Vyc29yT2Zmc2V0LFxuICAgICAgICAgIHRydWUsXG4gICAgICAgIClcbiAgICAgICAgY29uc3QgY29tcGxldGlvblRva2VuID1cbiAgICAgICAgICBjb21wbGV0aW9uVG9rZW5XaXRoQXQgPz9cbiAgICAgICAgICBleHRyYWN0Q29tcGxldGlvblRva2VuKGlucHV0LCBjdXJzb3JPZmZzZXQsIGZhbHNlKVxuXG4gICAgICAgIGlmIChjb21wbGV0aW9uVG9rZW4pIHtcbiAgICAgICAgICBjb25zdCBpc0RpciA9XG4gICAgICAgICAgICBpc1BhdGhNZXRhZGF0YShzdWdnZXN0aW9uLm1ldGFkYXRhKSAmJlxuICAgICAgICAgICAgc3VnZ2VzdGlvbi5tZXRhZGF0YS50eXBlID09PSAnZGlyZWN0b3J5J1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGFwcGx5RGlyZWN0b3J5U3VnZ2VzdGlvbihcbiAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgc3VnZ2VzdGlvbi5pZCxcbiAgICAgICAgICAgIGNvbXBsZXRpb25Ub2tlbi5zdGFydFBvcyxcbiAgICAgICAgICAgIGNvbXBsZXRpb25Ub2tlbi50b2tlbi5sZW5ndGgsXG4gICAgICAgICAgICBpc0RpcixcbiAgICAgICAgICApXG4gICAgICAgICAgb25JbnB1dENoYW5nZShyZXN1bHQubmV3SW5wdXQpXG4gICAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0KHJlc3VsdC5jdXJzb3JQb3MpXG4gICAgICAgIH1cbiAgICAgICAgLy8gSWYgbm8gY29tcGxldGlvbiB0b2tlbiBmb3VuZCAoZS5nLiwgY3Vyc29yIGFmdGVyIHNwYWNlKSwgZG9uJ3QgbW9kaWZ5IGlucHV0XG4gICAgICAgIC8vIHRvIGF2b2lkIGRhdGEgbG9zcyAtIGp1c3QgY2xlYXIgc3VnZ2VzdGlvbnNcblxuICAgICAgICBkZWJvdW5jZWRGZXRjaEZpbGVTdWdnZXN0aW9ucy5jYW5jZWwoKVxuICAgICAgICBjbGVhclN1Z2dlc3Rpb25zKClcbiAgICAgIH1cbiAgICB9XG4gIH0sIFtcbiAgICBzdWdnZXN0aW9ucyxcbiAgICBzZWxlY3RlZFN1Z2dlc3Rpb24sXG4gICAgc3VnZ2VzdGlvblR5cGUsXG4gICAgY29tbWFuZHMsXG4gICAgaW5wdXQsXG4gICAgY3Vyc29yT2Zmc2V0LFxuICAgIG1vZGUsXG4gICAgb25JbnB1dENoYW5nZSxcbiAgICBzZXRDdXJzb3JPZmZzZXQsXG4gICAgb25TdWJtaXQsXG4gICAgY2xlYXJTdWdnZXN0aW9ucyxcbiAgICBkZWJvdW5jZWRGZXRjaEZpbGVTdWdnZXN0aW9ucyxcbiAgICBkZWJvdW5jZWRGZXRjaFNsYWNrQ2hhbm5lbHMsXG4gIF0pXG5cbiAgLy8gSGFuZGxlciBmb3IgYXV0b2NvbXBsZXRlOmFjY2VwdCAtIGFjY2VwdHMgY3VycmVudCBzdWdnZXN0aW9uIHZpYSBUYWIgb3IgUmlnaHQgQXJyb3dcbiAgY29uc3QgaGFuZGxlQXV0b2NvbXBsZXRlQWNjZXB0ID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHZvaWQgaGFuZGxlVGFiKClcbiAgfSwgW2hhbmRsZVRhYl0pXG5cbiAgLy8gSGFuZGxlciBmb3IgYXV0b2NvbXBsZXRlOmRpc21pc3MgLSBjbGVhcnMgc3VnZ2VzdGlvbnMgYW5kIHByZXZlbnRzIHJlLXRyaWdnZXJpbmdcbiAgY29uc3QgaGFuZGxlQXV0b2NvbXBsZXRlRGlzbWlzcyA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBkZWJvdW5jZWRGZXRjaEZpbGVTdWdnZXN0aW9ucy5jYW5jZWwoKVxuICAgIGRlYm91bmNlZEZldGNoU2xhY2tDaGFubmVscy5jYW5jZWwoKVxuICAgIGNsZWFyU3VnZ2VzdGlvbnMoKVxuICAgIC8vIFJlbWVtYmVyIHRoZSBpbnB1dCB3aGVuIGRpc21pc3NlZCB0byBwcmV2ZW50IGltbWVkaWF0ZSByZS10cmlnZ2VyaW5nXG4gICAgZGlzbWlzc2VkRm9ySW5wdXRSZWYuY3VycmVudCA9IGlucHV0XG4gIH0sIFtcbiAgICBkZWJvdW5jZWRGZXRjaEZpbGVTdWdnZXN0aW9ucyxcbiAgICBkZWJvdW5jZWRGZXRjaFNsYWNrQ2hhbm5lbHMsXG4gICAgY2xlYXJTdWdnZXN0aW9ucyxcbiAgICBpbnB1dCxcbiAgXSlcblxuICAvLyBIYW5kbGVyIGZvciBhdXRvY29tcGxldGU6cHJldmlvdXMgLSBzZWxlY3RzIHByZXZpb3VzIHN1Z2dlc3Rpb25cbiAgY29uc3QgaGFuZGxlQXV0b2NvbXBsZXRlUHJldmlvdXMgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgc2V0U3VnZ2VzdGlvbnNTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAuLi5wcmV2LFxuICAgICAgc2VsZWN0ZWRTdWdnZXN0aW9uOlxuICAgICAgICBwcmV2LnNlbGVjdGVkU3VnZ2VzdGlvbiA8PSAwXG4gICAgICAgICAgPyBzdWdnZXN0aW9ucy5sZW5ndGggLSAxXG4gICAgICAgICAgOiBwcmV2LnNlbGVjdGVkU3VnZ2VzdGlvbiAtIDEsXG4gICAgfSkpXG4gIH0sIFtzdWdnZXN0aW9ucy5sZW5ndGgsIHNldFN1Z2dlc3Rpb25zU3RhdGVdKVxuXG4gIC8vIEhhbmRsZXIgZm9yIGF1dG9jb21wbGV0ZTpuZXh0IC0gc2VsZWN0cyBuZXh0IHN1Z2dlc3Rpb25cbiAgY29uc3QgaGFuZGxlQXV0b2NvbXBsZXRlTmV4dCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBzZXRTdWdnZXN0aW9uc1N0YXRlKHByZXYgPT4gKHtcbiAgICAgIC4uLnByZXYsXG4gICAgICBzZWxlY3RlZFN1Z2dlc3Rpb246XG4gICAgICAgIHByZXYuc2VsZWN0ZWRTdWdnZXN0aW9uID49IHN1Z2dlc3Rpb25zLmxlbmd0aCAtIDFcbiAgICAgICAgICA/IDBcbiAgICAgICAgICA6IHByZXYuc2VsZWN0ZWRTdWdnZXN0aW9uICsgMSxcbiAgICB9KSlcbiAgfSwgW3N1Z2dlc3Rpb25zLmxlbmd0aCwgc2V0U3VnZ2VzdGlvbnNTdGF0ZV0pXG5cbiAgLy8gQXV0b2NvbXBsZXRlIGNvbnRleHQga2V5YmluZGluZ3MgLSBvbmx5IGFjdGl2ZSB3aGVuIHN1Z2dlc3Rpb25zIGFyZSB2aXNpYmxlXG4gIGNvbnN0IGF1dG9jb21wbGV0ZUhhbmRsZXJzID0gdXNlTWVtbyhcbiAgICAoKSA9PiAoe1xuICAgICAgJ2F1dG9jb21wbGV0ZTphY2NlcHQnOiBoYW5kbGVBdXRvY29tcGxldGVBY2NlcHQsXG4gICAgICAnYXV0b2NvbXBsZXRlOmRpc21pc3MnOiBoYW5kbGVBdXRvY29tcGxldGVEaXNtaXNzLFxuICAgICAgJ2F1dG9jb21wbGV0ZTpwcmV2aW91cyc6IGhhbmRsZUF1dG9jb21wbGV0ZVByZXZpb3VzLFxuICAgICAgJ2F1dG9jb21wbGV0ZTpuZXh0JzogaGFuZGxlQXV0b2NvbXBsZXRlTmV4dCxcbiAgICB9KSxcbiAgICBbXG4gICAgICBoYW5kbGVBdXRvY29tcGxldGVBY2NlcHQsXG4gICAgICBoYW5kbGVBdXRvY29tcGxldGVEaXNtaXNzLFxuICAgICAgaGFuZGxlQXV0b2NvbXBsZXRlUHJldmlvdXMsXG4gICAgICBoYW5kbGVBdXRvY29tcGxldGVOZXh0LFxuICAgIF0sXG4gIClcblxuICAvLyBSZWdpc3RlciBhdXRvY29tcGxldGUgYXMgYW4gb3ZlcmxheSBzbyBDYW5jZWxSZXF1ZXN0SGFuZGxlciBkZWZlcnMgRVNDIGhhbmRsaW5nXG4gIC8vIFRoaXMgZW5zdXJlcyBFU0MgZGlzbWlzc2VzIGF1dG9jb21wbGV0ZSBiZWZvcmUgY2FuY2VsaW5nIHJ1bm5pbmcgdGFza3NcbiAgY29uc3QgaXNBdXRvY29tcGxldGVBY3RpdmUgPSBzdWdnZXN0aW9ucy5sZW5ndGggPiAwIHx8ICEhZWZmZWN0aXZlR2hvc3RUZXh0XG4gIGNvbnN0IGlzTW9kYWxPdmVybGF5QWN0aXZlID0gdXNlSXNNb2RhbE92ZXJsYXlBY3RpdmUoKVxuICB1c2VSZWdpc3Rlck92ZXJsYXkoJ2F1dG9jb21wbGV0ZScsIGlzQXV0b2NvbXBsZXRlQWN0aXZlKVxuICAvLyBSZWdpc3RlciBBdXRvY29tcGxldGUgY29udGV4dCBzbyBpdCBhcHBlYXJzIGluIGFjdGl2ZUNvbnRleHRzIGZvciBvdGhlciBoYW5kbGVycy5cbiAgLy8gVGhpcyBhbGxvd3MgQ2hhdCdzIHJlc29sdmVyIHRvIHNlZSBBdXRvY29tcGxldGUgYW5kIGRlZmVyIHRvIGl0cyBiaW5kaW5ncyBmb3IgdXAvZG93bi5cbiAgdXNlUmVnaXN0ZXJLZXliaW5kaW5nQ29udGV4dCgnQXV0b2NvbXBsZXRlJywgaXNBdXRvY29tcGxldGVBY3RpdmUpXG5cbiAgLy8gRGlzYWJsZSBhdXRvY29tcGxldGUga2V5YmluZGluZ3Mgd2hlbiBhIG1vZGFsIG92ZXJsYXkgKGUuZy4sIERpZmZEaWFsb2cpIGlzIGFjdGl2ZSxcbiAgLy8gc28gZXNjYXBlIHJlYWNoZXMgdGhlIG92ZXJsYXkncyBoYW5kbGVyIGluc3RlYWQgb2YgZGlzbWlzc2luZyBhdXRvY29tcGxldGVcbiAgdXNlS2V5YmluZGluZ3MoYXV0b2NvbXBsZXRlSGFuZGxlcnMsIHtcbiAgICBjb250ZXh0OiAnQXV0b2NvbXBsZXRlJyxcbiAgICBpc0FjdGl2ZTogaXNBdXRvY29tcGxldGVBY3RpdmUgJiYgIWlzTW9kYWxPdmVybGF5QWN0aXZlLFxuICB9KVxuXG4gIGZ1bmN0aW9uIGFjY2VwdFN1Z2dlc3Rpb25UZXh0KHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGRldGVjdGVkTW9kZSA9IGdldE1vZGVGcm9tSW5wdXQodGV4dClcbiAgICBpZiAoZGV0ZWN0ZWRNb2RlICE9PSAncHJvbXB0JyAmJiBvbk1vZGVDaGFuZ2UpIHtcbiAgICAgIG9uTW9kZUNoYW5nZShkZXRlY3RlZE1vZGUpXG4gICAgICBjb25zdCBzdHJpcHBlZCA9IGdldFZhbHVlRnJvbUlucHV0KHRleHQpXG4gICAgICBvbklucHV0Q2hhbmdlKHN0cmlwcGVkKVxuICAgICAgc2V0Q3Vyc29yT2Zmc2V0KHN0cmlwcGVkLmxlbmd0aClcbiAgICB9IGVsc2Uge1xuICAgICAgb25JbnB1dENoYW5nZSh0ZXh0KVxuICAgICAgc2V0Q3Vyc29yT2Zmc2V0KHRleHQubGVuZ3RoKVxuICAgIH1cbiAgfVxuXG4gIC8vIEhhbmRsZSBrZXlib2FyZCBpbnB1dCBmb3IgYmVoYXZpb3JzIG5vdCBjb3ZlcmVkIGJ5IGtleWJpbmRpbmdzXG4gIGNvbnN0IGhhbmRsZUtleURvd24gPSAoZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQgPT4ge1xuICAgIC8vIEhhbmRsZSByaWdodCBhcnJvdyB0byBhY2NlcHQgcHJvbXB0IHN1Z2dlc3Rpb24gZ2hvc3QgdGV4dFxuICAgIGlmIChlLmtleSA9PT0gJ3JpZ2h0JyAmJiAhaXNWaWV3aW5nVGVhbW1hdGUpIHtcbiAgICAgIGNvbnN0IHN1Z2dlc3Rpb25UZXh0ID0gcHJvbXB0U3VnZ2VzdGlvbi50ZXh0XG4gICAgICBjb25zdCBzdWdnZXN0aW9uU2hvd25BdCA9IHByb21wdFN1Z2dlc3Rpb24uc2hvd25BdFxuICAgICAgaWYgKHN1Z2dlc3Rpb25UZXh0ICYmIHN1Z2dlc3Rpb25TaG93bkF0ID4gMCAmJiBpbnB1dCA9PT0gJycpIHtcbiAgICAgICAgbWFya0FjY2VwdGVkKClcbiAgICAgICAgYWNjZXB0U3VnZ2VzdGlvblRleHQoc3VnZ2VzdGlvblRleHQpXG4gICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIFRhYiBrZXkgZmFsbGJhY2sgYmVoYXZpb3JzIHdoZW4gbm8gYXV0b2NvbXBsZXRlIHN1Z2dlc3Rpb25zXG4gICAgLy8gRG9uJ3QgaGFuZGxlIHRhYiBpZiBzaGlmdCBpcyBwcmVzc2VkICh1c2VkIGZvciBtb2RlIGN5Y2xlKVxuICAgIGlmIChlLmtleSA9PT0gJ3RhYicgJiYgIWUuc2hpZnQpIHtcbiAgICAgIC8vIFNraXAgaWYgYXV0b2NvbXBsZXRlIGlzIGhhbmRsaW5nIHRoaXMgKHN1Z2dlc3Rpb25zIG9yIGdob3N0IHRleHQgZXhpc3QpXG4gICAgICBpZiAoc3VnZ2VzdGlvbnMubGVuZ3RoID4gMCB8fCBlZmZlY3RpdmVHaG9zdFRleHQpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICAvLyBBY2NlcHQgcHJvbXB0IHN1Z2dlc3Rpb24gaWYgaXQgZXhpc3RzIGluIEFwcFN0YXRlXG4gICAgICBjb25zdCBzdWdnZXN0aW9uVGV4dCA9IHByb21wdFN1Z2dlc3Rpb24udGV4dFxuICAgICAgY29uc3Qgc3VnZ2VzdGlvblNob3duQXQgPSBwcm9tcHRTdWdnZXN0aW9uLnNob3duQXRcbiAgICAgIGlmIChcbiAgICAgICAgc3VnZ2VzdGlvblRleHQgJiZcbiAgICAgICAgc3VnZ2VzdGlvblNob3duQXQgPiAwICYmXG4gICAgICAgIGlucHV0ID09PSAnJyAmJlxuICAgICAgICAhaXNWaWV3aW5nVGVhbW1hdGVcbiAgICAgICkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgbWFya0FjY2VwdGVkKClcbiAgICAgICAgYWNjZXB0U3VnZ2VzdGlvblRleHQoc3VnZ2VzdGlvblRleHQpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgLy8gUmVtaW5kIHVzZXIgYWJvdXQgdGhpbmtpbmcgdG9nZ2xlIHNob3J0Y3V0IGlmIGVtcHR5IGlucHV0XG4gICAgICBpZiAoaW5wdXQudHJpbSgpID09PSAnJykge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgYWRkTm90aWZpY2F0aW9uKHtcbiAgICAgICAgICBrZXk6ICd0aGlua2luZy10b2dnbGUtaGludCcsXG4gICAgICAgICAganN4OiAoXG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgVXNlIHt0aGlua2luZ1RvZ2dsZVNob3J0Y3V0fSB0byB0b2dnbGUgdGhpbmtpbmdcbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICApLFxuICAgICAgICAgIHByaW9yaXR5OiAnaW1tZWRpYXRlJyxcbiAgICAgICAgICB0aW1lb3V0TXM6IDMwMDAsXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBPbmx5IGNvbnRpbnVlIHdpdGggbmF2aWdhdGlvbiBpZiB3ZSBoYXZlIHN1Z2dlc3Rpb25zXG4gICAgaWYgKHN1Z2dlc3Rpb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgICAvLyBIYW5kbGUgQ3RybC1OL1AgZm9yIG5hdmlnYXRpb24gKGFycm93cyBoYW5kbGVkIGJ5IGtleWJpbmRpbmdzKVxuICAgIC8vIFNraXAgaWYgd2UncmUgaW4gdGhlIG1pZGRsZSBvZiBhIGNob3JkIHNlcXVlbmNlIHRvIGFsbG93IGNob3JkcyBsaWtlIGN0cmwrZiBuXG4gICAgY29uc3QgaGFzUGVuZGluZ0Nob3JkID0ga2V5YmluZGluZ0NvbnRleHQ/LnBlbmRpbmdDaG9yZCAhPSBudWxsXG4gICAgaWYgKGUuY3RybCAmJiBlLmtleSA9PT0gJ24nICYmICFoYXNQZW5kaW5nQ2hvcmQpIHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgaGFuZGxlQXV0b2NvbXBsZXRlTmV4dCgpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoZS5jdHJsICYmIGUua2V5ID09PSAncCcgJiYgIWhhc1BlbmRpbmdDaG9yZCkge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBoYW5kbGVBdXRvY29tcGxldGVQcmV2aW91cygpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgc2VsZWN0aW9uIGFuZCBleGVjdXRpb24gdmlhIHJldHVybi9lbnRlclxuICAgIC8vIFNoaWZ0K0VudGVyIGFuZCBNZXRhK0VudGVyIGluc2VydCBuZXdsaW5lcyAoaGFuZGxlZCBieSB1c2VUZXh0SW5wdXQpLFxuICAgIC8vIHNvIGRvbid0IGFjY2VwdCB0aGUgc3VnZ2VzdGlvbiBmb3IgdGhvc2UuXG4gICAgaWYgKGUua2V5ID09PSAncmV0dXJuJyAmJiAhZS5zaGlmdCAmJiAhZS5tZXRhKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIGhhbmRsZUVudGVyKClcbiAgICB9XG4gIH1cblxuICAvLyBCYWNrd2FyZC1jb21wYXQgYnJpZGdlOiBQcm9tcHRJbnB1dCBkb2Vzbid0IHlldCB3aXJlIGhhbmRsZUtleURvd24gdG9cbiAgLy8gPEJveCBvbktleURvd24+LiBTdWJzY3JpYmUgdmlhIHVzZUlucHV0IGFuZCBhZGFwdCBJbnB1dEV2ZW50IOKGklxuICAvLyBLZXlib2FyZEV2ZW50IHVudGlsIHRoZSBjb25zdW1lciBpcyBtaWdyYXRlZCAoc2VwYXJhdGUgUFIpLlxuICAvLyBUT0RPKG9uS2V5RG93bi1taWdyYXRpb24pOiByZW1vdmUgb25jZSBQcm9tcHRJbnB1dCBwYXNzZXMgaGFuZGxlS2V5RG93bi5cbiAgdXNlSW5wdXQoKF9pbnB1dCwgX2tleSwgZXZlbnQpID0+IHtcbiAgICBjb25zdCBrYkV2ZW50ID0gbmV3IEtleWJvYXJkRXZlbnQoZXZlbnQua2V5cHJlc3MpXG4gICAgaGFuZGxlS2V5RG93bihrYkV2ZW50KVxuICAgIGlmIChrYkV2ZW50LmRpZFN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpKSB7XG4gICAgICBldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4ge1xuICAgIHN1Z2dlc3Rpb25zLFxuICAgIHNlbGVjdGVkU3VnZ2VzdGlvbixcbiAgICBzdWdnZXN0aW9uVHlwZSxcbiAgICBtYXhDb2x1bW5XaWR0aCxcbiAgICBjb21tYW5kQXJndW1lbnRIaW50LFxuICAgIGlubGluZUdob3N0VGV4dDogZWZmZWN0aXZlR2hvc3RUZXh0LFxuICAgIGhhbmRsZUtleURvd24sXG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxLQUFLQSxLQUFLLE1BQU0sT0FBTztBQUM5QixTQUFTQyxXQUFXLEVBQUVDLFNBQVMsRUFBRUMsT0FBTyxFQUFFQyxNQUFNLEVBQUVDLFFBQVEsUUFBUSxPQUFPO0FBQ3pFLFNBQVNDLGdCQUFnQixRQUFRLDhCQUE4QjtBQUMvRCxTQUFTQyxJQUFJLFFBQVEsWUFBWTtBQUNqQyxTQUFTQyxRQUFRLFFBQVEsaUNBQWlDO0FBQzFELFNBQVNDLG1CQUFtQixRQUFRLGFBQWE7QUFDakQsU0FBUyxLQUFLQyxPQUFPLEVBQUVDLGNBQWMsUUFBUSxnQkFBZ0I7QUFDN0QsU0FDRUMsZ0JBQWdCLEVBQ2hCQyxpQkFBaUIsUUFDWix5Q0FBeUM7QUFDaEQsY0FDRUMsY0FBYyxFQUNkQyxjQUFjLFFBQ1QsMkRBQTJEO0FBQ2xFLFNBQ0VDLHVCQUF1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