import { feature } from 'bun:bundle'
import { satisfies } from 'src/utils/semver.js'
import { isRunningWithBun } from '../utils/bundledMode.js'
import { getPlatform } from '../utils/platform.js'
import type { KeybindingBlock } from './types.js'

/**
 * Default keybindings that match current Claude Code behavior.
 * These are loaded first, then user keybindings.json overrides them.
 */

// Platform-specific image paste shortcut:
// - Windows: alt+v (ctrl+v is system paste)
// - Other platforms: ctrl+v
const IMAGE_PASTE_KEY = getPlatform() === 'windows' ? 'alt+v' : 'ctrl+v'

// Modifier-only chords (like shift+tab) may fail on Windows Terminal without VT mode
// See: https://github.com/microsoft/terminal/issues/879#issuecomment-618801651
// Node enabled VT mode in 24.2.0 / 22.17.0: https://github.com/nodejs/node/pull/58358
// Bun enabled VT mode in 1.2.23: https://github.com/oven-sh/bun/pull/21161
const SUPPORTS_TERMINAL_VT_MODE =
  getPlatform() !== 'windows' ||
  (isRunningWithBun()
    ? satisfies(process.versions.bun, '>=1.2.23')
    : satisfies(process.versions.node, '>=22.17.0 <23.0.0 || >=24.2.0'))

// Platform-specific mode cycle shortcut:
// - Windows without VT mode: meta+m (shift+tab doesn't work reliably)
// - Other platforms: shift+tab
const MODE_CYCLE_KEY = SUPPORTS_TERMINAL_VT_MODE ? 'shift+tab' : 'meta+m'

