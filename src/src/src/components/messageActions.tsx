import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import type { RefObject } from 'react';
import React, { useCallback, useMemo, useRef } from 'react';
import { Box, Text } from '../ink.js';
import { useKeybindings } from '../keybindings/useKeybinding.js';
import { logEvent } from '../services/analytics/index.js';
import type { NormalizedUserMessage, RenderableMessage } from '../types/message.js';
import { isEmptyMessageText, SYNTHETIC_MESSAGES } from '../utils/messages.js';
const NAVIGABLE_TYPES = ['user', 'assistant', 'grouped_tool_use', 'collapsed_read_search', 'system', 'attachment'] as const;
export type NavigableType = (typeof NAVIGABLE_TYPES)[number];
export type NavigableOf<T extends NavigableType> = Extract<RenderableMessage, {
  type: T;
}>;
export type NavigableMessage = RenderableMessage;

// Tier-2 blocklist (tier-1 is height > 0) — things that render but aren't actionable.
export function isNavigableMessage(msg: NavigableMessage): boolean {
  switch (msg.type) {
    case 'assistant':
      {
        const b = msg.message.content[0];
        // Text responses (minus AssistantTextMessage's return-null cases — tier-1
        // misses unmeasured virtual items), or tool calls with extractable input.
        return b?.type === 'text' && !isEmptyMessageText(b.text) && !SYNTHETIC_MESSAGES.has(b.text) || b?.type === 'tool_use' && b.name in PRIMARY_INPUT;
      }
    case 'user':
      {
        if (msg.isMeta || msg.isCompactSummary) return false;
        const b = msg.message.content[0];
        if (b?.type !== 'text') return false;
        // Interrupt etc. — synthetic, not user-authored.
        if (SYNTHETIC_MESSAGES.has(b.text)) return false;
        // Same filter as VirtualMessageList sticky-prompt: XML-wrapped (command
        // expansions, bash-stdout, etc.) aren't real prompts.
        return !stripSystemReminders(b.text).startsWith('<');
      }
    case 'system':
      // biome-ignore lint/nursery/useExhaustiveSwitchCases: blocklist — fallthrough return-true is the design
      switch (msg.subtype) {
        case 'api_metrics':
        case 'stop_hook_summary':
        case 'turn_duration':
        case 'memory_saved':
        case 'agents_killed':
        case 'away_summary':
        case 'thinking':
          return false;
      }
      return true;
    case 'grouped_tool_use':
    case 'collapsed_read_search':
      return true;
    case 'attachment':
      switch (msg.attachment.type) {
        case 'queued_command':
        case 'diagnostics':
        case 'hook_blocking_error':
        case 'hook_error_during_execution':
          return true;
      }
      return false;
  }
}
type PrimaryInput = {
  label: string;
  extract: (input: Record<string, unknown>) => string | undefined;
};
const str = (k: string) => (i: Record<string, unknown>) => typeof i[k] === 'string' ? i[k] : undefined;
const PRIMARY_INPUT: Record<string, PrimaryInput> = {
  Read: {
    label: 'path',
    extract: str('file_path')
  },
  Edit: {
    label: 'path',
    extract: str('file_path')
  },
  Write: {
    label: 'path',
    extract: str('file_path')
  },
  NotebookEdit: {
    label: 'path',
    extract: str('notebook_path')
  },
  Bash: {
    label: 'command',
    extract: str('command')
  },
  Grep: {
    label: 'pattern',
    extract: str('pattern')
  },
  Glob: {
    label: 'pattern',
    extract: str('pattern')
  },
  WebFetch: {
    label: 'url',
    extract: str('url')
  },
  WebSearch: {
    label: 'query',
    extract: str('query')
  },
  Task: {
    label: 'prompt',
    extract: str('prompt')
  },
  Agent: {
    label: 'prompt',
    extract: str('prompt')
  },
  Tmux: {
    label: 'command',
    extract: i => Array.isArray(i.args) ? `tmux ${i.args.join(' ')}` : undefined
  }
};

// Only AgentTool has renderGroupedToolUse — Edit/Bash/etc. stay as assistant tool_use blocks.
export function toolCallOf(msg: NavigableMessage): {
  name: string;
  input: Record<string, unknown>;
} | undefined {
  if (msg.type === 'assistant') {
    const b = msg.message.content[0];
    if (b?.type === 'tool_use') return {
      name: b.name,
      input: b.input as Record<string, unknown>
    };
  }
  if (msg.type === 'grouped_tool_use') {
    const b = msg.messages[0]?.message.content[0];
    if (b?.type === 'tool_use') return {
      name: msg.toolName,
      input: b.input as Record<string, unknown>
    };
  }
  return undefined;
}
export type MessageActionCaps = {
  copy: (text: string) => void;
  edit: (msg: NormalizedUserMessage) => Promise<void>;
};

// Identity builder — preserves tuple type so `run`'s param narrows (array literal widens without this).
function action<const T extends NavigableType, const K extends string>(a: {
  key: K;
  label: string | ((s: MessageActionsState) => string);
  types: readonly T[];
  applies?: (s: MessageActionsState) => boolean;
  stays?: true;
  run: (m: NavigableOf<T>, caps: MessageActionCaps) => void;
}) {
  return a;
}
export const MESSAGE_ACTIONS = [action({
  key: 'enter',
  label: s => s.expanded ? 'collapse' : 'expand',
  types: ['grouped_tool_use', 'collapsed_read_search', 'attachment', 'system'],
  stays: true,
  // Empty — `stays` handled inline by dispatch.
  run: () => {}
}), action({
  key: 'enter',
  label: 'edit',
  types: ['user'],
  run: (m, c) => void c.edit(m)
}), action({
  key: 'c',
  label: 'copy',
  types: NAVIGABLE_TYPES,
  run: (m, c) => c.copy(copyTextOf(m))
}), action({
  key: 'p',
  // `!` safe: applies() guarantees toolName ∈ PRIMARY_INPUT.
  label: s => `copy ${PRIMARY_INPUT[s.toolName!]!.label}`,
  types: ['grouped_tool_use', 'assistant'],
  applies: s => s.toolName != null && s.toolName in PRIMARY_INPUT,
  run: (m, c) => {
    const tc = toolCallOf(m);
    if (!tc) return;
    const val = PRIMARY_INPUT[tc.name]?.extract(tc.input);
    if (val) c.copy(val);
  }
})] as const;
function isApplicable(a: (typeof MESSAGE_ACTIONS)[number], c: MessageActionsState): boolean {
  if (!(a.types as readonly string[]).includes(c.msgType)) return false;
  return !a.applies || a.applies(c);
}
export type MessageActionsState = {
  uuid: string;
  msgType: NavigableType;
  expanded: boolean;
  toolName?: string;
};
export type MessageActionsNav = {
  enterCursor: () => void;
  navigatePrev: () => void;
  navigateNext: () => void;
  navigatePrevUser: () => void;
  navigateNextUser: () => void;
  navigateTop: () => void;
  navigateBottom: () => void;
  getSelected: () => NavigableMessage | null;
};
export const MessageActionsSelectedContext = React.createContext(false);
export const InVirtualListContext = React.createContext(false);

// bg must go on the Box that HAS marginTop (margin stays outside paint) — that's inside each consumer.
export function useSelectedMessageBg() {
  return React.useContext(MessageActionsSelectedContext) ? "messageActionsBackground" : undefined;
}

