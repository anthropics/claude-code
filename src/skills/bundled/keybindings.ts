import { DEFAULT_BINDINGS } from '../../keybindings/defaultBindings.js'
import { isKeybindingCustomizationEnabled } from '../../keybindings/loadUserBindings.js'
import {
  MACOS_RESERVED,
  NON_REBINDABLE,
  TERMINAL_RESERVED,
} from '../../keybindings/reservedShortcuts.js'
import type { KeybindingsSchemaType } from '../../keybindings/schema.js'
import {
  KEYBINDING_ACTIONS,
  KEYBINDING_CONTEXT_DESCRIPTIONS,
  KEYBINDING_CONTEXTS,
} from '../../keybindings/schema.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { registerBundledSkill } from '../bundledSkills.js'

/**
 * Build a markdown table of all contexts.
 */
function generateContextsTable(): string {
  return markdownTable(
    ['Context', 'Description'],
    KEYBINDING_CONTEXTS.map(ctx => [
      `\`${ctx}\``,
      KEYBINDING_CONTEXT_DESCRIPTIONS[ctx],
    ]),
  )
}

/**
 * Build a markdown table of all actions with their default bindings and context.
 */
function generateActionsTable(): string {
  // Build a lookup: action -> { keys, context }
  const actionInfo: Record<string, { keys: string[]; context: string }> = {}
  for (const block of DEFAULT_BINDINGS) {
    for (const [key, action] of Object.entries(block.bindings)) {
      if (action) {
        if (!actionInfo[action]) {
          actionInfo[action] = { keys: [], context: block.context }
        }
        actionInfo[action].keys.push(key)
      }
    }
  }

  return markdownTable(
    ['Action', 'Default Key(s)', 'Context'],
    KEYBINDING_ACTIONS.map(action => {
      const info = actionInfo[action]
      const keys = info ? info.keys.map(k => `\`${k}\``).join(', ') : '(none)'
      const context = info ? info.context : inferContextFromAction(action)
      return [`\`${action}\``, keys, context]
    }),
  )
}

/**
 * Infer context from action prefix when not in DEFAULT_BINDINGS.
 */
function inferContextFromAction(action: string): string {
  const prefix = action.split(':')[0]
  const prefixToContext: Record<string, string> = {
    app: 'Global',
    history: 'Global or Chat',
    chat: 'Chat',
    autocomplete: 'Autocomplete',
    confirm: 'Confirmation',
    tabs: 'Tabs',
    transcript: 'Transcript',
    historySearch: 'HistorySearch',
    task: 'Task',
    theme: 'ThemePicker',
    help: 'Help',
    attachments: 'Attachments',
    footer: 'Footer',
    messageSelector: 'MessageSelector',
    diff: 'DiffDialog',
    modelPicker: 'ModelPicker',
    select: 'Select',
    permission: 'Confirmation',
  }
  return prefixToContext[prefix ?? ''] ?? 'Unknown'
}

/**
 * Build a list of reserved shortcuts.
 */
function generateReservedShortcuts(): string {
  const lines: string[] = []

  lines.push('### Non-rebindable (errors)')
  for (const s of NON_REBINDABLE) {
    lines.push(`- \`${s.key}\` — ${s.reason}`)
  }

  lines.push('')
  lines.push('### Terminal reserved (errors/warnings)')
  for (const s of TERMINAL_RESERVED) {
    lines.push(
      `- \`${s.key}\` — ${s.reason} (${s.severity === 'error' ? 'will not work' : 'may conflict'})`,
    )
  }

  lines.push('')
  lines.push('### macOS reserved (errors)')
  for (const s of MACOS_RESERVED) {
    lines.push(`- \`${s.key}\` — ${s.reason}`)
  }

  return lines.join('\n')
}