export const DEFAULT_BINDINGS: KeybindingBlock[] = [
  {
    context: 'Global',
    bindings: {
      // ctrl+c and ctrl+d use special time-based double-press handling.
      // They ARE defined here so the resolver can find them, but they
      // CANNOT be rebound by users - validation in reservedShortcuts.ts
      // will show an error if users try to override these keys.
      'ctrl+c': 'app:interrupt',
      'ctrl+d': 'app:exit',
      'ctrl+l': 'app:redraw',
      'ctrl+t': 'app:toggleTodos',
      'ctrl+o': 'app:toggleTranscript',
      ...(feature('KAIROS') || feature('KAIROS_BRIEF')
        ? { 'ctrl+shift+b': 'app:toggleBrief' as const }
        : {}),
      'ctrl+shift+o': 'app:toggleTeammatePreview',
      'ctrl+r': 'history:search',
      // File navigation. cmd+ bindings only fire on kitty-protocol terminals;
      // ctrl+shift is the portable fallback.
      ...(feature('QUICK_SEARCH')
        ? {
            'ctrl+shift+f': 'app:globalSearch' as const,
            'cmd+shift+f': 'app:globalSearch' as const,
            'ctrl+shift+p': 'app:quickOpen' as const,
            'cmd+shift+p': 'app:quickOpen' as const,
          }
        : {}),
      ...(feature('TERMINAL_PANEL') ? { 'meta+j': 'app:toggleTerminal' } : {}),
    },
  },
  {
    context: 'Chat',
    bindings: {
      escape: 'chat:cancel',
      // ctrl+x chord prefix avoids shadowing readline editing keys (ctrl+a/b/e/f/...).
      'ctrl+x ctrl+k': 'chat:killAgents',
      [MODE_CYCLE_KEY]: 'chat:cycleMode',
      'meta+p': 'chat:modelPicker',
      'meta+o': 'chat:fastMode',
      'meta+t': 'chat:thinkingToggle',
      enter: 'chat:submit',
      up: 'history:previous',
      down: 'history:next',
      // Editing shortcuts (defined here, migration in progress)
      // Undo has two bindings to support different terminal behaviors:
      // - ctrl+_ for legacy terminals (send \x1f control char)
      // - ctrl+shift+- for Kitty protocol (sends physical key with modifiers)
      'ctrl+_': 'chat:undo',
      'ctrl+shift+-': 'chat:undo',
      // ctrl+x ctrl+e is the readline-native edit-and-execute-command binding.
      'ctrl+x ctrl+e': 'chat:externalEditor',
      'ctrl+g': 'chat:externalEditor',
      'ctrl+s': 'chat:stash',
      // Image paste shortcut (platform-specific key defined above)
      [IMAGE_PASTE_KEY]: 'chat:imagePaste',
      ...(feature('MESSAGE_ACTIONS')
        ? { 'shift+up': 'chat:messageActions' as const }
        : {}),
      // Voice activation (hold-to-talk). Registered so getShortcutDisplay
      // finds it without hitting the fallback analytics log. To rebind,
      // add a voice:pushToTalk entry (last wins); to disable, use /voice
      // — null-unbinding space hits a pre-existing useKeybinding.ts trap
      // where 'unbound' swallows the event (space dead for typing).
      ...(feature('VOICE_MODE') ? { space: 'voice:pushToTalk' } : {}),
    },
  },
  {
    context: 'Autocomplete',
    bindings: {
      tab: 'autocomplete:accept',
      escape: 'autocomplete:dismiss',
      up: 'autocomplete:previous',
      down: 'autocomplete:next',
    },
  },
  {
    context: 'Settings',
    bindings: {
      // Settings menu uses escape only (not 'n') to dismiss
      escape: 'confirm:no',
      // Config panel list navigation (reuses Select actions)
      up: 'select:previous',
      down: 'select:next',
      k: 'select:previous',
      j: 'select:next',
      'ctrl+p': 'select:previous',
      'ctrl+n': 'select:next',
      // Toggle/activate the selected setting (space only — enter saves & closes)
      space: 'select:accept',
      // Save and close the config panel
      enter: 'settings:close',
      // Enter search mode
      '/': 'settings:search',
      // Retry loading usage data (only active on error)
      r: 'settings:retry',
    },
  },
  {
    context: 'Confirmation',
    bindings: {
      y: 'confirm:yes',
      n: 'confirm:no',
      enter: 'confirm:yes',
      escape: 'confirm:no',
      // Navigation for dialogs with lists
      up: 'confirm:previous',
      down: 'confirm:next',
      tab: 'confirm:nextField',
      space: 'confirm:toggle',
      // Cycle modes (used in file permission dialogs and teams dialog)
      'shift+tab': 'confirm:cycleMode',
      // Toggle permission explanation in permission dialogs
      'ctrl+e': 'confirm:toggleExplanation',
      // Toggle permission debug info
      'ctrl+d': 'permission:toggleDebug',
    },
  },
  {
    context: 'Tabs',
    bindings: {
      // Tab cycling navigation
      tab: 'tabs:next',
      'shift+tab': 'tabs:previous',
      right: 'tabs:next',
      left: 'tabs:previous',
    },
  },
  {
    context: 'Transcript',
    bindings: {
      'ctrl+e': 'transcript:toggleShowAll',
      'ctrl+c': 'transcript:exit',
      escape: 'transcript:exit',
      // q — pager convention (less, tmux copy-mode). Transcript is a modal
      // reading view with no prompt, so q-as-literal-char has no owner.
      q: 'transcript:exit',
    },
  },
  {
    context: 'HistorySearch',
    bindings: {
      'ctrl+r': 'historySearch:next',
      escape: 'historySearch:accept',
      tab: 'historySearch:accept',
      'ctrl+c': 'historySearch:cancel',
      enter: 'historySearch:execute',
    },
  },
  {
    context: 'Task',
    bindings: {
      // Background running foreground tasks (bash commands, agents)
      // In tmux, users must press ctrl+b twice (tmux prefix escape)
      'ctrl+b': 'task:background',
    },
  },
  {
    context: 'ThemePicker',
    bindings: {
      'ctrl+t': 'theme:toggleSyntaxHighlighting',
    },
  },
  {
    context: 'Scroll',
    bindings: {
      pageup: 'scroll:pageUp',
      pagedown: 'scroll:pageDown',
      wheelup: 'scroll:lineUp',
      wheeldown: 'scroll:lineDown',
      'ctrl+home': 'scroll:top',
      'ctrl+end': 'scroll:bottom',
      // Selection copy. ctrl+shift+c is standard terminal copy.
      // cmd+c only fires on terminals using the kitty keyboard
      // protocol (kitty/WezTerm/ghostty/iTerm2) where the super
      // modifier actually reaches the pty — inert elsewhere.
      // Esc-to-clear and contextual ctrl+c are handled via raw
      // useInput so they can conditionally propagate.
      'ctrl+shift+c': 'selection:copy',
      'cmd+c': 'selection:copy',
    },
  },
  {
    context: 'Help',
    bindings: {
      escape: 'help:dismiss',
    },
  },
  // Attachment navigation (select dialog image attachments)
  {
    context: 'Attachments',
    bindings: {
      right: 'attachments:next',
      left: 'attachments:previous',
      backspace: 'attachments:remove',
      delete: 'attachments:remove',
      down: 'attachments:exit',
      escape: 'attachments:exit',
    },
  },
  // Footer indicator navigation (tasks, teams, diff, loop)
  {
    context: 'Footer',
    bindings: {
      up: 'footer:up',
      'ctrl+p': 'footer:up',
      down: 'footer:down',
      'ctrl+n': 'footer:down',
      right: 'footer:next',
      left: 'footer:previous',
      enter: 'footer:openSelected',
      escape: 'footer:clearSelection',
    },
  },
  // Message selector (rewind dialog) navigation
  {
    context: 'MessageSelector',
    bindings: {
      up: 'messageSelector:up',
      down: 'messageSelector:down',
      k: 'messageSelector:up',
      j: 'messageSelector:down',
      'ctrl+p': 'messageSelector:up',
      'ctrl+n': 'messageSelector:down',
      'ctrl+up': 'messageSelector:top',
      'shift+up': 'messageSelector:top',
      'meta+up': 'messageSelector:top',
      'shift+k': 'messageSelector:top',
      'ctrl+down': 'messageSelector:bottom',
      'shift+down': 'messageSelector:bottom',
      'meta+down': 'messageSelector:bottom',
      'shift+j': 'messageSelector:bottom',
      enter: 'messageSelector:select',
    },
  },
  // PromptInput unmounts while cursor active — no key conflict.
  ...(feature('MESSAGE_ACTIONS')
    ? [
        {
          context: 'MessageActions' as const,
          bindings: {
            up: 'messageActions:prev' as const,
            down: 'messageActions:next' as const,
            k: 'messageActions:prev' as const,
            j: 'messageActions:next' as const,
            // meta = cmd on macOS; super for kitty keyboard-protocol — bind both.
            'meta+up': 'messageActions:top' as const,
            'meta+down': 'messageActions:bottom' as const,
            'super+up': 'messageActions:top' as const,
            'super+down': 'messageActions:bottom' as const,
            // Mouse selection extends on shift+arrow (ScrollKeybindingHandler:573) when present —
            // correct layered UX: esc clears selection, then shift+↑ jumps.
            'shift+up': 'messageActions:prevUser' as const,
            'shift+down': 'messageActions:nextUser' as const,
            escape: 'messageActions:escape' as const,
            'ctrl+c': 'messageActions:ctrlc' as const,
            // Mirror MESSAGE_ACTIONS. Not imported — would pull React/ink into this config module.
            enter: 'messageActions:enter' as const,
            c: 'messageActions:c' as const,
            p: 'messageActions:p' as const,
          },
        },
      ]
    : []),
  // Diff dialog navigation
  {
    context: 'DiffDialog',
    bindings: {
      escape: 'diff:dismiss',
      left: 'diff:previousSource',
      right: 'diff:nextSource',
      up: 'diff:previousFile',
      down: 'diff:nextFile',
      enter: 'diff:viewDetails',
      // Note: diff:back is handled by left arrow in detail mode
    },
  },
  // Model picker effort cycling (ant-only)
  {
    context: 'ModelPicker',
    bindings: {
      left: 'modelPicker:decreaseEffort',
      right: 'modelPicker:increaseEffort',
    },
  },
  // Select component navigation (used by /model, /resume, permission prompts, etc.)
  {
    context: 'Select',
    bindings: {
      up: 'select:previous',
      down: 'select:next',
      j: 'select:next',
      k: 'select:previous',
      'ctrl+n': 'select:next',
      'ctrl+p': 'select:previous',
      enter: 'select:accept',
      escape: 'select:cancel',
    },
  },
  // Plugin dialog actions (manage, browse, discover plugins)
  // Navigation (select:*) uses the Select context above
  {
    context: 'Plugin',
    bindings: {
      space: 'plugin:toggle',
      i: 'plugin:install',
    },
  },
]