// Can't call useKeybindings here — hook runs outside <KeybindingSetup> provider. Returns handlers instead.
export function useMessageActions(cursor: MessageActionsState | null, setCursor: React.Dispatch<React.SetStateAction<MessageActionsState | null>>, navRef: RefObject<MessageActionsNav | null>, caps: MessageActionCaps): {
  enter: () => void;
  handlers: Record<string, () => void>;
} {
  // Refs keep handlers stable — no useKeybindings re-register per message append.
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const capsRef = useRef(caps);
  capsRef.current = caps;
  const handlers = useMemo(() => {
    const h: Record<string, () => void> = {
      'messageActions:prev': () => navRef.current?.navigatePrev(),
      'messageActions:next': () => navRef.current?.navigateNext(),
      'messageActions:prevUser': () => navRef.current?.navigatePrevUser(),
      'messageActions:nextUser': () => navRef.current?.navigateNextUser(),
      'messageActions:top': () => navRef.current?.navigateTop(),
      'messageActions:bottom': () => navRef.current?.navigateBottom(),
      'messageActions:escape': () => setCursor(c => c?.expanded ? {
        ...c,
        expanded: false
      } : null),
      // ctrl+c skips the collapse step — from expanded-during-streaming, two-stage
      // would mean 3 presses to interrupt (collapse→null→cancel).
      'messageActions:ctrlc': () => setCursor(null)
    };
    for (const key of new Set(MESSAGE_ACTIONS.map(a_1 => a_1.key))) {
      h[`messageActions:${key}`] = () => {
        const c_0 = cursorRef.current;
        if (!c_0) return;
        const a_0 = MESSAGE_ACTIONS.find(a => a.key === key && isApplicable(a, c_0));
        if (!a_0) return;
        if (a_0.stays) {
          setCursor(c_1 => c_1 ? {
            ...c_1,
            expanded: !c_1.expanded
          } : null);
          return;
        }
        const m = navRef.current?.getSelected();
        if (!m) return;
        (a_0.run as (m: NavigableMessage, c_0: MessageActionCaps) => void)(m, capsRef.current);
        setCursor(null);
      };
    }
    return h;
  }, [setCursor, navRef]);
  const enter = useCallback(() => {
    logEvent('tengu_message_actions_enter', {});
    navRef.current?.enterCursor();
  }, [navRef]);
  return {
    enter,
    handlers
  };
}