const FILE_FORMAT_EXAMPLE: KeybindingsSchemaType = {
  $schema: 'https://www.schemastore.org/claude-code-keybindings.json',
  $docs: 'https://code.claude.com/docs/en/keybindings',
  bindings: [
    {
      context: 'Chat',
      bindings: {
        'ctrl+e': 'chat:externalEditor',
      },
    },
  ],
}

const UNBIND_EXAMPLE: KeybindingsSchemaType['bindings'][number] = {
  context: 'Chat',
  bindings: {
    'ctrl+s': null,
  },
}

const REBIND_EXAMPLE: KeybindingsSchemaType['bindings'][number] = {
  context: 'Chat',
  bindings: {
    'ctrl+g': null,
    'ctrl+e': 'chat:externalEditor',
  },
}

const CHORD_EXAMPLE: KeybindingsSchemaType['bindings'][number] = {
  context: 'Global',
  bindings: {
    'ctrl+k ctrl+t': 'app:toggleTodos',
  },
}

const SECTION_INTRO = [
  '# Keybindings Skill',
  '',
  'Create or modify `~/.claude/keybindings.json` to customize keyboard shortcuts.',
  '',
  '## CRITICAL: Read Before Write',
  '',
  '**Always read `~/.claude/keybindings.json` first** (it may not exist yet). Merge changes with existing bindings — never replace the entire file.',
  '',
  '- Use **Edit** tool for modifications to existing files',
  '- Use **Write** tool only if the file does not exist yet',
].join('\n')

const SECTION_FILE_FORMAT = [
  '## File Format',
  '',
  '```json',
  jsonStringify(FILE_FORMAT_EXAMPLE, null, 2),
  '```',
  '',
  'Always include the `$schema` and `$docs` fields.',
].join('\n')

const SECTION_KEYSTROKE_SYNTAX = [
  '## Keystroke Syntax',
  '',
  '**Modifiers** (combine with `+`):',
  '- `ctrl` (alias: `control`)',
  '- `alt` (aliases: `opt`, `option`) — note: `alt` and `meta` are identical in terminals',
  '- `shift`',
  '- `meta` (aliases: `cmd`, `command`)',
  '',
  '**Special keys**: `escape`/`esc`, `enter`/`return`, `tab`, `space`, `backspace`, `delete`, `up`, `down`, `left`, `right`',
  '',
  '**Chords**: Space-separated keystrokes, e.g. `ctrl+k ctrl+s` (1-second timeout between keystrokes)',
  '',
  '**Examples**: `ctrl+shift+p`, `alt+enter`, `ctrl+k ctrl+n`',
].join('\n')

const SECTION_UNBINDING = [
  '## Unbinding Default Shortcuts',
  '',
  'Set a key to `null` to remove its default binding:',
  '',
  '```json',
  jsonStringify(UNBIND_EXAMPLE, null, 2),
  '```',
].join('\n')

const SECTION_INTERACTION = [
  '## How User Bindings Interact with Defaults',
  '',
  '- User bindings are **additive** — they are appended after the default bindings',
  '- To **move** a binding to a different key: unbind the old key (`null`) AND add the new binding',
  "- A context only needs to appear in the user's file if they want to change something in that context",
].join('\n')

const SECTION_COMMON_PATTERNS = [
  '## Common Patterns',
  '',
  '### Rebind a key',
  'To change the external editor shortcut from `ctrl+g` to `ctrl+e`:',
  '```json',
  jsonStringify(REBIND_EXAMPLE, null, 2),
  '```',
  '',
  '### Add a chord binding',
  '```json',
  jsonStringify(CHORD_EXAMPLE, null, 2),
  '```',
].join('\n')

const SECTION_BEHAVIORAL_RULES = [
  '## Behavioral Rules',
  '',
  '1. Only include contexts the user wants to change (minimal overrides)',
  '2. Validate that actions and contexts are from the known lists below',
  '3. Warn the user proactively if they choose a key that conflicts with reserved shortcuts or common tools like tmux (`ctrl+b`) and screen (`ctrl+a`)',
  '4. When adding a new binding for an existing action, the new binding is additive (existing default still works unless explicitly unbound)',
  '5. To fully replace a default binding, unbind the old key AND add the new one',
].join('\n')

