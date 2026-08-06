import { c as _c } from "react/compiler-runtime";
import chalk from 'chalk';
import figures from 'figures';
import Fuse from 'fuse.js';
import React from 'react';
import { getOriginalCwd, getSessionId } from '../bootstrap/state.js';
import { useExitOnCtrlCDWithKeybindings } from '../hooks/useExitOnCtrlCDWithKeybindings.js';
import { useSearchInput } from '../hooks/useSearchInput.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { applyColor } from '../ink/colorize.js';
import type { Color } from '../ink/styles.js';
import { Box, Text, useInput, useTerminalFocus, useTheme } from '../ink.js';
import { useKeybinding } from '../keybindings/useKeybinding.js';
import { logEvent } from '../services/analytics/index.js';
import type { LogOption, SerializedMessage } from '../types/logs.js';
import { formatLogMetadata, truncateToWidth } from '../utils/format.js';
import { getWorktreePaths } from '../utils/getWorktreePaths.js';
import { getBranch } from '../utils/git.js';
import { getLogDisplayTitle } from '../utils/log.js';
import { getFirstMeaningfulUserMessageTextContent, getSessionIdFromLog, isCustomTitleEnabled, saveCustomTitle } from '../utils/sessionStorage.js';
import { getTheme } from '../utils/theme.js';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js';
import { Select } from './CustomSelect/select.js';
import { Byline } from './design-system/Byline.js';
import { Divider } from './design-system/Divider.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
import { SearchBox } from './SearchBox.js';
import { SessionPreview } from './SessionPreview.js';
import { Spinner } from './Spinner.js';
import { TagTabs } from './TagTabs.js';
import TextInput from './TextInput.js';
import { type TreeNode, TreeSelect } from './ui/TreeSelect.js';
type AgenticSearchState = {
  status: 'idle';
} | {
  status: 'searching';
} | {
  status: 'results';
  results: LogOption[];
  query: string;
} | {
  status: 'error';
  message: string;
};
export type LogSelectorProps = {
  logs: LogOption[];
  maxHeight?: number;
  forceWidth?: number;
  onCancel?: () => void;
  onSelect: (log: LogOption) => void;
  onLogsChanged?: () => void;
  onLoadMore?: (count: number) => void;
  initialSearchQuery?: string;
  showAllProjects?: boolean;
  onToggleAllProjects?: () => void;
  onAgenticSearch?: (query: string, logs: LogOption[], signal?: AbortSignal) => Promise<LogOption[]>;
};
type LogTreeNode = TreeNode<{
  log: LogOption;
  indexInFiltered: number;
}>;
function normalizeAndTruncateToWidth(text: string, maxWidth: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return truncateToWidth(normalized, maxWidth);
}

// Width of prefixes that TreeSelect will add
const PARENT_PREFIX_WIDTH = 2; // '▼ ' or '▶ '
const CHILD_PREFIX_WIDTH = 4; // '  ▸ '

// Deep search constants
const DEEP_SEARCH_MAX_MESSAGES = 2000;
const DEEP_SEARCH_CROP_SIZE = 1000;
const DEEP_SEARCH_MAX_TEXT_LENGTH = 50000; // Cap searchable text per session
const FUSE_THRESHOLD = 0.3;
const DATE_TIE_THRESHOLD_MS = 60 * 1000; // 1 minute - use relevance as tie-breaker within this window
const SNIPPET_CONTEXT_CHARS = 50; // Characters to show before/after match