// Must mount inside <KeybindingSetup>.
export function MessageActionsKeybindings(t0) {
  const $ = _c(2);
  const {
    handlers,
    isActive
  } = t0;
  let t1;
  if ($[0] !== isActive) {
    t1 = {
      context: "MessageActions",
      isActive
    };
    $[0] = isActive;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  useKeybindings(handlers, t1);
  return null;
}

// borderTop-only Box matches PromptInput's ─── line for stable footer height.
export function MessageActionsBar(t0) {
  const $ = _c(28);
  const {
    cursor
  } = t0;
  let T0;
  let T1;
  let t1;
  let t2;
  let t3;
  let t4;
  let t5;
  let t6;
  let t7;
  if ($[0] !== cursor) {
    const applicable = MESSAGE_ACTIONS.filter(a => isApplicable(a, cursor));
    T1 = Box;
    t4 = "column";
    t5 = 0;
    t6 = 1;
    if ($[10] === Symbol.for("react.memo_cache_sentinel")) {
      t7 = <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderDimColor={true} />;
      $[10] = t7;
    } else {
      t7 = $[10];
    }
    T0 = Box;
    t1 = 2;
    t2 = 1;
    t3 = applicable.map((a_0, i) => {
      const label = typeof a_0.label === "function" ? a_0.label(cursor) : a_0.label;
      return <React.Fragment key={a_0.key}>{i > 0 && <Text dimColor={true}> · </Text>}<Text bold={true} dimColor={false}>{a_0.key}</Text><Text dimColor={true}> {label}</Text></React.Fragment>;
    });
    $[0] = cursor;
    $[1] = T0;
    $[2] = T1;
    $[3] = t1;
    $[4] = t2;
    $[5] = t3;
    $[6] = t4;
    $[7] = t5;
    $[8] = t6;
    $[9] = t7;
  } else {
    T0 = $[1];
    T1 = $[2];
    t1 = $[3];
    t2 = $[4];
    t3 = $[5];
    t4 = $[6];
    t5 = $[7];
    t6 = $[8];
    t7 = $[9];
  }
  let t10;
  let t11;
  let t12;
  let t8;
  let t9;
  if ($[11] === Symbol.for("react.memo_cache_sentinel")) {
    t8 = <Text dimColor={true}> · </Text>;
    t9 = <Text bold={true} dimColor={false}>{figures.arrowUp}{figures.arrowDown}</Text>;
    t10 = <Text dimColor={true}> navigate · </Text>;
    t11 = <Text bold={true} dimColor={false}>esc</Text>;
    t12 = <Text dimColor={true}> back</Text>;
    $[11] = t10;
    $[12] = t11;
    $[13] = t12;
    $[14] = t8;
    $[15] = t9;
  } else {
    t10 = $[11];
    t11 = $[12];
    t12 = $[13];
    t8 = $[14];
    t9 = $[15];
  }
  let t13;
  if ($[16] !== T0 || $[17] !== t1 || $[18] !== t2 || $[19] !== t3) {
    t13 = <T0 paddingX={t1} paddingY={t2}>{t3}{t8}{t9}{t10}{t11}{t12}</T0>;
    $[16] = T0;
    $[17] = t1;
    $[18] = t2;
    $[19] = t3;
    $[20] = t13;
  } else {
    t13 = $[20];
  }
  let t14;
  if ($[21] !== T1 || $[22] !== t13 || $[23] !== t4 || $[24] !== t5 || $[25] !== t6 || $[26] !== t7) {
    t14 = <T1 flexDirection={t4} flexShrink={t5} paddingY={t6}>{t7}{t13}</T1>;
    $[21] = T1;
    $[22] = t13;
    $[23] = t4;
    $[24] = t5;
    $[25] = t6;
    $[26] = t7;
    $[27] = t14;
  } else {
    t14 = $[27];
  }
  return t14;
}
export function stripSystemReminders(text: string): string {
  const CLOSE = '</system-reminder>';
  let t = text.trimStart();
  while (t.startsWith('<system-reminder>')) {
    const end = t.indexOf(CLOSE);
    if (end < 0) break;
    t = t.slice(end + CLOSE.length).trimStart();
  }
  return t;
}
export function copyTextOf(msg: NavigableMessage): string {
  switch (msg.type) {
    case 'user':
      {
        const b = msg.message.content[0];
        return b?.type === 'text' ? stripSystemReminders(b.text) : '';
      }
    case 'assistant':
      {
        const b = msg.message.content[0];
        if (b?.type === 'text') return b.text;
        const tc = toolCallOf(msg);
        return tc ? PRIMARY_INPUT[tc.name]?.extract(tc.input) ?? '' : '';
      }
    case 'grouped_tool_use':
      return msg.results.map(toolResultText).filter(Boolean).join('\n\n');
    case 'collapsed_read_search':
      return msg.messages.flatMap(m => m.type === 'user' ? [toolResultText(m)] : m.type === 'grouped_tool_use' ? m.results.map(toolResultText) : []).filter(Boolean).join('\n\n');
    case 'system':
      if ('content' in msg) return msg.content;
      if ('error' in msg) return String(msg.error);
      return msg.subtype;
    case 'attachment':
      {
        const a = msg.attachment;
        if (a.type === 'queued_command') {
          const p = a.prompt;
          return typeof p === 'string' ? p : p.flatMap(b => b.type === 'text' ? [b.text] : []).join('\n');
        }
        return `[${a.type}]`;
      }
  }
}
function toolResultText(r: NormalizedUserMessage): string {
  const b = r.message.content[0];
  if (b?.type !== 'tool_result') return '';
  const c = b.content;
  if (typeof c === 'string') return c;
  if (!c) return '';
  return c.flatMap(x => x.type === 'text' ? [x.text] : []).join('\n');
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVmT2JqZWN0IiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZU1lbW8iLCJ1c2VSZWYiLCJCb3giLCJUZXh0IiwidXNlS2V5YmluZGluZ3MiLCJsb2dFdmVudCIsIk5vcm1hbGl6ZWRVc2VyTWVzc2FnZSIsIlJlbmRlcmFibGVNZXNzYWdlIiwiaXNFbXB0eU1lc3NhZ2VUZXh0IiwiU1lOVEhFVElDX01FU1NBR0VTIiwiTkFWSUdBQkxFX1RZUEVTIiwiY29uc3QiLCJOYXZpZ2FibGVUeXBlIiwiTmF2aWdhYmxlT2YiLCJFeHRyYWN0IiwidHlwZSIsIlQiLCJOYXZpZ2FibGVNZXNzYWdlIiwiaXNOYXZpZ2FibGVNZXNzYWdlIiwibXNnIiwiYiIsIm1lc3NhZ2UiLCJjb250ZW50IiwidGV4dCIsImhhcyIsIm5hbWUiLCJQUklNQVJZX0lOUFVUIiwiaXNNZXRhIiwiaXNDb21wYWN0U3VtbWFyeSIsInN0cmlwU3lzdGVtUmVtaW5kZXJzIiwic3RhcnRzV2l0aCIsInN1YnR5cGUiLCJhdHRhY2htZW50IiwiUHJpbWFyeUlucHV0IiwibGFiZWwiLCJleHRyYWN0IiwiaW5wdXQiLCJSZWNvcmQiLCJzdHIiLCJrIiwiaSIsInVuZGVmaW5lZCIsIlJlYWQiLCJFZGl0IiwiV3JpdGUiLCJOb3RlYm9va0VkaXQiLCJCYXNoIiwiR3JlcCIsIkdsb2IiLCJXZWJGZXRjaCIsIldlYlNlYXJjaCIsIlRhc2siLCJBZ2VudCIsIlRtdXgiLCJBcnJheSIsImlzQXJyYXkiLCJhcmdzIiwiam9pbiIsInRvb2xDYWxsT2YiLCJtZXNzYWdlcyIsInRvb2xOYW1lIiwiTWVzc2FnZUFjdGlvbkNhcHMiLCJjb3B5IiwiZWRpdCIsIlByb21pc2UiLCJhY3Rpb24iLCJhIiwia2V5IiwiSyIsInMiLCJNZXNzYWdlQWN0aW9uc1N0YXRlIiwidHlwZXMiLCJhcHBsaWVzIiwic3RheXMiLCJydW4iLCJtIiwiY2FwcyIsIk1FU1NBR0VfQUNUSU9OUyIsImV4cGFuZGVkIiwiYyIsImNvcHlUZXh0T2YiLCJ0YyIsInZhbCIsImlzQXBwbGljYWJsZSIsImluY2x1ZGVzIiwibXNnVHlwZSIsInV1aWQiLCJNZXNzYWdlQWN0aW9uc05hdiIsImVudGVyQ3Vyc29yIiwibmF2aWdhdGVQcmV2IiwibmF2aWdhdGVOZXh0IiwibmF2aWdhdGVQcmV2VXNlciIsIm5hdmlnYXRlTmV4dFVzZXIiLCJuYXZpZ2F0ZVRvcCIsIm5hdmlnYXRlQm90dG9tIiwiZ2V0U2VsZWN0ZWQiLCJNZXNzYWdlQWN0aW9uc1NlbGVjdGVkQ29udGV4dCIsImNyZWF0ZUNvbnRleHQiLCJJblZpcnR1YWxMaXN0Q29udGV4dCIsInVzZVNlbGVjdGVkTWVzc2FnZUJnIiwidXNlQ29udGV4dCIsInVzZU1lc3NhZ2VBY3Rpb25zIiwiY3Vyc29yIiwic2V0Q3Vyc29yIiwiRGlzcGF0Y2giLCJTZXRTdGF0ZUFjdGlvbiIsIm5hdlJlZiIsImVudGVyIiwiaGFuZGxlcnMiLCJjdXJzb3JSZWYiLCJjdXJyZW50IiwiY2Fwc1JlZiIsImgiLCJtZXNzYWdlQWN0aW9uczpwcmV2IiwibWVzc2FnZUFjdGlvbnM6bmV4dCIsIm1lc3NhZ2VBY3Rpb25zOnByZXZVc2VyIiwibWVzc2FnZUFjdGlvbnM6bmV4dFVzZXIiLCJtZXNzYWdlQWN0aW9uczp0b3AiLCJtZXNzYWdlQWN0aW9uczpib3R0b20iLCJtZXNzYWdlQWN0aW9uczplc2NhcGUiLCJtZXNzYWdlQWN0aW9uczpjdHJsYyIsIlNldCIsIm1hcCIsImZpbmQiLCJNZXNzYWdlQWN0aW9uc0tleWJpbmRpbmdzIiwidDAiLCIkIiwiX2MiLCJpc0FjdGl2ZSIsInQxIiwiY29udGV4dCIsIk1lc3NhZ2VBY3Rpb25zQmFyIiwiVDAiLCJUMSIsInQyIiwidDMiLCJ0NCIsInQ1IiwidDYiLCJ0NyIsImFwcGxpY2FibGUiLCJmaWx0ZXIiLCJTeW1ib2wiLCJmb3IiLCJhXzAiLCJ0MTAiLCJ0MTEiLCJ0MTIiLCJ0OCIsInQ5IiwiYXJyb3dVcCIsImFycm93RG93biIsInQxMyIsInQxNCIsIkNMT1NFIiwidCIsInRyaW1TdGFydCIsImVuZCIsImluZGV4T2YiLCJzbGljZSIsImxlbmd0aCIsInJlc3VsdHMiLCJ0b29sUmVzdWx0VGV4dCIsIkJvb2xlYW4iLCJmbGF0TWFwIiwiU3RyaW5nIiwiZXJyb3IiLCJwIiwicHJvbXB0IiwiciIsIngiXSwic291cmNlcyI6WyJtZXNzYWdlQWN0aW9ucy50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCB0eXBlIHsgUmVmT2JqZWN0IH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgUmVhY3QsIHsgdXNlQ2FsbGJhY2ssIHVzZU1lbW8sIHVzZVJlZiB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgQm94LCBUZXh0IH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHsgdXNlS2V5YmluZGluZ3MgfSBmcm9tICcuLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHsgbG9nRXZlbnQgfSBmcm9tICcuLi9zZXJ2aWNlcy9hbmFseXRpY3MvaW5kZXguanMnXG5pbXBvcnQgdHlwZSB7XG4gIE5vcm1hbGl6ZWRVc2VyTWVzc2FnZSxcbiAgUmVuZGVyYWJsZU1lc3NhZ2UsXG59IGZyb20gJy4uL3R5cGVzL21lc3NhZ2UuanMnXG5pbXBvcnQgeyBpc0VtcHR5TWVzc2FnZVRleHQsIFNZTlRIRVRJQ19NRVNTQUdFUyB9IGZyb20gJy4uL3V0aWxzL21lc3NhZ2VzLmpzJ1xuXG5jb25zdCBOQVZJR0FCTEVfVFlQRVMgPSBbXG4gICd1c2VyJyxcbiAgJ2Fzc2lzdGFudCcsXG4gICdncm91cGVkX3Rvb2xfdXNlJyxcbiAgJ2NvbGxhcHNlZF9yZWFkX3NlYXJjaCcsXG4gICdzeXN0ZW0nLFxuICAnYXR0YWNobWVudCcsXG5dIGFzIGNvbnN0XG5leHBvcnQgdHlwZSBOYXZpZ2FibGVUeXBlID0gKHR5cGVvZiBOQVZJR0FCTEVfVFlQRVMpW251bWJlcl1cblxuZXhwb3J0IHR5cGUgTmF2aWdhYmxlT2Y8VCBleHRlbmRzIE5hdmlnYWJsZVR5cGU+ID0gRXh0cmFjdDxcbiAgUmVuZGVyYWJsZU1lc3NhZ2UsXG4gIHsgdHlwZTogVCB9XG4+XG5leHBvcnQgdHlwZSBOYXZpZ2FibGVNZXNzYWdlID0gUmVuZGVyYWJsZU1lc3NhZ2VcblxuLy8gVGllci0yIGJsb2NrbGlzdCAodGllci0xIGlzIGhlaWdodCA+IDApIOKAlCB0aGluZ3MgdGhhdCByZW5kZXIgYnV0IGFyZW4ndCBhY3Rpb25hYmxlLlxuZXhwb3J0IGZ1bmN0aW9uIGlzTmF2aWdhYmxlTWVzc2FnZShtc2c6IE5hdmlnYWJsZU1lc3NhZ2UpOiBib29sZWFuIHtcbiAgc3dpdGNoIChtc2cudHlwZSkge1xuICAgIGNhc2UgJ2Fzc2lzdGFudCc6IHtcbiAgICAgIGNvbnN0IGIgPSBtc2cubWVzc2FnZS5jb250ZW50WzBdXG4gICAgICAvLyBUZXh0IHJlc3BvbnNlcyAobWludXMgQXNzaXN0YW50VGV4dE1lc3NhZ2UncyByZXR1cm4tbnVsbCBjYXNlcyDigJQgdGllci0xXG4gICAgICAvLyBtaXNzZXMgdW5tZWFzdXJlZCB2aXJ0dWFsIGl0ZW1zKSwgb3IgdG9vbCBjYWxscyB3aXRoIGV4dHJhY3RhYmxlIGlucHV0LlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgKGI/LnR5cGUgPT09ICd0ZXh0JyAmJlxuICAgICAgICAgICFpc0VtcHR5TWVzc2FnZVRleHQoYi50ZXh0KSAmJlxuICAgICAgICAgICFTWU5USEVUSUNfTUVTU0FHRVMuaGFzKGIudGV4dCkpIHx8XG4gICAgICAgIChiPy50eXBlID09PSAndG9vbF91c2UnICYmIGIubmFtZSBpbiBQUklNQVJZX0lOUFVUKVxuICAgICAgKVxuICAgIH1cbiAgICBjYXNlICd1c2VyJzoge1xuICAgICAgaWYgKG1zZy5pc01ldGEgfHwgbXNnLmlzQ29tcGFjdFN1bW1hcnkpIHJldHVybiBmYWxzZVxuICAgICAgY29uc3QgYiA9IG1zZy5tZXNzYWdlLmNvbnRlbnRbMF1cbiAgICAgIGlmIChiPy50eXBlICE9PSAndGV4dCcpIHJldHVybiBmYWxzZVxuICAgICAgLy8gSW50ZXJydXB0IGV0Yy4g4oCUIHN5bnRoZXRpYywgbm90IHVzZXItYXV0aG9yZWQuXG4gICAgICBpZiAoU1lOVEhFVElDX01FU1NBR0VTLmhhcyhiLnRleHQpKSByZXR1cm4gZmFsc2VcbiAgICAgIC8vIFNhbWUgZmlsdGVyIGFzIFZpcnR1YWxNZXNzYWdlTGlzdCBzdGlja3ktcHJvbXB0OiBYTUwtd3JhcHBlZCAoY29tbWFuZFxuICAgICAgLy8gZXhwYW5zaW9ucywgYmFzaC1zdGRvdXQsIGV0Yy4pIGFyZW4ndCByZWFsIHByb21wdHMuXG4gICAgICByZXR1cm4gIXN0cmlwU3lzdGVtUmVtaW5kZXJzKGIudGV4dCkuc3RhcnRzV2l0aCgnPCcpXG4gICAgfVxuICAgIGNhc2UgJ3N5c3RlbSc6XG4gICAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9udXJzZXJ5L3VzZUV4aGF1c3RpdmVTd2l0Y2hDYXNlczogYmxvY2tsaXN0IOKAlCBmYWxsdGhyb3VnaCByZXR1cm4tdHJ1ZSBpcyB0aGUgZGVzaWduXG4gICAgICBzd2l0Y2ggKG1zZy5zdWJ0eXBlKSB7XG4gICAgICAgIGNhc2UgJ2FwaV9tZXRyaWNzJzpcbiAgICAgICAgY2FzZSAnc3RvcF9ob29rX3N1bW1hcnknOlxuICAgICAgICBjYXNlICd0dXJuX2R1cmF0aW9uJzpcbiAgICAgICAgY2FzZSAnbWVtb3J5X3NhdmVkJzpcbiAgICAgICAgY2FzZSAnYWdlbnRzX2tpbGxlZCc6XG4gICAgICAgIGNhc2UgJ2F3YXlfc3VtbWFyeSc6XG4gICAgICAgIGNhc2UgJ3RoaW5raW5nJzpcbiAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgY2FzZSAnZ3JvdXBlZF90b29sX3VzZSc6XG4gICAgY2FzZSAnY29sbGFwc2VkX3JlYWRfc2VhcmNoJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgY2FzZSAnYXR0YWNobWVudCc6XG4gICAgICBzd2l0Y2ggKG1zZy5hdHRhY2htZW50LnR5cGUpIHtcbiAgICAgICAgY2FzZSAncXVldWVkX2NvbW1hbmQnOlxuICAgICAgICBjYXNlICdkaWFnbm9zdGljcyc6XG4gICAgICAgIGNhc2UgJ2hvb2tfYmxvY2tpbmdfZXJyb3InOlxuICAgICAgICBjYXNlICdob29rX2Vycm9yX2R1cmluZ19leGVjdXRpb24nOlxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG50eXBlIFByaW1hcnlJbnB1dCA9IHtcbiAgbGFiZWw6IHN0cmluZ1xuICBleHRyYWN0OiAoaW5wdXQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiBzdHJpbmcgfCB1bmRlZmluZWRcbn1cbmNvbnN0IHN0ciA9IChrOiBzdHJpbmcpID0+IChpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT5cbiAgdHlwZW9mIGlba10gPT09ICdzdHJpbmcnID8gaVtrXSA6IHVuZGVmaW5lZFxuY29uc3QgUFJJTUFSWV9JTlBVVDogUmVjb3JkPHN0cmluZywgUHJpbWFyeUlucHV0PiA9IHtcbiAgUmVhZDogeyBsYWJlbDogJ3BhdGgnLCBleHRyYWN0OiBzdHIoJ2ZpbGVfcGF0aCcpIH0sXG4gIEVkaXQ6IHsgbGFiZWw6ICdwYXRoJywgZXh0cmFjdDogc3RyKCdmaWxlX3BhdGgnKSB9LFxuICBXcml0ZTogeyBsYWJlbDogJ3BhdGgnLCBleHRyYWN0OiBzdHIoJ2ZpbGVfcGF0aCcpIH0sXG4gIE5vdGVib29rRWRpdDogeyBsYWJlbDogJ3BhdGgnLCBleHRyYWN0OiBzdHIoJ25vdGVib29rX3BhdGgnKSB9LFxuICBCYXNoOiB7IGxhYmVsOiAnY29tbWFuZCcsIGV4dHJhY3Q6IHN0cignY29tbWFuZCcpIH0sXG4gIEdyZXA6IHsgbGFiZWw6ICdwYXR0ZXJuJywgZXh0cmFjdDogc3RyKCdwYXR0ZXJuJykgfSxcbiAgR2xvYjogeyBsYWJlbDogJ3BhdHRlcm4nLCBleHRyYWN0OiBzdHIoJ3BhdHRlcm4nKSB9LFxuICBXZWJGZXRjaDogeyBsYWJlbDogJ3VybCcsIGV4dHJhY3Q6IHN0cigndXJsJykgfSxcbiAgV2ViU2VhcmNoOiB7IGxhYmVsOiAncXVlcnknLCBleHRyYWN0OiBzdHIoJ3F1ZXJ5JykgfSxcbiAgVGFzazogeyBsYWJlbDogJ3Byb21wdCcsIGV4dHJhY3Q6IHN0cigncHJvbXB0JykgfSxcbiAgQWdlbnQ6IHsgbGFiZWw6ICdwcm9tcHQnLCBleHRyYWN0OiBzdHIoJ3Byb21wdCcpIH0sXG4gIFRtdXg6IHtcbiAgICBsYWJlbDogJ2NvbW1hbmQnLFxuICAgIGV4dHJhY3Q6IGkgPT5cbiAgICAgIEFycmF5LmlzQXJyYXkoaS5hcmdzKSA/IGB0bXV4ICR7aS5hcmdzLmpvaW4oJyAnKX1gIDogdW5kZWZpbmVkLFxuICB9LFxufVxuXG4vLyBPbmx5IEFnZW50VG9vbCBoYXMgcmVuZGVyR3JvdXBlZFRvb2xVc2Ug4oCUIEVkaXQvQmFzaC9ldGMuIHN0YXkgYXMgYXNzaXN0YW50IHRvb2xfdXNlIGJsb2Nrcy5cbmV4cG9ydCBmdW5jdGlvbiB0b29sQ2FsbE9mKFxuICBtc2c6IE5hdmlnYWJsZU1lc3NhZ2UsXG4pOiB7IG5hbWU6IHN0cmluZzsgaW5wdXQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IH0gfCB1bmRlZmluZWQge1xuICBpZiAobXNnLnR5cGUgPT09ICdhc3Npc3RhbnQnKSB7XG4gICAgY29uc3QgYiA9IG1zZy5tZXNzYWdlLmNvbnRlbnRbMF1cbiAgICBpZiAoYj8udHlwZSA9PT0gJ3Rvb2xfdXNlJylcbiAgICAgIHJldHVybiB7IG5hbWU6IGIubmFtZSwgaW5wdXQ6IGIuaW5wdXQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfVxuICB9XG4gIGlmIChtc2cudHlwZSA9PT0gJ2dyb3VwZWRfdG9vbF91c2UnKSB7XG4gICAgY29uc3QgYiA9IG1zZy5tZXNzYWdlc1swXT8ubWVzc2FnZS5jb250ZW50WzBdXG4gICAgaWYgKGI/LnR5cGUgPT09ICd0b29sX3VzZScpXG4gICAgICByZXR1cm4geyBuYW1lOiBtc2cudG9vbE5hbWUsIGlucHV0OiBiLmlucHV0IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IH1cbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkXG59XG5cbmV4cG9ydCB0eXBlIE1lc3NhZ2VBY3Rpb25DYXBzID0ge1xuICBjb3B5OiAodGV4dDogc3RyaW5nKSA9PiB2b2lkXG4gIGVkaXQ6IChtc2c6IE5vcm1hbGl6ZWRVc2VyTWVzc2FnZSkgPT4gUHJvbWlzZTx2b2lkPlxufVxuXG4vLyBJZGVudGl0eSBidWlsZGVyIOKAlCBwcmVzZXJ2ZXMgdHVwbGUgdHlwZSBzbyBgcnVuYCdzIHBhcmFtIG5hcnJvd3MgKGFycmF5IGxpdGVyYWwgd2lkZW5zIHdpdGhvdXQgdGhpcykuXG5mdW5jdGlvbiBhY3Rpb248Y29uc3QgVCBleHRlbmRzIE5hdmlnYWJsZVR5cGUsIGNvbnN0IEsgZXh0ZW5kcyBzdHJpbmc+KGE6IHtcbiAga2V5OiBLXG4gIGxhYmVsOiBzdHJpbmcgfCAoKHM6IE1lc3NhZ2VBY3Rpb25zU3RhdGUpID0+IHN0cmluZylcbiAgdHlwZXM6IHJlYWRvbmx5IFRbXVxuICBhcHBsaWVzPzogKHM6IE1lc3NhZ2VBY3Rpb25zU3RhdGUpID0+IGJvb2xlYW5cbiAgc3RheXM/OiB0cnVlXG4gIHJ1bjogKG06IE5hdmlnYWJsZU9mPFQ+LCBjYXBzOiBNZXNzYWdlQWN0aW9uQ2FwcykgPT4gdm9pZFxufSkge1xuICByZXR1cm4gYVxufVxuXG5leHBvcnQgY29uc3QgTUVTU0FHRV9BQ1RJT05TID0gW1xuICBhY3Rpb24oe1xuICAgIGtleTogJ2VudGVyJyxcbiAgICBsYWJlbDogcyA9PiAocy5leHBhbmRlZCA/ICdjb2xsYXBzZScgOiAnZXhwYW5kJyksXG4gICAgdHlwZXM6IFtcbiAgICAgICdncm91cGVkX3Rvb2xfdXNlJyxcbiAgICAgICdjb2xsYXBzZWRfcmVhZF9zZWFyY2gnLFxuICAgICAgJ2F0dGFjaG1lbnQnLFxuICAgICAgJ3N5c3RlbScsXG4gICAgXSxcbiAgICBzdGF5czogdHJ1ZSxcbiAgICAvLyBFbXB0eSDigJQgYHN0YXlzYCBoYW5kbGVkIGlubGluZSBieSBkaXNwYXRjaC5cbiAgICBydW46ICgpID0+IHt9LFxuICB9KSxcbiAgYWN0aW9uKHtcbiAgICBrZXk6ICdlbnRlcicsXG4gICAgbGFiZWw6ICdlZGl0JyxcbiAgICB0eXBlczogWyd1c2VyJ10sXG4gICAgcnVuOiAobSwgYykgPT4gdm9pZCBjLmVkaXQobSksXG4gIH0pLFxuICBhY3Rpb24oe1xuICAgIGtleTogJ2MnLFxuICAgIGxhYmVsOiAnY29weScsXG4gICAgdHlwZXM6IE5BVklHQUJMRV9UWVBFUyxcbiAgICBydW46IChtLCBjKSA9PiBjLmNvcHkoY29weVRleHRPZihtKSksXG4gIH0pLFxuICBhY3Rpb24oe1xuICAgIGtleTogJ3AnLFxuICAgIC8vIGAhYCBzYWZlOiBhcHBsaWVzKCkgZ3VhcmFudGVlcyB0b29sTmFtZSDiiIggUFJJTUFSWV9JTlBVVC5cbiAgICBsYWJlbDogcyA9PiBgY29weSAke1BSSU1BUllfSU5QVVRbcy50b29sTmFtZSFdIS5sYWJlbH1gLFxuICAgIHR5cGVzOiBbJ2dyb3VwZWRfdG9vbF91c2UnLCAnYXNzaXN0YW50J10sXG4gICAgYXBwbGllczogcyA9PiBzLnRvb2xOYW1lICE9IG51bGwgJiYgcy50b29sTmFtZSBpbiBQUklNQVJZX0lOUFVULFxuICAgIHJ1bjogKG0sIGMpID0+IHtcbiAgICAgIGNvbnN0IHRjID0gdG9vbENhbGxPZihtKVxuICAgICAgaWYgKCF0YykgcmV0dXJuXG4gICAgICBjb25zdCB2YWwgPSBQUklNQVJZX0lOUFVUW3RjLm5hbWVdPy5leHRyYWN0KHRjLmlucHV0KVxuICAgICAgaWYgKHZhbCkgYy5jb3B5KHZhbClcbiAgICB9LFxuICB9KSxcbl0gYXMgY29uc3RcblxuZnVuY3Rpb24gaXNBcHBsaWNhYmxlKFxuICBhOiAodHlwZW9mIE1FU1NBR0VfQUNUSU9OUylbbnVtYmVyXSxcbiAgYzogTWVzc2FnZUFjdGlvbnNTdGF0ZSxcbik6IGJvb2xlYW4ge1xuICBpZiAoIShhLnR5cGVzIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhjLm1zZ1R5cGUpKSByZXR1cm4gZmFsc2VcbiAgcmV0dXJuICFhLmFwcGxpZXMgfHwgYS5hcHBsaWVzKGMpXG59XG5cbmV4cG9ydCB0eXBlIE1lc3NhZ2VBY3Rpb25zU3RhdGUgPSB7XG4gIHV1aWQ6IHN0cmluZ1xuICBtc2dUeXBlOiBOYXZpZ2FibGVUeXBlXG4gIGV4cGFuZGVkOiBib29sZWFuXG4gIHRvb2xOYW1lPzogc3RyaW5nXG59XG5cbmV4cG9ydCB0eXBlIE1lc3NhZ2VBY3Rpb25zTmF2ID0ge1xuICBlbnRlckN1cnNvcjogKCkgPT4gdm9pZFxuICBuYXZpZ2F0ZVByZXY6ICgpID0+IHZvaWRcbiAgbmF2aWdhdGVOZXh0OiAoKSA9PiB2b2lkXG4gIG5hdmlnYXRlUHJldlVzZXI6ICgpID0+IHZvaWRcbiAgbmF2aWdhdGVOZXh0VXNlcjogKCkgPT4gdm9pZFxuICBuYXZpZ2F0ZVRvcDogKCkgPT4gdm9pZFxuICBuYXZpZ2F0ZUJvdHRvbTogKCkgPT4gdm9pZFxuICBnZXRTZWxlY3RlZDogKCkgPT4gTmF2aWdhYmxlTWVzc2FnZSB8IG51bGxcbn1cblxuZXhwb3J0IGNvbnN0IE1lc3NhZ2VBY3Rpb25zU2VsZWN0ZWRDb250ZXh0ID0gUmVhY3QuY3JlYXRlQ29udGV4dChmYWxzZSlcbmV4cG9ydCBjb25zdCBJblZpcnR1YWxMaXN0Q29udGV4dCA9IFJlYWN0LmNyZWF0ZUNvbnRleHQoZmFsc2UpXG5cbi8vIGJnIG11c3QgZ28gb24gdGhlIEJveCB0aGF0IEhBUyBtYXJnaW5Ub3AgKG1hcmdpbiBzdGF5cyBvdXRzaWRlIHBhaW50KSDigJQgdGhhdCdzIGluc2lkZSBlYWNoIGNvbnN1bWVyLlxuZXhwb3J0IGZ1bmN0aW9uIHVzZVNlbGVjdGVkTWVzc2FnZUJnKCk6ICdtZXNzYWdlQWN0aW9uc0JhY2tncm91bmQnIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIFJlYWN0LnVzZUNvbnRleHQoTWVzc2FnZUFjdGlvbnNTZWxlY3RlZENvbnRleHQpXG4gICAgPyAnbWVzc2FnZUFjdGlvbnNCYWNrZ3JvdW5kJ1xuICAgIDogdW5kZWZpbmVkXG59XG5cbi8vIENhbid0IGNhbGwgdXNlS2V5YmluZGluZ3MgaGVyZSDigJQgaG9vayBydW5zIG91dHNpZGUgPEtleWJpbmRpbmdTZXR1cD4gcHJvdmlkZXIuIFJldHVybnMgaGFuZGxlcnMgaW5zdGVhZC5cbmV4cG9ydCBmdW5jdGlvbiB1c2VNZXNzYWdlQWN0aW9ucyhcbiAgY3Vyc29yOiBNZXNzYWdlQWN0aW9uc1N0YXRlIHwgbnVsbCxcbiAgc2V0Q3Vyc29yOiBSZWFjdC5EaXNwYXRjaDxSZWFjdC5TZXRTdGF0ZUFjdGlvbjxNZXNzYWdlQWN0aW9uc1N0YXRlIHwgbnVsbD4+LFxuICBuYXZSZWY6IFJlZk9iamVjdDxNZXNzYWdlQWN0aW9uc05hdiB8IG51bGw+LFxuICBjYXBzOiBNZXNzYWdlQWN0aW9uQ2Fwcyxcbik6IHtcbiAgZW50ZXI6ICgpID0+IHZvaWRcbiAgaGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsICgpID0+IHZvaWQ+XG59IHtcbiAgLy8gUmVmcyBrZWVwIGhhbmRsZXJzIHN0YWJsZSDigJQgbm8gdXNlS2V5YmluZGluZ3MgcmUtcmVnaXN0ZXIgcGVyIG1lc3NhZ2UgYXBwZW5kLlxuICBjb25zdCBjdXJzb3JSZWYgPSB1c2VSZWYoY3Vyc29yKVxuICBjdXJzb3JSZWYuY3VycmVudCA9IGN1cnNvclxuICBjb25zdCBjYXBzUmVmID0gdXNlUmVmKGNhcHMpXG4gIGNhcHNSZWYuY3VycmVudCA9IGNhcHNcblxuICBjb25zdCBoYW5kbGVycyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGg6IFJlY29yZDxzdHJpbmcsICgpID0+IHZvaWQ+ID0ge1xuICAgICAgJ21lc3NhZ2VBY3Rpb25zOnByZXYnOiAoKSA9PiBuYXZSZWYuY3VycmVudD8ubmF2aWdhdGVQcmV2KCksXG4gICAgICAnbWVzc2FnZUFjdGlvbnM6bmV4dCc6ICgpID0+IG5hdlJlZi5jdXJyZW50Py5uYXZpZ2F0ZU5leHQoKSxcbiAgICAgICdtZXNzYWdlQWN0aW9uczpwcmV2VXNlcic6ICgpID0+IG5hdlJlZi5jdXJyZW50Py5uYXZpZ2F0ZVByZXZVc2VyKCksXG4gICAgICAnbWVzc2FnZUFjdGlvbnM6bmV4dFVzZXInOiAoKSA9PiBuYXZSZWYuY3VycmVudD8ubmF2aWdhdGVOZXh0VXNlcigpLFxuICAgICAgJ21lc3NhZ2VBY3Rpb25zOnRvcCc6ICgpID0+IG5hdlJlZi5jdXJyZW50Py5uYXZpZ2F0ZVRvcCgpLFxuICAgICAgJ21lc3NhZ2VBY3Rpb25zOmJvdHRvbSc6ICgpID0+IG5hdlJlZi5jdXJyZW50Py5uYXZpZ2F0ZUJvdHRvbSgpLFxuICAgICAgJ21lc3NhZ2VBY3Rpb25zOmVzY2FwZSc6ICgpID0+XG4gICAgICAgIHNldEN1cnNvcihjID0+IChjPy5leHBhbmRlZCA/IHsgLi4uYywgZXhwYW5kZWQ6IGZhbHNlIH0gOiBudWxsKSksXG4gICAgICAvLyBjdHJsK2Mgc2tpcHMgdGhlIGNvbGxhcHNlIHN0ZXAg4oCUIGZyb20gZXhwYW5kZWQtZHVyaW5nLXN0cmVhbWluZywgdHdvLXN0YWdlXG4gICAgICAvLyB3b3VsZCBtZWFuIDMgcHJlc3NlcyB0byBpbnRlcnJ1cHQgKGNvbGxhcHNl4oaSbnVsbOKGkmNhbmNlbCkuXG4gICAgICAnbWVzc2FnZUFjdGlvbnM6Y3RybGMnOiAoKSA9PiBzZXRDdXJzb3IobnVsbCksXG4gICAgfVxuICAgIGZvciAoY29uc3Qga2V5IG9mIG5ldyBTZXQoTUVTU0FHRV9BQ1RJT05TLm1hcChhID0+IGEua2V5KSkpIHtcbiAgICAgIGhbYG1lc3NhZ2VBY3Rpb25zOiR7a2V5fWBdID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBjID0gY3Vyc29yUmVmLmN1cnJlbnRcbiAgICAgICAgaWYgKCFjKSByZXR1cm5cbiAgICAgICAgY29uc3QgYSA9IE1FU1NBR0VfQUNUSU9OUy5maW5kKGEgPT4gYS5rZXkgPT09IGtleSAmJiBpc0FwcGxpY2FibGUoYSwgYykpXG4gICAgICAgIGlmICghYSkgcmV0dXJuXG4gICAgICAgIGlmIChhLnN0YXlzKSB7XG4gICAgICAgICAgc2V0Q3Vyc29yKGMgPT4gKGMgPyB7IC4uLmMsIGV4cGFuZGVkOiAhYy5leHBhbmRlZCB9IDogbnVsbCkpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbSA9IG5hdlJlZi5jdXJyZW50Py5nZXRTZWxlY3RlZCgpXG4gICAgICAgIGlmICghbSkgcmV0dXJuXG4gICAgICAgIDsoYS5ydW4gYXMgKG06IE5hdmlnYWJsZU1lc3NhZ2UsIGM6IE1lc3NhZ2VBY3Rpb25DYXBzKSA9PiB2b2lkKShcbiAgICAgICAgICBtLFxuICAgICAgICAgIGNhcHNSZWYuY3VycmVudCxcbiAgICAgICAgKVxuICAgICAgICBzZXRDdXJzb3IobnVsbClcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGhcbiAgfSwgW3NldEN1cnNvciwgbmF2UmVmXSlcblxuICBjb25zdCBlbnRlciA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBsb2dFdmVudCgndGVuZ3VfbWVzc2FnZV9hY3Rpb25zX2VudGVyJywge30pXG4gICAgbmF2UmVmLmN1cnJlbnQ/LmVudGVyQ3Vyc29yKClcbiAgfSwgW25hdlJlZl0pXG5cbiAgcmV0dXJuIHsgZW50ZXIsIGhhbmRsZXJzIH1cbn1cblxuLy8gTXVzdCBtb3VudCBpbnNpZGUgPEtleWJpbmRpbmdTZXR1cD4uXG5leHBvcnQgZnVuY3Rpb24gTWVzc2FnZUFjdGlvbnNLZXliaW5kaW5ncyh7XG4gIGhhbmRsZXJzLFxuICBpc0FjdGl2ZSxcbn06IHtcbiAgaGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsICgpID0+IHZvaWQ+XG4gIGlzQWN0aXZlOiBib29sZWFuXG59KTogbnVsbCB7XG4gIHVzZUtleWJpbmRpbmdzKGhhbmRsZXJzLCB7IGNvbnRleHQ6ICdNZXNzYWdlQWN0aW9ucycsIGlzQWN0aXZlIH0pXG4gIHJldHVybiBudWxsXG59XG5cbi8vIGJvcmRlclRvcC1vbmx5IEJveCBtYXRjaGVzIFByb21wdElucHV0J3Mg4pSA4pSA4pSAIGxpbmUgZm9yIHN0YWJsZSBmb290ZXIgaGVpZ2h0LlxuZXhwb3J0IGZ1bmN0aW9uIE1lc3NhZ2VBY3Rpb25zQmFyKHtcbiAgY3Vyc29yLFxufToge1xuICBjdXJzb3I6IE1lc3NhZ2VBY3Rpb25zU3RhdGVcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBhcHBsaWNhYmxlID0gTUVTU0FHRV9BQ1RJT05TLmZpbHRlcihhID0+IGlzQXBwbGljYWJsZShhLCBjdXJzb3IpKVxuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGZsZXhTaHJpbms9ezB9IHBhZGRpbmdZPXsxfT5cbiAgICAgIDxCb3hcbiAgICAgICAgYm9yZGVyU3R5bGU9XCJzaW5nbGVcIlxuICAgICAgICBib3JkZXJUb3BcbiAgICAgICAgYm9yZGVyQm90dG9tPXtmYWxzZX1cbiAgICAgICAgYm9yZGVyTGVmdD17ZmFsc2V9XG4gICAgICAgIGJvcmRlclJpZ2h0PXtmYWxzZX1cbiAgICAgICAgYm9yZGVyRGltQ29sb3JcbiAgICAgIC8+XG4gICAgICA8Qm94IHBhZGRpbmdYPXsyfSBwYWRkaW5nWT17MX0+XG4gICAgICAgIHthcHBsaWNhYmxlLm1hcCgoYSwgaSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGxhYmVsID1cbiAgICAgICAgICAgIHR5cGVvZiBhLmxhYmVsID09PSAnZnVuY3Rpb24nID8gYS5sYWJlbChjdXJzb3IpIDogYS5sYWJlbFxuICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8UmVhY3QuRnJhZ21lbnQga2V5PXthLmtleX0+XG4gICAgICAgICAgICAgIHtpID4gMCAmJiA8VGV4dCBkaW1Db2xvcj4gwrcgPC9UZXh0Pn1cbiAgICAgICAgICAgICAgey8qIGRpbUNvbG9yPXtmYWxzZX0gZm9yY2VzIFNHUiAyMiDigJQgYm9yZGVyRGltQ29sb3Igc2libGluZyBibGVlZHMgZGltIGludG8gZmlyc3QgY2VsbCAqL31cbiAgICAgICAgICAgICAgPFRleHQgYm9sZCBkaW1Db2xvcj17ZmFsc2V9PlxuICAgICAgICAgICAgICAgIHthLmtleX1cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj4ge2xhYmVsfTwvVGV4dD5cbiAgICAgICAgICAgIDwvUmVhY3QuRnJhZ21lbnQ+XG4gICAgICAgICAgKVxuICAgICAgICB9KX1cbiAgICAgICAgPFRleHQgZGltQ29sb3I+IMK3IDwvVGV4dD5cbiAgICAgICAgPFRleHQgYm9sZCBkaW1Db2xvcj17ZmFsc2V9PlxuICAgICAgICAgIHtmaWd1cmVzLmFycm93VXB9XG4gICAgICAgICAge2ZpZ3VyZXMuYXJyb3dEb3dufVxuICAgICAgICA8L1RleHQ+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPiBuYXZpZ2F0ZSDCtyA8L1RleHQ+XG4gICAgICAgIDxUZXh0IGJvbGQgZGltQ29sb3I9e2ZhbHNlfT5cbiAgICAgICAgICBlc2NcbiAgICAgICAgPC9UZXh0PlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj4gYmFjazwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIDwvQm94PlxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpcFN5c3RlbVJlbWluZGVycyh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBDTE9TRSA9ICc8L3N5c3RlbS1yZW1pbmRlcj4nXG4gIGxldCB0ID0gdGV4dC50cmltU3RhcnQoKVxuICB3aGlsZSAodC5zdGFydHNXaXRoKCc8c3lzdGVtLXJlbWluZGVyPicpKSB7XG4gICAgY29uc3QgZW5kID0gdC5pbmRleE9mKENMT1NFKVxuICAgIGlmIChlbmQgPCAwKSBicmVha1xuICAgIHQgPSB0LnNsaWNlKGVuZCArIENMT1NFLmxlbmd0aCkudHJpbVN0YXJ0KClcbiAgfVxuICByZXR1cm4gdFxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29weVRleHRPZihtc2c6IE5hdmlnYWJsZU1lc3NhZ2UpOiBzdHJpbmcge1xuICBzd2l0Y2ggKG1zZy50eXBlKSB7XG4gICAgY2FzZSAndXNlcic6IHtcbiAgICAgIGNvbnN0IGIgPSBtc2cubWVzc2FnZS5jb250ZW50WzBdXG4gICAgICByZXR1cm4gYj8udHlwZSA9PT0gJ3RleHQnID8gc3RyaXBTeXN0ZW1SZW1pbmRlcnMoYi50ZXh0KSA6ICcnXG4gICAgfVxuICAgIGNhc2UgJ2Fzc2lzdGFudCc6IHtcbiAgICAgIGNvbnN0IGIgPSBtc2cubWVzc2FnZS5jb250ZW50WzBdXG4gICAgICBpZiAoYj8udHlwZSA9PT0gJ3RleHQnKSByZXR1cm4gYi50ZXh0XG4gICAgICBjb25zdCB0YyA9IHRvb2xDYWxsT2YobXNnKVxuICAgICAgcmV0dXJuIHRjID8gKFBSSU1BUllfSU5QVVRbdGMubmFtZV0/LmV4dHJhY3QodGMuaW5wdXQpID8/ICcnKSA6ICcnXG4gICAgfVxuICAgIGNhc2UgJ2dyb3VwZWRfdG9vbF91c2UnOlxuICAgICAgcmV0dXJuIG1zZy5yZXN1bHRzLm1hcCh0b29sUmVzdWx0VGV4dCkuZmlsdGVyKEJvb2xlYW4pLmpvaW4oJ1xcblxcbicpXG4gICAgY2FzZSAnY29sbGFwc2VkX3JlYWRfc2VhcmNoJzpcbiAgICAgIHJldHVybiBtc2cubWVzc2FnZXNcbiAgICAgICAgLmZsYXRNYXAobSA9PlxuICAgICAgICAgIG0udHlwZSA9PT0gJ3VzZXInXG4gICAgICAgICAgICA/IFt0b29sUmVzdWx0VGV4dChtKV1cbiAgICAgICAgICAgIDogbS50eXBlID09PSAnZ3JvdXBlZF90b29sX3VzZSdcbiAgICAgICAgICAgICAgPyBtLnJlc3VsdHMubWFwKHRvb2xSZXN1bHRUZXh0KVxuICAgICAgICAgICAgICA6IFtdLFxuICAgICAgICApXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAgICAgLmpvaW4oJ1xcblxcbicpXG4gICAgY2FzZSAnc3lzdGVtJzpcbiAgICAgIGlmICgnY29udGVudCcgaW4gbXNnKSByZXR1cm4gbXNnLmNvbnRlbnRcbiAgICAgIGlmICgnZXJyb3InIGluIG1zZykgcmV0dXJuIFN0cmluZyhtc2cuZXJyb3IpXG4gICAgICByZXR1cm4gbXNnLnN1YnR5cGVcbiAgICBjYXNlICdhdHRhY2htZW50Jzoge1xuICAgICAgY29uc3QgYSA9IG1zZy5hdHRhY2htZW50XG4gICAgICBpZiAoYS50eXBlID09PSAncXVldWVkX2NvbW1hbmQnKSB7XG4gICAgICAgIGNvbnN0IHAgPSBhLnByb21wdFxuICAgICAgICByZXR1cm4gdHlwZW9mIHAgPT09ICdzdHJpbmcnXG4gICAgICAgICAgPyBwXG4gICAgICAgICAgOiBwLmZsYXRNYXAoYiA9PiAoYi50eXBlID09PSAndGV4dCcgPyBbYi50ZXh0XSA6IFtdKSkuam9pbignXFxuJylcbiAgICAgIH1cbiAgICAgIHJldHVybiBgWyR7YS50eXBlfV1gXG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHRvb2xSZXN1bHRUZXh0KHI6IE5vcm1hbGl6ZWRVc2VyTWVzc2FnZSk6IHN0cmluZyB7XG4gIGNvbnN0IGIgPSByLm1lc3NhZ2UuY29udGVudFswXVxuICBpZiAoYj8udHlwZSAhPT0gJ3Rvb2xfcmVzdWx0JykgcmV0dXJuICcnXG4gIGNvbnN0IGMgPSBiLmNvbnRlbnRcbiAgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJykgcmV0dXJuIGNcbiAgaWYgKCFjKSByZXR1cm4gJydcbiAgcmV0dXJuIGMuZmxhdE1hcCh4ID0+ICh4LnR5cGUgPT09ICd0ZXh0JyA/IFt4LnRleHRdIDogW10pKS5qb2luKCdcXG4nKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsT0FBT0EsT0FBTyxNQUFNLFNBQVM7QUFDN0IsY0FBY0MsU0FBUyxRQUFRLE9BQU87QUFDdEMsT0FBT0MsS0FBSyxJQUFJQyxXQUFXLEVBQUVDLE9BQU8sRUFBRUMsTUFBTSxRQUFRLE9BQU87QUFDM0QsU0FBU0MsR0FBRyxFQUFFQyxJQUFJLFFBQVEsV0FBVztBQUNyQyxTQUFTQyxjQUFjLFFBQVEsaUNBQWlDO0FBQ2hFLFNBQVNDLFFBQVEsUUFBUSxnQ0FBZ0M7QUFDekQsY0FDRUMscUJB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