const SECTION_DOCTOR = [
  '## Validation with /doctor',
  '',
  'The `/doctor` command includes a "Keybinding Configuration Issues" section that validates `~/.claude/keybindings.json`.',
  '',
  '### Common Issues and Fixes',
  '',
  markdownTable(
    ['Issue', 'Cause', 'Fix'],
    [
      [
        '`keybindings.json must have a "bindings" array`',
        'Missing wrapper object',
        'Wrap bindings in `{ "bindings": [...] }`',
      ],
      [
        '`"bindings" must be an array`',
        '`bindings` is not an array',
        'Set `"bindings"` to an array: `[{ context: ..., bindings: ... }]`',
      ],
      [
        '`Unknown context "X"`',
        'Typo or invalid context name',
        'Use exact context names from the Available Contexts table',
      ],
      [
        '`Duplicate key "X" in Y bindings`',
        'Same key defined twice in one context',
        'Remove the duplicate; JSON uses only the last value',
      ],
      [
        '`"X" may not work: ...`',
        'Key conflicts with terminal/OS reserved shortcut',
        'Choose a different key (see Reserved Shortcuts section)',
      ],
      [
        '`Could not parse keystroke "X"`',
        'Invalid key syntax',
        'Check syntax: use `+` between modifiers, valid key names',
      ],
      [
        '`Invalid action for "X"`',
        'Action value is not a string or null',
        'Actions must be strings like `"app:help"` or `null` to unbind',
      ],
    ],
  ),
  '',
  '### Example /doctor Output',
  '',
  '```',
  'Keybinding Configuration Issues',
  'Location: ~/.claude/keybindings.json',
  '  └ [Error] Unknown context "chat"',
  '    → Valid contexts: Global, Chat, Autocomplete, ...',
  '  └ [Warning] "ctrl+c" may not work: Terminal interrupt (SIGINT)',
  '```',
  '',
  '**Errors** prevent bindings from working and must be fixed. **Warnings** indicate potential conflicts but the binding may still work.',
].join('\n')

export function registerKeybindingsSkill(): void {
  registerBundledSkill({
    name: 'keybindings-help',
    description:
      'Use when the user wants to customize keyboard shortcuts, rebind keys, add chord bindings, or modify ~/.claude/keybindings.json. Examples: "rebind ctrl+s", "add a chord shortcut", "change the submit key", "customize keybindings".',
    allowedTools: ['Read'],
    userInvocable: false,
    isEnabled: isKeybindingCustomizationEnabled,
    async getPromptForCommand(args) {
      // Generate reference tables dynamically from source-of-truth arrays
      const contextsTable = generateContextsTable()
      const actionsTable = generateActionsTable()
      const reservedShortcuts = generateReservedShortcuts()

      const sections = [
        SECTION_INTRO,
        SECTION_FILE_FORMAT,
        SECTION_KEYSTROKE_SYNTAX,
        SECTION_UNBINDING,
        SECTION_INTERACTION,
        SECTION_COMMON_PATTERNS,
        SECTION_BEHAVIORAL_RULES,
        SECTION_DOCTOR,
        `## Reserved Shortcuts\n\n${reservedShortcuts}`,
        `## Available Contexts\n\n${contextsTable}`,
        `## Available Actions\n\n${actionsTable}`,
      ]

      if (args) {
        sections.push(`## User Request\n\n${args}`)
      }

      return [{ type: 'text', text: sections.join('\n\n') }]
    },
  })
}

/**
 * Build a markdown table from headers and rows.
 */
function markdownTable(headers: string[], rows: string[][]): string {
  const separator = headers.map(() => '---')
  return [
    `| ${headers.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}