type Snippet = {
  before: string;
  match: string;
  after: string;
};
function formatSnippet({
  before,
  match,
  after
}: Snippet, highlightColor: (text: string) => string): string {
  return chalk.dim(before) + highlightColor(match) + chalk.dim(after);
}
function extractSnippet(text: string, query: string, contextChars: number): Snippet | null {
  // Find exact query occurrence (case-insensitive).
  // Note: Fuse does fuzzy matching, so this may miss some fuzzy matches.
  // This is acceptable for now - in the future we could use Fuse's includeMatches
  // option and work with the match indices directly.
  const matchIndex = text.toLowerCase().indexOf(query.toLowerCase());
  if (matchIndex === -1) return null;
  const matchEnd = matchIndex + query.length;
  const snippetStart = Math.max(0, matchIndex - contextChars);
  const snippetEnd = Math.min(text.length, matchEnd + contextChars);
  const beforeRaw = text.slice(snippetStart, matchIndex);
  const matchText = text.slice(matchIndex, matchEnd);
  const afterRaw = text.slice(matchEnd, snippetEnd);
  return {
    before: (snippetStart > 0 ? '…' : '') + beforeRaw.replace(/\s+/g, ' ').trimStart(),
    match: matchText.trim(),
    after: afterRaw.replace(/\s+/g, ' ').trimEnd() + (snippetEnd < text.length ? '…' : '')
  };
}
function buildLogLabel(log: LogOption, maxLabelWidth: number, options?: {
  isGroupHeader?: boolean;
  isChild?: boolean;
  forkCount?: number;
}): string {
  const {
    isGroupHeader = false,
    isChild = false,
    forkCount = 0
  } = options || {};

  // TreeSelect will add the prefix, so we just need to account for its width
  const prefixWidth = isGroupHeader && forkCount > 0 ? PARENT_PREFIX_WIDTH : isChild ? CHILD_PREFIX_WIDTH : 0;
  const sessionCountSuffix = isGroupHeader && forkCount > 0 ? ` (+${forkCount} other ${forkCount === 1 ? 'session' : 'sessions'})` : '';
  const sidechainSuffix = log.isSidechain ? ' (sidechain)' : '';
  const maxSummaryWidth = maxLabelWidth - prefixWidth - sidechainSuffix.length - sessionCountSuffix.length;
  const truncatedSummary = normalizeAndTruncateToWidth(getLogDisplayTitle(log), maxSummaryWidth);
  return `${truncatedSummary}${sidechainSuffix}${sessionCountSuffix}`;
}
function buildLogMetadata(log: LogOption, options?: {
  isChild?: boolean;
  showProjectPath?: boolean;
}): string {
  const {
    isChild = false,
    showProjectPath = false
  } = options || {};
  // Match the child prefix width for proper alignment
  const childPadding = isChild ? '    ' : ''; // 4 spaces to match '  ▸ '
  const baseMetadata = formatLogMetadata(log);
  const projectSuffix = showProjectPath && log.projectPath ? ` · ${log.projectPath}` : '';
  return childPadding + baseMetadata + projectSuffix;
}
export function LogSelector(t0) {
  const $ = _c(247);
  const {
    logs,
    maxHeight: t1,
    forceWidth,
    onCancel,
    onSelect,
    onLogsChanged,
    onLoadMore,
    initialSearchQuery,
    showAllProjects: t2,
    onToggleAllProjects,
    onAgenticSearch
  } = t0;
  const maxHeight = t1 === undefined ? Infinity : t1;
  const showAllProjects = t2 === undefined ? false : t2;
  const terminalSize = useTerminalSize();
  const columns = forceWidth === undefined ? terminalSize.columns : forceWidth;
  const exitState = useExitOnCtrlCDWithKeybindings(onCancel);
  const isTerminalFocused = useTerminalFocus();
  let t3;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t3 = isCustomTitleEnabled();
    $[0] = t3;
  } else {
    t3 = $[0];
  }
  const isResumeWithRenameEnabled = t3;
  const isDeepSearchEnabled = false;
  const [themeName] = useTheme();
  let t4;
  if ($[1] !== themeName) {
    t4 = getTheme(themeName);
    $[1] = themeName;
    $[2] = t4;
  } else {
    t4 = $[2];
  }
  const theme = t4;
  let t5;
  if ($[3] !== theme.warning) {
    t5 = text => applyColor(text, theme.warning as Color);
    $[3] = theme.warning;
    $[4] = t5;
  } else {
    t5 = $[4];
  }
  const highlightColor = t5;
  const isAgenticSearchEnabled = false;
  const [currentBranch, setCurrentBranch] = React.useState(null);
  const [branchFilterEnabled, setBranchFilterEnabled] = React.useState(false);
  const [showAllWorktrees, setShowAllWorktrees] = React.useState(false);
  const [hasMultipleWorktrees, setHasMultipleWorktrees] = React.useState(false);
  let t6;
  if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
    t6 = getOriginalCwd();
    $[5] = t6;
  } else {
    t6 = $[5];
  }
  const currentCwd = t6;
  const [renameValue, setRenameValue] = React.useState("");
  const [renameCursorOffset, setRenameCursorOffset] = React.useState(0);
  let t7;
  if ($[6] === Symbol.for("react.memo_cache_sentinel")) {
    t7 = new Set();
    $[6] = t7;
  } else {
    t7 = $[6];
  }
  const [expandedGroupSessionIds, setExpandedGroupSessionIds] = React.useState(t7);
  const [focusedNode, setFocusedNode] = React.useState(null);
  const [focusedIndex, setFocusedIndex] = React.useState(1);
  const [viewMode, setViewMode] = React.useState("list");
  const [previewLog, setPreviewLog] = React.useState(null);
  const prevFocusedIdRef = React.useRef(null);
  const [selectedTagIndex, setSelectedTagIndex] = React.useState(0);
  let t8;
  if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
    t8 = {
      status: "idle"
    };
    $[7] = t8;
  } else {
    t8 = $[7];
  }
  const [agenticSearchState, setAgenticSearchState] = React.useState(t8);
  const [isAgenticSearchOptionFocused, setIsAgenticSearchOptionFocused] = React.useState(false);
  const agenticSearchAbortRef = React.useRef(null);
  const t9 = viewMode === "search" && agenticSearchState.status !== "searching";
  let t10;
  let t11;
  let t12;
  if ($[8] === Symbol.for("react.memo_cache_sentinel")) {
    t10 = () => {
      setViewMode("list");
      logEvent("tengu_session_search_toggled", {
        enabled: false
      });
    };
    t11 = () => {
      setViewMode("list");
      logEvent("tengu_session_search_toggled", {
        enabled: false
      });
    };
    t12 = ["n"];
    $[8] = t10;
    $[9] = t11;
    $[10] = t12;
  } else {
    t10 = $[8];
    t11 = $[9];
    t12 = $[10];
  }
  const t13 = initialSearchQuery || "";
  let t14;
  if ($[11] !== t13 || $[12] !== t9) {
    t14 = {
      isActive: t9,
      onExit: t10,
      onExitUp: t11,
      passthroughCtrlKeys: t12,
      initialQuery: t13
    };
    $[11] = t13;
    $[12] = t9;
    $[13] = t14;
  } else {
    t14 = $[13];
  }
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    cursorOffset: searchCursorOffset
  } = useSearchInput(t14);
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const [debouncedDeepSearchQuery, setDebouncedDeepSearchQuery] = React.useState("");
  let t15;
  let t16;
  if ($[14] !== deferredSearchQuery) {
    t15 = () => {
      if (!deferredSearchQuery) {
        setDebouncedDeepSearchQuery("");
        return;
      }
      const timeoutId = setTimeout(setDebouncedDeepSearchQuery, 300, deferredSearchQuery);
      return () => clearTimeout(timeoutId);
    };
    t16 = [deferredSearchQuery];
    $[14] = deferredSearchQuery;
    $[15] = t15;
    $[16] = t16;
  } else {
    t15 = $[15];
    t16 = $[16];
  }
  React.useEffect(t15, t16);
  const [deepSearchResults, setDeepSearchResults] = React.useState(null);
  const [isSearching, setIsSearching] = React.useState(false);
  let t17;
  let t18;
  if ($[17] === Symbol.for("react.memo_cache_sentinel")) {
    t17 = () => {
      getBranch().then(branch => setCurrentBranch(branch));
      getWorktreePaths(currentCwd).then(paths => {
        setHasMultipleWorktrees(paths.length > 1);
      });
    };
    t18 = [currentCwd];
    $[17] = t17;
    $[18] = t18;
  } else {
    t17 = $[17];
    t18 = $[18];
  }
  React.useEffect(t17, t18);
  const searchableTextByLog = new Map(logs.map(_temp));
  let t19;
  t19 = null;
  let t20;
  if ($[19] !== logs) {
    t20 = getUniqueTags(logs);
    $[19] = logs;
    $[20] = t20;
  } else {
    t20 = $[20];
  }
  const uniqueTags = t20;
  const hasTags = uniqueTags.length > 0;
  let t21;
  if ($[21] !== hasTags || $[22] !== uniqueTags) {
    t21 = hasTags ? ["All", ...uniqueTags] : [];
    $[21] = hasTags;
    $[22] = uniqueTags;
    $[23] = t21;
  } else {
    t21 = $[23];
  }
  const tagTabs = t21;
  const effectiveTagIndex = tagTabs.length > 0 && selectedTagIndex < tagTabs.length ? selectedTagIndex : 0;
  const selectedTab = tagTabs[effectiveTagIndex];
  const tagFilter = selectedTab === "All" ? undefined : selectedTab;
  const tagTabsLines = hasTags ? 1 : 0;
  let filtered = logs;
  if (isResumeWithRenameEnabled) {
    let t22;
    if ($[24] !== logs) {
      t22 = logs.filter(_temp2);
      $[24] = logs;
      $[25] = t22;
    } else {
      t22 = $[25];
    }
    filtered = t22;
  }
  if (tagFilter !== undefined) {
    let t22;
    if ($[26] !== filtered || $[27] !== tagFilter) {
      let t23;
      if ($[29] !== tagFilter) {
        t23 = log_2 => log_2.tag === tagFilter;
        $[29] = tagFilter;
        $[30] = t23;
      } else {
        t23 = $[30];
      }
      t22 = filtered.filter(t23);
      $[26] = filtered;
      $[27] = tagFilter;
      $[28] = t22;
    } else {
      t22 = $[28];
    }
    filtered = t22;
  }
  if (branchFilterEnabled && currentBranch) {
    let t22;
    if ($[31] !== currentBranch || $[32] !== filtered) {
      let t23;
      if ($[34] !== currentBranch) {
        t23 = log_3 => log_3.gitBranch === currentBranch;
        $[34] = currentBranch;
        $[35] = t23;
      } else {
        t23 = $[35];
      }
      t22 = filtered.filter(t23);
      $[31] = currentBranch;
      $[32] = filtered;
      $[33] = t22;
    } else {
      t22 = $[33];
    }
    filtered = t22;
  }
  if (hasMultipleWorktrees && !showAllWorktrees) {
    let t22;
    if ($[36] !== filtered) {
      let t23;
      if ($[38] === Symbol.for("react.memo_cache_sentinel")) {
        t23 = log_4 => log_4.projectPath === currentCwd;
        $[38] = t23;
      } else {
        t23 = $[38];
      }
      t22 = filtered.filter(t23);
      $[36] = filtered;
      $[37] = t22;
    } else {
      t22 = $[37];
    }
    filtered = t22;
  }
  const baseFilteredLogs = filtered;
  let t22;
  bb0: {
    if (!searchQuery) {
      t22 = baseFilteredLogs;
      break bb0;
    }
    let t23;
    if ($[39] !== baseFilteredLogs || $[40] !== searchQuery) {
      const query = searchQuery.toLowerCase();
      t23 = baseFilteredLogs.filter(log_5 => {
        const displayedTitle = getLogDisplayTitle(log_5).toLowerCase();
        const branch_0 = (log_5.gitBranch || "").toLowerCase();
        const tag = (log_5.tag || "").toLowerCase();
        const prInfo = log_5.prNumber ? `pr #${log_5.prNumber} ${log_5.prRepository || ""}`.toLowerCase() : "";
        return displayedTitle.includes(query) || branch_0.includes(query) || tag.includes(query) || prInfo.includes(query);
      });
      $[39] = baseFilteredLogs;
      $[40] = searchQuery;
      $[41] = t23;
    } else {
      t23 = $[41];
    }
    t22 = t23;
  }
  const titleFilteredLogs = t22;
  let t23;
  let t24;
  if ($[42] !== debouncedDeepSearchQuery || $[43] !== deferredSearchQuery) {
    t23 = () => {
      if (false && deferredSearchQuery && deferredSearchQuery !== debouncedDeepSearchQuery) {
        setIsSearching(true);
      }
    };
    t24 = [deferredSearchQuery, debouncedDeepSearchQuery, false];
    $[42] = debouncedDeepSearchQuery;
    $[43] = deferredSearchQuery;
    $[44] = t23;
    $[45] = t24;
  } else {
    t23 = $[44];
    t24 = $[45];
  }
  React.useEffect(t23, t24);
  let t25;
  let t26;
  if ($[46] !== debouncedDeepSearchQuery) {
    t25 = () => {
      if (true || !debouncedDeepSearchQuery || true) {
        setDeepSearchResults(null);
        setIsSearching(false);
        return;
      }
      const timeoutId_0 = setTimeout(_temp5, 0, null, debouncedDeepSearchQuery, setDeepSearchResults, setIsSearching);
      return () => {
        clearTimeout(timeoutId_0);
      };
    };
    t26 = [debouncedDeepSearchQuery, null, false];
    $[46] = debouncedDeepSearchQuery;
    $[47] = t25;
    $[48] = t26;
  } else {
    t25 = $[47];
    t26 = $[48];
  }
  React.useEffect(t25, t26);
  let filtered_0;
  let snippetMap;
  if ($[49] !== debouncedDeepSearchQuery || $[50] !== deepSearchResults || $[51] !== titleFilteredLogs) {
    snippetMap = new Map();
    filtered_0 = titleFilteredLogs;
    if (deepSearchResults && debouncedDeepSearchQuery && deepSearchResults.query === debouncedDeepSearchQuery) {
      for (const result of deepSearchResults.results) {
        if (result.searchableText) {
          const snippet = extractSnippet(result.searchableText, debouncedDeepSearchQuery, SNIPPET_CONTEXT_CHARS);
          if (snippet) {
            snippetMap.set(result.log, snippet);
          }
        }
      }
      let t27;
      if ($[54] !== filtered_0) {
        t27 = new Set(filtered_0.map(_temp6));
        $[54] = filtered_0;
        $[55] = t27;
      } else {
        t27 = $[55];
      }
      const titleMatchIds = t27;
      let t28;
      if ($[56] !== deepSearchResults.results || $[57] !== filtered_0 || $[58] !== titleMatchIds) {
        let t29;
        if ($[60] !== titleMatchIds) {
          t29 = log_7 => !titleMatchIds.has(log_7.messages[0]?.uuid);
          $[60] = titleMatchIds;
          $[61] = t29;
        } else {
          t29 = $[61];
        }
        const transcriptOnlyMatches = deepSearchResults.results.map(_temp7).filter(t29);
        t28 = [...filtered_0, ...transcriptOnlyMatches];
        $[56] = deepSearchResults.results;
        $[57] = filtered_0;
        $[58] = titleMatchIds;
        $[59] = t28;
      } else {
        t28 = $[59];
      }
      filtered_0 = t28;
    }
    $[49] = debouncedDeepSearchQuery;
    $[50] = deepSearchResults;
    $[51] = titleFilteredLogs;
    $[52] = filtered_0;
    $[53] = snippetMap;
  } else {
    filtered_0 = $[52];
    snippetMap = $[53];
  }
  let t27;
  if ($[62] !== filtered_0 || $[63] !== snippetMap) {
    t27 = {
      filteredLogs: filtered_0,
      snippets: snippetMap
    };
    $[62] = filtered_0;
    $[63] = snippetMap;
    $[64] = t27;
  } else {
    t27 = $[64];
  }
  const {
    filteredLogs,
    snippets
  } = t27;
  let t28;
  bb1: {
    if (agenticSearchState.status === "results" && agenticSearchState.results.length > 0) {
      t28 = agenticSearchState.results;
      break bb1;
    }
    t28 = filteredLogs;
  }
  const displayedLogs = t28;
  const maxLabelWidth = Math.max(30, columns - 4);
  let t29;
  bb2: {
    if (!isResumeWithRenameEnabled) {
      let t30;
      if ($[65] === Symbol.for("react.memo_cache_sentinel")) {
        t30 = [];
        $[65] = t30;
      } else {
        t30 = $[65];
      }
      t29 = t30;
      break bb2;
    }
    let t30;
    if ($[66] !== displayedLogs || $[67] !== highlightColor || $[68] !== maxLabelWidth || $[69] !== showAllProjects || $[70] !== snippets) {
      const sessionGroups = groupLogsBySessionId(displayedLogs);
      t30 = Array.from(sessionGroups.entries()).map(t31 => {
        const [sessionId, groupLogs] = t31;
        const latestLog = groupLogs[0];
        const indexInFiltered = displayedLogs.indexOf(latestLog);
        const snippet_0 = snippets.get(latestLog);
        const snippetStr = snippet_0 ? formatSnippet(snippet_0, highlightColor) : null;
        if (groupLogs.length === 1) {
          const metadata = buildLogMetadata(latestLog, {
            showProjectPath: showAllProjects
          });
          return {
            id: `log:${sessionId}:0`,
            value: {
              log: latestLog,
              indexInFiltered
            },
            label: buildLogLabel(latestLog, maxLabelWidth),
            description: snippetStr ? `${metadata}\n  ${snippetStr}` : metadata,
            dimDescription: true
          };
        }
        const forkCount = groupLogs.length - 1;
        const children = groupLogs.slice(1).map((log_8, index) => {
          const childIndexInFiltered = displayedLogs.indexOf(log_8);
          const childSnippet = snippets.get(log_8);
          const childSnippetStr = childSnippet ? formatSnippet(childSnippet, highlightColor) : null;
          const childMetadata = buildLogMetadata(log_8, {
            isChild: true,
            showProjectPath: showAllProjects
          });
          return {
            id: `log:${sessionId}:${index + 1}`,
            value: {
              log: log_8,
              indexInFiltered: childIndexInFiltered
            },
            label: buildLogLabel(log_8, maxLabelWidth, {
              isChild: true
            }),
            description: childSnippetStr ? `${childMetadata}\n      ${childSnippetStr}` : childMetadata,
            dimDescription: true
          };
        });
        const parentMetadata = buildLogMetadata(latestLog, {
          showProjectPath: showAllProjects
        });
        return {
          id: `group:${sessionId}`,
          value: {
            log: latestLog,
            indexInFiltered
          },
          label: buildLogLabel(latestLog, maxLabelWidth, {
            isGroupHeader: true,
            forkCount
          }),
          description: snippetStr ? `${parentMetadata}\n  ${snippetStr}` : parentMetadata,
          dimDescription: true,
          children
        };
      });
      $[66] = displayedLogs;
      $[67] = highlightColor;
      $[68] = maxLabelWidth;
      $[69] = showAllProjects;
      $[70] = snippets;
      $[71] = t30;
    } else {
      t30 = $[71];
    }
    t29 = t30;
  }
  const treeNodes = t29;
  let t30;
  bb3: {
    if (isResumeWithRenameEnabled) {
      let t31;
      if ($[72] === Symbol.for("react.memo_cache_sentinel")) {
        t31 = [];
        $[72] = t31;
      } else {
        t31 = $[72];
      }
      t30 = t31;
      break bb3;
    }
    let t31;
    if ($[73] !== displayedLogs || $[74] !== highlightColor || $[75] !== maxLabelWidth || $[76] !== showAllProjects || $[77] !== snippets) {
      let t32;
      if ($[79] !== highlightColor || $[80] !== maxLabelWidth || $[81] !== showAllProjects || $[82] !== snippets) {
        t32 = (log_9, index_0) => {
          const rawSummary = getLogDisplayTitle(log_9);
          const summaryWithSidechain = rawSummary + (log_9.isSidechain ? " (sidechain)" : "");
          const summary = normalizeAndTruncateToWidth(summaryWithSidechain, maxLabelWidth);
          const baseDescription = formatLogMetadata(log_9);
          const projectSuffix = showAllProjects && log_9.projectPath ? ` · ${log_9.projectPath}` : "";
          const snippet_1 = snippets.get(log_9);
          const snippetStr_0 = snippet_1 ? formatSnippet(snippet_1, highlightColor) : null;
          return {
            label: summary,
            description: snippetStr_0 ? `${baseDescription}${projectSuffix}\n  ${snippetStr_0}` : baseDescription + projectSuffix,
            dimDescription: true,
            value: index_0.toString()
          };
        };
        $[79] = highlightColor;
        $[80] = maxLabelWidth;
        $[81] = showAllProjects;
        $[82] = snippets;
        $[83] = t32;
      } else {
        t32 = $[83];
      }
      t31 = displayedLogs.map(t32);
      $[73] = displayedLogs;
      $[74] = highlightColor;
      $[75] = maxLabelWidth;
      $[76] = showAllProjects;
      $[77] = snippets;
      $[78] = t31;
    } else {
      t31 = $[78];
    }
    t30 = t31;
  }
  const flatOptions = t30;
  const focusedLog = focusedNode?.value.log ?? null;
  let t31;
  if ($[84] !== displayedLogs || $[85] !== expandedGroupSessionIds || $[86] !== focusedLog) {
    t31 = () => {
      if (!isResumeWithRenameEnabled || !focusedLog) {
        return "";
      }
      const sessionId_0 = getSessionIdFromLog(focusedLog);
      if (!sessionId_0) {
        return "";
      }
      const sessionLogs = displayedLogs.filter(log_10 => getSessionIdFromLog(log_10) === sessionId_0);
      const hasMultipleLogs = sessionLogs.length > 1;
      if (!hasMultipleLogs) {
        return "";
      }
      const isExpanded = expandedGroupSessionIds.has(sessionId_0);
      const isChildNode = sessionLogs.indexOf(focusedLog) > 0;
      if (isChildNode) {
        return "\u2190 to collapse";
      }
      return isExpanded ? "\u2190 to collapse" : "\u2192 to expand";
    };
    $[84] = displayedLogs;
    $[85] = expandedGroupSessionIds;
    $[86] = focusedLog;
    $[87] = t31;
  } else {
    t31 = $[87];
  }
  const getExpandCollapseHint = t31;
  let t32;
  if ($[88] !== focusedLog || $[89] !== onLogsChanged || $[90] !== renameValue) {
    t32 = async () => {
      const sessionId_1 = focusedLog ? getSessionIdFromLog(focusedLog) : undefined;
      if (!focusedLog || !sessionId_1) {
        setViewMode("list");
        setRenameValue("");
        return;
      }
      if (renameValue.trim()) {
        await saveCustomTitle(sessionId_1, renameValue.trim(), focusedLog.fullPath);
        if (isResumeWithRenameEnabled && onLogsChanged) {
          onLogsChanged();
        }
      }
      setViewMode("list");
      setRenameValue("");
    };
    $[88] = focusedLog;
    $[89] = onLogsChanged;
    $[90] = renameValue;
    $[91] = t32;
  } else {
    t32 = $[91];
  }
  const handleRenameSubmit = t32;
  let t33;
  if ($[92] === Symbol.for("react.memo_cache_sentinel")) {
    t33 = () => {
      setViewMode("list");
      logEvent("tengu_session_search_toggled", {
        enabled: false
      });
    };
    $[92] = t33;
  } else {
    t33 = $[92];
  }
  const exitSearchMode = t33;
  let t34;
  if ($[93] === Symbol.for("react.memo_cache_sentinel")) {
    t34 = () => {
      setViewMode("search");
      logEvent("tengu_session_search_toggled", {
        enabled: true
      });
    };
    $[93] = t34;
  } else {
    t34 = $[93];
  }
  const enterSearchMode = t34;
  let t35;
  if ($[94] !== logs || $[95] !== onAgenticSearch || $[96] !== searchQuery) {
    t35 = async () => {
      if (!searchQuery.trim() || !onAgenticSearch || true) {
        return;
      }
      agenticSearchAbortRef.current?.abort();
      const abortController = new AbortController();
      agenticSearchAbortRef.current = abortController;
      setAgenticSearchState({
        status: "searching"
      });
      logEvent("tengu_agentic_search_started", {
        query_length: searchQuery.length
      });
      ;
      try {
        const results_0 = await onAgenticSearch(searchQuery, logs, abortController.signal);
        if (abortController.signal.aborted) {
          return;
        }
        setAgenticSearchState({
          status: "results",
          results: results_0,
          query: searchQuery
        });
        logEvent("tengu_agentic_search_completed", {
          query_length: searchQuery.length,
          results_count: results_0.length
        });
      } catch (t36) {
        const error = t36;
        if (abortController.signal.aborted) {
          return;
        }
        setAgenticSearchState({
          status: "error",
          message: error instanceof Error ? error.message : "Search failed"
        });
        logEvent("tengu_agentic_search_error", {
          query_length: searchQuery.length
        });
      }
    };
    $[94] = logs;
    $[95] = onAgenticSearch;
    $[96] = searchQuery;
    $[97] = t35;
  } else {
    t35 = $[97];
  }
  const handleAgenticSearch = t35;
  let t36;
  if ($[98] !== agenticSearchState.query || $[99] !== agenticSearchState.status || $[100] !== searchQuery) {
    t36 = () => {
      if (agenticSearchState.status !== "idle" && agenticSearchState.status !== "searching") {
        if (agenticSearchState.status === "results" && agenticSearchState.query !== searchQuery || agenticSearchState.status === "error") {
          setAgenticSearchState({
            status: "idle"
          });
        }
      }
    };
    $[98] = agenticSearchState.query;
    $[99] = agenticSearchState.status;
    $[100] = searchQuery;
    $[101] = t36;
  } else {
    t36 = $[101];
  }
  let t37;
  if ($[102] !== agenticSearchState || $[103] !== searchQuery) {
    t37 = [searchQuery, agenticSearchState];
    $[102] = agenticSearchState;
    $[103] = searchQuery;
    $[104] = t37;
  } else {
    t37 = $[104];
  }
  React.useEffect(t36, t37);
  let t38;
  let t39;
  if ($[105] === Symbol.for("react.memo_cache_sentinel")) {
    t38 = () => () => {
      agenticSearchAbortRef.current?.abort();
    };
    t39 = [];
    $[105] = t38;
    $[106] = t39;
  } else {
    t38 = $[105];
    t39 = $[106];
  }
  React.useEffect(t38, t39);
  const prevAgenticStatusRef = React.useRef(agenticSearchState.status);
  let t40;
  if ($[107] !== agenticSearchState.status || $[108] !== displayedLogs[0] || $[109] !== displayedLogs.length || $[110] !== treeNodes) {
    t40 = () => {
      const prevStatus = prevAgenticStatusRef.current;
      prevAgenticStatusRef.current = agenticSearchState.status;
      if (prevStatus === "searching" && agenticSearchState.status === "results") {
        if (isResumeWithRenameEnabled && treeNodes.length > 0) {
          setFocusedNode(treeNodes[0]);
        } else {
          if (!isResumeWithRenameEnabled && displayedLogs.length > 0) {
            const firstLog = displayedLogs[0];
            setFocusedNode({
              id: "0",
              value: {
                log: firstLog,
                indexInFiltered: 0
              },
              label: ""
            });
          }
        }
      }
    };
    $[107] = agenticSearchState.status;
    $[108] = displayedLogs[0];
    $[109] = displayedLogs.length;
    $[110] = treeNodes;
    $[111] = t40;
  } else {
    t40 = $[111];
  }
  let t41;
  if ($[112] !== agenticSearchState.status || $[113] !== displayedLogs || $[114] !== treeNodes) {
    t41 = [agenticSearchState.status, isResumeWithRenameEnabled, treeNodes, displayedLogs];
    $[112] = agenticSearchState.status;
    $[113] = displayedLogs;
    $[114] = treeNodes;
    $[115] = t41;
  } else {
    t41 = $[115];
  }
  React.useEffect(t40, t41);
  let t42;
  if ($[116] !== displayedLogs) {
    t42 = value => {
      const index_1 = parseInt(value, 10);
      const log_11 = displayedLogs[index_1];
      if (!log_11 || prevFocusedIdRef.current === index_1.toString()) {
        return;
      }
      prevFocusedIdRef.current = index_1.toString();
      setFocusedNode({
        id: index_1.toString(),
        value: {
          log: log_11,
          indexInFiltered: index_1
        },
        label: ""
      });
      setFocusedIndex(index_1 + 1);
    };
    $[116] = displayedLogs;
    $[117] = t42;
  } else {
    t42 = $[117];
  }
  const handleFlatOptionsSelectFocus = t42;
  let t43;
  if ($[118] !== displayedLogs) {
    t43 = node => {
      setFocusedNode(node);
      const index_2 = displayedLogs.findIndex(log_12 => getSessionIdFromLog(log_12) === getSessionIdFromLog(node.value.log));
      if (index_2 >= 0) {
        setFocusedIndex(index_2 + 1);
      }
    };
    $[118] = displayedLogs;
    $[119] = t43;
  } else {
    t43 = $[119];
  }
  const handleTreeSelectFocus = t43;
  let t44;
  if ($[120] === Symbol.for("react.memo_cache_sentinel")) {
    t44 = () => {
      agenticSearchAbortRef.current?.abort();
      setAgenticSearchState({
        status: "idle"
      });
      logEvent("tengu_agentic_search_cancelled", {});
    };
    $[120] = t44;
  } else {
    t44 = $[120];
  }
  const t45 = viewMode !== "preview" && agenticSearchState.status === "searching";
  let t46;
  if ($[121] !== t45) {
    t46 = {
      context: "Confirmation",
      isActive: t45
    };
    $[121] = t45;
    $[122] = t46;
  } else {
    t46 = $[122];
  }
  useKeybinding("confirm:no", t44, t46);
  let t47;
  if ($[123] === Symbol.for("react.memo_cache_sentinel")) {
    t47 = () => {
      setViewMode("list");
      setRenameValue("");
    };
    $[123] = t47;
  } else {
    t47 = $[123];
  }
  const t48 = viewMode === "rename" && agenticSearchState.status !== "searching";
  let t49;
  if ($[124] !== t48) {
    t49 = {
      context: "Settings",
      isActive: t48
    };
    $[124] = t48;
    $[125] = t49;
  } else {
    t49 = $[125];
  }
  useKeybinding("confirm:no", t47, t49);
  let t50;
  if ($[126] !== onCancel || $[127] !== setSearchQuery) {
    t50 = () => {
      setSearchQuery("");
      setIsAgenticSearchOptionFocused(false);
      onCancel?.();
    };
    $[126] = onCancel;
    $[127] = setSearchQuery;
    $[128] = t50;
  } else {
    t50 = $[128];
  }
  const t51 = viewMode !== "preview" && viewMode !== "rename" && viewMode !== "search" && isAgenticSearchOptionFocused && agenticSearchState.status !== "searching";
  let t52;
  if ($[129] !== t51) {
    t52 = {
      context: "Confirmation",
      isActive: t51
    };
    $[129] = t51;
    $[130] = t52;
  } else {
    t52 = $[130];
  }
  useKeybinding("confirm:no", t50, t52);
  let t53;
  if ($[131] !== agenticSearchState.status || $[132] !== branchFilterEnabled || $[133] !== focusedLog || $[134] !== handleAgenticSearch || $[135] !== hasMultipleWorktrees || $[136] !== hasTags || $[137] !== isAgenticSearchOptionFocused || $[138] !== onAgenticSearch || $[139] !== onToggleAllProjects || $[140] !== searchQuery || $[141] !== setSearchQuery || $[142] !== showAllProjects || $[143] !== showAllWorktrees || $[144] !== tagTabs || $[145] !== uniqueTags || $[146] !== viewMode) {
    t53 = (input, key) => {
      if (viewMode === "preview") {
        return;
      }
      if (agenticSearchState.status === "searching") {
        return;
      }
      if (viewMode === "rename") {} else {
        if (viewMode === "search") {
          if (input.toLowerCase() === "n" && key.ctrl) {
            exitSearchMode();
          } else {
            if (key.return || key.downArrow) {
              if (searchQuery.trim() && onAgenticSearch && false && agenticSearchState.status !== "results") {
                setIsAgenticSearchOptionFocused(true);
              }
            }
          }
        } else {
          if (isAgenticSearchOptionFocused) {
            if (key.return) {
              handleAgenticSearch();
              setIsAgenticSearchOptionFocused(false);
              return;
            } else {
              if (key.downArrow) {
                setIsAgenticSearchOptionFocused(false);
                return;
              } else {
                if (key.upArrow) {
                  setViewMode("search");
                  setIsAgenticSearchOptionFocused(false);
                  return;
                }
              }
            }
          }
          if (hasTags && key.tab) {
            const offset = key.shift ? -1 : 1;
            setSelectedTagIndex(prev => {
              const current = prev < tagTabs.length ? prev : 0;
              const newIndex = (current + tagTabs.length + offset) % tagTabs.length;
              const newTab = tagTabs[newIndex];
              logEvent("tengu_session_tag_filter_changed", {
                is_all: newTab === "All",
                tag_count: uniqueTags.length
              });
              return newIndex;
            });
            return;
          }
          const keyIsNotCtrlOrMeta = !key.ctrl && !key.meta;
          const lowerInput = input.toLowerCase();
          if (lowerInput === "a" && key.ctrl && onToggleAllProjects) {
            onToggleAllProjects();
            logEvent("tengu_session_all_projects_toggled", {
              enabled: !showAllProjects
            });
          } else {
            if (lowerInput === "b" && key.ctrl) {
              const newEnabled = !branchFilterEnabled;
              setBranchFilterEnabled(newEnabled);
              logEvent("tengu_session_branch_filter_toggled", {
                enabled: newEnabled
              });
            } else {
              if (lowerInput === "w" && key.ctrl && hasMultipleWorktrees) {
                const newValue = !showAllWorktrees;
                setShowAllWorktrees(newValue);
                logEvent("tengu_session_worktree_filter_toggled", {
                  enabled: newValue
                });
              } else {
                if (lowerInput === "/" && keyIsNotCtrlOrMeta) {
                  setViewMode("search");
                  logEvent("tengu_session_search_toggled", {
                    enabled: true
                  });
                } else {
                  if (lowerInput === "r" && key.ctrl && focusedLog) {
                    setViewMode("rename");
                    setRenameValue("");
                    logEvent("tengu_session_rename_started", {});
                  } else {
                    if (lowerInput === "v" && key.ctrl && focusedLog) {
                      setPreviewLog(focusedLog);
                      setViewMode("preview");
                      logEvent("tengu_session_preview_opened", {
                        messageCount: focusedLog.messageCount
                      });
                    } else {
                      if (focusedLog && keyIsNotCtrlOrMeta && input.length > 0 && !/^\s+$/.test(input)) {
                        setViewMode("search");
                        setSearchQuery(input);
                        logEvent("tengu_session_search_toggled", {
                          enabled: true
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    $[131] = agenticSearchState.status;
    $[132] = branchFilterEnabled;
    $[133] = focusedLog;
    $[134] = handleAgenticSearch;
    $[135] = hasMultipleWorktrees;
    $[136] = hasTags;
    $[137] = isAgenticSearchOptionFocused;
    $[138] = onAgenticSearch;
    $[139] = onToggleAllProjects;
    $[140] = searchQuery;
    $[141] = setSearchQuery;
    $[142] = showAllProjects;
    $[143] = showAllWorktrees;
    $[144] = tagTabs;
    $[145] = uniqueTags;
    $[146] = viewMode;
    $[147] = t53;
  } else {
    t53 = $[147];
  }
  let t54;
  if ($[148] === Symbol.for("react.memo_cache_sentinel")) {
    t54 = {
      isActive: true
    };
    $[148] = t54;
  } else {
    t54 = $[148];
  }
  useInput(t53, t54);
  let filterIndicators;
  if ($[149] !== branchFilterEnabled || $[150] !== currentBranch || $[151] !== hasMultipleWorktrees || $[152] !== showAllWorktrees) {
    filterIndicators = [];
    if (branchFilterEnabled && currentBranch) {
      filterIndicators.push(currentBranch);
    }
    if (hasMultipleWorktrees && !showAllWorktrees) {
      filterIndicators.push("current worktree");
    }
    $[149] = branchFilterEnabled;
    $[150] = currentBranch;
    $[151] = hasMultipleWorktrees;
    $[152] = showAllWorktrees;
    $[153] = filterIndicators;
  } else {
    filterIndicators = $[153];
  }
  const showAdditionalFilterLine = filterIndicators.length > 0 && viewMode !== "search";
  const headerLines = 8 + (showAdditionalFilterLine ? 1 : 0) + tagTabsLines;
  const visibleCount = Math.max(1, Math.floor((maxHeight - headerLines - 2) / 3));
  let t55;
  let t56;
  if ($[154] !== displayedLogs.length || $[155] !== focusedIndex || $[156] !== onLoadMore || $[157] !== visibleCount) {
    t55 = () => {
      if (!onLoadMore) {
        return;
      }
      const buffer = visibleCount * 2;
      if (focusedIndex + buffer >= displayedLogs.length) {
        onLoadMore(visibleCount * 3);
      }
    };
    t56 = [focusedIndex, visibleCount, displayedLogs.length, onLoadMore];
    $[154] = displayedLogs.length;
    $[155] = focusedIndex;
    $[156] = onLoadMore;
    $[157] = visibleCount;
    $[158] = t55;
    $[159] = t56;
  } else {
    t55 = $[158];
    t56 = $[159];
  }
  React.useEffect(t55, t56);
  if (logs.length === 0) {
    return null;
  }
  if (viewMode === "preview" && previewLog && isResumeWithRenameEnabled) {
    let t57;
    if ($[160] === Symbol.for("react.memo_cache_sentinel")) {
      t57 = () => {
        setViewMode("list");
        setPreviewLog(null);
      };
      $[160] = t57;
    } else {
      t57 = $[160];
    }
    let t58;
    if ($[161] !== onSelect || $[162] !== previewLog) {
      t58 = <SessionPreview log={previewLog} onExit={t57} onSelect={onSelect} />;
      $[161] = onSelect;
      $[162] = previewLog;
      $[163] = t58;
    } else {
      t58 = $[163];
    }
    return t58;
  }
  const t57 = maxHeight - 1;
  let t58;
  if ($[164] === Symbol.for("react.memo_cache_sentinel")) {
    t58 = <Box flexShrink={0}><Divider color="suggestion" /></Box>;
    $[164] = t58;
  } else {
    t58 = $[164];
  }
  let t59;
  if ($[165] === Symbol.for("react.memo_cache_sentinel")) {
    t59 = <Box flexShrink={0}><Text> </Text></Box>;
    $[165] = t59;
  } else {
    t59 = $[165];
  }
  let t60;
  if ($[166] !== columns || $[167] !== displayedLogs.length || $[168] !== effectiveTagIndex || $[169] !== focusedIndex || $[170] !== hasTags || $[171] !== showAllProjects || $[172] !== tagTabs || $[173] !== viewMode || $[174] !== visibleCount) {
    t60 = hasTags ? <TagTabs tabs={tagTabs} selectedIndex={effectiveTagIndex} availableWidth={columns} showAllProjects={showAllProjects} /> : <Box flexShrink={0}><Text bold={true} color="suggestion">Resume Session{viewMode === "list" && displayedLogs.length > visibleCount && <Text dimColor={true}>{" "}({focusedIndex} of {displayedLogs.length})</Text>}</Text></Box>;
    $[166] = columns;
    $[167] = displayedLogs.length;
    $[168] = effectiveTagIndex;
    $[169] = focusedIndex;
    $[170] = hasTags;
    $[171] = showAllProjects;
    $[172] = tagTabs;
    $[173] = viewMode;
    $[174] = visibleCount;
    $[175] = t60;
  } else {
    t60 = $[175];
  }
  const t61 = viewMode === "search";
  let t62;
  if ($[176] !== isTerminalFocused || $[177] !== searchCursorOffset || $[178] !== searchQuery || $[179] !== t61) {
    t62 = <SearchBox query={searchQuery} isFocused={t61} isTerminalFocused={isTerminalFocused} cursorOffset={searchCursorOffset} />;
    $[176] = isTerminalFocused;
    $[177] = searchCursorOffset;
    $[178] = searchQuery;
    $[179] = t61;
    $[180] = t62;
  } else {
    t62 = $[180];
  }
  let t63;
  if ($[181] !== filterIndicators || $[182] !== viewMode) {
    t63 = filterIndicators.length > 0 && viewMode !== "search" && <Box flexShrink={0} paddingLeft={2}><Text dimColor={true}><Byline>{filterIndicators}</Byline></Text></Box>;
    $[181] = filterIndicators;
    $[182] = viewMode;
    $[183] = t63;
  } else {
    t63 = $[183];
  }
  let t64;
  if ($[184] === Symbol.for("react.memo_cache_sentinel")) {
    t64 = <Box flexShrink={0}><Text> </Text></Box>;
    $[184] = t64;
  } else {
    t64 = $[184];
  }
  let t65;
  if ($[185] !== agenticSearchState.status) {
    t65 = agenticSearchState.status === "searching" && <Box paddingLeft={1} flexShrink={0}><Spinner /><Text> Searching…</Text></Box>;
    $[185] = agenticSearchState.status;
    $[186] = t65;
  } else {
    t65 = $[186];
  }
  let t66;
  if ($[187] !== agenticSearchState.results || $[188] !== agenticSearchState.status) {
    t66 = agenticSearchState.status === "results" && agenticSearchState.results.length > 0 && <Box paddingLeft={1} marginBottom={1} flexShrink={0}><Text dimColor={true} italic={true}>Claude found these results:</Text></Box>;
    $[187] = agenticSearchState.results;
    $[188] = agenticSearchState.status;
    $[189] = t66;
  } else {
    t66 = $[189];
  }
  let t67;
  if ($[190] !== agenticSearchState.results || $[191] !== agenticSearchState.status || $[192] !== filteredLogs) {
    t67 = agenticSearchState.status === "results" && agenticSearchState.results.length === 0 && filteredLogs.length === 0 && <Box paddingLeft={1} marginBottom={1} flexShrink={0}><Text dimColor={true} italic={true}>No matching sessions found.</Text></Box>;
    $[190] = agenticSearchState.results;
    $[191] = agenticSearchState.status;
    $[192] = filteredLogs;
    $[193] = t67;
  } else {
    t67 = $[193];
  }
  let t68;
  if ($[194] !== agenticSearchState.status || $[195] !== filteredLogs) {
    t68 = agenticSearchState.status === "error" && filteredLogs.length === 0 && <Box paddingLeft={1} marginBottom={1} flexShrink={0}><Text dimColor={true} italic={true}>No matching sessions found.</Text></Box>;
    $[194] = agenticSearchState.status;
    $[195] = filteredLogs;
    $[196] = t68;
  } else {
    t68 = $[196];
  }
  let t69;
  if ($[197] !== agenticSearchState.status || $[198] !== isAgenticSearchOptionFocused || $[199] !== onAgenticSearch || $[200] !== searchQuery) {
    t69 = Boolean(searchQuery.trim()) && onAgenticSearch && false && agenticSearchState.status !== "searching" && agenticSearchState.status !== "results" && agenticSearchState.status !== "error" && <Box flexShrink={0} flexDirection="column"><Box flexDirection="row" gap={1}><Text color={isAgenticSearchOptionFocused ? "suggestion" : undefined}>{isAgenticSearchOptionFocused ? figures.pointer : " "}</Text><Text color={isAgenticSearchOptionFocused ? "suggestion" : undefined} bold={isAgenticSearchOptionFocused}>Search deeply using Claude →</Text></Box><Box height={1} /></Box>;
    $[197] = agenticSearchState.status;
    $[198] = isAgenticSearchOptionFocused;
    $[199] = onAgenticSearch;
    $[200] = searchQuery;
    $[201] = t69;
  } else {
    t69 = $[201];
  }
  let t70;
  if ($[202] !== agenticSearchState.status || $[203] !== branchFilterEnabled || $[204] !== columns || $[205] !== displayedLogs || $[206] !== expandedGroupSessionIds || $[207] !== flatOptions || $[208] !== focusedLog || $[209] !== focusedNode?.id || $[210] !== handleFlatOptionsSelectFocus || $[211] !== handleRenameSubmit || $[212] !== handleTreeSelectFocus || $[213] !== isAgenticSearchOptionFocused || $[214] !== onCancel || $[215] !== onSelect || $[216] !== renameCursorOffset || $[217] !== renameValue || $[218] !== treeNodes || $[219] !== viewMode || $[220] !== visibleCount) {
    t70 = agenticSearchState.status === "searching" ? null : viewMode === "rename" && focusedLog ? <Box paddingLeft={2} flexDirection="column"><Text bold={true}>Rename session:</Text><Box paddingTop={1}><TextInput value={renameValue} onChange={setRenameValue} onSubmit={handleRenameSubmit} placeholder={getLogDisplayTitle(focusedLog, "Enter new session name")} columns={columns} cursorOffset={renameCursorOffset} onChangeCursorOffset={setRenameCursorOffset} showCursor={true} /></Box></Box> : isResumeWithRenameEnabled ? <TreeSelect nodes={treeNodes} onSelect={node_0 => {
      onSelect(node_0.value.log);
    }} onFocus={handleTreeSelectFocus} onCancel={onCancel} focusNodeId={focusedNode?.id} visibleOptionCount={visibleCount} layout="expanded" isDisabled={viewMode === "search" || isAgenticSearchOptionFocused} hideIndexes={false} isNodeExpanded={nodeId => {
      if (viewMode === "search" || branchFilterEnabled) {
        return true;
      }
      const sessionId_2 = typeof nodeId === "string" && nodeId.startsWith("group:") ? nodeId.substring(6) : null;
      return sessionId_2 ? expandedGroupSessionIds.has(sessionId_2) : false;
    }} onExpand={nodeId_0 => {
      const sessionId_3 = typeof nodeId_0 === "string" && nodeId_0.startsWith("group:") ? nodeId_0.substring(6) : null;
      if (sessionId_3) {
        setExpandedGroupSessionIds(prev_0 => new Set(prev_0).add(sessionId_3));
        logEvent("tengu_session_group_expanded", {});
      }
    }} onCollapse={nodeId_1 => {
      const sessionId_4 = typeof nodeId_1 === "string" && nodeId_1.startsWith("group:") ? nodeId_1.substring(6) : null;
      if (sessionId_4) {
        setExpandedGroupSessionIds(prev_1 => {
          const newSet = new Set(prev_1);
          newSet.delete(sessionId_4);
          return newSet;
        });
      }
    }} onUpFromFirstItem={enterSearchMode} /> : <Select options={flatOptions} onChange={value_0 => {
      const itemIndex = parseInt(value_0, 10);
      const log_13 = displayedLogs[itemIndex];
      if (log_13) {
        onSelect(log_13);
      }
    }} visibleOptionCount={visibleCount} onCancel={onCancel} onFocus={handleFlatOptionsSelectFocus} defaultFocusValue={focusedNode?.id.toString()} layout="expanded" isDisabled={viewMode === "search" || isAgenticSearchOptionFocused} onUpFromFirstItem={enterSearchMode} />;
    $[202] = agenticSearchState.status;
    $[203] = branchFilterEnabled;
    $[204] = columns;
    $[205] = displayedLogs;
    $[206] = expandedGroupSessionIds;
    $[207] = flatOptions;
    $[208] = focusedLog;
    $[209] = focusedNode?.id;
    $[210] = handleFlatOptionsSelectFocus;
    $[211] = handleRenameSubmit;
    $[212] = handleTreeSelectFocus;
    $[213] = isAgenticSearchOptionFocused;
    $[214] = onCancel;
    $[215] = onSelect;
    $[216] = renameCursorOffset;
    $[217] = renameValue;
    $[218] = treeNodes;
    $[219] = viewMode;
    $[220] = visibleCount;
    $[221] = t70;
  } else {
    t70 = $[221];
  }
  let t71;
  if ($[222] !== agenticSearchState.status || $[223] !== currentBranch || $[224] !== exitState.keyName || $[225] !== exitState.pending || $[226] !== getExpandCollapseHint || $[227] !== hasMultipleWorktrees || $[228] !== isAgenticSearchOptionFocused || $[229] !== isSearching || $[230] !== onToggleAllProjects || $[231] !== showAllProjects || $[232] !== showAllWorktrees || $[233] !== viewMode) {
    t71 = <Box paddingLeft={2}>{exitState.pending ? <Text dimColor={true}>Press {exitState.keyName} again to exit</Text> : viewMode === "rename" ? <Text dimColor={true}><Byline><KeyboardShortcutHint shortcut="Enter" action="save" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline></Text> : agenticSearchState.status === "searching" ? <Text dimColor={true}><Byline><Text>Searching with Claude…</Text><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline></Text> : isAgenticSearchOptionFocused ? <Text dimColor={true}><Byline><KeyboardShortcutHint shortcut="Enter" action="search" /><KeyboardShortcutHint shortcut={"\u2193"} action="skip" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline></Text> : viewMode === "search" ? <Text dimColor={true}><Byline><Text>{isSearching && false ? "Searching\u2026" : "Type to Search"}</Text><KeyboardShortcutHint shortcut="Enter" action="select" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="clear" /></Byline></Text> : <Text dimColor={true}><Byline>{onToggleAllProjects && <KeyboardShortcutHint shortcut="Ctrl+A" action={`show ${showAllProjects ? "current dir" : "all projects"}`} />}{currentBranch && <KeyboardShortcutHint shortcut="Ctrl+B" action="toggle branch" />}{hasMultipleWorktrees && <KeyboardShortcutHint shortcut="Ctrl+W" action={`show ${showAllWorktrees ? "current worktree" : "all worktrees"}`} />}<KeyboardShortcutHint shortcut="Ctrl+V" action="preview" /><KeyboardShortcutHint shortcut="Ctrl+R" action="rename" /><Text>Type to search</Text><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />{getExpandCollapseHint() && <Text>{getExpandCollapseHint()}</Text>}</Byline></Text>}</Box>;
    $[222] = agenticSearchState.status;
    $[223] = currentBranch;
    $[224] = exitState.keyName;
    $[225] = exitState.pending;
    $[226] = getExpandCollapseHint;
    $[227] = hasMultipleWorktrees;
    $[228] = isAgenticSearchOptionFocused;
    $[229] = isSearching;
    $[230] = onToggleAllProjects;
    $[231] = showAllProjects;
    $[232] = showAllWorktrees;
    $[233] = viewMode;
    $[234] = t71;
  } else {
    t71 = $[234];
  }
  let t72;
  if ($[235] !== t57 || $[236] !== t60 || $[237] !== t62 || $[238] !== t63 || $[239] !== t65 || $[240] !== t66 || $[241] !== t67 || $[242] !== t68 || $[243] !== t69 || $[244] !== t70 || $[245] !== t71) {
    t72 = <Box flexDirection="column" height={t57}>{t58}{t59}{t60}{t62}{t63}{t64}{t65}{t66}{t67}{t68}{t69}{t70}{t71}</Box>;
    $[235] = t57;
    $[236] = t60;
    $[237] = t62;
    $[238] = t63;
    $[239] = t65;
    $[240] = t66;
    $[241] = t67;
    $[242] = t68;
    $[243] = t69;
    $[244] = t70;
    $[245] = t71;
    $[246] = t72;
  } else {
    t72 = $[246];
  }
  return t72;
}

/**
 * Extracts searchable text content from a message.
 * Handles both string content and structured content blocks.
 */
function _temp7(r_0) {
  return r_0.log;
}
function _temp6(log_6) {
  return log_6.messages[0]?.uuid;
}
function _temp5(fuseIndex_0, debouncedDeepSearchQuery_0, setDeepSearchResults_0, setIsSearching_0) {
  const results = fuseIndex_0.search(debouncedDeepSearchQuery_0);
  results.sort(_temp3);
  setDeepSearchResults_0({
    results: results.map(_temp4),
    query: debouncedDeepSearchQuery_0
  });
  setIsSearching_0(false);
}
function _temp4(r) {
  return {
    log: r.item.log,
    score: r.score,
    searchableText: r.item.searchableText
  };
}
function _temp3(a, b) {
  const aTime = new Date(a.item.log.modified).getTime();
  const bTime = new Date(b.item.log.modified).getTime();
  const timeDiff = bTime - aTime;
  if (Math.abs(timeDiff) > DATE_TIE_THRESHOLD_MS) {
    return timeDiff;
  }
  return (a.score ?? 1) - (b.score ?? 1);
}
function _temp2(log_1) {
  const currentSessionId = getSessionId();
  const logSessionId = getSessionIdFromLog(log_1);
  const isCurrentSession = currentSessionId && logSessionId === currentSessionId;
  if (isCurrentSession) {
    return true;
  }
  if (log_1.customTitle) {
    return true;
  }
  const fromMessages = getFirstMeaningfulUserMessageTextContent(log_1.messages);
  if (fromMessages) {
    return true;
  }
  if (log_1.firstPrompt || log_1.customTitle) {
    return true;
  }
  return false;
}
function _temp(log) {
  return [log, buildSearchableText(log)];
}
function extractSearchableText(message: SerializedMessage): string {
  // Only extract from user and assistant messages that have content
  if (message.type !== 'user' && message.type !== 'assistant') {
    return '';
  }
  const content = 'message' in message ? message.message?.content : undefined;
  if (!content) return '';

  // Handle string content (simple messages)
  if (typeof content === 'string') {
    return content;
  }

  // Handle array of content blocks
  if (Array.isArray(content)) {
    return content.map(block => {
      if (typeof block === 'string') return block;
      if ('text' in block && typeof block.text === 'string') return block.text;
      return '';
      // we don't return thinking blocks and tool names here;
      // they're not useful for search, as they can add noise to the fuzzy matching
    }).filter(Boolean).join(' ');
  }
  return '';
}

/**
 * Builds searchable text for a log including messages, titles, summaries, and metadata.
 * Crops long transcripts to first/last N messages for performance.
 */
function buildSearchableText(log: LogOption): string {
  const searchableMessages = log.messages.length <= DEEP_SEARCH_MAX_MESSAGES ? log.messages : [...log.messages.slice(0, DEEP_SEARCH_CROP_SIZE), ...log.messages.slice(-DEEP_SEARCH_CROP_SIZE)];
  const messageText = searchableMessages.map(extractSearchableText).filter(Boolean).join(' ');
  const metadata = [log.customTitle, log.summary, log.firstPrompt, log.gitBranch, log.tag, log.prNumber ? `PR #${log.prNumber}` : undefined, log.prRepository].filter(Boolean).join(' ');
  const fullText = `${metadata} ${messageText}`.trim();
  return fullText.length > DEEP_SEARCH_MAX_TEXT_LENGTH ? fullText.slice(0, DEEP_SEARCH_MAX_TEXT_LENGTH) : fullText;
}
function groupLogsBySessionId(filteredLogs: LogOption[]): Map<string, LogOption[]> {
  const groups = new Map<string, LogOption[]>();
  for (const log of filteredLogs) {
    const sessionId = getSessionIdFromLog(log);
    if (sessionId) {
      const existing = groups.get(sessionId);
      if (existing) {
        existing.push(log);
      } else {
        groups.set(sessionId, [log]);
      }
    }
  }

  // Sort logs within each group by modified date (newest first)
  groups.forEach(logs => logs.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()));
  return groups;
}

/**
 * Get unique tags from a list of logs, sorted alphabetically
 */
function getUniqueTags(logs: LogOption[]): string[] {
  const tags = new Set<string>();
  for (const log of logs) {
    if (log.tag) {
      tags.add(log.tag);
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJjaGFsayIsImZpZ3VyZXMiLCJGdXNlIiwiUmVhY3QiLCJnZXRPcmlnaW5hbEN3ZCIsImdldFNlc3Npb25JZCIsInVzZUV4aXRPbkN0cmxDRFdpdGhLZXliaW5kaW5ncyIsInVzZVNlYXJjaElucHV0IiwidXNlVGVybWluYWxTaXplIiwiYXBwbHlDb2xvciIsIkNvbG9yIiwiQm94IiwiVGV4dCIsInVzZUlucHV0IiwidXNlVGVybWluYWxGb2N1cyIsInVzZVRoZW1lIiwidXNlS2V5YmluZGluZyIsImxvZ0V2ZW50IiwiTG9nT3B0aW9uIiwiU2VyaWFsaXplZE1lc3NhZ2UiLCJmb3JtYXRMb2dNZXRhZGF0YSIsInRydW5jYXRlVG9XaWR0aCIsImdldFdvcmt0cmVlUGF0aHMiLCJnZXRCcmFuY2giLCJnZXRMb2dEaXNwbGF5VGl0bGUiLCJnZXRGaXJzdE1lYW5pbmdmdWxVc2VyTWVzc2FnZVRleHRDb250ZW50IiwiZ2V0U2Vzc2lvbklkRnJvbUxvZyIsImlzQ3VzdG9tVGl0bGVFbmFibGVkIiwic2F2ZUN1c3RvbVRpdGxlIiwiZ2V0VGhlbWUiLCJDb25maWd1cmFibGVTaG9ydGN1dEhpbnQiLCJTZWxlY3QiLCJCeWxpbmUiLCJEaXZpZGVyIiwiS2V5Ym9hcmRTaG9ydGN1dEhpbnQiLCJTZWFyY2hCb3giLCJTZXNzaW9uUHJldmlldyIsIlNwaW5uZXIiLCJUYWdUYWJzIiwiVGV4dElucHV0IiwiVHJlZU5vZGUiLCJUcmVlU2VsZWN0IiwiQWdlbnRpY1NlYXJjaFN0YXRlIiwic3RhdHVzIiwicmVzdWx0cyIsInF1ZXJ5IiwibWVzc2FnZSIsIkxvZ1NlbGVjdG9yUHJvcHMiLCJsb2dzIiwibWF4SGVpZ2h0IiwiZm9yY2VXaWR0aCIsIm9uQ2FuY2VsIiwib25TZWxlY3QiLCJsb2ciLCJvbkxvZ3NDaGFuZ2VkIiwib25Mb2FkTW9yZSIsImNvdW50IiwiaW5pdGlhbFNlYXJjaFF1ZXJ5Iiwic2hvd0FsbFByb2plY3RzIiwib25Ub2dnbGVBbGxQcm9qZWN0cyIsIm9uQWdlbnRpY1NlYXJjaCIsInNpZ25hbCIsIkFib3J0U2lnbmFsIiwiUHJvbWlzZSIsIkxvZ1RyZWVOb2RlIiwiaW5kZXhJbkZpbHRlcmVkIiwibm9ybWFsaXplQW5kVHJ1bmNhdGVUb1dpZHRoIiwidGV4dCIsIm1heFdpZHRoIiwibm9ybWFsaXplZCIsInJlcGxhY2UiLCJ0cmltIiwiUEFSRU5UX1BSRUZJWF9XSURUSCIsIkNISUxEX1BSRUZJWF9XSURUSCIsIkRFRVBfU0VBUkNIX01BWF9NRVNTQUdFUyIsIkRFRVBfU0VBUkNIX0NST1BfU0laRSIsIkRFRVBfU0VBUkNIX01BWF9URVhUX0xFTkdUSCIsIkZVU0VfVEhSRVNIT0xEIiwiREFURV9USUVfVEhSRVNIT0xEX01TIiwiU05JUFBFVF9DT05URVhUX0NIQVJTIiwiU25pcHBldCIsImJlZm9yZSIsIm1hdGNoIiwiYWZ0ZXIiLCJmb3JtYXRTbmlwcGV0IiwiaGlnaGxpZ2h0Q29sb3IiLCJkaW0iLCJleHRyYWN0U25pcHBldCIsImNvbnRleHRDaGFycyIsIm1hdGNoSW5kZXgiLCJ0b0xvd2VyQ2FzZSIsImluZGV4T2YiLCJtYXRjaEVuZCIsImxlbmd0aCIsInNuaXBwZXRTdGFydCIsIk1hdGgiLCJtYXgiLCJzbmlwcGV0RW5kIiwibWluIiwiYmVmb3JlUmF3Iiwic2xpY2UiLCJtYXRjaFRleHQiLCJhZnRlclJhdyIsInRyaW1TdGFydCIsInRyaW1FbmQiLCJidWlsZExvZ0xhYmVsIiwibWF4TGFiZWxXaWR0aCIsIm9wdGlvbnMiLCJpc0dyb3VwSGVhZGVyIiwiaXNDaGlsZCIsImZvcmtDb3VudCIsInByZWZpeFdpZHRoIiwic2Vzc2lvbkNvdW50U3VmZml4Iiwic2lkZWNoYWluU3VmZml4IiwiaXNTaWRlY2hhaW4iLCJtYXhTdW1tYXJ5V2lkdGgiLCJ0cnVuY2F0ZWRTdW1tYXJ5IiwiYnVpbGRMb2dNZXRhZGF0YSIsInNob3dQcm9qZWN0UGF0aCIsImNoaWxkUGFkZGluZyIsImJhc2VNZXRhZGF0YSIsInByb2plY3RTdWZmaXgiLCJwcm9qZWN0UGF0aCIsIkxvZ1NlbGVjdG9yIiwidDAiLCIkIiwiX2MiLCJ0MSIsInQyIiwidW5kZWZpbmVkIiwiSW5maW5pdHkiLCJ0ZXJtaW5hbFNpemUiLCJjb2x1bW5zIiwiZXhpdFN0YXRlIiwiaXNUZXJtaW5hbEZvY3VzZWQiLCJ0MyIsIlN5bWJvbCIsImZvciIsImlzUmVzdW1lV2l0aFJlbmFtZUVuYWJsZWQiLCJpc0RlZXBTZWFyY2hFbmFibGVkIiwidGhlbWVOYW1lIiwidDQiLCJ0aGVtZSIsInQ1Iiwid2FybmluZyIsImlzQWdlbnRpY1NlYXJjaEVuYWJsZWQiLCJjdXJyZW50QnJhbmNoIiwic2V0Q3VycmVudEJyYW5jaCIsInVzZVN0YXRlIiwiYnJhbmNoRmlsdGVyRW5hYmxlZCIsInNldEJyYW5jaEZpbHRlckVuYWJsZWQiLCJzaG93QWxsV29ya3RyZWVzIiwic2V0U2hvd0FsbFdvcmt0cmVlcyIsImhhc011bHRpcGxlV29ya3RyZWVzIiwic2V0SGFzTXVsdGlwbGVXb3JrdHJlZXMiLCJ0NiIsImN1cnJlbnRDd2QiLCJyZW5hbWVWYWx1ZSIsInNldFJlbmFtZVZhbHVlIiwicmVuYW1lQ3Vyc29yT2Zmc2V0Iiwic2V0UmVuYW1lQ3Vyc29yT2Zmc2V0IiwidDciLCJTZXQiLCJleHBhbmRlZEdyb3VwU2Vzc2lvbklkcyIsInNldEV4cGFuZGVkR3JvdXBTZXNzaW9uSWRzIiwiZm9jdXNlZE5vZGUiLCJzZXRGb2N1c2VkTm9kZSIsImZvY3VzZWRJbmRleCIsInNldEZvY3VzZWRJbmRleCIsInZpZXdNb2RlIiwic2V0Vmlld01vZGUiLCJwcmV2aWV3TG9nIiwic2V0UHJldmlld0xvZyIsInByZXZGb2N1c2VkSWRSZWYiLCJ1c2VSZWYiLCJzZWxlY3RlZFRhZ0luZGV4Iiwic2V0U2VsZWN0ZWRUYWdJbmRleCIsInQ4IiwiYWdlbnRpY1NlYXJjaFN0YXRlIiwic2V0QWdlbnRpY1NlYXJjaFN0YXRlIiwiaXNBZ2VudGljU2VhcmNoT3B0aW9uRm9jdXNlZCIsInNldElzQWdlbnRpY1NlYXJjaE9wdGlvbkZvY3VzZWQiLCJhZ2VudGljU2VhcmNoQWJvcnRSZWYiLCJ0OSIsInQxMCIsInQxMSIsInQxMiIsImVuYWJsZWQiLCJ0MTMiLCJ0MTQiLCJpc0FjdGl2ZSIsIm9uRXhpdCIsIm9uRXhpdFVwIiwicGFzc3Rocm91Z2hDdHJsS2V5cyIsImluaXRpYWxRdWVyeSIsInNlYXJjaFF1ZXJ5Iiwic2V0UXVlcnkiLCJzZXRTZWFyY2hRdWVyeSIsImN1cnNvck9mZnNldCIsInNlYXJjaEN1cnNvck9mZnNldCIsImRlZmVycmVkU2VhcmNoUXVlcnkiLCJ1c2VEZWZlcnJlZFZhbHVlIiwiZGVib3VuY2VkRGVlcFNlYXJjaFF1ZXJ5Iiwic2V0RGVib3VuY2VkRGVlcFNlYXJjaFF1ZXJ5IiwidDE1IiwidDE2IiwidGltZW91dElkIiwic2V0VGltZW91dCIsImNsZWFyVGltZW91dCIsInVzZUVmZmVjdCIsImRlZXBTZWFyY2hSZXN1bHRzIiwic2V0RGVlcFNlYXJjaFJlc3VsdHMiLCJpc1NlYXJjaGluZyIsInNldElzU2VhcmNoaW5nIiwidDE3IiwidDE4IiwidGhlbiIsImJyYW5jaCIsInBhdGhzIiwic2VhcmNoYWJsZVRleHRCeUxvZyIsIk1hcCIsIm1hcCIsIl90ZW1wIiwidDE5IiwidDIwIiwiZ2V0VW5pcXVlVGFncyIsInVuaXF1ZVRhZ3MiLCJoYXNUYWdzIiwidDIxIiwidGFnVGFicyIsImVmZmVjdGl2ZVRhZ0luZGV4Iiwic2VsZWN0ZWRUYWIiLCJ0YWdGaWx0ZXIiLCJ0YWdUYWJzTGluZXMiLCJmaWx0ZXJlZCIsInQyMiIsImZpbHRlciIsIl90ZW1wMiIsInQyMyIsImxvZ18yIiwidGFnIiwibG9nXzMiLCJnaXRCcmFuY2giLCJsb2dfNCIsImJhc2VGaWx0ZXJlZExvZ3MiLCJiYjAiLCJsb2dfNSIsImRpc3BsYXllZFRpdGxlIiwiYnJhbmNoXzAiLCJwckluZm8iLCJwck51bWJlciIsInByUmVwb3NpdG9yeSIsImluY2x1ZGVzIiwidGl0bGVGaWx0ZXJlZExvZ3MiLCJ0MjQiLCJ0MjUiLCJ0MjYiLCJ0aW1lb3V0SWRfMCIsIl90ZW1wNSIsImZpbHRlcmVkXzAiLCJzbmlwcGV0TWFwIiwicmVzdWx0Iiwic2VhcmNoYWJsZVRleHQiLCJzbmlwcGV0Iiwic2V0IiwidDI3IiwiX3RlbXA2IiwidGl0bGVNYXRjaElkcyIsInQyOCIsInQyOSIsImxvZ183IiwiaGFzIiwibWVzc2FnZXMiLCJ1dWlkIiwidHJhbnNjcmlwdE9ubHlNYXRjaGVzIiwiX3RlbXA3IiwiZmlsdGVyZWRMb2dzIiwic25pcHBldHMiLCJiYjEiLCJkaXNwbGF5ZWRMb2dzIiwiYmIyIiwidDMwIiwic2Vzc2lvbkdyb3VwcyIsImdyb3VwTG9nc0J5U2Vzc2lvbklkIiwiQXJyYXkiLCJmcm9tIiwiZW50cmllcyIsInQzMSIsInNlc3Npb25JZCIsImdyb3VwTG9ncyIsImxhdGVzdExvZyIsInNuaXBwZXRfMCIsImdldCIsInNuaXBwZXRTdHIiLCJtZXRhZGF0YSIsImlkIiwidmFsdWUiLCJsYWJlbCIsImRlc2NyaXB0aW9uIiwiZGltRGVzY3JpcHRpb24iLCJjaGlsZHJlbiIsImxvZ184IiwiaW5kZXgiLCJjaGlsZEluZGV4SW5GaWx0ZXJlZCIsImNoaWxkU25pcHBldCIsImNoaWxkU25pcHBldFN0ciIsImNoaWxkTWV0YWRhdGEiLCJwYXJlbnRNZXRhZGF0YSIsInRyZWVOb2RlcyIsImJiMyIsInQzMiIsImxvZ185IiwiaW5kZXhfMCIsInJhd1N1bW1hcnkiLCJzdW1tYXJ5V2l0aFNpZGVjaGFpbiIsInN1bW1hcnkiLCJiYXNlRGVzY3JpcHRpb24iLCJzbmlwcGV0XzEiLCJzbmlwcGV0U3RyXzAiLCJ0b1N0cmluZyIsImZsYXRPcHRpb25zIiwiZm9jdXNlZExvZyIsInNlc3Npb25JZF8wIiwic2Vzc2lvbkxvZ3MiLCJsb2dfMTAiLCJoYXNNdWx0aXBsZUxvZ3MiLCJpc0V4cGFuZGVkIiwiaXNDaGlsZE5vZGUiLCJnZXRFeHBhbmRDb2xsYXBzZUhpbnQiLCJzZXNzaW9uSWRfMSIsImZ1bGxQYXRoIiwiaGFuZGxlUmVuYW1lU3VibWl0IiwidDMzIiwiZXhpdFNlYXJjaE1vZGUiLCJ0MzQiLCJlbnRlclNlYXJjaE1vZGUiLCJ0MzUiLCJjdXJyZW50IiwiYWJvcnQiLCJhYm9ydENvbnRyb2xsZXIiLCJBYm9ydENvbnRyb2xsZXIiLCJxdWVyeV9sZW5ndGgiLCJyZXN1bHRzXzAiLCJhYm9ydGVkIiwicmVzdWx0c19jb3VudCIsInQzNiIsImVycm9yIiwiRXJyb3IiLCJoYW5kbGVBZ2VudGljU2VhcmNoIiwidDM3IiwidDM4IiwidDM5IiwicHJldkFnZW50aWNTdGF0dXNSZWYiLCJ0NDAiLCJwcmV2U3RhdHVzIiwiZmlyc3RMb2ciLCJ0NDEiLCJ0NDIiLCJpbmRleF8xIiwicGFyc2VJbnQiLCJsb2dfMTEiLCJoYW5kbGVGbGF0T3B0aW9uc1NlbGVjdEZvY3VzIiwidDQzIiwibm9kZSIsImluZGV4XzIiLCJmaW5kSW5kZXgiLCJsb2dfMTIiLCJoYW5kbGVUcmVlU2VsZWN0Rm9jdXMiLCJ0NDQiLCJ0NDUiLCJ0NDYiLCJjb250ZXh0IiwidDQ3IiwidDQ4IiwidDQ5IiwidDUwIiwidDUxIiwidDUyIiwidDUzIiwiaW5wdXQiLCJrZXkiLCJjdHJsIiwicmV0dXJuIiwiZG93bkFycm93IiwidXBBcnJvdyIsInRhYiIsIm9mZnNldCIsInNoaWZ0IiwicHJldiIsIm5ld0luZGV4IiwibmV3VGFiIiwiaXNfYWxsIiwidGFnX2NvdW50Iiwia2V5SXNOb3RDdHJsT3JNZXRhIiwibWV0YSIsImxvd2VySW5wdXQiLCJuZXdFbmFibGVkIiwibmV3VmFsdWUiLCJtZXNzYWdlQ291bnQiLCJ0ZXN0IiwidDU0IiwiZmlsdGVySW5kaWNhdG9ycyIsInB1c2giLCJzaG93QWRkaXRpb25hbEZpbHRlckxpbmUiLCJoZWFkZXJMaW5lcyIsInZpc2libGVDb3VudCIsImZsb29yIiwidDU1IiwidDU2IiwiYnVmZmVyIiwidDU3IiwidDU4IiwidDU5IiwidDYwIiwidDYxIiwidDYyIiwidDYzIiwidDY0IiwidDY1IiwidDY2IiwidDY3IiwidDY4IiwidDY5IiwiQm9vbGVhbiIsInBvaW50ZXIiLCJ0NzAiLCJub2RlXzAiLCJub2RlSWQiLCJzZXNzaW9uSWRfMiIsInN0YXJ0c1dpdGgiLCJzdWJzdHJpbmciLCJub2RlSWRfMCIsInNlc3Npb25JZF8zIiwicHJldl8wIiwiYWRkIiwibm9kZUlkXzEiLCJzZXNzaW9uSWRfNCIsInByZXZfMSIsIm5ld1NldCIsImRlbGV0ZSIsInZhbHVlXzAiLCJpdGVtSW5kZXgiLCJsb2dfMTMiLCJ0NzEiLCJrZXlOYW1lIiwicGVuZGluZyIsInQ3MiIsInJfMCIsInIiLCJsb2dfNiIsImZ1c2VJbmRleF8wIiwiZGVib3VuY2VkRGVlcFNlYXJjaFF1ZXJ5XzAiLCJzZXREZWVwU2VhcmNoUmVzdWx0c18wIiwic2V0SXNTZWFyY2hpbmdfMCIsImZ1c2VJbmRleCIsInNlYXJjaCIsInNvcnQiLCJfdGVtcDMiLCJfdGVtcDQiLCJpdGVtIiwic2NvcmUiLCJhIiwiYiIsImFUaW1lIiwiRGF0ZSIsIm1vZGlmaWVkIiwiZ2V0VGltZSIsImJUaW1lIiwidGltZURpZmYiLCJhYnMiLCJsb2dfMSIsImN1cnJlbnRTZXNzaW9uSWQiLCJsb2dTZXNzaW9uSWQiLCJpc0N1cnJlbnRTZXNzaW9uIiwiY3VzdG9tVGl0bGUiLCJmcm9tTWVzc2FnZXMiLCJmaXJzdFByb21wdCIsImJ1aWxkU2VhcmNoYWJsZVRleHQiLCJleHRyYWN0U2VhcmNoYWJsZVRleHQiLCJ0eXBlIiwiY29udGVudCIsImlzQXJyYXkiLCJibG9jayIsImpvaW4iLCJzZWFyY2hhYmxlTWVzc2FnZXMiLCJtZXNzYWdlVGV4dCIsImZ1bGxUZXh0IiwiZ3JvdXBzIiwiZXhpc3RpbmciLCJmb3JFYWNoIiwidGFncyIsImxvY2FsZUNvbXBhcmUiXSwic291cmNlcyI6WyJMb2dTZWxlY3Rvci50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJ1xuaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCBGdXNlIGZyb20gJ2Z1c2UuanMnXG5pbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyBnZXRPcmlnaW5hbEN3ZCwgZ2V0U2Vzc2lvbklkIH0gZnJvbSAnLi4vYm9vdHN0cmFwL3N0YXRlLmpzJ1xuaW1wb3J0IHsgdXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzIH0gZnJvbSAnLi4vaG9va3MvdXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzLmpzJ1xuaW1wb3J0IHsgdXNlU2VhcmNoSW5wdXQgfSBmcm9tICcuLi9ob29rcy91c2VTZWFyY2hJbnB1dC5qcydcbmltcG9ydCB7IHVzZVRlcm1pbmFsU2l6ZSB9IGZyb20gJy4uL2hvb2tzL3VzZVRlcm1pbmFsU2l6ZS5qcydcbmltcG9ydCB7IGFwcGx5Q29sb3IgfSBmcm9tICcuLi9pbmsvY29sb3JpemUuanMnXG5pbXBvcnQgdHlwZSB7IENvbG9yIH0gZnJvbSAnLi4vaW5rL3N0eWxlcy5qcydcbmltcG9ydCB7IEJveCwgVGV4dCwgdXNlSW5wdXQsIHVzZVRlcm1pbmFsRm9jdXMsIHVzZVRoZW1lIH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHsgdXNlS2V5YmluZGluZyB9IGZyb20gJy4uL2tleWJpbmRpbmdzL3VzZUtleWJpbmRpbmcuanMnXG5pbXBvcnQgeyBsb2dFdmVudCB9IGZyb20gJy4uL3NlcnZpY2VzL2FuYWx5dGljcy9pbmRleC5qcydcbmltcG9ydCB0eXBlIHsgTG9nT3B0aW9uLCBTZXJpYWxpemVkTWVzc2FnZSB9IGZyb20gJy4uL3R5cGVzL2xvZ3MuanMnXG5pbXBvcnQgeyBmb3JtYXRMb2dNZXRhZGF0YSwgdHJ1bmNhdGVUb1dpZHRoIH0gZnJvbSAnLi4vdXRpbHMvZm9ybWF0LmpzJ1xuaW1wb3J0IHsgZ2V0V29ya3RyZWVQYXRocyB9IGZyb20gJy4uL3V0aWxzL2dldFdvcmt0cmVlUGF0aHMuanMnXG5pbXBvcnQgeyBnZXRCcmFuY2ggfSBmcm9tICcuLi91dGlscy9naXQuanMnXG5pbXBvcnQgeyBnZXRMb2dEaXNwbGF5VGl0bGUgfSBmcm9tICcuLi91dGlscy9sb2cuanMnXG5pbXBvcnQge1xuICBnZXRGaXJzdE1lYW5pbmdmdWxVc2VyTWVzc2FnZVRleHRDb250ZW50LFxuICBnZXRTZXNzaW9uSWRGcm9tTG9nLFxuICBpc0N1c3RvbVRpdGxlRW5hYmxlZCxcbiAgc2F2ZUN1c3RvbVRpdGxlLFxufSBmcm9tICcuLi91dGlscy9zZXNzaW9uU3RvcmFnZS5qcydcbmltcG9ydCB7IGdldFRoZW1lIH0gZnJvbSAnLi4vdXRpbHMvdGhlbWUuanMnXG5pbXBvcnQgeyBDb25maWd1cmFibGVTaG9ydGN1dEhpbnQgfSBmcm9tICcuL0NvbmZpZ3VyYWJsZVNob3J0Y3V0SGludC5qcydcbmltcG9ydCB7IFNlbGVjdCB9IGZyb20gJy4vQ3VzdG9tU2VsZWN0L3NlbGVjdC5qcydcbmltcG9ydCB7IEJ5bGluZSB9IGZyb20gJy4vZGVzaWduLXN5c3RlbS9CeWxpbmUuanMnXG5pbXBvcnQgeyBEaXZpZGVyIH0gZnJvbSAnLi9kZXNpZ24tc3lzdGVtL0RpdmlkZXIuanMnXG5pbXBvcnQgeyBLZXlib2FyZFNob3J0Y3V0SGludCB9IGZyb20gJy4vZGVzaWduLXN5c3RlbS9LZXlib2FyZFNob3J0Y3V0SGludC5qcydcbmltcG9ydCB7IFNlYXJjaEJveCB9IGZyb20gJy4vU2VhcmNoQm94LmpzJ1xuaW1wb3J0IHsgU2Vzc2lvblByZXZpZXcgfSBmcm9tICcuL1Nlc3Npb25QcmV2aWV3LmpzJ1xuaW1wb3J0IHsgU3Bpbm5lciB9IGZyb20gJy4vU3Bpbm5lci5qcydcbmltcG9ydCB7IFRhZ1RhYnMgfSBmcm9tICcuL1RhZ1RhYnMuanMnXG5pbXBvcnQgVGV4dElucHV0IGZyb20gJy4vVGV4dElucHV0LmpzJ1xuaW1wb3J0IHsgdHlwZSBUcmVlTm9kZSwgVHJlZVNlbGVjdCB9IGZyb20gJy4vdWkvVHJlZVNlbGVjdC5qcydcblxudHlwZSBBZ2VudGljU2VhcmNoU3RhdGUgPVxuICB8IHsgc3RhdHVzOiAnaWRsZScgfVxuICB8IHsgc3RhdHVzOiAnc2VhcmNoaW5nJyB9XG4gIHwgeyBzdGF0dXM6ICdyZXN1bHRzJzsgcmVzdWx0czogTG9nT3B0aW9uW107IHF1ZXJ5OiBzdHJpbmcgfVxuICB8IHsgc3RhdHVzOiAnZXJyb3InOyBtZXNzYWdlOiBzdHJpbmcgfVxuXG5leHBvcnQgdHlwZSBMb2dTZWxlY3RvclByb3BzID0ge1xuICBsb2dzOiBMb2dPcHRpb25bXVxuICBtYXhIZWlnaHQ/OiBudW1iZXJcbiAgZm9yY2VXaWR0aD86IG51bWJlclxuICBvbkNhbmNlbD86ICgpID0+IHZvaWRcbiAgb25TZWxlY3Q6IChsb2c6IExvZ09wdGlvbikgPT4gdm9pZFxuICBvbkxvZ3NDaGFuZ2VkPzogKCkgPT4gdm9pZFxuICBvbkxvYWRNb3JlPzogKGNvdW50OiBudW1iZXIpID0+IHZvaWRcbiAgaW5pdGlhbFNlYXJjaFF1ZXJ5Pzogc3RyaW5nXG4gIHNob3dBbGxQcm9qZWN0cz86IGJvb2xlYW5cbiAgb25Ub2dnbGVBbGxQcm9qZWN0cz86ICgpID0+IHZvaWRcbiAgb25BZ2VudGljU2VhcmNoPzogKFxuICAgIHF1ZXJ5OiBzdHJpbmcsXG4gICAgbG9nczogTG9nT3B0aW9uW10sXG4gICAgc2lnbmFsPzogQWJvcnRTaWduYWwsXG4gICkgPT4gUHJvbWlzZTxMb2dPcHRpb25bXT5cbn1cblxudHlwZSBMb2dUcmVlTm9kZSA9IFRyZWVOb2RlPHsgbG9nOiBMb2dPcHRpb247IGluZGV4SW5GaWx0ZXJlZDogbnVtYmVyIH0+XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUFuZFRydW5jYXRlVG9XaWR0aCh0ZXh0OiBzdHJpbmcsIG1heFdpZHRoOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBub3JtYWxpemVkID0gdGV4dC5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpXG4gIHJldHVybiB0cnVuY2F0ZVRvV2lkdGgobm9ybWFsaXplZCwgbWF4V2lkdGgpXG59XG5cbi8vIFdpZHRoIG9mIHByZWZpeGVzIHRoYXQgVHJlZVNlbGVjdCB3aWxsIGFkZFxuY29uc3QgUEFSRU5UX1BSRUZJWF9XSURUSCA9IDIgLy8gJ+KWvCAnIG9yICfilrYgJ1xuY29uc3QgQ0hJTERfUFJFRklYX1dJRFRIID0gNCAvLyAnICDilrggJ1xuXG4vLyBEZWVwIHNlYXJjaCBjb25zdGFudHNcbmNvbnN0IERFRVBfU0VBUkNIX01BWF9NRVNTQUdFUyA9IDIwMDBcbmNvbnN0IERFRVBfU0VBUkNIX0NST1BfU0laRSA9IDEwMDBcbmNvbnN0IERFRVBfU0VBUkNIX01BWF9URVhUX0xFTkdUSCA9IDUwMDAwIC8vIENhcCBzZWFyY2hhYmxlIHRleHQgcGVyIHNlc3Npb25cbmNvbnN0IEZVU0VfVEhSRVNIT0xEID0gMC4zXG5jb25zdCBEQVRFX1RJRV9USFJFU0hPTERfTVMgPSA2MCAqIDEwMDAgLy8gMSBtaW51dGUgLSB1c2UgcmVsZXZhbmNlIGFzIHRpZS1icmVha2VyIHdpdGhpbiB0aGlzIHdpbmRvd1xuY29uc3QgU05JUFBFVF9DT05URVhUX0NIQVJTID0gNTAgLy8gQ2hhcmFjdGVycyB0byBzaG93IGJlZm9yZS9hZnRlciBtYXRjaFxuXG50eXBlIFNuaXBwZXQgPSB7IGJlZm9yZTogc3RyaW5nOyBtYXRjaDogc3RyaW5nOyBhZnRlcjogc3RyaW5nIH1cblxuZnVuY3Rpb24gZm9ybWF0U25pcHBldChcbiAgeyBiZWZvcmUsIG1hdGNoLCBhZnRlciB9OiBTbmlwcGV0LFxuICBoaWdobGlnaHRDb2xvcjogKHRleHQ6IHN0cmluZykgPT4gc3RyaW5nLFxuKTogc3RyaW5nIHtcbiAgcmV0dXJuIGNoYWxrLmRpbShiZWZvcmUpICsgaGlnaGxpZ2h0Q29sb3IobWF0Y2gpICsgY2hhbGsuZGltKGFmdGVyKVxufVxuXG5mdW5jdGlvbiBleHRyYWN0U25pcHBldChcbiAgdGV4dDogc3RyaW5nLFxuICBxdWVyeTogc3RyaW5nLFxuICBjb250ZXh0Q2hhcnM6IG51bWJlcixcbik6IFNuaXBwZXQgfCBudWxsIHtcbiAgLy8gRmluZCBleGFjdCBxdWVyeSBvY2N1cnJlbmNlIChjYXNlLWluc2Vuc2l0aXZlKS5cbiAgLy8gTm90ZTogRnVzZSBkb2VzIGZ1enp5IG1hdGNoaW5nLCBzbyB0aGlzIG1heSBtaXNzIHNvbWUgZnV6enkgbWF0Y2hlcy5cbiAgLy8gVGhpcyBpcyBhY2NlcHRhYmxlIGZvciBub3cgLSBpbiB0aGUgZnV0dXJlIHdlIGNvdWxkIHVzZSBGdXNlJ3MgaW5jbHVkZU1hdGNoZXNcbiAgLy8gb3B0aW9uIGFuZCB3b3JrIHdpdGggdGhlIG1hdGNoIGluZGljZXMgZGlyZWN0bHkuXG4gIGNvbnN0IG1hdGNoSW5kZXggPSB0ZXh0LnRvTG93ZXJDYXNlKCkuaW5kZXhPZihxdWVyeS50b0xvd2VyQ2FzZSgpKVxuICBpZiAobWF0Y2hJbmRleCA9PT0gLTEpIHJldHVybiBudWxsXG5cbiAgY29uc3QgbWF0Y2hFbmQgPSBtYXRjaEluZGV4ICsgcXVlcnkubGVuZ3RoXG4gIGNvbnN0IHNuaXBwZXRTdGFydCA9IE1hdGgubWF4KDAsIG1hdGNoSW5kZXggLSBjb250ZXh0Q2hhcnMpXG4gIGNvbnN0IHNuaXBwZXRFbmQgPSBNYXRoLm1pbih0ZXh0Lmxlbmd0aCwgbWF0Y2hFbmQgKyBjb250ZXh0Q2hhcnMpXG5cbiAgY29uc3QgYmVmb3JlUmF3ID0gdGV4dC5zbGljZShzbmlwcGV0U3RhcnQsIG1hdGNoSW5kZXgpXG4gIGNvbnN0IG1hdGNoVGV4dCA9IHRleHQuc2xpY2UobWF0Y2hJbmRleCwgbWF0Y2hFbmQpXG4gIGNvbnN0IGFmdGVyUmF3ID0gdGV4dC5zbGljZShtYXRjaEVuZCwgc25pcHBldEVuZClcblxuICByZXR1cm4ge1xuICAgIGJlZm9yZTpcbiAgICAgIChzbmlwcGV0U3RhcnQgPiAwID8gJ+KApicgOiAnJykgK1xuICAgICAgYmVmb3JlUmF3LnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltU3RhcnQoKSxcbiAgICBtYXRjaDogbWF0Y2hUZXh0LnRyaW0oKSxcbiAgICBhZnRlcjpcbiAgICAgIGFmdGVyUmF3LnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltRW5kKCkgK1xuICAgICAgKHNuaXBwZXRFbmQgPCB0ZXh0Lmxlbmd0aCA/ICfigKYnIDogJycpLFxuICB9XG59XG5cbmZ1bmN0aW9uIGJ1aWxkTG9nTGFiZWwoXG4gIGxvZzogTG9nT3B0aW9uLFxuICBtYXhMYWJlbFdpZHRoOiBudW1iZXIsXG4gIG9wdGlvbnM/OiB7XG4gICAgaXNHcm91cEhlYWRlcj86IGJvb2xlYW5cbiAgICBpc0NoaWxkPzogYm9vbGVhblxuICAgIGZvcmtDb3VudD86IG51bWJlclxuICB9LFxuKTogc3RyaW5nIHtcbiAgY29uc3Qge1xuICAgIGlzR3JvdXBIZWFkZXIgPSBmYWxzZSxcbiAgICBpc0NoaWxkID0gZmFsc2UsXG4gICAgZm9ya0NvdW50ID0gMCxcbiAgfSA9IG9wdGlvbnMgfHwge31cblxuICAvLyBUcmVlU2VsZWN0IHdpbGwgYWRkIHRoZSBwcmVmaXgsIHNvIHdlIGp1c3QgbmVlZCB0byBhY2NvdW50IGZvciBpdHMgd2lkdGhcbiAgY29uc3QgcHJlZml4V2lkdGggPVxuICAgIGlzR3JvdXBIZWFkZXIgJiYgZm9ya0NvdW50ID4gMFxuICAgICAgPyBQQVJFTlRfUFJFRklYX1dJRFRIXG4gICAgICA6IGlzQ2hpbGRcbiAgICAgICAgPyBDSElMRF9QUkVGSVhfV0lEVEhcbiAgICAgICAgOiAwXG5cbiAgY29uc3Qgc2Vzc2lvbkNvdW50U3VmZml4ID1cbiAgICBpc0dyb3VwSGVhZGVyICYmIGZvcmtDb3VudCA+IDBcbiAgICAgID8gYCAoKyR7Zm9ya0NvdW50fSBvdGhlciAke2ZvcmtDb3VudCA9PT0gMSA/ICdzZXNzaW9uJyA6ICdzZXNzaW9ucyd9KWBcbiAgICAgIDogJydcblxuICBjb25zdCBzaWRlY2hhaW5TdWZmaXggPSBsb2cuaXNTaWRlY2hhaW4gPyAnIChzaWRlY2hhaW4pJyA6ICcnXG5cbiAgY29uc3QgbWF4U3VtbWFyeVdpZHRoID1cbiAgICBtYXhMYWJlbFdpZHRoIC1cbiAgICBwcmVmaXhXaWR0aCAtXG4gICAgc2lkZWNoYWluU3VmZml4Lmxlbmd0aCAtXG4gICAgc2Vzc2lvbkNvdW50U3VmZml4Lmxlbmd0aFxuICBjb25zdCB0cnVuY2F0ZWRTdW1tYXJ5ID0gbm9ybWFsaXplQW5kVHJ1bmNhdGVUb1dpZHRoKFxuICAgIGdldExvZ0Rpc3BsYXlUaXRsZShsb2cpLFxuICAgIG1heFN1bW1hcnlXaWR0aCxcbiAgKVxuICByZXR1cm4gYCR7dHJ1bmNhdGVkU3VtbWFyeX0ke3NpZGVjaGFpblN1ZmZpeH0ke3Nlc3Npb25Db3VudFN1ZmZpeH1gXG59XG5cbmZ1bmN0aW9uIGJ1aWxkTG9nTWV0YWRhdGEoXG4gIGxvZzogTG9nT3B0aW9uLFxuICBvcHRpb25zPzogeyBpc0NoaWxkPzogYm9vbGVhbjsgc2hvd1Byb2plY3RQYXRoPzogYm9vbGVhbiB9LFxuKTogc3RyaW5nIHtcbiAgY29uc3QgeyBpc0NoaWxkID0gZmFsc2UsIHNob3dQcm9qZWN0UGF0aCA9IGZhbHNlIH0gPSBvcHRpb25zIHx8IHt9XG4gIC8vIE1hdGNoIHRoZSBjaGlsZCBwcmVmaXggd2lkdGggZm9yIHByb3BlciBhbGlnbm1lbnRcbiAgY29uc3QgY2hpbGRQYWRkaW5nID0gaXNDaGlsZCA/ICcgICAgJyA6ICcnIC8vIDQgc3BhY2VzIHRvIG1hdGNoICcgIOKWuCAnXG4gIGNvbnN0IGJhc2VNZXRhZGF0YSA9IGZvcm1hdExvZ01ldGFkYXRhKGxvZylcbiAgY29uc3QgcHJvamVjdFN1ZmZpeCA9XG4gICAgc2hvd1Byb2plY3RQYXRoICYmIGxvZy5wcm9qZWN0UGF0aCA/IGAgwrcgJHtsb2cucHJvamVjdFBhdGh9YCA6ICcnXG4gIHJldHVybiBjaGlsZFBhZGRpbmcgKyBiYXNlTWV0YWRhdGEgKyBwcm9qZWN0U3VmZml4XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBMb2dTZWxlY3Rvcih7XG4gIGxvZ3MsXG4gIG1heEhlaWdodCA9IEluZmluaXR5LFxuICBmb3JjZVdpZHRoLFxuICBvbkNhbmNlbCxcbiAgb25TZWxlY3QsXG4gIG9uTG9nc0NoYW5nZWQsXG4gIG9uTG9hZE1vcmUsXG4gIGluaXRpYWxTZWFyY2hRdWVyeSxcbiAgc2hvd0FsbFByb2plY3RzID0gZmFsc2UsXG4gIG9uVG9nZ2xlQWxsUHJvamVjdHMsXG4gIG9uQWdlbnRpY1NlYXJjaCxcbn06IExvZ1NlbGVjdG9yUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCB0ZXJtaW5hbFNpemUgPSB1c2VUZXJtaW5hbFNpemUoKVxuICBjb25zdCBjb2x1bW5zID0gZm9yY2VXaWR0aCA9PT0gdW5kZWZpbmVkID8gdGVybWluYWxTaXplLmNvbHVtbnMgOiBmb3JjZVdpZHRoXG4gIGNvbnN0IGV4aXRTdGF0ZSA9IHVzZUV4aXRPbkN0cmxDRFdpdGhLZXliaW5kaW5ncyhvbkNhbmNlbClcbiAgY29uc3QgaXNUZXJtaW5hbEZvY3VzZWQgPSB1c2VUZXJtaW5hbEZvY3VzKClcbiAgY29uc3QgaXNSZXN1bWVXaXRoUmVuYW1lRW5hYmxlZCA9IGlzQ3VzdG9tVGl0bGVFbmFibGVkKClcbiAgY29uc3QgaXNEZWVwU2VhcmNoRW5hYmxlZCA9IFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCdcbiAgY29uc3QgW3RoZW1lTmFtZV0gPSB1c2VUaGVtZSgpXG4gIGNvbnN0IHRoZW1lID0gZ2V0VGhlbWUodGhlbWVOYW1lKVxuICBjb25zdCBoaWdobGlnaHRDb2xvciA9IFJlYWN0LnVzZU1lbW8oXG4gICAgKCkgPT4gKHRleHQ6IHN0cmluZykgPT4gYXBwbHlDb2xvcih0ZXh0LCB0aGVtZS53YXJuaW5nIGFzIENvbG9yKSxcbiAgICBbdGhlbWUud2FybmluZ10sXG4gIClcbiAgY29uc3QgaXNBZ2VudGljU2VhcmNoRW5hYmxlZCA9IFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCdcblxuICBjb25zdCBbY3VycmVudEJyYW5jaCwgc2V0Q3VycmVudEJyYW5jaF0gPSBSZWFjdC51c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuICBjb25zdCBbYnJhbmNoRmlsdGVyRW5hYmxlZCwgc2V0QnJhbmNoRmlsdGVyRW5hYmxlZF0gPSBSZWFjdC51c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW3Nob3dBbGxXb3JrdHJlZXMsIHNldFNob3dBbGxXb3JrdHJlZXNdID0gUmVhY3QudXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtoYXNNdWx0aXBsZVdvcmt0cmVlcywgc2V0SGFzTXVsdGlwbGVXb3JrdHJlZXNdID0gUmVhY3QudXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IGN1cnJlbnRDd2QgPSBSZWFjdC51c2VNZW1vKCgpID0+IGdldE9yaWdpbmFsQ3dkKCksIFtdKVxuICBjb25zdCBbcmVuYW1lVmFsdWUsIHNldFJlbmFtZVZhbHVlXSA9IFJlYWN0LnVzZVN0YXRlKCcnKVxuICBjb25zdCBbcmVuYW1lQ3Vyc29yT2Zmc2V0LCBzZXRSZW5hbWVDdXJzb3JPZmZzZXRdID0gUmVhY3QudXNlU3RhdGUoMClcbiAgY29uc3QgW2V4cGFuZGVkR3JvdXBTZXNzaW9uSWRzLCBzZXRFeHBhbmRlZEdyb3VwU2Vzc2lvbklkc10gPSBSZWFjdC51c2VTdGF0ZTxcbiAgICBTZXQ8c3RyaW5nPlxuICA+KG5ldyBTZXQoKSlcbiAgY29uc3QgW2ZvY3VzZWROb2RlLCBzZXRGb2N1c2VkTm9kZV0gPSBSZWFjdC51c2VTdGF0ZTxMb2dUcmVlTm9kZSB8IG51bGw+KG51bGwpXG4gIC8vIFRyYWNrIGZvY3VzZWQgaW5kZXggZm9yIHNjcm9sbCBwb3NpdGlvbiBkaXNwbGF5IGluIHRpdGxlXG4gIGNvbnN0IFtmb2N1c2VkSW5kZXgsIHNldEZvY3VzZWRJbmRleF0gPSBSZWFjdC51c2VTdGF0ZSgxKVxuICBjb25zdCBbdmlld01vZGUsIHNldFZpZXdNb2RlXSA9IFJlYWN0LnVzZVN0YXRlPFxuICAgICdsaXN0JyB8ICdwcmV2aWV3JyB8ICdyZW5hbWUnIHwgJ3NlYXJjaCdcbiAgPignbGlzdCcpXG4gIGNvbnN0IFtwcmV2aWV3TG9nLCBzZXRQcmV2aWV3TG9nXSA9IFJlYWN0LnVzZVN0YXRlPExvZ09wdGlvbiB8IG51bGw+KG51bGwpXG4gIGNvbnN0IHByZXZGb2N1c2VkSWRSZWYgPSBSZWFjdC51c2VSZWY8c3RyaW5nIHwgbnVsbD4obnVsbClcbiAgY29uc3QgW3NlbGVjdGVkVGFnSW5kZXgsIHNldFNlbGVjdGVkVGFnSW5kZXhdID0gUmVhY3QudXNlU3RhdGUoMClcblxuICAvLyBBZ2VudGljIHNlYXJjaCBzdGF0ZVxuICBjb25zdCBbYWdlbnRpY1NlYXJjaFN0YXRlLCBzZXRBZ2VudGljU2VhcmNoU3RhdGVdID1cbiAgICBSZWFjdC51c2VTdGF0ZTxBZ2VudGljU2VhcmNoU3RhdGU+KHsgc3RhdHVzOiAnaWRsZScgfSlcbiAgLy8gVHJhY2sgaWYgdGhlIFwiU2VhcmNoIGRlZXBseSB1c2luZyBDbGF1ZGVcIiBvcHRpb24gaXMgZm9jdXNlZFxuICBjb25zdCBbaXNBZ2VudGljU2VhcmNoT3B0aW9uRm9jdXNlZCwgc2V0SXNBZ2VudGljU2VhcmNoT3B0aW9uRm9jdXNlZF0gPVxuICAgIFJlYWN0LnVzZVN0YXRlKGZhbHNlKVxuICAvLyBBYm9ydENvbnRyb2xsZXIgZm9yIGNhbmNlbGxpbmcgYWdlbnRpYyBzZWFyY2hcbiAgY29uc3QgYWdlbnRpY1NlYXJjaEFib3J0UmVmID0gUmVhY3QudXNlUmVmPEFib3J0Q29udHJvbGxlciB8IG51bGw+KG51bGwpXG5cbiAgY29uc3Qge1xuICAgIHF1ZXJ5OiBzZWFyY2hRdWVyeSxcbiAgICBzZXRRdWVyeTogc2V0U2VhcmNoUXVlcnksXG4gICAgY3Vyc29yT2Zmc2V0OiBzZWFyY2hDdXJzb3JPZmZzZXQsXG4gIH0gPSB1c2VTZWFyY2hJbnB1dCh7XG4gICAgaXNBY3RpdmU6XG4gICAgICB2aWV3TW9kZSA9PT0gJ3NlYXJjaCcgJiYgYWdlbnRpY1NlYXJjaFN0YXRlLnN0YXR1cyAhPT0gJ3NlYXJjaGluZycsXG4gICAgb25FeGl0OiAoKSA9PiB7XG4gICAgICBzZXRWaWV3TW9kZSgnbGlzdCcpXG4gICAgICBsb2dFdmVudCgndGVuZ3Vfc2Vzc2lvbl9zZWFyY2hfdG9nZ2xlZCcsIHsgZW5hYmxlZDogZmFsc2UgfSlcbiAgICB9LFxuICAgIG9uRXhpdFVwOiAoKSA9PiB7XG4gICAgICBzZXRWaWV3TW9kZSgnbGlzdCcpXG4gICAgICBsb2dFdmVudCgndGVuZ3Vfc2Vzc2lvbl9zZWFyY2hfdG9nZ2xlZCcsIHsgZW5hYmxlZDogZmFsc2UgfSlcbiAgICB9LFxuICAgIHBhc3N0aHJvdWdoQ3RybEtleXM6IFsnbiddLFxuICAgIGluaXRpYWxRdWVyeTogaW5pdGlhbFNlYXJjaFF1ZXJ5IHx8ICcnLFxuICB9KVxuXG4gIC8vIERlYm91bmNlIHRyYW5zY3JpcHQgc2VhcmNoIGZvciBwZXJmb3JtYW5jZSAodGl0bGUgc2VhcmNoIGlzIGluc3RhbnQpXG4gIGNvbnN0IGRlZmVycmVkU2VhcmNoUXVlcnkgPSBSZWFjdC51c2VEZWZlcnJlZFZhbHVlKHNlYXJjaFF1ZXJ5KVxuXG4gIC8vIEFkZGl0aW9uYWwgZGVib3VuY2UgZm9yIGRlZXAgc2VhcmNoIC0gd2FpdCAzMDBtcyBhZnRlciB0eXBpbmcgc3RvcHNcbiAgY29uc3QgW2RlYm91bmNlZERlZXBTZWFyY2hRdWVyeSwgc2V0RGVib3VuY2VkRGVlcFNlYXJjaFF1ZXJ5XSA9XG4gICAgUmVhY3QudXNlU3RhdGUoJycpXG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFkZWZlcnJlZFNlYXJjaFF1ZXJ5KSB7XG4gICAgICBzZXREZWJvdW5jZWREZWVwU2VhcmNoUXVlcnkoJycpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dChcbiAgICAgIHNldERlYm91bmNlZERlZXBTZWFyY2hRdWVyeSxcbiAgICAgIDMwMCxcbiAgICAgIGRlZmVycmVkU2VhcmNoUXVlcnksXG4gICAgKVxuICAgIHJldHVybiAoKSA9PiBjbGVhclRpbWVvdXQodGltZW91dElkKVxuICB9LCBbZGVmZXJyZWRTZWFyY2hRdWVyeV0pXG5cbiAgLy8gU3RhdGUgZm9yIGFzeW5jIGRlZXAgc2VhcmNoIHJlc3VsdHNcbiAgY29uc3QgW2RlZXBTZWFyY2hSZXN1bHRzLCBzZXREZWVwU2VhcmNoUmVzdWx0c10gPSBSZWFjdC51c2VTdGF0ZTx7XG4gICAgcmVzdWx0czogQXJyYXk8eyBsb2c6IExvZ09wdGlvbjsgc2NvcmU/OiBudW1iZXI7IHNlYXJjaGFibGVUZXh0OiBzdHJpbmcgfT5cbiAgICBxdWVyeTogc3RyaW5nXG4gIH0gfCBudWxsPihudWxsKVxuICBjb25zdCBbaXNTZWFyY2hpbmcsIHNldElzU2VhcmNoaW5nXSA9IFJlYWN0LnVzZVN0YXRlKGZhbHNlKVxuXG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgdm9pZCBnZXRCcmFuY2goKS50aGVuKGJyYW5jaCA9PiBzZXRDdXJyZW50QnJhbmNoKGJyYW5jaCkpXG4gICAgdm9pZCBnZXRXb3JrdHJlZVBhdGhzKGN1cnJlbnRDd2QpLnRoZW4ocGF0aHMgPT4ge1xuICAgICAgc2V0SGFzTXVsdGlwbGVXb3JrdHJlZXMocGF0aHMubGVuZ3RoID4gMSlcbiAgICB9KVxuICB9LCBbY3VycmVudEN3ZF0pXG5cbiAgLy8gTWVtb2l6ZSBzZWFyY2hhYmxlIHRleHQgZXh0cmFjdGlvbiAtIG9ubHkgcmVjb21wdXRlIHdoZW4gbG9ncyBjaGFuZ2VcbiAgY29uc3Qgc2VhcmNoYWJsZVRleHRCeUxvZyA9IFJlYWN0LnVzZU1lbW8oXG4gICAgKCkgPT4gbmV3IE1hcChsb2dzLm1hcChsb2cgPT4gW2xvZywgYnVpbGRTZWFyY2hhYmxlVGV4dChsb2cpXSkpLFxuICAgIFtsb2dzXSxcbiAgKVxuXG4gIC8vIFByZS1idWlsZCBGdXNlIGluZGV4IG9uY2Ugd2hlbiBsb2dzIGNoYW5nZSAobm90IG9uIGV2ZXJ5IHNlYXJjaCBxdWVyeSlcbiAgY29uc3QgZnVzZUluZGV4ID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKCFpc0RlZXBTZWFyY2hFbmFibGVkKSByZXR1cm4gbnVsbFxuXG4gICAgY29uc3QgbG9nc1dpdGhUZXh0ID0gbG9nc1xuICAgICAgLm1hcChsb2cgPT4gKHtcbiAgICAgICAgbG9nLFxuICAgICAgICBzZWFyY2hhYmxlVGV4dDogc2VhcmNoYWJsZVRleHRCeUxvZy5nZXQobG9nKSA/PyAnJyxcbiAgICAgIH0pKVxuICAgICAgLmZpbHRlcihpdGVtID0+IGl0ZW0uc2VhcmNoYWJsZVRleHQpXG5cbiAgICByZXR1cm4gbmV3IEZ1c2UobG9nc1dpdGhUZXh0LCB7XG4gICAgICBrZXlzOiBbJ3NlYXJjaGFibGVUZXh0J10sXG4gICAgICB0aHJlc2hvbGQ6IEZVU0VfVEhSRVNIT0xELFxuICAgICAgaWdub3JlTG9jYXRpb246IHRydWUsXG4gICAgICBpbmNsdWRlU2NvcmU6IHRydWUsXG4gICAgfSlcbiAgfSwgW2xvZ3MsIHNlYXJjaGFibGVUZXh0QnlMb2csIGlzRGVlcFNlYXJjaEVuYWJsZWRdKVxuXG4gIC8vIENvbXB1dGUgdW5pcXVlIHRhZ3MgZnJvbSBsb2dzIChiZWZvcmUgYW55IGZpbHRlcmluZylcbiAgY29uc3QgdW5pcXVlVGFncyA9IFJlYWN0LnVzZU1lbW8oKCkgPT4gZ2V0VW5pcXVlVGFncyhsb2dzKSwgW2xvZ3NdKVxuICBjb25zdCBoYXNUYWdzID0gdW5pcXVlVGFncy5sZW5ndGggPiAwXG4gIGNvbnN0IHRhZ1RhYnMgPSBSZWFjdC51c2VNZW1vKFxuICAgICgpID0+IChoYXNUYWdzID8gWydBbGwnLCAuLi51bmlxdWVUYWdzXSA6IFtdKSxcbiAgICBbaGFzVGFncywgdW5pcXVlVGFnc10sXG4gIClcblxuICAvLyBDbGFtcCBvdXQtb2YtYm91bmRzIGluZGV4IChlLmcuLCBhZnRlciBsb2dzIGNoYW5nZSkgd2l0aG91dCBhbiBleHRyYSByZW5kZXJcbiAgY29uc3QgZWZmZWN0aXZlVGFnSW5kZXggPVxuICAgIHRhZ1RhYnMubGVuZ3RoID4gMCAmJiBzZWxlY3RlZFRhZ0luZGV4IDwgdGFnVGFicy5sZW5ndGhcbiAgICAgID8gc2VsZWN0ZWRUYWdJbmRleFxuICAgICAgOiAwXG4gIGNvbnN0IHNlbGVjdGVkVGFiID0gdGFnVGFic1tlZmZlY3RpdmVUYWdJbmRleF1cbiAgY29uc3QgdGFnRmlsdGVyID0gc2VsZWN0ZWRUYWIgPT09ICdBbGwnID8gdW5kZWZpbmVkIDogc2VsZWN0ZWRUYWJcblxuICAvLyBUYWcgdGFicyBhcmUgbm93IGEgc2luZ2xlIGxpbmUgd2l0aCBob3Jpem9udGFsIHNjcm9sbGluZ1xuICBjb25zdCB0YWdUYWJzTGluZXMgPSBoYXNUYWdzID8gMSA6IDBcblxuICAvLyBCYXNlIGZpbHRlcmluZyAoaW5zdGFudCkgLSBhcHBsaWVzIHRhZywgYnJhbmNoLCBhbmQgcmVzdW1lIGZpbHRlcnNcbiAgY29uc3QgYmFzZUZpbHRlcmVkTG9ncyA9IFJlYWN0LnVzZU1lbW8oKCkgPT4ge1xuICAgIGxldCBmaWx0ZXJlZCA9IGxvZ3NcbiAgICBpZiAoaXNSZXN1bWVXaXRoUmVuYW1lRW5hYmxlZCkge1xuICAgICAgZmlsdGVyZWQgPSBsb2dzLmZpbHRlcihsb2cgPT4ge1xuICAgICAgICBjb25zdCBjdXJyZW50U2Vzc2lvbklkID0gZ2V0U2Vzc2lvbklkKClcbiAgICAgICAgY29uc3QgbG9nU2Vzc2lvbklkID0gZ2V0U2Vzc2lvbklkRnJvbUxvZyhsb2cpXG4gICAgICAgIGNvbnN0IGlzQ3VycmVudFNlc3Npb24gPVxuICAgICAgICAgIGN1cnJlbnRTZXNzaW9uSWQgJiYgbG9nU2Vzc2lvbklkID09PSBjdXJyZW50U2Vzc2lvbklkXG4gICAgICAgIC8vIEFsd2F5cyBzaG93IGN1cnJlbnQgc2Vzc2lvblxuICAgICAgICBpZiAoaXNDdXJyZW50U2Vzc2lvbikge1xuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cbiAgICAgICAgLy8gQWx3YXlzIHNob3cgc2Vzc2lvbnMgd2l0aCBjdXN0b20gdGl0bGVzIChlLmcuLCBsb29wIG1vZGUgc2Vzc2lvbnMpXG4gICAgICAgIGlmIChsb2cuY3VzdG9tVGl0bGUpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgICAgIC8vIEZvciBmdWxsIGxvZ3MsIGNoZWNrIG1lc3NhZ2VzIGFycmF5XG4gICAgICAgIGNvbnN0IGZyb21NZXNzYWdlcyA9IGdldEZpcnN0TWVhbmluZ2Z1bFVzZXJNZXNzYWdlVGV4dENvbnRlbnQoXG4gICAgICAgICAgbG9nLm1lc3NhZ2VzLFxuICAgICAgICApXG4gICAgICAgIGlmIChmcm9tTWVzc2FnZXMpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgICAgIC8vIEFsbCBsb2dzIHJlYWNoaW5nIHRoaXMgY29tcG9uZW50IGFyZSBlbnJpY2hlZCDigJQgaW5jbHVkZSBpZlxuICAgICAgICAvLyB0aGV5IGhhdmUgYSBwcm9tcHQgb3IgY3VzdG9tIHRpdGxlXG4gICAgICAgIGlmIChsb2cuZmlyc3RQcm9tcHQgfHwgbG9nLmN1c3RvbVRpdGxlKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8gQXBwbHkgdGFnIGZpbHRlciBpZiBzcGVjaWZpZWRcbiAgICBpZiAodGFnRmlsdGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKGxvZyA9PiBsb2cudGFnID09PSB0YWdGaWx0ZXIpXG4gICAgfVxuXG4gICAgaWYgKGJyYW5jaEZpbHRlckVuYWJsZWQgJiYgY3VycmVudEJyYW5jaCkge1xuICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIobG9nID0+IGxvZy5naXRCcmFuY2ggPT09IGN1cnJlbnRCcmFuY2gpXG4gICAgfVxuXG4gICAgaWYgKGhhc011bHRpcGxlV29ya3RyZWVzICYmICFzaG93QWxsV29ya3RyZWVzKSB7XG4gICAgICBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcihsb2cgPT4gbG9nLnByb2plY3RQYXRoID09PSBjdXJyZW50Q3dkKVxuICAgIH1cblxuICAgIHJldHVybiBmaWx0ZXJlZFxuICB9LCBbXG4gICAgbG9ncyxcbiAgICBpc1Jlc3VtZVdpdGhSZW5hbWVFbmFibGVkLFxuICAgIHRhZ0ZpbHRlcixcbiAgICBicmFuY2hGaWx0ZXJFbmFibGVkLFxuICAgIGN1cnJlbnRCcmFuY2gsXG4gICAgaGFzTXVsdGlwbGVXb3JrdHJlZXMsXG4gICAgc2hvd0FsbFdvcmt0cmVlcyxcbiAgICBjdXJyZW50Q3dkLFxuICBdKVxuXG4gIC8vIEluc3RhbnQgdGl0bGUvYnJhbmNoL3RhZy9QUiBmaWx0ZXJpbmcgKHJ1bnMgb24gZXZlcnkga2V5c3Ryb2tlLCBidXQgaXMgZmFzdClcbiAgY29uc3QgdGl0bGVGaWx0ZXJlZExvZ3MgPSBSZWFjdC51c2VNZW1vKCgpID0+IHtcbiAgICBpZiAoIXNlYXJjaFF1ZXJ5KSB7XG4gICAgICByZXR1cm4gYmFzZUZpbHRlcmVkTG9nc1xuICAgIH1cbiAgICBjb25zdCBxdWVyeSA9IHNlYXJjaFF1ZXJ5LnRvTG93ZXJDYXNlKClcbiAgICByZXR1cm4gYmFzZUZpbHRlcmVkTG9ncy5maWx0ZXIobG9nID0+IHtcbiAgICAgIGNvbnN0IGRpc3BsYXllZFRpdGxlID0gZ2V0TG9nRGlzcGxheVRpdGxlKGxvZykudG9Mb3dlckNhc2UoKVxuICAgICAgY29uc3QgYnJhbmNoID0gKGxvZy5naXRCcmFuY2ggfHwgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgIGNvbnN0IHRhZyA9IChsb2cudGFnIHx8ICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICBjb25zdCBwckluZm8gPSBsb2cucHJOdW1iZXJcbiAgICAgICAgPyBgcHIgIyR7bG9nLnByTnVtYmVyfSAke2xvZy5wclJlcG9zaXRvcnkgfHwgJyd9YC50b0xvd2VyQ2FzZSgpXG4gICAgICAgIDogJydcbiAgICAgIHJldHVybiAoXG4gICAgICAgIGRpc3BsYXllZFRpdGxlLmluY2x1ZGVzKHF1ZXJ5KSB8fFxuICAgICAgICBicmFuY2guaW5jbHVkZXMocXVlcnkpIHx8XG4gICAgICAgIHRhZy5pbmNsdWRlcyhxdWVyeSkgfHxcbiAgICAgICAgcHJJbmZvLmluY2x1ZGVzKHF1ZXJ5KVxuICAgICAgKVxuICAgIH0pXG4gIH0sIFtiYXNlRmlsdGVyZWRMb2dzLCBzZWFyY2hRdWVyeV0pXG5cbiAgLy8gU2hvdyBzZWFyY2hpbmcgaW5kaWNhdG9yIHdoZW4gcXVlcnkgaXMgcGVuZGluZyBkZWJvdW5jZVxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChcbiAgICAgIGlzRGVlcFNlYXJjaEVuYWJsZWQgJiZcbiAgICAgIGRlZmVycmVkU2VhcmNoUXVlcnkgJiZcbiAgICAgIGRlZmVycmVkU2VhcmNoUXVlcnkgIT09IGRlYm91bmNlZERlZXBTZWFyY2hRdWVyeVxuICAgICkge1xuICAgICAgc2V0SXNTZWFyY2hpbmcodHJ1ZSlcbiAgICB9XG4gIH0sIFtkZWZlcnJlZFNlYXJjaFF1ZXJ5LCBkZWJvdW5jZWREZWVwU2VhcmNoUXVlcnksIGlzRGVlcFNlYXJjaEVuYWJsZWRdKVxuXG4gIC8vIEFzeW5jIGRlZXAgc2VhcmNoIGVmZmVjdCAtIHJ1bnMgYWZ0ZXIgMzAwbXMgZGVib3VuY2VcbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWlzRGVlcFNlYXJjaEVuYWJsZWQgfHwgIWRlYm91bmNlZERlZXBTZWFyY2hRdWVyeSB8fCAhZnVzZUluZGV4KSB7XG4gICAgICBzZXREZWVwU2VhcmNoUmVzdWx0cyhudWxsKVxuICAgICAgc2V0SXNTZWFyY2hpbmcoZmFsc2UpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBVc2Ugc2V0VGltZW91dCgwKSB0byB5aWVsZCB0byB0aGUgZXZlbnQgbG9vcCAtIHByZXZlbnRzIFVJIGZyZWV6ZVxuICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoXG4gICAgICAoXG4gICAgICAgIGZ1c2VJbmRleCxcbiAgICAgICAgZGVib3VuY2VkRGVlcFNlYXJjaFF1ZXJ5LFxuICAgICAgICBzZXREZWVwU2VhcmNoUmVzdWx0cyxcbiAgICAgICAgc2V0SXNTZWFyY2hpbmcsXG4gICAgICApID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IGZ1c2VJbmRleC5zZWFyY2goZGVib3VuY2VkRGVlcFNlYXJjaFF1ZXJ5KVxuXG4gICAgICAgIC8vIFNvcnQgYnkgZGF0ZSAobmV3ZXN0IGZpcnN0KSwgd2l0aCByZWxldmFuY2UgYXMgdGllLWJyZWFrZXIgd2l0aGluIHNhbWUgbWludXRlXG4gICAgICAgIHJlc3VsdHMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgIGNvbnN0IGFUaW1lID0gbmV3IERhdGUoYS5pdGVtLmxvZy5tb2RpZmllZCkuZ2V0VGltZSgpXG4gICAgICAgICAgY29uc3QgYlRpbWUgPSBuZXcgRGF0ZShiLml0ZW0ubG9nLm1vZGlmaWVkKS5nZXRUaW1lKClcbiAgICAgICAgICBjb25zdCB0aW1lRGlmZiA9IGJUaW1lIC0gYVRpbWVcbiAgICAgICAgICBpZiAoTWF0aC5hYnModGltZURpZmYpID4gREFURV9USUVfVEhSRVNIT0xEX01TKSB7XG4gICAgICAgICAgICByZXR1cm4gdGltZURpZmZcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gV2l0aGluIHNhbWUgbWludXRlIHdpbmRvdywgdXNlIHJlbGV2YW5jZSBzY29yZSAobG93ZXIgaXMgYmV0dGVyKVxuICAgICAgICAgIHJldHVybiAoYS5zY29yZSA/PyAxKSAtIChiLnNjb3JlID8/IDEpXG4gICAgICAgIH0pXG5cbiAgICAgICAgc2V0RGVlcFNlYXJjaFJlc3VsdHMoe1xuICAgICAgICAgIHJlc3VsdHM6IHJlc3VsdHMubWFwKHIgPT4gKHtcbiAgICAgICAgICAgIGxvZzogci5pdGVtLmxvZyxcbiAgICAgICAgICAgIHNjb3JlOiByLnNjb3JlLFxuICAgICAgICAgICAgc2VhcmNoYWJsZVRleHQ6IHIuaXRlbS5zZWFyY2hhYmxlVGV4dCxcbiAgICAgICAgICB9KSksXG4gICAgICAgICAgcXVlcnk6IGRlYm91bmNlZERlZXBTZWFyY2hRdWVyeSxcbiAgICAgICAgfSlcbiAgICAgICAgc2V0SXNTZWFyY2hpbmcoZmFsc2UpXG4gICAgICB9LFxuICAgICAgMCxcbiAgICAgIGZ1c2VJbmRleCxcbiAgICAgIGRlYm91bmNlZERlZXBTZWFyY2hRdWVyeSxcbiAgICAgIHNldERlZXBTZWFyY2hSZXN1bHRzLFxuICAgICAgc2V0SXNTZWFyY2hpbmcsXG4gICAgKVxuXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpXG4gICAgfVxuICB9LCBbZGVib3VuY2VkRGVlcFNlYXJjaFF1ZXJ5LCBmdXNlSW5kZXgsIGlzRGVlcFNlYXJjaEVuYWJsZWRdKVxuXG4gIC8vIE1lcmdlIHRpdGxlIG1hdGNoZXMgd2l0aCBhc3luYyBkZWVwIHNlYXJjaCByZXN1bHRzXG4gIGNvbnN0IHsgZmlsdGVyZWRMb2dzLCBzbmlwcGV0cyB9ID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3Qgc25pcHBldE1hcCA9IG5ldyBNYXA8TG9nT3B0aW9uLCBTbmlwcGV0PigpXG5cbiAgICAvLyBTdGFydCB3aXRoIGluc3RhbnQgdGl0bGUgbWF0Y2hlc1xuICAgIGxldCBmaWx0ZXJlZCA9IHRpdGxlRmlsdGVyZWRMb2dzXG5cbiAgICAvLyBNZXJnZSBpbiBkZWVwIHNlYXJjaCByZXN1bHRzIGlmIGF2YWlsYWJsZSBhbmQgcXVlcnkgbWF0Y2hlc1xuICAgIGlmIChcbiAgICAgIGRlZXBTZWFyY2hSZXN1bHRzICYmXG4gICAgICBkZWJvdW5jZWREZWVwU2VhcmNoUXVlcnkgJiZcbiAgICAgIGRlZXBTZWFyY2hSZXN1bHRzLnF1ZXJ5ID09PSBkZWJvdW5jZWREZWVwU2VhcmNoUXVlcnlcbiAgICApIHtcbiAgICAgIC8vIEV4dHJhY3Qgc25pcHBldHMgZnJvbSBkZWVwIHNlYXJjaCByZXN1bHRzXG4gICAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiBkZWVwU2VhcmNoUmVzdWx0cy5yZXN1bHRzKSB7XG4gICAgICAgIGlmIChyZXN1bHQuc2VhcmNoYWJsZVRleHQpIHtcbiAgICAgICAgICBjb25zdCBzbmlwcGV0ID0gZXh0cmFjdFNuaXBwZXQoXG4gICAgICAgICAgICByZXN1bHQuc2VhcmNoYWJsZVRleHQsXG4gICAgICAgICAgICBkZWJvdW5jZWREZWVwU2VhcmNoUXVlcnksXG4gICAgICAgICAgICBTTklQUEVUX0NPTlRFWFRfQ0hBUlMsXG4gICAgICAgICAgKVxuICAgICAgICAgIGlmIChzbmlwcGV0KSB7XG4gICAgICAgICAgICBzbmlwcGV0TWFwLnNldChyZXN1bHQubG9nLCBzbmlwcGV0KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBZGQgdHJhbnNjcmlwdC1vbmx5IG1hdGNoZXMgKG5vdCBhbHJlYWR5IGluIHRpdGxlIG1hdGNoZXMpXG4gICAgICBjb25zdCB0aXRsZU1hdGNoSWRzID0gbmV3IFNldChmaWx0ZXJlZC5tYXAobG9nID0+IGxvZy5tZXNzYWdlc1swXT8udXVpZCkpXG4gICAgICBjb25zdCB0cmFuc2NyaXB0T25seU1hdGNoZXMgPSBkZWVwU2VhcmNoUmVzdWx0cy5yZXN1bHRzXG4gICAgICAgIC5tYXAociA9PiByLmxvZylcbiAgICAgICAgLmZpbHRlcihsb2cgPT4gIXRpdGxlTWF0Y2hJZHMuaGFzKGxvZy5tZXNzYWdlc1swXT8udXVpZCkpXG4gICAgICBmaWx0ZXJlZCA9IFsuLi5maWx0ZXJlZCwgLi4udHJhbnNjcmlwdE9ubHlNYXRjaGVzXVxuICAgIH1cblxuICAgIHJldHVybiB7IGZpbHRlcmVkTG9nczogZmlsdGVyZWQsIHNuaXBwZXRzOiBzbmlwcGV0TWFwIH1cbiAgfSwgW3RpdGxlRmlsdGVyZWRMb2dzLCBkZWVwU2VhcmNoUmVzdWx0cywgZGVib3VuY2VkRGVlcFNlYXJjaFF1ZXJ5XSlcblxuICAvLyBVc2UgYWdlbnRpYyBzZWFyY2ggcmVzdWx0cyB3aGVuIGF2YWlsYWJsZSBhbmQgbm9uLWVtcHR5LCBvdGhlcndpc2UgdXNlIHJlZ3VsYXIgZmlsdGVyZWQgbG9nc1xuICBjb25zdCBkaXNwbGF5ZWRMb2dzID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKFxuICAgICAgYWdlbnRpY1NlYXJjaFN0YXRlLnN0YXR1cyA9PT0gJ3Jlc3VsdHMnICYmXG4gICAgICBhZ2VudGljU2VhcmNoU3RhdGUucmVzdWx0cy5sZW5ndGggPiAwXG4gICAgKSB7XG4gICAgICByZXR1cm4gYWdlbnRpY1NlYXJjaFN0YXRlLnJlc3VsdHNcbiAgICB9XG4gICAgcmV0dXJuIGZpbHRlcmVkTG9nc1xuICB9LCBbYWdlbnRpY1NlYXJjaFN0YXRlLCBmaWx0ZXJlZExvZ3NdKVxuXG4gIC8vIENhbGN1bGF0ZSBhdmFpbGFibGUgd2lkdGggZm9yIHRoZSBzdW1tYXJ5IHRleHRcbiAgY29uc3QgbWF4TGFiZWxXaWR0aCA9IE1hdGgubWF4KDMwLCBjb2x1bW5zIC0gNClcblxuICAvLyBCdWlsZCB0cmVlIG5vZGVzIGZvciBncm91cGVkIHZpZXdcbiAgY29uc3QgdHJlZU5vZGVzID0gUmVhY3QudXNlTWVtbzxMb2dUcmVlTm9kZVtdPigoKSA9PiB7XG4gICAgaWYgKCFpc1Jlc3VtZVdpdGhSZW5hbWVFbmFibGVkKSB7XG4gICAgICByZXR1cm4gW11cbiAgICB9XG5cbiAgICBjb25zdCBzZXNzaW9uR3JvdXBzID0gZ3JvdXBMb2dzQnlTZXNzaW9uSWQoZGlzcGxheWVkTG9ncylcblxuICAgIHJldHVybiBBcnJheS5mcm9tKHNlc3Npb25Hcm91cHMuZW50cmllcygpKS5tYXAoXG4gICAgICAoW3Nlc3Npb25JZCwgZ3JvdXBMb2dzXSk6IExvZ1RyZWVOb2RlID0+IHtcbiAgICAgICAgY29uc3QgbGF0ZXN0TG9nID0gZ3JvdXBMb2dzWzBdIVxuICAgICAgICBjb25zdCBpbmRleEluRmlsdGVyZWQgPSBkaXNwbGF5ZWRMb2dzLmluZGV4T2YobGF0ZXN0TG9nKVxuICAgICAgICBjb25zdCBzbmlwcGV0ID0gc25pcHBldHMuZ2V0KGxhdGVzdExvZylcbiAgICAgICAgY29uc3Qgc25pcHBldFN0ciA9IHNuaXBwZXRcbiAgICAgICAgICA/IGZvcm1hdFNuaXBwZXQoc25pcHBldCwgaGlnaGxpZ2h0Q29sb3IpXG4gICAgICAgICAgOiBudWxsXG5cbiAgICAgICAgaWYgKGdyb3VwTG9ncy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAvLyBTaW5nbGUgbG9nIC0gbm8gY2hpbGRyZW5cbiAgICAgICAgICBjb25zdCBtZXRhZGF0YSA9IGJ1aWxkTG9nTWV0YWRhdGEobGF0ZXN0TG9nLCB7XG4gICAgICAgICAgICBzaG93UHJvamVjdFBhdGg6IHNob3dBbGxQcm9qZWN0cyxcbiAgICAgICAgICB9KVxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpZDogYGxvZzoke3Nlc3Npb25JZH06MGAsXG4gICAgICAgICAgICB2YWx1ZTogeyBsb2c6IGxhdGVzdExvZywgaW5kZXhJbkZpbHRlcmVkIH0sXG4gICAgICAgICAgICBsYWJlbDogYnVpbGRMb2dMYWJlbChsYXRlc3RMb2csIG1heExhYmVsV2lkdGgpLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IHNuaXBwZXRTdHIgPyBgJHttZXRhZGF0YX1cXG4gICR7c25pcHBldFN0cn1gIDogbWV0YWRhdGEsXG4gICAgICAgICAgICBkaW1EZXNjcmlwdGlvbjogdHJ1ZSxcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBNdWx0aXBsZSBsb2dzIC0gcGFyZW50IHdpdGggY2hpbGRyZW5cbiAgICAgICAgY29uc3QgZm9ya0NvdW50ID0gZ3JvdXBMb2dzLmxlbmd0aCAtIDFcbiAgICAgICAgY29uc3QgY2hpbGRyZW46IExvZ1RyZWVOb2RlW10gPSBncm91cExvZ3Muc2xpY2UoMSkubWFwKChsb2csIGluZGV4KSA9PiB7XG4gICAgICAgICAgY29uc3QgY2hpbGRJbmRleEluRmlsdGVyZWQgPSBkaXNwbGF5ZWRMb2dzLmluZGV4T2YobG9nKVxuICAgICAgICAgIGNvbnN0IGNoaWxkU25pcHBldCA9IHNuaXBwZXRzLmdldChsb2cpXG4gICAgICAgICAgY29uc3QgY2hpbGRTbmlwcGV0U3RyID0gY2hpbGRTbmlwcGV0XG4gICAgICAgICAgICA/IGZvcm1hdFNuaXBwZXQoY2hpbGRTbmlwcGV0LCBoaWdobGlnaHRDb2xvcilcbiAgICAgICAgICAgIDogbnVsbFxuICAgICAgICAgIGNvbnN0IGNoaWxkTWV0YWRhdGEgPSBidWlsZExvZ01ldGFkYXRhKGxvZywge1xuICAgICAgICAgICAgaXNDaGlsZDogdHJ1ZSxcbiAgICAgICAgICAgIHNob3dQcm9qZWN0UGF0aDogc2hvd0FsbFByb2plY3RzLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlkOiBgbG9nOiR7c2Vzc2lvbklkfToke2luZGV4ICsgMX1gLFxuICAgICAgICAgICAgdmFsdWU6IHsgbG9nLCBpbmRleEluRmlsdGVyZWQ6IGNoaWxkSW5kZXhJbkZpbHRlcmVkIH0sXG4gICAgICAgICAgICBsYWJlbDogYnVpbGRMb2dMYWJlbChsb2csIG1heExhYmVsV2lkdGgsIHsgaXNDaGlsZDogdHJ1ZSB9KSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBjaGlsZFNuaXBwZXRTdHJcbiAgICAgICAgICAgICAgPyBgJHtjaGlsZE1ldGFkYXRhfVxcbiAgICAgICR7Y2hpbGRTbmlwcGV0U3RyfWBcbiAgICAgICAgICAgICAgOiBjaGlsZE1ldGFkYXRhLFxuICAgICAgICAgICAgZGltRGVzY3JpcHRpb246IHRydWUsXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIGNvbnN0IHBhcmVudE1ldGFkYXRhID0gYnVpbGRMb2dNZXRhZGF0YShsYXRlc3RMb2csIHtcbiAgICAgICAgICBzaG93UHJvamVjdFBhdGg6IHNob3dBbGxQcm9qZWN0cyxcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBpZDogYGdyb3VwOiR7c2Vzc2lvbklkfWAsXG4gICAgICAgICAgdmFsdWU6IHsgbG9nOiBsYXRlc3RMb2csIGluZGV4SW5GaWx0ZXJlZCB9LFxuICAgICAgICAgIGxhYmVsOiBidWlsZExvZ0xhYmVsKGxhdGVzdExvZywgbWF4TGFiZWxXaWR0aCwge1xuICAgICAgICAgICAgaXNHcm91cEhlYWRlcjogdHJ1ZSxcbiAgICAgICAgICAgIGZvcmtDb3VudCxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogc25pcHBldFN0clxuICAgICAgICAgICAgPyBgJHtwYXJlbnRNZXRhZGF0YX1cXG4gICR7c25pcHBldFN0cn1gXG4gICAgICAgICAgICA6IHBhcmVudE1ldGFkYXRhLFxuICAgICAgICAgIGRpbURlc2NyaXB0aW9uOiB0cnVlLFxuICAgICAgICAgIGNoaWxkcmVuLFxuICAgICAgICB9XG4gICAgICB9LFxuICAgIClcbiAgfSwgW1xuICAgIGlzUmVzdW1lV2l0aFJlbmFtZUVuYWJsZWQsXG4gICAgZGlzcGxheWVkTG9ncyxcbiAgICBtYXhMYWJlbFdpZHRoLFxuICAgIHNob3dBbGxQcm9qZWN0cyxcbiAgICBzbmlwcGV0cyxcbiAgICBoaWdobGlnaHRDb2xvcixcbiAgXSlcblxuICAvLyBCdWlsZCBvcHRpb25zIGZvciBvbGQgZmxhdCBsaXN0IHZpZXdcbiAgY29uc3QgZmxhdE9wdGlvbnMgPSBSZWFjdC51c2VNZW1vKCgpID0+IHtcbiAgICBpZiAoaXNSZXN1bWVXaXRoUmVuYW1lRW5hYmxlZCkge1xuICAgICAgcmV0dXJuIFtdXG4gICAgfVxuXG4gICAgcmV0dXJuIGRpc3BsYXllZExvZ3MubWFwKChsb2csIGluZGV4KSA9PiB7XG4gICAgICBjb25zdCByYXdTdW1tYXJ5ID0gZ2V0TG9nRGlzcGxheVRpdGxlKGxvZylcbiAgICAgIGNvbnN0IHN1bW1hcnlXaXRoU2lkZWNoYWluID1cbiAgICAgICAgcmF3U3VtbWFyeSArIChsb2cuaXNTaWRlY2hhaW4gPyAnIChzaWRlY2hhaW4pJyA6ICcnKVxuICAgICAgY29uc3Qgc3VtbWFyeSA9IG5vcm1hbGl6ZUFuZFRydW5jYXRlVG9XaWR0aChcbiAgICAgICAgc3VtbWFyeVdpdGhTaWRlY2hhaW4sXG4gICAgICAgIG1heExhYmVsV2lkdGgsXG4gICAgICApXG5cbiAgICAgIGNvbnN0IGJhc2VEZXNjcmlwdGlvbiA9IGZvcm1hdExvZ01ldGFkYXRhKGxvZylcbiAgICAgIGNvbnN0IHByb2plY3RTdWZmaXggPVxuICAgICAgICBzaG93QWxsUHJvamVjdHMgJiYgbG9nLnByb2plY3RQYXRoID8gYCDCtyAke2xvZy5wcm9qZWN0UGF0aH1gIDogJydcbiAgICAgIGNvbnN0IHNuaXBwZXQgPSBzbmlwcGV0cy5nZXQobG9nKVxuICAgICAgY29uc3Qgc25pcHBldFN0ciA9IHNuaXBwZXQgPyBmb3JtYXRTbmlwcGV0KHNuaXBwZXQsIGhpZ2hsaWdodENvbG9yKSA6IG51bGxcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbGFiZWw6IHN1bW1hcnksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBzbmlwcGV0U3RyXG4gICAgICAgICAgPyBgJHtiYXNlRGVzY3JpcHRpb259JHtwcm9qZWN0U3VmZml4fVxcbiAgJHtzbmlwcGV0U3RyfWBcbiAgICAgICAgICA6IGJhc2VEZXNjcmlwdGlvbiArIHByb2plY3RTdWZmaXgsXG4gICAgICAgIGRpbURlc2NyaXB0aW9uOiB0cnVlLFxuICAgICAgICB2YWx1ZTogaW5kZXgudG9TdHJpbmcoKSxcbiAgICAgIH1cbiAgICB9KVxuICB9LCBbXG4gICAgaXNSZXN1bWVXaXRoUmVuYW1lRW5hYmxlZCxcbiAgICBkaXNwbGF5ZWRMb2dzLFxuICAgIGhpZ2hsaWdodENvbG9yLFxuICAgIG1heExhYmVsV2lkdGgsXG4gICAgc2hvd0FsbFByb2plY3RzLFxuICAgIHNuaXBwZXRzLFxuICBdKVxuXG4gIC8vIERlcml2ZSB0aGUgZm9jdXNlZCBsb2cgZnJvbSBmb2N1c2VkTm9kZVxuICBjb25zdCBmb2N1c2VkTG9nID0gZm9jdXNlZE5vZGU/LnZhbHVlLmxvZyA/PyBudWxsXG5cbiAgY29uc3QgZ2V0RXhwYW5kQ29sbGFwc2VIaW50ID0gKCk6IHN0cmluZyA9PiB7XG4gICAgaWYgKCFpc1Jlc3VtZVdpdGhSZW5hbWVFbmFibGVkIHx8ICFmb2N1c2VkTG9nKSByZXR1cm4gJydcbiAgICBjb25zdCBzZXNzaW9uSWQgPSBnZXRTZXNzaW9uSWRGcm9tTG9nKGZvY3VzZWRMb2cpXG4gICAgaWYgKCFzZXNzaW9uSWQpIHJldHVybiAnJ1xuXG4gICAgY29uc3Qgc2Vzc2lvbkxvZ3MgPSBkaXNwbGF5ZWRMb2dzLmZpbHRlcihcbiAgICAgIGxvZyA9PiBnZXRTZXNzaW9uSWRGcm9tTG9nKGxvZykgPT09IHNlc3Npb25JZCxcbiAgICApXG4gICAgY29uc3QgaGFzTXVsdGlwbGVMb2dzID0gc2Vzc2lvbkxvZ3MubGVuZ3RoID4gMVxuXG4gICAgaWYgKCFoYXNNdWx0aXBsZUxvZ3MpIHJldHVybiAnJ1xuXG4gICAgY29uc3QgaXNFeHBhbmRlZCA9IGV4cGFuZGVkR3JvdXBTZXNzaW9uSWRzLmhhcyhzZXNzaW9uSWQpXG4gICAgY29uc3QgaXNDaGlsZE5vZGUgPSBzZXNzaW9uTG9ncy5pbmRleE9mKGZvY3VzZWRMb2cpID4gMFxuXG4gICAgaWYgKGlzQ2hpbGROb2RlKSB7XG4gICAgICByZXR1cm4gJ+KGkCB0byBjb2xsYXBzZSdcbiAgICB9XG5cbiAgICByZXR1cm4gaXNFeHBhbmRlZCA/ICfihpAgdG8gY29sbGFwc2UnIDogJ+KGkiB0byBleHBhbmQnXG4gIH1cblxuICBjb25zdCBoYW5kbGVSZW5hbWVTdWJtaXQgPSBSZWFjdC51c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgc2Vzc2lvbklkID0gZm9jdXNlZExvZyA/IGdldFNlc3Npb25JZEZyb21Mb2coZm9jdXNlZExvZykgOiB1bmRlZmluZWRcbiAgICBpZiAoIWZvY3VzZWRMb2cgfHwgIXNlc3Npb25JZCkge1xuICAgICAgc2V0Vmlld01vZGUoJ2xpc3QnKVxuICAgICAgc2V0UmVuYW1lVmFsdWUoJycpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAocmVuYW1lVmFsdWUudHJpbSgpKSB7XG4gICAgICAvLyBQYXNzIGZ1bGxQYXRoIGZvciBjcm9zcy1wcm9qZWN0IHNlc3Npb25zIChkaWZmZXJlbnQgd29ya3RyZWVzKVxuICAgICAgYXdhaXQgc2F2ZUN1c3RvbVRpdGxlKHNlc3Npb25JZCwgcmVuYW1lVmFsdWUudHJpbSgpLCBmb2N1c2VkTG9nLmZ1bGxQYXRoKVxuICAgICAgaWYgKGlzUmVzdW1lV2l0aFJlbmFtZUVuYWJsZWQgJiYgb25Mb2dzQ2hhbmdlZCkge1xuICAgICAgICBvbkxvZ3NDaGFuZ2VkKClcbiAgICAgIH1cbiAgICB9XG4gICAgc2V0Vmlld01vZGUoJ2xpc3QnKVxuICAgIHNldFJlbmFtZVZhbHVlKCcnKVxuICB9LCBbZm9jdXNlZExvZywgcmVuYW1lVmFsdWUsIG9uTG9nc0NoYW5nZWQsIGlzUmVzdW1lV2l0aFJlbmFtZUVuYWJsZWRdKVxuXG4gIGNvbnN0IGV4aXRTZWFyY2hNb2RlID0gUmVhY3QudXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldFZpZXdNb2RlKCdsaXN0JylcbiAgICBsb2dFdmVudCgndGVuZ3Vfc2Vzc2lvbl9zZWFyY2hfdG9nZ2xlZCcsIHsgZW5hYmxlZDogZmFsc2UgfSlcbiAgfSwgW10pXG5cbiAgY29uc3QgZW50ZXJTZWFyY2hNb2RlID0gUmVhY3QudXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldFZpZXdNb2RlKCdzZWFyY2gnKVxuICAgIGxvZ0V2ZW50KCd0ZW5ndV9zZXNzaW9uX3NlYXJjaF90b2dnbGVkJywgeyBlbmFibGVkOiB0cnVlIH0pXG4gIH0sIFtdKVxuXG4gIC8vIEhhbmRsZXIgZm9yIHRyaWdnZXJpbmcgYWdlbnRpYyBzZWFyY2hcbiAgY29uc3QgaGFuZGxlQWdlbnRpY1NlYXJjaCA9IFJlYWN0LnVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICBpZiAoIXNlYXJjaFF1ZXJ5LnRyaW0oKSB8fCAhb25BZ2VudGljU2VhcmNoIHx8ICFpc0FnZW50aWNTZWFyY2hFbmFibGVkKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBBYm9ydCBhbnkgcHJldmlvdXMgc2VhcmNoXG4gICAgYWdlbnRpY1NlYXJjaEFib3J0UmVmLmN1cnJlbnQ/LmFib3J0KClcbiAgICBjb25zdCBhYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcbiAgICBhZ2VudGljU2VhcmNoQWJvcnRSZWYuY3VycmVudCA9IGFib3J0Q29udHJvbGxlclxuXG4gICAgc2V0QWdlbnRpY1NlYXJjaFN0YXRlKHsgc3RhdHVzOiAnc2VhcmNoaW5nJyB9KVxuICAgIGxvZ0V2ZW50KCd0ZW5ndV9hZ2VudGljX3NlYXJjaF9zdGFydGVkJywge1xuICAgICAgcXVlcnlfbGVuZ3RoOiBzZWFyY2hRdWVyeS5sZW5ndGgsXG4gICAgfSlcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgb25BZ2VudGljU2VhcmNoKFxuICAgICAgICBzZWFyY2hRdWVyeSxcbiAgICAgICAgbG9ncyxcbiAgICAgICAgYWJvcnRDb250cm9sbGVyLnNpZ25hbCxcbiAgICAgIClcbiAgICAgIC8vIENoZWNrIGlmIGFib3J0ZWQgYmVmb3JlIHVwZGF0aW5nIHN0YXRlXG4gICAgICBpZiAoYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgc2V0QWdlbnRpY1NlYXJjaFN0YXRlKHsgc3RhdHVzOiAncmVzdWx0cycsIHJlc3VsdHMsIHF1ZXJ5OiBzZWFyY2hRdWVyeSB9KVxuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2FnZW50aWNfc2VhcmNoX2NvbXBsZXRlZCcsIHtcbiAgICAgICAgcXVlcnlfbGVuZ3RoOiBzZWFyY2hRdWVyeS5sZW5ndGgsXG4gICAgICAgIHJlc3VsdHNfY291bnQ6IHJlc3VsdHMubGVuZ3RoLFxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gRG9uJ3Qgc2hvdyBlcnJvciBmb3IgYWJvcnRlZCByZXF1ZXN0c1xuICAgICAgaWYgKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIHNldEFnZW50aWNTZWFyY2hTdGF0ZSh7XG4gICAgICAgIHN0YXR1czogJ2Vycm9yJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnU2VhcmNoIGZhaWxlZCcsXG4gICAgICB9KVxuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2FnZW50aWNfc2VhcmNoX2Vycm9yJywge1xuICAgICAgICBxdWVyeV9sZW5ndGg6IHNlYXJjaFF1ZXJ5Lmxlbmd0aCxcbiAgICAgIH0pXG4gICAgfVxuICB9LCBbc2VhcmNoUXVlcnksIG9uQWdlbnRpY1NlYXJjaCwgaXNBZ2VudGljU2VhcmNoRW5hYmxlZCwgbG9nc10pXG5cbiAgLy8gQ2xlYXIgYWdlbnRpYyBzZWFyY2ggcmVzdWx0cy9lcnJvciB3aGVuIHF1ZXJ5IGNoYW5nZXNcbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoXG4gICAgICBhZ2VudGljU2VhcmNoU3RhdGUuc3RhdHVzICE9PSAnaWRsZScgJiZcbiAgICAgIGFnZW50aWNTZWFyY2hTdGF0ZS5zdGF0dXMgIT09ICdzZWFyY2hpbmcnXG4gICAgKSB7XG4gICAgICAvLyBDbGVhciBpZiB0aGUgcXVlcnkgaGFzIGNoYW5nZWQgZnJvbSB0aGUgb25lIHVzZWQgZm9yIHJlc3VsdHMvZXJyb3JcbiAgICAgIGlmIChcbiAgICAgICAgKGFnZW50aWNTZWFyY2hTdGF0ZS5zdGF0dXMgPT09ICdyZXN1bHRzJyAmJlxuICAgICAgICAgIGFnZW50aWNTZWFyY2hTdGF0ZS5xdWVyeSAhPT0gc2VhcmNoUXVlcnkpIHx8XG4gICAgICAgIGFnZW50aWNTZWFyY2hTdGF0ZS5zdGF0dXMgPT09ICdlcnJvcidcbiAgICAgICkge1xuICAgICAgICBzZXRBZ2VudGljU2VhcmNoU3RhdGUoeyBzdGF0dXM6ICdpZGxlJyB9KVxuICAgICAgfVxuICAgIH1cbiAgfSwgW3NlYXJjaFF1ZXJ5LCBhZ2VudGljU2VhcmNoU3RhdGVdKVxuXG4gIC8vIENsZWFudXA6IGFib3J0IGFueSBpbi1wcm9ncmVzcyBhZ2VudGljIHNlYXJjaCBvbiB1bm1vdW50XG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGFnZW50aWNTZWFyY2hBYm9ydFJlZi5jdXJyZW50Py5hYm9ydCgpXG4gICAgfVxuICB9LCBbXSlcblxuICAvLyBGb2N1cyBmaXJzdCBpdGVtIHdoZW4gYWdlbnRpYyBzZWFyY2ggY29tcGxldGVzIHdpdGggcmVzdWx0c1xuICBjb25zdCBwcmV2QWdlbnRpY1N0YXR1c1JlZiA9IFJlYWN0LnVzZVJlZihhZ2VudGljU2VhcmNoU3RhdGUuc3RhdHVzKVxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IHByZXZTdGF0dXMgPSBwcmV2QWdlbnRpY1N0YXR1c1JlZi5jdXJyZW50XG4gICAgcHJldkFnZW50aWNTdGF0dXNSZWYuY3VycmVudCA9IGFnZW50aWNTZWFyY2hTdGF0ZS5zdGF0dXNcblxuICAgIC8vIFdoZW4gc2VhcmNoIGp1c3QgY29tcGxldGVkLCBmb2N1cyB0aGUgZmlyc3QgaXRlbSBpbiB0aGUgbGlzdFxuICAgIGlmIChwcmV2U3RhdHVzID09PSAnc2VhcmNoaW5nJyAmJiBhZ2VudGljU2VhcmNoU3RhdGUuc3RhdHVzID09PSAncmVzdWx0cycpIHtcbiAgICAgIGlmIChpc1Jlc3VtZVdpdGhSZW5hbWVFbmFibGVkICYmIHRyZWVOb2Rlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHNldEZvY3VzZWROb2RlKHRyZWVOb2Rlc1swXSEpXG4gICAgICB9IGVsc2UgaWYgKCFpc1Jlc3VtZVdpdGhSZW5hbWVFbmFibGVkICYmIGRpc3BsYXllZExvZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBmaXJzdExvZyA9IGRpc3BsYXllZExvZ3NbMF0hXG4gICAgICAgIHNldEZvY3VzZWROb2RlKHtcbiAgICAgICAgICBpZDogJzAnLFxuICAgICAgICAgIHZhbHVlOiB7IGxvZzogZmlyc3RMb2csIGluZGV4SW5GaWx0ZXJlZDogMCB9LFxuICAgICAgICAgIGxhYmVsOiAnJyxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gIH0sIFtcbiAgICBhZ2VudGljU2VhcmNoU3RhdGUuc3RhdHVzLFxuICAgIGlzUmVzdW1lV2l0aFJlbmFtZUVuYWJsZWQsXG4gICAgdHJlZU5vZGVzLFxuICAgIGRpc3BsYXllZExvZ3MsXG4gIF0pXG5cbiAgY29uc3QgaGFuZGxlRmxhdE9wdGlvbnNTZWxlY3RGb2N1cyA9IFJlYWN0LnVzZUNhbGxiYWNrKFxuICAgICh2YWx1ZTogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHBhcnNlSW50KHZhbHVlLCAxMClcbiAgICAgIGNvbnN0IGxvZyA9IGRpc3BsYXllZExvZ3NbaW5kZXhdXG4gICAgICBpZiAoIWxvZyB8fCBwcmV2Rm9jdXNlZElkUmVmLmN1cnJlbnQgPT09IGluZGV4LnRvU3RyaW5nKCkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBwcmV2Rm9jdXNlZElkUmVmLmN1cnJlbnQgPSBpbmRleC50b1N0cmluZygpXG4gICAgICBzZXRGb2N1c2VkTm9kZSh7XG4gICAgICAgIGlkOiBpbmRleC50b1N0cmluZygpLFxuICAgICAgICB2YWx1ZTogeyBsb2csIGluZGV4SW5GaWx0ZXJlZDogaW5kZXggfSxcbiAgICAgICAgbGFiZWw6ICcnLFxuICAgICAgfSlcbiAgICAgIHNldEZvY3VzZWRJbmRleChpbmRleCArIDEpXG4gICAgfSxcbiAgICBbZGlzcGxheWVkTG9nc10sXG4gIClcblxuICBjb25zdCBoYW5kbGVUcmVlU2VsZWN0Rm9jdXMgPSBSZWFjdC51c2VDYWxsYmFjayhcbiAgICAobm9kZTogTG9nVHJlZU5vZGUpID0+IHtcbiAgICAgIHNldEZvY3VzZWROb2RlKG5vZGUpXG4gICAgICAvLyBVcGRhdGUgZm9jdXNlZCBpbmRleCBmb3Igc2Nyb2xsIHBvc2l0aW9uIGRpc3BsYXlcbiAgICAgIGNvbnN0IGluZGV4ID0gZGlzcGxheWVkTG9ncy5maW5kSW5kZXgoXG4gICAgICAgIGxvZyA9PiBnZXRTZXNzaW9uSWRGcm9tTG9nKGxvZykgPT09IGdldFNlc3Npb25JZEZyb21Mb2cobm9kZS52YWx1ZS5sb2cpLFxuICAgICAgKVxuICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgc2V0Rm9jdXNlZEluZGV4KGluZGV4ICsgMSlcbiAgICAgIH1cbiAgICB9LFxuICAgIFtkaXNwbGF5ZWRMb2dzXSxcbiAgKVxuXG4gIC8vIEVzY2FwZSB0byBhYm9ydCBhZ2VudGljIHNlYXJjaCBpbiBwcm9ncmVzc1xuICB1c2VLZXliaW5kaW5nKFxuICAgICdjb25maXJtOm5vJyxcbiAgICAoKSA9PiB7XG4gICAgICBhZ2VudGljU2VhcmNoQWJvcnRSZWYuY3VycmVudD8uYWJvcnQoKVxuICAgICAgc2V0QWdlbnRpY1NlYXJjaFN0YXRlKHsgc3RhdHVzOiAnaWRsZScgfSlcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9hZ2VudGljX3NlYXJjaF9jYW5jZWxsZWQnLCB7fSlcbiAgICB9LFxuICAgIHtcbiAgICAgIGNvbnRleHQ6ICdDb25maXJtYXRpb24nLFxuICAgICAgaXNBY3RpdmU6XG4gICAgICAgIHZpZXdNb2RlICE9PSAncHJldmlldycgJiYgYWdlbnRpY1NlYXJjaFN0YXRlLnN0YXR1cyA9PT0gJ3NlYXJjaGluZycsXG4gICAgfSxcbiAgKVxuXG4gIC8vIEVzY2FwZSBpbiByZW5hbWUgbW9kZSAtIGV4aXQgcmVuYW1lIG1vZGVcbiAgLy8gVXNlIFNldHRpbmdzIGNvbnRleHQgc28gJ24nIGtleSBkb2Vzbid0IGV4aXQgKGFsbG93cyB0eXBpbmcgJ24nIGluIHJlbmFtZSBpbnB1dClcbiAgdXNlS2V5YmluZGluZyhcbiAgICAnY29uZmlybTpubycsXG4gICAgKCkgPT4ge1xuICAgICAgc2V0Vmlld01vZGUoJ2xpc3QnKVxuICAgICAgc2V0UmVuYW1lVmFsdWUoJycpXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnU2V0dGluZ3MnLFxuICAgICAgaXNBY3RpdmU6XG4gICAgICAgIHZpZXdNb2RlID09PSAncmVuYW1lJyAmJiBhZ2VudGljU2VhcmNoU3RhdGUuc3RhdHVzICE9PSAnc2VhcmNoaW5nJyxcbiAgICB9LFxuICApXG5cbiAgLy8gRXNjYXBlIHdoZW4gYWdlbnRpYyBzZWFyY2ggb3B0aW9uIGZvY3VzZWQgLSBjbGVhciBhbmQgY2FuY2VsXG4gIHVzZUtleWJpbmRpbmcoXG4gICAgJ2NvbmZpcm06bm8nLFxuICAgICgpID0+IHtcbiAgICAgIHNldFNlYXJjaFF1ZXJ5KCcnKVxuICAgICAgc2V0SXNBZ2VudGljU2VhcmNoT3B0aW9uRm9jdXNlZChmYWxzZSlcbiAgICAgIG9uQ2FuY2VsPy4oKVxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gICAgICBpc0FjdGl2ZTpcbiAgICAgICAgdmlld01vZGUgIT09ICdwcmV2aWV3JyAmJlxuICAgICAgICB2aWV3TW9kZSAhPT0gJ3JlbmFtZScgJiZcbiAgICAgICAgdmlld01vZGUgIT09ICdzZWFyY2gnICYmXG4gICAgICAgIGlzQWdlbnRpY1NlYXJjaE9wdGlvbkZvY3VzZWQgJiZcbiAgICAgICAgYWdlbnRpY1NlYXJjaFN0YXRlLnN0YXR1cyAhPT0gJ3NlYXJjaGluZycsXG4gICAgfSxcbiAgKVxuXG4gIC8vIEhhbmRsZSBub24tZXNjYXBlIGlucHV0XG4gIHVzZUlucHV0KFxuICAgIChpbnB1dCwga2V5KSA9PiB7XG4gICAgICBpZiAodmlld01vZGUgPT09ICdwcmV2aWV3Jykge1xuICAgICAgICAvLyBQcmV2aWV3IG1vZGUgaGFuZGxlcyBpdHMgb3duIGlucHV0XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBBZ2VudGljIHNlYXJjaCBhYm9ydCBpcyBub3cgaGFuZGxlZCB2aWEga2V5YmluZGluZ1xuICAgICAgaWYgKGFnZW50aWNTZWFyY2hTdGF0ZS5zdGF0dXMgPT09ICdzZWFyY2hpbmcnKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBpZiAodmlld01vZGUgPT09ICdyZW5hbWUnKSB7XG4gICAgICAgIC8vIFJlbmFtZSBtb2RlIGVzY2FwZSBpcyBub3cgaGFuZGxlZCB2aWEga2V5YmluZGluZ1xuICAgICAgICAvLyBUaGlzIGJyYW5jaCBvbmx5IGhhbmRsZXMgbm9uLWVzY2FwZSBpbnB1dCBpbiByZW5hbWUgbW9kZSAodmlhIFRleHRJbnB1dClcbiAgICAgIH0gZWxzZSBpZiAodmlld01vZGUgPT09ICdzZWFyY2gnKSB7XG4gICAgICAgIC8vIFRleHQgaW5wdXQgaXMgaGFuZGxlZCBieSB1c2VTZWFyY2hJbnB1dCBob29rXG4gICAgICAgIGlmIChpbnB1dC50b0xvd2VyQ2FzZSgpID09PSAnbicgJiYga2V5LmN0cmwpIHtcbiAgICAgICAgICBleGl0U2VhcmNoTW9kZSgpXG4gICAgICAgIH0gZWxzZSBpZiAoa2V5LnJldHVybiB8fCBrZXkuZG93bkFycm93KSB7XG4gICAgICAgICAgLy8gRm9jdXMgYWdlbnRpYyBzZWFyY2ggb3B0aW9uIGlmIGFwcGxpY2FibGVcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBzZWFyY2hRdWVyeS50cmltKCkgJiZcbiAgICAgICAgICAgIG9uQWdlbnRpY1NlYXJjaCAmJlxuICAgICAgICAgICAgaXNBZ2VudGljU2VhcmNoRW5hYmxlZCAmJlxuICAgICAgICAgICAgYWdlbnRpY1NlYXJjaFN0YXRlLnN0YXR1cyAhPT0gJ3Jlc3VsdHMnXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBzZXRJc0FnZW50aWNTZWFyY2hPcHRpb25Gb2N1c2VkKHRydWUpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBIYW5kbGUgYWdlbnRpYyBzZWFyY2ggb3B0aW9uIHdoZW4gZm9jdXNlZCAoZXNjYXBlIGhhbmRsZWQgdmlhIGtleWJpbmRpbmcpXG4gICAgICAgIGlmIChpc0FnZW50aWNTZWFyY2hPcHRpb25Gb2N1c2VkKSB7XG4gICAgICAgICAgaWYgKGtleS5yZXR1cm4pIHtcbiAgICAgICAgICAgIC8vIFRyaWdnZXIgYWdlbnRpYyBzZWFyY2hcbiAgICAgICAgICAgIHZvaWQgaGFuZGxlQWdlbnRpY1NlYXJjaCgpXG4gICAgICAgICAgICBzZXRJc0FnZW50aWNTZWFyY2hPcHRpb25Gb2N1c2VkKGZhbHNlKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfSBlbHNlIGlmIChrZXkuZG93bkFycm93KSB7XG4gICAgICAgICAgICAvLyBNb3ZlIGZvY3VzIHRvIHRoZSBzZXNzaW9uIGxpc3RcbiAgICAgICAgICAgIHNldElzQWdlbnRpY1NlYXJjaE9wdGlvbkZvY3VzZWQoZmFsc2UpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9IGVsc2UgaWYgKGtleS51cEFycm93KSB7XG4gICAgICAgICAgICAvLyBHbyBiYWNrIHRvIHNlYXJjaCBtb2RlXG4gICAgICAgICAgICBzZXRWaWV3TW9kZSgnc2VhcmNoJylcbiAgICAgICAgICAgIHNldElzQWdlbnRpY1NlYXJjaE9wdGlvbkZvY3VzZWQoZmFsc2UpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBIYW5kbGUgdGFiIGN5Y2xpbmcgZm9yIHRhZyB0YWJzXG4gICAgICAgIGlmIChoYXNUYWdzICYmIGtleS50YWIpIHtcbiAgICAgICAgICBjb25zdCBvZmZzZXQgPSBrZXkuc2hpZnQgPyAtMSA6IDFcbiAgICAgICAgICBzZXRTZWxlY3RlZFRhZ0luZGV4KHByZXYgPT4ge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IHByZXYgPCB0YWdUYWJzLmxlbmd0aCA/IHByZXYgOiAwXG4gICAgICAgICAgICBjb25zdCBuZXdJbmRleCA9XG4gICAgICAgICAgICAgIChjdXJyZW50ICsgdGFnVGFicy5sZW5ndGggKyBvZmZzZXQpICUgdGFnVGFicy5sZW5ndGhcbiAgICAgICAgICAgIGNvbnN0IG5ld1RhYiA9IHRhZ1RhYnNbbmV3SW5kZXhdXG4gICAgICAgICAgICBsb2dFdmVudCgndGVuZ3Vfc2Vzc2lvbl90YWdfZmlsdGVyX2NoYW5nZWQnLCB7XG4gICAgICAgICAgICAgIGlzX2FsbDogbmV3VGFiID09PSAnQWxsJyxcbiAgICAgICAgICAgICAgdGFnX2NvdW50OiB1bmlxdWVUYWdzLmxlbmd0aCxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICByZXR1cm4gbmV3SW5kZXhcbiAgICAgICAgICB9KVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qga2V5SXNOb3RDdHJsT3JNZXRhID0gIWtleS5jdHJsICYmICFrZXkubWV0YVxuICAgICAgICBjb25zdCBsb3dlcklucHV0ID0gaW5wdXQudG9Mb3dlckNhc2UoKVxuICAgICAgICAvLyBDdHJsK2xldHRlciBzaG9ydGN1dHMgZm9yIGFjdGlvbnMgKGZyZWVpbmcgdXAgcGxhaW4gbGV0dGVycyBmb3IgdHlwZS10by1zZWFyY2gpXG4gICAgICAgIGlmIChsb3dlcklucHV0ID09PSAnYScgJiYga2V5LmN0cmwgJiYgb25Ub2dnbGVBbGxQcm9qZWN0cykge1xuICAgICAgICAgIG9uVG9nZ2xlQWxsUHJvamVjdHMoKVxuICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9zZXNzaW9uX2FsbF9wcm9qZWN0c190b2dnbGVkJywge1xuICAgICAgICAgICAgZW5hYmxlZDogIXNob3dBbGxQcm9qZWN0cyxcbiAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2UgaWYgKGxvd2VySW5wdXQgPT09ICdiJyAmJiBrZXkuY3RybCkge1xuICAgICAgICAgIGNvbnN0IG5ld0VuYWJsZWQgPSAhYnJhbmNoRmlsdGVyRW5hYmxlZFxuICAgICAgICAgIHNldEJyYW5jaEZpbHRlckVuYWJsZWQobmV3RW5hYmxlZClcbiAgICAgICAgICBsb2dFdmVudCgndGVuZ3Vfc2Vzc2lvbl9icmFuY2hfZmlsdGVyX3RvZ2dsZWQnLCB7XG4gICAgICAgICAgICBlbmFibGVkOiBuZXdFbmFibGVkLFxuICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSBpZiAobG93ZXJJbnB1dCA9PT0gJ3cnICYmIGtleS5jdHJsICYmIGhhc011bHRpcGxlV29ya3RyZWVzKSB7XG4gICAgICAgICAgY29uc3QgbmV3VmFsdWUgPSAhc2hvd0FsbFdvcmt0cmVlc1xuICAgICAgICAgIHNldFNob3dBbGxXb3JrdHJlZXMobmV3VmFsdWUpXG4gICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3Nlc3Npb25fd29ya3RyZWVfZmlsdGVyX3RvZ2dsZWQnLCB7XG4gICAgICAgICAgICBlbmFibGVkOiBuZXdWYWx1ZSxcbiAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2UgaWYgKGxvd2VySW5wdXQgPT09ICcvJyAmJiBrZXlJc05vdEN0cmxPck1ldGEpIHtcbiAgICAgICAgICBzZXRWaWV3TW9kZSgnc2VhcmNoJylcbiAgICAgICAgICBsb2dFdmVudCgndGVuZ3Vfc2Vzc2lvbl9zZWFyY2hfdG9nZ2xlZCcsIHsgZW5hYmxlZDogdHJ1ZSB9KVxuICAgICAgICB9IGVsc2UgaWYgKGxvd2VySW5wdXQgPT09ICdyJyAmJiBrZXkuY3RybCAmJiBmb2N1c2VkTG9nKSB7XG4gICAgICAgICAgc2V0Vmlld01vZGUoJ3JlbmFtZScpXG4gICAgICAgICAgc2V0UmVuYW1lVmFsdWUoJycpXG4gICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3Nlc3Npb25fcmVuYW1lX3N0YXJ0ZWQnLCB7fSlcbiAgICAgICAgfSBlbHNlIGlmIChsb3dlcklucHV0ID09PSAndicgJiYga2V5LmN0cmwgJiYgZm9jdXNlZExvZykge1xuICAgICAgICAgIHNldFByZXZpZXdMb2coZm9jdXNlZExvZylcbiAgICAgICAgICBzZXRWaWV3TW9kZSgncHJldmlldycpXG4gICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3Nlc3Npb25fcHJldmlld19vcGVuZWQnLCB7XG4gICAgICAgICAgICBtZXNzYWdlQ291bnQ6IGZvY3VzZWRMb2cubWVzc2FnZUNvdW50LFxuICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgZm9jdXNlZExvZyAmJlxuICAgICAgICAgIGtleUlzTm90Q3RybE9yTWV0YSAmJlxuICAgICAgICAgIGlucHV0Lmxlbmd0aCA+IDAgJiZcbiAgICAgICAgICAhL15cXHMrJC8udGVzdChpbnB1dClcbiAgICAgICAgKSB7XG4gICAgICAgICAgLy8gQW55IHByaW50YWJsZSBjaGFyYWN0ZXIgZW50ZXJzIHNlYXJjaCBtb2RlIGFuZCBzdGFydHMgdHlwaW5nXG4gICAgICAgICAgc2V0Vmlld01vZGUoJ3NlYXJjaCcpXG4gICAgICAgICAgc2V0U2VhcmNoUXVlcnkoaW5wdXQpXG4gICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3Nlc3Npb25fc2VhcmNoX3RvZ2dsZWQnLCB7IGVuYWJsZWQ6IHRydWUgfSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgeyBpc0FjdGl2ZTogdHJ1ZSB9LFxuICApXG5cbiAgY29uc3QgZmlsdGVySW5kaWNhdG9ycyA9IFtdXG4gIGlmIChicmFuY2hGaWx0ZXJFbmFibGVkICYmIGN1cnJlbnRCcmFuY2gpIHtcbiAgICBmaWx0ZXJJbmRpY2F0b3JzLnB1c2goY3VycmVudEJyYW5jaClcbiAgfVxuICBpZiAoaGFzTXVsdGlwbGVXb3JrdHJlZXMgJiYgIXNob3dBbGxXb3JrdHJlZXMpIHtcbiAgICBmaWx0ZXJJbmRpY2F0b3JzLnB1c2goJ2N1cnJlbnQgd29ya3RyZWUnKVxuICB9XG5cbiAgY29uc3Qgc2hvd0FkZGl0aW9uYWxGaWx0ZXJMaW5lID1cbiAgICBmaWx0ZXJJbmRpY2F0b3JzLmxlbmd0aCA+IDAgJiYgdmlld01vZGUgIT09ICdzZWFyY2gnXG5cbiAgLy8gU2VhcmNoIGJveCB0YWtlcyAzIGxpbmVzIChib3JkZXIgdG9wLCBjb250ZW50LCBib3JkZXIgYm90dG9tKVxuICBjb25zdCBzZWFyY2hCb3hMaW5lcyA9IDNcbiAgY29uc3QgaGVhZGVyTGluZXMgPVxuICAgIDUgKyBzZWFyY2hCb3hMaW5lcyArIChzaG93QWRkaXRpb25hbEZpbHRlckxpbmUgPyAxIDogMCkgKyB0YWdUYWJzTGluZXNcbiAgY29uc3QgZm9vdGVyTGluZXMgPSAyXG4gIGNvbnN0IHZpc2libGVDb3VudCA9IE1hdGgubWF4KFxuICAgIDEsXG4gICAgTWF0aC5mbG9vcigobWF4SGVpZ2h0IC0gaGVhZGVyTGluZXMgLSBmb290ZXJMaW5lcykgLyAzKSxcbiAgKVxuXG4gIC8vIFByb2dyZXNzaXZlIGxvYWRpbmc6IHJlcXVlc3QgbW9yZSBsb2dzIHdoZW4gdXNlciBzY3JvbGxzIG5lYXIgdGhlIGVuZFxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghb25Mb2FkTW9yZSkgcmV0dXJuXG4gICAgY29uc3QgYnVmZmVyID0gdmlzaWJsZUNvdW50ICogMlxuICAgIGlmIChmb2N1c2VkSW5kZXggKyBidWZmZXIgPj0gZGlzcGxheWVkTG9ncy5sZW5ndGgpIHtcbiAgICAgIG9uTG9hZE1vcmUodmlzaWJsZUNvdW50ICogMylcbiAgICB9XG4gIH0sIFtmb2N1c2VkSW5kZXgsIHZpc2libGVDb3VudCwgZGlzcGxheWVkTG9ncy5sZW5ndGgsIG9uTG9hZE1vcmVdKVxuXG4gIC8vIEVhcmx5IHJldHVybiBpZiBubyBsb2dzXG4gIGlmIChsb2dzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBudWxsXG4gIH1cblxuICAvLyBTaG93IHByZXZpZXcgbW9kZSBpZiBhY3RpdmVcbiAgaWYgKHZpZXdNb2RlID09PSAncHJldmlldycgJiYgcHJldmlld0xvZyAmJiBpc1Jlc3VtZVdpdGhSZW5hbWVFbmFibGVkKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxTZXNzaW9uUHJldmlld1xuICAgICAgICBsb2c9e3ByZXZpZXdMb2d9XG4gICAgICAgIG9uRXhpdD17KCkgPT4ge1xuICAgICAgICAgIHNldFZpZXdNb2RlKCdsaXN0JylcbiAgICAgICAgICBzZXRQcmV2aWV3TG9nKG51bGwpXG4gICAgICAgIH19XG4gICAgICAgIG9uU2VsZWN0PXtvblNlbGVjdH1cbiAgICAgIC8+XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBoZWlnaHQ9e21heEhlaWdodCAtIDF9PlxuICAgICAgPEJveCBmbGV4U2hyaW5rPXswfT5cbiAgICAgICAgPERpdmlkZXIgY29sb3I9XCJzdWdnZXN0aW9uXCIgLz5cbiAgICAgIDwvQm94PlxuICAgICAgPEJveCBmbGV4U2hyaW5rPXswfT5cbiAgICAgICAgPFRleHQ+IDwvVGV4dD5cbiAgICAgIDwvQm94PlxuXG4gICAgICB7aGFzVGFncyA/IChcbiAgICAgICAgPFRhZ1RhYnNcbiAgICAgICAgICB0YWJzPXt0YWdUYWJzfVxuICAgICAgICAgIHNlbGVjdGVkSW5kZXg9e2VmZmVjdGl2ZVRhZ0luZGV4fVxuICAgICAgICAgIGF2YWlsYWJsZVdpZHRoPXtjb2x1bW5zfVxuICAgICAgICAgIHNob3dBbGxQcm9qZWN0cz17c2hvd0FsbFByb2plY3RzfVxuICAgICAgICAvPlxuICAgICAgKSA6IChcbiAgICAgICAgPEJveCBmbGV4U2hyaW5rPXswfT5cbiAgICAgICAgICA8VGV4dCBib2xkIGNvbG9yPVwic3VnZ2VzdGlvblwiPlxuICAgICAgICAgICAgUmVzdW1lIFNlc3Npb25cbiAgICAgICAgICAgIHt2aWV3TW9kZSA9PT0gJ2xpc3QnICYmIGRpc3BsYXllZExvZ3MubGVuZ3RoID4gdmlzaWJsZUNvdW50ICYmIChcbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgeycgJ31cbiAgICAgICAgICAgICAgICAoe2ZvY3VzZWRJbmRleH0gb2Yge2Rpc3BsYXllZExvZ3MubGVuZ3RofSlcbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICAgIDxTZWFyY2hCb3hcbiAgICAgICAgcXVlcnk9e3NlYXJjaFF1ZXJ5fVxuICAgICAgICBpc0ZvY3VzZWQ9e3ZpZXdNb2RlID09PSAnc2VhcmNoJ31cbiAgICAgICAgaXNUZXJtaW5hbEZvY3VzZWQ9e2lzVGVybWluYWxGb2N1c2VkfVxuICAgICAgICBjdXJzb3JPZmZzZXQ9e3NlYXJjaEN1cnNvck9mZnNldH1cbiAgICAgIC8+XG4gICAgICB7ZmlsdGVySW5kaWNhdG9ycy5sZW5ndGggPiAwICYmIHZpZXdNb2RlICE9PSAnc2VhcmNoJyAmJiAoXG4gICAgICAgIDxCb3ggZmxleFNocmluaz17MH0gcGFkZGluZ0xlZnQ9ezJ9PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgPEJ5bGluZT57ZmlsdGVySW5kaWNhdG9yc308L0J5bGluZT5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICAgIDxCb3ggZmxleFNocmluaz17MH0+XG4gICAgICAgIDxUZXh0PiA8L1RleHQ+XG4gICAgICA8L0JveD5cblxuICAgICAgey8qIEFnZW50aWMgc2VhcmNoIGxvYWRpbmcgc3RhdGUgKi99XG4gICAgICB7YWdlbnRpY1NlYXJjaFN0YXRlLnN0YXR1cyA9PT0gJ3NlYXJjaGluZycgJiYgKFxuICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsxfSBmbGV4U2hyaW5rPXswfT5cbiAgICAgICAgICA8U3Bpbm5lciAvPlxuICAgICAgICAgIDxUZXh0PiBTZWFyY2hpbmfigKY8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cblxuICAgICAgey8qIFJlc3VsdHMgaGVhZGVyIHdoZW4gYWdlbnRpYyBzZWFyY2ggY29tcGxldGVkIHdpdGggcmVzdWx0cyAqL31cbiAgICAgIHthZ2VudGljU2VhcmNoU3RhdGUuc3RhdHVzID09PSAncmVzdWx0cycgJiZcbiAgICAgICAgYWdlbnRpY1NlYXJjaFN0YXRlLnJlc3VsdHMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgPEJveCBwYWRkaW5nTGVmdD17MX0gbWFyZ2luQm90dG9tPXsxfSBmbGV4U2hyaW5rPXswfT5cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgICAgQ2xhdWRlIGZvdW5kIHRoZXNlIHJlc3VsdHM6XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgIHsvKiBGYWxsYmFjayBtZXNzYWdlIHdoZW4gYWdlbnRpYyBzZWFyY2ggZm91bmQgbm8gcmVzdWx0cyBhbmQgZGVlcCBzZWFyY2ggYWxzbyBoYXMgbm90aGluZyAqL31cbiAgICAgIHthZ2VudGljU2VhcmNoU3RhdGUuc3RhdHVzID09PSAncmVzdWx0cycgJiZcbiAgICAgICAgYWdlbnRpY1NlYXJjaFN0YXRlLnJlc3VsdHMubGVuZ3RoID09PSAwICYmXG4gICAgICAgIGZpbHRlcmVkTG9ncy5sZW5ndGggPT09IDAgJiYgKFxuICAgICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezF9IG1hcmdpbkJvdHRvbT17MX0gZmxleFNocmluaz17MH0+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgICAgIE5vIG1hdGNoaW5nIHNlc3Npb25zIGZvdW5kLlxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuXG4gICAgICB7LyogRXJyb3IgbWVzc2FnZSB3aGVuIGFnZW50aWMgc2VhcmNoIGZhaWxlZCBhbmQgZGVlcCBzZWFyY2ggYWxzbyBoYXMgbm90aGluZyAqL31cbiAgICAgIHthZ2VudGljU2VhcmNoU3RhdGUuc3RhdHVzID09PSAnZXJyb3InICYmIGZpbHRlcmVkTG9ncy5sZW5ndGggPT09IDAgJiYgKFxuICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsxfSBtYXJnaW5Cb3R0b209ezF9IGZsZXhTaHJpbms9ezB9PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgIE5vIG1hdGNoaW5nIHNlc3Npb25zIGZvdW5kLlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuXG4gICAgICB7LyogQWdlbnRpYyBzZWFyY2ggb3B0aW9uIC0gZmlyc3QgaXRlbSBpbiBsaXN0IHdoZW4gc2VhcmNoaW5nICovfVxuICAgICAge0Jvb2xlYW4oc2VhcmNoUXVlcnkudHJpbSgpKSAmJlxuICAgICAgICBvbkFnZW50aWNTZWFyY2ggJiZcbiAgICAgICAgaXNBZ2VudGljU2VhcmNoRW5hYmxlZCAmJlxuICAgICAgICBhZ2VudGljU2VhcmNoU3RhdGUuc3RhdHVzICE9PSAnc2VhcmNoaW5nJyAmJlxuICAgICAgICBhZ2VudGljU2VhcmNoU3RhdGUuc3RhdHVzICE9PSAncmVzdWx0cycgJiZcbiAgICAgICAgYWdlbnRpY1NlYXJjaFN0YXRlLnN0YXR1cyAhPT0gJ2Vycm9yJyAmJiAoXG4gICAgICAgICAgPEJveCBmbGV4U2hyaW5rPXswfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezF9PlxuICAgICAgICAgICAgICA8VGV4dFxuICAgICAgICAgICAgICAgIGNvbG9yPXtpc0FnZW50aWNTZWFyY2hPcHRpb25Gb2N1c2VkID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge2lzQWdlbnRpY1NlYXJjaE9wdGlvbkZvY3VzZWQgPyBmaWd1cmVzLnBvaW50ZXIgOiAnICd9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICBjb2xvcj17aXNBZ2VudGljU2VhcmNoT3B0aW9uRm9jdXNlZCA/ICdzdWdnZXN0aW9uJyA6IHVuZGVmaW5lZH1cbiAgICAgICAgICAgICAgICBib2xkPXtpc0FnZW50aWNTZWFyY2hPcHRpb25Gb2N1c2VkfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgU2VhcmNoIGRlZXBseSB1c2luZyBDbGF1ZGUg4oaSXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgPEJveCBoZWlnaHQ9ezF9IC8+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgIHsvKiBIaWRlIHNlc3Npb24gbGlzdCB3aGVuIGFnZW50aWMgc2VhcmNoIGlzIGluIHByb2dyZXNzICovfVxuICAgICAge2FnZW50aWNTZWFyY2hTdGF0ZS5zdGF0dXMgPT09ICdzZWFyY2hpbmcnID8gbnVsbCA6IHZpZXdNb2RlID09PVxuICAgICAgICAgICdyZW5hbWUnICYmIGZvY3VzZWRMb2cgPyAoXG4gICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezJ9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VGV4dCBib2xkPlJlbmFtZSBzZXNzaW9uOjwvVGV4dD5cbiAgICAgICAgICA8Qm94IHBhZGRpbmdUb3A9ezF9PlxuICAgICAgICAgICAgPFRleHRJbnB1dFxuICAgICAgICAgICAgICB2YWx1ZT17cmVuYW1lVmFsdWV9XG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXtzZXRSZW5hbWVWYWx1ZX1cbiAgICAgICAgICAgICAgb25TdWJtaXQ9e2hhbmRsZVJlbmFtZVN1Ym1pdH1cbiAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9e2dldExvZ0Rpc3BsYXlUaXRsZShcbiAgICAgICAgICAgICAgICBmb2N1c2VkTG9nISxcbiAgICAgICAgICAgICAgICAnRW50ZXIgbmV3IHNlc3Npb24gbmFtZScsXG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIGNvbHVtbnM9e2NvbHVtbnN9XG4gICAgICAgICAgICAgIGN1cnNvck9mZnNldD17cmVuYW1lQ3Vyc29yT2Zmc2V0fVxuICAgICAgICAgICAgICBvbkNoYW5nZUN1cnNvck9mZnNldD17c2V0UmVuYW1lQ3Vyc29yT2Zmc2V0fVxuICAgICAgICAgICAgICBzaG93Q3Vyc29yPXt0cnVlfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApIDogaXNSZXN1bWVXaXRoUmVuYW1lRW5hYmxlZCA/IChcbiAgICAgICAgPFRyZWVTZWxlY3RcbiAgICAgICAgICBub2Rlcz17dHJlZU5vZGVzfVxuICAgICAgICAgIG9uU2VsZWN0PXtub2RlID0+IHtcbiAgICAgICAgICAgIG9uU2VsZWN0KG5vZGUudmFsdWUubG9nKVxuICAgICAgICAgIH19XG4gICAgICAgICAgb25Gb2N1cz17aGFuZGxlVHJlZVNlbGVjdEZvY3VzfVxuICAgICAgICAgIG9uQ2FuY2VsPXtvbkNhbmNlbH1cbiAgICAgICAgICBmb2N1c05vZGVJZD17Zm9jdXNlZE5vZGU/LmlkfVxuICAgICAgICAgIHZpc2libGVPcHRpb25Db3VudD17dmlzaWJsZUNvdW50fVxuICAgICAgICAgIGxheW91dD1cImV4cGFuZGVkXCJcbiAgICAgICAgICBpc0Rpc2FibGVkPXt2aWV3TW9kZSA9PT0gJ3NlYXJjaCcgfHwgaXNBZ2VudGljU2VhcmNoT3B0aW9uRm9jdXNlZH1cbiAgICAgICAgICBoaWRlSW5kZXhlcz17ZmFsc2V9XG4gICAgICAgICAgaXNOb2RlRXhwYW5kZWQ9e25vZGVJZCA9PiB7XG4gICAgICAgICAgICAvLyBBbHdheXMgZXhwYW5kIGlmIGluIHNlYXJjaCBvciBicmFuY2ggZmlsdGVyIG1vZGVcbiAgICAgICAgICAgIGlmICh2aWV3TW9kZSA9PT0gJ3NlYXJjaCcgfHwgYnJhbmNoRmlsdGVyRW5hYmxlZCkge1xuICAgICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gRXh0cmFjdCBzZXNzaW9uSWQgZnJvbSBub2RlIElEIChmb3JtYXQ6IFwiZ3JvdXA6c2Vzc2lvbklkXCIpXG4gICAgICAgICAgICBjb25zdCBzZXNzaW9uSWQgPVxuICAgICAgICAgICAgICB0eXBlb2Ygbm9kZUlkID09PSAnc3RyaW5nJyAmJiBub2RlSWQuc3RhcnRzV2l0aCgnZ3JvdXA6JylcbiAgICAgICAgICAgICAgICA/IG5vZGVJZC5zdWJzdHJpbmcoNilcbiAgICAgICAgICAgICAgICA6IG51bGxcbiAgICAgICAgICAgIHJldHVybiBzZXNzaW9uSWQgPyBleHBhbmRlZEdyb3VwU2Vzc2lvbklkcy5oYXMoc2Vzc2lvbklkKSA6IGZhbHNlXG4gICAgICAgICAgfX1cbiAgICAgICAgICBvbkV4cGFuZD17bm9kZUlkID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNlc3Npb25JZCA9XG4gICAgICAgICAgICAgIHR5cGVvZiBub2RlSWQgPT09ICdzdHJpbmcnICYmIG5vZGVJZC5zdGFydHNXaXRoKCdncm91cDonKVxuICAgICAgICAgICAgICAgID8gbm9kZUlkLnN1YnN0cmluZyg2KVxuICAgICAgICAgICAgICAgIDogbnVsbFxuICAgICAgICAgICAgaWYgKHNlc3Npb25JZCkge1xuICAgICAgICAgICAgICBzZXRFeHBhbmRlZEdyb3VwU2Vzc2lvbklkcyhwcmV2ID0+IG5ldyBTZXQocHJldikuYWRkKHNlc3Npb25JZCkpXG4gICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9zZXNzaW9uX2dyb3VwX2V4cGFuZGVkJywge30pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfX1cbiAgICAgICAgICBvbkNvbGxhcHNlPXtub2RlSWQgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbklkID1cbiAgICAgICAgICAgICAgdHlwZW9mIG5vZGVJZCA9PT0gJ3N0cmluZycgJiYgbm9kZUlkLnN0YXJ0c1dpdGgoJ2dyb3VwOicpXG4gICAgICAgICAgICAgICAgPyBub2RlSWQuc3Vic3RyaW5nKDYpXG4gICAgICAgICAgICAgICAgOiBudWxsXG4gICAgICAgICAgICBpZiAoc2Vzc2lvbklkKSB7XG4gICAgICAgICAgICAgIHNldEV4cGFuZGVkR3JvdXBTZXNzaW9uSWRzKHByZXYgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld1NldCA9IG5ldyBTZXQocHJldilcbiAgICAgICAgICAgICAgICBuZXdTZXQuZGVsZXRlKHNlc3Npb25JZClcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3U2V0XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfX1cbiAgICAgICAgICBvblVwRnJvbUZpcnN0SXRlbT17ZW50ZXJTZWFyY2hNb2RlfVxuICAgICAgICAvPlxuICAgICAgKSA6IChcbiAgICAgICAgPFNlbGVjdFxuICAgICAgICAgIG9wdGlvbnM9e2ZsYXRPcHRpb25zfVxuICAgICAgICAgIG9uQ2hhbmdlPXt2YWx1ZSA9PiB7XG4gICAgICAgICAgICAvLyBPbGQgZmxhdCBsaXN0IG1vZGUgLSBpbmRleCBkaXJlY3RseSBtYXBzIHRvIGRpc3BsYXllZExvZ3NcbiAgICAgICAgICAgIGNvbnN0IGl0ZW1JbmRleCA9IHBhcnNlSW50KHZhbHVlLCAxMClcbiAgICAgICAgICAgIGNvbnN0IGxvZyA9IGRpc3BsYXllZExvZ3NbaXRlbUluZGV4XVxuICAgICAgICAgICAgaWYgKGxvZykge1xuICAgICAgICAgICAgICBvblNlbGVjdChsb2cpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfX1cbiAgICAgICAgICB2aXNpYmxlT3B0aW9uQ291bnQ9e3Zpc2libGVDb3VudH1cbiAgICAgICAgICBvbkNhbmNlbD17b25DYW5jZWx9XG4gICAgICAgICAgb25Gb2N1cz17aGFuZGxlRmxhdE9wdGlvbnNTZWxlY3RGb2N1c31cbiAgICAgICAgICBkZWZhdWx0Rm9jdXNWYWx1ZT17Zm9jdXNlZE5vZGU/LmlkLnRvU3RyaW5nKCl9XG4gICAgICAgICAgbGF5b3V0PVwiZXhwYW5kZWRcIlxuICAgICAgICAgIGlzRGlzYWJsZWQ9e3ZpZXdNb2RlID09PSAnc2VhcmNoJyB8fCBpc0FnZW50aWNTZWFyY2hPcHRpb25Gb2N1c2VkfVxuICAgICAgICAgIG9uVXBGcm9tRmlyc3RJdGVtPXtlbnRlclNlYXJjaE1vZGV9XG4gICAgICAgIC8+XG4gICAgICApfVxuICAgICAgPEJveCBwYWRkaW5nTGVmdD17Mn0+XG4gICAgICAgIHtleGl0U3RhdGUucGVuZGluZyA/IChcbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5QcmVzcyB7ZXhpdFN0YXRlLmtleU5hbWV9IGFnYWluIHRvIGV4aXQ8L1RleHQ+XG4gICAgICAgICkgOiB2aWV3TW9kZSA9PT0gJ3JlbmFtZScgPyAoXG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cInNhdmVcIiAvPlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiY2FuY2VsXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgKSA6IGFnZW50aWNTZWFyY2hTdGF0ZS5zdGF0dXMgPT09ICdzZWFyY2hpbmcnID8gKFxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgICAgPFRleHQ+U2VhcmNoaW5nIHdpdGggQ2xhdWRl4oCmPC9UZXh0PlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiY2FuY2VsXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgKSA6IGlzQWdlbnRpY1NlYXJjaE9wdGlvbkZvY3VzZWQgPyAoXG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cInNlYXJjaFwiIC8+XG4gICAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIuKGk1wiIGFjdGlvbj1cInNraXBcIiAvPlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiY2FuY2VsXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgKSA6IHZpZXdNb2RlID09PSAnc2VhcmNoJyA/IChcbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgIHtpc1NlYXJjaGluZyAmJiBpc0RlZXBTZWFyY2hFbmFibGVkXG4gICAgICAgICAgICAgICAgICA/ICdTZWFyY2hpbmfigKYnXG4gICAgICAgICAgICAgICAgICA6ICdUeXBlIHRvIFNlYXJjaCd9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiRW50ZXJcIiBhY3Rpb249XCJzZWxlY3RcIiAvPlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiY2xlYXJcIlxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9CeWxpbmU+XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICApIDogKFxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgICAge29uVG9nZ2xlQWxsUHJvamVjdHMgJiYgKFxuICAgICAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgICAgc2hvcnRjdXQ9XCJDdHJsK0FcIlxuICAgICAgICAgICAgICAgICAgYWN0aW9uPXtgc2hvdyAke3Nob3dBbGxQcm9qZWN0cyA/ICdjdXJyZW50IGRpcicgOiAnYWxsIHByb2plY3RzJ31gfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIHtjdXJyZW50QnJhbmNoICYmIChcbiAgICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICAgIHNob3J0Y3V0PVwiQ3RybCtCXCJcbiAgICAgICAgICAgICAgICAgIGFjdGlvbj1cInRvZ2dsZSBicmFuY2hcIlxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIHtoYXNNdWx0aXBsZVdvcmt0cmVlcyAmJiAoXG4gICAgICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgICBzaG9ydGN1dD1cIkN0cmwrV1wiXG4gICAgICAgICAgICAgICAgICBhY3Rpb249e2BzaG93ICR7c2hvd0FsbFdvcmt0cmVlcyA/ICdjdXJyZW50IHdvcmt0cmVlJyA6ICdhbGwgd29ya3RyZWVzJ31gfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkN0cmwrVlwiIGFjdGlvbj1cInByZXZpZXdcIiAvPlxuICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJDdHJsK1JcIiBhY3Rpb249XCJyZW5hbWVcIiAvPlxuICAgICAgICAgICAgICA8VGV4dD5UeXBlIHRvIHNlYXJjaDwvVGV4dD5cbiAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImNhbmNlbFwiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIHtnZXRFeHBhbmRDb2xsYXBzZUhpbnQoKSAmJiAoXG4gICAgICAgICAgICAgICAgPFRleHQ+e2dldEV4cGFuZENvbGxhcHNlSGludCgpfTwvVGV4dD5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgKX1cbiAgICAgIDwvQm94PlxuICAgIDwvQm94PlxuICApXG59XG5cbi8qKlxuICogRXh0cmFjdHMgc2VhcmNoYWJsZSB0ZXh0IGNvbnRlbnQgZnJvbSBhIG1lc3NhZ2UuXG4gKiBIYW5kbGVzIGJvdGggc3RyaW5nIGNvbnRlbnQgYW5kIHN0cnVjdHVyZWQgY29udGVudCBibG9ja3MuXG4gKi9cbmZ1bmN0aW9uIGV4dHJhY3RTZWFyY2hhYmxlVGV4dChtZXNzYWdlOiBTZXJpYWxpemVkTWVzc2FnZSk6IHN0cmluZyB7XG4gIC8vIE9ubHkgZXh0cmFjdCBmcm9tIHVzZXIgYW5kIGFzc2lzdGFudCBtZXNzYWdlcyB0aGF0IGhhdmUgY29udGVudFxuICBpZiAobWVzc2FnZS50eXBlICE9PSAndXNlcicgJiYgbWVzc2FnZS50eXBlICE9PSAnYXNzaXN0YW50Jykge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgY29uc3QgY29udGVudCA9ICdtZXNzYWdlJyBpbiBtZXNzYWdlID8gbWVzc2FnZS5tZXNzYWdlPy5jb250ZW50IDogdW5kZWZpbmVkXG4gIGlmICghY29udGVudCkgcmV0dXJuICcnXG5cbiAgLy8gSGFuZGxlIHN0cmluZyBjb250ZW50IChzaW1wbGUgbWVzc2FnZXMpXG4gIGlmICh0eXBlb2YgY29udGVudCA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gY29udGVudFxuICB9XG5cbiAgLy8gSGFuZGxlIGFycmF5IG9mIGNvbnRlbnQgYmxvY2tzXG4gIGlmIChBcnJheS5pc0FycmF5KGNvbnRlbnQpKSB7XG4gICAgcmV0dXJuIGNvbnRlbnRcbiAgICAgIC5tYXAoYmxvY2sgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGJsb2NrID09PSAnc3RyaW5nJykgcmV0dXJuIGJsb2NrXG4gICAgICAgIGlmICgndGV4dCcgaW4gYmxvY2sgJiYgdHlwZW9mIGJsb2NrLnRleHQgPT09ICdzdHJpbmcnKSByZXR1cm4gYmxvY2sudGV4dFxuICAgICAgICByZXR1cm4gJydcbiAgICAgICAgLy8gd2UgZG9uJ3QgcmV0dXJuIHRoaW5raW5nIGJsb2NrcyBhbmQgdG9vbCBuYW1lcyBoZXJlO1xuICAgICAgICAvLyB0aGV5J3JlIG5vdCB1c2VmdWwgZm9yIHNlYXJjaCwgYXMgdGhleSBjYW4gYWRkIG5vaXNlIHRvIHRoZSBmdXp6eSBtYXRjaGluZ1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAgIC5qb2luKCcgJylcbiAgfVxuXG4gIHJldHVybiAnJ1xufVxuXG4vKipcbiAqIEJ1aWxkcyBzZWFyY2hhYmxlIHRleHQgZm9yIGEgbG9nIGluY2x1ZGluZyBtZXNzYWdlcywgdGl0bGVzLCBzdW1tYXJpZXMsIGFuZCBtZXRhZGF0YS5cbiAqIENyb3BzIGxvbmcgdHJhbnNjcmlwdHMgdG8gZmlyc3QvbGFzdCBOIG1lc3NhZ2VzIGZvciBwZXJmb3JtYW5jZS5cbiAqL1xuZnVuY3Rpb24gYnVpbGRTZWFyY2hhYmxlVGV4dChsb2c6IExvZ09wdGlvbik6IHN0cmluZyB7XG4gIGNvbnN0IHNlYXJjaGFibGVNZXNzYWdlcyA9XG4gICAgbG9nLm1lc3NhZ2VzLmxlbmd0aCA8PSBERUVQX1NFQVJDSF9NQVhfTUVTU0FHRVNcbiAgICAgID8gbG9nLm1lc3NhZ2VzXG4gICAgICA6IFtcbiAgICAgICAgICAuLi5sb2cubWVzc2FnZXMuc2xpY2UoMCwgREVFUF9TRUFSQ0hfQ1JPUF9TSVpFKSxcbiAgICAgICAgICAuLi5sb2cubWVzc2FnZXMuc2xpY2UoLURFRVBfU0VBUkNIX0NST1BfU0laRSksXG4gICAgICAgIF1cbiAgY29uc3QgbWVzc2FnZVRleHQgPSBzZWFyY2hhYmxlTWVzc2FnZXNcbiAgICAubWFwKGV4dHJhY3RTZWFyY2hhYmxlVGV4dClcbiAgICAuZmlsdGVyKEJvb2xlYW4pXG4gICAgLmpvaW4oJyAnKVxuXG4gIGNvbnN0IG1ldGFkYXRhID0gW1xuICAgIGxvZy5jdXN0b21UaXRsZSxcbiAgICBsb2cuc3VtbWFyeSxcbiAgICBsb2cuZmlyc3RQcm9tcHQsXG4gICAgbG9nLmdpdEJyYW5jaCxcbiAgICBsb2cudGFnLFxuICAgIGxvZy5wck51bWJlciA/IGBQUiAjJHtsb2cucHJOdW1iZXJ9YCA6IHVuZGVmaW5lZCxcbiAgICBsb2cucHJSZXBvc2l0b3J5LFxuICBdXG4gICAgLmZpbHRlcihCb29sZWFuKVxuICAgIC5qb2luKCcgJylcblxuICBjb25zdCBmdWxsVGV4dCA9IGAke21ldGFkYXRhfSAke21lc3NhZ2VUZXh0fWAudHJpbSgpXG4gIHJldHVybiBmdWxsVGV4dC5sZW5ndGggPiBERUVQX1NFQVJDSF9NQVhfVEVYVF9MRU5HVEhcbiAgICA/IGZ1bGxUZXh0LnNsaWNlKDAsIERFRVBfU0VBUkNIX01BWF9URVhUX0xFTkdUSClcbiAgICA6IGZ1bGxUZXh0XG59XG5cbmZ1bmN0aW9uIGdyb3VwTG9nc0J5U2Vzc2lvbklkKFxuICBmaWx0ZXJlZExvZ3M6IExvZ09wdGlvbltdLFxuKTogTWFwPHN0cmluZywgTG9nT3B0aW9uW10+IHtcbiAgY29uc3QgZ3JvdXBzID0gbmV3IE1hcDxzdHJpbmcsIExvZ09wdGlvbltdPigpXG5cbiAgZm9yIChjb25zdCBsb2cgb2YgZmlsdGVyZWRMb2dzKSB7XG4gICAgY29uc3Qgc2Vzc2lvbklkID0gZ2V0U2Vzc2lvbklkRnJvbUxvZyhsb2cpXG4gICAgaWYgKHNlc3Npb25JZCkge1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSBncm91cHMuZ2V0KHNlc3Npb25JZClcbiAgICAgIGlmIChleGlzdGluZykge1xuICAgICAgICBleGlzdGluZy5wdXNoKGxvZylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGdyb3Vwcy5zZXQoc2Vzc2lvbklkLCBbbG9nXSlcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTb3J0IGxvZ3Mgd2l0aGluIGVhY2ggZ3JvdXAgYnkgbW9kaWZpZWQgZGF0ZSAobmV3ZXN0IGZpcnN0KVxuICBncm91cHMuZm9yRWFjaChsb2dzID0+XG4gICAgbG9ncy5zb3J0KFxuICAgICAgKGEsIGIpID0+IG5ldyBEYXRlKGIubW9kaWZpZWQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEubW9kaWZpZWQpLmdldFRpbWUoKSxcbiAgICApLFxuICApXG5cbiAgcmV0dXJuIGdyb3Vwc1xufVxuXG4vKipcbiAqIEdldCB1bmlxdWUgdGFncyBmcm9tIGEgbGlzdCBvZiBsb2dzLCBzb3J0ZWQgYWxwaGFiZXRpY2FsbHlcbiAqL1xuZnVuY3Rpb24gZ2V0VW5pcXVlVGFncyhsb2dzOiBMb2dPcHRpb25bXSk6IHN0cmluZ1tdIHtcbiAgY29uc3QgdGFncyA9IG5ldyBTZXQ8c3RyaW5nPigpXG4gIGZvciAoY29uc3QgbG9nIG9mIGxvZ3MpIHtcbiAgICBpZiAobG9nLnRhZykge1xuICAgICAgdGFncy5hZGQobG9nLnRhZylcbiAgICB9XG4gIH1cbiAgcmV0dXJuIEFycmF5LmZyb20odGFncykuc29ydCgoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsT0FBT0EsS0FBSyxNQUFNLE9BQU87QUFDekIsT0FBT0MsT0FBTyxNQUFNLFNBQVM7QUFDN0IsT0FBT0MsSUFBSSxNQUFNLFNBQVM7QUFDMUIsT0FBT0MsS0FBSyxNQUFNLE9BQU87QUFDekIsU0FBU0MsY0FBYyxFQUFFQyxZQUFZLFFBQVEsdUJBQXVCO0FBQ3BFLFNBQVNDLDhCQUE4QixRQUFRLDRDQUE0QztBQUMzRixTQUFTQyxjQUFjLFFBQVEsNEJBQTRCO0FBQzNELFNBQVNDLGVBQWUsUUFBUSw2QkFBNkI7QUFDN0QsU0FBU0MsVUFBVSxRQUFRLG9CQUFvQjtBQUMvQyxjQUFjQyxLQUFLLFFBQVEsa0JBQWtCO0FBQzdDLFNBQVNDLEdBQUcsRUFBRUMsSUFBSSxFQUFFQyxRQUFRLEVBQUVDLGdCQUFnQixFQUFFQyxRQUFRLFFBQVEsV0FBVztBQUMzRSxTQUFTQyxhQUFhLFFBQVEsaUNBQWlDO0FBQy9ELFNBQVNDLFFBQVEsUUFBUSxnQ0FBZ0M7QUFDekQsY0FBY0MsU0FBUyxFQUFFQyxpQkFBaUIsUUFBUSxrQkFBa0I7QUFDcEUsU0FBU0MsaUJBQWlCLEVBQUVDLGVBQWUsUUFBUSxvQkFBb0I7QUFDdkUsU0FBU0MsZ0JBQWdCLFFBQVEsOEJBQThCO0FBQy9ELFNBQVNDLFNBQVMsUUFBUSxpQkFBaUI7QUFDM0MsU0FBU0Msa0JBQWtCLFFBQVEsaUJBQWlCO0FBQ3BELFNBQ0VDLHdDQUF3QyxFQUN4Q0MsbUJBQW1CLEVBQ25CQyxvQkFBb0IsRUFDcEJDLGVBQWUsUUFDViw0QkFBNEI7QUFDbkMsU0FBU0MsUUFBUSxRQUFRLG1CQUFtQjtBQUM1QyxTQUFTQyx3QkFBd0IsUUFBUSwrQkFBK0I7QUFDeEUsU0FBU0MsTUFBTSxRQUFRLDBCQUEwQjtBQUNqRCxTQUFTQyxNQUFNLFFBQVEsMkJBQTJCO0FBQ2xELFNBQVNDLE9BQU8sUUFBUSw0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