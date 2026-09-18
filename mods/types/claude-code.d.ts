// Written by Claude Code 2.1.277.
// Claude Code function hooks: the plugin API's TypeScript declarations.
//
// EARLY ACCESS: this surface may change between releases without notice.
// Written by `/plugin-types`; regenerate with that command after an update
// rather than editing. The first line names the Claude Code version that
// wrote it. TypeScript 5.4 or newer reads it. `claude plugin validate <dir>`
// is the other half: it reads a plugin's manifest and its hooks module's
// source the way the engine will and reports what the module hooks and
// calls and everything the engine would refuse, before any session loads it.
//
// What is here: the module a hooks module may import types from,
//   import type { Register, On, EngineInterface } from 'claude-code'
// (at run time the import is empty), and the globals a hooks module has:
// `h` and `Fragment` (what JSX compiles against), the JSX namespace, and
// the environment's web APIs (URL, TextEncoder, AbortController,
// crypto.subtle, ...). A hooks module runs in an environment of its own:
// no DOM, no Node. The module, and every file it imports from the plugin,
// is named .ts, .tsx, .jsx, .js, .mjs, .cjs, .mts or .cts (a file named
// otherwise is not loaded) and is an ES module whatever its suffix: there
// is no `require`. The elements a render hook draws with (`Box`, `Text`,
// `Button`, ...) are not globals: they come from the surface's table,
//   const { Box, Text } = $.ui.resolve(e)
//
// Also here: 'claude-code/testing', the kit a plugin's *.test.ts and
// *.test.tsx files import under `claude plugin test <dir>`, which runs each
// in an environment like the one a plugin's hooks run in (no fs, network or
// process), the plugin loaded from the folder by the engine's own host:
// `test(name, async ($, on) => { ... })`, where `$` is the engine's own
// and the hooks `on` registers sit beneath every plugin; with describe,
// expect, tier, and `mock`, whose clock, store and env answer those nouns
// beneath the plugins from memory. `$.ui.mount` draws a component through
// the plugin on the surface the test names (terminal, desktop, vscode or
// mobile: never assumed) and hands back the drawing to read and act on by
// key: find an element, press a Button, type into an Input, drive a
// `Client`'s module (keys, pointer, posts, its frame clock), each act typed
// by that surface's element table, so one test body run over several
// surfaces covers the mod's hooks and description on each. It exercises
// the mod (its hooks, the tree they return under each surface's rules, its
// `Client` modules), never a surface's paint (Ink's, the desktop page's):
//
//   test('notes add up on every surface that takes input', async $ => {
//     for (const surface of ['terminal', 'desktop'] as const) {
//       const ui = await $.ui.mount({ plugin: 'notes', surface, ...BAND })
//       await ui.input({ key: 'new', text: 'milk' })
//       expect((await ui.find({ key: 'count' }))?.text).toBe('1 note')
//       await ui.key({ key: 'down', in: 'list' })
//       await ui.unmount()
//     }
//     for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
//       const ui = await $.ui.mount({ plugin: 'notes', surface, ...HINT })
//       expect(await ui.find({ type: 'Text', text: /notes/ })).toBeDefined()
//       await ui.press({ key: 'dismiss' })
//     }
//   })
//
// Typing a plugin against it:
//   export const register: Register = (on, options) => { ... }
// or, in a .js module,
//   /** @type {import('claude-code').Register} */
//   export const register = (on, options) => { ... }
//
// A tsconfig.json (or jsconfig.json) that fits a hooks module:
//   {
//     "compilerOptions": {
//       "target": "es2023", "lib": ["es2023"], "types": [],
//       "module": "esnext", "moduleResolution": "bundler",
//       "strict": true, "noUncheckedIndexedAccess": true,
//       "noEmit": true, "skipLibCheck": true,
//       "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"
//     },
//     "include": [".claude/types", "hooks", "tests"]
//   }
// ".claude/types" is where /plugin-types writes this file and, beside it,
// claude-code-mcp.d.ts and claude-code-plugins.d.ts, the index of the
// enabled plugins' type contracts, each copied to claude-code-plugins/
// <plugin>.d.ts: what a plugin adds to `$` in engine.create, so a plugin
// you depend on is typed with nothing copied (the include above takes the
// whole folder). "hooks" is the plugin's hooks/ folder and "tests" its test
// files. `lib` names no DOM: the environment has none, and its `Text`
// would shadow the element.
//
// A plugin that adds a noun to `$` ships its own contract: a .d.ts its
// plugin.json names as "types", exporting the noun's types at its top level
// and declaring the noun on the engine's interface,
//   export type Topo = { ... }
//   declare module 'claude-code' {
//     interface EngineInterface { topo: Topo }
//   }
// with no import or reference, its exported names led by the noun's
// PascalCase name; the plugin's own hooks module imports them from it.

declare module 'claude-code' {
  /**
   * What an Agent call a plugin raised (`$.tool.call({ tool: "Agent", ... })`)
   * answers as `result` once the agent settles; `text` is its final answer.
   *
   * A plugin's spawn always runs in the background, so the call resolves with
   * this record and not the Agent tool's own (BuiltinToolResults), which is
   * what a model's Agent call carries at `tool.call`.
   */
  export type AgentCallRecord = {
      /**
       * The spawned agent's id, as `$.agent.list()` names it.
       */
      agentId: string;
      /**
       * The model the agent resolved to, when one is known.
       */
      resolvedModel?: string;
  };

  /**
   * One agent loop of this session as `$.agent.list()` returns it: a subagent
   * or an in-process teammate.
   */
  export type AgentInfo = {
      /**
       * The agent's id: the same string its loop's `tool.call` events carry as
       * `agentId`, and a spawn inside it as `parentAgentId`.
       */
      id: string;
      /**
       * Its row's label.
       */
      description: string;
      /**
       * The agent definition it runs as (`general-purpose`, `Explore`, ...), or
       * `teammate` for an in-process teammate.
       */
      type: string;
      /**
       * `running`, `completed`, `failed`, `killed`, or another of the engine's task
       * statuses.
       */
      status: string;
      /**
       * The id of the subagent whose loop spawned it; absent when the main loop
       * did.
       */
      parentId?: string;
      /**
       * The plugin whose `$.agent.spawn` (or Agent `$.tool.call`) started it;
       * absent when the model or the person did.
       *
       * The origin axis: which plugin caused it, whichever loop that hook ran in.
       */
      spawnedBy?: string;
      /**
       * What SendMessage addresses it by (`Agent({ name })`, or the engine's own
       * for a background agent), when it has one; not `description` or `type`.
       */
      name?: string;
  };

  /**
   * Which model loop an event happened in: the loop's agent id inside a
   * subagent's or a teammate's loop, absent on the main loop.
   *
   * The agent axis, not the origin axis: `next.origin` names the plugin whose
   * hook frame caused the dispatch (the recursion skip), whichever loop it ran
   * in; `agentId` names the loop, whoever caused the call.
   */
  export type AgentLoop = {
      /**
       * The id of the loop this call runs in: for a subagent or a teammate, the
       * `id` `$.agent.list()` gives it; absent on the main loop.
       *
       * A workflow's agents and the engine's own forks (compaction, memory) carry
       * ids no list names. Pinned: a different value is refused, one left out is
       * kept. Which loop, not which plugin caused it (that is `next.origin`).
       */
      agentId?: string;
  };

  /**
   * The input of `agent.offer`: one agent type, at the moment the engine
   * offers it to the model.
   *
   * Listed for the model (the agent listing) or named by it at dispatch
   * (`subagent_type`): the same event at each. Model-facing only: a plugin's
   * own `$.agent.spawn` of a type is no offer, and `agent.spawn` governs it.
   */
  export type AgentOfferInput = {
      /**
       * Which type (`Explore`, `Plan`, a plugin's agent); the key a matcher
       * narrows on.
       */
      agent: string;
      /**
       * Its listing line's text as the definition states it (`whenToUse`).
       */
      description: string;
      /**
       * Where the definition came from (`built-in`, `plugin`, a settings
       * source), so a matcher tells a built-in from a user's agent of its name.
       */
      source: string;
      /**
       * Who provides this agent: the plugin and its tier; `{ plugin: "engine",
       * tier: "core" }` for a built-in. Pinned: a rewrite is refused.
       */
      provider: Origin;
  };

  /**
   * What an `agent.offer` hook returns: whether the model is offered the agent
   * type, in its listing and at dispatch.
   */
  export type AgentOfferResult = {
      isOffered: boolean;
  };

  /**
   * `agent.spawn`'s input as the call takes it: what the Agent tool's caller
   * says; the engine fills the rest.
   *
   * A call's spawn runs in the background: it resolves once the subagent
   * started, and nothing holds it in the foreground.
   */
  export type AgentSpawnArgs = Pick<AgentSpawnInput, 'prompt'> & Partial<Pick<AgentSpawnInput, 'description' | 'subagentType' | 'model' | 'name' | 'cwd'>>;

  /**
   * The input of `agent.spawn`: what the Agent tool decided about the
   * subagent it is about to start, before its model is resolved.
   *
   * A hook rewrites content (prompt, description, subagentType, model,
   * background, cwd), read back as the tool's parameters; tool_use_id, name,
   * fork, parentModel, permissionMode, parentAgentId and provider are pinned.
   */
  export type AgentSpawnInput = {
      /**
       * The Agent tool call this spawn belongs to (for `$.ui.notice`). Pinned:
       * the spawn's identity.
       */
      tool_use_id: string;
      /**
       * The task the subagent is given: the Agent tool's `prompt` parameter. A
       * rewrite is the prompt the subagent runs with.
       */
      prompt: string;
      /**
       * The Agent tool's short `description` of the task (a few words). A rewrite
       * is what the task shows as.
       */
      description: string;
      /**
       * The resolved agent type (`general-purpose`, `Explore`, a plugin's agent,
       * `fork`). A rewrite names another agent this call can dispatch, exactly.
       *
       * That definition is the one spawned; a name matching none refuses the
       * spawn, and a fork dispatches no other.
       */
      subagentType: string;
      /**
       * Who provides this agent: the plugin and its tier; `{ plugin: "engine",
       * tier: "core" }` for a built-in. Pinned with the spawn's identity.
       */
      provider: Origin;
      /**
       * The Agent tool's `model` parameter as given, an alias (`haiku`) or a
       * full id; undefined lets the agent's own model, then the parent's, decide.
       *
       * Ignored for forks, which always inherit. A hook sets this to pick the
       * subagent's model.
       */
      model?: string;
      /**
       * The parent's effective model, what `inherit` resolves to. Pinned: a fact
       * of the parent (set `model` to change what the subagent runs on).
       */
      parentModel: string;
      /**
       * The id of the loop the spawn happens in (its `tool.call` `agentId`; for a
       * subagent or teammate its `$.agent.list()` id); absent from main.
       *
       * Pinned: a different value is refused, one left out is kept. The agent
       * axis, not the origin: `next.origin` names the plugin whose hook frame
       * caused the spawn, this names the model loop it happened in.
       */
      parentAgentId?: string;
      /**
       * The parent's permission mode (`default`, `acceptEdits`, `plan`, ...), which
       * the subagent inherits. Pinned: a fact of the parent.
       */
      permissionMode?: string;
      /**
       * True when the subagent will run in the background (or remotely). A
       * rewrite is read back as the call's `run_in_background`.
       *
       * The agent's own definition and remote isolation can still force it on,
       * and disabled background tasks force it off.
       */
      background: boolean;
      /**
       * True for a fork of the parent: it inherits the parent's context and model,
       * and `model` is ignored. Pinned: the spawn's identity.
       */
      fork: boolean;
      /**
       * Given by the call (`Agent({ name })`, addressable by SendMessage);
       * undefined when unnamed. Pinned: the address the parent routes by.
       */
      name?: string;
      /**
       * The directory the subagent runs in when the call set one (`cwd`); undefined
       * means the parent's. A rewrite is where the subagent runs.
       */
      cwd?: string;
  };

  /**
   * What an `agent.spawn` hook returns and what `next(e)` resolves to: the
   * started subagent's `{ model, agentId }`, or `{ deny: reason }`, refusing it.
   *
   * It and `$.agent.spawn(input)` resolve once the subagent started; its answer
   * is its own `turn.complete`, carrying this `agentId`. Keep the id and set
   * `got[agentId]` to what waits; a `turn.complete` hook resolves it:
   *
   * @example
   * on("turn.complete", ($, e, next) => (got[e.agentId]?.(e.answer), next(e)))
   */
  export type AgentSpawnResult = {
      /**
       * What the subagent runs on: from core the resolved id; from a hook an
       * alias (`haiku`) or an id.
       */
      model: string;
      /**
       * The started subagent's id: the same string its loop's `tool.call`
       * events carry as `agentId` and `$.agent.list()` lists it by.
       *
       * Set by core; a hook that answers without `next` started none.
       */
      agentId?: string;
      deny?: undefined;
  } | {
      /**
       * Refuses the spawn, so nothing starts; the model sees the text as the
       * Agent tool's error.
       */
      deny: string;
      model?: undefined;
      agentId?: undefined;
  };

  /**
   * What `$.agent.register` takes: an agent type this plugin defines, spelled
   * as an agent definition in settings JSON is, plus its `name`.
   *
   * Every field an agent file or `--agents` entry may carry is here and takes
   * effect as it does there; the engine validates it with the same schema.
   */
  type AgentSpec = {
      /**
       * The type's short name (letters, digits, `_`, `-`; up to 64); the type is
       * `<plugin>:<name>`, as a plugin's agent file `agents/<name>.md` names one.
       */
      name: string;
      /**
       * When to delegate to this agent: the line the model reads in its listing
       * of agent types, and `agent.offer`'s `description`.
       */
      description: string;
      /**
       * The agent's system prompt, whole: it replaces the session's.
       */
      prompt: string;
      /**
       * What the agent may call, by tool name (`Read`, `Bash`, `mcp__x__y`); a
       * call to any other is refused. Left out: every tool the parent has.
       */
      tools?: readonly string[];
      /**
       * Tools withheld from the agent, by name, out of whatever `tools` allows.
       */
      disallowedTools?: readonly string[];
      /**
       * The agent's model: an alias (`haiku`, `sonnet`, `opus`), a full id, or
       * `inherit` for the parent's. Left out: the session's subagent default.
       */
      model?: string;
      /**
       * The agent's effort: a level (`low`, `medium`, `high`, `xhigh`, `max`)
       * or an integer budget.
       */
      effort?: string | number;
      /**
       * How the agent's permission asks are decided, a mode: `default`,
       * `acceptEdits`, `plan`, `auto`, `dontAsk` or `bypassPermissions`.
       *
       * Left out: the parent's.
       */
      permissionMode?: string;
      /**
       * Servers connected over MCP for the agent's run: a configured server's
       * name, or `{ "<name>": { command, args } }`, one server's config inline.
       */
      mcpServers?: readonly (string | Record<string, unknown>)[];
      /**
       * Settings hooks in force while the agent runs, in settings.json's `hooks`
       * shape (`{ PreToolUse: [{ matcher, hooks: [...] }] }`).
       */
      hooks?: Record<string, unknown>;
      /**
       * The most turns the agent takes before it stops.
       */
      maxTurns?: number;
      /**
       * Preloaded into the agent's context before its first turn: skill names.
       */
      skills?: readonly string[];
      /**
       * The agent's first user turn; `{{intent}}` in it takes the spawn's prompt.
       * Left out: the spawn's prompt is the first turn.
       */
      initialPrompt?: string;
      /**
       * A persistent memory the agent keeps between runs, and where: `user`,
       * `project` or `local`.
       */
      memory?: 'user' | 'project' | 'local';
      /**
       * Set so that every spawn of the agent runs in the background.
       */
      background?: true;
      /**
       * Set so that the agent's context carries no CLAUDE.md block (the person's,
       * the project's, the rules): it takes what it needs from its prompt.
       */
      omitClaudeMd?: true;
      /**
       * Where the agent runs apart from the session: `worktree`, a git worktree
       * of its own; `remote`, a cloud session where the build allows one.
       */
      isolation?: 'worktree' | 'remote';
  };

  /**
   * The hook `on("*", hook)` takes: it runs on every event, plugin nouns no
   * declaration names included, so `e` is `unknown` and `next` is StarNext.
   *
   * Until `next.is(pattern, e)` narrows `e`, all a hook can do with it is pass
   * it on, time it, log it, or fail it; once narrowed it is an ordinary hook on
   * those events.
   *
   * @param $ the engine interface; at `engine.create` the empty table, so a hook
   *          that reads `$` tests `next.is("engine.create", e)` first
   */
  export type AnyEventHook = ($: EngineInterface, e: unknown, next: StarNext) => unknown;

  /**
   * Every key of every variant, index signatures included.
   */
  type AnyKeyOf<I> = I extends unknown ? keyof I : never;

  /**
   * The argument of event `N`: `e` in its hooks, and what its call takes. For a
   * union of names, the union of their arguments.
   */
  export type Args<N extends EventName = EventName> = EventOf[N];

  /**
   * Options of `$.ui.ask`.
   */
  export type AskOptions = {
      /**
       * 2-4 option labels; fewer than two are padded with Yes/No; free text is the
       * dialog's Other.
       */
      options?: readonly string[];
      /**
       * A short chip beside the question (`Approach`, 12 characters at most).
       */
      header?: string;
      /**
       * Allow several options; the answer comes back comma-joined.
       */
      multiSelect?: true;
  };

  /**
   * The input of `attribution.text`: one text the engine asks the model to
   * write into a commit or a pull request, at the moment it is composed.
   *
   * Composed for the Bash description, the commit skills, a PR's body, the
   * pre-ship mandate and the commit gate's deny: the same event at each.
   */
  export type AttributionTextInput = {
      /**
       * Which text (`commit`, `pr`, `exemption`, `remedy`); the key a matcher
       * narrows on.
       */
      kind: AttributionTextKind;
      /**
       * As the engine composed it, the settings applied.
       */
      text: string;
  };

  /**
   * Which git text `attribution.text` carries: the commit trailer, the PR
   * footer, the mandate's or the commit gate's sentence naming the exemption.
   */
  export type AttributionTextKind = 'commit' | 'pr' | 'exemption' | 'remedy';

  /**
   * What an `attribution.text` hook returns: the text the model reads in
   * that place.
   */
  export type AttributionTextResult = {
      text: string;
  };

  /**
   * What `$.audio.play` plays: a URL the engine fetches, or the bytes.
   */
  export type AudioClip = {
      /**
       * A file of the calling plugin's own, relative to the plugin's
       * directory (`fx/open.wav`); no `.`, no leading slash.
       *
       * The engine resolves it and loads the file from disk.
       */
      asset: string;
      url?: undefined;
      base64?: undefined;
      mime?: undefined;
  } | {
      /**
       * The clip's URL; the engine fetches it (never the plugin).
       */
      url: string;
      asset?: undefined;
      base64?: undefined;
      mime?: undefined;
  } | {
      /**
       * The clip's bytes, base64.
       */
      base64: string;
      /**
       * What the bytes are (`audio/mpeg`, `audio/wav`).
       */
      mime: string;
      asset?: undefined;
      url?: undefined;
  };

  type BackgroundTaskSummary = {
      id: string;
      /**
       * Friendly task-type label (e.g. 'shell', 'subagent', 'monitor', 'workflow'). Falls back to the raw discriminant for unknown types.
       */
      type: string;
      status: string;
      /**
       * Free-text description. Capped at 1000 chars; clipped values append an in-string "... [+N chars]" marker.
       */
      description: string;
      /**
       * Shell command line. Only present for 'shell' tasks. Capped at 1000 chars with the same "... [+N chars]" marker.
       */
      command?: string;
      /**
       * Subagent type name. Only present for 'subagent' tasks.
       */
      agent_type?: string;
      /**
       * MCP server name. Only present for 'monitor' / 'MCP task' tasks.
       */
      server?: string;
      /**
       * MCP tool name. Only present for 'monitor' / 'MCP task' tasks.
       */
      tool?: string;
      /**
       * Workflow name. Only present for 'workflow' tasks.
       */
      name?: string;
  };

  type BaseHookInput = {
      session_id: string;
      transcript_path: string;
      cwd: string;
      /**
       * UUID correlating a user prompt with all subsequent events until the next prompt. Same value emitted on OpenTelemetry events as the `prompt.id` attribute, so hook output can be joined to OTel events at prompt grain. Absent until the first user input of the process lifetime.
       */
      prompt_id?: string;
      permission_mode?: string;
      /**
       * Subagent identifier. Present only when the hook fires from within a subagent (e.g., a tool called by an AgentTool worker). Absent for the main thread, even in --agent sessions. Use this field (not agent_type) to distinguish subagent calls from main-thread calls.
       */
      agent_id?: string;
      /**
       * Agent type name (e.g., "general-purpose", "code-reviewer"). Present when the hook fires from within a subagent (alongside agent_id), or on the main thread of a session started with --agent (without agent_id).
       */
      agent_type?: string;
      /**
       * Reasoning effort applied to the current turn. Same shape as StatusLineCommandInput.effort. Present for hooks that fire within a tool-use context (PreToolUse, PostToolUse, Stop, SubagentStop, etc.) on a model that supports the effort parameter; absent for session-lifecycle hooks and models without effort support.
       */
      effort?: {
          /**
           * Active effort level for the current turn (e.g., "low", "medium", "high", "xhigh", "max"), after any silent downgrade for the selected model. Also exposed to hook commands and Bash as the CLAUDE_EFFORT env var.
           */
          level: string;
      };
  };

  /**
   * The `Box` props a `hover` may override, none of which moves the Box's
   * siblings, and `scope`, which names the hover group the Box joins.
   *
   * `display` is `"flex"` alone, on a Box drawn `display: "none"`: with a
   * `scope`, every member of the lit group is revealed, in whichever site it
   * sits, so a pointer on a glyph in the transcript can swap an entry into a
   * fixed row of the band, or reveal an absolutely positioned card.
   * `borderStyle` only restyles a border the Box has; the offsets move a Box
   * drawn `position: "absolute"`, none in the flow. The surface applies a
   * hover as the pointer moves, so a reveal that moves what the pointer rests
   * on is drawn once, not in a loop.
   */
  export type BoxHoverProps = {
      /**
       * Names a hover group of this plugin's: every element it draws with the
       * same `scope`, in any site, lights while any is hovered, reveals included.
       *
       * A Pane row and a mark on a transcript message can share one. Another
       * plugin's elements under the same string are a different group. One to
       * 64 characters, no control characters; no keyed Box needed; no hook runs.
       */
      scope?: string;
      borderStyle?: string;
      borderColor?: string;
      borderDimColor?: boolean;
      backgroundColor?: string;
      display?: 'flex';
      top?: number;
      left?: number;
      right?: number;
      bottom?: number;
  };

  /**
   * The props of `Box`: the layout, position, margin, padding and border props
   * of Ink's Box a tree may set, and the two of hover.
   */
  export type BoxProps = {
      /**
       * Makes the Box a hover scope: while the pointer is anywhere over it, its
       * own `hover` and that of every element beneath it apply.
       *
       * A nested Box with a `key` of its own scopes what is beneath it, a placed
       * card outside its rows included. A key a sibling Box already took, or one
       * that is no plain string, names no scope: hovers beneath it stay inert.
       */
      key?: string;
      /**
       * Style overrides applied by the surface while the pointer is over the
       * nearest keyed `Box`, this one included, or, given a `scope`, its group.
       *
       * No hook runs and nothing crosses to the plugin. To reveal on hover, draw
       * the Box `display: "none"` with `hover: { display: "flex" }` in a visible
       * keyed Box or under a `scope`; on a `position: "absolute"` Box, no reflow.
       */
      hover?: BoxHoverProps;
      /**
       * `"absolute"` leaves the flow, as in CSS: placed against its parent by
       * the offsets, no room among its siblings, painted over those before it.
       *
       * So showing or moving it (a hover may) moves nothing; the pointer on it is
       * on its parent. Clipped, pointer and paint, by the region its site is in
       * (viewport, pane, band), by the site itself on the main screen or export.
       *
       * @example <Box key="k"><Text>glyph</Text><Box position="absolute" top={-2}
       *   left={2} display="none" hover={{ display: 'flex' }}>the card</Box></Box>
       */
      position?: 'relative' | 'absolute';
      /**
       * Rows from the parent's top edge, in character cells: an integer,
       * negative above the edge.
       *
       * With `bottom` and no `height` the Box spans the two.
       */
      top?: number;
      /**
       * Columns from the parent's left edge, in character cells: an integer,
       * negative left of the edge.
       *
       * With `right` and no `width` the Box spans the two.
       */
      left?: number;
      /**
       * Columns from the parent's right edge, in character cells: an integer,
       * negative right of the edge.
       */
      right?: number;
      /**
       * Rows from the parent's bottom edge, in character cells: an integer,
       * negative below the edge.
       */
      bottom?: number;
      flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
      flexGrow?: number;
      flexShrink?: number;
      flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
      alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
      alignSelf?: 'flex-start' | 'center' | 'flex-end' | 'auto';
      justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
      gap?: number;
      columnGap?: number;
      rowGap?: number;
      width?: number | string;
      height?: number | string;
      minWidth?: number | string;
      minHeight?: number | string;
      margin?: number;
      marginX?: number;
      marginY?: number;
      marginTop?: number;
      marginBottom?: number;
      marginLeft?: number;
      marginRight?: number;
      padding?: number;
      paddingX?: number;
      paddingY?: number;
      paddingTop?: number;
      paddingBottom?: number;
      paddingLeft?: number;
      paddingRight?: number;
      borderStyle?: string;
      borderColor?: string;
      borderDimColor?: boolean;
      backgroundColor?: string;
      overflow?: 'visible' | 'hidden';
      display?: 'flex' | 'none';
  };

  /**
   * One variant per built-in tool; with none in the table (a plugin author's
   * project before `/plugin-types` ran), one loose variant over every name.
   */
  export type BuiltinToolCallInput = [BuiltinToolName] extends [never] ? BuiltinToolCallInputFallback : {
      [N in BuiltinToolName]: ToolInputOf<N, BuiltinToolInputs[N]>;
  }[BuiltinToolName];

  /**
   * The built-in branch's answer when no built-in tool is declared: every
   * name, its args unconstrained.
   */
  type BuiltinToolCallInputFallback = {
      /**
       * The name of the tool being called (`Bash`); comparing it narrows `e` once
       * the table has entries. Reserved: a rewrite of it is ignored by core.
       */
      tool: string;
      /**
       * The tool_use block's id: the same at every event of the call and in
       * `$.ui.notice`. Reserved: a rewrite of it is ignored by core.
       */
      tool_use_id: string;
      [argument: string]: unknown;
  };

  /**
   * The arguments of each built-in tool by name, for declaration merging;
   * empty until a declaration file adds entries, then `e.tool === "Bash"`
   * narrows `e` to Bash's arguments.
   *
   * `/plugin-types` writes this build's set beneath the engine's declarations
   * (claude-code.d.ts), from each tool's input schema.
   *
   * @example
   * interface BuiltinToolInputs { Bash: { command: string; timeout?: number } }
   */
  export interface BuiltinToolInputs {
  }

  /**
   * The names of the built-in tools.
   */
  export type BuiltinToolName = keyof BuiltinToolInputs & string;

  /**
   * The structured result of each built-in tool by name, for declaration
   * merging; empty until a declaration file adds entries, then after
   * `e.tool === "Bash"` the `result` of `next(e)` is Bash's record.
   *
   * `/plugin-types` writes this build's set beneath the engine's declarations
   * (claude-code.d.ts), from each tool's output schema; a tool without one is
   * `unknown`.
   *
   * @example
   * interface BuiltinToolResults { Bash: { stdout: string; stderr: string } }
   */
  export interface BuiltinToolResults {
  }

  /**
   * The props of `Button`, every surface's pressable leaf: an address, a
   * label, the closure a press runs, and the label styles a hover overrides.
   *
   * The terminal draws `[ label ]` (when `plain`, `1: label` or the label
   * alone), a desktop a native button; a click, a `hotkey`, the chord for its
   * `action`, or Enter under the focus raises `ui.press`, its bottom `onPress`.
   */
  export type ButtonProps = {
      /**
       * The element's address: `e.element` at `ui.press`, what a matcher names.
       * Defaults to the label.
       */
      key?: string;
      /**
       * The text drawn on the button; or the one string child.
       */
      label?: string;
      /**
       * One digit (`"1"`) or one lowercase letter (`"w"`) that presses it while
       * the plugin's site holds the focus; anything else is refused.
       *
       * The band after ctrl+x tab or a click, a focused `Pane`; never from the
       * composer, save a bare digit in an empty one pressing a band Button, as a
       * survey is answered. Shift+w matches `"w"`; two on one key, the later wins.
       */
      hotkey?: string;
      /**
       * An engine keybinding action (`"app:cycleDiffBase"`) whose chord, as the
       * person bound it, presses this from the prompt; unknown names refused.
       *
       * Chords, or a modified key Global or an active context binds, on the
       * terminal while mounted, no dialog up and no engine handler of the action
       * mounted; a pane's over the band's over another's, then the last drawn.
       */
      action?: string;
      /**
       * Drawn without chrome: the hotkey in the accent color, a colon, the
       * label (`1: Yes`), as a survey's row reads; no `hotkey`, the label alone.
       *
       * A one-glyph label (`'\u{1F50A}'`, a speaker) is then a control by
       * itself: the focus and the pointer still invert it, `dimColor` and `hover`
       * still apply. A desktop draws its native button either way.
       */
      plain?: true;
      /**
       * The label drawn dim at rest, as `Text`'s `dimColor`, and at full strength
       * under the pointer or the focus: a secondary control, a path in a list.
       */
      dimColor?: boolean;
      /**
       * The site's focus ring starts here when the site takes the keyboard,
       * instead of on nothing, as the DOM's `autofocus`: Enter acts on it at once.
       *
       * A pane opened with `focus`, or the person's focus chord or click, is the
       * take. Of several in one site the first drawn wins; it raises `ui.focus`,
       * origin this plugin. A ring the person has moved stays where it was put.
       */
      autoFocus?: true;
      /**
       * Label style overrides (the `Text` set) applied by the surface while the
       * nearest enclosing keyed `Box`, or given a `scope` its group, is hovered.
       *
       * No hook runs and nothing crosses to the plugin; under the pointer itself
       * the button inverts as it always has. Refused outside a keyed Box unless
       * it names a `scope`.
       */
      hover?: TextHoverProps;
      /**
       * What the press runs, in the plugin's own environment: the bottom of the
       * `ui.press` chain. The host holds only a handle, for the drawing's life.
       */
      onPress: () => void;
  };

  /**
   * The handler `on(...).catch(handler)` takes for a hook of type `F`: the
   * hook's `($, e, next)`, run afresh when it throws, misreturns or overruns.
   *
   * `next` carries `error` and `called` (Caught) and is replay-safe; a return
   * within the grace is the hook's result, `undefined` the hook absent. On a
   * streaming event the handler is a generator too, continuing the stream.
   */
  export type CatchHandler<F> = F extends ($: infer D, e: infer E, next: infer N) => infer R ? [R] extends [AsyncGenerator<unknown, unknown, unknown>] ? ($: D, e: E, next: N & Caught) => R : ($: D, e: E, next: N & Caught) => R | undefined | Promise<Awaited<R> | undefined> : never;

  /**
   * What `next` carries into a `.catch` handler and nowhere else: why the
   * hook failed, and whether it had called `next` before it did.
   *
   * There `next` is replay-safe: when `called`, `next(e)` resolves to what the
   * hook's last call settled to, nothing beneath running again, the argument
   * unread; when not, it runs the hooks beneath once and a later call replays.
   */
  export type Caught = {
      /**
       * Why the hook failed (HookFailure); undefined on an ordinary hook's
       * `next`, so its presence says a handler is running.
       */
      readonly error: HookFailure;
      /**
       * True when the failed hook had called `next()` or `next.to()` at least
       * once, settled or in flight; the handler runs once that call settled.
       */
      readonly called: boolean;
  };

  /**
   * What a hook on streaming event `N` yields, and what its `next(e)` yields
   * to it (ChunkOf by name).
   */
  export type Chunk<N extends StreamingEventName = StreamingEventName> = ChunkOf[N];

  /**
   * The chunk type of each streaming event, by name: what its stream yields.
   */
  export type ChunkOf = {
      /**
       * One piece of the model's response (TurnStepChunk).
       */
      'turn.step': TurnStepChunk;
  };

  /**
   * What every `turn.step` chunk may carry: the engine's handle on the item
   * of its own stream the chunk was read off, absent on a chunk a hook made.
   *
   * A hook that passes a chunk on, or rewrites it by spreading it, keeps the
   * handle, and whatever it left unchanged reaches the engine as the engine
   * streamed it; a chunk built afresh has none and is taken at its word.
   */
  type ChunkRef = {
      /**
       * The engine's handle on its own streamed item; opaque, this step's only.
       */
      ref?: number;
  };

  /**
   * The name of a classic hook event as a function-hooks event: the settings
   * hook's own name under `classic` (`classic.Stop`, `classic.PreToolUse`).
   */
  export type ClassicEventName = `classic.${ClassicHookEvent}`;

  /**
   * The classic (settings) hook events, one per classic event name: `e` is
   * what the classic hook receives on stdin for that event.
   *
   * The chain is [managed settings hooks, ...hooks modules, the other settings
   * hooks as core], so a managed block ends it above every module. In shape
   * `classic.PreToolUse` alone differs: its `e` is ToolCallEnvelope, no more.
   */
  export type ClassicEventOf = {
      [E in ClassicHookEvent as `classic.${E}`]: E extends 'PreToolUse' ? ToolCallEnvelope : ClassicHookInputs[E];
  };

  /**
   * The name of a classic hook event: `PreToolUse`, `Stop`, and the rest.
   */
  export type ClassicHookEvent = HookInput['hook_event_name'];

  /**
   * What a classic hook receives on stdin for each event, by event name: the
   * Agent SDK's `<Event>HookInput`.
   */
  export type ClassicHookInputs = {
      [I in HookInput as I['hook_event_name']]: I;
  };

  /**
   * Everything a classic hook event's answer can carry, named as the classic
   * hook's JSON output names it; each event reads its subset (ClassicResultOf).
   *
   * The settings hooks below fold into one of these (last write wins, contexts
   * concatenate); a hooks module returns `next(e)`, a copy with fields changed,
   * or its own. A field of the wrong shape fails the hook, which is skipped.
   */
  export type ClassicResult = {
      /**
       * `decision: "block"` with this text as `reason` (a command hook's exit
       * code 2): the event's block, veto or re-prompt.
       */
      block?: string;
      /**
       * `continue: false`: the session stops after this event.
       */
      preventContinuation?: true;
      /**
       * Shown when `preventContinuation` stops the session (`stopReason`).
       */
      stopReason?: string;
      /**
       * `hookSpecificOutput.additionalContext`, one entry per hook: text handed
       * to the model with the event.
       */
      additionalContext?: string[];
      /**
       * `hookSpecificOutput.sessionTitle` (UserPromptSubmit, SessionStart).
       */
      sessionTitle?: string;
      /**
       * `hookSpecificOutput.suppressOriginalPrompt` (UserPromptSubmit,
       * UserPromptExpansion).
       */
      suppressOriginalPrompt?: true;
      /**
       * `hookSpecificOutput.initialUserMessage` (SessionStart).
       */
      initialUserMessage?: string;
      /**
       * `hookSpecificOutput.watchPaths` (SessionStart).
       */
      watchPaths?: string[];
      /**
       * `hookSpecificOutput.reloadSkills` (SessionStart).
       */
      reloadSkills?: true;
      /**
       * `hookSpecificOutput.permissionDecision` (PreModelSwitch).
       */
      permissionDecision?: 'allow' | 'deny' | 'ask';
      /**
       * `hookSpecificOutput.permissionDecisionReason` (PreModelSwitch).
       */
      permissionDecisionReason?: string;
      /**
       * `hookSpecificOutput.decision` (PermissionRequest).
       */
      decision?: PermissionRequestDecision;
      /**
       * `hookSpecificOutput.updatedToolOutput` (PostToolUse): replaces what the
       * model sees of the tool's result.
       */
      updatedToolOutput?: unknown;
      /**
       * `hookSpecificOutput.updatedMCPToolOutput` (PostToolUse, MCP tools only).
       */
      updatedMCPToolOutput?: unknown;
      /**
       * `hookSpecificOutput.retry` (PermissionDenied).
       */
      retry?: true;
      /**
       * `hookSpecificOutput.displayContent` (MessageDisplay).
       */
      displayContent?: string;
      /**
       * `hookSpecificOutput.worktreePath` (WorktreeCreate; a command hook prints
       * it): the worktree the hook created, absolute or relative to its cwd.
       *
       * Left unset, the session creates its git worktree as it would unhooked.
       */
      worktreePath?: string;
  };

  /**
   * The event-specific fields of ClassicResult each classic event reads (its
   * `hookSpecificOutput`), by event; an event absent here reads none of them.
   *
   * `block`, `preventContinuation` and `stopReason` are every event's.
   */
  export type ClassicResultFields = {
      UserPromptSubmit: 'additionalContext' | 'sessionTitle' | 'suppressOriginalPrompt';
      UserPromptExpansion: 'additionalContext' | 'suppressOriginalPrompt';
      SessionStart: 'additionalContext' | 'initialUserMessage' | 'sessionTitle' | 'watchPaths' | 'reloadSkills';
      Setup: 'additionalContext';
      PreModelSwitch: 'permissionDecision' | 'permissionDecisionReason';
      PostModelSwitch: 'additionalContext';
      SubagentStart: 'additionalContext';
      PostToolUse: 'additionalContext' | 'updatedToolOutput' | 'updatedMCPToolOutput';
      PostToolUseFailure: 'additionalContext';
      PostToolBatch: 'additionalContext';
      Stop: 'additionalContext';
      SubagentStop: 'additionalContext';
      PermissionDenied: 'retry';
      PermissionRequest: 'decision';
      MessageDisplay: 'displayContent';
      WorktreeCreate: 'worktreePath';
  };

  /**
   * What each classic hook event's hook returns and its `next(e)` resolves to:
   * the event's own subset of ClassicResult.
   *
   * `classic.PreToolUse` keeps its `allow` / `ask` / `deny` result
   * (PreToolUseResult).
   */
  export type ClassicResultOf = {
      [E in ClassicHookEvent as `classic.${E}`]: E extends 'PreToolUse' ? PreToolUseResult : Pick<ClassicResult, 'block' | 'preventContinuation' | 'stopReason' | (E extends keyof ClassicResultFields ? ClassicResultFields[E] : never)>;
  };

  /**
   * Options of `$.model.classify`.
   */
  export type ClassifyOptions = {
      /**
       * An alias (`haiku`) or a full model id; default the engine's small fast
       * model.
       */
      model?: string;
  };

  /**
   * The element table a surface module draws with, `surface.elements`: the
   * terminal's (Elements) less `Client` (none nests), `Raster` and `Image`.
   *
   * What `$.ui.resolve(e)` is to a hooks module; a Button, Input or Select
   * keeps its handler here. A tree of them keeps every tree's bounds (20,000
   * nodes, 32 deep, 100,000 characters serialized) or the instance unmounts.
   */
  export type ClientElements = Omit<Elements['terminal'], 'Client' | 'Raster' | 'Image'>;

  /**
   * One key the person pressed while a `Client` had the focus, as
   * `surface.onKey` hands it. Escape never arrives: it returns the focus.
   */
  export type ClientKeyEvent = {
      /**
       * A special key's name (`up`, `down`, `left`, `right`, `return`, `tab`,
       * `backspace`, `delete`, `pageup`, `home`, ...) or the character typed.
       */
      key: string;
      /**
       * Modifier keys held with it, each present only when true.
       */
      ctrl?: true;
      shift?: true;
      meta?: true;
  };

  /**
   * The component a surface module exports (default, or its one PascalCase
   * export): from props and surface to the tree drawn (no nested `Client`).
   *
   * Runs on the drawing thread, a second per call at most; `h` and `Fragment`
   * are the environment's, so nothing of the module's takes those names. A
   * throw, an overrun or a tree past the bounds (ClientElements) unmounts it.
   *
   * @example
   * const Tag: ClientModule<string> = (t, s) => s.elements.Text({ children: t })
   */
  export type ClientModule<P extends JsonValue = JsonValue, S = unknown> = (props: P, surface: ClientSurface<S>) => RenderElement;

  /**
   * One pointer event over a `Client`'s region, as `surface.onPointer` hands
   * it: region-relative cells, and the sub-cell position where known.
   *
   * After a `down` in the region the instance holds the pointer until the
   * `up`: every `move` reaches it, past the edges too (negative, or beyond
   * `columns`/`rows`), and the transcript neither selects nor scrolls.
   */
  export type ClientPointerEvent = {
      type: ClientPointerType;
      /**
       * The column under the pointer, 0 at the region's left edge; on `enter`
       * and `leave`, the last column a move reported.
       */
      x: number;
      /**
       * The row under the pointer, 0 at the region's top edge.
       */
      y: number;
      /**
       * The same position with the fraction of a cell kept (`x: 12`, `fine.x:
       * 12.375`), where the surface knows it: a terminal that reports pixels.
       *
       * kitty, Ghostty, iTerm2, WezTerm and foot do; tmux passes none through.
       * Absent elsewhere and on `enter`/`leave`; present, a `move` comes within
       * a cell too. What a module showing another program's pixels forwards.
       *
       * @example
       * surface.onPointer(e => click((e.fine?.x ?? e.x + 0.5) * pixelsPerCell))
       */
      fine?: {
          x: number;
          y: number;
      };
      /**
       * Which button is down (`down`, `move` while held) or came up (`up`);
       * absent on a hover `move`, `enter` and `leave`.
       */
      button?: 'left' | 'middle' | 'right';
      /**
       * Modifier keys the terminal reported held, each present only when true.
       */
      shift?: true;
      alt?: true;
      ctrl?: true;
  };

  /**
   * What the pointer did over a `Client`'s region: a button went down, the
   * pointer moved, the button came up, or the pointer crossed the region's edge.
   */
  export type ClientPointerType = 'down' | 'move' | 'up' | 'enter' | 'leave';

  /**
   * The props of `Client`: which of the plugin's surface modules draws here,
   * under what key, with what data, in how much room.
   */
  export type ClientProps = {
      /**
       * The instance's address within the drawing: two `Client`s of one plugin in
       * one tree take two keys. What `e.element` carries at `ui.message`.
       *
       * The engine keeps the instance (its local state, its timers) across the
       * plugin's redraws while a `Client` under this key stays in the tree.
       */
      key: string;
      /**
       * The surface module's path, a string literal relative to this file:
       * `module: "./<name>.tsx"` (or `.jsx`, `.ts`, `.js`, `.mjs`).
       *
       * Read off the source: a variable there is refused at load, as is a path
       * outside the plugin or naming no file. Its default export draws, else
       * its one PascalCase export; loaded, the tree carries the plugin's path.
       */
      module: string;
      /**
       * Plain data (JsonValue) handed to the module function; a new value on a
       * redraw reaches the running instance, its state kept.
       *
       * Bounded as a tree's text is; not a channel for closures.
       * Typed `unknown` so a matcher over a tree stays shallow.
       */
      props?: unknown;
      /**
       * Columns the instance's region takes: a count, or a percentage of the
       * parent. Absent, the region is as wide as what the module draws.
       */
      width?: number | string;
      /**
       * Rows the instance's region takes: a count, or a percentage of the parent.
       * Absent, the region is as tall as what the module draws.
       */
      height?: number | string;
      /**
       * How the region grows into free room along the parent's direction, as a
       * Box's `flexGrow`.
       */
      flexGrow?: number;
  };

  /**
   * What a surface module's function receives as its second argument: its
   * elements, the instance's local state, its region, input, clock and port.
   *
   * Called again (same `surface`, same `state`) on new props, after
   * `setState`, and on a resize; what it returns is drawn in the region. No
   * `$` here: the hooks module has it, and `post` is the way to reach it.
   */
  export type ClientSurface<S = unknown> = {
      /**
       * The surface's element table (ClientElements), the tags the module draws
       * with: `const { Box, Text } = surface.elements`. No `Client` in it.
       */
      readonly elements: ClientElements;
      /**
       * The instance's local state: `undefined` until the first `setState`.
       * Kept across the plugin's redraws; dropped with the instance.
       */
      readonly state: S | undefined;
      /**
       * Replaces the local state and schedules one more call of the function on
       * the next frame; several calls before it coalesce into one redraw.
       *
       * A `setState` on each of three renders in a row with no key, pointer,
       * tick, press or props between is a render loop: the instance unmounts.
       */
      setState: (next: S) => void;
      /**
       * The region's width in cells, as last laid out (0 before the first
       * layout).
       */
      readonly columns: number;
      /**
       * The region's height in cells, as last laid out (0 before the first
       * layout).
       */
      readonly rows: number;
      /**
       * Calls `fn` every `ms` milliseconds on the surface's frame clock until
       * the returned function is called or the instance unmounts.
       *
       * Start it once (while `state` is still undefined), not on every call.
       */
      every: (ms: number, fn: () => void) => () => void;
      /**
       * Sets the instance's pointer listener (one; a later call replaces it)
       * and returns what clears it. See ClientPointerEvent for capture.
       */
      onPointer: (fn: (event: ClientPointerEvent) => void) => () => void;
      /**
       * Sets the instance's key listener (one; a later call replaces it),
       * reached while a click has given it the focus; Escape returns that.
       */
      onKey: (fn: (event: ClientKeyEvent) => void) => () => void;
      /**
       * Sends plain data to the plugin's hooks module: `e.data` of a
       * `ui.message` only that plugin's hooks see, one per frame at most.
       *
       * A later post in the same frame replaces an undelivered one; a hook
       * answering `{ props }` hands this instance its next props. At most
       * 20,000 values, 32 deep, 100,000 characters, or the post is not sent.
       */
      post: (data: JsonValue) => void;
  };

  /**
   * The argument of the `$.clock` waits (`sleep`, `after`, `every`): how long,
   * in milliseconds, before the dispatch resolves.
   */
  type ClockWait = {
      /**
       * The wait, a non-negative number of milliseconds.
       */
      ms: number;
  };

  /**
   * The props of `Code`, source text every surface draws with the engine's own
   * highlighter: coloured tokens, a line gutter on request, or a unified diff.
   *
   * A leaf: no children. `source` is the element's data as a string is a
   * Text's, bounded and free of control characters the same way; the colour
   * on screen is the engine's, never the plugin's.
   */
  export type CodeProps = {
      /**
       * The text drawn: source code, or under `format: 'diff'` one or more
       * unified-diff hunks.
       *
       * At most 10000 characters; tab and newline are the only control
       * characters it may hold.
       */
      source: string;
      /**
       * A highlighter language id or alias (`typescript`, `ts`, `py`), a
       * plugin-contributed grammar's included.
       *
       * Absent, the language is inferred from `path`; when neither resolves,
       * the text is drawn plain.
       */
      language?: string;
      /**
       * A file path the language is inferred from when `language` is absent:
       * its extension or name, else a shebang on the first line.
       *
       * Drawn nowhere and never read: nothing touches the disk.
       */
      path?: string;
      /**
       * The 1-based number of the first line of `source`: present, a dim
       * right-aligned gutter numbers the lines from it; absent, no gutter.
       *
       * Ignored under `format: 'diff'`, whose hunks carry their own numbers.
       */
      startLine?: number;
      /**
       * `'source'` (the default) draws `source` as code; `'diff'` reads it as
       * unified-diff hunks and draws gutters, markers, add and remove colouring.
       *
       * A hunk is `@@ -a,b +c,d @@` then lines starting ` `, `+` or `-`; a
       * leading `---`/`+++` pair and `\ No newline at end of file` are read
       * past. A source that does not parse as hunks is refused.
       */
      format?: 'source' | 'diff';
      /**
       * What a line wider than the room does, in Text's `wrap` vocabulary:
       * `'wrap'` (the default) continues it on rows under the gutter.
       *
       * `'truncate-end'` cuts it at the edge with an ellipsis; Text's other
       * spellings are refused, since a gutter leaves them no sense here.
       */
      wrap?: 'wrap' | 'truncate-end';
  };

  /**
   * The input of `command.describe`: how one slash command presents in the
   * typeahead and `/help`, at the moment the engine lists it.
   */
  export type CommandDescribeInput = {
      /**
       * Names the command without its slash; the key a matcher narrows on. A
       * rewrite is refused.
       */
      command: string;
      /**
       * The one-line description the menu shows, as the command declares it.
       */
      description: string;
      /**
       * The hint drawn dim after the name (`[name]`), when the command has one.
       */
      argumentHint?: string;
      /**
       * Whether the typeahead and `/help` leave the command out; a hidden
       * command still runs when typed in full.
       */
      isHidden: boolean;
      /**
       * Whether the command declares it runs at once when typed mid-turn,
       * instead of waiting for the turn to end.
       *
       * One that decides per invocation reads false. Read only: not part of
       * what a hook answers, and a rewrite is refused.
       */
      immediate: boolean;
      /**
       * Who provides this command: the plugin and its tier; `{ plugin: "engine",
       * tier: "core" }` for a built-in. Pinned: a rewrite is refused.
       */
      provider: Origin;
  };

  /**
   * What a `command.describe` hook returns: the description, hint and hidden
   * flag the menu uses; the name, `immediate` and `provider` stay as they were.
   */
  export type CommandDescribeResult = Omit<CommandDescribeInput, 'command' | 'immediate' | 'provider'>;

  /**
   * One slash command as `$.command.list()` returns it.
   */
  export type CommandInfo = {
      /**
       * What the person runs it by, without the slash.
       */
      name: string;
      /**
       * The one line the typeahead shows for it.
       */
      description: string;
      /**
       * Where it comes from (CommandSource).
       */
      source: CommandSource;
      /**
       * Which plugin added it, when `source` is `plugin` and the engine knows:
       * the one that registered it, or whose manifest carries it.
       */
      plugin?: string;
  };

  /**
   * Where a command's answer will show: which of the terminal's two layouts
   * the surface renders, and how wide it is when the command runs.
   *
   * A fact the engine stamps on `command.run`, so a command that draws (opens
   * a pane, prints a wide table) can suit the room it has: the fullscreen
   * layout docks a pane beside the transcript from 110 columns, the main
   * screen places it inline above the prompt at any width.
   */
  export type CommandPresentation = {
      /**
       * True under the fullscreen (alternate-screen) layout; false on the main
       * screen (`CLAUDE_CODE_NO_FLICKER=0`, tmux by default) and headless.
       *
       * The fact `RenderViewport`'s `isFullscreen` carries on every terminal
       * drawing, from the same source: the two agree.
       */
      isFullscreen: boolean;
      /**
       * The terminal's width in cells as the command runs; 80 where no terminal
       * has measured (headless with no tty).
       */
      columns: number;
  };

  /**
   * `command.run`'s input as a plugin's `$.command.run` takes it: `args` may
   * be left out (`/command`, bare); `origin` and `presentation` the engine sets.
   */
  export type CommandRunArgs = Omit<CommandRunInput, 'origin' | 'args' | 'presentation'> & {
      /**
       * Everything after the name, as the person would type it; left out, `""`.
       */
      args?: string;
  };

  /**
   * The input of `command.run`: one slash command about to run, the way the
   * person typed it (`/name args`), and where the run came from.
   */
  export type CommandRunInput = {
      /**
       * Names the command without its slash (`compact`, `hello`), aliases and
       * folds resolved; the key a matcher narrows on. A rewrite is refused.
       */
      command: string;
      /**
       * Everything after the name, as typed (`""` when nothing was); a hook
       * rewrites it with `next({ ...e, args })`.
       */
      args: string;
      /**
       * Where the run came from, in `prompt.submit`'s words (PromptOrigin):
       * the person's Enter (`composer`), the bridge, the SDK, or a plugin.
       *
       * A plugin's `$.command.run` reads `{ kind: 'plugin', name }`. `next(e)`
       * passes it on as received.
       */
      origin: PromptOrigin;
      /**
       * Where the command's answer will show (CommandPresentation): the
       * fullscreen layout or the main screen, and the terminal's width.
       *
       * Pinned: the engine stamps it, `next(e)` passes it on, a rewrite that
       * leaves it out keeps it and one that changes it is refused.
       */
      presentation: CommandPresentation;
  };

  /**
   * What a `command.run` hook returns and what `next(e)` and `$.command.run`
   * resolve to: the command's output text and the notes it leaves the model.
   *
   * From core, `text` is what the command printed (a `local` command's
   * returned text; a panel command may print nothing), `context` what it
   * recorded for the model beside that, and `ref` names the run.
   *
   * A hook's own answer without `next` runs no command: its `text` is shown
   * as the command's output, under the names of the plugins hooking the
   * command unless each is bundled with Claude Code, whose answer reads as
   * the built-in command's own, and its `context` is recorded after it.
   *
   * Both are the plugin's to size, as a core command's output is; what bounds
   * them is what bounds any transcript row where a surface draws it.
   */
  export type CommandRunResult = {
      /**
       * The command's output as a transcript line, or undefined when the
       * command showed nothing as text (a panel, a prompt for the model).
       */
      text?: string;
      /**
       * What the model reads after the command's output and the person never
       * sees, each entry one hidden user message recorded after the output row.
       *
       * From core, the notes the command left the model, absent when none. Kept
       * whole from `next`: left out after `next`, the last answer's notes ride
       * along; written, it keeps every entry that answer had (none empty).
       */
      context?: readonly string[];
      /**
       * Set by core on what `next(e)` resolves to: names the engine's run of
       * the command (its result stays on the host side).
       *
       * A hook that returns the object it got makes the engine use that run
       * verbatim. Absent on a hook's own `{ text }` and on `$.command.run`'s.
       */
      ref?: number;
  };

  /**
   * Where a slash command comes from, as `$.command.list()` tells them apart.
   *
   * `builtin` ships with Claude Code; `plugin` is a plugin's markdown command,
   * skill or `$.command.register`; `user` is the user's or project's own
   * file; `mcp` an MCP server's prompt.
   */
  export type CommandSource = 'builtin' | 'plugin' | 'user' | 'mcp';

  /**
   * What `$.command.register` takes: the slash command this plugin serves.
   */
  export type CommandSpec = {
      /**
       * The command's name without the slash (letters, digits, `_`, `-`; up to
       * 64); the person runs it as `/<name>`.
       */
      name: string;
      /**
       * The one line the typeahead and `/help` show for it.
       */
      description: string;
      /**
       * The hint drawn dim after the name (`[name]`), when it takes arguments.
       */
      argumentHint?: string;
      /**
       * Set so that `/<name>` typed while a turn is in flight runs at once
       * instead of waiting for the turn to end, as it does when left out.
       *
       * Its `command.run` hook then runs while a turn may still be streaming and
       * must not assume the turn's state (what the transcript holds, whether a
       * tool is mid-call); its `{ text }` prints as an idle run's does.
       */
      immediate?: true;
  };

  type ConfigChangeHookInput = BaseHookInput & {
      hook_event_name: 'ConfigChange';
      source: 'user_settings' | 'project_settings' | 'local_settings' | 'policy_settings' | 'skills';
      file_path?: string;
  };

  /**
   * The input of `config.describe`: how one `/config` row presents, at the
   * moment the menu lists it (and for `$.config.list`).
   */
  export type ConfigDescribeInput = {
      /**
       * Names the row, as `config.set`'s `key` does; the key a matcher narrows
       * on. Pinned: a rewrite is refused.
       */
      key: string;
      /**
       * What the menu draws for the row, before its value.
       */
      label: string;
      /**
       * The help text beneath the label, when the row has one (a plugin
       * field's `description`); absent for the panel's own rows.
       */
      description?: string;
      /**
       * Whether the menu leaves the row out; a hidden row still answers
       * `$.config.set` and `/config key=value`.
       */
      isHidden: boolean;
      /**
       * Who owns the row, as `config.set`'s `provider`. Pinned.
       */
      provider: Origin;
  };

  /**
   * What a `config.describe` hook returns: the label, help text and hidden
   * flag the menu uses; the key and provider stay as they were.
   */
  export type ConfigDescribeResult = Omit<ConfigDescribeInput, 'key' | 'provider'>;

  /**
   * How a `/config` row takes its value: `boolean` toggles, `choice` picks one
   * of its `options`, `text` takes a string, `number` a number.
   */
  export type ConfigKind = 'boolean' | 'choice' | 'text' | 'number';

  /**
   * Where a `config.set` came from, in `prompt.submit`'s words: the person
   * in the `/config` menu (`composer`), the bridge, or a plugin, named.
   *
   * Set by the engine; `next(e)` passes it on as received and none sets it.
   */
  export type ConfigOrigin = {
      /**
       * The person's own change in the `/config` menu (a toggle, a pick, a
       * typed value), or their `/config key=value`.
       */
      kind: 'composer';
  } | {
      /**
       * A `/config key=value` that arrived over the Remote Control bridge (a
       * phone or web client, or a relay): not attestably the owner's hand.
       */
      kind: 'bridge';
  } | {
      /**
       * A plugin's `$.config.set`; that plugin's own hooks do not see it.
       */
      kind: 'plugin';
      /**
       * The calling plugin's name.
       */
      name: string;
  };

  /**
   * One `/config` row as `$.config.list()` returns it: what the menu would
   * draw now, after every `config.describe` hook, a hidden row left out.
   */
  export type ConfigRow = {
      /**
       * Names the row: the panel's id for a built-in, `<plugin>.<field>` for a
       * plugin's `userConfig` field; what `$.config.set` takes.
       */
      key: string;
      /**
       * What the menu draws for the row, before its value.
       */
      label: string;
      /**
       * The help text under the label, when the row has one.
       */
      description?: string;
      /**
       * How the row takes its value (ConfigKind).
       */
      kind: ConfigKind;
      /**
       * What the row holds now.
       */
      value: ConfigValue;
      /**
       * The values a `choice` row takes, in order (a plugin string field's
       * declared `options` for its row); absent otherwise.
       */
      options?: readonly string[];
      /**
       * Who owns the row: the engine for the panel's own, else the plugin.
       */
      provider: Origin;
      /**
       * Whether a trusted source (managed settings, the organization's policy)
       * owns the value, so the menu shows it and refuses a change.
       */
      isLocked: boolean;
  };

  /**
   * `config.set`'s input as a plugin's `$.config.set(args)` takes it: the
   * row's key and the value; the engine fills the rest.
   */
  export type ConfigSetArgs = Pick<ConfigSetInput, 'key' | 'value'>;

  /**
   * The input of `config.set`: one `/config` row about to change, from the
   * menu or a plugin's `$.config.set`, with what it holds now and who owns it.
   */
  export type ConfigSetInput = {
      /**
       * Names the row: the panel's own id for a built-in (`theme`, `verbose`,
       * `autoCompact`), `<plugin>.<field>` for a plugin's `userConfig` field.
       *
       * The key a matcher narrows on; pinned: a rewrite is refused.
       */
      key: string;
      /**
       * What the row is being set to; `next({ ...e, value })` clamps or
       * replaces it, held to the row's kind (a toggle takes a boolean).
       */
      value: ConfigValue;
      /**
       * What the row holds before the change, as the menu shows it. Pinned.
       */
      previous: ConfigValue;
      /**
       * Who owns the row: `{ plugin: "engine", tier: "core" }` for the panel's
       * own, the plugin and its tier for a `userConfig` field. Pinned.
       */
      provider: Origin;
      /**
       * Where the change came from (ConfigOrigin): the person in the menu
       * (`composer`) or a plugin's `$.config.set`. Pinned.
       */
      origin: ConfigOrigin;
  };

  /**
   * What a `config.set` hook returns and what `next(e)` resolves to:
   * `{ value }` once written, or `{ deny: reason }`, the row left as it was.
   *
   * The menu shows a deny's reason beside the row; a plugin's `$.config.set`
   * resolves with it.
   */
  export type ConfigSetResult = {
      value: ConfigValue;
      deny?: undefined;
  } | {
      deny: string;
      value?: undefined;
  };

  /**
   * A `/config` row's value as a hook and `$.config` see it: a toggle's
   * boolean, a choice's or a text's string, a number, or a list of strings.
   */
  export type ConfigValue = boolean | string | number | readonly string[];

  /**
   * One custom agent whose description the Agent tool's prompt carries;
   * built-in agents are left out.
   */
  export type ContextAgent = {
      /**
       * The agent's type, as the Agent tool names it.
       */
      agentType: string;
      /**
       * Where it was defined, by the engine's word (`projectSettings`,
       * `userSettings`, `plugin`); the display label is the renderer's.
       */
      source: string;
      /**
       * The description's estimated tokens.
       */
      tokens: number;
  };

  /**
   * The token counts the last API response of the live window reported, as
   * the API spells them; the breakdown's `Messages` row is reconciled to it.
   */
  export type ContextApiUsage = {
      /**
       * Uncached input tokens the response was answered over.
       */
      input_tokens: number;
      /**
       * Tokens the response generated.
       */
      output_tokens: number;
      /**
       * Input tokens written to the prompt cache by the request.
       */
      cache_creation_input_tokens: number;
      /**
       * Input tokens read from the prompt cache by the request.
       */
      cache_read_input_tokens: number;
  };

  /**
   * How a context breakdown is counted: `full` with the token-count API per
   * category, `summary` from the last response's usage and local estimates.
   *
   * The SDK's `get_context_usage` takes the same two words as its `detail`.
   */
  export type ContextBreakdownDetail = 'summary' | 'full';

  /**
   * One row of the breakdown, as /context lists it beside the grid (`System
   * prompt`, `Messages`, `Free space`, `Autocompact buffer`).
   */
  export type ContextCategory = {
      /**
       * The row's label as /context prints it.
       */
      name: string;
      /**
       * The row's estimated tokens; a `deferred` row's do not count toward the
       * total.
       */
      tokens: number;
      /**
       * The theme colour /context draws the row and its squares in, by its key
       * in the theme (`promptBorder`, `inactive`, `permission`).
       */
      color: string;
      /**
       * Whether the row is tool schemas loaded on demand, which the grid leaves
       * out; the same fact as `kind` `deferred`.
       */
      isDeferred: boolean;
      /**
       * What the row is (ContextCategoryKind), stamped by the engine.
       */
      kind: ContextCategoryKind;
  };

  /**
   * What a breakdown row is; branch on this, never on the row's `name`.
   *
   * `used` content occupies the window, `free` is the window left, `buffer`
   * the compaction reserve, `deferred` tool schemas loaded on demand and
   * outside the window.
   */
  export type ContextCategoryKind = 'used' | 'free' | 'buffer' | 'deferred';

  /**
   * One square of the grid /context draws: which row it belongs to and how
   * full it is.
   */
  export type ContextGridSquare = {
      /**
       * The theme colour of the square's row, by its key in the theme.
       */
      color: string;
      /**
       * Whether the square holds any of its row's tokens.
       */
      isFilled: boolean;
      /**
       * The `name` of the row the square belongs to (`Free space` for the
       * window left).
       */
      categoryName: string;
      /**
       * The row's tokens, repeated on each of its squares.
       */
      tokens: number;
      /**
       * The row's share of the window as a whole percentage, repeated likewise.
       */
      percentage: number;
      /**
       * How full this one square is, 0 to 1: a row's last square is the partial
       * one (/context draws it hollow under 0.7).
       */
      squareFullness: number;
  };

  /**
   * One MCP tool's schema as the context carries it.
   */
  export type ContextMcpTool = {
      /**
       * The tool's wire name (`mcp__linear__create_issue`).
       */
      name: string;
      /**
       * The server it belongs to, as /mcp lists it.
       */
      serverName: string;
      /**
       * The schema's estimated tokens.
       */
      tokens: number;
      /**
       * Whether the schema is inside the window now: always, unless tool
       * schemas load on demand and this one has not been searched for yet.
       */
      isLoaded: boolean;
  };

  /**
   * One memory file the context carries (a CLAUDE.md, a rules file, an
   * auto-memory entry).
   */
  export type ContextMemoryFile = {
      /**
       * The file's path, absolute.
       */
      path: string;
      /**
       * The display label of where it was loaded from (`Project`, `User`,
       * `Local`, `Managed`, `AutoMem`).
       */
      type: string;
      /**
       * The file's estimated tokens.
       */
      tokens: number;
  };

  /**
   * One skill whose listing the context carries.
   */
  export type ContextSkill = {
      /**
       * The skill's name as `/skills` lists it.
       */
      name: string;
      /**
       * Where it came from, by the engine's word (`userSettings`, `plugin`,
       * `built-in`, `mcp`, `syncedSkills`); the display label is the renderer's.
       */
      source: string;
      /**
       * The providing plugin's name, when the skill comes from one.
       */
      pluginName?: string;
      /**
       * The listing's estimated tokens.
       */
      tokens: number;
  };

  /**
   * The skills the context lists for the model: how many there are, how many
   * fit the listing's budget, and each one's share.
   */
  export type ContextSkills = {
      /**
       * How many skills the session has.
       */
      totalSkills: number;
      /**
       * How many the listing included within its token budget.
       */
      includedSkills: number;
      /**
       * The listing's tokens in all.
       */
      tokens: number;
      /**
       * One entry per listed skill.
       */
      skillFrontmatter: ContextSkill[];
  };

  /**
   * The slash commands the Skill tool's prompt lists, counted.
   */
  export type ContextSlashCommands = {
      /**
       * How many commands the session has.
       */
      totalCommands: number;
      /**
       * How many the listing included.
       */
      includedCommands: number;
      /**
       * The listing's tokens in all.
       */
      tokens: number;
  };

  /**
   * How the window the breakdown measures against was settled; /context
   * prints its `Auto-compact window` line off this.
   *
   * `auto` is the model's own limit; the rest name a compaction window by who
   * set it: the `CLAUDE_CODE_AUTO_COMPACT_WINDOW` variable, the settings, the
   * account, an experiment, the model's default, or an unrecognised model's.
   */
  export type ContextWindowSource = 'env' | 'settings' | 'clientdata' | 'experiment' | 'model-default' | 'unknown-model' | 'auto';

  /**
   * The plugin's identity (`plugin`) and the nouns core contributes to `$` as
   * the innermost step of the `engine.create` fold.
   *
   * A plugin's finished `$` (EngineInterface) has every core noun an outer
   * step did not withhold, and every noun the plugins' steps added.
   */
  export interface CoreEngineInterface {
      /**
       * This plugin, as loaded: its manifest name and its directory.
       */
      plugin: {
          /**
           * From plugin.json; debug-log and `$.ui.log` lines carry it.
           */
          name: string;
          /**
           * The plugin's directory (the one holding plugin.json), absolute.
           */
          root: string;
      };
      /**
       * Display: a line under an open dialog, a redraw or a repaint, a
       * transcript or debug line, panes the surface places, a window or ring.
       */
      ui: {
          /**
           * Shows `text` as one line under the dialog open for `tool_use_id`, or
           * removes the line when `text` is undefined.
           *
           * Core removes the line when the call resolves. A call that is not open
           * is refused, as is another plugin's `$.tool.call` run.
           *
           * @param tool_use_id the call whose open dialog gets the line
           * @param text the line to show; undefined removes it
           * @example
           * $.ui.notice(e.tool_use_id, "checked by my-plugin"); return next(e)
           */
          notice: (tool_use_id: string, text: string | undefined) => void;
          /**
           * Re-runs an event whose results the engine caches: `ui.render` draws the
           * instances this plugin may draw again; the others drop the cached answers.
           *
           * A render hook whose state changed (a countdown) calls it for a redraw, at
           * most ten a second, thirty for the shown pane and the band (calls sooner
           * fold); a prompt section, context or attachment hook: dropped next turn.
           *
           * @param event `ui.render`, or a cached-answer event: `prompt.section`,
           *   `prompt.context`, `prompt.attachment`, `tool/command/config.describe`
           */
          invalidate: (event: InvalidatableEventName) => void;
          /**
           * Repaints a mounted `Raster` this plugin's own render hook drew with new
           * cells, or swaps a keyed `Image` it drew to a new source; no redraw.
           *
           * The surface paints the cells or source at its next frame, so blits
           * between frames fold into one: up to 120 a second taken, some sixty
           * shown. An Image swap sends one small command; a resize is a redraw.
           *
           * @param args `requestId` (the site), `key`, and `cells` (RasterProps) or
           *             `source` (ImageSource); `columns`, `rows` (the mounted size)
           * @returns `{}` once the cells or source are its next frame, or `{ deny }`
           *          (not mounted, not this plugin's, another size, cells that do
           *          not decode, a bad source, or an Image drawing its alt there:
           *          no placeholder images, or a file this terminal cannot read)
           * @example
           * $.clock.every(33, () => $.ui.blit({ requestId, key, cells: frame() }))
           * @example
           * await $.ui.blit({ requestId: 'browser', key: 'view',
           *   source: { shm: name, format: 'rgb', width, height } })
           */
          blit: (args: UiBlitArgs) => Promise<UiBlitResult>;
          /**
           * The elements of the surface `e` is drawn on (Elements[e.surface]): a
           * frozen table of constructors, the JSX tags a render hook draws with.
           *
           * A read, not a dispatch: the engine ran `ui.resolve` (the other hooks,
           * then core) at load, per surface and component. Narrowed `e.surface`:
           * that table exactly; unnarrowed: the union, so shared names type-check.
           *
           * @param e this hook's own `ui.render` argument (its surface and
           *          component pick the table)
           * @returns the surface's frozen element table (`Elements[e.surface]`)
           * @example
           * const { Box, Text } = $.ui.resolve(e)
           * return <Box>{await next(e)}<Text dimColor>done</Text></Box>
           */
          resolve: <E extends ResolveInput>(e: E) => Elements[E['surface']];
          /**
           * Appends one line to the transcript, drawn like a system notice (dim;
           * not sent to the model), or with `{ to: "debug" }` to the debug log alone.
           *
           * A row of its own at the next frame, in logging order; a `-p` or SDK
           * host receives it as `ui_log`; the debug log has every line under this
           * plugin's name. Raised as `ui.log`: a hook above may rewrite `e.to`.
           *
           * @param text the line's text
           * @param options `to`: `transcript` (the default) or `debug`
           * @example
           * $.ui.log(`prompt from ${e.origin.kind}: ${e.text.length} chars`)
           * @example
           * $.ui.log(`cache miss for ${e.tool_use_id}`, { to: "debug" })
           */
          log: (text: string, options?: UiLogOptions) => void;
          /**
           * Asks the user `question` in the engine's own AskUserQuestion dialog and
           * resolves to the label they chose, or the text typed under "Other".
           *
           * A `tool.call` of `AskUserQuestion` through every hook but the calling
           * one, drawn by `ui.render` on `AskUserQuestion`; a multi-select answer is
           * comma-joined. Rejects when dismissed, and in a `-p` run (no one to ask).
           *
           * @param question the question, ending in a question mark
           * @param options 2-4 option labels, or `{ options, header, multiSelect }`
           * @returns the label chosen, the chosen labels comma-joined, or free text
           *          typed under "Other" (so compare it with the labels exactly)
           * @example
           * const mood = await $.ui.ask("How careful?", ["Bold", "Careful"])
           */
          ask: (question: string, options?: readonly string[] | AskOptions) => Promise<string>;
          /**
           * Shows `text` on the notification bar under the prompt for a few
           * seconds, the way the engine's own "context left" notice appears.
           *
           * It leaves the transcript and the model untouched.
           *
           * @param text the line to show; an unpaired surrogate half in it is drawn
           *   as U+FFFD
           * @param options `timeoutMs`: how long it stays (default 4000)
           * @example
           * $.ui.toast(`turn took ${Math.round(e.durationMs / 1000)} s`)
           */
          toast: (text: string, options?: ToastOptions) => void;
          /**
           * Pins `text` as this plugin's status line under the prompt, beside the
           * engine's own pinned notices, until the next call replaces it.
           *
           * One per plugin; `undefined` removes it.
           *
           * @param text the line to keep on screen (an unpaired surrogate half is
           *   drawn as U+FFFD); undefined clears it
           * @example
           * $.ui.status("thinking..."); return next(e)
           */
          status: (text: string | undefined) => void;
          /**
           * Opens a pane: a framed region the surface places, whose body this
           * plugin draws by hooking `ui.render` for `{ component: "Pane" }`.
           *
           * One instance per id (`requestId`): opening an open id retitles it; a hook
           * on `ui.open` may refuse it. The keyboard is the person's; unasked, it
           * waits undrawn below 144 columns (110 once asked), judged at each open.
           *
           * @param pane `id` (1-64 of letters, digits, `_`, `-`), `title`, `focus`,
           *   `closeOnEscape` and `holdToasts` (a dialog), `rows` / `columns` wanted
           * @returns settles once the pane is open (or retitled)
           * @example
           * await $.ui.open({ id: "clock", title: "Clock" })
           * @example
           * await $.ui.open({ id: "ask", focus: true, closeOnEscape: true, rows: 9 })
           */
          open: (pane: PaneOpenArgs) => Promise<void>;
          /**
           * Closes one of the open panes; an id that is not open is left alone.
           *
           * Every close raises `ui.close`, `e.origin` naming whose it is: this call
           * (`plugin`), the person's mark or key (`person`), an unload (`unload`).
           * A hook answering without `next` keeps the pane open, save on an unload.
           *
           * @param pane `id`: the id the pane was opened under
           * @returns settles once the pane is gone or a hook answered for it;
           *          rejects on a hook's `{ deny }`
           * @example
           * onPress: () => $.ui.close({ id: "clock" })
           */
          close: (pane: PaneCloseArgs) => Promise<void>;
          /**
           * Lists this plugin's own open panes (UiPane): each one's id and title,
           * and whether it is shown, holds the keyboard, and is placed.
           *
           * The engine's record, not the module's: a module reloaded while its
           * pane stayed up finds it here. Another plugin's panes are not listed.
           *
           * @returns the panes in open order, placed ones first; empty with none
           * @example
           * const isUp = (await $.ui.panes()).some(pane => pane.id === "clock")
           * if (!isUp) await $.ui.open({ id: "clock", title: "Clock" })
           */
          panes: () => Promise<readonly UiPane[]>;
          /**
           * Scrolls something into view as the DOM's `scrollIntoView` would: a
           * render instance by `requestId`, an element by `key`, a site's edge.
           *
           * A site of this plugin's (its pane, the band it draws into) moves under
           * the event `ui.scroll`, origin `plugin`. A transcript row moves only
           * while this call answers the person's own input, where one scrolls.
           *
           * @param args `to` (what), `in` (which site, required for `start` and
           *             `end`), `block` (where it lands; `nearest` by default)
           * @returns `{}` once it moved, or `{ deny }` saying why not
           * @example
           * onPress: () => $.ui.scroll({ in: "log", to: "end" })
           */
          scroll: (args: UiScrollArgs) => Promise<UiScrollResult>;
          /**
           * Moves the focus ring of one of this plugin's sites onto an element it
           * drew there, as the DOM's `element.focus()`, while it holds the keys.
           *
           * Raised as the event `ui.focus`, origin `plugin`; the engine's inverse
           * marks the element. The keyboard is the person's to give: a site not
           * holding it, or holding it on another plugin's element, is `{ deny }`.
           *
           * @param args `requestId` (which site: a pane's id, the band's) and `key`
           *             (the element's, as drawn)
           * @returns `{}` once it moved, or `{ deny }` saying why not
           * @example
           * onPress: () => $.ui.focus({ requestId: "files", key: "row:0" })
           */
          focus: (args: UiFocusArgs) => Promise<UiFocusResult>;
      };
      /**
       * Completions through the session's own client and credentials.
       */
      model: {
          /**
           * Runs one text completion through the session's own API client and
           * resolves to the reply's text.
           *
           * No tools, no history, no system prompt beyond the CLI's identity block
           * and `request.system`.
           *
           * @param request the model (an alias such as `haiku`, or a full id,
           *   resolved like a `--model` value), the prompt, and a token cap
           * @returns the reply's text
           * @example
           * const reply = await $.model.complete({ model: "haiku", prompt: "Hi." })
           */
          complete: (request: ModelCompleteRequest) => Promise<string>;
          /**
           * Runs one tool-less completion over the session's OWN transcript, sharing
           * the main thread's prompt cache; the reply's text and the fork's usage.
           *
           * Not `complete`: sharing the cache prefix means the model and system
           * prompt are the session's, read from its last turn's cache-safe snapshot,
           * and tools are denied. Null on a cold snapshot or an API error.
           *
           * @param request the one user message the fork answers
           * @returns the reply's text with the fork's usage, or null on a cold
           *          snapshot or an API error
           * @example
           * const reply = await $.model.fork({ prompt: "One line to learn?" })
           * if (reply !== null) $.ui.log(`${reply.usage.output_tokens} tokens`)
           */
          fork: (request: ModelForkRequest) => Promise<ModelForkResult | null>;
          /**
           * Picks one of `labels` for `text` with one completion over
           * `$.model.complete` and a fixed classifier prompt.
           *
           * `text` is data; the model answers with a label alone. It resolves
           * `undefined` when the answer named none of `labels`. A failed request,
           * an abort or a reply with no text rejects, naming the cause.
           *
           * @param text what to classify
           * @param labels the labels to choose from (2 or more)
           * @param options `model`: an alias or id; default the engine's small
           *   fast model
           * @returns the label the model named, or undefined when it named none;
           *          rejects when the request fails or the reply has no text
           * @example
           * const kind = await $.model.classify(e.text, ["bug", "feature"])
           * if (kind === undefined) return next(e)
           */
          classify: (text: string, labels: readonly string[], options?: ClassifyOptions) => Promise<string | undefined>;
      };
      /**
       * Sound: clip playback and platform speech.
       */
      audio: {
          /**
           * Plays one audio clip, starting now; clips are not queued, so two calls
           * play together (a bed under speech).
           *
           * `{ asset }` is the plugin's own file, loaded by the engine and played
           * through the platform's player (`afplay` on macOS). Resolves when
           * playback ends; rejects, naming the cause, when the clip cannot play.
           *
           * @param clip the plugin's own file (`{ asset }`), a URL the engine
           *   fetches, or the bytes as base64 with their MIME type
           * @param options `shouldLoop`, `gain`, and an AbortSignal that stops the
           *   clip
           */
          play: (clip: AudioClip, options?: PlayOptions) => Promise<void>;
          /**
           * Speaks `text` with the platform's own synthesizer (`say` on macOS).
           * Plain text.
           *
           * Utterances are queued among themselves; clips are not. Resolves when
           * the utterance has ended; rejects, naming the cause, when there is no
           * synthesizer, the voice is not installed, or the utterance failed.
           *
           * @param text what to say, as plain text
           * @param options `voice`: the system voice's exact name (`Samantha`);
           *   absent, the synthesizer's default
           * @returns which synthesizer spoke, once the utterance has ended
           */
          speak: (text: string, options?: SpeakOptions) => Promise<SpeakResult>;
      };
      /**
       * The engine's connected MCP servers.
       */
      mcp: {
          /**
           * Calls `tool` on one of the engine's connected MCP servers with the
           * engine's own connection and credentials.
           *
           * A `cached` server is dialed on first use. No permission prompt: the
           * plugin's call, seen by the hooks above it, is the grant. Positional, not
           * the `{ tool: "mcp__server__tool", ... }` shape a `tool.call` hook sees.
           *
           * @param server the server's name as /mcp lists it (`claude.ai Gmail`;
           *   the tool-name spelling `claude_ai_Gmail` is accepted too)
           * @param tool the tool's name on that server (`create_draft`)
           * @param args the tool's arguments; none when absent
           * @returns the tool's result as MCP returns it: `content` blocks and
           *          `isError`
           * @example
           * const { content } = await $.mcp.call("claude.ai Gmail", "create_draft", {
           *   to: "team@example.com",
           *   subject: "Release notes",
           * })
           */
          call: (server: string, tool: string, args?: Record<string, unknown>) => Promise<McpToolResult>;
      };
      /**
       * The running session, read as plain data, and compacting it.
       */
      session: {
          /**
           * Returns the transcript so far, one entry per user or assistant
           * message; progress rows, `$.ui.log` lines and notices are not messages.
           *
           * Each entry is a SessionMessage, `{ role, text, toolUses }` (a user
           * message may add `toolResults`; a `toolUses` entry adds its `result` and
           * `text` once answered). A long transcript answers its newest 4096.
           *
           * @example
           * const last = (await $.session.messages()).at(-1)
           */
          messages: () => Promise<SessionMessage[]>;
          /**
           * Returns the directory the session runs in, absolute.
           */
          cwd: () => Promise<string>;
          /**
           * Returns the session's project root, absolute: where it started, or
           * where `/cd`, a host's directory change or a worktree move took it.
           *
           * A shell `cd` during the session does not move it; nested instruction
           * files are read only beneath it.
           */
          root: () => Promise<string>;
          /**
           * Returns the main loop's model, as `/model` shows it.
           */
          model: () => Promise<string>;
          /**
           * Returns how many prompts the user has sent this session (user turns in
           * the transcript).
           */
          turns: () => Promise<number>;
          /**
           * Returns the session's id (the transcript file's name).
           */
          id: () => Promise<string>;
          /**
           * Returns the git repository the session runs in, read from the working
           * copy on each call; null when the directory is not inside one.
           *
           * @example
           * const repo = await $.session.repo(); const publicRepo = !repo?.internal
           */
          repo: () => Promise<SessionRepo | null>;
          /**
           * Returns every surface the session draws on, each once: `terminal` under
           * the REPL first, then the remote ones in the order they attached.
           *
           * A session may draw on several at once (a terminal and two phones):
           * clients attach (`session.attach`) and detach, and a render hook still
           * reads `e.surface` per ask. Empty in a plain -p run; never rejects.
           *
           * @example
           * const inApp = (await $.session.surfaces()).some(s => s !== "terminal")
           */
          surfaces: () => Promise<readonly RenderSurface[]>;
          /**
           * Returns the first of `$.session.surfaces()`, or null where nothing
           * draws.
           *
           * @deprecated use `surfaces()`; a session may draw on several surfaces at
           *             once
           */
          surface: () => Promise<RenderSurface | null>;
          /**
           * Returns the context window's fill, the rate-limit windows and the
           * cost, as the status line has them; with `breakdown`, by category too.
           *
           * The plain call costs nothing; `"full"` counts each category with the
           * token-count API as /context does, `"summary"` estimates locally, and
           * `context.breakdown` comes back in the SDK's `get_context_usage` shape.
           *
           * @param args `{ breakdown, columns }`: how the breakdown is counted and
           *   the width its grid is drawn in; nothing for the status line's figures
           * @returns `{ context, rateLimits, cost }` as the status line has them
           * @example
           * const { context } = await $.session.usage()
           * if ((context.percent ?? 0) >= 85) await $.session.compact()
           * @example
           * const usage = await $.session.usage({ breakdown: "full", columns })
           * for (const row of usage.context.breakdown?.gridRows ?? []) draw(row)
           */
          usage: (args?: SessionUsageArgs) => Promise<SessionUsage>;
          /**
           * Compacts the conversation: the event `session.compact` with `trigger`
           * `plugin`, the same call `/compact` makes, between turns.
           *
           * It runs through every hook but the calling one, then core: a summary
           * and the kept messages in the transcript's place. Resolves `{ skip }`
           * when a hook vetoed it; rejects while a turn runs.
           *
           * @example
           * const { skip } = await $.session.compact({ instructions: "the plan" })
           */
          compact: EventCalls['session']['compact'];
          /**
           * Holds the session's Anthropic credential on the host and answers an
           * opaque handle and its kind; the secret never reaches the plugin.
           *
           * The handle is spent through `$.http.fetch(url, { auth: handle })`,
           * which sets the credential header, only for a first-party host. Null
           * where the build or the provider has no first-party credential to hold.
           *
           * @example
           * await $.http.fetch(url, { auth: (await $.session.authorize())?.handle })
           */
          authorize: () => Promise<SessionAuthorization>;
      };
      /**
       * The running model turn: ending it.
       */
      turn: {
          /**
           * Cancels the running model turn: the one whose id `turn.start` handed
           * this plugin, its running tools stopped, no interruption marker.
           *
           * The event `turn.abort`, seen by the hooks above; the prompt this
           * plugin submits next is the context. Rejects, naming both ids, when
           * `turnId` is not the running turn's; a hook may end its own turn.
           *
           * @param input `turnId`: the id `turn.start` carried
           * @example
           * on("turn.start", ($, e, next) => { held = e.turnId; return next(e) })
           */
          abort: (input: OpEventOf['turn.abort']) => Promise<void>;
      };
      /**
       * Submitting a prompt the model reads as a user turn, and the person's
       * prompt box: read as it stands, written, or proposed into.
       */
      prompt: {
          /**
           * Submits a prompt: the event `prompt.submit`, the same call the engine
           * makes for a typed prompt; `input.text` runs when the session is idle.
           *
           * It goes through every hook but the calling one (the plugin's others
           * see it) with `e.origin` `{ kind: 'plugin', name }`, the name the
           * model reads it under unless a hook leaves it out of its answer.
           *
           * @example
           * void $.prompt.submit({ text: "List the TODOs you just mentioned." })
           */
          submit: EventCalls['prompt']['submit'];
          /**
           * Returns the prompt box as it stands, the draft typed so far and the
           * cursor's offset into it, so a `fill` can keep what the person typed.
           *
           * Never rejects: `{ text: '', cursor: 0 }` where the session draws no box
           * (a -p run, an SDK host) or none is mounted yet.
           *
           * @example
           * const { text, cursor } = await $.prompt.read()
           */
          read: () => Promise<PromptBox>;
          /**
           * Puts `input.text` in the prompt box as the draft, by `mode`: `replace`
           * (the default) over it, `append` after it, `insert` at the cursor.
           *
           * The event `prompt.fill` through the other plugins' hooks; `isFilled:
           * false` under a dialog or headless. To hand the model text WITH the next
           * prompt instead, a `prompt.submit` hook adds `context` (second example).
           *
           * @example
           * await $.prompt.fill({ text: `> ${quote}\n`, mode: "insert" })
           * @example
           * ($, e, next) => next({ ...e, context: [...(e.context ?? []), hunk] })
           */
          fill: (input: PromptFillArgs) => Promise<PromptFilled>;
          /**
           * Proposes `input.text` as the prompt box's dim suggestion, Tab to take:
           * the event `prompt.suggest`, as the engine's own guess after a turn.
           *
           * It goes through every other plugin's hook with `e.origin` `{ kind:
           * 'plugin', name }`, the engine's own suggestions on or off; `{ isShown:
           * false }` while the box holds text, a turn runs, or headless (no box).
           *
           * @example
           * void $.prompt.suggest({ text: "run the tests you just wrote" })
           */
          suggest: EventCalls['prompt']['suggest'];
      };
      /**
       * The tools the model has in this session, and running one.
       */
      tool: {
          /**
           * Returns the tools the model can call now, built-in and MCP alike, in
           * the order the model sees them.
           *
           * @example
           * const names = (await $.tool.list()).map(t => t.name)
           */
          list: () => Promise<ToolInfo[]>;
          /**
           * Calls a tool: the event `tool.call`, the same call the engine makes for
           * the model's tool calls, under a `tool_use_id` of its own.
           *
           * It runs through every hook but the calling one (the plugin's others
           * see it), the permission check and its dialog, then the tool. Rejects
           * when no tool has that name or the call is aborted.
           *
           * @example
           * const { text } = await $.tool.call({ tool: "Read", file_path: "a.md" })
           */
          call: EventCalls['tool']['call'];
          /**
           * Asks the engine's permission decision for a tool call now: the event
           * `tool.check`, resolved to `{ decision, reason?, rule? }`.
           *
           * The hooks run (the calling hook's own frame skipped, `next.origin` this
           * plugin, no `tool_use_id`); nothing runs, no dialog opens, no PreToolUse
           * hook or classifier is asked.
           *
           * @example
           * const { decision } = await $.tool.check({ tool: "Read", input })
           */
          check: EventCalls['tool']['check'];
          /**
           * Declares a tool the model can call from the next prompt on: the name,
           * description and input schema of `mcp__<plugin>__<name>`.
           *
           * Serve it with a `tool.call` hook on `{ tool: "mcp__<plugin>__<name>" }`
           * that returns the result (a call no hook answers fails); a name registered
           * again is replaced. Rejects until the session binds, at `session.start`.
           *
           * @param tool `name`, `description` (what the model reads), `inputSchema`
           *             (a JSON schema object; default `{ type: "object" }`)
           * @returns `{ tool }`, the registered tool's full name
           *          `mcp__<plugin>__<name>`
           * @example
           * await $.tool.register({ name: "weather", description: "Weather." })
           */
          register: (tool: ToolSpec) => Promise<OpValueOf['tool.register']>;
      };
      /**
       * The slash commands the person can run in this session, and running one.
       */
      command: {
          /**
           * Returns the slash commands the person can run now, built-in, plugin
           * and MCP alike, in the order the typeahead lists them.
           *
           * @example
           * const names = (await $.command.list()).map(c => c.name)
           */
          list: () => Promise<CommandInfo[]>;
          /**
           * Runs a slash command as if the person typed `/command args`: the
           * event `command.run`, queued and run once the session is idle.
           *
           * It runs through every hook but the calling one with `e.origin`
           * `{ kind: 'plugin', name }`, its lines in the transcript. Rejects an
           * unknown name, and inside a hook the turn is waiting on.
           *
           * @example
           * const { text } = await $.command.run({ command: "status" })
           */
          run: EventCalls['command']['run'];
          /**
           * Declares the slash command `/<name>` for this session, listed in the
           * typeahead from the next keystroke on.
           *
           * Serve it with a `command.run` hook on `{ command: "<name>" }` that
           * returns `{ text }`; a run no hook answers says so as its output.
           * Registering a name again replaces it; a built-in's name is refused.
           *
           * @param command `name`, `description` (what the menu shows),
           *   `argumentHint` (dim after the name), `immediate` (runs mid-turn)
           * @returns `{ command }`, the registered name
           * @example
           * await $.command.register({ name: "hello", description: "Says hi." })
           */
          register: (command: CommandSpec) => Promise<OpValueOf['command.register']>;
      };
      /**
       * Every row of the settings menu (`/config`), the panel's own and each
       * enabled plugin's `userConfig` fields alike: listing and changing them.
       */
      config: {
          /**
           * Returns the rows the `/config` menu would draw now, in its order,
           * each with its current value, its kind, its owner and its lock.
           *
           * After every `config.describe` hook: a hidden row is left out, a
           * relabelled one carries the new label.
           *
           * @example
           * const theme = (await $.config.list()).find(row => row.key === "theme")
           */
          list: () => Promise<ConfigRow[]>;
          /**
           * Changes one row as if the person did in the menu: the event
           * `config.set` with `origin` `{ kind: 'plugin', name }`, then the writer.
           *
           * Through the other plugins' hooks, this plugin's own skipped; `{ deny }`
           * when a hook refused, the value does not fit, a trusted source owns the
           * row or only its dialog changes it. Rejects a key no row has.
           *
           * @param args `key` (as `list` names it) and `value` (the row's kind)
           * @returns `{ value }` once written, or `{ deny }`
           * @example
           * const { deny } = await $.config.set({ key: "verbose", value: true })
           */
          set: EventCalls['config']['set'];
      };
      /**
       * Subagents.
       */
      agent: {
          /**
           * Spawns a subagent: the event `agent.spawn`, the same call the engine
           * makes when the Agent tool starts one; the engine fills the rest.
           *
           * It runs every hook but the calling one, then the Agent tool in the
           * background under this call's origin: `{ model, agentId }` once the
           * subagent started (its answer is its `turn.complete`), or `{ deny }`.
           *
           * @example
           * const { agentId } = await $.agent.spawn({ prompt: "Read README.md." })
           */
          spawn: EventCalls['agent']['spawn'];
          /**
           * Returns the session's subagents so far, the ones the model spawned and
           * the ones plugins did alike.
           */
          list: () => Promise<AgentInfo[]>;
          /**
           * Defines an agent type the Agent tool dispatches from the next turn on,
           * named `<plugin>:<name>`: the event `agent.register`.
           *
           * Every field takes effect as in an agent file; re-registered, a name is
           * replaced; unloaded, a plugin's types go. `agent.offer` hides it from
           * the model alone; any plugin's `$.agent.spawn` answers to `agent.spawn`.
           *
           * @param spec `name`, `description` (when to delegate), `prompt` (its
           *             system prompt), and any other field of an agent definition
           * @returns `{ agent }`, the full name; rejects until the session binds,
           *          on a spec the schema refuses (its reason), on a hook's deny
           * @example
           * await $.agent.register({ name: "runner", description: "Runs a spec",
           *   prompt: RUNNER_PROMPT, tools: ["Read", "Bash"], omitClaudeMd: true })
           * @example
           * // runner-only: hidden from the model, spawned by this plugin's tool,
           * // answered by the subagent's turn.complete (matched by agentId)
           * on("agent.offer", { agent: "lab:runner" }, () => ({ isOffered: false }))
           * on("tool.call", { tool: "mcp__lab__run" }, async ($, e) => {
           *   const { agentId, deny } = await $.agent.spawn({
           *     subagentType: "lab:runner", prompt: e.spec, description: "run" })
           *   return { result: deny ?? (await answerOf(agentId)) }
           * })
           */
          register: (spec: AgentSpec) => Promise<OpValueOf['agent.register']>;
      };
      /**
       * The file system as the engine's own process reaches it; a relative path
       * is under the session's working directory, and text is UTF-8.
       *
       * An absolute path is used as given; where one may go is an `fs.*` hook's
       * to say. A read or write over 4 MiB rejects, a foreign network location
       * as spelled rejects untouched, and an OS refusal rejects with its errno.
       */
      fs: {
          /**
           * Reads a file and returns its text, or with `{ as: "bytes" }` its bytes
           * as `{ base64 }`.
           *
           * Rejects when missing, or over 4 MiB, which bounds what one read copies
           * into the plugin's environment. A file the plugin ships is under
           * `$.plugin.root`.
           *
           * @param path relative to the working directory, or absolute
           * @param options `as`: `"text"` (the default) or `"bytes"`
           * @returns the file's text, or `{ base64 }`
           * @example
           * const readme = await $.fs.read("README.md")
           * @example
           * const { base64 } = await $.fs.read(
           *   `${$.plugin.root}/hooks/weights.bin`, { as: "bytes" })
           * const weights = Uint8Array.fromBase64(base64)
           */
          read: FsReadCall;
          /**
           * Writes `text` to a file, creating it and its directories as needed.
           *
           * @param path relative to the working directory, or absolute
           * @param text the whole new content
           */
          write: (path: string, text: string) => Promise<void>;
          /**
           * Lists a directory: `{ name, kind, size, isLink }` per entry, by name,
           * each entry as it stands (a symbolic link is `other` with `isLink`).
           *
           * @param path the directory's path; absent, the working directory
           * @returns the entries, `{ name, kind, size, isLink }` each
           */
          list: (path?: string) => Promise<FsEntry[]>;
          /**
           * Returns whether the path exists; rejects only a network location as
           * spelled, which no `fs` call reaches.
           */
          exists: (path: string) => Promise<boolean>;
          /**
           * Returns `{ kind, size, mtimeMs, isLink }` of the path: what it leads to,
           * and whether it is itself a symbolic link. Rejects when missing.
           *
           * With `{ resolve: true }` also `realPath`, where the path lands, absent
           * when it leads nowhere; a guard matches it and denies without it, since a
           * spelling it cannot resolve (`~`, a file not there yet) the tool may open.
           *
           * @param path relative to the working directory, or absolute
           * @param options `resolve`: also answer `realPath` (one more file system
           *                call)
           * @returns the stat, `realPath` with it when asked and resolvable; rejects
           *          `ENOENT` for a missing path
           * @example
           * // ROOT was resolved the same way and SEP is its separator; an
           * // allow-list under it is the robust guard, a deny-list on spellings
           * // only best effort (a hard link or a case alias keeps its own)
           * on("tool.call", { tool: "Read" }, async ($, e, next) => {
           *   const stat = await $.fs.stat(e.file_path, { resolve: true })
           *     .catch(() => undefined)
           *   const real = stat?.realPath
           *   const isInside = real !== undefined && real.startsWith(ROOT + SEP)
           *   return isInside ? next(e) : { deny: "outside the project" }
           * })
           * @example
           * // a Write may name a file not there yet: `placed` answers where the
           * // path lands or undefined, and the guard denies on undefined or
           * // outside ROOT. Unplaceable by spelling first, with no file system
           * // call (drive-relative `D:x`, a `\\` or `//` network or device path,
           * // a name that is empty, ".", ".." or itself `C:...`); then the file
           * // if it stats; else its folder, cut after the last separator and
           * // keeping it so a drive or share root stays that root, plus the name
           * const placed = async (path) => {
           *   const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
           *   const name = path.slice(cut + 1)
           *   const isPlaceable = !/^[A-Za-z]:(?![\\/])/.test(path) &&
           *     !/^[\\/][\\/]/.test(path) && !/^[A-Za-z]:/.test(name) &&
           *     name !== "" && name !== "." && name !== ".."
           *   if (!isPlaceable) return undefined
           *   const own = await $.fs.stat(path, { resolve: true })
           *     .catch(() => undefined)
           *   if (own) return own.realPath
           *   const folder = cut < 0 ? "." : path.slice(0, cut + 1)
           *   const dir = await $.fs.stat(folder, { resolve: true })
           *     .catch(() => undefined)
           *   return dir?.realPath === undefined ? undefined
           *     : `${dir.realPath.replace(/[\\/]$/, "")}${SEP}${name}`
           * }
           * const real = await placed(e.file_path)
           * const isInside = real !== undefined && real.startsWith(ROOT + SEP)
           * return isInside ? next(e) : { deny: "cannot place it, or outside" }
           */
          stat: (path: string, options?: FsStatOptions) => Promise<FsStat>;
          /**
           * Reads the named instruction files in every directory above the
           * session's original working directory, the way the engine reads CLAUDE.md.
           *
           * Root first, each `{ dir, name, content }` that exists, the content
           * with its `@include`s after it; `of` and `below` together are the
           * engine's own walk for a nested CLAUDE.md between root and read file.
           *
           * @param request `names`, relative `.md` file names (no `..`); `of`, the
           * file walked down to; `below`, the directory the walk stays inside
           * @returns the files found, root first
           * @example
           * const found = await $.fs.ancestors({ names: ["AGENTS.md"] })
           * const stack = await $.fs.ancestors({ names: ["AGENTS.md"], of: path })
           * const nested = await $.fs.ancestors({
           *   names: ["AGENTS.md"],
           *   of: e.file_path,
           *   below: await $.session.root(),
           * })
           */
          ancestors: (request: FsAncestorsRequest) => Promise<readonly FsAncestor[]>;
      };
      /**
       * This plugin's own key-value store, kept between sessions and hot
       * reloads; values are JSON data.
       *
       * A JSON file of the plugin's own under the user's Claude Code
       * configuration directory.
       */
      store: {
          /**
           * Returns the value under `key`, or `undefined` when unset.
           *
           * @example
           * const count = Number((await $.store.get("count")) ?? 0) + 1
           */
          get: (key: string) => Promise<unknown>;
          /**
           * Sets `key` to `value`, which must be JSON data.
           *
           * `get` reads back `JSON.parse(JSON.stringify(value))`: a Date is its ISO
           * string, an `undefined` field is dropped, a Map or Set is `{}`. Rejects
           * a function, a cycle, or a store over 4 MiB of JSON text in all.
           */
          set: (key: string, value: unknown) => Promise<void>;
          /**
           * Removes `key` from the store.
           */
          delete: (key: string) => Promise<void>;
          /**
           * Returns every key set, in insertion order.
           */
          keys: () => Promise<string[]>;
      };
      /**
       * The time and timers, each an event through the host: `clock.now` reads
       * the time; `clock.sleep`, `after` and `every` wait until it has passed.
       *
       * A timer's callback is the plugin's own function, kept in its environment
       * and run there when the wait resolves; a hot reload of the plugin cancels
       * its pending waits with the old environment.
       */
      clock: {
          /**
           * Resolves milliseconds since the epoch, now.
           *
           * @example
           * const startedAt = await $.clock.now()
           */
          now: () => Promise<number>;
          /**
           * Resolves after `ms` milliseconds; rejects at once when `signal` aborts.
           *
           * @param ms how long, in milliseconds
           * @param options `signal`: ends the wait early with a rejection (pass
           *   `next.signal` so a hook's wait ends with its dispatch)
           * @example
           * await $.clock.sleep(500, { signal: next.signal })
           */
          sleep: (ms: number, options?: SleepOptions) => Promise<void>;
          /**
           * Calls `fn` once after `ms` milliseconds; `cancel()` before then stops it.
           *
           * One `clock.after` dispatch: `fn` runs when it resolves, and never when
           * a hook refuses it.
           */
          after: TimerCall;
          /**
           * Calls `fn` every `ms` milliseconds (at least 1) until `cancel()`.
           *
           * One `clock.every` dispatch per period: `fn` runs when it resolves and
           * the next period is asked; a refused period ends the interval.
           *
           * @example
           * const tick = $.clock.every(1000, () => $.ui.status("polling"))
           */
          every: TimerCall;
      };
      /**
       * The network, through the host.
       */
      http: {
          /**
           * Fetches `url` through the host (never the plugin's own network) and
           * resolves `{ status, ok, headers, text }` once the body is read.
           *
           * http or https, to whatever the host process can reach, unless the
           * administrator's policy switches refuse it; an `auth` handle from
           * `$.session.authorize()` rides https only, to a first-party host.
           *
           * @param url the URL (http or https)
           * @param init `{ method, headers, body, auth, socketPath }` (body a
           *             string; socketPath a Unix socket to go over instead of TCP)
           * @returns `{ status, ok, headers, text }` once the body is read
           * @example
           * const { ok, text } = await $.http.fetch("https://example.com/status")
           * @example
           * await $.http.fetch("http://bridge/reload", {
           *   method: "POST",
           *   socketPath: `${runDirectory}/bridge.sock`,
           * })
           */
          fetch: (url: string, init?: HttpInit) => Promise<HttpResponse>;
      };
      /**
       * Commands on the host, run as the user the session runs as. CLI only.
       *
       * Local execution, not a network path: what a command of its own reaches
       * is its own, as for the Bash tool and a settings `command` hook.
       */
      process: {
          /**
           * Runs a command on the host by its argument vector (no shell) and
           * resolves `{ exitCode, stdout, stderr }` once it exits, any exit code.
           *
           * One shot: the whole output is read, so a background process left
           * writing holds the call until the timeout. Rejects when the command
           * cannot start or is still running then. Git runs with repo hooks off.
           *
           * @param argv the command and its arguments, `argv[0]` the executable
           * @param init `{ cwd, env, stdin, timeoutMs }` (cwd the session's by
           *             default; timeout 30 s by default, ten minutes at most)
           * @returns `{ exitCode, stdout, stderr }` once the child exits
           * @example
           * const { exitCode, stdout } = await $.process.run(["git", "status"])
           */
          run: (argv: readonly string[], init?: ProcessRunInit) => Promise<ProcessRunResult>;
      };
      /**
       * What the settings files, `--settings` and managed policy hold, as the
       * engine runs under it; read only.
       *
       * Every key crosses as the source holds it, `env` and the helper commands
       * included: nothing is filtered. The OAuth session and the global config
       * (~/.claude.json) are not settings and are never read.
       */
      settings: {
          /**
           * Resolves with the settings merged over every source, as the engine
           * reads them, or with one source's settings as loaded (`{ source }`).
           *
           * A snapshot in plain data each call; a source with no file answers
           * `{}`. The sources (SettingsSource) rise in precedence from `user` to
           * `policy`: the merge takes a key from the last source that has it.
           *
           * @param args `{ source }` to read one source; nothing for the merge
           * @returns the settings object, keyed as a settings.json is
           * @example
           * const { permissions } = await $.settings.read()
           * const policy = await $.settings.read({ source: "policy" })
           */
          read: (args?: SettingsReadArgs) => Promise<Settings>;
      };
      /**
       * The environment of this process, the one every Bash child, MCP server
       * and `$.process.run` command started after inherits.
       *
       * `get` and `set` take the variable's name as a string literal, so what a
       * module reads and writes is read off its source: `claude plugin validate`
       * lists the names, and a name the module does not spell is refused.
       */
      env: {
          /**
           * Resolves with the variable's value, or `undefined` when it is unset.
           *
           * `name` must be a string literal; `claude plugin validate` lists the
           * names your module reads and writes.
           *
           * @example
           * const home = await $.env.get("HOME")
           */
          get: (name: string) => Promise<string | undefined>;
          /**
           * Sets the variable for this process and everything it starts after, or
           * unsets it when `value` is `undefined`.
           *
           * `name` must be a string literal; `claude plugin validate` lists the
           * names your module reads and writes.
           *
           * @example
           * await $.env.set("GIT_PAGER", "cat")
           */
          set: (name: string, value: string | undefined) => Promise<void>;
      };
  }

  /**
   * The name of an event the engine defines itself (a key of CoreEventOf);
   * EventName adds the declared plugin nouns' events.
   */
  type CoreEventName = keyof CoreEventOf;

  /**
   * The argument of each event the engine defines itself: its call sites'
   * (EngineEventOf), the classic hooks' (ClassicEventOf), the calls on `$`.
   */
  type CoreEventOf = EngineEventOf & ClassicEventOf & OpEventOf;

  type CwdChangedHookInput = BaseHookInput & {
      hook_event_name: 'CwdChanged';
      old_cwd: string;
      new_cwd: string;
  };

  type DirectoryAddedHookInput = BaseHookInput & {
      hook_event_name: 'DirectoryAdded';
      /**
       * Absolute path of the directory that was added.
       */
      directory: string;
      /**
       * How the directory was added: "slash_command" for /add-dir, "register_repo_root" for the SDK control_request.
       */
      source: 'slash_command' | 'register_repo_root';
  };

  /**
   * The `children` field every element constructor's props carry, appended
   * beside its own props type: one child, or a list that may nest.
   *
   * JSX types a lone child as the child itself (`<Text dimColor>done</Text>`
   * passes the string, `<Text>{count}</Text>` the number), and a mapped list
   * beside a sibling as a nested list (`<Box>{rows.map(row)}<Text>ok</Text>`).
   */
  export type ElementChildren = {
      children?: RenderChildren;
  };

  /**
   * An element as `$.ui.resolve(e)` hands it out: a constructor from props to
   * the frozen plain-data element, `children` among the props as JSX passes.
   *
   * `const { Box } = $.ui.resolve(e)` then `<Box gap={1}>...</Box>` compiles to
   * `h(Box, { gap: 1 }, ...children)`, and `h` calls a function tag with its
   * props, so the table's constructors are the JSX tags.
   */
  export type ElementConstructor<P> = (props: P & ElementChildren) => RenderElement;

  /**
   * Every element name of every surface: what a table handed out is completed to
   * (an omitted one draws a fragment; see `ui.resolve`).
   */
  export type ElementName = {
      [P in RenderSurface]: keyof Elements[P];
  }[RenderSurface];

  /**
   * The element constructors each surface draws, by `e.surface`: what
   * `$.ui.resolve(e)` returns and a `ui.resolve` hook passes on; no globals.
   *
   * All carry `Box`, `Text`, `Button`, `Link`, `Code`, `Markdown`; every remote
   * surface `Svg`; all but mobile `Input` and `Select`; terminal and desktop
   * `Client`; terminal `Raster` and `Image`. Narrowed on `e.surface`, that table.
   */
  export type Elements = {
      terminal: {
          Box: ElementConstructor<BoxProps>;
          Text: ElementConstructor<TextProps>;
          Button: ElementConstructor<ButtonProps>;
          Input: ElementConstructor<InputProps>;
          Select: ElementConstructor<SelectProps>;
          Link: ElementConstructor<LinkProps>;
          Code: ElementConstructor<CodeProps>;
          Markdown: ElementConstructor<MarkdownProps>;
          /**
           * A region one of the plugin's surface modules draws (ClientModule), named
           * by `module`: a string literal, the module's path relative to this file.
           *
           * The engine reads the surface module off the hooks module's source
           * before anything runs, so a variable, a template with a substitution or
           * a computed path as `module` is refused at load, naming the line.
           */
          Client: ElementConstructor<ClientProps>;
          Raster: ElementConstructor<RasterProps>;
          Image: ElementConstructor<ImageProps>;
      };
      desktop: {
          Box: ElementConstructor<BoxProps>;
          Text: ElementConstructor<TextProps>;
          Button: ElementConstructor<ButtonProps>;
          Input: ElementConstructor<InputProps>;
          Select: ElementConstructor<SelectProps>;
          Svg: ElementConstructor<SvgProps>;
          Link: ElementConstructor<LinkProps>;
          Code: ElementConstructor<CodeProps>;
          Markdown: ElementConstructor<MarkdownProps>;
          Client: ElementConstructor<ClientProps>;
      };
      /**
       * No `Input` or `Select`: the control protocol carries presses (ui_press)
       * but no ui_input or ui_select yet; not a limit of the device.
       *
       * The table grows when those messages exist.
       */
      mobile: {
          Box: ElementConstructor<BoxProps>;
          Text: ElementConstructor<TextProps>;
          Button: ElementConstructor<ButtonProps>;
          Svg: ElementConstructor<SvgProps>;
          Link: ElementConstructor<LinkProps>;
          Code: ElementConstructor<CodeProps>;
          Markdown: ElementConstructor<MarkdownProps>;
      };
      /**
       * The desktop's table without `Client`: a remote `Client`'s module, presses
       * and posts (ui_client_module, ui_client_press, ui_message) name no surface.
       *
       * They are the desktop's alone today, not a limit of the editor's webview:
       * the table gains `Client` when those asks name a surface.
       */
      vscode: {
          Box: ElementConstructor<BoxProps>;
          Text: ElementConstructor<TextProps>;
          Button: ElementConstructor<ButtonProps>;
          Input: ElementConstructor<InputProps>;
          Select: ElementConstructor<SelectProps>;
          Svg: ElementConstructor<SvgProps>;
          Link: ElementConstructor<LinkProps>;
          Code: ElementConstructor<CodeProps>;
          Markdown: ElementConstructor<MarkdownProps>;
      };
  };

  /**
   * The table `ui.resolve` answers for an argument of surface `P`.
   */
  export type ElementTable<P extends RenderSurface = RenderSurface> = Elements[P];

  /**
   * Hook input for the Elicitation event. Fired when an MCP server requests user input. Hooks can auto-respond (accept/decline) instead of showing the dialog.
   */
  type ElicitationHookInput = BaseHookInput & {
      hook_event_name: 'Elicitation';
      mcp_server_name: string;
      message: string;
      mode?: 'form' | 'url';
      url?: string;
      elicitation_id?: string;
      requested_schema?: Record<string, unknown>;
  };

  /**
   * Hook input for the ElicitationResult event. Fired after the user responds to an MCP elicitation. Hooks can observe or override the response before it is sent to the server.
   */
  type ElicitationResultHookInput = BaseHookInput & {
      hook_event_name: 'ElicitationResult';
      mcp_server_name: string;
      elicitation_id?: string;
      mode?: 'form' | 'url';
      action: 'accept' | 'decline' | 'cancel';
      content?: Record<string, unknown>;
  };

  /**
   * The input of `engine.create`: the fold that builds `$`, once per load,
   * core innermost.
   *
   * A hook is written in post-order: `const built = await next(e)` is `$` as
   * built so far; `return { ...built, voice: { say } }` adds this plugin's noun.
   * See EngineEventOf's `engine.create` for what a step may and may not do.
   */
  export type EngineCreateInput = {
      /**
       * The modules this fold builds, in list order, first outermost (managed
       * plugins first, so an org plugin's withholding wins).
       *
       * The whole set at a load, this plugin alone at its reload, the ones added
       * or changed at a refresh that keeps the rest: a module added later that
       * does not hook this event is built against the table as it stands.
       */
      plugins: readonly string[];
  };

  /**
   * What an `engine.create` hook returns: `$` as built so far with this
   * plugin's nouns added, less any it withheld.
   *
   * Every declared noun is optional here. Between hooks it crosses the chain
   * as interface descriptors; a hook sees objects (EngineInterfaceBuilt).
   */
  export type EngineCreateResult = Partial<EngineInterface> & {
      readonly [noun: string]: unknown;
  };

  /**
   * The events the engine raises at its call sites, and `engine.create`; the
   * classic settings hooks' events are ClassicEventOf.
   *
   * At every one, a hook that fails (throws, overruns its budget: HookBudget,
   * answers a wrong shape) is skipped: the hooks beneath and core run in its
   * place, or its last `next` result stands; the failure is reported by name.
   */
  export type EngineEventOf = {
      /**
       * Fires when the engine is about to run a tool. `next(e)` runs the hooks
       * beneath, then core (the permission prompt, the tool itself).
       *
       * Return `{ deny: reason }` to refuse or `{ result }` to answer yourself; a
       * hook that returns while its `next` is pending aborts what runs beneath.
       * The managed-settings hooks run first: their deny is the call's result.
       */
      'tool.call': ToolCallInput;
      /**
       * Fires when the engine decides whether a tool call may run, after the
       * `tool.call` and PreToolUse hooks and before the mode settles an ask.
       *
       * `next(e)` resolves to the engine's verdict (rules, mode, the tool's own
       * check, PreToolUse's decision); return any `{ decision }`. `$.tool.check`
       * runs the same chain and executes nothing.
       *
       * @example
       * on("tool.check", { tool: "Read" }, () => ({ decision: "allow" }))
       */
      'tool.check': ToolCheckInput;
      /**
       * Fires when the engine is about to draw a component: once per input value
       * (props, viewport width), plugin load or `$.ui.invalidate("ui.render")`.
       *
       * A repaint reuses the answer; a clock invalidates. `next(e)` resolves to the
       * drawing: return it, wrap it, draw your own, or rewrite `props`. A tree that
       * does not validate draws the engine's own; `--plugin-dir` is told why.
       */
      'ui.render': RenderInput;
      /**
       * Fires when the plugins load (not per draw), once per surface, component
       * and plugin: `e` names the surface and component, never the props.
       *
       * `next(e)` resolves to the surface's table, which `$.ui.resolve(e)` then
       * reads. Return it, one with an element restyled for every other plugin,
       * or one with a key left out (a fragment there); own table: hook skipped.
       */
      'ui.resolve': ResolveInput;
      /**
       * Fires when a `Button` a render hook drew is pressed on a surface; `e` is
       * `{ plugin, element, component, surface }`, `element` the button's `key`.
       *
       * `next(e)` runs the hooks beneath, then core: the element's own `onPress`
       * closure, in its plugin's environment, resolving to `{ element }`. Return
       * `next(e)` to let the press through, or `{ element }` to take it.
       */
      'ui.press': UiPressArgument;
      /**
       * Fires when an `Input` a render hook drew changes or is submitted; `e` is
       * `{ plugin, element, component, surface, kind, value }`.
       *
       * `next(e)` runs the hooks beneath, then the element's own `onInput` or
       * `onSubmit` with `e.value` as the chain left it, resolving to `{ element,
       * value }`; `next({ ...e, value })` rewrites the typing, an answer takes it.
       */
      'ui.input': UiInputArgument;
      /**
       * Fires when a `Select` a render hook drew is picked from; `e` is
       * `{ plugin, element, component, surface, value }`.
       *
       * `next(e)` runs the hooks beneath, then the element's own `onSelect` with
       * `e.value` as the chain left it, resolving to `{ element, value }`;
       * `next({ ...e, value })` rewrites the pick, an answer takes it.
       */
      'ui.select': UiSelectArgument;
      /**
       * Fires when a `Client` THIS plugin drew posts from its surface module
       * (`surface.post(data)`); only this plugin's hooks see it.
       *
       * `next.origin` names `client`: `data` came from code. Core answers `{}`;
       * `next({ ...e, data })` rewrites the data; `{ props }` hands the posting
       * instance its next props without a redraw. One per instance per frame.
       */
      'ui.message': UiMessageArgument;
      /**
       * Fires before a site's window moves: the person's wheel or scroll keys on
       * a `Pane` body or the `AbovePrompt` band, at its edges too; `$.ui.scroll`.
       *
       * `next(e)` moves it to `e.offset` and draws: `{}`; `next({ ...e, offset
       * })` elsewhere; no `next` (`{}` or `{ deny }`) leaves it undrawn, so a hook
       * drawing its own rows under a header moves them by `e.by` and invalidates.
       *
       * @example
       * on("ui.scroll", { requestId: "log" }, ($, e) => (scrollOwnRows(e.by), {}))
       */
      'ui.scroll': UiScrollInput;
      /**
       * Fires before a site's focus ring moves: the person's Tab, arrows or click
       * in a `Pane` or the band; an `autoFocus` element taking it; `$.ui.focus`.
       *
       * `next(e)` lands it on `e.element` (absent: one of the engine's stops) and
       * draws: `{}`; `next({ ...e, element })` on another of `e.plugin`'s; no
       * `next` (`{}` or `{ deny }`) keeps it where it was, drawn as it was.
       *
       * @example
       * on("ui.focus", { requestId: "list" }, ($, e, next) => (mark(e), next(e)))
       */
      'ui.focus': UiFocusInput;
      /**
       * Fires when the engine offers an agent type to the model, in the agent
       * listing and again at dispatch; `next(e)` resolves to `{ isOffered: true }`.
       *
       * Return `{ isOffered: false }` to keep the type out of the listing and
       * refuse its dispatch. A hook that fails passes it through.
       *
       * @example
       * on("agent.offer", { agent: "Plan" }, () => ({ isOffered: false }))
       */
      'agent.offer': AgentOfferInput;
      /**
       * Fires when the Agent tool is about to start a subagent, everything
       * decided and its model not yet resolved.
       *
       * `next(e)` resolves to `{ model }`. Return it, `next({ ...e, model })`,
       * `{ model }` of your own (an alias resolves like the tool's parameter), or
       * `{ deny: reason }`.
       */
      'agent.spawn': AgentSpawnInput;
      /**
       * Fires when a prompt is submitted, before the turn starts. `next(e)` runs
       * the hooks beneath and the UserPromptSubmit settings hooks.
       *
       * Rewrite with `next({ ...e, text })` (the user message on screen follows)
       * or stop it with `{ drop: reason }`; a broken plugin never blocks a prompt.
       * A prompt typed while a turn ran fires at Enter, with that turn's id.
       */
      'prompt.submit': PromptSubmitInput;
      /**
       * Fires when a text is about to be put in the prompt box as the person's
       * draft (a plugin's `$.prompt.fill`); `next(e)` writes it by `e.mode`.
       *
       * `replace` over the draft, `append` after it, `insert` at the cursor;
       * rewrite `text` or `mode` going down, or answer `{ isFilled: false }`
       * without `next` to keep it out, as core does under a dialog or headless.
       *
       * @example
       * on("prompt.fill", ($, e, next) => next({ ...e, text: e.text.trim() }))
       */
      'prompt.fill': PromptFillInput;
      /**
       * Fires when a text is proposed as the prompt box's dim suggestion, Tab to
       * take: the engine's guess after a turn, or a plugin's `$.prompt.suggest`.
       *
       * `next(e)` shows it: `{ isShown }`. Rewrite with `next({ ...e, text })`,
       * or answer `{ isShown: false }` without `next` to drop it; core answers
       * that too while the box holds text or a turn runs.
       *
       * @example
       * on("prompt.suggest", { origin: { kind: "suggestion" } }, hide)
       */
      'prompt.suggest': PromptSuggestInput;
      /**
       * Fires when the person edits the main prompt box: a key the editor took as
       * an edit, or a paste; `next(e)` resolves the box the editor shows.
       *
       * `e` is the draft before and the splice (`start`, `end`, `inputText`); a
       * burst of keys is one edit. Rewrite `inputText` going down or the box
       * coming up; `{ text: e.text, cursor: e.cursor }` without `next` consumes.
       *
       * @example
       * on("prompt.edit", ($, e, next) => next({ ...e, inputText: up(e) }))
       */
      'prompt.edit': PromptEditInput;
      /**
       * Fires once per named section of the system prompt, when the engine
       * assembles it; `next(e)` resolves to `{ text }` as core computed it.
       *
       * Sections are cached by name for the session until
       * `$.ui.invalidate("prompt.section")`: an unstable answer spends the
       * model's prompt cache on every call. A hook that fails passes it through.
       *
       * @example
       * on("prompt.section", { name: "memory" }, () => ({ text: null }))
       */
      'prompt.section': PromptSectionInput;
      /**
       * Fires once per conversation, when the engine computes the context blocks
       * its first user message carries; `next(e)` resolves to `{ blocks }`.
       *
       * Append, drop, reorder or rewrite with `next({ ...e, blocks })`; the
       * engine renders what comes back, in order, until
       * `$.ui.invalidate("prompt.context")` or a re-read (compaction, `/clear`).
       *
       * @example
       * on("prompt.context", () => ({ blocks: [] }))
       */
      'prompt.context': PromptContextInput;
      /**
       * Fires once per message the engine injects for the model on its own (a
       * reminder, a mode transition, a mentioned file), as a request carries it.
       *
       * `next(e)` resolves to `{ text }`; `{ text: null }` leaves it out. The
       * answer holds per attachment for the process (asked again on resume or
       * `$.ui.invalidate`); the transcript keeps the engine's record.
       *
       * @example
       * on("prompt.attachment", { type: "todo_reminder" }, () => ({ text: null }))
       */
      'prompt.attachment': PromptAttachmentInput;
      /**
       * Fires once per tool, when the engine first renders the tool's schema in
       * a session; `next(e)` resolves to `{ description, isDeferred? }`.
       *
       * Cached for the session until `$.ui.invalidate("tool.describe")`: an
       * unstable answer spends the model's prompt cache. An explicit `isDeferred`
       * moves the tool behind ToolSearch (true) or into the prompt's list (false).
       *
       * @example
       * on("tool.describe", { tool: "Bash" }, ($, e) => ({ ...e, description }))
       * @example
       * on("tool.describe", { tool: "Monitor" }, pin) // {...e, isDeferred: false}
       */
      'tool.describe': ToolDescribeInput;
      /**
       * Fires when a slash command is about to run (`/name args` typed, or a
       * plugin's `$.command.run`); `next(e)` resolves to `{ text }`, its output.
       *
       * Core is the engine's command (a registered one has none). Rewrite `args`
       * with `next`, or return `{ text }` without it to answer in its place; one
       * after `next` replaces a printed output, not a panel or prompt it opened.
       *
       * @example
       * on("command.run", { command: "hello" }, () => ({ text: "hello" }))
       */
      'command.run': CommandRunInput;
      /**
       * Fires once per command, when the engine lists it for the typeahead and
       * `/help`; `next(e)` resolves to `{ description, argumentHint, isHidden }`.
       *
       * Listed answers are cached for the session until
       * `$.ui.invalidate("command.describe")`. A hook that fails passes it
       * through.
       *
       * @example
       * on("command.describe", ($, e, next) => next({ ...e, isHidden: true }))
       */
      'command.describe': CommandDescribeInput;
      /**
       * Fires when a `/config` row is about to change, from the menu or a
       * plugin's `$.config.set`; `next(e)` resolves to `{ value }` once written.
       *
       * Return `{ deny: reason }` to leave the row as it is (the menu says why),
       * or `next({ ...e, value })` to clamp it; a value of the wrong kind for
       * the row is refused. A row a trusted source owns is core's to refuse.
       *
       * @example
       * on("config.set", { key: "theme" }, () => ({ deny: "the theme stays" }))
       */
      'config.set': ConfigSetInput;
      /**
       * Fires once per `/config` row, when the menu lists it and for
       * `$.config.list`; `next(e)` resolves to `{ label, description, isHidden }`.
       *
       * Relabel, re-describe or hide with `next({ ...e, isHidden: true })`; the
       * answers are cached until `$.ui.invalidate("config.describe")` or the
       * loaded plugins change. A hook that fails passes the row through.
       *
       * @example
       * on("config.describe", { key: "tips" }, hide) // answers isHidden: true
       */
      'config.describe': ConfigDescribeInput;
      /**
       * Fires when the engine expands a skill's prompt for the model (`/name`,
       * the Skill tool, a preload); `next(e)` resolves to `{ text }` as computed.
       *
       * Return `{ text }` with the text the model reads instead. A hook that
       * fails passes it through.
       *
       * @example
       * on("skill.prompt", { skill: "commit" }, () => ({ text: "A haiku." }))
       */
      'skill.prompt': SkillPromptInput;
      /**
       * Fires when the engine composes a git text the model is to write (`kind`:
       * `commit`, `pr`, `exemption`, `remedy`); `next(e)` resolves to `{ text }`.
       *
       * Return `{ text }` with the text the model reads instead. A hook that
       * fails passes it through.
       *
       * @example
       * on("attribution.text", { kind: "commit" }, () => ({ text: "" }))
       */
      'attribution.text': AttributionTextInput;
      /**
       * Fires once per process for each loaded plugin, before the first prompt,
       * then once per fresh load of one (never `/clear`); `next(e)` is `{ cwd }`.
       *
       * Observe. The first is awaited: a `$.tool.register` is listed by turn one.
       * A later one runs its hooks alone: an enable, a worker respawn, or a reload
       * (changed modules only; all if one hooks `engine.create`/`plugin.register`).
       *
       * @example
       * on("session.start", ($, e, next) => $.tool.register(t).then(() => next(e)))
       */
      'session.start': SessionStartInput;
      /**
       * Fires when a delivery reaches the session (a relay's event, a peer's
       * message, a Remote Control prompt), before it is queued; `{ text }`.
       *
       * Rewrite with `next({ ...e, text })`, or return `{ consumed: reason }` to
       * take it: nothing is queued, shown or read by the model. `origin` and
       * `event` pass on as received; `session.send`, its dual, is reserved.
       *
       * @example
       * on("session.receive", { origin: "peer" }, () => ({ consumed: "muted" }))
       */
      'session.receive': SessionReceiveInput;
      /**
       * Fires when the conversation is about to be compacted (`/compact`, the
       * threshold, a plugin, or ahead of time); `next(e)` resolves `{ messages }`.
       *
       * Rewrite `instructions` or `messages` on the way down, the messages on
       * the way up, or answer `{ messages }` of your own; `{ skip: reason }`
       * leaves the conversation as it is. `trigger` passes on as received.
       *
       * @example
       * on("session.compact", { trigger: "precompute" }, () => ({ skip: "off" }))
       */
      'session.compact': SessionCompactInput;
      /**
       * Fires when a remote client joins the session's roster of attached
       * surfaces: it said so (ui_attach), or it first asked to draw.
       *
       * Observe (a phone joined: draw the lobby); `next(e)` resolves to
       * `{ clientId }`, a different return changes nothing. `$.session.surfaces()`
       * reads the roster; a render hook still reads `e.surface` per ask.
       *
       * @example
       * on("session.attach", { surface: "mobile" }, ($, e, next) => next(e))
       */
      'session.attach': SessionAttachInput;
      /**
       * Fires when a client leaves the roster: it detached, or the session ended
       * with it attached (`e.reason`). Observe; `next(e)` echoes `{ clientId }`.
       */
      'session.detach': SessionDetachInput;
      /**
       * Fires when the engine measures the session and a unit moved: after each
       * main-thread turn, and when a rate-limit window moves a whole point.
       *
       * Observe; `next(e)` echoes `{ changed }`. `$.session.usage()`'s figures,
       * pushed, not polled: compare them with your own threshold here, call the
       * op for the breakdown. One at a time, a burst folding into one more.
       *
       * @example
       * on("session.measure", ($, e, next) => (toastPast90(e.rateLimits), next(e)))
       */
      'session.measure': SessionMeasureInput;
      /**
       * Fires once when the session ends (exit, /clear, resume, logout, signal, a
       * `-p` run done), after its SessionEnd settings hooks; `e.reason` says which.
       *
       * `e.resume.id` is `--resume`'s id; `next(e)` runs the engine's end step for
       * the plugins (at an exit the attached clients leave): `{ sessionId }`. The
       * SessionEnd bound afresh, 1.5 s by default; a `kill -9` raises nothing.
       *
       * @example
       * on("session.end", async ($, e, next) => (await keep(e.resume), next(e)))
       */
      'session.end': SessionEndInput;
      /**
       * Fires once per hooks module about to join the chain, at load (the set
       * folded and built, nothing swapped in) and at reload; core allows.
       *
       * Return `{ refuse: reason }` and it never joins: no hook, no noun, no tool
       * of it; the transcript names who refused. Its judges, `$` whole, are the
       * plugins admitted before it and the binary's; judge by `tier` and `uses`.
       *
       * @example
       * on("plugin.register", { tier: "user" }, () => ({ refuse: "managed only" }))
       */
      'plugin.register': PluginRegisterInput;
      /**
       * Fires when a model turn begins, before its first model call; `next(e)`
       * resolves to `{ turnId }`. Observe: a different return changes nothing.
       */
      'turn.start': TurnStartInput;
      /**
       * Fires when the engine is about to send a model request of a turn, main's
       * or a subagent's (`e.agentId`); `next(e)` resolves to the whole response.
       *
       * `next({ ...e, model })` or `effort` sends another; the turn, the index and
       * the message count are pinned. An answer without `next` sends no request.
       * It streams (StreamNext): the hook's budget counts its own code alone.
       */
      'turn.step': TurnStepInput;
      /**
       * Fires when a model turn has ended, at the point its duration is reported;
       * `next(e)` resolves to `{ text }`, the answer. `e.reason` says why.
       *
       * Return `{ text }` with a different text to show it beneath the answer (a
       * synopsis, a TL;DR line); the transcript's record is never rewritten. A
       * hook that fails leaves the answer as it was.
       */
      'turn.complete': TurnCompleteInput;
      /**
       * Runs while `$` is being built, once per load or reload of this plugin
       * and before any other hook of it; `next(e)` resolves to `$` built so far.
       *
       * A step may ADD nouns and WITHHOLD nouns (leave one out, or return without
       * `next`); it may NOT REPLACE one another step added: the step fails, named
       * with both plugins. A step that fails unloads its plugin; `$` is rebuilt.
       */
      'engine.create': EngineCreateInput;
  };

  /**
   * `$`, the first parameter of every hook. Frozen; core's interface plus
   * every noun the plugins' `engine.create` steps added.
   *
   * Flat, `<noun>.<event>`; it does not carry `on`, since registration happens
   * before `$` exists. An interface so a plugin types the noun it provides by
   * declaration merging, the way a jQuery plugin types `$.fn`.
   *
   * @example
   * declare module "claude-code" { interface EngineInterface { voice: Voice } }
   */
  export interface EngineInterface extends CoreEngineInterface {
  }

  /**
   * What `next(e)` resolves to at `engine.create`: `$` as the steps beneath
   * built it, typed as `$` is, open to nouns no declaration names yet.
   *
   * A withheld noun is on it as a stub (a step inside withheld it, or the
   * last fold did and this is a reload), and the host refuses an op on one a
   * step outside withholds later; a typed module bootstraps at load on it.
   */
  export type EngineInterfaceBuilt = EngineInterface & {
      readonly [noun: string]: unknown;
  };

  /**
   * The engine's events' results.
   */
  export type EngineResultOf = {
      /**
       * `{ result, context? }`, `{ deny }`, or core's `{ ref, result }`.
       */
      'tool.call': ToolCallResult;
      /**
       * `{ decision, reason?, rule? }`.
       */
      'tool.check': ToolCheckResult;
      /**
       * The tree to draw; `{ type: "engine", ref }` is core's own drawing.
       */
      'ui.render': RenderElement;
      /**
       * The surface's element table (Elements[e.surface]): constructors from props
       * to a RenderElement.
       */
      'ui.resolve': ElementTable;
      /**
       * `{ element }`: the element whose handler the press reached.
       */
      'ui.press': UiPressResult;
      /**
       * `{ element, value }`: the field whose handler the input reached, and
       * the text it received.
       */
      'ui.input': UiInputResult;
      /**
       * `{ element, value }`: the picker whose handler the pick reached, and
       * the value it received.
       */
      'ui.select': UiSelectResult;
      /**
       * `{ props? }`: the posting instance's next props, when a hook hands some.
       */
      'ui.message': UiMessageResult;
      /**
       * `{}` once the window moved, or `{ deny }`.
       */
      'ui.scroll': UiScrollResult;
      /**
       * `{}` once the ring moved, or `{ deny }`.
       */
      'ui.focus': UiFocusResult;
      /**
       * `{ isOffered }`.
       */
      'agent.offer': AgentOfferResult;
      /**
       * `{ model }` or `{ deny }`.
       */
      'agent.spawn': AgentSpawnResult;
      /**
       * `{ text, context? }` or `{ drop }`.
       */
      'prompt.submit': PromptSubmitResult;
      /**
       * `{ isFilled }`.
       */
      'prompt.fill': PromptFillResult;
      /**
       * `{ isShown }`.
       */
      'prompt.suggest': PromptSuggestResult;
      /**
       * `{ text, cursor }`, the box the editor shows next.
       */
      'prompt.edit': PromptEditResult;
      /**
       * `{ text }` (null leaves the section out).
       */
      'prompt.section': PromptSectionResult;
      /**
       * `{ blocks }` (a block left out is not sent).
       */
      'prompt.context': PromptContextResult;
      /**
       * `{ text }` (null leaves the attachment out).
       */
      'prompt.attachment': PromptAttachmentResult;
      /**
       * `{ description, isDeferred? }`.
       */
      'tool.describe': ToolDescribeResult;
      /**
       * `{ text }` (the command's output, when it printed one).
       */
      'command.run': CommandRunResult;
      /**
       * `{ description, argumentHint, isHidden }`.
       */
      'command.describe': CommandDescribeResult;
      /**
       * `{ value }` once written, or `{ deny }`.
       */
      'config.set': ConfigSetResult;
      /**
       * `{ label, description, isHidden }`.
       */
      'config.describe': ConfigDescribeResult;
      /**
       * `{ text }`.
       */
      'skill.prompt': SkillPromptResult;
      /**
       * `{ text }`.
       */
      'attribution.text': AttributionTextResult;
      /**
       * `{ cwd }`.
       */
      'session.start': SessionStartResult;
      /**
       * `{ text }`, or `{ consumed }`.
       */
      'session.receive': SessionReceiveResult;
      /**
       * `{ messages, tokensBefore?, tokensAfter? }`, or `{ skip }`.
       */
      'session.compact': SessionCompactResult;
      /**
       * `{ clientId }`.
       */
      'session.attach': SessionAttachResult;
      /**
       * `{ clientId }`.
       */
      'session.detach': SessionDetachResult;
      /**
       * `{ changed }`.
       */
      'session.measure': SessionMeasureResult;
      /**
       * `{ sessionId }`.
       */
      'session.end': SessionEndResult;
      /**
       * `{ allow: true }`, or `{ refuse }`.
       */
      'plugin.register': PluginRegisterResult;
      /**
       * `{ turnId }`.
       */
      'turn.start': TurnStartResult;
      /**
       * The response: `{ turnId, index, answer, toolUses, stopReason, usage }`.
       */
      'turn.step': TurnStepResult;
      /**
       * `{ text }`.
       */
      'turn.complete': TurnCompleteResult;
      /**
       * `$` as built so far, with this plugin's interface added and any it
       * withheld left out; `next(e)` resolves to EngineInterfaceBuilt.
       */
      'engine.create': EngineCreateResult;
  };

  /**
   * The engine's own events as calls on `$`, one signature each:
   * `$.<noun>.<event>(input)` resolves to its result, or to its stream.
   *
   * The engine raises its events through these same calls; a plugin's call
   * runs the same chain with the calling hook alone skipped. `input` may leave
   * out what the engine fills (`tool_use_id`, the parent agent).
   */
  export type EventCalls = {
      tool: {
          call: ToolCallOverloads;
          check: (input: ToolCheckArgs) => Promise<ToolCheckResult>;
          describe: (input: ToolDescribeInput) => Promise<ToolDescribeResult>;
      };
      command: {
          run: (input: CommandRunArgs) => Promise<CommandRunResult>;
          describe: (input: CommandDescribeInput) => Promise<CommandDescribeResult>;
      };
      config: {
          set: (input: ConfigSetArgs) => Promise<ConfigSetResult>;
          describe: (input: ConfigDescribeInput) => Promise<ConfigDescribeResult>;
      };
      prompt: {
          submit: (input: PromptSubmitArgs) => Promise<PromptSubmitResult>;
          fill: (input: PromptFillArgs) => Promise<PromptFillResult>;
          suggest: (input: PromptSuggestArgs) => Promise<PromptSuggestResult>;
          section: (input: PromptSectionInput) => Promise<PromptSectionResult>;
          context: (input: PromptContextInput) => Promise<PromptContextResult>;
          attachment: (input: PromptAttachmentInput) => Promise<PromptAttachmentResult>;
      };
      skill: {
          prompt: (input: SkillPromptInput) => Promise<SkillPromptResult>;
      };
      attribution: {
          text: (input: AttributionTextInput) => Promise<AttributionTextResult>;
      };
      agent: {
          offer: (input: AgentOfferInput) => Promise<AgentOfferResult>;
          spawn: (input: AgentSpawnArgs) => Promise<AgentSpawnResult>;
      };
      session: {
          start: (input: SessionStartInput) => Promise<SessionStartResult>;
          receive: (input: SessionReceiveInput) => Promise<SessionReceiveResult>;
          compact: (input?: SessionCompactArgs) => Promise<SessionCompactResult>;
          attach: (input: SessionAttachInput) => Promise<SessionAttachResult>;
          detach: (input: SessionDetachInput) => Promise<SessionDetachResult>;
          measure: (input: SessionMeasureInput) => Promise<SessionMeasureResult>;
          end: (input: SessionEndInput) => Promise<SessionEndResult>;
      };
      turn: {
          start: (input: TurnStartInput) => Promise<TurnStartResult>;
          step: (input: TurnStepInput) => HookStream<TurnStepChunk, TurnStepResult>;
          complete: (input: TurnCompleteInput) => Promise<TurnCompleteResult>;
      };
      ui: {
          render: <C extends RenderComponent>(input: RenderInput<C>) => Promise<RenderElement>;
          resolve: <E extends ResolveInput>(e: E) => Elements[E['surface']];
          scroll: (input: UiScrollArgs) => Promise<UiScrollResult>;
          focus: (input: UiFocusArgs) => Promise<UiFocusResult>;
      };
  };

  /**
   * The name of an event: a key of EventOf, the engine's own (CoreEventName)
   * and the declared plugin nouns' (NounEventName).
   */
  export type EventName = keyof EventOf;

  /**
   * The argument of each event, by event name: what a hook receives as `e`
   * and what the call on `$` takes. Plain data, frozen to every depth.
   *
   * The engine's own events (CoreEventOf: a plugin's `$.fs.write(...)` is
   * a dispatch the hooks above it see) and the methods of the plugin nouns
   * declared on EngineInterface (NounEventOf).
   */
  export type EventOf = CoreEventOf & NounEventOf;

  /**
   * The result of event `N`: what its hooks return and what their `next(e)`
   * resolves to.
   */
  export type EventResult<N extends EventName = EventName> = ResultOf[N];

  /**
   * The hook signature of each event, `($, e, next)`, as one mapped type over
   * EventOf; a streaming event's is the generator form (StreamHook).
   *
   * With one handler type per event, `Events[E]` for a generic E would be a
   * union; as one mapped type it stays a single function type the engine
   * calls without a cast (TS 4.6 correlated unions).
   *
   * @param $ the engine interface, frozen, the same object at every invocation;
   *   at `engine.create` the empty table, since `$` exists after the fold
   * @param e the event's argument, frozen to every depth (`e.command = "ls"`
   *   is a type error and throws); a rewrite is a copy passed to `next`
   * @param next the rest of the chain; a chain a hook raises through `$` skips
   *   this hook and runs every other, its plugin's others too
   */
  export type Events = {
      [E in keyof EventOf]: E extends StreamingEventName ? StreamHook<E> : ($: E extends 'engine.create' ? NoEngineInterface : EngineInterface, e: Frozen<Args<E>>, next: Next<E>) => EventResult<E> | Promise<EventResult<E>>;
  };

  type ExitReason = 'clear' | 'resume' | 'logout' | 'prompt_input_exit' | 'other';

  type FileChangedHookInput = BaseHookInput & {
      hook_event_name: 'FileChanged';
      file_path: string;
      event: 'change' | 'add' | 'unlink';
  };

  /**
   * `T` with every property read-only to every depth, arrays and tuples kept
   * as declared: how a hook's `e` is typed.
   *
   * `e.command = 'x'` is a type error; `next({ ...e, command: 'x' })` compiles.
   */
  export type Frozen<T> = T extends (...args: never[]) => unknown ? T : T extends readonly unknown[] ? {
      [K in keyof T]: Frozen<T[K]>;
  } : T extends object ? {
      readonly [K in keyof T]: Frozen<T[K]>;
  } : T;

  /**
   * One file `$.fs.ancestors` found: the directory it stands in, the name it
   * was asked for by, and its text as the engine's memory loader reads it.
   */
  export type FsAncestor = {
      /**
       * The directory the file stands in, absolute.
       */
      dir: string;
      /**
       * The spelling the caller asked for it by.
       */
      name: string;
      /**
       * The file's text, with what its `@include`s bring after it.
       */
      content: string;
      /**
       * The file and then each file its `@` imports brought, in load order,
       * path and text apiece; `content` is these texts joined.
       */
      parts: readonly FsAncestorPart[];
  };

  /**
   * One file of an ancestor entry: the file itself or one it imported.
   */
  export type FsAncestorPart = {
      /**
       * The file's path, absolute.
       */
      path: string;
      /**
       * Its text as the engine's memory loader reads it.
       */
      content: string;
  };

  /**
   * The argument of `$.fs.ancestors`: the file names to look for in each
   * directory, the file to walk down to, and the directory to walk beneath.
   */
  export type FsAncestorsRequest = {
      /**
       * Relative `.md` file names, each looked for in every directory.
       */
      names: readonly string[];
      /**
       * The file the walk goes on down to the directory of, relative to the
       * working directory or absolute; absent, it ends at the working directory.
       */
      of?: string;
      /**
       * The directory the walk starts beneath, relative to the working directory
       * or absolute; absent, the walk starts at the filesystem root.
       *
       * Only directories strictly inside it are read, so with `of` a file under
       * the project root the walk reads the directories between the two, as the
       * engine reads a nested CLAUDE.md; a file not inside it finds nothing.
       */
      below?: string;
  };

  /**
   * What `$.fs.read(path, { as: "bytes" })` resolves with: the file's bytes,
   * base64, since only plain data crosses into a plugin's environment.
   */
  export type FsBytes = {
      /**
       * The file's content, standard padded base64;
       * `Uint8Array.fromBase64(base64)` gives the bytes back.
       */
      base64: string;
  };

  /**
   * One entry of `$.fs.list`: the entry itself, a link not followed.
   */
  export type FsEntry = {
      /**
       * The entry's name (no directory part).
       */
      name: string;
      /**
       * `file`, `dir`, or `other`, of the entry itself: a symbolic link is
       * `other` (`$.fs.stat` says what it leads to, and with `resolve` where).
       */
      kind: 'file' | 'dir' | 'other';
      /**
       * Bytes, for a file.
       */
      size: number;
      /**
       * True when the entry is a symbolic link.
       */
      isLink: boolean;
  };

  /**
   * How `$.fs.read` answers: `text` (UTF-8, the default) or `bytes` (base64).
   */
  export type FsReadAs = 'text' | 'bytes';

  /**
   * The options of `$.fs.read` that ask for the bytes: the call answers
   * `{ base64 }`.
   */
  export type FsReadBytesOptions = {
      /**
       * `bytes`.
       */
      as: 'bytes';
  };

  /**
   * `$.fs.read`: the file's text, or with `{ as: "bytes" }` its bytes as
   * `{ base64 }`.
   */
  export type FsReadCall = {
      (path: string): Promise<string>;
      (path: string, options: FsReadBytesOptions): Promise<FsBytes>;
      (path: string, options: FsReadOptions): Promise<string | FsBytes>;
  };

  /**
   * The options of `$.fs.read`.
   */
  export type FsReadOptions = {
      /**
       * `bytes` answers `{ base64 }` for a binary file; `text` (the default) the
       * file's text.
       */
      as: FsReadAs;
  };

  /**
   * What `$.fs.stat` resolves with: what the path leads to, whether the path
   * itself is a symbolic link, and where it lands when asked.
   */
  export type FsStat = {
      /**
       * `file`, `dir`, or `other`, of what the path leads to: a link is
       * followed, and one that leads nowhere is `other`.
       */
      kind: 'file' | 'dir' | 'other';
      /**
       * Bytes, for a file.
       */
      size: number;
      /**
       * Last modification, milliseconds since the epoch.
       */
      mtimeMs: number;
      /**
       * True when the path itself is a symbolic link; `kind`, `size` and
       * `mtimeMs` then describe what it points at, or the link when that is gone.
       */
      isLink: boolean;
      /**
       * Where the path landed when asked with `{ resolve: true }`: absolute,
       * every symbolic link followed, `.` and `..` folded; else absent.
       *
       * Absent too when the path leads nowhere or a hook above withheld it, so
       * a guard denies without it; and a hard link, a volume or file-id spelling
       * (macOS `/.vol/`) or a case alias keeps its own spelling, `isLink` false.
       *
       * @remarks a deny-list on spellings is thus best effort; an allow-list on
       *          `realPath` under a root resolved the same way is the robust guard.
       */
      realPath?: string;
  };

  /**
   * The options of `$.fs.stat`.
   */
  export type FsStatOptions = {
      /**
       * True to resolve where the path lands as well.
       *
       * The answer then carries `realPath` when the path leads somewhere, at
       * the cost of one more file system call: where it landed then, not a hold
       * on what a tool opens afterwards.
       */
      resolve: boolean;
  };

  /**
   * Every event (`*`), or every event under a namespace (`classic.*`: each
   * one whose name starts with `classic.`).
   */
  export type Glob = '*' | `${Namespace}.*`;

  /**
   * The hook `on(pattern, hook)` takes for a glob or a negation: one function
   * placed on every selected event, `e` and the result typed as their union.
   *
   * `next.event` says which event a run is; `next.is(pattern, e)` narrows `e`
   * to one of them. At `engine.create` (a negation may select it) `$` is the
   * empty table and the hook observes the fold, as a `*` hook does.
   */
  export type GlobHook<P extends Pattern, N extends EventName = Selected<P>> = ($: EngineInterface, e: Frozen<Args<N>>, next: GlobNext<P>) => EventResult<N> | Promise<EventResult<N>>;

  /**
   * `next` in a hook on a glob or a negation: an overload per selected event,
   * then one over their union for an `e` not yet narrowed.
   *
   * `is` narrows `e` to the selected events its pattern names; `event` is one
   * of the selected names.
   */
  export type GlobNext<P extends Pattern, N extends EventName = Selected<P>> = OrderedOverloads<N> & {
      (e: Args<N>): Promise<GlobNextResult<N>>;
      /**
       * Continues this dispatch at a tier, as Next's `to` (a managed hook's),
       * over the selected events' union for an `e` not yet narrowed.
       */
      readonly to: (e: Args<N>, tier: TargetTier) => Promise<GlobNextResult<N>>;
      readonly signal: AbortSignal;
      readonly is: <M extends PatternOver<N>>(pattern: M, e: unknown) => e is Frozen<Args<Extract<N, Selected<M>>>>;
      readonly event: N;
      readonly origin: Origin;
      readonly trace: readonly TraceEntry<N, Args<N>, GlobNextResult<N>>[];
      readonly budget: NextBudget;
  };

  /**
   * What `next(e)` resolves to in a glob hook before `e` is narrowed: the
   * NextResult of each selected event, as a union.
   */
  type GlobNextResult<N extends EventName> = {
      [K in N]: NextResult<K>;
  }[N];

  /**
   * One hook, `($, e, next)`, on event `E`.
   */
  export type Hook<E extends EventName = EventName> = Events[E];

  /**
   * The time bounds every hook runs under, in milliseconds: the engine's own
   * constants are typed by these members, and `next.budget` reads the live one.
   *
   * Each bounds the hook's OWN time: the clock stops while a `next(e)` call or
   * any `$` call of the hook's is in flight (a `$.clock` wait excepted), so a
   * slow chain beneath or a minute-long `$.model.complete` costs it nothing.
   *
   * @example
   * await $.model.complete(ask) // a minute; next.budget.remainingMs unmoved
   */
  export type HookBudget = {
      /**
       * A hook's budget per dispatch, from its call to its return; past it the
       * hook is absent (its `.catch` asked, else `next(e)` run on its behalf).
       *
       * A streaming hook's (`turn.step`, an async generator) spans its whole
       * run and counts only while its own code runs: never at a `yield`, never
       * while it reads the stream beneath. Not per chunk: the sum of its work.
       */
      readonly ms: 10_000;
      /**
       * A `.catch` handler's grace: a fresh budget from the moment it is called,
       * on the same clock (its `next` replay and its `$` calls are free).
       *
       * Past it the hook is absent as if it had no handler; `next.error.budget`
       * and `next.budget.ms` both read it there. `engine.create` has no budget.
       */
      readonly catchMs: 1_000;
      /**
       * How long a hook may keep running after `next.signal` aborted (the person
       * interrupted, a hook above settled first, its own budget ran out).
       *
       * Past it the hook is reported as lingering; the dispatch had already gone
       * on without it when the signal aborted.
       */
      readonly lingerMs: 5_000;
  };

  /**
   * Why a hook failed, as its `.catch` handler reads it on `next.error`: plain
   * frozen data.
   *
   * `throw`: the hook threw, or returned what the site refuses, `message`
   * saying what; `timeout`: it outran its budget, `message` then what its last
   * `next()` rejected with, if it did. `budget` is the handler's own grace.
   */
  export type HookFailure = {
      readonly kind: 'throw' | 'timeout';
      /**
       * The thrown error's message, or for a timeout what the hook's last
       * `next()` rejected with; absent for a timeout with nothing rejected.
       */
      readonly message?: string;
      /**
       * The grace the handler runs under, in milliseconds; past it, the hook is
       * absent as if it had no handler.
       */
      readonly budget: number;
  };

  /**
   * The hook type per pattern: an event's own (Events), `*`'s (AnyEventHook),
   * or a glob's over the events it selects (GlobHook), as one conditional type.
   *
   * One type, so the two-argument `on` stays ONE generic signature: as an
   * overload set the language service offers no tool-name completions inside
   * `e.tool === "`; as an index into a table TS intersects every argument.
   */
  export type HookFor<P extends Pattern> = P extends '*' ? AnyEventHook : P extends EventName ? Events[P] : GlobHook<P>;

  type HookInput = PreToolUseHookInput | PostToolUseHookInput | PostToolUseFailureHookInput | PostToolBatchHookInput | PermissionDeniedHookInput | NotificationHookInput | UserPromptSubmitHookInput | UserPromptExpansionHookInput | SessionStartHookInput | SessionEndHookInput | StopHookInput | StopFailureHookInput | SubagentStartHookInput | SubagentStopHookInput | PreCompactHookInput | PostCompactHookInput | PreModelSwitchHookInput | PostModelSwitchHookInput | PermissionRequestHookInput | SetupHookInput | TeammateIdleHookInput | TaskCreatedHookInput | TaskCompletedHookInput | ElicitationHookInput | ElicitationResultHookInput | ConfigChangeHookInput | InstructionsLoadedHookInput | WorktreeCreateHookInput | WorktreeRemoveHookInput | CwdChangedHookInput | FileChangedHookInput | DirectoryAddedHookInput | MessageDisplayHookInput;

  /**
   * The hook event `E` takes: an async generator over its chunks for a
   * streaming event (`turn.step`), `($, e, next) => result` for every other.
   */
  export type HookOf<E extends EventName> = Events[E];

  /**
   * What a hooks module exports: `register`, and nothing the loader reads
   * besides.
   */
  export type HooksModule = {
      register: Register;
  };

  /**
   * What `next(e)` returns on a streaming event: the stream of everything
   * beneath, chunk by chunk, whose return value is the result from beneath.
   *
   * `yield* next(e)` forwards the chunks and evaluates to that result; a
   * transforming hook reads `for await (const chunk of stream)` and then
   * `await stream.result`. Each call runs what is beneath afresh.
   */
  export type HookStream<C, R> = AsyncGenerator<C, R> & {
      /**
       * Settles with what beneath returned once the stream has been read to
       * its end; rejects if the stream is closed before that.
       */
      readonly result: Promise<R>;
  };

  /**
   * Options of `$.http.fetch`.
   */
  export type HttpInit = {
      /**
       * `GET` (default), `POST`, ...
       */
      method?: string;
      /**
       * Request headers.
       */
      headers?: Record<string, string>;
      /**
       * The request body, as text.
       */
      body?: string;
      /**
       * The handle `$.session.authorize()` answered: the engine sets the
       * session's credential header itself, only for a first-party host.
       */
      auth?: string;
      /**
       * The absolute path of a Unix domain socket the request goes over instead
       * of TCP (near 100 B at most): one per session, in a private directory.
       *
       * The URL still gives path, query and Host; redirects stay on it; no proxy;
       * `https:` is TLS verified against the URL's host (always, once `auth`
       * rides), so a credential reaches only its host. No relative path, no NUL.
       *
       * @example
       * await $.http.fetch(url, { socketPath: `${runDirectory}/bridge.sock` })
       */
      socketPath?: string;
  };

  /**
   * What `$.http.fetch` resolves with.
   */
  export type HttpResponse = {
      /**
       * The HTTP status code.
       */
      status: number;
      /**
       * True for a 2xx status.
       */
      ok: boolean;
      /**
       * Response headers, lower-cased names.
       */
      headers: Record<string, string>;
      /**
       * The body, as text.
       */
      text: string;
  };

  /**
   * A `$.ui.blit` argument swapping one of the caller's mounted keyed Images
   * to its next picture; every call sends it, so a stream needs no generation.
   *
   * The surface writes them with its frames, some sixty a second: byte and
   * `file` sources fold to the last per frame; every `shm` source reaches the
   * terminal (it unlinks each), and is denied while frames are not written.
   *
   * @example await $.ui.blit({ requestId: 'browser', key: 'view',
   *   source: { shm: '/tb-4', format: 'rgb', width: 1280, height: 720 } })
   */
  export type ImageBlitArgs = {
      /**
       * The site the Image is drawn in, by the `requestId` this plugin draws it
       * under.
       */
      requestId: string;
      /**
       * The Image's `key` in that drawing.
       */
      key: string;
      /**
       * The next picture (ImageSource): bytes, or a name the terminal reads.
       */
      source: ImageSource;
      /**
       * Refused unless it is the mounted Image's width in cells. Absent, that.
       */
      columns?: number;
      /**
       * Refused unless it is the mounted Image's height in cells. Absent, that.
       */
      rows?: number;
  };

  /**
   * The props of `Image`, the terminal surface's picture leaf: pixels over a
   * box of cells where the terminal can (kitty, Ghostty), the `alt` elsewhere.
   *
   * A leaf: no children, `hover` or `onPress`; the cells are text, so the
   * picture scrolls and clips as a word does. Drawn again with another `source`
   * it is replaced in place; keyed, `$.ui.blit` swaps it at the frame rate.
   *
   * @example const { bytes } = await $.fs.read('chart.png', { as: 'bytes' })
   * <Image source={{ png: bytes.toBase64() }} columns={40} rows={12} alt="p95" />
   * @example <Image key="view" source={{ shm: '/tb-7', format: 'rgb', width: 960,
   *   height: 600 }} columns={80} rows={25} alt="the page" />
   */
  export type ImageProps = {
      /**
       * The element's address within the drawing: what `$.ui.blit` names to swap.
       *
       * Unique among the Images of one tree; absent, only a redraw changes it.
       */
      key?: string;
      /**
       * The picture (ImageSource): `{ png }` or `{ rgba, width, height }` bytes,
       * or `{ file, format }` / `{ shm, format, width, height }` read here.
       */
      source: ImageSource;
      /** How many terminal columns wide, 1 to 255; the picture is scaled to fill
       * the box and the site clips what its body cannot show. */
      columns: number;
      /**
       * How many terminal rows tall, 1 to 255.
       */
      rows: number;
      /**
       * What the picture says, drawn dim in its place where the picture cannot
       * be (and read by a screen reader); required, may be a single space.
       */
      alt: string;
  };

  /**
   * The picture an `Image` shows: base64 bytes the plugin holds (at most 2 MiB
   * decoded), or the name of a file or POSIX shared-memory object it does not.
   *
   * A name is one another process on this machine wrote; the terminal, running
   * as the person, opens, reads and decodes it itself, so no pixel crosses `$`
   * and the engine never touches it. One it will not read (not a regular file,
   * under `/proc`, `/sys` or `/dev`, gone, across ssh) draws a blank box, its
   * words in the debug log; it unlinks a shared-memory object once read, so
   * each frame is a fresh one. A source equal to the last drawn sends nothing;
   * `generation` makes new content under an unchanged name a new source.
   *
   * @example { rgba: pixels.toBase64(), width: 64, height: 32 }
   * @example { file: '/dev/shm/frame-3.rgba', format: 'rgba', width: 640,
   *   height: 400 }
   * @example { shm: '/tb-view-2', format: 'rgb', width: 1280, height: 720 }
   */
  export type ImageSource = {
      /**
       * A whole PNG file, base64.
       */
      png: string;
  } | {
      /**
       * `width * height` RGBA pixels, 4 bytes each, base64.
       */
      rgba: string;
      /**
       * Pixels per row, 1 to 2048.
       */
      width: number;
      /**
       * Rows of pixels, 1 to 2048.
       */
      height: number;
  } | {
      /**
       * The absolute path of a regular file holding a whole PNG, at most
       * 3072 bytes of path; read by the terminal, left in place.
       */
      file: string;
      /**
       * The file is a whole PNG; the terminal decodes it and sizes it itself.
       */
      format: 'png';
      /**
       * A whole number that changes when the file's content does under the
       * same path, so a redraw reads it again; absent, the path alone tells.
       */
      generation?: number;
  } | {
      /**
       * The absolute path of a regular file of `width * height` raw pixels, at
       * most 3072 bytes of path; read by the terminal, left in place.
       *
       * On Linux a file under `/dev/shm` is memory.
       */
      file: string;
      /**
       * `rgba`, 4 bytes a pixel, or `rgb`, 3.
       */
      format: 'rgba' | 'rgb';
      /**
       * Pixels per row, 1 to 4096.
       */
      width: number;
      /**
       * Rows of pixels, 1 to 4096.
       */
      height: number;
      /**
       * A whole number that changes when the file's content does under the
       * same path, so a redraw reads it again; absent, the path alone tells.
       */
      generation?: number;
  } | {
      /**
       * The name of a POSIX shared-memory object of `width * height` raw
       * pixels: `/` then up to 254 of `A-Z a-z 0-9 . _ -` (macOS takes 30).
       *
       * The terminal unlinks it after reading, so a name feeds one Image
       * drawn once and is never sent again on a redraw; POSIX terminals only.
       */
      shm: string;
      /**
       * `rgba`, 4 bytes a pixel, or `rgb`, 3.
       */
      format: 'rgba' | 'rgb';
      /**
       * Pixels per row, 1 to 4096.
       */
      width: number;
      /**
       * Rows of pixels, 1 to 4096.
       */
      height: number;
      /**
       * A whole number that changes when a fresh object reuses a name, so a
       * redraw reads it again; absent, the name alone tells.
       */
      generation?: number;
  };

  /**
   * The keys of object pattern `P` that object member `E` cannot satisfy, `D`
   * levels down; `never` when there is none, which is what keeps the member.
   *
   * A key `E` does not have (an open record has every string key), or one
   * whose value `P` narrows to nothing.
   */
  type ImpossibleKeys<E, P, D extends readonly unknown[]> = {
      [K in keyof P]-?: K extends keyof E ? [NarrowedValue<Exclude<E[K], undefined>, P[K], D>] extends [never] ? K : never : K;
  }[keyof P];

  /**
   * The props of `Input`, every surface's one-line text field: an address,
   * optional texts, and the closures a change and a submit run. A leaf.
   *
   * Focused through the same ring as `Button` (`abovePrompt:focus`); while it
   * has focus every printable key reaches it alone and Esc returns them; a
   * change and Enter raise `ui.input`, whose bottom is `onInput` / `onSubmit`.
   */
  export type InputProps = {
      /**
       * The element's address: `e.element` at `ui.input`, what a matcher names.
       */
      key: string;
      /**
       * Text drawn before the field.
       */
      label?: string;
      /**
       * Text drawn dim in an empty field.
       */
      placeholder?: string;
      /**
       * The text the field holds when drawn; the person's typing replaces it
       * until the hook draws another.
       */
      value?: string;
      /**
       * What Enter does, in a word or two, drawn beside the field while it has
       * focus (`send`). Defaults to `submit`.
       */
      submitLabel?: string;
      /**
       * The site's focus ring starts here when the site takes the keyboard,
       * instead of on nothing, as the DOM's `autofocus`: Enter acts on it at once.
       *
       * A pane opened with `focus`, or the person's focus chord or click, is the
       * take. Of several in one site the first drawn wins; it raises `ui.focus`,
       * origin this plugin. A ring the person has moved stays where it was put.
       */
      autoFocus?: true;
      /**
       * Runs on every change of the text, in the plugin's own environment: the
       * bottom of a `ui.input` chain of kind `change`.
       */
      onInput?: (value: string, e: UiInputArgument) => void;
      /**
       * Runs on Enter with the text, in the plugin's own environment: the bottom
       * of a `ui.input` chain of kind `submit`. No model turn unless it asks one.
       */
      onSubmit: (value: string, e: UiInputArgument) => void;
  };

  /**
   * Every tier an instruction file can belong to, for checking a hook's
   * answer; the kind type is derived from this list.
   */
  const INSTRUCTION_FILE_KINDS: readonly ["managed", "user", "project", "local", "memory"];

  /**
   * One instruction file behind the `claudeMd` block: where it was read, its
   * tier, its text as loaded, and the file that `@`-imported it if one did.
   */
  export type InstructionFile = {
      /**
       * The file's path, absolute.
       */
      path: string;
      /**
       * Its tier.
       */
      kind: InstructionFileKind;
      /**
       * The text as loaded (comments and frontmatter already stripped).
       */
      content: string;
      /**
       * The path of the file whose `@` import brought this one, when one did.
       */
      parent?: string;
  };

  /**
   * What tier an instruction file belongs to: the organization's managed
   * policy, the person's own, the project's checked-in or private ones, memory.
   */
  export type InstructionFileKind = (typeof INSTRUCTION_FILE_KINDS)[number];

  type InstructionsLoadedHookInput = BaseHookInput & {
      hook_event_name: 'InstructionsLoaded';
      file_path: string;
      memory_type: 'User' | 'Project' | 'Local' | 'Managed';
      load_reason: 'session_start' | 'nested_traversal' | 'path_glob_match' | 'include' | 'compact';
      globs?: string[];
      trigger_file_path?: string;
      parent_file_path?: string;
  };

  /**
   * What `$.ui.invalidate` takes: a render event, or one of the six events
   * whose answers the engine caches for the session.
   */
  export type InvalidatableEventName = RenderEventName | 'prompt.section' | 'prompt.context' | 'prompt.attachment' | 'tool.describe' | 'command.describe' | 'config.describe';

  /**
   * Whether tag key `K` selects members of `I`: it does when each member gives
   * it ONE literal (`component: "ToolUse"` on the ToolUse variant).
   *
   * A key that is the same union on every member is a filter at runtime; it
   * is left out of the selection so that it cannot defeat the narrowing the
   * other keys give.
   */
  type IsDiscriminant<I, K> = I extends unknown ? K extends KnownKeys<I> ? IsSingleLiteral<I[K]> : true : never;

  /**
   * Whether `V` is made of literals only: `"a" | "b"` is, `string` is not.
   */
  type IsLiteralValued<V> = string extends V ? false : number extends V ? false : boolean extends V ? false : [V] extends [string | number | boolean] ? true : false;

  /**
   * Whether `V` is exactly one string, number or boolean literal.
   */
  type IsSingleLiteral<V> = [V] extends [string | number | boolean] ? IsUnion<V> extends true ? false : true : false;

  /**
   * Whether `T` is a union of two or more members.
   */
  type IsUnion<T, U = T> = T extends unknown ? [U] extends [T] ? false : true : never;

  /**
   * Plain data: what JSON holds, and what crosses between a plugin's hooks
   * module and its surface module whole (a `Client`'s props, a post's data).
   *
   * A function, a class instance, `undefined` or a cycle is not plain data;
   * the engine refuses one where it checks, and drops it where it clones.
   */
  export type JsonValue = string | number | boolean | null | readonly JsonValue[] | {
      readonly [key: string]: JsonValue;
  };

  /**
   * What `next` takes in a matched hook: the variants of `e` the matcher can
   * match (KeptMembers), as declared, so a rewrite of a pinned field passes.
   */
  type KeptEvent<P extends Pattern, M> = MatchedNames<P, M> extends infer N extends EventName ? N extends unknown ? KeptMembers<Args<N>, M> : never : never;

  /**
   * The members of the argument union `E` matcher `P` can match, as declared;
   * what `next` takes, so a rewrite may change a field the matcher pinned.
   *
   * A member is dropped when `P` names a key it lacks, or gives a key, at any
   * depth, a value none of that key's values can equal (ImpossibleKeys).
   */
  type KeptMembers<E, P> = E extends unknown ? [ImpossibleKeys<E, P, []>] extends [never] ? E : never : never;

  /**
   * The declared keys of `T`, the string and number index signatures left out.
   */
  type KnownKeys<T> = keyof {
      [K in keyof T as string extends K ? never : number extends K ? never : K]: 0;
  };

  /**
   * The events whose overload must come after the rest, lest it shadow them.
   *
   * `classic.PreToolUse` shares `tool.call`'s envelope, `turn.abort` every
   * turn event's `turnId`, and an object of any shape is assignable to NoArgs.
   */
  type LateOverload = 'classic.PreToolUse' | 'turn.abort' | NoArgsEvent;

  /**
   * The props of `Link`, a hyperlink every surface draws: an OSC 8 span on the
   * terminal (else its text then the URL in dim), an anchor on desktop.
   *
   * An inline element: its children are the text, strings and inline
   * elements; absent children the `label`, absent both the URL. The engine
   * bounds `href` before the tree crosses.
   */
  export type LinkProps = {
      /**
       * Where the link goes: an `https:` URL (or `http://localhost`), at most
       * 2048 characters of printable ASCII, spelled as `new URL(href).href`.
       *
       * No `user@host` part, no raw `@`, space or non-ASCII letter (encode them);
       * anything else refuses the tree the Link is in.
       */
      href: string;
      /**
       * The text drawn when the element has no children; absent both, the URL
       * itself is the text.
       */
      label?: string;
  };

  /**
   * What a matcher value selects by: itself, or `unknown` for a RegExp, which
   * selects nothing.
   */
  type Literal<X> = X extends RegExp ? unknown : X;

  /**
   * What a `Markdown` carries across the boundary: its address, text, dimness
   * and which links it answers; `onLinkPress` stays behind, a `press` instead.
   */
  export type MarkdownLeafProps = {
      /**
       * The element's address: what `e.element` carries and what a matcher
       * names; present whenever the element carries a `press`.
       */
      key?: string;
      /**
       * The markdown drawn, bounded as a Text's string is.
       */
      text: string;
      /**
       * The whole block dim, as `Text`'s `dimColor`; absent draws as false.
       */
      dimColor?: boolean;
      /**
       * Which links a press belongs to, by `href` as written; absent, with a
       * `press`, every link drawn. Compared with the pressed target only.
       */
      pressableLinks?: readonly string[];
  };

  /**
   * The props of `Markdown`, a block of markdown every surface draws as it
   * draws an assistant reply's text: its own renderer, links, tables, fences.
   *
   * A leaf: no children. `text` is the element's data as a `Text`'s string is,
   * bounded the same way. With `onLinkPress` the links it draws are the
   * plugin's to answer: a press on one raises `ui.press` addressed to `key`.
   */
  export type MarkdownProps = {
      /**
       * The element's address: `e.element` at `ui.press`, what a matcher names.
       * Required with `onLinkPress`, since a press needs one; else optional.
       */
      key?: string;
      /**
       * The markdown drawn, as an assistant reply would write it.
       *
       * At most 10000 characters, tab and newline its only control characters;
       * a link whose scheme is not `https:`, `http:` or `file:` draws as text,
       * never clickable. Not drawn around the approval dialog.
       */
      text: string;
      /**
       * The whole block dim, as `Text`'s `dimColor`: a thought, an aside.
       */
      dimColor?: boolean;
      /**
       * What a press on a link in `text` runs, in the plugin's own environment:
       * the bottom of a `ui.press` chain whose `e.link` names the link.
       *
       * A press is a plain single click where the surface reports clicks (the
       * fullscreen terminal): it opens nothing and lands once no double-click
       * followed; a ctrl, alt or terminal-kept cmd click opens it as before.
       */
      onLinkPress?: (link: PressedLink, e: UiPressArgument) => void;
      /**
       * Which links in `text` a press belongs to, by `href` as the markdown
       * writes it; absent, every link drawn. Only with `onLinkPress`.
       *
       * A link left out keeps the surface's own behaviour. At most 256 entries
       * of at most 2048 characters; compared with the pressed link's target,
       * never opened.
       */
      pressableLinks?: readonly string[];
  };

  /**
   * The argument a matched hook receives: `e` narrowed by `M` (Narrowed), per
   * event the registration covers.
   */
  export type MatchedEvent<P extends Pattern, M> = MatchedNames<P, M> extends infer N extends EventName ? N extends unknown ? Narrowed<Args<N>, M> : never : never;

  /**
   * The hook `on(pattern, matcher, hook)` takes: `($, e, next)` with `e`
   * narrowed by the matcher (MatchedEvent), and a tagged result the same way.
   *
   * On a streaming event it is the generator form (MatchedStreamHook). `next`
   * takes the variants the matcher keeps, as declared (KeptEvent); `next.is`
   * names the events the registration covers and narrows as the matcher does.
   */
  export type MatchedHook<P extends Pattern, M> = P extends StreamingEventName ? MatchedStreamHook<P, M> : ($: EngineInterface, e: Frozen<MatchedEvent<P, M>>, next: Next<MatchedNames<P, M>, KeptEvent<P, M>, MatchedResult<P, M>, {
      [K in MatchedNames<P, M>]: Narrowed<Args<K>, M>;
  }>) => MatchedResult<P, M> | Promise<MatchedResult<P, M>>;

  /**
   * The events a matched registration on `P` covers: the event named, or for a
   * glob every selected event whose input has each key the matcher names.
   */
  type MatchedNames<P, M = never> = P extends EventName ? P : {
      [N in Selected<P & string>]: [M] extends [never] ? N : keyof M extends AnyKeyOf<Args<N>> ? N : never;
  }[Selected<P & string>];

  /**
   * What a matched hook returns: the event's result, narrowed by `M` where the
   * result is a union tagged by the matcher's tag keys.
   */
  export type MatchedResult<P extends Pattern, M> = MatchedNames<P, M> extends infer N extends EventName ? N extends unknown ? Select<EventResult<N>, Selection<Args<N>, M>> : never : never;

  /**
   * The hook `on(event, matcher, hook)` takes on a streaming event: the
   * generator form, `e` narrowed by the matcher, `next(e)` the stream beneath.
   */
  export type MatchedStreamHook<P extends StreamingEventName, M> = ($: EngineInterface, e: Frozen<MatchedEvent<P, M>>, next: MatchedStreamNext<P, M>) => StreamHookBody<Chunk<P>, MatchedResult<P, M>>;

  /**
   * What a matched streaming hook's `next.is(pattern, e)` narrows `e` to:
   * the streaming event's argument narrowed by the matcher.
   */
  type MatchedStreamNarrowings<P extends StreamingEventName, M> = {
      [K in P]: Narrowed<Args<K>, M>;
  };

  /**
   * A matched streaming hook's `next`: the variants the matcher keeps, the
   * result tagged the same way, `next.is` narrowing as the matcher does.
   */
  type MatchedStreamNext<P extends StreamingEventName, M> = StreamNext<P, KeptEvent<P, M>, MatchedResult<P, M>, MatchedStreamNarrowings<P, M>>;

  /**
   * What `on(event, matcher, hook)` takes for an argument of type `I`: the
   * shape of the `e` the hook wants, a partial of it at any depth.
   *
   * A leaf is `===` or a RegExp (`{ command: /^p4 / }`); an array is any-of;
   * an object is a partial of an OBJECT, so `{ command: { startsWith } }` is
   * a type error where `e` is typed and free where it is `unknown`.
   */
  export type Matcher<I, All = I> = I extends unknown ? {
      readonly [K in KnownKeys<I>]?: MatcherValue<I[K], MatcherValueOf<All, K>>;
  } & (string extends keyof I ? OpenMatcher<I, All> : unknown) : never;

  /**
   * Any matcher at all, for a field typed `unknown` (a tool's input, a
   * result's output): the kinds the engine accepts, unchecked there.
   *
   * The four kinds: a scalar is `===`; a RegExp tests the value as a string
   * (`{ command: /^p4 / }`); an array matches if any element does; an object
   * is a partial of an object. `{ startsWith: 'p4' }` never matches a string.
   */
  type MatcherData = string | number | boolean | null | RegExp | readonly MatcherData[] | {
      readonly [key: string]: MatcherData;
  };

  /**
   * The declared keys of every variant of `I` (index signatures aside).
   */
  type MatcherKeys<I> = I extends unknown ? KnownKeys<I> : never;

  /**
   * What matches one value of type `V`, by the runtime's kinds:
   * a scalar leaf takes the value or a RegExp; an object, a partial of it.
   *
   * For an array, what matches one ELEMENT of it, since a pattern against an
   * array value holds when some element matches; for `unknown`, any matcher.
   * A scalar matches by `===`, a RegExp tests the value as a string.
   */
  type MatcherOne<V> = unknown extends V ? MatcherData : V extends readonly (infer Item)[] ? MatcherOne<Item> : V extends string | number | boolean | null ? V | RegExp : V extends object ? Matcher<V> : V extends undefined ? never : unknown;

  /**
   * What a matcher gives a key whose value is `V` on this variant and `Across`
   * over every variant: one MatcherOne, or an array of them matched as one-of.
   *
   * The one-of is typed over every variant, so `{ tool: ['Bash', 'Read'] }`
   * types on the Bash variant; with a nested pattern beside it, the pattern is
   * checked against a variant the one-of names, not against each of them.
   */
  type MatcherValue<V, Across = V> = MatcherOne<V> | readonly MatcherOne<Across>[];

  /**
   * The type of key `K` across the variants of `I` that declare it.
   */
  type MatcherValueOf<I, K> = I extends unknown ? K extends KnownKeys<I> ? I[K] : never : never;

  /**
   * One block of an MCP result: `type` and the fields that kind of block carries.
   */
  export type McpContentBlock = {
      /**
       * The block's kind: `text`, `image`, `audio`, `resource`, `resource_link`.
       */
      type: string;
      /**
       * Set on a `text` block.
       */
      text?: string;
      /**
       * Set on a `resource_link` (or embedded `resource`) block.
       */
      uri?: string;
      /**
       * Declared by an image, audio or resource block.
       */
      mimeType?: string;
      [field: string]: unknown;
  };

  /**
   * The MCP server serving this tool, for `mcp__*` tools: `name` is the server's config key (for `source: "sdk"`, exactly the name the SDK host registered in `sdkMcpServers` / `mcp_set_servers`; for any other source, the key as authored in that configuration - untrusted text, the same value `mcp_status` and system/init report, to be escaped before display), `source` is where its definition came from - `sdk` (an in-process server the SDK host runs; only the host can register one, so a configured server of the same name never reads `sdk`), `plugin` (a server a plugin ships or registers at runtime), or a config scope (`user`, `project`, `local`, `dynamic` for --mcp-config / `mcp_set_servers` process servers, `managed`, `enterprise`, `claudeai`, `agent`). Key trust on `source`, not on the name or the tool-name prefix. Absent for non-MCP tools.
   */
  type McpServerProvenance = {
      name: string;
      /**
       * sdk | plugin | user | project | local | dynamic | managed | enterprise | claudeai | agent - an open set; treat unknown values as an unrecognized configured source, never as sdk.
       */
      source: string;
  };

  /**
   * The MCP branch of a `tool.call` hook's `e` (and of `$.tool.call`'s input):
   * one variant per declared tool, else the loose McpToolCallInputFallback.
   *
   * `$.mcp.call(server, tool, args)` takes none of these: its parameters are
   * positional, the server and tool by name, then the arguments object.
   */
  export type McpToolCallInput = [keyof McpToolInputs] extends [never] ? McpToolCallInputFallback : {
      [N in keyof McpToolInputs & string]: ToolInputOf<N, McpToolInputs[N] & Record<string, unknown>>;
  }[keyof McpToolInputs & string];

  /**
   * The `e` a `tool.call` (or `classic.PreToolUse`) hook receives for an MCP
   * tool while no MCP tool is declared: every `mcp__*` name, loose arguments.
   *
   * McpToolInputs has no entries until `/plugin-types` writes the connected
   * tools' declarations; also the `input` of `$.tool.call({ tool:
   * "mcp__<server>__<tool>", ... })`. Not `$.mcp.call`'s, which is positional:
   *
   * @example
   * on("tool.call", { tool: "mcp__gh__issue" }, ($, e, next) => audit(e.title))
   */
  type McpToolCallInputFallback = {
      /**
       * The name of the tool being called (`mcp__<server>__<tool>`); comparing
       * it narrows `e`. Reserved: a rewrite of it is ignored by core.
       */
      tool: McpToolName;
      /**
       * The tool_use block's id: the same at every event of the call and in
       * `$.ui.notice`. Reserved: a rewrite of it is ignored by core.
       */
      tool_use_id: string;
      [argument: string]: unknown;
  };

  /**
   * The inputs of the MCP tools this project knows, keyed by full tool name,
   * for declaration merging; empty by default, then every MCP tool is loose.
   *
   * A `.d.ts` in the plugin author's project (written by `/plugin-types <dir>`
   * from the connected servers' JSON Schemas, or by hand) adds entries under
   * `declare module "claude-code"`; `e.tool === <name>` then narrows to them.
   *
   * @example
   * interface McpToolInputs { "mcp__my_server__send": { to: string } }
   */
  export interface McpToolInputs {
  }

  /**
   * The name of an MCP tool as the engine spells it: `mcp__<server>__<tool>`.
   */
  export type McpToolName = `mcp__${string}__${string}`;

  /**
   * An MCP tools/call result as the SDK returns it, plain data.
   */
  export type McpToolResult = {
      /**
       * The result's content blocks, in order (text, image, resource,
       * resource_link, ...).
       */
      content: McpContentBlock[];
      /**
       * True when the server reported the call as failed; the blocks then describe
       * the error.
       */
      isError: boolean;
      /**
       * The server's structured result, when its tool declares an output schema.
       */
      structuredContent?: unknown;
  };

  /**
   * Hook input for the MessageDisplay event. Fired with each batch of newly completed lines while an assistant message streams. Display-only: the stored message and what the model sees are untouched.
   */
  type MessageDisplayHookInput = BaseHookInput & {
      hook_event_name: 'MessageDisplay';
      /**
       * UUID of the current turn.
       */
      turn_id: string;
      /**
       * UUID of the assistant message being displayed. Stable across every flush of the same message. Not the API msg_... id.
       */
      message_id: string;
      /**
       * Zero-based index of this delta within the message. Increments by one per flush.
       */
      index: number;
      /**
       * True on the message's last flush. Exactly one flush per message has it.
       */
      final: boolean;
      /**
       * The newly completed lines since the prior flush. Always whole lines, except on the final flush which may end mid-line. The delta of the final flush is empty when the message ends on a newline; treat final as the end-of-message signal regardless.
       */
      delta: string;
  };

  /**
   * What `$.model.complete` takes.
   */
  export type ModelCompleteRequest = {
      /**
       * An alias (`haiku`) or a full model id; resolved and allowlist-checked like
       * a `--model` value.
       */
      model: string;
      /**
       * The one user message; the reply's text comes back.
       */
      prompt: string;
      /**
       * Precedes the completion as its system prompt, after the CLI's identity
       * block. Default none.
       */
      system?: string;
      /**
       * The reply's token cap: any positive integer up to what one reply can
       * hold, the model's own output limit or 64000, whichever is lower.
       *
       * Default 1024. The reply comes back whole, not streamed, and a provider
       * ends such a request at ten minutes, hence the 64000. One past the limit
       * is refused, naming it.
       */
      maxTokens?: number;
  };

  /**
   * What `$.model.fork` takes.
   */
  export type ModelForkRequest = {
      /**
       * The one user message, appended to the session's own transcript.
       *
       * The reply's text and usage come back, or null on an API error or a cold
       * transcript.
       */
      prompt: string;
  };

  /**
   * What `$.model.fork` resolves to when the fork answered: the reply's text
   * and what the fork cost.
   */
  export type ModelForkResult = {
      /**
       * The non-error replies' text, joined by newlines.
       */
      text: string;
      /**
       * The fork's token counts, so a plugin can account for what it spent.
       */
      usage: ModelForkUsage;
  };

  /**
   * What one fork cost, as the API counted it: the four token counts of the
   * fork's completions summed.
   */
  export type ModelForkUsage = {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens: number;
      cache_creation_input_tokens: number;
  };

  /**
   * The prefixes a glob may name: one or more whole leading segments of an
   * event name (`tool` of `tool.call`), derived, plugin nouns included.
   */
  export type Namespace<N extends string = EventName> = N extends `${infer Head}.${infer Rest}` ? Head | `${Head}.${Namespace<Rest>}` : never;

  /**
   * How many object or array levels a matcher narrows `e` through, counted as
   * a tuple's length: the runtime's own limit, which refuses a deeper matcher.
   *
   * Past it a field keeps its declared type; nothing becomes `any`.
   */
  type NarrowDepth = 8;

  /**
   * `e` in a matched hook: the members of the argument union `E` matcher `P`
   * can match, each with the keys `P` names narrowed to what a match implies.
   *
   * A scalar narrows to the literal, a one-of to what its alternatives give,
   * an object key recursively, an array some element of which must match to
   * a non-empty tuple; other keys, `unknown` and RegExp-matched fields keep.
   */
  export type Narrowed<E, P> = E extends unknown ? NarrowedMember<E, P, []> : never;

  /**
   * A value of declared type `V` under a one-of, folded over the tuple into
   * `Found`: the union of what each alternative narrows `V` to (NarrowedByOne).
   *
   * An alternative that cannot match adds nothing, so a one-of none of whose
   * alternatives can is `never`; a one-of typed as a plain array rather than
   * a tuple narrows by the union of its elements at once.
   */
  type NarrowedByAny<V, Alternatives extends readonly unknown[], D extends readonly unknown[], Found = never> = Alternatives extends readonly [infer First, ...infer Rest] ? NarrowedByAny<V, Rest, D, Found | NarrowedByOne<V, First, D>> : Alternatives extends readonly [] ? Found : Found | NarrowedByOne<V, Alternatives[number], D>;

  /**
   * A value of declared type `V` under one matcher node `Q` that is not a
   * one-of, member of `V` by member; a member that cannot match is `never`.
   *
   * An array some element of which must match becomes NonEmpty; a RegExp
   * keeps the member; an object pattern recurses into an object member, one
   * level down; a scalar keeps a member as narrow, and replaces a wider one.
   */
  type NarrowedByOne<V, Q, D extends readonly unknown[]> = V extends readonly (infer Item)[] ? [NarrowedValue<Item, Q, [...D, unknown]>] extends [never] ? never : NonEmpty<V, Item> : Q extends RegExp ? V : Q extends object ? V extends object ? NarrowedMember<V, Q, [...D, unknown]> : never : V extends Q ? V : Q extends V ? Q : never;

  /**
   * One object member `E` under object pattern `P`, `D` levels down: `never`
   * when a key of `P` is impossible on it (ImpossibleKeys), else `E` narrowed.
   *
   * Each key `P` names is narrowed (NarrowedValue); every other key, and each
   * key's optionality, stays as declared.
   */
  type NarrowedMember<E, P, D extends readonly unknown[]> = [
  ImpossibleKeys<E, P, D>
  ] extends [never] ? {
      [K in keyof E]: K extends keyof P ? NarrowedValue<E[K], P[K], D> : E[K];
  } : never;

  /**
   * A value of declared type `V` where the matcher gives `Q`, `D` levels
   * down: NarrowedByAny under a one-of (an array), NarrowedByOne otherwise.
   *
   * As declared once `D` reaches NarrowDepth, or for a field typed `unknown`
   * (a tool's input), which no pattern narrows.
   */
  type NarrowedValue<V, Q, D extends readonly unknown[]> = D['length'] extends NarrowDepth ? V : unknown extends V ? V : Q extends readonly unknown[] ? NarrowedByAny<V, Q, D> : NarrowedByOne<V, Q, D>;

  /**
   * `!` before a name or a glob: every event except the ones it selects. `!*`
   * would select none, so it is no pattern.
   */
  type Negation = `!${Exclude<EventName | Glob, '*'>}`;

  /**
   * The rest of the chain, as one hook receives it: made once per dispatch per
   * hook, frozen; `next(e)` resolves to the downstream result.
   *
   * Each call runs the hooks below again; core is the last, and below it `next`
   * rejects. Called with no argument it rejects, naming the hook. A hook that
   * returns without calling it ends the chain; returning nothing is a failure.
   *
   * @template S what `next.is(pattern, e)` narrows `e` to, per event: the event's
   *   argument, or, under a matcher, that argument narrowed by it (MatchedHook)
   * @template T the tool `e` names, when it names one: on `tool.call` it types
   *   the result (NextResultFor); an `e` without `tool` takes the line beneath
   */
  export type Next<N extends EventName = EventName, E = Args<N>, O = NextResult<N>, S extends {
      [K in N]?: unknown;
  } = {
      [K in N]: Args<K>;
  }> = {
      <T extends string>(e: E & ToolNamed<T>): Promise<NextResultFor<N, O, T>>;
      (e: E): Promise<O>;
      /**
       * Continues this dispatch at a tier: `next(e)` with every link between
       * this hook's own tier and that one skipped, by tier and narrowing only.
       *
       * A managed hook's: prepend may name append, builtin or core, append core;
       * it never skips a tier with more authority, so no user hook skips the
       * org's. A literal on the hook's own `next`; skipped links are traced.
       */
      readonly to: {
          <T extends string>(e: E & ToolNamed<T>, tier: TargetTier): Promise<NextResultFor<N, O, T>>;
          (e: E, tier: TargetTier): Promise<O>;
      };
      /**
       * Aborts when the call this dispatch belongs to is abandoned: the user
       * interrupted, a hook above settled first, or this hook ran out of budget.
       *
       * Anything the hook started (timers, requests) should stop on it. It is an
       * AbortSignal of the plugin's own environment, driven by the chain's.
       */
      readonly signal: AbortSignal;
      /**
       * Whether this dispatch's event is selected by `pattern` (a name, a glob,
       * a negation), as a type predicate on `e`: `next.is("tool.call", e)`.
       *
       * Under a matcher the narrowing includes it. `pattern` names events this
       * hook covers (PatternOver); a name outside them is a compile error.
       */
      readonly is: <M extends PatternOver<N>>(pattern: M, e: unknown) => e is Frozen<S[Extract<N, Selected<M>>]>;
      /**
       * The name of this dispatch's event, as a value, for a glob hook to log or
       * switch on.
       */
      readonly event: N;
      /**
       * Who raised this dispatch: the calling plugin's name and the tier it sits
       * in (Origin); the engine reads `{ plugin: "engine", tier: "core" }`.
       *
       * Set by the host alone, from the environment the call came from (its own
       * MessagePort) and that plugin's seat; nothing a plugin writes reaches it.
       * Every hook of one dispatch sees the same origin, and `next.to` keeps it.
       *
       * @example
       * return next.origin.tier === "prepend" ? next.to(e, "append") : next(e)
       */
      readonly origin: Origin;
      /**
       * What settled beneath this hook on its latest `next()` call, the one
       * started last: an entry per link beneath, nearest first, the engine's last.
       *
       * Empty before `next` is called; filled even when `next` rejected; a link
       * still running joins in place later, nothing listed leaves; it ends short
       * of the engine at a link that answered its last call itself. Data, frozen.
       */
      readonly trace: readonly TraceEntry<N, E, O>[];
      /**
       * How much time this hook runs under and how much is left (NextBudget),
       * read fresh on each access; HookBudget says what the clock counts.
       *
       * It stands still while a `next` or `$` call of the hook's is in flight;
       * in a `.catch` handler it is the grace, `ms` being `next.error.budget`.
       *
       * @example
       * if (next.budget.remainingMs < 2_000) return next(e) // skip the polish
       */
      readonly budget: NextBudget;
  };

  /**
   * The budget the code reading `next.budget` runs under: the whole allowance
   * and what is left of it now, plain data read fresh on each access.
   *
   * In a hook `ms` is HookBudget's `ms`; in a `.catch` handler its `catchMs`
   * (equal to `next.error.budget`); on a `next` nothing meters (the engine's
   * own, a test's root one) `ms` is 0 and `remainingMs` Infinity.
   *
   * @example
   * if (next.budget.remainingMs < 2_000) return next(e) // skip the slow path
   */
  export type NextBudget = {
      /**
       * The whole budget in milliseconds; 0 where nothing meters this `next`.
       */
      readonly ms: number;
      /**
       * What is left of it now, in milliseconds, never below 0; Infinity where
       * nothing meters. It stands still while a `next` or `$` call is in flight.
       */
      readonly remainingMs: number;
  };

  /**
   * What `next(e)` resolves to for event `N`: the event's result, except at
   * `engine.create`, where the steps beneath return `$` as built so far.
   *
   * A withheld noun is on that `$` as a stub, so the built table is typed
   * whole where what a hook returns (EngineCreateResult) is partial.
   */
  export type NextResult<N extends EventName> = N extends 'engine.create' ? EngineInterfaceBuilt : EventResult<N>;

  /**
   * What `next(e)` resolves to once `e.tool` is the literal `T`: on `tool.call`
   * the result typed for that tool; on every other event, `O` as declared.
   *
   * `result` is Bash's record after `e.tool === "Bash"`; an un-narrowed `e`
   * names every tool, and `result` stays `unknown`.
   */
  export type NextResultFor<N extends EventName, O, T extends string> = [
  N
  ] extends ['tool.call'] ? ToolCallResult<T> : O;

  /**
   * The argument of a call on `$` that takes nothing (`$.session.cwd()`): an
   * object with no keys.
   */
  type NoArgs = Record<never, never>;

  /**
   * The events whose argument is exactly NoArgs (`session.cwd`, a declared
   * plugin noun's `() => ...`); their overloads come last (LateOverload).
   */
  type NoArgsEvent = {
      [N in EventName]: Args<N> extends NoArgs ? NoArgs extends Args<N> ? N : never : never;
  }[EventName];

  /**
   * What an `engine.create` hook receives as `$`: nothing. Every property
   * reads as `never`, so `$.model` inside the hook is a compile error.
   */
  export type NoEngineInterface = {
      readonly [noun: string]: never;
  };

  /**
   * Array type `V`, of element `Item`, once some element of it is known to
   * match: a tuple of at least one `Item`, readonly when `V` is.
   *
   * So `e` still passes wherever the declared array is taken; a `V` that is
   * already a non-empty tuple is kept as it is.
   */
  type NonEmpty<V, Item> = V extends readonly [unknown, ...unknown[]] ? V : V extends Item[] ? [Item, ...Item[]] : readonly [Item, ...Item[]];

  type NotificationHookInput = BaseHookInput & {
      hook_event_name: 'Notification';
      message: string;
      title?: string;
      notification_type: string;
  };

  /**
   * The declared plugin nouns' methods as event rows (NounEventRow), one per
   * `<noun>.<method>` that is a function; a member that is not is no event.
   */
  type NounEvent = {
      [K in PluginNoun]: {
          [M in keyof EngineInterface[K] & string]: EngineInterface[K][M] extends (...args: infer Parameters) => infer Result ? NounEventRow<`${K}.${M}`, Parameters extends readonly [] ? NoArgs : Parameters[0], Awaited<Result>> : never;
      }[keyof EngineInterface[K] & string];
  }[PluginNoun];

  /**
   * The name of a declared plugin noun's event (`voice.speak`).
   */
  type NounEventName = keyof NounEventOf & string;

  /**
   * The events of the plugin nouns declared on EngineInterface, by name: the
   * argument of each `<noun>.<method>`. Empty until a plugin declares a noun.
   *
   * @example
   * declare module "claude-code" { interface EngineInterface { voice: Voice } }
   */
  export type NounEventOf = {
      [E in NounEvent as E['name']]: E['args'];
  };

  /**
   * The result of a declared plugin noun's event as its hooks see it:
   * `{ value }` (the method's answer) or `{ deny }`.
   */
  type NounEventResult<N extends NounEventName> = ValueOrDeny<NounValueOf[N]>;

  /**
   * One method of a declared plugin noun as an event row: its event's name,
   * argument (the method's first parameter) and value (its awaited result).
   */
  type NounEventRow<Name extends string, Args, Value> = {
      name: Name;
      args: Args;
      value: Value;
  };

  /**
   * What each declared plugin noun's method answers (the `value` of its
   * event's result), by event name.
   */
  type NounValueOf = {
      [E in NounEvent as E['name']]: E['value'];
  };

  /**
   * Registers `hook` on the events `pattern` selects: one by name, every one
   * under a namespace (`classic.*`), all (`*`), or all but some (`!tool.*`).
   *
   * One function stands on every selected event (`next.event` says which),
   * under a matcher for the inputs it matches; a plugin's registrations nest
   * in order, first outermost; a repeat throws. Returns the Registration.
   *
   * @see HookBudget the time each hook has per dispatch (its own time: waits
   * on `next` and `$` are free), read live from `next.budget`
   */
  export type On = {
      <P extends Pattern>(pattern: P, hook: NoInfer<HookFor<P>>): Registration<HookFor<P>>;
      <P extends Pattern, const M extends Matcher<Args<MatchedNames<P>>>>(pattern: P, matcher: M, hook: NoInfer<MatchedHook<P, M>>): Registration<MatchedHook<P, M>>;
  };

  /**
   * The part of a transcript message the surface that drew it has on screen:
   * units `first` to `last` of the message's `of`, counted from its start.
   *
   * The terminal counts the rows the site laid out, from its first (the blank
   * row the engine draws above a message is its row 0; a hook's tree starts at
   * its own); other surfaces count in their unit, so compare `first / of` there.
   *
   * @remarks While `null` the terminal holds the site at the rows it last laid
   *   out (a scroller's geometry needs real rows); on screen, draw anything.
   * @example if (e.props.onScreen) shown.set(e.requestId, e.props.onScreen)
   *   else shown.delete(e.requestId) // the band's legend lists `shown`
   */
  type OnScreen = {
      /**
       * The unit inside the viewport, from 0: on the terminal, `7` when the
       * message's top seven rows are scrolled away.
       */
      first: number;
      /**
       * The unit inside the viewport, inclusive; at least `first`.
       */
      last: number;
      /**
       * The message's whole extent in the same unit, as laid out (a hook's tree
       * taller than the engine's counts its own rows); more than `last`.
       *
       * One surface's numbers say nothing of another's: what the phone shows the
       * terminal may not, and each `ui.render` carries its own surface's.
       */
      of: number;
  };

  /**
   * The keys a variant with a string index signature (an MCP tool's input)
   * takes beyond its own: another variant's key as typed there; others free.
   *
   * So a misspelt value for a key some variant declares (`command: 5`) is
   * refused on every variant, not admitted by the open one.
   */
  type OpenMatcher<I, All> = {
      readonly [K in Exclude<MatcherKeys<All>, KnownKeys<I>>]?: MatcherValue<MatcherValueOf<All, K>>;
  } & Readonly<Record<string, unknown>>;

  /**
   * The name of a call on `$` the host serves, as an event.
   */
  export type OpEventName = keyof OpEventOf;

  /**
   * The calls on `$` the host serves, as events: `e` is the call's argument as
   * it crosses to the host, and every one is hookable by name and by `on("*")`.
   *
   * A hook above the caller passes it on, rewrites it, refuses it with
   * `{ deny }` or answers with `{ value }`; core is the host's implementation.
   * The calling hook alone is skipped, and `next.origin` names the caller.
   */
  export type OpEventOf = {
      /**
       * The argument of `$.model.complete(request)`.
       */
      'model.complete': ModelCompleteRequest;
      /**
       * The argument of `$.model.classify(text, labels, options)`.
       */
      'model.classify': {
          text: string;
          labels: readonly string[];
          options?: ClassifyOptions;
      };
      /**
       * The argument of `$.model.fork(request)`.
       */
      'model.fork': ModelForkRequest;
      /**
       * The clip and how to play it (`shouldLoop`, `gain`); the signal does not
       * cross.
       */
      'audio.play': {
          clip: AudioClip;
          shouldLoop: boolean;
          gain?: number;
      };
      /**
       * The argument of `$.audio.speak(text, { voice })`.
       */
      'audio.speak': SpeakRequest;
      /**
       * The argument of `$.mcp.call(server, tool, args)`.
       */
      'mcp.call': {
          server: string;
          tool: string;
          args: Record<string, unknown>;
      };
      /**
       * The argument of `$.session.cwd()`.
       */
      'session.cwd': NoArgs;
      /**
       * The argument of `$.session.root()`.
       */
      'session.root': NoArgs;
      /**
       * The argument of `$.session.model()`.
       */
      'session.model': NoArgs;
      /**
       * The argument of `$.session.turns()`.
       */
      'session.turns': NoArgs;
      /**
       * The argument of `$.session.id()`.
       */
      'session.id': NoArgs;
      /**
       * The argument of `$.session.messages()`.
       */
      'session.messages': NoArgs;
      /**
       * The argument of `$.session.repo()`.
       */
      'session.repo': NoArgs;
      /**
       * The argument of `$.session.surface()`.
       *
       * @deprecated with `$.session.surface()`; hook `session.surfaces`
       */
      'session.surface': NoArgs;
      /**
       * The argument of `$.session.surfaces()`.
       */
      'session.surfaces': NoArgs;
      /**
       * The argument of `$.session.authorize()`.
       */
      'session.authorize': NoArgs;
      /**
       * The argument of `$.session.usage({ breakdown, columns })`.
       */
      'session.usage': SessionUsageArgs;
      /**
       * The argument of `$.turn.abort({ turnId })`.
       */
      'turn.abort': {
          turnId: string;
      };
      /**
       * The argument of `$.prompt.read()`.
       */
      'prompt.read': NoArgs;
      /**
       * The argument of `$.tool.list()`.
       */
      'tool.list': NoArgs;
      /**
       * The argument of `$.tool.register(spec)`.
       */
      'tool.register': Required<ToolSpec>;
      /**
       * The argument of `$.command.list()`.
       */
      'command.list': NoArgs;
      /**
       * The argument of `$.command.register(spec)`.
       */
      'command.register': CommandSpec;
      /**
       * The argument of `$.config.list()`.
       */
      'config.list': NoArgs;
      /**
       * The argument of `$.agent.list()`.
       */
      'agent.list': NoArgs;
      /**
       * The argument of `$.agent.register(spec)`: the agent type as the plugin
       * defined it. A hook above rewrites any of it; the type stays the caller's.
       */
      'agent.register': AgentSpec;
      /**
       * The argument of `$.ui.toast(text, { timeoutMs })`.
       */
      'ui.toast': {
          text: string;
          timeoutMs?: number;
      };
      /**
       * The argument of `$.ui.status(text)`; `text` undefined clears the line.
       */
      'ui.status': {
          text: string | undefined;
      };
      /**
       * The argument of `$.ui.log(text, { to })`; `to` is always present
       * (UiLogSink), and `next({ ...e, to: "debug" })` keeps a line off screen.
       */
      'ui.log': {
          text: string;
          to: UiLogSink;
      };
      /**
       * The argument of `$.ui.notice(tool_use_id, text)`.
       */
      'ui.notice': {
          tool_use_id: string;
          text: string | undefined;
      };
      /**
       * The argument of `$.ui.invalidate(event)`.
       */
      'ui.invalidate': {
          event: InvalidatableEventName;
      };
      /**
       * The argument of `$.ui.open({ id, title, focus })`; a hook above the
       * opener may retitle it or refuse it with `{ deny }`, never rename it.
       */
      'ui.open': PaneOpenArgs;
      /**
       * The argument of `$.ui.close({ id })` with `origin` `plugin`; the engine
       * raises it too, for the person (`person`) and an unload (`unload`).
       */
      'ui.close': PaneCloseInput;
      /**
       * The argument of `$.ui.panes()`.
       */
      'ui.panes': NoArgs;
      /**
       * The argument of `$.ui.blit(...)`: a Raster's `cells` or a keyed Image's
       * `source`; a hook above may rewrite either with `next`, or `{ deny }`.
       */
      'ui.blit': UiBlitArgs;
      /**
       * The argument of `$.fs.read(path, { as })`: `as` is `text` unless the
       * caller asked for `bytes`.
       */
      'fs.read': {
          path: string;
          as: FsReadAs;
      };
      /**
       * The argument of `$.fs.write(path, text)`.
       */
      'fs.write': {
          path: string;
          text: string;
      };
      /**
       * The argument of `$.fs.list(path)`.
       */
      'fs.list': {
          path: string;
      };
      /**
       * The argument of `$.fs.exists(path)`.
       */
      'fs.exists': {
          path: string;
      };
      /**
       * The argument of `$.fs.stat(path, { resolve })`: `resolve` is false
       * unless the caller asked where the path lands.
       */
      'fs.stat': {
          path: string;
          resolve: boolean;
      };
      /**
       * The argument of `$.fs.ancestors({ names, of, below })`.
       */
      'fs.ancestors': FsAncestorsRequest;
      /**
       * The argument of `$.store.get(key)`.
       */
      'store.get': {
          key: string;
      };
      /**
       * The argument of `$.store.set(key, value)`.
       */
      'store.set': {
          key: string;
          value: unknown;
      };
      /**
       * The argument of `$.store.delete(key)`.
       */
      'store.delete': {
          key: string;
      };
      /**
       * The argument of `$.store.keys()`.
       */
      'store.keys': NoArgs;
      /**
       * The argument of `$.clock.now()`.
       */
      'clock.now': NoArgs;
      /**
       * The argument of `$.clock.sleep(ms, { signal })`; the signal does not
       * cross, it aborts the dispatch.
       */
      'clock.sleep': ClockWait;
      /**
       * The argument of `$.clock.after(ms, fn)`: the wait before `fn`, which
       * stays in the plugin's environment and runs once the dispatch resolves.
       */
      'clock.after': ClockWait;
      /**
       * The argument of `$.clock.every(ms, fn)`, dispatched once per period:
       * `fn` runs each time a dispatch resolves, and the next period is asked.
       */
      'clock.every': ClockWait;
      /**
       * The argument of `$.http.fetch(url, init)`.
       */
      'http.fetch': {
          url: string;
          init?: HttpInit;
      };
      /**
       * The argument of `$.process.run(argv, init)`.
       */
      'process.run': {
          argv: readonly string[];
          init?: ProcessRunInit;
      };
      /**
       * The argument of `$.settings.read({ source })`.
       */
      'settings.read': SettingsReadArgs;
      /**
       * The argument of `$.env.get(name)`; `name` is identity, pinned.
       */
      'env.get': {
          name: string;
      };
      /**
       * The argument of `$.env.set(name, value)`; `name` is identity, pinned,
       * and no `value` unsets.
       */
      'env.set': {
          name: string;
          value?: string;
      };
  };

  /**
   * The result of a call on `$` as its event's hooks see it: `{ value }` (the
   * call's answer) or `{ deny }`.
   */
  export type OpEventResult<N extends OpEventName = OpEventName> = ValueOrDeny<OpValueOf[N]>;

  /**
   * What each call on `$` answers (the `value` of its event's result), by event
   * name.
   */
  export type OpValueOf = {
      'model.complete': string;
      'model.classify': string | undefined;
      'model.fork': ModelForkResult | null;
      'audio.play': void;
      'audio.speak': SpeakResult;
      'mcp.call': McpToolResult;
      'session.cwd': string;
      'session.root': string;
      'session.model': string;
      'session.turns': number;
      'session.id': string;
      'session.messages': SessionMessage[];
      'session.repo': SessionRepo | null;
      'session.surface': RenderSurface | null;
      'session.surfaces': readonly RenderSurface[];
      /**
       * The credential handle, or null where the build or the provider has no
       * first-party credential to hold.
       */
      'session.authorize': SessionAuthorization;
      'session.usage': SessionUsage;
      'turn.abort': void;
      /**
       * The box as it stands; the empty box where the session draws none.
       */
      'prompt.read': PromptBox;
      'tool.list': ToolInfo[];
      'tool.register': {
          tool: string;
      };
      'command.list': CommandInfo[];
      'command.register': {
          command: string;
      };
      'config.list': ConfigRow[];
      'agent.list': AgentInfo[];
      'agent.register': {
          agent: string;
      };
      'ui.toast': void;
      'ui.status': void;
      'ui.log': void;
      'ui.notice': void;
      'ui.invalidate': void;
      'ui.open': void;
      'ui.close': void;
      /**
       * The calling plugin's open panes, placed then unplaced, in open order.
       */
      'ui.panes': readonly UiPane[];
      'ui.blit': UiBlitResult;
      /**
       * The text; `{ base64 }` when asked for bytes.
       */
      'fs.read': string | FsBytes;
      'fs.write': void;
      'fs.list': FsEntry[];
      'fs.exists': boolean;
      'fs.stat': FsStat;
      'fs.ancestors': readonly FsAncestor[];
      'store.get': unknown;
      'store.set': void;
      'store.delete': void;
      'store.keys': string[];
      /**
       * Milliseconds since the epoch.
       */
      'clock.now': number;
      'clock.sleep': void;
      'clock.after': void;
      'clock.every': void;
      'http.fetch': HttpResponse;
      'process.run': ProcessRunResult;
      'settings.read': Settings;
      'env.get': string | undefined;
      'env.set': void;
  };

  /**
   * One call signature per event in `Names`, intersected, the ambiguous ones
   * (LateOverload) after the rest: `next` for a hook covering several events.
   *
   * An empty group contributes nothing (Overloads<never> is unknown).
   */
  type OrderedOverloads<Names extends EventName> = Overloads<Exclude<Names, LateOverload>> & Overloads<Extract<Names, 'classic.PreToolUse'>> & Overloads<Extract<Names, 'turn.abort'>> & Overloads<Extract<Names, NoArgsEvent>>;

  /**
   * Who raised a dispatch, as `next.origin` holds it: the calling plugin's
   * name and the tier it sits in; the engine reads `engine` in `core`.
   *
   * The same pair a `next.trace` entry names its link by, and an event's
   * `provider` its subject's definer by. Set by the host from where the call
   * came from and where that plugin was seated; nothing a plugin writes.
   */
  export type Origin = {
      /**
       * Whose hook made the `$` call, by name; `"engine"` for a call site,
       * `"client"` for a `Client` surface module's `ui.message` post.
       */
      readonly plugin: string;
      /**
       * Where that plugin sits among the chain's tiers (Tier); `"core"` for the
       * engine, the owning plugin's for a `client` post.
       */
      readonly tier: Tier;
  };

  /**
   * One call signature per event in `Names`, intersected into an overload set.
   */
  type Overloads<Names extends EventName> = UnionToIntersection<{
      [N in Names]: (e: Args<N>) => Promise<NextResult<N>>;
  }[Names]>;

  /**
   * The argument of `$.ui.close`: the pane to close (`{ id }`). `origin` is
   * the engine's to set: a plugin's call reads `plugin` at the hooks.
   */
  export type PaneCloseArgs = Omit<PaneCloseInput, 'origin'>;

  /**
   * The input of `ui.close`: the pane closing and why (PaneCloseOrigin).
   * Closing an id that is not open does nothing.
   */
  export type PaneCloseInput = {
      /**
       * What `$.ui.open` named the pane; pinned: `next(e)` passes it on.
       */
      id: string;
      /**
       * Who closes it, set by the engine: a hook that answers without `next`
       * keeps the pane open on `plugin` and `person`, never on `unload`.
       */
      origin: PaneCloseOrigin;
  };

  /**
   * Why a pane closes, as the engine stamped it at `ui.close`.
   *
   * `unload` drops a pane nothing draws any more (its plugin unloaded, or its
   * drawing threw): it is gone before the hooks hear of it, and its opener's
   * hooks do not run. `next(e)` passes the origin on as received; none sets it.
   */
  export type PaneCloseOrigin = {
      /**
       * `plugin`, a plugin's `$.ui.close`; `person`, the person's close mark or
       * close key; `unload`, the engine's own.
       */
      kind: 'plugin' | 'person' | 'unload';
  };

  /**
   * The argument of `$.ui.open`: which pane, its title, whether it asks the
   * person's keyboard, its dialog manners, its size: rows inline, columns docked.
   *
   * An open answering the person's input (a command or prompt they entered, a
   * press) is placed at any width; one the plugin makes on its own waits
   * undrawn below 144 terminal columns, 110 once they asked for that id.
   */
  export type PaneOpenArgs = {
      /**
       * Names the pane: 1-64 of letters, digits, `_` and `-`. One pane per id:
       * opening an open id delivers the new title, never a second instance.
       *
       * Pinned at the hooks: `next(e)` passes it on; the title and focus rewrite.
       */
      id: string;
      /**
       * The pane's tab while more than one pane is open (with one, no title is
       * drawn), and the `title` its hook sees; the id when omitted.
       *
       * An unpaired surrogate half (a `.slice()` through an emoji) is drawn as
       * U+FFFD; a control character is refused.
       */
      title?: string;
      /**
       * A request, not a grant: the surface focuses (and raises) the pane only
       * while the prompt has the keys over an empty composer.
       *
       * An element of the band or a pane the person holds, text in the
       * composer, a dialog or a survey each refuse it: the pane opens without
       * the keyboard.
       */
      focus?: true;
      /**
       * While the pane holds the keyboard, the key that hands it back (Escape)
       * also closes it as the person's close does: `ui.close`, origin `person`.
       *
       * So does Escape at an idle, empty prompt once the prompt has the keys
       * again (the person typed, or `focus` was refused); over text, a running
       * turn, a dialog, a footer selection, a viewed agent's transcript or a
       * prompt mode of its own the key stays theirs.
       *
       * A hook may refuse that close and keep it open. Left out, Escape returns
       * the keys to the prompt and the pane stays. Each open sets it anew, as it
       * sets the title.
       */
      closeOnEscape?: true;
      /**
       * While the pane is on screen the surface holds its transient toasts (the
       * notification line under the prompt) and shows them once it closes.
       *
       * As it does behind the engine's own side panel; pinned warnings still
       * show. Left out, toasts show as they come. Each open sets it anew.
       */
      holdToasts?: true;
      /**
       * The body rows the pane's content wants while seated inline above the
       * prompt: it opens that tall, up to what the layout spares, not a third.
       *
       * A request, not a grant: a size the person dragged or keyed the block
       * to wins, this session's or a kept one, and the dock ignores it. A
       * positive whole number; left out, a third. Each open sets it anew.
       */
      rows?: number;
      /**
       * The body columns the pane's content wants while docked beside a
       * fullscreen transcript: the dock opens that wide, floor to ceiling.
       *
       * A request, not a grant: a width the person dragged or keyed the dock
       * to wins, this session's or a kept one, and the inline block ignores
       * it. A positive whole number; left out, the share. Each open sets it anew.
       *
       * @example
       * await $.ui.open({ id: "browser", focus: true, rows: 24, columns: 100 })
       */
      columns?: number;
  };

  /**
   * What `on(pattern, hook)` and `next.is(pattern, e)` take: an event's name,
   * a glob (`*`, `classic.*`), or a negation of either (`!tool.describe`).
   */
  export type Pattern = EventName | Glob | Negation;

  /**
   * The patterns `next.is` takes in a hook covering the events `N`: their
   * names, `*`, a glob over one of their namespaces, or a negation.
   *
   * A name none of them has is a compile error, as is a glob over a namespace
   * none is under; a negation that selects none of them narrows `e` to never.
   */
  type PatternOver<N extends EventName> = N | '*' | `${Namespace<N>}.*` | Negation;

  type PermissionBehavior = 'allow' | 'deny' | 'ask';

  type PermissionDeniedHookInput = BaseHookInput & {
      hook_event_name: 'PermissionDenied';
      tool_name: string;
      tool_input: unknown;
      tool_use_id: string;
      reason: string;
      mcp_server?: McpServerProvenance;
  };

  /**
   * Permission mode for controlling how tool executions are handled. 'default' - Standard behavior, prompts for dangerous operations. 'acceptEdits' - Auto-accept file edit operations. 'bypassPermissions' - Bypass all permission checks (requires allowDangerouslySkipPermissions). 'plan' - Planning mode, no actual tool execution. 'dontAsk' - Don't prompt for permissions, deny if not pre-approved. 'auto' - Use a model classifier to approve/deny permission prompts.
   */
  type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto';

  /**
   * A `classic.PermissionRequest` answer's `decision`, as the classic hook's
   * `hookSpecificOutput.decision`: allow (with a rewrite or rules) or deny.
   */
  export type PermissionRequestDecision = {
      behavior: 'allow';
      updatedInput?: Record<string, unknown>;
      updatedPermissions?: PermissionUpdates;
  } | {
      behavior: 'deny';
      message?: string;
      interrupt?: true;
  };

  type PermissionRequestHookInput = BaseHookInput & {
      hook_event_name: 'PermissionRequest';
      tool_name: string;
      tool_input: unknown;
      permission_suggestions?: PermissionUpdate[];
      mcp_server?: McpServerProvenance;
  };

  type PermissionRuleValue = {
      toolName: string;
      ruleContent?: string;
  };

  type PermissionUpdate = {
      type: 'addRules';
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
  } | {
      type: 'replaceRules';
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
  } | {
      type: 'removeRules';
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
  } | {
      type: 'setMode';
      mode: PermissionMode;
      destination: PermissionUpdateDestination;
  } | {
      type: 'addDirectories';
      directories: string[];
      destination: PermissionUpdateDestination;
  } | {
      type: 'removeDirectories';
      directories: string[];
      destination: PermissionUpdateDestination;
  };

  type PermissionUpdateDestination = 'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg';

  /**
   * The permission rules a PermissionRequest allow may add: the shape of the
   * request's own `permission_suggestions` (the SDK's PermissionUpdate list).
   */
  type PermissionUpdates = NonNullable<ClassicHookInputs['PermissionRequest']['permission_suggestions']>;

  /**
   * How `$.audio.play` plays a clip: looped until `signal` aborts, or once.
   *
   * A loop needs the signal that ends it; a single play takes one as an option.
   */
  export type PlayOptions = {
      /**
       * Repeat the clip until `signal` aborts (the promise then resolves).
       */
      shouldLoop: true;
      /**
       * Linear gain, from 0 to 4; default 1.
       */
      gain?: number;
      /**
       * Stops the clip: playback ends at once and the promise resolves.
       */
      signal: AbortSignal;
  } | {
      /**
       * Play once.
       */
      shouldLoop?: false;
      /**
       * Linear gain, from 0 to 4; default 1.
       */
      gain?: number;
      /**
       * Stops the clip early, as above.
       */
      signal?: AbortSignal;
  };

  /**
   * The nouns a plugin declared on `$` by merging into EngineInterface; never
   * one the engine's own events are under (`tool`, `session`, `ui`).
   */
  type PluginNoun = Exclude<keyof EngineInterface & string, keyof CoreEngineInterface | Namespace<CoreEventName>>;

  /**
   * A plugin's options as `register(on, options)` receives them: the values of
   * the fields its manifest's `userConfig` declares, defaults filled in.
   *
   * Stored in settings.json `pluginConfigs[<plugin>].options` (sensitive ones
   * in secure storage), validated against the declared `type` before the module
   * loads; a required field with no value fails the load, naming the field. A
   * string field that declares `options` holds one of them: `/config` draws it
   * as a picker over them, and a stored value outside them counts as unset, so
   * its default applies. A `--plugin-dir` plugin's key is its plugin.json
   * `<name>` (or `<name>@inline`).
   */
  export type PluginOptions = Readonly<Record<string, string | number | boolean | readonly string[]>>;

  /**
   * The input of `plugin.register`: one hooks module the engine is about to
   * load, read off its manifest and its scanned source. Every field is pinned.
   *
   * `tier` and `uses` are the host's reading of the module, what a gate holds
   * it to; `name`, `root`, `version` and `provenance` are its own word (its
   * manifest, its place), so a rule keyed on them is one a rename walks past.
   */
  export type PluginRegisterInput = {
      /**
       * The plugin's name, as its own plugin.json declares it.
       */
      name: string;
      /**
       * Where its hooks would stand among the chain's tiers (Tier); never
       * `core`, the engine's own.
       */
      tier: Exclude<Tier, 'core'>;
      /**
       * The plugin's directory (the one holding plugin.json), absolute.
       */
      root: string;
      /**
       * Its manifest's `version`, when it states one.
       */
      version?: string;
      /**
       * Where the plugin came from, as the loader keys it: `<name>@<marketplace>`
       * installed, `<name>@inline` by `--plugin-dir`, `<name>@builtin` bundled.
       */
      provenance: string;
      /**
       * What the module hooks and calls, as scanned (PluginRegisterUses).
       */
      uses: PluginRegisterUses;
  };

  /**
   * What a `plugin.register` hook returns and what `next(e)` resolves to:
   * `{ allow: true }` from core, or `{ refuse: reason }`.
   */
  export type PluginRegisterResult = {
      /**
       * The module loads: its `engine.create` step runs and its hooks join.
       */
      allow: true;
      refuse?: undefined;
  } | {
      /**
       * The module does not load: no step, no hooks, no tools or commands;
       * the transcript names the plugin that refused and this reason.
       */
      refuse: string;
      allow?: undefined;
  };

  /**
   * What a hooks module uses, as the host scanned its source before loading it:
   * the same lists `claude plugin validate` prints and the host's rule reads.
   *
   * Exact, since a module that spells `on`, `$` or `$.env` other than literally
   * does not load.
   */
  export type PluginRegisterUses = {
      /**
       * The patterns its `on(...)` registrations name, as written (`tool.call`,
       * `*`, `classic.*`, `!tool.describe`), in registration order, each once.
       */
      events: readonly string[];
      /**
       * What it calls on `$`, spelled `noun.method` (`fs.write`, `http.fetch`),
       * sorted, each once.
       */
      calls: readonly string[];
      /**
       * The environment variables its `$.env.get` and `$.env.set` calls name;
       * absent when it calls neither.
       */
      env?: {
          /**
           * The names its `$.env.get` calls spell, sorted, each once.
           */
          reads: readonly string[];
          /**
           * The names its `$.env.set` calls spell, sorted, each once.
           */
          writes: readonly string[];
      };
  };

  /**
   * Whose element: the plugin whose hook drew it, stamped by the runtime as the
   * tree leaves it; a Box's or Text's `group`, a Client's or Raster's own.
   *
   * A Button's `press` names its plugin the same way, beside its handle. Two
   * plugins under one `hover.scope` string never share a group.
   */
  type PluginStamp = {
      plugin: string;
  };

  type PostCompactHookInput = BaseHookInput & {
      hook_event_name: 'PostCompact';
      trigger: 'manual' | 'auto';
      /**
       * The conversation summary produced by compaction
       */
      compact_summary: string;
  };

  type PostModelSwitchHookInput = (BaseHookInput & {
      hook_event_name: 'PostModelSwitch';
  }) & {
      /**
       * Resolved model id the session was running before the switch
       */
      from_model: string;
      /**
       * Resolved model id the session runs after the switch
       */
      to_model: string;
      /**
       * What was asked for (alias such as "opus", a full id, or null for "default")
       */
      requested_model: string | null;
      /**
       * command: /model <name>, the /config Model row, or enabling fast mode when that promotes the model; picker: an interactive model picker; sdk: headless set_model (SDK, Remote Control, IDE); auto: automatic fallback or other programmatic change; resume: model restored while resuming a session
       */
      source: 'command' | 'picker' | 'sdk' | 'auto' | 'resume';
      /**
       * Prompt tokens the next request re-sends: the last main-thread response's input + cache_read + cache_creation + output tokens (0 before the first response; for a server-side tool loop, its last iteration's window, not the summed totals)
       */
      context_tokens: number;
      /**
       * Whether the current model's prompt cache is likely still warm (a switch then forfeits it)
       */
      prompt_cache_warm: boolean;
      cache_ttl: '5m' | '1h';
      /**
       * Estimated cost of re-caching context_tokens on to_model at its cache-write rate - the managed modelPricing when set, otherwise list price; excludes the response
       */
      estimated_cache_write_usd: number;
      /**
       * configured: priced at the managed modelPricing setting; catalog: list price; default: to_model unknown, the default tier was assumed
       */
      pricing: 'configured' | 'catalog' | 'default';
  };

  /**
   * Hook input for the PostToolBatch event. Fired once after every tool call in a batch has resolved, before the next model request. PostToolUse fires per-tool and may run concurrently for parallel tool calls; PostToolBatch fires exactly once with the full batch.
   */
  type PostToolBatchHookInput = BaseHookInput & {
      hook_event_name: 'PostToolBatch';
      tool_calls: PostToolBatchToolCall[];
  };

  type PostToolBatchToolCall = {
      tool_name: string;
      tool_input: unknown;
      tool_use_id: string;
      tool_response?: unknown;
  };

  type PostToolUseFailureHookInput = BaseHookInput & {
      hook_event_name: 'PostToolUseFailure';
      tool_name: string;
      tool_input: unknown;
      tool_use_id: string;
      error: string;
      is_interrupt?: boolean;
      /**
       * Tool execution time in milliseconds. Excludes permission-prompt and hook time.
       */
      duration_ms?: number;
      mcp_server?: McpServerProvenance;
  };

  type PostToolUseHookInput = BaseHookInput & {
      hook_event_name: 'PostToolUse';
      tool_name: string;
      tool_input: unknown;
      tool_response: unknown;
      tool_use_id: string;
      /**
       * Tool execution time in milliseconds. Excludes permission-prompt and hook time.
       */
      duration_ms?: number;
      mcp_server?: McpServerProvenance;
  };

  type PreCompactHookInput = BaseHookInput & {
      hook_event_name: 'PreCompact';
      trigger: 'manual' | 'auto';
      custom_instructions: string | null;
  };

  type PreModelSwitchHookInput = (BaseHookInput & {
      hook_event_name: 'PreModelSwitch';
  }) & {
      /**
       * Resolved model id the session was running before the switch
       */
      from_model: string;
      /**
       * Resolved model id the session runs after the switch
       */
      to_model: string;
      /**
       * What was asked for (alias such as "opus", a full id, or null for "default")
       */
      requested_model: string | null;
      /**
       * command: /model <name>, the /config Model row, or enabling fast mode when that promotes the model; picker: an interactive model picker; sdk: headless set_model (SDK, Remote Control, IDE)
       */
      source: 'command' | 'picker' | 'sdk';
      /**
       * Prompt tokens the next request re-sends: the last main-thread response's input + cache_read + cache_creation + output tokens (0 before the first response; for a server-side tool loop, its last iteration's window, not the summed totals)
       */
      context_tokens: number;
      /**
       * Whether the current model's prompt cache is likely still warm (a switch then forfeits it)
       */
      prompt_cache_warm: boolean;
      cache_ttl: '5m' | '1h';
      /**
       * Estimated cost of re-caching context_tokens on to_model at its cache-write rate - the managed modelPricing when set, otherwise list price; excludes the response
       */
      estimated_cache_write_usd: number;
      /**
       * configured: priced at the managed modelPricing setting; catalog: list price; default: to_model unknown, the default tier was assumed
       */
      pricing: 'configured' | 'catalog' | 'default';
  };

  /**
   * The link a press landed on: one a `Markdown` drew, pressed where the
   * surface reports presses (a plain click in the fullscreen terminal).
   *
   * What the surface knows of the cell pressed, not which occurrence: two
   * links written with one target read the same here.
   */
  export type PressedLink = {
      /**
       * The link's target as the surface drew it: for an `https:` link, the
       * href as the markdown wrote it.
       */
      href: string;
  };

  /**
   * The decision of a `classic.PreToolUse` result: `allow`, `ask`, `deny`, or
   * none.
   */
  export type PreToolUseDecision = {
      /**
       * Lets the call run without a permission prompt (the managed-settings
       * hooks ran first; a deny from them ended the chain above).
       */
      allow: true;
      ask?: undefined;
      deny?: undefined;
  } | {
      /**
       * Asks the user before the call runs; the text is shown as the reason.
       */
      ask: string;
      allow?: undefined;
      deny?: undefined;
  } | {
      /**
       * Refuses the call; the model receives the text as the reason.
       */
      deny: string;
      allow?: undefined;
      ask?: undefined;
  } | {
      allow?: undefined;
      ask?: undefined;
      deny?: undefined;
  };

  type PreToolUseHookInput = BaseHookInput & {
      hook_event_name: 'PreToolUse';
      tool_name: string;
      tool_input: unknown;
      tool_use_id: string;
      mcp_server?: McpServerProvenance;
  };

  /**
   * What a `classic.PreToolUse` hook returns: one of `allow`, `ask`, `deny`,
   * or none of them, which passes the call on to the normal permission flow.
   */
  export type PreToolUseResult = PreToolUseDecision & {
      /**
       * Replaces the tool's arguments; validated against the tool's schema before
       * the tool runs.
       */
      updatedInput?: Record<string, unknown>;
      /**
       * Extra context handed to the model with the call, one entry per note.
       */
      additionalContext?: string[];
  };

  /**
   * Options of `$.process.run`.
   */
  export type ProcessRunInit = {
      /**
       * The child's working directory, relative to the session's or absolute;
       * absent, the session's working directory.
       */
      cwd?: string;
      /**
       * Variables set over the host process's own environment.
       */
      env?: Record<string, string>;
      /**
       * Text written to the child's standard input, then closed.
       */
      stdin?: string;
      /**
       * How long the child may run before it is killed and the call rejects,
       * in milliseconds; 30 seconds when absent, ten minutes at most.
       */
      timeoutMs?: number;
  };

  /**
   * What `$.process.run` resolves with once the child has exited.
   */
  export type ProcessRunResult = {
      /**
       * The child's exit status; a child ended by a signal reads as 1.
       */
      exitCode: number;
      /**
       * What the child wrote to standard output, as text, cut at the output
       * limit.
       */
      stdout: string;
      /**
       * What the child wrote to standard error, as text, cut at the output
       * limit.
       */
      stderr: string;
  };

  /**
   * The input of `prompt.attachment`: one message the engine injects into the
   * conversation for the model on its own, as a request is about to carry it.
   *
   * A reminder, a mode transition, a listing, a mentioned file, a hook's
   * context: the person never typed it and mostly never sees it. Only an
   * attachment that carries text for the model is raised.
   */
  export type PromptAttachmentInput = {
      /**
       * As the engine names the attachment's kind; the key a matcher narrows on.
       * Pinned. Builds add and retire kinds: match by name.
       *
       * Among them `todo_reminder`, `plan_mode`, `plan_mode_exit`, `auto_mode`,
       * `auto_mode_exit`, `instructions`, `nested_memory`, `skill_listing`,
       * `deferred_tools_delta`, `edited_text_file`, `file`, `queued_command`.
       */
      type: string;
      /**
       * What the model reads for this attachment, inside the engine's framing;
       * rewritable with `next({ ...e, text })`.
       *
       * The `<system-reminder>` wrapper (or the system channel that replaces it)
       * goes around what the chain answers, never inside it. An attachment
       * rendered as several text blocks hands them joined by newlines.
       */
      text: string;
      /**
       * Who authored the text (PromptAttachmentOrigin): the engine, a settings
       * hook, or a plugin's chain context.
       *
       * Pinned: a different value is refused, one left out is kept.
       */
      origin: PromptAttachmentOrigin;
      /**
       * The loop whose request carries the attachment: a subagent's id, the `id`
       * `$.agent.list()` gives it and its `tool.call`s carry; absent on main.
       *
       * Pinned: a different value is refused, one left out is kept. A subagent
       * a hook spawned through `$.agent.spawn` is resolved past that hook.
       */
      agentId?: string;
  };

  /**
   * Who authored the text an injected attachment carries, as the engine knows
   * it from the attachment itself; a closed set, pinned on the event.
   *
   * A hooks module reads `e.origin.kind` to tell the engine's own prose from a
   * settings hook's output or another plugin's context. `next(e)` passes it on
   * as received; one left out is put back; no hook sets one.
   */
  export type PromptAttachmentOrigin = {
      /**
       * The engine's own prose or framing: a reminder, a mode transition, a
       * listing, a notice, an announced context block.
       *
       * A file the person mentioned, as the engine presents it, and a prompt
       * or notification delivered into a running turn are the engine's too.
       */
      kind: 'engine';
  } | {
      /**
       * A settings hook's output the engine injects for the model: its
       * additional context, a blocking error's note, a stopped continuation.
       */
      kind: 'hook';
      /**
       * The settings hook event that produced it (`SessionStart`,
       * `UserPromptSubmit`, `PostToolUse`, ...).
       */
      event: string;
  } | {
      /**
       * Text a plugin's hook attached through a chain's `context`
       * (`prompt.submit`, `tool.call`), as the model reads it.
       */
      kind: 'plugin';
      /**
       * The chain's event that attached it.
       */
      event: string;
  };

  /**
   * What a `prompt.attachment` hook returns: the text the model reads for that
   * attachment, or null to leave the attachment out of the request.
   */
  export type PromptAttachmentResult = {
      text: string | null;
  };

  /**
   * The person's prompt box as it stands: the draft and where the cursor is in
   * it; what `$.prompt.read()` resolves and `$.prompt.fill` hands back.
   *
   * No selection: the terminal's box has none of its own, and a surface that
   * binds one adds it here.
   */
  export type PromptBox = {
      /**
       * The draft as typed so far; `''` where the session draws no box.
       */
      text: string;
      /**
       * Where the next typed character lands: an offset into `text` in UTF-16
       * code units, 0 at the start, `text.length` at the end.
       */
      cursor: number;
  };

  /**
   * One block of the context the first user message carries: a name the
   * engine keys it by and the text under it.
   */
  export type PromptContextBlock = {
      /**
       * The key the block renders under (`# name`): `claudeMd`, `userEmail`,
       * `attachedProject`, `currentDate`, or a plugin's own.
       *
       * The field a matcher narrows on; unique among one context's blocks.
       */
      name: string;
      /**
       * The block's text; `claudeMd`'s is the instruction files framed as the
       * engine frames them, empty when it announces none.
       */
      text: string;
  };

  /**
   * The context blocks of a conversation's first user message, in the order
   * the engine renders them: what `prompt.context` takes and answers alike.
   */
  export type PromptContextBlocks = {
      /**
       * From core: `claudeMd` (when instruction files are loaded), `userEmail`,
       * `attachedProject`, `currentDate`, each only when present.
       */
      blocks: readonly PromptContextBlock[];
  };

  /**
   * The input of `prompt.context`: the context blocks the engine prepends to a
   * conversation's first user message, and the files behind `claudeMd`.
   */
  export type PromptContextInput = {
      /**
       * From core: `claudeMd` (when instruction files are loaded), `userEmail`,
       * `attachedProject`, `currentDate`, each only when present.
       */
      blocks: readonly PromptContextBlock[];
      /**
       * The files behind `claudeMd`, in the order it renders them, `@` imports
       * included; empty when it renders none.
       *
       * Undefined when a hook above rewrote the `claudeMd` text: the files
       * behind that text are then unknown, and a hook adds none of its own.
       */
      instructionFiles?: readonly InstructionFile[];
  };

  /**
   * What a `prompt.context` hook returns: the blocks the conversation
   * carries, in order; one left out is not sent.
   */
  export type PromptContextResult = {
      /**
       * What the conversation carries, in order.
       */
      blocks: readonly PromptContextBlock[];
      /**
       * The files now behind `claudeMd`; left out, the ones from below stand.
       *
       * Kept in step with the `claudeMd` text at every link: a changed list
       * renders the text the next reader gets, a rewritten text makes the files
       * unknown from there on. Every kind is the hook's to add, drop or rewrite.
       */
      instructionFiles?: readonly InstructionFile[];
  };

  /**
   * The input of `prompt.edit` (prompt-edit/): one edit the person makes in the
   * prompt box, as the draft before it and the splice the editor made of it.
   */
  export type PromptEditInput = {
      /**
       * Who edits (PromptEditOrigin): the person at the composer. Pinned:
       * `next(e)` passes it on as received.
       */
      origin: PromptEditOrigin;
      /**
       * The one key that made the edit, in `Client` `onKey`'s shape, when one
       * did; absent for a paste and for a burst of keys folded into one edit.
       *
       * Pinned: which key the person pressed is a fact, not the hook's to change.
       */
      key?: ClientKeyEvent;
      /**
       * The draft before the edit. `next({ ...e, text })` applies the edit to
       * another draft instead.
       */
      text: string;
      /**
       * Where the person's caret stood in `text` before the edit, 0 to
       * `text.length`.
       */
      cursor: number;
      /**
       * Where in `text` the edit begins: the start of the span it replaces, or
       * where what was typed goes in; a bare cursor move begins where it lands.
       */
      start: number;
      /**
       * Where the replaced span of `text` ends: `start` for an insertion or a
       * move, past it for a deletion (Backspace, a kill).
       */
      end: number;
      /**
       * What goes in between `start` and `end`: the typed or pasted text, `''` for
       * a deletion or a move.
       *
       * `next({ ...e, inputText })` puts in another; the cursor lands after it.
       */
      inputText: string;
  };

  /**
   * Who edits the prompt box at `prompt.edit`, as the engine stamps it where
   * the edit starts; a closed set a matcher narrows on.
   *
   * `next(e)` passes it on as received; no hook sets one.
   */
  export type PromptEditOrigin = {
      /**
       * The person, typing or pasting into the main prompt box.
       */
      kind: 'composer';
  };

  /**
   * What a `prompt.edit` hook returns and what `next(e)` resolves to: the box
   * after the edit (PromptBox), which the editor then shows.
   *
   * From core, `e.text` with the splice applied and the cursor after what went
   * in. Rewrite it (`{ ...r, text, cursor }`) to change what lands; answer
   * `{ text: e.text, cursor: e.cursor }` without `next` to consume the key.
   */
  export type PromptEditResult = PromptBox;

  /**
   * `prompt.fill`'s input as a plugin's `$.prompt.fill(args)` takes it: no
   * `origin` (the engine sets the calling plugin's), `mode` optional.
   */
  export type PromptFillArgs = {
      /**
       * What the box is to take (PromptFillInput `text`).
       */
      text: string;
      /**
       * Where it goes (PromptFillMode); `replace` when left out.
       */
      mode?: PromptFillMode;
  };

  /**
   * What `$.prompt.fill` resolves to: whether the box took the text, and the
   * box afterwards (PromptBox) as the caller's own `$.prompt.read()` reads it.
   *
   * The box goes to a plugin whose module calls `$.prompt.read`, through the
   * hooks on it; one that never does, or is refused there, gets the empty box.
   */
  export type PromptFilled = {
      /**
       * True once the box holds the text; false where no box could take it or a
       * hook kept it out (PromptFillResult).
       */
      isFilled: boolean;
      /**
       * The draft after the fill; unchanged when `isFilled` is false; `''` where
       * no box is drawn or the caller may not read it (see above).
       */
      text: string;
      /**
       * Where the person types next: an offset into `text`, past the fill's text
       * for `insert`, at the end for `replace` and `append`.
       */
      cursor: number;
  };

  /**
   * The input of `prompt.fill` (prompt-fill/): a text about to be put in the
   * prompt box as the person's draft, over it, after it, or at the cursor.
   */
  export type PromptFillInput = {
      /**
       * What the box takes; the person edits it or presses Enter.
       * `next({ ...e, text })` writes another.
       */
      text: string;
      /**
       * Where the text goes (PromptFillMode): over the draft, after it, or in at
       * the cursor. `next({ ...e, mode })` moves it; left out of a rewrite, kept.
       */
      mode: PromptFillMode;
      /**
       * Who writes (PromptFillOrigin), set by the engine where the write
       * starts. Pinned: `next(e)` passes it on as received.
       */
      origin: PromptFillOrigin;
  };

  /**
   * Where a `prompt.fill` puts its text: over the whole draft, after it, or
   * into it at the cursor.
   *
   * `replace` empties the box first and leaves the cursor at the text's end;
   * `append` keeps the draft and adds the text after it, cursor at the end;
   * `insert` splices the text in at the cursor and moves the cursor past it,
   * so what the person had typed stays on either side.
   */
  export type PromptFillMode = 'replace' | 'append' | 'insert';

  /**
   * Who writes the prompt box at `prompt.fill`, as the engine stamps it where
   * the write starts; a closed set a matcher narrows on.
   *
   * `next(e)` passes it on as received; no hook sets one.
   */
  export type PromptFillOrigin = {
      /**
       * The engine writing the box on its own account; reserved for its own
       * sites, none of which raises `prompt.fill` as shipped.
       */
      kind: 'engine';
  } | {
      /**
       * A plugin's `$.prompt.fill`.
       */
      kind: 'plugin';
      /**
       * The filling plugin's name.
       */
      name: string;
  };

  /**
   * What a `prompt.fill` hook returns and what `next(e)` resolves to: whether
   * the text went into the prompt box.
   */
  export type PromptFillResult = {
      /**
       * True once the box holds the text; false where no box can take it (a
       * dialog holds the keys, a headless session has none).
       *
       * A hook answering `{ isFilled: false }` without `next` keeps the text
       * out.
       */
      isFilled: boolean;
  };

  /**
   * Where a `prompt.submit` submission came from, as the engine knows it at
   * the site it was queued from; a closed set, never a text prefix.
   *
   * A hooks module reads `e.origin.kind` to tell the user's own Enter from a
   * notification, a peer session, a schedule or another plugin. `next(e)`
   * passes it on as received; an answer may leave it out; no hook sets one.
   */
  export type PromptOrigin = {
      /**
       * The user's own gesture at the terminal, as the engine stamped it
       * (never presumed from an unstamped command).
       *
       * Enter at the prompt, typed or queued, or a click on a transcript
       * link; a channel the engine cannot attest (a same-user socket) is
       * never stamped, and arrives as `unclassified`.
       */
      kind: 'composer';
  } | {
      /**
       * The user's message through the Remote Control bridge (a phone or
       * web client).
       */
      kind: 'bridge';
  } | {
      /**
       * The SDK host's own turn (`claude -p`, the Agent SDK), not typed at
       * a terminal.
       */
      kind: 'sdk';
  } | {
      /**
       * A background task's notification, dequeued when the session went
       * idle or delivered into a running turn (`turnId` set).
       */
      kind: 'task-notification';
  } | {
      /**
       * A scheduled task, routine or /loop firing its stored prompt.
       */
      kind: 'scheduled-trigger';
  } | {
      /**
       * Another Claude session's message ("Another Claude session sent a
       * message"), as a turn of its own or delivered into a running one.
       */
      kind: 'peer';
  } | {
      /**
       * Another session's SendMessage delivery, model-authored and framed
       * as a notification.
       */
      kind: 'peer-send-message';
  } | {
      /**
       * A delivery a coordinating session composed for one of its threads.
       */
      kind: 'projects-relay';
  } | {
      /**
       * A message from a channel an MCP server relays (Slack, Telegram).
       */
      kind: 'channel';
      /**
       * The channel server's name.
       */
      server: string;
  } | {
      /**
       * A coordinating session's hand-off to a worker session.
       */
      kind: 'coordinator';
  } | {
      /**
       * A background observer agent's report to the agent it observes.
       */
      kind: 'observer';
  } | {
      /**
       * An activity digest delivered to an observer agent.
       */
      kind: 'observer-activity';
  } | {
      /**
       * A programmatic follow-up to a user's UI action, user-initiated but
       * not typed this turn.
       */
      kind: 'auto-continuation';
  } | {
      /**
       * A turn with no provenance the engine can name: one the ingress
       * could not classify, or a command queued with no stamp at all.
       *
       * An idle notice or a delivery receipt the engine queued isMeta with
       * no stamp is one too; the engine frames that shape as a non-user
       * source.
       */
      kind: 'unclassified';
  } | {
      /**
       * The session's owner pinging it from Slack.
       */
      kind: 'slack-ping';
  } | {
      /**
       * A plugin's `$.prompt.submit`; the model reads the prompt under the
       * plugin's name unless a hook leaves the origin out of its answer.
       */
      kind: 'plugin';
      /**
       * The submitting plugin's name.
       */
      name: string;
  };

  /**
   * The input of `prompt.section`: one named section of the system prompt, at
   * the moment the engine assembles it.
   */
  export type PromptSectionInput = {
      /**
       * As the engine names the section (`env_info_simple`, `memory`, ...); the
       * key a matcher narrows on.
       */
      name: string;
      /**
       * The section's text as core computed it, or null when core omits it.
       */
      text: string | null;
  };

  /**
   * What a `prompt.section` hook returns: the text the prompt carries for that
   * section, or null to leave it out.
   */
  export type PromptSectionResult = {
      text: string | null;
  };

  /**
   * `prompt.submit`'s input as a plugin's call takes it: `origin`, `turnId`
   * and `wait` are the engine's to set, `context` the hooks' to attach.
   *
   * `origin` is the calling plugin's name; `turnId` is the turn a prompt typed
   * mid-turn ran over; `wait` is false, as a plugin's prompt runs once idle.
   */
  export type PromptSubmitArgs = Omit<PromptSubmitInput, 'origin' | 'turnId' | 'wait' | 'context'>;

  /**
   * A pasted or attached non-text item of a submitted prompt; its kind, never
   * its bytes.
   */
  export type PromptSubmitAttachment = {
      /**
       * The item's kind.
       */
      type: 'image' | 'audio' | 'document';
      /**
       * The item's MIME type (`image/png`), when known.
       */
      mediaType?: string;
      /**
       * The pasted file's name, when it had one.
       */
      filename?: string;
  };

  /**
   * The input of `prompt.submit`: the prompt as typed, after the input became
   * a user message and before it enters the session.
   */
  export type PromptSubmitInput = {
      /**
       * The prompt's text as it will reach the model (pastes already expanded).
       */
      text: string;
      /**
       * Present only when the submission carried images or other non-text items.
       */
      attachments?: readonly PromptSubmitAttachment[];
      /**
       * What the model reads beside the prompt and the user never sees, each
       * entry one block after the prompt as typed; absent as the engine raises it.
       *
       * A hook attaches on the way down: `next({ ...e, context: [...(e.context
       * ?? []), mine] })`, keeping which it likes; none empty, any length: past
       * 100,000 characters (200,000 together) the model reads a head and path.
       */
      context?: readonly string[];
      /**
       * The id of the model turn that was running when the prompt was submitted
       * (`turn.start`'s `turnId`): typed over that turn, or delivered into it.
       *
       * A queued delivery (a peer session's message) reaches the model inside a
       * running turn. Absent for a prompt submitted while the session was idle,
       * and for a plugin's own (`$.prompt.submit`), which runs once it is idle.
       */
      turnId?: string;
      /**
       * Whether the user asked the prompt to wait its turn (`chat:queueSubmit`,
       * `ctrl+x enter` by default): true for that submission, false otherwise.
       *
       * The engine queues every prompt typed mid-turn either way; the flag is
       * for hooks, so one that cancels the running turn on a plain Enter can
       * leave a waiting prompt alone. False for a prompt a plugin submitted.
       */
      wait: boolean;
      /**
       * Where the submission came from (PromptOrigin), set by the engine where
       * it was queued: the user's Enter, a notification, a peer, a plugin.
       *
       * `next(e)` passes it on as received; no hook may set one.
       */
      origin: PromptOrigin;
  };

  /**
   * What a `prompt.submit` hook returns and what `next(e)` resolves to: the
   * prompt that entered, `{ text, context?, origin? }`, or `{ drop: reason }`.
   *
   * `next(e)` resolves once the prompt entered the session and its turn
   * started, or it was queued behind the running one; not when the turn ends,
   * which is `turn.complete`. A hook answering without `next` enters nothing.
   */
  export type PromptSubmitResult = {
      /**
       * The prompt that entered; from core, the text that arrived at the
       * bottom. A rewrite passes it down, `next({ ...e, text })`.
       */
      text: string;
      /**
       * What entered beside the prompt for the model, never shown the user:
       * from core, the context that arrived (`e.context`).
       *
       * Each entry is one block after the prompt as typed. A hook attaches
       * context on the way down; one put here after `next` resolved is not
       * attached (the prompt had entered), and is logged.
       */
      context?: readonly string[];
      /**
       * Where the prompt entered from: from core, `e.origin` as received;
       * absent, the prompt is the user's own.
       *
       * A hook may put back the origin it received; it may not set another.
       */
      origin?: PromptOrigin;
      drop?: undefined;
  } | {
      /**
       * The prompt did not enter: a hook's refusal, answered without `next`,
       * or a settings hook's block beneath.
       *
       * The text is shown to the user as the reason.
       */
      drop: string;
      text?: undefined;
      context?: undefined;
      origin?: undefined;
  };

  /**
   * `prompt.suggest`'s input as a plugin's `$.prompt.suggest(args)` takes it:
   * `origin` is the engine's to set (the calling plugin's name).
   */
  export type PromptSuggestArgs = Omit<PromptSuggestInput, 'origin'>;

  /**
   * The input of `prompt.suggest` (prompt-suggest/): a text about to be shown
   * dim in the empty prompt box, for Tab (or the right arrow) to take.
   */
  export type PromptSuggestInput = {
      /**
       * The proposed prompt: shown, not written; taking it puts it in the box
       * for editing. `next({ ...e, text })` proposes another.
       */
      text: string;
      /**
       * Who proposes (PromptSuggestOrigin), set by the engine where the
       * proposal starts. Pinned: `next(e)` passes it on as received.
       */
      origin: PromptSuggestOrigin;
  };

  /**
   * Who proposes the text at `prompt.suggest`, as the engine stamps it where
   * the proposal starts; a closed set a matcher narrows on.
   *
   * `next(e)` passes it on as received; no hook sets one.
   */
  export type PromptSuggestOrigin = {
      /**
       * The engine's own guess at the person's next prompt, generated after
       * a turn (the prompt-suggestion service).
       */
      kind: 'suggestion';
  } | {
      /**
       * A plugin's `$.prompt.suggest`.
       */
      kind: 'plugin';
      /**
       * The proposing plugin's name.
       */
      name: string;
  };

  /**
   * What a `prompt.suggest` hook returns and what `next(e)` resolves to:
   * whether the text is now the box's dim suggestion.
   */
  export type PromptSuggestResult = {
      /**
       * True once the box has the suggestion to show, at once or as soon as a
       * dialog gives the box back; false where it cannot show.
       *
       * It cannot while the box holds text, a turn runs, the text is blank, or
       * the session is headless. A hook answering `{ isShown: false }` without
       * `next` keeps it from showing.
       */
      isShown: boolean;
  };

  /**
   * A `$.ui.blit` argument repainting one of the caller's mounted Rasters.
   *
   * `columns` and `rows`, when given, must be the mounted size (a resize is a
   * redraw, `$.ui.invalidate("ui.render")`, not a blit).
   */
  export type RasterBlitArgs = {
      /**
       * The site the Raster is drawn in, by the `requestId` this plugin draws
       * it under: one of its panes' ids, a tool row's `tool_use_id`, the band's.
       */
      requestId: string;
      /**
       * The Raster's `key` in that drawing.
       */
      key: string;
      /**
       * The new cells, encoded as the element's `cells` are (RasterProps), for
       * the mounted `columns * rows`.
       */
      cells: string;
      /**
       * The width the cells are laid out for; refused unless it is the mounted
       * Raster's. Absent, the mounted width.
       */
      columns?: number;
      /**
       * The height the cells are laid out for; refused unless it is the mounted
       * Raster's. Absent, the mounted height.
       */
      rows?: number;
  };

  /**
   * The props of `Raster`, the terminal surface's cell-grid leaf: a fixed box
   * of cells, each a glyph, a foreground and a background, packed in `cells`.
   *
   * A leaf: no children, `hover` or `onPress` yet; repainted in place by
   * `$.ui.blit`. Terminal only for now (elsewhere a fragment); its palette
   * paints 1024 distinct color pairs at once and the rest as their nearest.
   */
  export type RasterProps = {
      /**
       * The element's address within the drawing: what `$.ui.blit` names to
       * repaint it, unique among the Rasters of one tree.
       */
      key: string;
      /**
       * How many terminal columns wide, 1 to 512; the site clips what its body
       * cannot show.
       */
      columns: number;
      /**
       * How many terminal rows tall, 1 to 256.
       */
      rows: number;
      /**
       * Every cell, row-major: standard padded base64 of `columns * rows`
       * little-endian u32 triplets `[codePoint, foreground, background]`.
       *
       * A code point is one printable width-1 BMP character (blocks, box drawing,
       * braille too), or the tree is refused naming the cell's index; a color is
       * `0x00RRGGBB`, or `0x01000000` (bit 24 alone) for the terminal's default.
       *
       * @example const words = Uint32Array.of(0x2588, 0xff8800, 0x01000000)
       * const cells = new Uint8Array(words.buffer).toBase64() // one orange cell
       */
      cells: string;
  };

  /**
   * The hooks module's entry: `export function register(on, options)`. `on`
   * registers hooks; `options` is the plugin's configuration (PluginOptions).
   *
   * The options are fixed for this activation: a change to them reloads the
   * plugin and `register` runs again with the new object. Hooks close over it.
   * Its return is dropped, a promise awaited: `on => on(...)` is a module.
   *
   * @example
   * on("tool.call", ($, e, next) => e.tool === "Bash" ? { deny: "no" } : next(e))
   */
  export type Register = (on: On, options: PluginOptions) => unknown;

  /**
   * What `on(...)` returns for a hook of type `F`: the registration, which
   * takes one `.catch` (CatchHandler); without it a failed hook is absent.
   *
   * A second `.catch` on one registration throws, as does one after
   * register() returned and one on `engine.create`, whose hook has no budget
   * and whose failure is the load's.
   */
  export type Registration<F> = {
      /**
       * Sets the handler run when the hook throws or overruns its budget; its
       * answer within the grace stands as the hook's result for the dispatch.
       *
       * The budget is HookBudget's `ms` and the grace its `catchMs`, both on
       * the clock that stops while the code waits on `next` or `$`.
       */
      readonly catch: (handler: CatchHandler<F>) => void;
  };

  /**
   * What an element takes as `children`, as JSX passes them: a node, a number
   * (drawn as its string), a value the factory drops, or a list that may nest.
   *
   * `false`, `null` and `undefined` are dropped, so `{ok && <Text>hi</Text>}`
   * and `{n > 0 ? <Text>{n}</Text> : null}` type; a mapped list beside a
   * sibling nests. The element holds the flat, normalized list of RenderNode.
   */
  export type RenderChildren = RenderNode | number | boolean | null | undefined | readonly RenderChildren[];

  /**
   * Everything `ui.render` can draw: one name per component that has a render
   * site; a matcher narrows on it.
   *
   * The permission dialog is drawn by the engine alone, since its answer
   * authorises an action; a plugin adds context with `$.ui.notice`. `Pane` is
   * the one component whose instances a plugin opens (`$.ui.open`).
   */
  export type RenderComponent = 'AskUserQuestion' | 'UserMessage' | 'AssistantMessage' | 'ToolUse' | 'ToolResult' | 'ToolGroup' | 'ToolProgress' | 'CommandOutput' | 'Spinner' | 'TurnDuration' | 'InfoNotice' | 'SessionMode' | 'PromptHint' | 'AbovePrompt' | 'Pane';

  /**
   * What a render hook returns, and what `next(e)` resolves to: a plain-data
   * tree of elements (a Box or Text is a StyledElement), strings as children.
   *
   * Props are an allowlisted subset of Ink's Box/Text props (the ones
   * ElementProps declares); a tree with any other prop fails validation as a
   * whole and the engine's own component is drawn with the original props.
   */
  export type RenderElement = StyledElement<'Box', BoxHoverProps> | StyledElement<'Text', TextHoverProps> | {
      /**
       * A button, on every surface: `[ label ]` on the terminal, a native
       * button on a desktop; a press raises `ui.press` (`e.element` the key).
       *
       * Built by `<Button>` or the table's `t.Button`. The `onPress` closure
       * stays in the plugin's own environment under `press.handle`; the host
       * holds the handle for the lifetime of the drawing. A leaf: no children.
       */
      type: 'Button';
      props: {
          /**
           * The element's address: what `e.element` carries and what a matcher
           * names (`{ element: "explain" }`).
           */
          key: string;
          /**
           * The text drawn on the button.
           */
          label: string;
          /**
           * One digit (`"1"`) or one lowercase letter (`"w"`) that presses it
           * while the plugin's site holds the focus; anything else is refused.
           *
           * The band after ctrl+x tab or a click, a focused `Pane`: on keydown,
           * lowercased; never from the composer, save a bare digit in an empty
           * one pressing a band Button. Two on one hotkey: the later wins.
           */
          hotkey?: string;
          /**
           * An engine keybinding action (`"app:cycleDiffBase"`) whose chord
           * presses the Button from the prompt; an unknown name is refused.
           *
           * Chords, or a modified key Global or an active context binds, on
           * the terminal while mounted, no dialog up, no engine handler of it
           * mounted; a pane's over the band's over another's, the last drawn.
           */
          action?: string;
          /**
           * Drawn without chrome: the hotkey in the accent color, a colon,
           * then the label (`1: Yes`); without a `hotkey`, the label alone.
           *
           * The focus still inverts it. In JSX the label may be the one string
           * child (`<Button hotkey="1" plain onPress={...}>Yes</Button>`); the
           * key defaults to the label.
           */
          plain?: true;
          /**
           * The label dim at rest, as `Text`'s `dimColor`, and at full strength
           * under the pointer or the focus; absent draws as false.
           */
          dimColor?: TextProps['dimColor'];
          /**
           * The site's ring starts on this element when the site takes the
           * keyboard; the first drawn of several. Absent draws as before.
           */
          autoFocus?: true;
      };
      /**
       * Where the handler lives: the plugin whose hook drew the element, and
       * the handle its environment keeps the `onPress` closure under.
       *
       * The runtime stamps the plugin as the tree leaves that hook.
       */
      press: {
          plugin: string;
          handle: number;
      };
      /**
       * Label style overrides (the Text set) the surface applies while the
       * nearest keyed Box, or the group `scope` names, is hovered; plain data.
       */
      hover?: TextHoverProps;
  } | {
      /**
       * A one-line text field on every surface; a change and Enter raise
       * `ui.input` (`e.element` the key, `e.kind` which, `e.value` the text).
       *
       * Built by `<Input>` or the table's `t.Input`. The `onInput` and
       * `onSubmit` closures stay in the plugin's own environment under
       * `press.handle`, held as a Button's is. A leaf: no children.
       */
      type: 'Input';
      props: {
          /**
           * The element's address: what `e.element` carries and what a matcher
           * names (`{ element: "reply" }`).
           */
          key: string;
          /**
           * Text drawn before the field.
           */
          label?: string;
          /**
           * Text drawn dim in an empty field.
           */
          placeholder?: string;
          /**
           * The text the field holds when drawn.
           */
          value?: string;
          /**
           * What Enter does, drawn beside the field while it has focus.
           */
          submitLabel?: string;
          /**
           * The site's ring starts on this element when the site takes the
           * keyboard; the first drawn of several. Absent draws as before.
           */
          autoFocus?: true;
      };
      /**
       * Where the handlers live: the plugin whose hook drew the element, and
       * the handle its environment keeps the closures under.
       *
       * The runtime stamps the plugin as the tree leaves that hook.
       */
      press: {
          plugin: string;
          handle: number;
      };
      children?: undefined;
  } | {
      /**
       * A one-of-several picker on every surface; a pick raises `ui.select`
       * (`e.element` the key, `e.value` the option's value).
       *
       * Built by `<Select>` or the table's `t.Select`. The `onSelect` closure
       * stays in the plugin's own environment under `press.handle`, held as
       * a Button's is. A leaf: no children.
       */
      type: 'Select';
      props: {
          /**
           * The element's address: what `e.element` carries and what a matcher
           * names (`{ element: "peer" }`).
           */
          key: string;
          /**
           * Text drawn before the current value.
           */
          label?: string;
          /**
           * What can be picked, in the order drawn: each a value and the text
           * drawn for it.
           */
          options: readonly SelectOption[];
          /**
           * Which option is selected when drawn.
           */
          value?: string;
          /**
           * The site's ring starts on this element when the site takes the
           * keyboard; the first drawn of several. Absent draws as before.
           */
          autoFocus?: true;
      };
      /**
       * Where the handler lives: the plugin whose hook drew the element, and
       * the handle its environment keeps the closure under.
       *
       * The runtime stamps the plugin as the tree leaves that hook.
       */
      press: {
          plugin: string;
          handle: number;
      };
      children?: undefined;
  } | {
      /**
       * A hyperlink every surface draws: an OSC 8 span on the terminal (its
       * text then the URL in dim where unsupported), an anchor on desktop.
       *
       * Inline: its children are the text, strings and inline elements;
       * absent children the label, absent both the URL. `href` is `https:`
       * (or `http://localhost`) and bounded, or the tree is refused.
       */
      type: 'Link';
      props: LinkProps;
      children?: RenderNode[];
  } | {
      /**
       * Source code every surface draws with the engine's highlighter, tokens
       * coloured by language; under `format: 'diff'`, unified-diff hunks.
       *
       * A leaf: a dim gutter numbers the lines from `startLine`; a diff has
       * both gutters, markers, add and remove backgrounds. `source` is
       * bounded as a Text's string is, or the tree is refused.
       */
      type: 'Code';
      props: CodeProps;
      children?: undefined;
  } | {
      /**
       * A block of markdown every surface draws as it draws an assistant
       * reply's text: its own renderer, theme, hyperlinks and highlighting.
       *
       * Built by `<Markdown>` or the table's `t.Markdown`. A leaf: `text` is
       * bounded as a Text's string is, or the tree is refused. Without a
       * `press` its links are the surface's own, opened as it opens links.
       */
      type: 'Markdown';
      props: MarkdownLeafProps;
      children?: undefined;
  } | {
      /**
       * A `Markdown` whose plugin answers the links it drew (`onLinkPress`):
       * a press on one raises `ui.press` with `e.link`, the surface opens none.
       */
      type: 'Markdown';
      props: MarkdownLeafProps;
      /**
       * Where the `onLinkPress` handler lives: the plugin whose hook drew
       * the element, and the handle its environment keeps the closure under.
       *
       * The runtime stamps the plugin as the tree leaves that hook.
       */
      press: {
          plugin: string;
          handle: number;
      };
      children?: undefined;
  } | {
      /**
       * A region one of the plugin's SURFACE MODULES, named by path, draws and
       * handles input for on the drawing thread, without `$` (ClientModule).
       *
       * `Client` from the table. One instance per plugin, drawing and `key`
       * lives while the node stays in the tree, and talks to the plugin's
       * hooks through `ui.message`. The desktop carries it as data.
       */
      type: 'Client';
      props: ClientProps;
      /**
       * Whose surface module `props.module` names: the plugin whose hook
       * drew the element, stamped by the runtime as the tree leaves it.
       */
      client: {
          plugin: string;
      };
      children?: undefined;
  } | {
      /**
       * A vector drawing, the remote surfaces' alone: the SVG markup is the
       * element's data, drawn in an isolated box, off the page.
       *
       * A leaf: hooks above wrap or replace it whole, nothing reaches inside;
       * a press other plugins should see goes on an enclosing Button. On a
       * surface whose table lacks it the tree is refused.
       */
      type: 'Svg';
      props: SvgProps;
      children?: undefined;
  } | {
      /**
       * A grid of terminal cells, the terminal surface's alone: each cell a
       * glyph, a foreground and a background, packed in `props.cells`.
       *
       * A leaf, one node however many cells; hooks above wrap or replace it
       * whole. A mounted one is repainted in place by its plugin's
       * `$.ui.blit`. On a surface whose table lacks it the tree is refused.
       */
      type: 'Raster';
      props: RasterProps;
      /**
       * Whose Raster: the plugin whose hook drew the element, stamped by the
       * runtime as the tree leaves it; the one plugin whose blit reaches it.
       */
      raster: {
          plugin: string;
      };
      children?: undefined;
  } | {
      /**
       * A picture, the terminal surface's alone: `props.source` drawn over a
       * box of cells where the terminal can, `props.alt` where it cannot.
       *
       * A leaf: hooks above wrap or replace it whole; a press other plugins
       * should see goes on an enclosing Button; keyed, its plugin's
       * `$.ui.blit` swaps it. On a surface without it the tree is refused.
       */
      type: 'Image';
      props: ImageProps;
      /**
       * Whose Image: the plugin whose hook drew the element, stamped by the
       * runtime as the tree leaves it; the one plugin whose blit reaches it.
       */
      image: {
          plugin: string;
      };
      children?: undefined;
  } | {
      /**
       * The component core draws itself, with the props held under `ref`.
       */
      type: 'engine';
      /**
       * Which drawing: the number core answered from `next(e)`, under which
       * it holds the props it received; 0 draws the original props.
       */
      ref: number;
  };

  /**
   * The render event: `ui.render`, one event for every component that has a
   * render site.
   */
  export type RenderEventName = 'ui.render';

  /**
   * The input of `ui.render`: a union discriminated by `component`, one member
   * per RenderComponent and per RenderSurface.
   */
  export type RenderInput<C extends RenderComponent = RenderComponent, P extends RenderSurface = RenderSurface> = C extends RenderComponent ? P extends RenderSurface ? RenderInputOf<C, P> : never : never;

  /**
   * One `ui.render` input, for a component narrowed to one surface.
   */
  export type RenderInputOf<C extends RenderComponent, P extends RenderSurface> = {
      /**
       * Where the tree will be drawn; one literal per member, so
       * `if (e.surface === "terminal")` narrows `e` and `$.ui.resolve(e)`.
       *
       * Over the wire it is what the client declared, a rendering fact and not a
       * trust signal: do not key policy on it.
       */
      surface: P;
      /**
       * Which component this instance is; the key a matcher narrows on.
       */
      component: C;
      /**
       * The instance: the tool_use_id for a dialog or tool row, the message id
       * for a message, the agent id for a spinner.
       *
       * Two drawings of one component are two instances.
       */
      requestId: string;
      /**
       * The size of what the surface draws into, in character cells, and whether
       * its layout docks a pane; absent where no surface has measured.
       *
       * Part of the envelope: a rewrite keeps it. On the terminal, the interactive
       * screen's, where a change of width re-draws every hooked site once the
       * resize settles; on a remote surface, what it reported.
       */
      viewport?: RenderViewport;
      /**
       * The component's plain-data props.
       */
      props: RenderPropsOf[C];
  };

  /**
   * A node of a render tree: an element, or a string (text).
   */
  export type RenderNode = RenderElement | string;

  /**
   * The plain-data props of each renderable component, as `ui.render` sees
   * them under `e.props`; a hook rewrites them with `next({ ...e, props })`.
   *
   * A rewrite is validated by the component and an invalid one draws the
   * original. This table is the plugin-facing render contract; the author's
   * file notes which surfaces raise each member (RENDER_SURFACES_OF).
   */
  export type RenderPropsOf = {
      /**
       * The dialog the AskUserQuestion tool opens.
       *
       * Raised on every surface.
       */
      AskUserQuestion: {
          /**
           * The name of the tool whose call opened the dialog (`AskUserQuestion`).
           */
          tool: string;
          /**
           * The tool's `questions` input, as the dialog will draw them; a rewrite
           * must still fit the tool's schema or the original is drawn.
           */
          questions: unknown[];
          /**
           * The call's `metadata.source` (who asked) when the model gave one.
           * Analytics only; never drawn.
           */
          metadataSource?: string;
      };
      /**
       * A user-role transcript row: the person's prompt (`> ...`), a background
       * task's notification, or a message another agent, teammate or session sent.
       *
       * `origin`, `task` and `from` tell them apart and are read-only; a rewrite
       * of `text` draws in the row alone: the stored message, and the model's
       * framing of another party's words as that party's, stay as they were.
       *
       * Raised on every surface.
       */
      UserMessage: {
          /**
           * What the row shows: the prompt as typed, a notification's summary, or
           * a message's body less the engine's framing (summary line included).
           *
           * A rewrite is printable, bounded text and draws where the engine draws
           * the body; a teammate block of several frames or with a summary line
           * keeps the engine's drawing, one string not being those parts.
           */
          text: string;
          /**
           * Where the stored message came from, as `prompt.submit` named it: the
           * composer's, a task notification's, a peer's, a channel's, a plugin's.
           *
           * `unclassified` for a teammate's (its drain stamps none) and for a
           * message stored before stamps. Read-only.
           */
          origin: PromptOrigin;
          /**
           * Whether the view draws the row in full: the ctrl+o transcript,
           * `--verbose`, a surface with no ctrl+o (an export). Read-only.
           *
           * False, a message row is one dim line naming its sender; a hook that
           * draws a compact row of its own passes when true, so ctrl+o shows all.
           */
          isExpanded: boolean;
          /**
           * What a notification row (`origin.kind` `task-notification`) reports
           * on: its background task; absent on every other row. Read-only.
           */
          task?: UserMessageTask;
          /**
           * Who sent the message the row carries: another agent of this session, a
           * teammate, another session, a channel; absent otherwise. Read-only.
           */
          from?: UserMessageFrom;
          /**
           * Which of its rows the transcript's viewport shows now: `null` while
           * drawn outside it, absent where the surface does not say. Read-only.
           *
           * Reported once drawn and again when it changes: on a scroll, for the
           * messages at the viewport's edges only. A rewrite carries it on as
           * received; one that changes or drops it is refused.
           */
          onScreen?: OnScreen | null;
      };
      /**
       * One text block of an assistant reply in the transcript; a rewrite
       * changes the drawing and leaves the stored message alone (ctrl+o).
       *
       * Raised on every surface.
       */
      AssistantMessage: {
          /**
           * The block's text, markdown, as the transcript will draw it.
           */
          text: string;
          /**
           * True on the block that draws the bullet opening a reply.
           */
          isFirstOfReply: boolean;
          /**
           * Which of its rows the transcript's viewport shows now: `null` while
           * drawn outside it, absent where the surface does not say. Read-only.
           *
           * Reported once drawn and again when it changes: on a scroll, for the
           * messages at the viewport's edges only. A rewrite carries it on as
           * received; one that changes or drops it is refused.
           */
          onScreen?: OnScreen | null;
      };
      /**
       * A tool call's row in the transcript (`Bash(ls -la)` and its result); the
       * call was decided by `tool.call`, so a rewrite here changes the row alone.
       *
       * Raised on every surface.
       */
      ToolUse: {
          /**
           * The id `tool.call` carried for this call (`e.tool_use_id` there); the
           * same value as the row's `requestId`, where it is looked for. Read-only.
           */
          tool_use_id: string;
          /**
           * Which one the row draws (`Bash`, `Read`, a plugin's tool), as
           * `tool.call` named it.
           */
          tool: string;
          /**
           * The call's input, as the model sent it.
           */
          input: unknown;
          /**
           * True while the call is still running.
           */
          isRunning: boolean;
          /**
           * True when the call ended in an error (a refusal at the dialog is one).
           */
          isErrored: boolean;
          /**
           * True when an abort ended the call: the user's Esc or a plugin's
           * `$.turn.abort` cut it while it ran, or dropped it before it ran.
           *
           * The row draws `Interrupted` for it, as the transcript marker does.
           */
          isInterrupted: boolean;
          /**
           * The stored result once the call has resolved (`{ stdout, stderr, ... }`
           * for Bash: `BuiltinToolResults[tool]`); undefined while it runs.
           *
           * For a call that errored, was refused or an abort cut, it is the text
           * the model read (an `isInterrupted` call: the abort's own). An expanded
           * group's rows draw it inline; a standalone row's is its own `ToolResult`.
           */
          output?: unknown;
          /**
           * Which of its rows the transcript's viewport shows now: `null` while
           * drawn outside it, absent where the surface does not say. Read-only.
           *
           * Reported once drawn and again when it changes: on a scroll, for the
           * messages at the viewport's edges only. A rewrite carries it on as
           * received; one that changes or drops it is refused.
           */
          onScreen?: OnScreen | null;
      };
      /**
       * The result block drawn under a standalone tool row in the transcript,
       * which the tool's own result renderer draws from `output`.
       *
       * A rewrite of `output` is checked against the tool's output schema (one
       * that does not fit draws nothing; one the renderer cannot read hits the
       * row's error boundary). The stored result is untouched.
       *
       * Raised on every surface.
       */
      ToolResult: {
          /**
           * The id `tool.call` carried for the call this result belongs to
           * (`e.tool_use_id` there); the same value as `requestId`. Read-only.
           */
          tool_use_id: string;
          /**
           * Which one the result belongs to (`Bash`, `Read`, a plugin's tool).
           * Read-only.
           */
          tool: string;
          /**
           * The tool's own result object (`{ stdout, stderr, interrupted, ... }` for
           * Bash), the same one `ToolUse.output` carries; a rewrite is drawn.
           *
           * A built-in tool's is `BuiltinToolResults[tool]`, the record
           * `tool.call` resolved as `result`.
           */
          output: unknown;
          /**
           * True when the call ended in an error, which draws the error text and not
           * `output`. Read-only.
           */
          isErrored: boolean;
          /**
           * Which of its rows the transcript's viewport shows now: `null` while
           * drawn outside it, absent where the surface does not say. Read-only.
           *
           * Reported once drawn and again when it changes: on a scroll, for the
           * messages at the viewport's edges only. A rewrite carries it on as
           * received; one that changes or drops it is refused.
           */
          onScreen?: OnScreen | null;
      };
      /**
       * A run of tool calls the transcript folds into one count line (`Read 3
       * files, ran 2 shell commands`): reads, searches, listings.
       *
       * A hook that sets `isExpanded` unfolds the group where it is, and each row
       * it unfolds into is a `ToolUse` drawing a `ToolUse` hook then sees.
       *
       * Raised on every surface.
       */
      ToolGroup: {
          /**
           * In the order the model made them.
           */
          calls: ReadonlyArray<ToolGroupCall>;
          /**
           * True while the group is the live one: a call in it may still be
           * running and the model's next call may join it.
           */
          isActive: boolean;
          /**
           * Whether each call draws as its own `ToolUse` row (true under
           * `--verbose` and in the ctrl+o transcript) or the group draws one line.
           *
           * The one prop of the three a rewrite changes on the screen.
           */
          isExpanded: boolean;
          /**
           * Which of its rows the transcript's viewport shows now: `null` while
           * drawn outside it, absent where the surface does not say. Read-only.
           *
           * Reported once drawn and again when it changes: on a scroll, for the
           * messages at the viewport's edges only. A rewrite carries it on as
           * received; one that changes or drops it is refused.
           */
          onScreen?: OnScreen | null;
      };
      /**
       * The output row a slash command printed in the transcript, under its echo
       * (`/cost`'s lines, the `text` a `command.run` hook answered).
       *
       * What the run resolved as text, a `local` command's or a plugin's alike. A
       * rewrite of `text` draws there and the stored row keeps what the model
       * reads; a hook's own tree draws in the row's place, the transcript's width.
       *
       * Raised on every surface.
       */
      CommandOutput: {
          /**
           * Which one printed the row, as `command.run` named it (no slash); a
           * hook on its own command matches by it.
           *
           * Read-only: a rewrite carries it on as received; one that changes or
           * drops it is refused and the engine draws its own row.
           */
          command: string;
          /**
           * The arguments the run had, as the echo above the row shows them
           * (`***` for a command that marks its arguments sensitive). Read-only.
           */
          args: string;
          /**
           * The row's text: what the command printed, or the `text` a hook
           * answered under its plugin's name; markdown, as the row draws it.
           */
          text: string;
          /**
           * True when the row is the run's error line (a command that threw),
           * which draws in the error colour and not dim. Read-only.
           */
          isErrored: boolean;
          /**
           * Which of its rows the transcript's viewport shows now: `null` while
           * drawn outside it, absent where the surface does not say. Read-only.
           *
           * Reported once drawn and again when it changes: on a scroll, for the
           * messages at the viewport's edges only. A rewrite carries it on as
           * received; one that changes or drops it is refused.
           */
          onScreen?: OnScreen | null;
      };
      /**
       * One row of the live tool-progress region under a running tool call; today
       * the run-in-background pill. One instance per row.
       *
       * A union on `kind`: other progress kinds join as their props become plain
       * data, each with its own fields, so a hook matches `{ props: { kind:
       * "background_hint" } }` or branches on `e.props.kind` and stays right.
       *
       * Raised on the terminal surface only.
       */
      ToolProgress: {
          /**
           * The tool call the row belongs to, as `tool.call` and the `ToolUse` row
           * carry it. Read-only: a rewrite carries it on as received.
           *
           * While several foreground calls share one pill, the first of them.
           */
          tool_use_id: string;
          /**
           * Which progress row: the run-in-background pill. Read-only.
           */
          kind: 'background_hint';
          /**
           * The pill's text as the engine draws it, dim, under the tool call:
           * `(ctrl+b to run in background)`, or with the person's own binding.
           *
           * A rewrite is drawn in its place, dim; `""` draws nothing. A hook that
           * returns a tree draws that instead.
           */
          hint: string;
      };
      /**
       * The line that animates while a turn runs (`Sauteing... (12s, 300
       * tokens)`); a remote surface draws its own.
       *
       * The row reads `word` (or `message` while one overrides it), then
       * `suffix`, then the dim parenthetical the engine keeps (elapsed time,
       * tokens, effort); a hook rewrites the first three or draws its own tree.
       *
       * Raised on the terminal surface only.
       */
      Spinner: {
          /**
           * Animated by the line (`Sauteing`), as sampled for this turn.
           */
          word: string;
          /**
           * The text drawn instead of the word while a state overrides it, else null.
           */
          message: string | null;
          /**
           * What the engine draws right after the word or message to say the turn is
           * still going: one ellipsis character.
           *
           * Left off a text that already ends in an ellipsis, so a rewritten
           * `message` ending in one shows one. A rewrite is drawn as given (`""`
           * draws the text bare, `" ~"` draws `Sauteing ~`); left out, the engine's.
           */
          suffix: string;
          /**
           * What the turn is doing.
           */
          mode: 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use';
      };
      /**
       * The line that closes a turn in the transcript (`Baked for 3s`); a
       * remote surface draws its own footer.
       *
       * Raised on the terminal surface only.
       */
      TurnDuration: {
          /**
           * The past-tense word the line drew (`Baked`), as sampled for this line.
           */
          word: string;
          /**
           * The turn's duration in milliseconds, as the line formats it (`3s`,
           * `1m 4s`).
           */
          durationMs: number;
          /**
           * Which of its rows the transcript's viewport shows now: `null` while
           * drawn outside it, absent where the surface does not say. Read-only.
           *
           * Reported once drawn and again when it changes: on a scroll, for the
           * messages at the viewport's edges only. A rewrite carries it on as
           * received; one that changes or drops it is refused.
           */
          onScreen?: OnScreen | null;
      };
      /**
       * One dim status line under the logo (the model source, an experiment
       * enrollment, a settings hint), with a trailing `/command`.
       *
       * Raised on the terminal surface only.
       */
      InfoNotice: {
          /**
           * The notice's text, flattened to one string.
           */
          text: string;
          /**
           * The slash command appended after the text, or null when the notice has
           * none.
           */
          command: string | null;
          /**
           * Which of its rows the transcript's viewport shows now: `null` while
           * drawn outside it, absent where the surface does not say. Read-only.
           *
           * Reported once drawn and again when it changes: on a scroll, for the
           * messages at the viewport's edges only. A rewrite carries it on as
           * received; one that changes or drops it is refused.
           */
          onScreen?: OnScreen | null;
      };
      /**
       * The dim mode labels at the right of the prompt footer (`focus`, `memory
       * paused`), joined by ` & `. One instance.
       *
       * A hook adds a mode by rewriting `modes`, removes one by filtering, or
       * draws its own tree.
       *
       * Raised on the terminal and desktop surfaces only.
       */
      SessionMode: {
          /**
           * The labels the footer shows, in order; empty when there are none.
           */
          modes: readonly string[];
      };
      /**
       * The dim hint line under the prompt (`? for shortcuts`, `esc to
       * interrupt`, the pills beside them). One instance.
       *
       * A hook rewrites `hint` and the rewrite is drawn in the line's place, or
       * draws its own tree; `isDraft` and `isWorking` say what the line is for.
       *
       * Raised on the terminal surface only.
       */
      PromptHint: {
          /**
           * True while the prompt holds typed text. Read-only.
           */
          isDraft: boolean;
          /**
           * True while a model turn is running. Read-only.
           */
          isWorking: boolean;
          /**
           * The line's text as the engine draws it; one string, so a rewrite
           * replaces the line.
           *
           * Read from the drawn line the way the screen reader reads it, one space
           * between parts.
           */
          hint: string;
      };
      /**
       * The band directly above the prompt input, where the surveys draw; the
       * engine draws nothing of its own here.
       *
       * A hook draws a tree, or passes; one instance. The person collapses it
       * (ctrl+x ctrl+a, `[-]`) or focuses it (a click, ctrl+x tab): an Input
       * types, a Button arms the hotkeys, a tree taller than it scrolls.
       *
       * Raised on the terminal surface only.
       */
      AbovePrompt: {
          /**
           * True while a survey holds the band; a hook yields to it. Read-only.
           */
          hasSurvey: boolean;
          /**
           * True while a model turn is running. Read-only.
           */
          isWorking: boolean;
          /**
           * Rows the band may take: in fullscreen, what the bottom slot has left
           * above the prompt; otherwise the terminal's height. Read-only.
           *
           * That slot is capped at half the terminal's rows, the prompt's included.
           * A tree of at most `maxRows` rows shows whole; a taller one scrolls in a
           * window of `scroll.bodyRows`, and a bare digit arms no Button's hotkey.
           */
          maxRows: number;
          /**
           * Cells across the band: the terminal's width, or the transcript
           * column's while a `Pane` is docked beside it. Read-only.
           *
           * A tree wider than this wraps or truncates as its Text props say; size
           * a table or a rule to it rather than to `viewport.columns`.
           */
          bodyColumns: number;
          /**
           * The band's window over a tree taller than `maxRows`: engine-owned,
           * moved by the wheel, and by the person's keys while the band is focused.
           *
           * `bodyRows` is `maxRows` less the `n more` row. Read-only.
           */
          scroll: SiteScroll;
          /**
           * Which transcript is on screen above the band: the main conversation's
           * (no `agentId`) or one agent's, opened from the tasks list.
           *
           * The same band under either; a switch re-runs the hook with the new
           * view. Read-only: a rewrite carries it on as received; one that changes
           * or drops it is refused, the hook that passed it failing.
           */
          view: SiteView;
      };
      /**
       * The framed region a plugin opened with `$.ui.open({ id })`: one instance
       * per id (`requestId`), its body the hook's tree, one shown, the rest tabs.
       *
       * Placed by the surface (docked in fullscreen, else above the prompt) and
       * keyed by the person (ctrl+x tab, Esc), who closes it from the engine's mark
       * or ctrl+x x: `ui.close` with origin `person`, which a hook may refuse.
       *
       * Raised on every surface.
       */
      Pane: {
          /**
           * Its tab's label while more than one pane is open (with one, the engine
           * draws no title): the `title` it was opened with, or its id.
           *
           * A click on a tab, or Tab onto it and Enter, shows that pane. Read-only
           * here; another `$.ui.open` (or a hook on `ui.open`) retitles.
           */
          title: string;
          /**
           * True while the person has given the pane the keyboard: Tab walks its
           * elements, a Button's `hotkey` presses it, the arrows scroll. Read-only.
           */
          isFocused: boolean;
          /**
           * Cells across the body, inside the frame. Read-only.
           */
          bodyColumns: number;
          /**
           * Where the surface seated the pane: `dock` beside the transcript (the
           * terminal in fullscreen from 110 columns), or `inline` above the prompt.
           *
           * Read-only: a rewrite carries it on as received; one that changes or
           * drops it is refused, the hook that passed it failing.
           */
          placement: 'dock' | 'inline';
          /**
           * The body's window over the tree: engine-owned, moved by the person's
           * keys while the pane is focused. Read-only.
           */
          scroll: SiteScroll;
          /**
           * Which transcript is on screen beside the pane: the main conversation's
           * (no `agentId`) or one agent's, opened from the tasks list.
           *
           * The pane stays open across a switch, one instance re-rendered for the
           * view, so a hook draws for the agent in view. Read-only: a rewrite carries
           * it on as received; one that changes or drops it is refused.
           */
          view: SiteView;
      };
  };

  /**
   * What a `ui.render` hook returns and what `next(e)` resolves to: a
   * RenderElement tree, the same for every component.
   */
  export type RenderResultOf = {
      [C in RenderComponent]: RenderElement;
  };

  /**
   * Where a render event's component is drawn: `terminal` is Ink, which draws
   * the hook's whole tree; the rest are remote surfaces drawing it themselves.
   *
   * `desktop` is Claude Code Desktop, `mobile` the Claude mobile app, `vscode`
   * Claude Code for VS Code. A remote surface asks over the wire (ui_render),
   * draws with the props the hook handed core, and draws the tree where it has
   * a slot for it.
   *
   * Each surface's ask is its own evaluation, since a tree may hold an element
   * only some surfaces draw (Svg, Client).
   */
  export type RenderSurface = 'terminal' | 'desktop' | 'mobile' | 'vscode';

  /**
   * The size of what a surface draws into, in character cells of the
   * surface's monospace metric, and whether its layout docks a pane.
   *
   * On the terminal, the conversation's columns and screen rows; on a remote
   * surface, the pane's width and height over the advance and line height of
   * its code font. Cell-based until the first element lays out in pixels.
   */
  export type RenderViewport = {
      /**
       * Cells across. A tree wider than this wraps or truncates, as its Text
       * props say.
       */
      columns: number;
      /**
       * Cells down the whole surface, not the room left for this component.
       *
       * Informational: a change of height alone re-draws nothing and keys no
       * new evaluation, so a hook reads it as of the last width or props change.
       */
      rows: number;
      /**
       * Whether this surface docks a pane beside the transcript, so a pane a
       * plugin opens unasked is a sidebar, not a takeover; absent is unknown.
       *
       * What `command.run`'s `presentation.isFullscreen` says. The terminal always
       * says: `true` fullscreen, `false` on the main screen, fixed per session; a
       * remote surface once its client reports it with the size, absent before.
       *
       * @remarks The desktop and VS Code report it once they place panes; the
       *   mobile app, which has no dock, `false`. A change re-draws the sites.
       * @example if (e.viewport?.isFullscreen === true) void $.ui.open({ id })
       */
      isFullscreen?: boolean;
  };

  /**
   * The input of `ui.resolve`: which surface's elements, for which component;
   * a union with one member per surface (ResolveInputOf).
   *
   * Resolved when the plugins load, ahead of any drawing, so it names the
   * surface and the component and not the props; a `ui.render` argument is
   * one (it carries both), which is what `$.ui.resolve(e)` takes.
   */
  export type ResolveInput<C extends RenderComponent = RenderComponent, P extends RenderSurface = RenderSurface> = P extends RenderSurface ? ResolveInputOf<C, P> : never;

  /**
   * One `ui.resolve` input, for a component on one surface.
   */
  export type ResolveInputOf<C extends RenderComponent, P extends RenderSurface> = {
      /**
       * Where the table draws; one literal per member, so a hook that narrows
       * it narrows the table `next(e)` resolves to.
       */
      surface: P;
      /**
       * Which drawing the table is resolved for; the key a matcher narrows on.
       */
      component: C;
  };

  /**
   * What each event's hook returns, and what its `next(e)` resolves to, by event
   * name.
   */
  export type ResultOf = EngineResultOf & ClassicResultOf & {
      [N in OpEventName]: OpEventResult<N>;
  } & {
      [N in NounEventName]: NounEventResult<N>;
  };

  type SDKAssistantMessageError = 'authentication_failed' | 'oauth_org_not_allowed' | 'account_on_hold' | 'verification_required' | 'billing_error' | 'rate_limit' | 'overloaded' | 'invalid_request' | 'model_not_found' | 'server_error' | 'unknown' | 'max_output_tokens' | 'cloud_credential_error';

  /**
   * The members of `T` assignable to `S`; all of `T` when none is.
   */
  type Select<T, S> = [Extract<T, S>] extends [never] ? T : Extract<T, S>;

  /**
   * The events a pattern selects, as a union of names: the one named, every
   * one under a glob's namespace, or every one a negation does not exclude.
   */
  export type Selected<P extends string> = P extends '*' ? EventName : P extends `!${infer Negated}` ? Exclude<EventName, Selected<Negated>> : P extends `${infer Prefix}.*` ? Extract<EventName, `${Prefix}.${string}`> : Extract<EventName, P>;

  /**
   * The literal each tag key of `I` is held to by matcher `M`: one-of arrays
   * flattened, RegExps widened to `unknown`.
   */
  type Selection<I, M> = {
      [K in keyof M & TagKeys<I>]: Literal<M[K] extends readonly (infer One)[] ? One : M[K]>;
  };

  /**
   * One option of a `Select`: the value `onSelect` and `ui.select` carry, and
   * the text drawn for it (the value when absent).
   */
  export type SelectOption = {
      value: string;
      label?: string;
  };

  /**
   * The props of `Select`, every surface's one-of-several picker: an address,
   * a label, the options, the one selected, the closure a pick runs. A leaf.
   *
   * Focused through the same ring as `Button` (`abovePrompt:focus`); keys reach
   * it only while it has focus (arrows move, Enter picks) and Esc always
   * returns to the prompt; a pick raises `ui.select`, its bottom `onSelect`.
   */
  export type SelectProps = {
      /**
       * The element's address: `e.element` at `ui.select`, what a matcher names.
       */
      key: string;
      /**
       * Text drawn before the current value.
       */
      label?: string;
      /**
       * What can be picked, in the order drawn; at least one, values unique.
       */
      options: readonly SelectOption[];
      /**
       * Which option is selected when drawn; the person's pick replaces it
       * until the hook draws another.
       */
      value?: string;
      /**
       * The site's focus ring starts here when the site takes the keyboard,
       * instead of on nothing, as the DOM's `autofocus`: Enter acts on it at once.
       *
       * A pane opened with `focus`, or the person's focus chord or click, is the
       * take. Of several in one site the first drawn wins; it raises `ui.focus`,
       * origin this plugin. A ring the person has moved stays where it was put.
       */
      autoFocus?: true;
      /**
       * Runs on a pick with the option's value, in the plugin's own environment:
       * the bottom of a `ui.select` chain. No model turn unless it asks one.
       */
      onSelect: (value: string, e: UiSelectArgument) => void;
  };

  /**
   * The input of `session.attach`: a surface joined the session's roster of
   * attached clients (a phone opened the session; the desktop app connected).
   *
   * A remote client attaches by saying so (ui_attach) or by its first ask to
   * draw; the terminal's attachment is the REPL's binding and raises nothing.
   * Every field is the engine's: a hook observes, `next(e)` passes them on.
   */
  export type SessionAttachInput = {
      /**
       * Where the client draws: what it declared, a rendering fact.
       */
      surface: RenderSurface;
      /**
       * The client's own id, unique in the roster; two phones are two clients on
       * one surface. A client that never named itself is `<surface>:default`.
       */
      clientId: string;
      /**
       * The size the client draws into, in character cells, and whether its
       * layout docks a pane, when it said.
       */
      viewport?: RenderViewport;
  };

  /**
   * What a `session.attach` hook returns and what `next(e)` resolves to:
   * `{ clientId }`, echoed by core; a hook's own value changes nothing.
   */
  export type SessionAttachResult = {
      clientId: string;
  };

  /**
   * What `$.session.authorize()` answers: an opaque handle for the session's
   * Anthropic credential and its kind, or null when there is none to hold.
   *
   * The secret itself stays with the engine; the handle is its plugin-side
   * face, spent through `$.http.fetch(url, { auth: handle })`.
   */
  export type SessionAuthorization = {
      handle: string;
      kind: 'bearer' | 'api-key';
  } | null;

  /**
   * `session.compact`'s input as a plugin's `$.session.compact(args)` takes
   * it: `trigger` (`plugin`), `messages` and `agentId` are the engine's.
   */
  export type SessionCompactArgs = {
      /**
       * What the summary should keep or stress, as typed after `/compact`;
       * absent, the engine's own compaction prompt alone.
       */
      instructions?: string;
  };

  /**
   * A compaction that stands: the conversation as it reads afterwards, and
   * the token counts the engine recorded when it was the one compacting.
   */
  export type SessionCompacted = {
      /**
       * The conversation after the compaction, oldest first: from core, its
       * summary and the messages it kept; from a hook, whatever it hands up.
       *
       * What the transcript becomes (kept, on `precompute`, for the compaction
       * that comes). A message with the engine's `handle` stands as the engine
       * has it; one without is built from its `role`, `text` and tool blocks.
       */
      messages: readonly SessionMessage[];
      /**
       * The conversation's size before, in tokens; absent when core did not
       * record it.
       */
      tokensBefore?: number;
      /**
       * Its size afterwards, in tokens; absent on `precompute` and when core
       * did not record it.
       */
      tokensAfter?: number;
      skip?: undefined;
  };

  /**
   * The input of `session.compact`: one compaction of the conversation, about
   * to run; `messages` is the transcript it runs over.
   */
  export type SessionCompactInput = {
      /**
       * What is compacting (SessionCompactTrigger); the key a matcher narrows
       * on. Pinned: `next(e)` passes it on as received.
       */
      trigger: SessionCompactTrigger;
      /**
       * The id of the loop compacting, for a subagent's or a fork's own
       * transcript; absent for the main conversation (tool.call's `agentId`).
       *
       * Pinned: left out of a rewrite it is put back, changed it fails the hook.
       * `$.session.messages()` is the main conversation whatever this names.
       */
      agentId?: string;
      /**
       * What the summary should keep or stress: the text after `/compact`, a
       * plugin's, or absent.
       *
       * `next({ ...e, instructions })` changes what the summarizer is told.
       */
      instructions?: string;
      /**
       * The transcript being compacted, in `$.session.messages()`'s shape, each
       * message carrying the engine's `handle`; a subagent's own under `agentId`.
       *
       * `next({ ...e, messages })` changes what is summarized: a message kept
       * with its handle is the engine's own, whole; one without is read as built.
       */
      messages: readonly SessionMessage[];
  };

  /**
   * What a `session.compact` hook returns and what `next(e)` resolves to: the
   * compaction (`{ messages, tokensBefore?, tokensAfter? }`) or `{ skip }`.
   *
   * There is no summary string: the summary is a message.
   */
  export type SessionCompactResult = SessionCompacted | SessionCompactSkipped;

  /**
   * A compaction vetoed: on `precompute` nothing is computed or kept; on any
   * other trigger the conversation stays as it is and one line says why.
   *
   * Core answers it too, when a classic PreCompact hook blocks.
   */
  export type SessionCompactSkipped = {
      /**
       * Why, as the notice reads.
       */
      skip: string;
      messages?: undefined;
  };

  /**
   * Who compacts: the person's `/compact` (`manual`), the engine at its
   * threshold or on a prompt too long (`auto`), a plugin, or a `precompute`.
   *
   * `precompute` is the one dispatch that installs nothing: its result is kept
   * for the compaction that comes, if the conversation it ran over still leads.
   */
  export type SessionCompactTrigger = 'manual' | 'auto' | 'plugin' | 'precompute';

  /**
   * The context window broken down as /context breaks it down: the rows, the
   * grid and the lists beneath it, in the SDK's `get_context_usage` shape.
   *
   * Less that reply's internal-build sections. Token counts are the engine's
   * estimates as numbers, never formatted: a `full` breakdown counts with the
   * token-count API where it can, a `summary` one estimates throughout.
   */
  export type SessionContextBreakdown = {
      /**
       * One row per category, the free space and the compaction buffer among
       * them; `kind` says which is which.
       */
      categories: ContextCategory[];
      /**
       * Tokens in use, unclamped: past `rawMaxTokens` when over the window.
       */
      totalTokens: number;
      /**
       * The window measured against, the same figure as `rawMaxTokens`.
       */
      maxTokens: number;
      /**
       * The window measured against, in tokens: the model's limit, or a smaller
       * compaction window (`autocompactSource` says which).
       */
      rawMaxTokens: number;
      /**
       * How that window was settled (ContextWindowSource); the SDK's reply
       * carries it under this name too, outside its typed schema.
       */
      autocompactSource: ContextWindowSource;
      /**
       * `totalTokens` over `rawMaxTokens` as a whole percentage, 0 to 100 and
       * past it when over.
       */
      percentage: number;
      /**
       * The grid, row by row: 10 by 10, 20 by 10 for a window of a million or
       * more, 5 wide when asked for under 80 `columns`.
       */
      gridRows: ContextGridSquare[][];
      /**
       * Which model the breakdown was computed for, as `/model` shows it.
       */
      model: string;
      /**
       * Each memory file in the context, with its path and tokens.
       */
      memoryFiles: ContextMemoryFile[];
      /**
       * Each MCP tool's schema, with its server and tokens.
       */
      mcpTools: ContextMcpTool[];
      /**
       * The custom agents the Agent tool describes, each with its tokens.
       */
      agents: ContextAgent[];
      /**
       * The slash-command listing, counted; absent when the session lists none.
       */
      slashCommands?: ContextSlashCommands;
      /**
       * The skill listing, counted, with one entry per skill; absent when the
       * session lists none.
       */
      skills?: ContextSkills;
      /**
       * The token count at which auto-compaction runs; absent when it is off.
       */
      autoCompactThreshold?: number;
      /**
       * Whether auto-compaction is on for the session.
       */
      isAutoCompactEnabled: boolean;
      /**
       * The last response's own token counts, or null before one came back.
       */
      apiUsage: ContextApiUsage | null;
  };

  /**
   * The live context window as the status line reads it, and by category as
   * /context breaks it down when the call asked (`{ breakdown }`).
   *
   * `tokens` and `percent` are the last API response's input side against the
   * model's window, absent until the first response of the live window: a
   * fresh session, or one just compacted, until its next response.
   */
  export type SessionContextUsage = {
      /**
       * Input tokens the last response was answered over: uncached, cache-written
       * and cache-read together (the status line's `total_input_tokens`).
       */
      tokens?: number;
      /**
       * The context window of the session's model, in tokens (the status line's
       * `context_window_size`).
       */
      window: number;
      /**
       * `tokens` over `window` as a whole percentage, 0 to 100 (the status
       * line's `used_percentage`).
       */
      percent?: number;
      /**
       * The window by category, as /context breaks it down: present only when
       * the call passed `breakdown`, and only with a session bound.
       *
       * It measures against the compaction window (`rawMaxTokens`), which may be
       * smaller than `window`, and estimates every category, so its
       * `totalTokens` need not equal `tokens`.
       */
      breakdown?: SessionContextBreakdown;
  };

  /**
   * What the session has cost, as `/cost` and the status line total it.
   */
  export type SessionCost = {
      /**
       * US dollars, summed over every priced API response this session.
       */
      usd: number;
  };

  type SessionCronSummary = {
      id: string;
      /**
       * Cron expression, e.g. "0 9 * * 1-5".
       */
      schedule: string;
      /**
       * False for one-shot wakeups whose cron field encodes a single fire time; true for tasks that re-fire on every match.
       */
      recurring: boolean;
      /**
       * Prompt text submitted when the cron fires. Capped at 1000 chars; clipped values append an in-string "... [+N chars]" marker.
       */
      prompt: string;
  };

  /**
   * The input of `session.detach`: a client left the session's roster. Every
   * field is the engine's: a hook observes, and `next(e)` passes them on.
   */
  export type SessionDetachInput = {
      /**
       * Where the client drew.
       */
      surface: RenderSurface;
      /**
       * The id it attached under.
       */
      clientId: string;
      /**
       * Why it left: it detached, or the session ended under it.
       */
      reason: SessionDetachReason;
  };

  /**
   * Why a client left the roster: `detach`, it said so (ui_detach); `end`, the
   * session ended with it still attached.
   */
  export type SessionDetachReason = 'detach' | 'end';

  /**
   * What a `session.detach` hook returns and what `next(e)` resolves to:
   * `{ clientId }`, echoed by core; a hook's own value changes nothing.
   */
  export type SessionDetachResult = {
      clientId: string;
  };

  type SessionEndHookInput = BaseHookInput & {
      hook_event_name: 'SessionEnd';
      reason: ExitReason;
  };

  /**
   * The input of `session.end`: the session is ending, why, and how to come back
   * to it.
   *
   * Every field is the engine's: a hook observes, and `next(e)` passes them on.
   */
  export type SessionEndInput = {
      /**
       * Why it ends (SessionEndReason), the word the classic SessionEnd hook
       * receives as its `reason`.
       */
      reason: SessionEndReason;
      /**
       * The ending session's id (`$.session.id()` until now); after a `/clear`
       * or a resume the process goes on under another.
       */
      sessionId: string;
      /**
       * What `claude --resume` takes to return to it.
       */
      resume: SessionResume;
  };

  /**
   * Why the session ended: the classic SessionEnd hook's own `reason`, word for
   * word.
   *
   * `prompt_input_exit`, the person left (/exit, ctrl+c, ctrl+d); `clear`, a
   * /clear started a fresh one; `resume`, another took its place; `logout`;
   * `other`, a `-p` run finished or the process got SIGINT, SIGTERM or SIGHUP.
   */
  export type SessionEndReason = ClassicHookInputs['SessionEnd']['reason'];

  /**
   * What a `session.end` hook returns and what `next(e)` resolves to:
   * `{ sessionId }`, echoed by core; a hook's own value changes nothing.
   */
  export type SessionEndResult = {
      sessionId: string;
  };

  /**
   * The input of `session.measure`: what `$.session.usage()` answers at this
   * moment, and which of its units moved since the last measurement a hook saw.
   *
   * The same figures the op reads, without `context.breakdown`: call
   * `$.session.usage({ breakdown })` from the hook when the categories matter.
   * Every field is the engine's: a hook observes, and `next(e)` passes them on.
   */
  export type SessionMeasureInput = {
      /**
       * The live context window (`$.session.usage()`'s `context`): the window,
       * and its fill once a response of the live window reported one.
       *
       * Never carries `breakdown` here.
       */
      context: SessionContextUsage;
      /**
       * The rate-limit windows the last response reported, each with its
       * `percentUsed`; empty off a subscription or before the first reading.
       */
      rateLimits: SessionRateLimit[];
      /**
       * What the session has cost so far; absent where the host keeps no ledger.
       */
      cost?: SessionCost;
      /**
       * Which units differ from the last measurement raised (UsageUnit), never
       * empty; the first measurement names every unit it has a figure for.
       *
       * `context`: the fill moved; `rateLimits`: a window moved a whole point,
       * appeared or left, or the account's limit status changed; `cost`: the
       * total grew.
       */
      changed: UsageUnit[];
  };

  /**
   * What a `session.measure` hook returns and what `next(e)` resolves to:
   * `{ changed }`, echoed by core; a hook's own value changes nothing.
   */
  export type SessionMeasureResult = {
      changed: UsageUnit[];
  };

  /**
   * One message of the transcript as `$.session.messages()` returns it.
   */
  export type SessionMessage = {
      /**
       * Who wrote it.
       */
      role: 'user' | 'assistant';
      /**
       * Its text blocks joined; '' when it has none.
       */
      text: string;
      /**
       * The tool_use blocks of an assistant message, each with its outcome
       * (`result`, `text`, `isError`) once the transcript holds it.
       */
      toolUses: ToolUseSummary[];
      /**
       * The tool_result blocks of a user message: `{ tool_use_id, text, isError,
       * result }`.
       */
      toolResults?: ToolResultSummary[];
      /**
       * An opaque token the engine stamps on a message it hands a
       * `session.compact` hook, so a list handed back maps to its own messages.
       *
       * Absent on `$.session.messages()` and on a message a hook built.
       */
      handle?: string;
  };

  /**
   * One rate-limit window as the rate-limit notices read it.
   */
  export type SessionRateLimit = {
      /**
       * Which window: `five_hour`, `seven_day`, or a Claude gateway's
       * `spend_limit`.
       */
      kind: string;
      /**
       * How much of the window is used, 0 to 100 with at most one decimal:
       * 23.5, or 7, never 7.000000000000001; past 100 on an exceeded spend limit.
       */
      percentUsed: number;
      /**
       * When the window resets, as an ISO 8601 timestamp.
       */
      resetsAt?: string;
  };

  /**
   * An external-event wake the delivery's text parsed as (a GitHub relay
   * event, a signal's notice): the envelope's attributes and its JSON body.
   */
  export type SessionReceiveEvent = {
      /**
       * The producing service (`github`).
       */
      source: string;
      /**
       * The event's discriminator (`pull_request.closed`, `check_suite`).
       */
      kind: string;
      /**
       * The envelope's JSON body (`{ pr: "acme/app#12", outcome: "merged" }`).
       */
      data: Record<string, unknown>;
      /**
       * The `data` keys whose values are free text a third party wrote (a
       * commenter's `author` and `comment`), as the producer marked them.
       *
       * Empty when none; the server asserts every other key's value, not these.
       */
      untrustedKeys: readonly string[];
  };

  /**
   * The input of `session.receive`: one inbound delivery (a relay's event, a
   * peer's message, a Remote Control prompt), sanitized, before it is queued.
   */
  export type SessionReceiveInput = {
      /**
       * Where the delivery came from, as the bridge classified it; the key a
       * matcher narrows on. `next(e)` passes it on as received.
       */
      origin: SessionReceiveOrigin;
      /**
       * The delivery's body as the model would read it (a content-block
       * delivery's text blocks, joined).
       */
      text: string;
      /**
       * The external-event wake the text parsed as (`source` `github` for a
       * subscribed pull request's event); passed on as received.
       *
       * Present only for a delivery the server itself rendered as a wake (a
       * webhook relay, the session inbox), by its asserted origin; anyone else's
       * wake-shaped text stays `text`. Its `untrustedKeys` name third-party text.
       */
      event?: SessionReceiveEvent;
  };

  /**
   * Where an inbound delivery came from, as the bridge classified it from the
   * server's stamps: `prompt.submit`'s `e.origin`, less what never arrives.
   */
  export type SessionReceiveOrigin = {
      /**
       * `bridge` the user's own from a Remote Control client; `peer` another
       * session; `unclassified` one the bridge could not place.
       *
       * `task-notification` a relay's event (a GitHub webhook) or a trigger;
       * `scheduled-trigger` a routine; `peer-send-message` another session's
       * SendMessage; `projects-relay` and `slack-ping` as at `prompt.submit`.
       */
      kind: 'bridge' | 'task-notification' | 'scheduled-trigger' | 'peer' | 'peer-send-message' | 'projects-relay' | 'slack-ping' | 'unclassified';
  };

  /**
   * What a `session.receive` hook returns and what `next(e)` resolves to: the
   * delivery that was queued, `{ text }`, or `{ consumed: reason }`.
   *
   * `next(e)` resolves once the delivery is queued; a hook answering without
   * `next` queues nothing.
   */
  export type SessionReceiveResult = {
      /**
       * The body the delivery was queued with; from core, `e.text` as it
       * arrived at the bottom.
       *
       * A rewrite passes it down, `next({ ...e, text })`.
       */
      text: string;
      consumed?: undefined;
  } | {
      /**
       * Takes the delivery, answered without `next`: it is not queued, not
       * written to the transcript and never reaches the model.
       *
       * The reason is logged, the plugin named.
       */
      consumed: string;
      text?: undefined;
  };

  /**
   * What `$.session.repo()` answers: the repository's root and its origin remote,
   * when the session is in one.
   */
  export type SessionRepo = {
      /**
       * The repository's root, absolute: the main working tree's for a worktree.
       */
      root: string;
      /**
       * The `origin` remote's URL as git has it (push URL preferred), or null when
       * the repository has none.
       */
      remote: string | null;
      /**
       * Whether the remote is one of the repositories this build treats as its
       * own; false in a build that has none or when the remote is unrecognized.
       *
       * The engine matches the build's own list of repositories with its
       * hardened remote parser. A plugin reads this to behave differently in a
       * public repository; which repositories are the build's is its to say.
       */
      internal: boolean;
      /**
       * The repository the allowlist matched, as `owner/name`; null when
       * `internal` is false.
       *
       * A working copy without a remote that the engine still recognises is
       * named by its own checkout configuration; a remote's name is its path.
       */
      name: string | null;
  };

  /**
   * How to come back to the session that ended: what `claude --resume` takes.
   */
  export type SessionResume = {
      /**
       * What `claude --resume <id>` takes, the ending session's own.
       *
       * It resumes a session that wrote a transcript: one that never ran a
       * prompt, or ran with persistence off, left nothing under this id.
       */
      id: string;
  };

  type SessionStartHookInput = BaseHookInput & {
      hook_event_name: 'SessionStart';
      source: 'startup' | 'resume' | 'clear' | 'compact' | 'fork';
      agent_type?: string;
      model?: string;
      session_title?: string;
      /**
       * resume/fork: seconds since the resumed transcript's last assistant response
       */
      seconds_since_last_response?: number;
      /**
       * resume/fork: the resumed transcript's last response input + cache_read + cache_creation + output tokens (for a server-side tool loop, its last iteration's window, not the summed totals)
       */
      context_tokens?: number;
      /**
       * resume/fork: seconds_since_last_response exceeds the prompt-cache TTL, so the first request re-caches context_tokens
       */
      prompt_cache_likely_expired?: boolean;
      /**
       * resume/fork: estimated cost of re-caching context_tokens on the session model - the managed modelPricing when set, otherwise list price; excludes the response
       */
      estimated_cache_write_usd?: number;
  };

  /**
   * The input of `session.start`: the session the process starts with, read the
   * way `$.session` reads it at that moment.
   */
  export type SessionStartInput = {
      /**
       * The directory the session runs in, absolute (`$.session.cwd()`).
       */
      cwd: string;
      /**
       * Where the session draws at start (`$.session.surfaces()[0]`): `terminal`
       * under the REPL; null for a `-p` run or the SDK, which draw nowhere yet.
       */
      surface: RenderSurface | null;
      /**
       * Whether a person is at the prompt: true under the REPL, false for a `-p`
       * run or the SDK.
       */
      isInteractive: boolean;
  };

  /**
   * What a `session.start` hook returns and what `next(e)` resolves to:
   * `{ cwd }`, echoed by core; a hook's own value does not change the session.
   */
  export type SessionStartResult = {
      cwd: string;
  };

  /**
   * What `$.session.usage()` answers: the context window's fill, the account's
   * rate-limit windows and the session's cost, as the status line has them.
   *
   * A figure the engine does not have is left out, never zeroed: `rateLimits`
   * is empty off a subscription, `cost` absent where the host keeps no ledger.
   */
  export type SessionUsage = {
      /**
       * The live context window: the status line's `context_window` figures.
       */
      context: SessionContextUsage;
      /**
       * The rate-limit windows the last API response reported (`five_hour`,
       * `seven_day`, a gateway's `spend_limit`); empty when none has a reading.
       */
      rateLimits: SessionRateLimit[];
      /**
       * What the session has cost so far, as /cost totals it; absent only where
       * the host keeps no cost ledger (the CLI always has one).
       */
      cost?: SessionCost;
  };

  /**
   * What `$.session.usage(args)` takes: nothing for the status line's figures
   * alone; `breakdown` to have the window broken down as /context breaks it.
   */
  export type SessionUsageArgs = {
      /**
       * Asks for `context.breakdown` and says how it is counted
       * (ContextBreakdownDetail); absent, none is computed and the call is free.
       *
       * `full` sends one token-count request per tool and memory file, as
       * /context does; `summary` estimates locally and sends none.
       */
      breakdown?: ContextBreakdownDetail;
      /**
       * The width the breakdown's grid will be drawn in, in terminal columns;
       * absent, the full-width grid. Read only with `breakdown`.
       *
       * Under 80 the grid is the narrow one /context draws there, 5 wide. A thin
       * client's breakdown is the remote workspace's, whose grid ignores this.
       */
      columns?: number;
  };

  /**
   * What `$.settings.read` answers: an object keyed as a settings.json is
   * (`permissions`, `env`, `hooks`, `model`, `enabledPlugins`, ...).
   *
   * Each key is as https://code.claude.com/docs/en/settings documents it and
   * https://json.schemastore.org/claude-code-settings.json types it. A
   * snapshot in plain data: a write to it changes nothing the engine reads.
   */
  export type Settings = Readonly<Record<string, unknown>>;

  /**
   * What `$.settings.read(args)` takes.
   */
  export type SettingsReadArgs = {
      /**
       * The one source read, as loaded; absent, the settings merged over every
       * source, as the engine runs under them.
       */
      source?: SettingsSource;
  };

  /**
   * One source of settings by the name a plugin gives it, lowest precedence
   * first; the engine's own name is the same word with `Settings` appended.
   *
   * `user` is ~/.claude/settings.json, `project` .claude/settings.json,
   * `local` .claude/settings.local.json, `flag` what `--settings` and the
   * SDK's inline settings carry, and `policy` the managed settings, every
   * managed tier merged.
   */
  export type SettingsSource = 'user' | 'project' | 'local' | 'flag' | 'policy';

  type SetupHookInput = BaseHookInput & {
      hook_event_name: 'Setup';
      trigger: 'init' | 'maintenance';
  };

  /**
   * Where a site's window sits over the tree a hook drew in it (a pane's body,
   * the band): the engine's to move (the person scrolls), the plugin's to read.
   */
  export type SiteScroll = {
      /**
       * The first row of the tree the window shows; 0 at the top. Read-only.
       */
      offset: number;
      /**
       * How many rows of the tree the window shows at once: the rows the
       * surface gave the body. Read-only.
       */
      bodyRows: number;
  };

  /**
   * Which transcript the person has on screen where a site draws: the main
   * conversation's, or one agent's, opened from the tasks list.
   *
   * The person's to switch, the plugin's to read: a switch re-runs the site's
   * hooks with the new view, the site itself staying where it is.
   */
  export type SiteView = {
      /**
       * The agent whose transcript is in view: the `id` `$.agent.list()` gives
       * it, the `agentId` its `turn.step` and `tool.call` events carry.
       *
       * Absent while the main conversation is in view. Read-only.
       */
      agentId?: string;
  };

  /**
   * The input of `skill.prompt`: one skill's prompt, at the moment the engine
   * expanded it for the model.
   *
   * Typed as `/name`, called through the Skill tool, or preloaded into a
   * subagent: the same event at each.
   */
  export type SkillPromptInput = {
      /**
       * Which skill (`commit`); the key a matcher narrows on.
       */
      skill: string;
      /**
       * The prompt's text as the skill computed it (its text blocks, joined).
       */
      text: string;
  };

  /**
   * What a `skill.prompt` hook returns: the text the model reads for that
   * skill.
   */
  export type SkillPromptResult = {
      text: string;
  };

  /**
   * Options of `$.clock.sleep`.
   */
  export type SleepOptions = {
      /**
       * Aborting it rejects the sleep at once.
       */
      signal?: AbortSignal;
  };

  /**
   * Options of `$.audio.speak`.
   */
  export type SpeakOptions = {
      /**
       * The system voice's exact name as the platform lists it (`Samantha`, or the
       * name of a voice you installed). Absent: the synthesizer's default voice.
       */
      voice?: string;
  };

  /**
   * The argument of `$.audio.speak(text, options)` as the event carries it.
   */
  type SpeakRequest = SpeakOptions & {
      /**
       * What to say, as plain text, of at most 4096 characters.
       */
      text: string;
  };

  /**
   * What `$.audio.speak` resolves with once the utterance has ended.
   */
  export type SpeakResult = {
      /**
       * Which synthesizer spoke: `system`, the platform's own (`say` on macOS).
       */
      via: 'system';
  };

  /**
   * `next` in a `*` hook: the set of events is open at runtime, so `e` is
   * `unknown` until `next.is(pattern, e)` narrows it to events it knows.
   *
   * The callable is an overload per known event (OrderedOverloads), then
   * `(e: unknown) => Promise<unknown>` last: `next(e)` with `e` still unknown
   * resolves to `unknown`.
   */
  export type StarNext = OrderedOverloads<EventName> & {
      (e: unknown): Promise<unknown>;
      /**
       * Continues this dispatch at a tier, as Next's `to` (a managed hook's):
       * `e` still unknown resolves to `unknown`.
       */
      readonly to: (e: unknown, tier: TargetTier) => Promise<unknown>;
      readonly signal: AbortSignal;
      readonly is: <M extends Pattern>(pattern: M, e: unknown) => e is Frozen<Args<Selected<M>>>;
      readonly event: EventName;
      readonly origin: Origin;
      readonly trace: readonly TraceEntry<EventName, unknown, unknown>[];
      readonly budget: NextBudget;
  };

  type StopFailureHookInput = BaseHookInput & {
      hook_event_name: 'StopFailure';
      error: SDKAssistantMessageError;
      error_details?: string;
      last_assistant_message?: string;
  };

  type StopHookInput = BaseHookInput & {
      hook_event_name: 'Stop';
      stop_hook_active: boolean;
      /**
       * Text content of the last assistant message before stopping. Avoids the need to read and parse the transcript file.
       */
      last_assistant_message?: string;
      /**
       * In-flight background work (running/pending + backgrounded) registered in this session. Lets hooks distinguish "session is done" from "session is paused waiting for background work to wake it". Empty array when nothing is in flight.
       */
      background_tasks?: BackgroundTaskSummary[];
      /**
       * Session-scoped cron tasks (CronCreate, ScheduleWakeup, /loop) that will wake this session later. Empty array when none are scheduled.
       */
      session_crons?: SessionCronSummary[];
  };

  /**
   * The hook a streaming event takes: `async function* ($, e, next) {}`,
   * yielding the event's chunks and returning its result.
   *
   * `return yield* next(e)` passes; `for await (const c of next(e)) yield
   * f(c)` transforms; yielding without `next` answers alone. A chunk yielded
   * stays: a hook that fails mid-stream is left, the rest from beneath it.
   *
   * @example on('turn.step', async function* ($, e, next) {
   *   const r = yield* next(e); return { ...r } })
   */
  export type StreamHook<N extends StreamingEventName> = ($: EngineInterface, e: Frozen<Args<N>>, next: StreamNext<N>) => StreamHookBody<Chunk<N>, EventResult<N>>;

  /**
   * What a hook on a streaming event evaluates to: the async generator an
   * `async function*` makes, yielding `C` and returning `R` or nothing.
   *
   * Returning nothing lets its last `next(e)`'s result stand. A plain
   * function is a type error here even when it returns `next(e)`: the hook
   * is the generator, not a function that hands one back.
   */
  export type StreamHookBody<C, R> = AsyncGenerator<C, R | void> & {
      /**
       * Absent on a generator; present on `next(e)`, which is not a hook body.
       */
      readonly result?: never;
  };

  /**
   * The events that stream: their hooks are async generators, `next(e)` is
   * the stream of everything beneath, and the result is what it returns.
   *
   * `turn.step` alone: the model's response arrives in pieces, and a hook
   * that saw it whole could not change what had already been shown.
   */
  export type StreamingEventName = 'turn.step';

  /**
   * The rest of the chain as a hook on a streaming event receives it: Next,
   * except that `next(e)` is the stream beneath (HookStream), not a promise.
   *
   * Each call opens a fresh stream; for `turn.step` each is a model request,
   * so a hook that calls it twice makes two. Not calling it yields the hook's
   * own chunks and returns its own result, and nothing beneath runs.
   *
   * @template S what `next.is(pattern, e)` narrows `e` to, as Next's
   * @see HookBudget `ms`: the hook's budget counts its own code, never a wait
   * at a `yield` or on this stream, however long the response beneath takes
   */
  export type StreamNext<N extends StreamingEventName = StreamingEventName, E = Args<N>, O = NextResult<N>, S extends {
      [K in N]?: unknown;
  } = {
      [K in N]: Args<K>;
  }> = Pick<Next<N, E, O, S>, 'signal' | 'is' | 'event' | 'origin' | 'budget'> & {
      (e: E): HookStream<Chunk<N>, O>;
      /**
       * Continues this dispatch at a tier, as Next's `to`: the stream beneath
       * with the links between this hook's tier and that one skipped.
       */
      readonly to: (e: E, tier: TargetTier) => HookStream<Chunk<N>, O>;
      /**
       * What settled beneath on the latest `next()` stream, as Next's; a
       * streaming link's entry counts the chunks it yielded up (`chunks`).
       */
      readonly trace: readonly TraceEntry<N, E, O>[];
  };

  /**
   * The shape a `Box` and a `Text` share in a render tree: allowlisted props,
   * an optional `hover`, the group stamp a `hover.scope` earns, and children.
   *
   * `Tag` is which of the two; `Hover` is that element's hover props. Every
   * surface draws both: Ink's Box and Text on the terminal, a flex div and a
   * styled span on the desktop.
   */
  type StyledElement<Tag extends 'Box' | 'Text', Hover> = {
      type: Tag;
      /**
       * A Box's layout, position, spacing and border props and the `key` that
       * makes it a hover scope; a Text's colors and styles. Others are refused.
       */
      props?: Record<string, string | number | boolean>;
      /**
       * Style overrides the surface applies while the pointer is over the
       * nearest keyed Box, or over any member of the group `scope` names.
       *
       * Plain data, no hook. Nothing that moves a sibling: `borderStyle`
       * restyles a border the Box has, `display` only reveals a Box drawn
       * `"none"` (under a keyed Box or in a scope), an offset moves a placed Box.
       */
      hover?: Hover;
      /**
       * Whose group `hover.scope` names; absent without a `scope`.
       */
      group?: PluginStamp;
      /**
       * In order: a Box holds elements and strings (core wraps each string in
       * a Text); a Text holds strings and inline elements, never an engine node.
       */
      children?: RenderNode[];
  };

  type SubagentStartHookInput = BaseHookInput & {
      hook_event_name: 'SubagentStart';
      agent_id: string;
      agent_type: string;
  };

  type SubagentStopHookInput = BaseHookInput & {
      hook_event_name: 'SubagentStop';
      stop_hook_active: boolean;
      agent_id: string;
      agent_transcript_path: string;
      agent_type: string;
      /**
       * Text content of the last assistant message before stopping. Avoids the need to read and parse the transcript file.
       */
      last_assistant_message?: string;
      /**
       * In-flight background work (running/pending + backgrounded) registered in this session. Lets hooks distinguish "session is done" from "session is paused waiting for background work to wake it". Empty array when nothing is in flight.
       */
      background_tasks?: BackgroundTaskSummary[];
      /**
       * Session-scoped cron tasks (CronCreate, ScheduleWakeup, /loop) that will wake this session later. Empty array when none are scheduled.
       */
      session_crons?: SessionCronSummary[];
  };

  /**
   * The props of `Svg`, the remote surfaces' vector leaf: the markup is the
   * element's data, as a string is a Text's, drawn isolated.
   *
   * A leaf: no children. The surface never lets the markup reach the page
   * (the engine bounds it; the desktop and the editor draw it as an image, or
   * in a sandboxed frame when `isInteractive`; the mobile app in a web view).
   */
  export type SvgProps = {
      /**
       * The SVG document, `<svg ...>...</svg>`, at most 131072 characters.
       */
      source: string;
      /**
       * What the drawing says, for a reader that cannot see it; required, since
       * a surface without the element draws nothing else of it.
       */
      alt: string;
      /**
       * CSS pixels; absent, the box takes the markup's own width up to the slot.
       */
      width?: number;
      /**
       * CSS pixels; absent, the markup's own height at the drawn width.
       */
      height?: number;
      /**
       * `true` draws the SVG in a script-less sandboxed frame so hover, CSS
       * `:hover`, SMIL animation and `<title>` tooltips work; absent, an image.
       *
       * It never enables script or event-handler attributes (the frame has no
       * allow-scripts and the scrub strips them); presses that other plugins
       * should observe go on an enclosing element.
       */
      isInteractive?: boolean;
  };

  /**
   * The keys of `I` a matcher may select variants by: literal-valued in every
   * variant, and one literal per variant (IsDiscriminant).
   */
  type TagKeys<I> = {
      [K in MatcherKeys<I>]: IsLiteralValued<MatcherValueOf<I, K>> extends true ? IsDiscriminant<I, K> extends true ? K : never : never;
  }[MatcherKeys<I>];

  /**
   * A tier `next.to(e, tier)` may name: one a floor can reach past a tier of
   * less authority to, so never `prepend` or `user`, which nothing skips to.
   */
  export type TargetTier = Exclude<Tier, 'prepend' | 'user'>;

  type TaskCompletedHookInput = BaseHookInput & {
      hook_event_name: 'TaskCompleted';
      task_id: string;
      task_subject: string;
      task_description?: string;
      teammate_name?: string;
      /**
       * @deprecated Sessions have a single implicit team; this carries the session-derived team name and will be removed in a future release.
       */
      team_name?: string;
  };

  type TaskCreatedHookInput = BaseHookInput & {
      hook_event_name: 'TaskCreated';
      task_id: string;
      task_subject: string;
      task_description?: string;
      teammate_name?: string;
      /**
       * @deprecated Sessions have a single implicit team; this carries the session-derived team name and will be removed in a future release.
       */
      team_name?: string;
  };

  type TeammateIdleHookInput = BaseHookInput & {
      hook_event_name: 'TeammateIdle';
      teammate_name: string;
      /**
       * @deprecated Sessions have a single implicit team; this carries the session-derived team name and will be removed in a future release.
       */
      team_name: string;
  };

  /**
   * The `Text` props a `hover` may override (its colors and styles, not its
   * wrapping) and `scope`, the hover group it joins; a `Button`'s label too.
   */
  export type TextHoverProps = {
      /**
       * Names a hover group of this plugin's: every element it draws with the
       * same `scope`, in any site on the surface, lights while any is hovered.
       *
       * Another plugin's elements under the same string are a different group.
       * One to 64 characters, no control characters; no keyed Box needed. On the
       * terminal a Text nested in a Text follows its group but cannot heat it.
       */
      scope?: string;
      color?: string;
      backgroundColor?: string;
      dimColor?: boolean;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      inverse?: boolean;
  };

  /**
   * The props of `Text`: the color and style props of Ink's Text a tree may
   * set. Colors are a theme key or a raw color.
   */
  export type TextProps = {
      /**
       * Style overrides applied by the surface while the pointer is over the
       * nearest enclosing keyed `Box`, or, given a `scope`, over its group.
       *
       * No hook runs and nothing crosses to the plugin. Refused outside a keyed
       * Box unless it names a `scope`.
       */
      hover?: TextHoverProps;
      color?: string;
      backgroundColor?: string;
      dimColor?: boolean;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      inverse?: boolean;
      wrap?: 'wrap' | 'end' | 'middle' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';
  };

  /**
   * One of the chain's five tiers (TIERS), outermost first; on every
   * `next.trace` entry, and what `next.to(e, tier)` names.
   *
   * `prepend` and `append` are the managed plugins an administrator lists,
   * `user` everything a person installs, `builtin` the plugins bundled in the
   * binary, `core` the engine's innermost link.
   */
  export type Tier = (typeof TIERS)[number];

  /**
   * The chain's five tiers, outermost first: earlier is outer is more
   * authority, and same-event hooks nest in this order and no other way.
   *
   * The managed plugins an administrator prepends, everything a person
   * installs, the managed plugins appended, the plugins bundled in the binary,
   * the engine's innermost link; a built-in's `$` calls still raise everywhere.
   */
  const TIERS: readonly ["prepend", "user", "append", "builtin", "core"];

  /**
   * A pending timer from `$.clock.after` / `$.clock.every`.
   */
  export type Timer = {
      /**
       * Stops it; a stopped timer never fires again.
       */
      cancel: () => void;
  };

  /**
   * A timer on `$.clock` (`after`, `every`): `fn` runs after `ms` milliseconds,
   * once or until `cancel()`.
   */
  export type TimerCall = (ms: number, fn: () => void) => Timer;

  /**
   * Options of `$.ui.toast`.
   */
  export type ToastOptions = {
      /**
       * How long the line stays, in milliseconds; default 4000.
       */
      timeoutMs?: number;
  };

  /**
   * `tool.call`'s input as the call takes it: `tool_use_id` and `agentId` may
   * ride along (a hook passing its event's input on) and are dropped.
   *
   * The run gets its own id and runs in the session's loop.
   */
  export type ToolCallArgs = ToolCallEnvelope extends infer I ? I extends ToolCallEnvelope ? Omit<I, 'tool_use_id'> & ToolCallReserved<I['tool']> : never : never;

  /**
   * The envelope the two tool events share: the tool, the id of this call, and
   * the tool's arguments spread beside them (`e.command` for Bash).
   *
   * A union discriminated by `tool`: after `if (e.tool === "Bash")`, `e.command`
   * is a string and a rewrite is checked against Bash's schema. The `e` of
   * `classic.PreToolUse` exactly; `tool.call`'s adds the loop (ToolCallInput).
   */
  export type ToolCallEnvelope = BuiltinToolCallInput | McpToolCallInput;

  /**
   * The input of `tool.call`: the tool, the id of this call, the tool's
   * arguments beside them (`e.command` for Bash), and `agentId` in a subagent.
   *
   * A union discriminated by `tool`: after `if (e.tool === "Bash")`, `e.command`
   * is a string and a rewrite is checked against Bash's schema. `tool`,
   * `tool_use_id` and `agentId` are reserved: a rewrite of any is refused.
   */
  export type ToolCallInput = ToolCallEnvelope & AgentLoop;

  /**
   * `$.tool.call(input)`: resolves with `result` typed for the tool `input`
   * names (ToolCallResult), or loosely for an input that names none literally.
   */
  type ToolCallOverloads = {
      <T extends string>(input: ToolCallArgs & ToolNamed<T>): Promise<ToolCallResult<T>>;
      (input: ToolCallArgs): Promise<ToolCallResult>;
  };

  /**
   * The keys `tool.call`'s input carries beside the tool's own arguments, none
   * of which the tool sees (the engine strips them before the tool runs).
   *
   * `consent` is the person's own words for the press that raised the call
   * (`The user pressed "1: Yes" on ...`): the run's context carries it as a human
   * turn, which the permission path reads as the user's request.
   */
  export type ToolCallReserved<T> = {
      tool: T;
      tool_use_id?: string;
      consent?: string;
  };

  /**
   * What a `tool.call` hook returns and what `next(e)` and `$.tool.call(input)`
   * resolve to: the tool's result (`{ result, context? }`) or `{ deny }`.
   *
   * From core the result is `{ ref, result, text }` or, when the tool reported
   * an error, `{ ref, result, text, isError }`; `ref` names core's messages.
   *
   * @template Name the tool the call went to, typing `result` per built-in
   *   tool (BuiltinToolResults) once `e.tool` is narrowed; else `unknown`
   */
  export type ToolCallResult<Name extends string = string> = {
      /**
       * Refuses the call: the model receives the text as an error result.
       * Absent when the call was answered.
       */
      deny: string;
      result?: undefined;
      context?: undefined;
      ref?: undefined;
      text?: undefined;
      isError?: undefined;
  } | {
      /**
       * The tool's output: from core the tool's record, typed per built-in
       * tool once `e.tool` and `isError` are narrowed; from a hook, its own.
       *
       * Core validates a hook's answer against the tool's output schema when
       * it has one, maps it for the model with the tool's own mapper, and
       * records it in the transcript as the tool's result. Absent on a deny.
       */
      result: ToolResultOf<Name>;
      /**
       * What the model reads after the tool's result and the user never
       * sees. From core, none.
       *
       * One reminder, as a PostToolUse hook's is, after the managed tier's
       * review; none on a plugin's own `$.tool.call`. Kept whole from `next`,
       * none empty, any length: past 100,000 (200,000 together) head + path.
       */
      context?: readonly string[];
      /**
       * Set by core on what `next(e)` resolves to: names the messages core
       * produced for the call (they stay on the host side).
       *
       * A hook that returns the object it got makes core use them verbatim.
       * Absent on a hook's own `{ result }` and on a deny.
       */
      ref?: number;
      /**
       * Set by core: the result as the model reads it (text blocks joined),
       * present whatever the tool, where `result`'s shape varies per tool.
       *
       * Absent on a hook's own `{ result }`.
       */
      text?: string;
      isError?: undefined;
      deny?: undefined;
  } | {
      /**
       * Set by core, present only when the tool reported an error (it threw,
       * was interrupted, or answered an error): `text` is what the model read.
       */
      isError: true;
      /**
       * What the transcript stored for the errored call: the error text, or
       * undefined when nothing was stored; never the tool's typed record.
       */
      result: unknown;
      /**
       * The error as the model reads it.
       */
      text?: string;
      /**
       * As on an answered result: names the messages core produced.
       */
      ref?: number;
      /**
       * As on an answered result.
       */
      context?: readonly string[];
      deny?: undefined;
  };

  /**
   * `tool.check`'s input as `$.tool.check` takes it: the tool and its
   * arguments; `tool_use_id` is the engine's to set, never a query's.
   */
  type ToolCheckArgs = Pick<ToolCheckInput, 'tool' | 'input'>;

  /**
   * The verdict of `tool.check`: run the tool, put it to the mode's decider
   * (the dialog, the auto-mode classifier, a headless host), or refuse it.
   */
  type ToolCheckDecision = 'allow' | 'ask' | 'deny';

  /**
   * The input of `tool.check`: the tool, its arguments, and the call's id when
   * the engine is deciding a real call.
   *
   * All three are the question's identity and are pinned: a hook decides
   * about this call, it does not change it (`tool.call` rewrites a call).
   */
  type ToolCheckInput = {
      /**
       * As the model names it (`Bash`, `mcp__server__tool`); the key a matcher
       * narrows on.
       */
      tool: string;
      /**
       * The tool's arguments as the permission decision reads them
       * (`{ command }` for Bash, `{ file_path, ... }` for the file tools).
       */
      input: unknown;
      /**
       * The call being decided, on a real call only; absent on a query.
       *
       * `next.origin` names who raised it: `{ plugin: 'engine', tier: 'core' }`
       * for the model's own call, the plugin for its `$.tool.call` or its query.
       */
      tool_use_id?: string;
  };

  /**
   * What a `tool.check` hook returns and what `next(e)` resolves to: the
   * verdict, why, and the settings rule behind it when one decided.
   *
   * From core, the engine's declarative decision for the session's mode and
   * rules. A hook may answer any verdict in either direction; the last word up
   * the chain is the decision.
   */
  type ToolCheckResult = {
      /**
       * `allow` runs the tool; `ask` puts it to the mode's decider; `deny`
       * refuses it, the reason the model's error.
       */
      decision: ToolCheckDecision;
      /**
       * Why, in a sentence: from core the rule or check that decided; from a
       * hook, what the model reads on a deny and the dialog shows on an ask.
       */
      reason?: string;
      /**
       * The settings rule that decided, as written (`Bash(git push:*)`).
       *
       * Absent for a mode or a tool's own check.
       */
      rule?: string;
  };

  /**
   * Where a `tool.describe` answer places the tool: `true` behind ToolSearch
   * (its schema loads when the model asks for it), `false` in the prompt's list.
   *
   * Left out of an answer, the placement beneath stands.
   */
  export type ToolDeferral = boolean;

  /**
   * The input of `tool.describe`: one tool's description, at the moment the
   * engine first renders the tool's schema for the model.
   */
  export type ToolDescribeInput = {
      /**
       * As the model sees the name (`Bash`, `mcp__server__tool`); the key a
       * matcher narrows on.
       */
      tool: string;
      /**
       * The tool's description as it computed it.
       */
      description: string;
      /**
       * Present, and true, when the engine lists the tool behind ToolSearch (its
       * schema loads when the model asks for it by name); absent for one listed.
       *
       * By the engine's rule an MCP server's tool, or one that asks to be,
       * unless a rule keeps it in front.
       */
      isDeferred?: true;
      /**
       * Who provides this tool: the plugin and its tier; `{ plugin: "engine",
       * tier: "core" }` for a built-in. Pinned: a rewrite is refused.
       *
       * A configured MCP server's tool is `mcp:<server>`, in `prepend` when the
       * policy settings source configures the server, else `user`.
       */
      provider: Origin;
  };

  /**
   * What a `tool.describe` hook returns: the description the model sees for that
   * tool and, when the hook moves it, where the tool waits (ToolDeferral).
   *
   * `{ description }` alone, or `{ ...(await next(e)), description }`, changes
   * the text and keeps the engine's placement; `isDeferred: true` puts the tool
   * behind ToolSearch, `isDeferred: false` puts its schema in the prompt's list.
   */
  export type ToolDescribeResult = {
      description: string;
      isDeferred?: ToolDeferral;
  };

  /**
   * `{ tool, tool_use_id, ...args }` as one flat object type, generic over
   * the tool name and its parsed arguments.
   */
  type ToolEnvelope<Name, Arguments> = {
      /**
       * The name of the tool being called (`Bash`, `mcp__<server>__<tool>`);
       * comparing it narrows `e`. Reserved: a rewrite of it is ignored by core.
       */
      tool: Name;
      /**
       * The tool_use block's id: the same at every event of the call and in
       * `$.ui.notice`. Reserved: a rewrite of it is ignored by core.
       */
      tool_use_id: string;
  } & Arguments;

  /**
   * One tool call of a ToolGroup, as `ui.render` sees it under `calls`.
   */
  export type ToolGroupCall = {
      /**
       * The id `tool.call` carried for this call (`e.tool_use_id` there), so a
       * hook that saw the call finds its row in the group. Read-only.
       *
       * Absent on a desktop host that predates it.
       */
      tool_use_id?: string;
      /**
       * Which one the call ran (`Bash`, `Read`, `Grep`, ...).
       */
      tool: string;
      /**
       * The call's input, as the model sent it.
       */
      input: unknown;
      /**
       * True while the call is still running.
       */
      isRunning: boolean;
      /**
       * True when the call ended in an error.
       */
      isErrored: boolean;
      /**
       * True when an abort ended the call, as on `ToolUse`.
       */
      isInterrupted: boolean;
      /**
       * As on `ToolUse`; undefined while the call runs.
       */
      output?: unknown;
  };

  /**
   * One tool as `$.tool.list()` returns it.
   */
  export type ToolInfo = {
      /**
       * What the model calls it by.
       */
      name: string;
      /**
       * What it does, in the tool's own words (its description; a first sentence at
       * most for MCP tools without one).
       */
      description: string;
      /**
       * True for an MCP server's tool.
       */
      mcp: boolean;
  };

  /**
   * `{ tool, tool_use_id, ...args }` as one flat object type.
   *
   * The docs of `tool` and `tool_use_id` live on the `keyof` operand: a mapped
   * type takes its properties' docs from there.
   */
  export type ToolInputOf<Name extends string, Arguments> = {
      [K in keyof ToolEnvelope<Name, Arguments>]: ToolEnvelope<Name, Arguments>[K];
  };

  /**
   * An input that names its tool as the literal `T`: what `next` and
   * `$.tool.call` read to type the call's result per tool (NextResultFor).
   */
  type ToolNamed<T extends string> = {
      /**
       * The name of the tool being called (`Bash`).
       */
      readonly tool: T;
  };

  /**
   * The structured result of the tool named `Name`: its BuiltinToolResults
   * entry for a built-in tool, else `unknown`.
   *
   * Agent's is its entry or an AgentCallRecord (what a plugin-raised call
   * answers). `unknown` covers an MCP tool, a name the results table lacks
   * (one merged into the inputs table alone too), and `Name` left at `string`.
   */
  export type ToolResultOf<Name extends string> = string extends Name ? unknown : Name extends keyof BuiltinToolResults & string ? BuiltinToolResults[Name] | (Name extends 'Agent' ? AgentCallRecord : never) : unknown;

  /**
   * One tool_result block of a user message.
   */
  export type ToolResultSummary = {
      /**
       * The id of the call this result answers (`tool.call`'s `e.tool_use_id`).
       */
      tool_use_id: string;
      /**
       * The result as the model read it (text blocks joined).
       */
      text: string;
      /**
       * True when the tool reported an error.
       */
      isError: boolean;
      /**
       * What the transcript stored for the call: the tool's record on an answered
       * one (`tool.call`'s `result`), the error text when `isError`.
       *
       * Absent when nothing was stored. Headless (`-p`), a tool may store the
       * record less its bulk (Bash blanks `stdout`); `text` is what the model
       * read either way.
       */
      result?: unknown;
  };

  /**
   * What `$.tool.register` takes.
   */
  export type ToolSpec = {
      /**
       * The tool's short name (letters, digits, `_`, `-`; up to 64); the model
       * calls it as `mcp__<plugin>__<name>`.
       */
      name: string;
      /**
       * What the tool does, for the model (and the person where tools are
       * listed); an unpaired surrogate half in it is drawn as U+FFFD.
       */
      description: string;
      /**
       * A JSON schema object for the input (`{ type: "object", properties,
       * required }`); default `{ type: "object" }`.
       */
      inputSchema?: Record<string, unknown>;
  };

  /**
   * One tool_use block of an assistant message, with its outcome once the
   * transcript holds the call's tool_result (paired by `tool_use_id`).
   */
  export type ToolUseSummary = {
      /**
       * The call's id, as `tool.call` carried it (`e.tool_use_id` there).
       */
      tool_use_id: string;
      /**
       * Which one was called (`Read`, `Bash`, `mcp__server__tool`), as
       * `tool.call` named it (`e.tool` there).
       */
      tool: string;
      /**
       * The arguments the model gave it.
       */
      input: Record<string, unknown>;
      /**
       * What the transcript stored for the call: the tool's record on an answered
       * one (`tool.call`'s `result`), the error text on a refused or errored one.
       *
       * Absent while the call is in flight or when nothing was stored. Headless
       * (`-p`), a tool may store the record less its bulk (Bash blanks `stdout`);
       * `text` holds either way.
       */
      result?: unknown;
      /**
       * The result as the model read it; absent while the call is in flight.
       */
      text?: string;
      /**
       * Present only when the tool reported an error, as on `tool.call`'s result.
       */
      isError?: true;
  };

  /**
   * One settled run of a link beneath the caller, as `next.trace` lists it:
   * data, not a handle.
   *
   * `received` and `returned` are the live references where the hook runs
   * beside the chain; in a hooks module its own copies, as `e` is.
   */
  export type TraceEntry<N extends EventName = EventName, E = Args<N>, O = NextResult<N>> = {
      /**
       * The link's place in the chain, 0 the outermost.
       */
      readonly index: number;
      /**
       * The hook's plugin; `"engine"` for the engine's own core or bottom.
       */
      readonly plugin: string;
      /**
       * The link's tier (Tier); `"core"` for the engine's own core or bottom.
       */
      readonly tier: Tier;
      readonly event: N;
      readonly outcome: TraceOutcome;
      /**
       * Why the link was skipped without running, when it was: `bypassed by
       * <plugin>`, whose `next.to` went beneath this tier. Absent when it ran.
       */
      readonly reason?: string;
      /**
       * Its own wall time, its `next()` calls' time in flight taken out.
       *
       * The engine entry's is everything beneath the last hook: in a hooks
       * module, the host round trip.
       */
      readonly ms: number;
      /**
       * How many chunks the link yielded up, on a streaming event; absent on
       * every other. A link left mid-stream counts what it yielded before.
       */
      readonly chunks?: number;
      readonly received: E;
      /**
       * What the link settled on; undefined when it was skipped or rejected.
       */
      readonly returned: O | undefined;
  };

  /**
   * What the chain decided for one link, as `next.trace` names it.
   *
   * `returned`: its result stood; `passed`: it returned, by reference, what its
   * last `next()` resolved to (a hooks module's hook answers with a copy of its
   * own, so it reads `returned`); `skipped`: it failed before `next`, or a
   * `next.to` above continued beneath its tier (`reason` says which), and
   * beneath ran in its place; `kept`: it failed after `next`, and that run's
   * result stands; `expired`: its budget ran out (what stands follows
   * skipped/kept); `caught`: it threw or its budget ran out, and its `.catch`
   * handler's result stands; `rejected`: the link rejected; the deepest such
   * entry is where the rejection came from, and the ones above it let it pass.
   */
  export type TraceOutcome = 'caught' | 'expired' | 'kept' | 'passed' | 'rejected' | 'returned' | 'skipped';

  /**
   * What every `turn.complete` carries whatever its reason: the answer, the
   * duration, the interrupt flag, the turn's id, its loop and what it cost.
   */
  type TurnCompleteFields = {
      /**
       * The assistant's final visible text this turn ("" if none, e.g.
       * thinking-only).
       */
      answer: string;
      /**
       * Wall-clock length of the turn in milliseconds.
       */
      durationMs: number;
      /**
       * True when the turn ended by interruption (`reason === 'aborted'`).
       */
      isAborted: boolean;
      /**
       * The turn's id, the same one its `turn.start` and every `turn.step`
       * carried; a subagent's run raises no `turn.start`, its steps carry it.
       */
      turnId: string;
      /**
       * The loop the turn ran in: a subagent's id, as `$.agent.spawn` resolves
       * it, each run of its loop one turn; absent on the main loop.
       *
       * Pinned: a different value is refused, one left out is kept. Every hook
       * sees a subagent's turn, so a hook that spawns sees its children's turns
       * too and bounds itself.
       */
      agentId?: string;
      /**
       * What the turn cost: its responses' token counts summed and the model of
       * the last, read off the API responses the engine already holds.
       *
       * Absent when the turn got no response (interrupted before one, an API
       * error).
       */
      usage?: TurnUsage;
  };

  /**
   * The input of `turn.complete`: the assistant's final message of a turn, at
   * the moment the turn ends (where the turn's duration is reported).
   *
   * `reason` says why it ended; `refusal` exists on a refusal alone.
   */
  export type TurnCompleteInput = TurnCompleteFields & (TurnCompleteRefused | TurnCompleteUnrefused);

  /**
   * Why a turn ended: the model answered, the user interrupted it, the model
   * refused with no fallback model to retry on, or an API error ended it.
   */
  export type TurnCompleteReason = 'answer' | 'aborted' | 'refusal' | 'error';

  /**
   * The end of a turn the model refused with no fallback model to retry on:
   * what the API said of the refusal rides along.
   */
  type TurnCompleteRefused = {
      reason: 'refusal';
      refusal: TurnRefusal;
  };

  /**
   * What a `turn.complete` hook returns and what `next(e)` resolves to:
   * `{ text }`; a text other than a main-loop answer's is shown beneath it.
   *
   * Core fills `usage` from `e.usage` when the turn had one; a hook above reads
   * it, and one that answers its own may leave it out.
   */
  export type TurnCompleteResult = {
      text: string;
      usage?: TurnUsage;
  };

  /**
   * The end of a turn that was not a refusal: answered, interrupted, or dead
   * on an API error (retries exhausted, the context limit), nothing more.
   */
  type TurnCompleteUnrefused = {
      reason: Exclude<TurnCompleteReason, 'refusal'>;
  };

  /**
   * What the API said about a refusal that ended a turn: the classifier's
   * category and its explanation, each null when the API sent none.
   */
  export type TurnRefusal = {
      category: string | null;
      explanation: string | null;
  };

  /**
   * The input of `turn.start`: the prompt a model turn begins with, after
   * `prompt.submit` settled the text and the UserPromptSubmit settings hooks ran.
   */
  export type TurnStartInput = {
      /**
       * The user's text as the turn proceeds with it ("" for a turn started without
       * a typed prompt, e.g. a continuation).
       */
      text: string;
      /**
       * The turn's id, minted here; the same one every `turn.step` and the
       * `turn.complete` of this turn carry.
       */
      turnId: string;
  };

  /**
   * What a `turn.start` hook returns and what `next(e)` resolves to:
   * `{ turnId }`, echoed by core; a hook's own value does not change the turn.
   */
  export type TurnStartResult = {
      turnId: string;
  };

  /**
   * One piece of a `turn.step` response as it streams through the chain:
   * what a hook's `next(e)` yields and what the hook yields up in turn.
   *
   * Text, thinking, a tool call's start and arguments, and the stop are
   * plain data a hook reads and rewrites; `engine` is the rest, passed on
   * unread. What leaves the outermost hook is what is shown and recorded.
   */
  export type TurnStepChunk = TurnStepTextChunk | TurnStepThinkingChunk | TurnStepToolChunk | TurnStepInputChunk | TurnStepStopChunk | TurnStepEngineChunk;

  /**
   * An item of the engine's stream the other chunk kinds do not model (the
   * envelope, a block's start and end, a retry marker), opaque by `ref`.
   *
   * Pass it on where it came. A hook that yields its own response has none
   * to yield, and the engine supplies what the response needs around the
   * chunks it does yield.
   */
  export type TurnStepEngineChunk = {
      kind: 'engine';
      /**
       * The engine's handle on the item; opaque, this step's only.
       */
      ref: number;
  };

  /**
   * The input of `turn.step`: one model request inside a turn, at the moment
   * the engine is about to send it; the bottom of the chain sends it.
   *
   * The transcript is not on it: `messageCount` says how many messages the
   * request carries, and `$.session.messages()` reads them. A hook rewrites
   * `model` or `effort` going down; the rest is pinned.
   */
  export type TurnStepInput = {
      /**
       * The turn this step belongs to (`turn.start`'s id; inside a subagent's
       * loop, the id the run's `turn.complete` will carry). Pinned.
       */
      turnId: string;
      /**
       * The step's position in the turn, from 0. Pinned.
       */
      index: number;
      /**
       * Which model the request names, as the engine resolved it for this step
       * (the session's, a fallback's). `next({ ...e, model })` names another.
       */
      model: string;
      /**
       * How hard the request asks the model to think: the session's setting or
       * the model's default, absent for a model without effort; rewritable.
       */
      effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | number;
      /**
       * How many messages the request carries (the conversation so far, the
       * turn's tool results included). Pinned: the messages are the engine's.
       */
      messageCount: number;
      /**
       * The loop the request is made in: a subagent's id, the `id`
       * `$.agent.list()` gives it and its `tool.call`s carry; absent on main.
       *
       * Pinned: a different value is refused, one left out is kept. A subagent
       * a hook spawned through `$.agent.spawn` steps past that hook, as its tool
       * calls do; every other hook sees its steps.
       */
      agentId?: string;
  };

  /**
   * A piece of a tool call's arguments as they arrive: JSON text, partial,
   * for the `tool` chunk of the same `index`.
   *
   * The arguments the tool runs with are the pieces concatenated and parsed
   * once the block ends; pieces that do not parse leave the call without
   * arguments it can run on, as a model that wrote broken JSON would.
   */
  export type TurnStepInputChunk = ChunkRef & {
      kind: 'input';
      index: number;
      /**
       * The next piece of the arguments' JSON text.
       */
      json: string;
  };

  /**
   * What a `turn.step` hook returns and what `next(e)` resolves to: the
   * model's response to the step's request, once its blocks are all in.
   *
   * From the bottom, the response the engine streamed; a hook's own value
   * changes what the hooks above it read, never what the engine streamed.
   */
  export type TurnStepResult = {
      /**
       * The turn this step belongs to, as received.
       */
      turnId: string;
      /**
       * The step's position in the turn, as received.
       */
      index: number;
      /**
       * The visible text of the response ("" when it only called tools, only
       * thought, or no request was made).
       */
      answer: string;
      /**
       * The tool calls the response made, in order; empty for a text-only step.
       */
      toolUses: readonly TurnStepToolUse[];
      /**
       * Why the model stopped; null when no response arrived (the request
       * failed or was interrupted before a message, or no request was made).
       */
      stopReason: TurnStopReason;
      /**
       * What the request cost as the API reported it, and the model that
       * answered; null when no response arrived or it carried no usage.
       */
      usage: TurnUsage | null;
  };

  /**
   * The response is whole: why the model stopped and what the request cost,
   * as the step's result will carry them. The last chunk of one response.
   */
  export type TurnStepStopChunk = ChunkRef & {
      kind: 'stop';
      stopReason: TurnStopReason;
      usage: TurnUsage | null;
  };

  /**
   * A piece of the response's visible text as it arrives, in block `index`.
   *
   * The text the person watches stream and the text the transcript records
   * are both the concatenation of these, in order, per block: a hook that
   * rewrites them rewrites both, one that drops them all drops the block.
   */
  export type TurnStepTextChunk = ChunkRef & {
      kind: 'text';
      /**
       * The content block the piece belongs to, from 0 within one response.
       */
      index: number;
      text: string;
  };

  /**
   * A piece of the model's thinking as it arrives, in block `index`: what
   * the person sees of it live.
   *
   * The thinking block the transcript keeps is the one the model signed, as
   * the engine received it; thinking a hook streams without the engine's
   * block behind it is shown and not recorded.
   */
  export type TurnStepThinkingChunk = ChunkRef & {
      kind: 'thinking';
      index: number;
      text: string;
  };

  /**
   * The model begins a tool call in block `index`: the tool's name and the
   * call's id; its arguments follow as `input` chunks of the same index.
   *
   * A block whose `tool` chunk never comes out of the chain is no tool call:
   * the engine records none and runs none.
   */
  export type TurnStepToolChunk = ChunkRef & {
      kind: 'tool';
      index: number;
      /**
       * The call's `tool_use_id`.
       */
      id: string;
      /**
       * The tool's name (`Read`, `Bash`, `mcp__server__tool`).
       */
      name: string;
  };

  /**
   * One tool call the model asked for in a step: the tool's name and its
   * arguments.
   */
  export type TurnStepToolUse = {
      /**
       * The tool's name (`Read`, `Bash`, `mcp__server__tool`).
       */
      name: string;
      /**
       * The arguments the model gave it, as the tool schema shapes them.
       */
      input: unknown;
  };

  /**
   * Why the model stopped, as a `turn.step` result and its stop chunk carry
   * it: one of the API's stop reasons, or null when no response arrived.
   */
  type TurnStopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn' | 'compaction' | 'refusal' | 'model_context_window_exceeded' | null;

  /**
   * What a model turn, or one response inside it, cost as the API reported it:
   * the four token counts (`$.model.fork`'s usage shape) and the model's id.
   *
   * A turn's counts are its responses' summed; its model is the last response's.
   */
  export type TurnUsage = ModelForkUsage & {
      /**
       * Which model answered, by the id the API reports.
       */
      model: string;
  };

  /**
   * What a plugin's `$.ui.blit(args)` takes: a Raster's next `cells`
   * (RasterBlitArgs) or a keyed Image's next `source` (ImageBlitArgs).
   *
   * Either names an element this plugin's own `ui.render` hook drew, still
   * mounted; a hook above may rewrite the cells or the source, never the
   * address or which kind it is.
   */
  export type UiBlitArgs = RasterBlitArgs | ImageBlitArgs;

  /**
   * What `$.ui.blit` resolves to and what a `ui.blit` hook's `{ value }`
   * holds: `{}` once the cells or source are the next frame's, or why not.
   */
  export type UiBlitResult = {
      /**
       * Absent when the cells or source were taken; else why not.
       *
       * Nothing of this plugin's is mounted there (another plugin's reads so),
       * the size is not the mounted one, the cells or source are bad, or the
       * Image draws its `alt` there, the reason spelled out for a fallback.
       */
      deny?: string;
  };

  /**
   * What a plugin's `$.ui.focus(args)` takes: one of its own elements, by the
   * `key` it drew it under, in one of its sites that holds the keyboard now.
   *
   * The engine resolves it to that site's ring and raises `ui.focus` under
   * the plugin's origin; the keyboard is the person's to give, so a site that
   * does not hold it, or holds it on another plugin's element, is `{ deny }`.
   */
  export type UiFocusArgs = {
      /**
       * The site, by the `requestId` this plugin draws it under: one of its
       * panes' ids, or the band's.
       */
      requestId: string;
      /**
       * The element's `key`: a `Button`, `Input` or `Select` this plugin drew in
       * that site; of several under one key, the first in document order.
       */
      key: string;
  };

  /**
   * The render components whose site keeps a focus ring: a pane's body and
   * the band above the prompt, each a ring over the elements hooks drew there.
   */
  export type UiFocusComponent = 'Pane' | 'AbovePrompt';

  /**
   * The input of `ui.focus`: a site's focus ring about to move onto one of the
   * elements a hook drew in it (a `Button`, `Input` or `Select`), or off them.
   *
   * Every key but `element` is the engine's word, pinned: `next(e)` passes
   * them on, a rewrite that leaves one out keeps it, one that changes it fails
   * the hook. `element` is the hook's to rewrite; the ring has not moved yet.
   */
  export type UiFocusInput = {
      /**
       * Which site: a `Pane` body or the `AbovePrompt` band.
       */
      component: UiFocusComponent;
      /**
       * The instance the `ui.render` hook drawing the site sees: the pane's id,
       * or the band's one id.
       */
      requestId: string;
      /**
       * Whose `ui.render` hook drew the element taking the ring; absent with
       * `element`. Read-only.
       */
      plugin?: string;
      /**
       * The `key` of the element taking the ring, as `ui.press` names it; absent
       * for one of the engine's own stops (a pane's close mark or another's tab).
       *
       * `next({ ...e, element })` lands it on another element `plugin` drew in
       * the site instead; one not drawn there is core's `{ deny }`.
       */
      element?: string;
      /**
       * Who moves it (UiFocusOrigin), set by the engine where the move starts.
       */
      origin: UiFocusOrigin;
  };

  /**
   * Who moves the ring at `ui.focus`, as the engine stamps it where the move
   * starts; a closed set a matcher narrows on.
   *
   * `next(e)` passes it on as received; no hook sets one.
   */
  export type UiFocusOrigin = {
      /**
       * The person, by Tab, the arrows or a click while the site holds the
       * keyboard.
       */
      kind: 'person';
  } | {
      /**
       * A plugin's `$.ui.focus`, or its `autoFocus` element taking the ring
       * as the site takes the keyboard.
       */
      kind: 'plugin';
      /**
       * The focusing plugin's name.
       */
      name: string;
  };

  /**
   * What a `ui.focus` hook returns, what `next(e)` resolves to, and what
   * `$.ui.focus` hands back: `{}` once the ring moved, or why it did not.
   *
   * As `ui.scroll` spells it.
   */
  export type UiFocusResult = {
      /**
       * Absent when the ring is where the chain left it; else why nothing
       * moved.
       *
       * A hook kept the ring (no `next`); the site is not this plugin's, does
       * not hold the keyboard, or another plugin's element holds it; no element
       * of `plugin` is drawn under `element`; another move landed first.
       */
      deny?: string;
  };

  /**
   * The argument of `ui.input`: a change of, or a submit from, an `Input` a
   * render hook drew. Flat and frozen like every event's.
   *
   * Another plugin addresses one field by matcher:
   * `on("ui.input", { plugin: "roster", element: "reply" }, ...)`.
   */
  export type UiInputArgument = {
      /**
       * Whose `ui.render` hook drew the element.
       */
      plugin: string;
      /**
       * The `key` the hook gave its `Input`: its address, what a matcher names.
       */
      element: string;
      /**
       * The render component the element was drawn in (`AbovePrompt`,
       * `ToolUse`, ...).
       */
      component: RenderComponent;
      /**
       * The instance the element was drawn in: the `requestId` the `ui.render`
       * hook that drew it saw (a tool row's tool_use_id, a pane's id).
       */
      requestId: string;
      /**
       * Where the typing came from, one literal per member, so
       * `if (e.surface === "terminal")` narrows `e`.
       */
      surface: RenderSurface;
      /**
       * `change` after every edit of the text; `submit` on Enter.
       */
      kind: 'change' | 'submit';
      /**
       * The field's whole text at that moment; a hook above may rewrite it for
       * the plugins beneath and the element's own handler.
       */
      value: string;
  };

  /**
   * What a `ui.input` hook returns and what `next(e)` resolves to.
   *
   * Beneath every hook, core runs the element's `onInput` (kind `change`) or
   * `onSubmit` (kind `submit`) closure in its plugin's environment with the
   * value as the chain left it, and answers `{ element, value }`.
   */
  export type UiInputResult = {
      /**
       * Which handler the input reached, by its Input's `key`.
       */
      element: string;
      /**
       * The text the handler received.
       */
      value: string;
  };

  /**
   * Options of `$.ui.log`.
   */
  export type UiLogOptions = {
      /**
       * Where the line goes (UiLogSink); `transcript` when left out. A hook on
       * `ui.log` reads it as `e.to` and may send the line elsewhere.
       */
      to?: UiLogSink;
  };

  /**
   * Where a `$.ui.log` line goes: `transcript`, a dim row of its own (and the
   * debug log, as every line); `debug`, the debug log alone, nothing on screen.
   *
   * The debug log is `claude --debug` or the `--debug-file`; either way the
   * line is led by the plugin's name.
   */
  export type UiLogSink = 'transcript' | 'debug';

  /**
   * The argument of `ui.message`: what a `Client` instance's surface module
   * posted (`surface.post(data)`), addressed by where the instance is drawn.
   *
   * The origin is `client`: code sent it, on nobody's behalf, so `data` is
   * input to validate, not a fact. Everything but `data` is the engine's word
   * and a hook may not rewrite it.
   */
  export type UiMessageArgument = {
      /**
       * Where the instance is drawn: `terminal`, or `desktop` once it has them.
       */
      surface: RenderSurface;
      /**
       * The render component the `Client` was drawn in (`AbovePrompt`, `Pane`,
       * ...).
       */
      component: RenderComponent;
      /**
       * The engine's id for the drawing the `Client` sits in: the `requestId` the
       * `ui.render` hook that drew it saw.
       */
      requestId: string;
      /**
       * The `Client`'s `key`: which instance posted.
       */
      element: string;
      /**
       * The `Client`'s `module`: which surface module runs there, as its path
       * under the plugin's folder.
       */
      module: string;
      /**
       * What the instance posted: plain data (JsonValue), bounded as a tree's
       * text is; typed `unknown` since it came from code. Rewritable.
       */
      data: unknown;
  };

  /**
   * What a `ui.message` hook returns and what `next(e)` resolves to.
   *
   * Core answers `{}`: the message was heard and nothing changes. A hook that
   * answers `{ props }` hands the posting instance its next props directly, its
   * local state kept, with no `ui.render` run; the plugin's next redraw hands
   * props again as usual.
   */
  export type UiMessageResult = {
      /**
       * The instance's next props, plain data (JsonValue) bounded as a `Client`'s
       * props are; absent leaves the instance's props as they were.
       */
      props?: unknown;
  };

  /**
   * One of this plugin's open panes as `$.ui.panes()` lists it: the pane's
   * id and title, and where it stands with the person right now.
   *
   * Where a surface seated it (`dock` or `inline`) is that surface's to say, on
   * the `Pane` render props (`placement`); a session may draw on several.
   */
  export type UiPane = {
      /**
       * What `$.ui.open({ id })` named it, which `$.ui.close` and its
       * `ui.render` `requestId` name too.
       */
      id: string;
      /**
       * Its tab's label: the `title` of its latest open, or the id.
       */
      title: string;
      /**
       * True for the one pane the surface shows; the rest are tabs behind it.
       */
      isShown: boolean;
      /**
       * True while the person has given it the keyboard.
       */
      isFocused: boolean;
      /**
       * False while it waits undrawn: opened unasked on a terminal too narrow
       * for an unrequested pane, until an open the width or the person admits.
       */
      isPlaced: boolean;
  };

  /**
   * The argument of `ui.press`: a press on a `Button` a render hook drew, or
   * on an answered `Markdown` link. Flat and frozen like every event's.
   *
   * Another plugin addresses one button by matcher:
   * `on("ui.press", { plugin: "explainer", element: "explain" }, ...)`.
   */
  export type UiPressArgument = {
      /**
       * Whose `ui.render` hook drew the element.
       */
      plugin: string;
      /**
       * The `key` the hook gave its `Button` or `Markdown`: its address, what a
       * matcher names.
       */
      element: string;
      /**
       * The render component the element was drawn in (`ToolUse`,
       * `AssistantMessage`, ...).
       */
      component: RenderComponent;
      /**
       * The instance the element was drawn in: the `requestId` the `ui.render`
       * hook that drew it saw (a tool row's tool_use_id, a pane's id).
       */
      requestId: string;
      /**
       * Where the press came from, one literal per member, so
       * `if (e.surface === "terminal")` narrows `e`.
       */
      surface: RenderSurface;
      /**
       * Where the press landed, when the element is a `Markdown` whose links
       * its plugin answers (`onLinkPress`); absent for a `Button`.
       *
       * A hook may rewrite its `href` for the hooks and the closure beneath; one
       * that adds or drops it fails, and the press goes on beneath it.
       */
      link?: PressedLink;
  };

  /**
   * What a `ui.press` hook returns and what `next(e)` resolves to.
   *
   * Beneath every hook, core runs the element's `onPress` closure in its
   * plugin's environment with `e` as the chain left it, and answers
   * `{ element }`.
   */
  export type UiPressResult = {
      /**
       * Which handler the press reached, by its Button's `key`.
       */
      element: string;
  };

  /**
   * What a plugin's `$.ui.scroll(args)` takes: what to bring into view, in
   * which of its sites, and where in the window it lands.
   *
   * The engine resolves it to a window and an offset and raises `ui.scroll`
   * under the plugin's origin; a transcript row is the person's to move, so
   * it is revealed only while the plugin answers the person's own input.
   */
  export type UiScrollArgs = {
      /**
       * What to reveal (UiScrollTarget): a render instance by `requestId`, one
       * of this plugin's elements by `key`, or the `start` or `end` of `in`.
       */
      to: UiScrollTarget;
      /**
       * The site to scroll, by the `requestId` this plugin draws it under: one
       * of its panes' ids, or the band's.
       *
       * Required with `start` and `end`; with `{ key }` it picks the site when
       * the key is drawn in several.
       */
      in?: string;
      /**
       * Where the target lands in the window (UiScrollBlock); `nearest` when
       * left out, so a row already showing does not move.
       */
      block?: UiScrollBlock;
  };

  /**
   * Where in its scrollable a revealed row lands, as the DOM's
   * `scrollIntoView({ block })` names it.
   *
   * `nearest` moves the least that shows the row whole, and not at all when
   * it already shows; `start`, `center` and `end` put its top, middle or
   * bottom at that edge of the window. A row taller than the window shows
   * its top.
   */
  export type UiScrollBlock = 'start' | 'center' | 'end' | 'nearest';

  /**
   * The render components whose site the engine scrolls: a pane's body and
   * the band above the prompt, each a window over the tree a hook drew there.
   */
  export type UiScrollComponent = 'Pane' | 'AbovePrompt';

  /**
   * The input of `ui.scroll`: a site's window asked to move over the tree a
   * hook drew in it (a pane's body, the band above the prompt).
   *
   * Every key but `offset` is the engine's word, pinned: `next(e)` passes
   * them on, a rewrite that leaves one out keeps it, one that changes or adds
   * one fails the hook. `offset` is the hook's to rewrite; nothing moved yet.
   */
  export type UiScrollInput = {
      /**
       * Which site: a `Pane` body or the `AbovePrompt` band.
       */
      component: UiScrollComponent;
      /**
       * The instance the `ui.render` hook drawing the site sees: the pane's id,
       * or the band's one id.
       */
      requestId: string;
      /**
       * The first row the window is to show, 0 at the top: the row it shows
       * now plus `by`, clamped to the tree, or where `$.ui.scroll` resolved.
       *
       * `next({ ...e, offset })` moves it elsewhere (a clamp); one past the
       * tree's end lands at the end. Nothing has moved when a hook reads it.
       */
      offset: number;
      /**
       * The rows the move asks for, signed, negative toward the top; what the
       * DOM's `scrollBy` takes. Read-only.
       *
       * The person's: a wheel tick `-1` or `1` at rest, more as ticks crowd or
       * summed in flight; an arrow a row while the engine has rows to scroll, a
       * page key `bodyRows`, Home and End `contentRows`. A plugin's: its distance.
       */
      by: number;
      /**
       * How many rows of the tree the window shows at once, as drawn now.
       * Read-only.
       */
      bodyRows: number;
      /**
       * How many rows the tree has, as drawn now: the window's last offset is
       * `contentRows - bodyRows`, none when the tree fits. Read-only.
       */
      contentRows: number;
      /**
       * Who moves it (UiScrollOrigin), set by the engine where the move starts.
       */
      origin: UiScrollOrigin;
      /**
       * The body cell the person's wheel or trackpad was over (UiScrollPointer);
       * absent for the scroll keys and for `$.ui.scroll`. Read-only.
       *
       * Moves summed while a dispatch was in flight carry the latest one's. A
       * hook pinning a list over rows it scrolls itself tells a tick over the
       * list (`row` among its list's rows) from one over the body.
       */
      pointer?: UiScrollPointer;
  };

  /**
   * Who moves the window at `ui.scroll`, as the engine stamps it where the
   * move starts; a closed set a matcher narrows on.
   *
   * `next(e)` passes it on as received; no hook sets one.
   */
  export type UiScrollOrigin = {
      /**
       * The person, by the wheel over the site or its scroll keys while
       * they hold it.
       */
      kind: 'person';
  } | {
      /**
       * A plugin's `$.ui.scroll`.
       */
      kind: 'plugin';
      /**
       * The scrolling plugin's name.
       */
      name: string;
  };

  /**
   * The cell the pointer was over when the person's wheel raised `ui.scroll`,
   * in the site's body: the box its `ui.render` hook draws into, as painted.
   *
   * The DOM's `clientY - body.top` in cells, the window's offset not added: a
   * hook drawing its own window reads `row` as its tree's row, one the engine
   * scrolls adds the `scroll.offset` it drew with. The frame lies outside.
   */
  export type UiScrollPointer = {
      /**
       * 0 at the body's left edge, as `bodyColumns` counts them; negative, or
       * `bodyColumns` and past, over an inline pane's side borders.
       */
      column: number;
      /**
       * 0 at the body's first showing row, as `bodyRows` counts them.
       *
       * The tree's row is `scroll.offset + row` under the engine's window, and
       * `row` itself under a hook's own (offset 0); negative over a pane's top
       * border or tab row, `bodyRows` or more over its bottom border.
       */
      row: number;
  };

  /**
   * What a `ui.scroll` hook returns, what `next(e)` resolves to, and what
   * `$.ui.scroll` hands back: `{}` once the window moved, or why it did not.
   */
  export type UiScrollResult = {
      /**
       * Absent when the window is where the chain left it; else why nothing
       * moved, as `tool.call` and `config.set` spell a refusal.
       *
       * A hook kept the window (no `next`); the target is not this plugin's;
       * another move landed first (`the window moved meanwhile`); a transcript
       * row is not the person's ask (`not person-initiated`) or none scrolls.
       */
      deny?: string;
  };

  /**
   * What `$.ui.scroll` brings into view: never a row number, always a thing
   * drawn somewhere.
   *
   * `{ requestId }` names a render instance by the id its `ui.render` hook
   * saw (a transcript message's, a tool row's tool_use_id), scrolled into view
   * inside whatever scrolls it. `{ key }` names an element this plugin drew
   * with that `key`, inside the site it drew it in. `start` and `end` are the
   * top and bottom of the site `in` names; `end` keeps up with a tree that
   * grows (rows the plugin just added count) until anything next moves it.
   */
  export type UiScrollTarget = {
      requestId: string;
  } | {
      key: string;
  } | 'start' | 'end';

  /**
   * The argument of `ui.select`: a pick from a `Select` a render hook drew.
   * Flat and frozen like every event's.
   *
   * Another plugin addresses one picker by matcher:
   * `on("ui.select", { plugin: "roster", element: "peer" }, ...)`.
   */
  export type UiSelectArgument = {
      /**
       * Whose `ui.render` hook drew the element.
       */
      plugin: string;
      /**
       * The `key` the hook gave its `Select`: its address, what a matcher names.
       */
      element: string;
      /**
       * The render component the element was drawn in (`AbovePrompt`,
       * `ToolUse`, ...).
       */
      component: RenderComponent;
      /**
       * The instance the element was drawn in: the `requestId` the `ui.render`
       * hook that drew it saw (a tool row's tool_use_id, a pane's id).
       */
      requestId: string;
      /**
       * Where the pick came from, one literal per member, so
       * `if (e.surface === "terminal")` narrows `e`.
       */
      surface: RenderSurface;
      /**
       * The picked option's value; a hook above may rewrite it for the plugins
       * beneath and the element's own handler.
       */
      value: string;
  };

  /**
   * What a `ui.select` hook returns and what `next(e)` resolves to.
   *
   * Beneath every hook, core runs the element's `onSelect` closure in its
   * plugin's environment with the value as the chain left it, and answers
   * `{ element, value }`.
   */
  export type UiSelectResult = {
      /**
       * Which handler the pick reached, by its Select's `key`.
       */
      element: string;
      /**
       * What the handler received: the option's value as the chain left it.
       */
      value: string;
  };

  /**
   * The intersection of a union's members (`A | B` to `A & B`), by inferring
   * one parameter type from the contravariant positions.
   */
  type UnionToIntersection<U> = (U extends unknown ? (member: U) => void : never) extends (member: infer I) => void ? I : never;

  /**
   * One unit of what `$.session.usage()` answers, by its key there: the
   * context window's fill, the rate-limit windows, the session's cost.
   */
  export type UsageUnit = 'context' | 'rateLimits' | 'cost';

  /**
   * Who sent the message a `UserMessage` row carries, when someone other than
   * the person did: another agent, a teammate, another session, a channel.
   *
   * Read-only. The sender's words are not the person's: the model reads them
   * framed as that sender's whatever a hook draws for the row.
   */
  type UserMessageFrom = {
      /**
       * The sender's name as the row shows it: a subagent's name, else its type;
       * a teammate's; another session's title; a channel's sender, else server.
       *
       * One printable line: control and format characters stripped, whitespace
       * collapsed, length bounded. Absent (no `from`) for a teammate block whose
       * frames name different senders or none.
       */
      name: string;
  };

  /**
   * The background task a `UserMessage` notification row reports on: a
   * subagent, a background shell, a workflow, a remote agent, a monitor.
   *
   * Every field is the notification's own, so the row names the same task on
   * every draw, a resumed session's included; the session's record of it
   * (name, type, description) is `$.agent.list()`'s, by `id`. Each string is
   * one printable line, bounded (a forged envelope's bytes capped). Read-only.
   */
  type UserMessageTask = {
      /**
       * The task's id as the notification names it; for a subagent, the
       * `agentId` its `turn.complete` carried and `$.agent.list()` keys.
       */
      id?: string;
      /**
       * How the task ended: `completed`, `failed` or `killed` (stopped, by the
       * person or by Claude), or another word its producer wrote.
       */
      status?: string;
      /**
       * What kind of task, when the notification says (`remote_agent`, an
       * artifact watch's kind); a subagent's and a shell's leave it out.
       */
      type?: string;
      /**
       * Which call started the task: its `tool_use_id`, when the notification
       * carries it.
       */
      toolUseId?: string;
      /**
       * How long the task ran, in milliseconds, when the notification says; the
       * row draws it after the summary (`2m 2s`).
       */
      durationMs?: number;
  };

  type UserPromptExpansionHookInput = BaseHookInput & {
      hook_event_name: 'UserPromptExpansion';
      expansion_type: 'slash_command' | 'mcp_prompt';
      command_name: string;
      command_args: string;
      command_source?: string;
      prompt: string;
  };

  type UserPromptSubmitHookInput = BaseHookInput & {
      hook_event_name: 'UserPromptSubmit';
      prompt: string;
      /**
       * Who authored/injected the prompt: `user` = submitted from the interactive composer, `sdk` = non-interactive entrypoint (`-p` / Agent SDK), `loop_wakeup` = dynamic /loop wakeup, `schedule_wakeup` = scheduled-task fire (CronCreate/routine), `system` = other machine-injected turns (peer/channel messages, task notifications, auto-continuation), `poll_event` = the poll-event channel enqueue-time pass (the hook fires when the host submits an event, before its delivery ack exists - a blocking verdict rejects the event). Payloads may omit it while the field rolls out.
       */
      source?: 'user' | 'sdk' | 'system' | 'loop_wakeup' | 'schedule_wakeup' | 'poll_event';
      session_title?: string;
  };

  /**
   * The result of a call on `$` as the hooks on its event see it: `{ value }`,
   * the call's answer, or `{ deny }`, the reason the caller's promise rejects.
   */
  type ValueOrDeny<Value> = {
      value: Value;
      deny?: undefined;
  } | {
      deny: string;
      value?: undefined;
  };

  type WorktreeCreateHookInput = BaseHookInput & {
      hook_event_name: 'WorktreeCreate';
      name: string;
  };

  type WorktreeRemoveHookInput = BaseHookInput & {
      hook_event_name: 'WorktreeRemove';
      worktree_path: string;
  };

  /**
   * The globals of a hooks module's environment: these and no others (no DOM,
   * no Node). No code generation either: `eval` and `new Function` over a
   * string throw, and there is no `WebAssembly` (deliberately; a module that
   * needs compiled code runs it in a process of its own through `$.process.run`).
   * A surface module's environment (Client) has the same globals and a
   * `console`; neither has timers (a hooks module waits on `$.clock`, a
   * surface module on `surface.every`).
   */
  global {
    /**
     * The JSX factory (classic runtime, `@jsx h`; the engine prepends the
     * pragma): a plain-data element from a string tag or a component.
     *
     * JSX compiles to bare `h(...)` calls resolved by name, so a module (hooks or
     * surface) never declares, imports or takes as a parameter anything named
     * `h` or `Fragment` where it writes JSX, and carries no `@jsx` pragma of its
     * own: either silently points its JSX away from this factory, and a
     * `<Client>` tag written under another factory is not found when the
     * module's surface modules are read off its source.
     */
    const h: (
      tag: string | ((props: never) => RenderNode | null | undefined),
      props: Record<string, unknown> | null | undefined,
      ...children: unknown[]
    ) => RenderNode | null | undefined

    /**
     * `<>...</>`: a column Box around the children.
     */
    const Fragment: (props: { children?: RenderNode[] }) => RenderElement

    /**
     * JSX over the element table: every tag is a constructor from
     * `$.ui.resolve(e)` (`const { Box, Text } = $.ui.resolve(e)`), typed by
     * its props; there are no intrinsic (string) tags.
     */
    namespace JSX {
      type Element = RenderElement
      type Children = RenderChildren
      type ElementType = (props: never) => RenderNode | null | undefined
      interface IntrinsicElements {}
      interface ElementChildrenAttribute {
        children: unknown
      }
      interface IntrinsicAttributes {
        key?: string
      }
    }

    interface AbortSignal {
      readonly aborted: boolean
      readonly reason: unknown
      throwIfAborted(): void
      addEventListener(
        type: 'abort',
        listener: () => void,
        options?: { once?: boolean },
      ): void
      removeEventListener(type: 'abort', listener: () => void): void
    }
    var AbortSignal: {
      prototype: AbortSignal
      abort(reason?: unknown): AbortSignal
      timeout(milliseconds: number): AbortSignal
      any(signals: AbortSignal[]): AbortSignal
    }
    interface AbortController {
      readonly signal: AbortSignal
      abort(reason?: unknown): void
    }
    var AbortController: {
      prototype: AbortController
      new (): AbortController
    }
    interface TextEncoder {
      readonly encoding: string
      encode(input?: string): Uint8Array
    }
    var TextEncoder: { prototype: TextEncoder; new (): TextEncoder }
    interface TextDecoder {
      readonly encoding: string
      decode(input?: ArrayBufferView | ArrayBuffer): string
    }
    var TextDecoder: { prototype: TextDecoder; new (label?: string): TextDecoder }
    interface URLSearchParams {
      append(name: string, value: string): void
      delete(name: string): void
      get(name: string): string | null
      getAll(name: string): string[]
      has(name: string): boolean
      set(name: string, value: string): void
      toString(): string
      forEach(callback: (value: string, key: string) => void): void
    }
    var URLSearchParams: {
      prototype: URLSearchParams
      new (init?: string | Record<string, string> | string[][]): URLSearchParams
    }
    interface URL {
      hash: string
      host: string
      hostname: string
      href: string
      readonly origin: string
      password: string
      pathname: string
      port: string
      protocol: string
      search: string
      readonly searchParams: URLSearchParams
      username: string
      toString(): string
      toJSON(): string
    }
    var URL: {
      prototype: URL
      new (url: string, base?: string | URL): URL
      canParse(url: string, base?: string): boolean
    }
    function atob(data: string): string
    function btoa(data: string): string
    function structuredClone<T>(value: T): T
    var crypto: {
      readonly subtle: {
        digest(
          algorithm: string | { name: string },
          data: ArrayBufferView | ArrayBuffer,
        ): Promise<ArrayBuffer>
      }
      randomUUID(): string
      getRandomValues<T extends ArrayBufferView>(array: T): T
    }
    var performance: { now(): number }
  }
}

declare module 'claude-code/testing' {
  import type { Args } from 'claude-code';
  import type { Chunk } from 'claude-code';
  import type { ClientKeyEvent } from 'claude-code';
  import type { ClientPointerEvent } from 'claude-code';
  import type { Elements } from 'claude-code';
  import type { EventCalls } from 'claude-code';
  import type { EventName } from 'claude-code';
  import type { HookStream } from 'claude-code';
  import type { JsonValue } from 'claude-code';
  import type { On } from 'claude-code';
  import type { PressedLink } from 'claude-code';
  import type { Register } from 'claude-code';
  import type { RenderComponent } from 'claude-code';
  import type { RenderElement } from 'claude-code';
  import type { RenderPropsOf } from 'claude-code';
  import type { RenderSurface } from 'claude-code';
  import type { RenderViewport } from 'claude-code';
  import type { ResultOf } from 'claude-code';
  import type { StreamingEventName } from 'claude-code';
  import type { Tier } from 'claude-code';
  import type { UiInputArgument } from 'claude-code';
  import type { UiInputResult } from 'claude-code';
  import type { UiPressResult } from 'claude-code';
  import type { UiSelectResult } from 'claude-code';

  /**
   * A value that matches by a rule inside `toEqual` and its kin
   * (`expect.any`, `expect.objectContaining`), known by its text in a failure.
   */
  export type AsymmetricMatcher = {
      readonly text: string;
  };

  /**
   * The same checks on what a promise received settles with, each resolving
   * once the promise has settled and the check passed.
   */
  export type AsyncMatchers = {
      [K in keyof Matchers]: (...args: Parameters<Matchers[K]>) => Promise<void>;
  };

  /**
   * Which `Client` of a mounted drawing an act or a read means, by the `key`
   * its element carries; optional while the drawing holds exactly one.
   */
  export type ClientScope = {
      in?: string;
  };

  /**
   * A class, as `toThrow`, `toBeInstanceOf` and `expect.any` take it.
   */
  export type Constructor = abstract new (...args: never[]) => unknown;

  /**
   * A group of tests: its name leads the title of each test declared inside,
   * and its body runs at once, while the file loads.
   *
   * @param name the group's name
   * @param body declares the group's tests
   */
  export const describe: (name: string, body: () => void) => void;

  /**
   * The element each surface-dependent act of a mounted drawing reaches: a
   * handle carries the act only where the surface's table has the element.
   *
   * `input` needs `Input` and `select` needs `Select` (every surface but
   * mobile today); `key`, `pointer`, `post`, `advance` and `resize` reach a
   * `Client` (terminal and desktop today). The rest need nothing but a tree.
   */
  export type ElementOfAct = {
      input: 'Input';
      select: 'Select';
      key: 'Client';
      pointer: 'Client';
      post: 'Client';
      advance: 'Client';
      resize: 'Client';
  };

  /**
   * What a mounted drawing's `find` and `findAll` match an element on, every
   * field given at once: its tag, its `key`, and the text it shows.
   *
   * `text` matches the element's whole shown text (string children, a Button
   * or Link's label, a Markdown's text, a Code's source, an Input's value):
   * a string by inclusion, a RegExp by test.
   *
   * @example
   * await ui.findAll({ type: 'Text', text: /overdue/, in: 'board' })
   */
  export type ElementQuery = {
      type?: string;
      key?: string;
      text?: string | RegExp;
      /**
       * Searches what this `Client`'s surface module drew (by the `Client`'s
       * key) instead of the plugin's own tree.
       */
      in?: string;
  };

  /**
   * What a test holds as `$`, the engine's own: every call on it is made as
   * the REPL, the query loop and the render sites make theirs, over every plugin.
   *
   * `next.origin` is the engine, and the whole chain runs over the plugins
   * loaded. A tool call's `tool_use_id` is minted when left out; `$.ui.mount`
   * is a surface the test names drawing an instance, `$.ui.press` a press on it.
   */
  export type Engine = {
      [N in keyof EventCalls]: N extends 'ui' ? EngineNoun<N> & EnginePress & EngineMount : EngineNoun<N>;
  };

  /**
   * One call on the engine's `$`: the event's input whole, as an engine call
   * site passes it, to its result, or for a streaming event to its stream.
   */
  export type EngineCall<E extends EventName> = E extends StreamingEventName ? (e: Args<E>) => HookStream<Chunk<E>, ResultOf[E]> : (e: Args<E>) => Promise<ResultOf[E]>;

  /**
   * A surface drawing a component instance through the plugins, then driven
   * by key through a handle typed by that surface (Mounted).
   *
   * `ui.render` raised there for those props, the tree validated by that
   * table, its `Client`s running; the reads and `press` on every surface,
   * `input` where the table has `Input`, the `Client` acts where `Client`.
   *
   * @example
   * for (const surface of SURFACES) run(await $.ui.mount({ ...HINT, surface }))
   */
  export type EngineMount = {
      /**
       * Raises the plugins' drawing of the component on the surface and holds
       * it, as that surface showing the instance does.
       *
       * Resolves once the tree validated and every `Client` in it drew once.
       *
       * @param target whose elements, the surface, the component, its props,
       *   the instance's requestId, and what the surface measured
       * @returns the mounted drawing; rejects when no `surface` (or an unknown
       *   one) is named, when the surface cannot draw the tree the chain
       *   returned (with the reason: an element its table lacks, a prop not
       *   allowed), or when a `Client`'s module failed or drew nothing
       */
      mount: <P extends RenderSurface, C extends RenderComponent>(target: MountTarget<P, C>) => Promise<Mounted<P, C>>;
  };

  /**
   * One noun of the engine's `$`: each of its events as the engine calls it,
   * `tool.call` and `ui.render` typed per tool and component, `ui.resolve` out.
   */
  export type EngineNoun<N extends keyof EventCalls> = {
      [V in EngineNounEvent<N>]: `${N}.${V}` extends 'tool.call' | 'ui.render' ? EventCalls[N][V] : EngineCall<`${N}.${V}` & EventName>;
  };

  /**
   * The events of one noun a test's `$` carries: every one but `ui.resolve`,
   * which a render hook calls on its own `$` and the engine never raises.
   */
  export type EngineNounEvent<N extends keyof EventCalls> = Exclude<keyof EventCalls[N] & string, `${N}.resolve` extends 'ui.resolve' ? 'resolve' : never>;

  /**
   * A surface pressing a Button a test rendered, or a Markdown's link: the
   * `ui.press` chain over every plugin hooked on it, its own closure last.
   */
  export type EnginePress = {
      /**
       * Presses the Button, as a click or its hotkey does; with `link`, the
       * Markdown's link, as a click on it does.
       *
       * `e.surface` is the surface of the drawing that holds it.
       *
       * @param target whose element, its key, the instance and surface when
       *   several hold it, and for a Markdown the link
       * @returns what the chain settled on; rejects when no such element is
       *   drawn, or several are and neither instance nor surface tells them apart
       */
      press: (target: PressTarget) => Promise<UiPressResult | undefined>;
  };

  /**
   * The checks on a value (`expect(received)`), and with them the matchers
   * that stand inside an expected value (`expect.any(Number)`).
   */
  export type Expect = Expecting & Matching;

  /**
   * Checks a value: `expect(received).toEqual(expected)` throws an
   * AssertionError naming both sides when it fails, a message given leading.
   *
   * `.not` negates; `.resolves` and `.rejects` check what a promise settles
   * with; `expect.any(Number)` and its kin stand inside an expected value.
   */
  export const expect: Expect;

  /**
   * What `expect(received)` answers: the checks, their negation, and the
   * checks on what a promise received resolves or rejects with.
   */
  export type Expectation = Negatable<Matchers> & {
      /**
       * The checks on what the promise received resolves with; a rejection
       * fails them.
       */
      resolves: Negatable<AsyncMatchers>;
      /**
       * The checks on what the promise received rejects with; a resolution
       * fails them.
       */
      rejects: Negatable<AsyncMatchers>;
  };

  /**
   * `expect(received, message?)`: the checks on a value, a message of the
   * test's own leading a failure's.
   */
  export type Expecting = (received: unknown, message?: string) => Expectation;

  /**
   * One element of a mounted drawing as `find` returns it: the description
   * the plugin's hook (or a `Client`'s module) built, read as plain data.
   *
   * What every surface is handed to draw, not what any surface painted: the
   * same on the terminal, the desktop, VS Code and mobile.
   */
  export type FoundElement = {
      /**
       * The element's tag: `Box`, `Text`, `Button`, `Input`, `Client`, ...
       */
      type: string;
      /**
       * What its props carry as `key`, when they do.
       */
      key: string | undefined;
      /**
       * Its props, plain data: a Button's `label`, a Text's `color`, ...;
       * handlers never cross (a Button's `onPress` is not here).
       */
      props: Record<string, unknown>;
      /**
       * What it shows: its string children in document order and, for the
       * leaves that draw a prop as text, that prop (ElementQuery `text`).
       */
      text: string;
      /**
       * Its children as drawn: strings and element descriptions.
       */
      children: unknown[];
  };

  /**
   * The checks `expect(received)` offers; each throws an AssertionError when
   * it fails, naming what was expected and what was received.
   */
  export type Matchers = {
      /**
       * Passes when received is the value, by `Object.is`.
       *
       * @param expected the value
       */
      toBe: (expected: unknown) => void;
      /**
       * Passes when received equals the value in structure, properties holding
       * undefined ignored; `expect.any` and its kin match inside it.
       *
       * @param expected the value
       */
      toEqual: (expected: unknown) => void;
      /**
       * As `toEqual`, but undefined properties and prototypes count.
       *
       * @param expected the value
       */
      toStrictEqual: (expected: unknown) => void;
      /**
       * Passes when received holds at least the object's properties, equal.
       *
       * @param expected the object
       */
      toMatchObject: (expected: object) => void;
      /**
       * Passes when a string received includes the item, or an iterable
       * received has an element that is it.
       *
       * @param item the substring or element
       */
      toContain: (item: unknown) => void;
      /**
       * Passes when an iterable received has an element equal to the item.
       *
       * @param item the element
       */
      toContainEqual: (item: unknown) => void;
      /**
       * Passes when received's `length` is the number.
       *
       * @param length the number
       */
      toHaveLength: (length: number) => void;
      /**
       * Passes when received holds a property at the path (`a.b`, or the keys
       * in order), equal to the value when one is given.
       *
       * @param path the property's path
       * @param value what it must equal, when given
       */
      toHaveProperty: (path: string | readonly string[], value?: unknown) => void;
      /**
       * Passes when received is undefined.
       */
      toBeUndefined: () => void;
      /**
       * Passes when received is anything but undefined.
       */
      toBeDefined: () => void;
      /**
       * Passes when received is null.
       */
      toBeNull: () => void;
      /**
       * Passes when received is truthy.
       */
      toBeTruthy: () => void;
      /**
       * Passes when received is falsy.
       */
      toBeFalsy: () => void;
      /**
       * Passes when received is NaN.
       */
      toBeNaN: () => void;
      /**
       * Passes when received is greater than the bound.
       *
       * @param bound the bound
       */
      toBeGreaterThan: (bound: number | bigint) => void;
      /**
       * Passes when received is the bound or greater.
       *
       * @param bound the bound
       */
      toBeGreaterThanOrEqual: (bound: number | bigint) => void;
      /**
       * Passes when received is less than the bound.
       *
       * @param bound the bound
       */
      toBeLessThan: (bound: number | bigint) => void;
      /**
       * Passes when received is the bound or less.
       *
       * @param bound the bound
       */
      toBeLessThanOrEqual: (bound: number | bigint) => void;
      /**
       * Passes when a string received includes the text, or the pattern matches
       * it.
       *
       * @param pattern the text or pattern
       */
      toMatch: (pattern: string | RegExp) => void;
      /**
       * Passes when a string received starts with the prefix.
       *
       * @param prefix the prefix
       */
      toStartWith: (prefix: string) => void;
      /**
       * Passes when a string received ends with the suffix.
       *
       * @param suffix the suffix
       */
      toEndWith: (suffix: string) => void;
      /**
       * Passes when received is an instance of the class.
       *
       * @param expected the class
       */
      toBeInstanceOf: (expected: Constructor) => void;
      /**
       * Passes when calling received throws (or, under `rejects`, the rejection
       * is) an error as described: by substring, pattern, class or message.
       *
       * @param expected the description; any throw passes without one
       */
      toThrow: (expected?: ThrowExpectation) => void;
  };

  /**
   * The matchers that stand inside an expected value, each matching received
   * there by a rule instead of by equality.
   */
  export type Matching = {
      /**
       * Matches any instance of the class, a primitive by its wrapper
       * (`expect.any(Number)`).
       *
       * @param expected the class
       * @returns the matcher
       */
      any: (expected: Constructor) => AsymmetricMatcher;
      /**
       * Matches anything but null and undefined.
       *
       * @returns the matcher
       */
      anything: () => AsymmetricMatcher;
      /**
       * Matches a string that includes the text.
       *
       * @param text the substring
       * @returns the matcher
       */
      stringContaining: (text: string) => AsymmetricMatcher;
      /**
       * Matches a string the pattern matches.
       *
       * @param pattern the pattern, or the source of one
       * @returns the matcher
       */
      stringMatching: (pattern: string | RegExp) => AsymmetricMatcher;
      /**
       * Matches an object holding at least the shape's properties, equal.
       *
       * @param shape the properties
       * @returns the matcher
       */
      objectContaining: (shape: object) => AsymmetricMatcher;
      /**
       * Matches an array holding an element equal to each of the items.
       *
       * @param items the elements
       * @returns the matcher
       */
      arrayContaining: (items: readonly unknown[]) => AsymmetricMatcher;
  };

  /**
   * The world beneath the plugins, mocked noun by noun: each member registers
   * hooks of the test's on `on`, visible where the test calls it.
   */
  export type Mock = {
      /**
       * Answers `$.clock` from a clock in memory that moves only when the test
       * moves it: `clock.now` reads it, and each wait is held.
       *
       * A held wait resolves when an advance crosses the time it is due, and is
       * dropped when its dispatch aborts; one held past a hook's budget (ten
       * seconds of real time) is let go, as a hook that overran.
       *
       * @param on the test's `on`
       * @param options where the clock starts (`now`, 0 when not given)
       * @returns the clock: its time, and the calls that move it
       */
      clock: (on: On, options?: MockClockOptions) => MockClock;
      /**
       * Answers `$.store` from a store in memory: `get`, `set`, `delete` and
       * `keys` over it, as the engine keeps a plugin's own.
       *
       * @param on the test's `on`
       * @param entries what the store holds at the start (nothing when not given)
       */
      store: (on: On, entries?: Readonly<Record<string, unknown>>) => void;
      /**
       * Answers `$.env.get` from a set of variables; one not listed is unset.
       *
       * @param on the test's `on`
       * @param variables the environment the plugins read
       */
      env: (on: On, variables: Readonly<Record<string, string>>) => void;
  };

  /**
   * The world beneath the plugins, mocked noun by noun: `mock.clock`,
   * `mock.store` and `mock.env`.
   *
   * Each registers hooks of the test's on the `on` it is handed, visible where
   * the test calls it, and answers its noun from memory.
   */
  export const mock: Mock;

  /**
   * The clock `mock.clock` hands back: the time its hooks answer, and the only
   * ways it moves.
   */
  export type MockClock = {
      /**
       * The time now, in milliseconds: what `$.clock.now()` resolves beneath the
       * plugins.
       *
       * @returns the time
       */
      now: () => number;
      /**
       * Moves the clock on, resolving each wait due on the way (`$.clock.sleep`,
       * `after`, `every`, this clock's `sleep`) in the order it comes due.
       *
       * The clock reads each wait's time as it resolves, and what one started
       * runs before the next resolves.
       *
       * @param ms how far to move, in milliseconds
       * @returns resolves once the clock is there and the event loop settled
       */
      advance: (ms: number) => Promise<void>;
      /**
       * Moves the clock to a time at or past now, as `advance` would.
       *
       * @param ms the time, in milliseconds
       * @returns resolves once the clock is there and the event loop settled
       */
      set: (ms: number) => Promise<void>;
      /**
       * Lets what is already under way run as far as it can without the clock
       * moving: every wait due now resolves and the event loop settles.
       *
       * The same as `advance(0)`; the name for the step between starting a
       * dispatch unawaited and looking at what it did.
       *
       * @returns resolves once the event loop settled, the time where it was
       */
      settle: () => Promise<void>;
      /**
       * Resolves once the clock has moved this far past now: how a hook of the
       * test's answers late.
       *
       * @param ms how far, in milliseconds
       * @returns resolves when an advance crosses that time
       */
      sleep: (ms: number) => Promise<void>;
  };

  /**
   * Where a mocked clock starts: `now`, in milliseconds (0 when not given).
   */
  export type MockClockOptions = {
      now?: number;
  };

  /**
   * A drawing of component `C` the test mounted on surface `P`: reads over its
   * description, acts on its elements by key, `Client` acts where `P` has one.
   *
   * Narrowed by the `surface` the test passed, as `e.surface` narrows
   * `$.ui.resolve(e)`: no `input` on `mobile`, no `key` on `vscode`, whose
   * tables (Elements) lack `Input` and `Client`; over a union, their meet.
   */
  export type Mounted<P extends RenderSurface = RenderSurface, C extends RenderComponent = RenderComponent> = {
      [K in keyof MountedMembers<P, C> as K extends keyof ElementOfAct ? ElementOfAct[K] extends keyof Elements[P] ? K : never : K]: MountedMembers<P, C>[K];
  };

  /**
   * Every member a mounted drawing of component `C` can have; `Mounted<P, C>`
   * keeps the ones surface `P` has the element for (ElementOfAct).
   *
   * Each act resolves once the loop settled and what a plugin invalidated
   * was drawn again. The kit exercises the mod (its hooks, its description
   * under the surface's rules, its `Client` modules), never a surface's paint.
   */
  export type MountedMembers<P extends RenderSurface, C extends RenderComponent = RenderComponent> = {
      /**
       * Where this drawing is, as the test named it.
       */
      readonly surface: P;
      /**
       * The tree as last drawn: what the plugins' `ui.render` chain returned
       * for this instance, validated by the surface's table, as plain data.
       *
       * With `in`, what that `Client`'s surface module last drew instead.
       *
       * @param scope `{ in }`: a `Client`'s key, to read its module's tree
       * @returns the tree; rejects with the refusal when the surface could not
       *   draw what the chain returned, or with a `Client`'s fault line
       * @example
       * expect(await ui.drawn()).toMatchObject({ type: 'Box' })
       */
      drawn: (scope?: ClientScope) => Promise<RenderElement>;
      /**
       * The first element matching the query, outermost first in document
       * order, or undefined.
       *
       * @param query tag, key and shown text to match; `in` to search a Client
       * @returns the element's description, or undefined when none matches
       * @example
       * expect((await ui.find({ key: 'count' }))?.text).toBe('3 notes')
       */
      find: (query: ElementQuery) => Promise<FoundElement | undefined>;
      /**
       * Every element matching the query, in document order.
       *
       * @param query tag, key and shown text to match; `in` to search a Client
       * @returns the matching elements' descriptions
       * @example
       * expect(await ui.findAll({ type: 'Button' })).toHaveLength(2)
       */
      findAll: (query: ElementQuery) => Promise<FoundElement[]>;
      /**
       * Presses the Button keyed `key`, as the person activating it on this
       * surface does: the `ui.press` chain, the Button's own `onPress` last.
       *
       * `e.surface` is this drawing's. With `link`, presses that link of the
       * Markdown keyed `key` instead. A Button a `Client`'s module drew is
       * pressed the same way, by its key.
       *
       * @param target the key; another plugin's name to press its Button; a link
       * @returns what the chain settled on
       * @example
       * await ui.press({ key: 'save' })
       */
      press: (target: MountPressTarget) => Promise<UiPressResult | undefined>;
      /**
       * Types into the Input keyed `key`: the `ui.input` chain with the text as
       * `e.value`, the Input's own handler last.
       *
       * `kind` `submit` (the default) is Enter with that text, `change` an edit
       * that leaves it in the field.
       *
       * @param target the key and the text; `kind`; another plugin's name
       * @returns what the chain settled on
       * @example
       * await ui.input({ key: 'title', text: 'groceries' })
       */
      input: (target: MountInputTarget) => Promise<UiInputResult | undefined>;
      /**
       * Picks `value` in the Select keyed `key`: the `ui.select` chain, the
       * Select's own `onSelect` last.
       *
       * @param target the key and the option's value; another plugin's name
       * @returns what the chain settled on
       * @example
       * await ui.select({ key: 'sort', value: 'date' })
       */
      select: (target: MountSelectTarget) => Promise<UiSelectResult | undefined>;
      /**
       * Hands a `Client`'s `onKey` listener one key, as a key pressed while
       * its region has the focus does.
       *
       * `in` names the `Client` by key; optional when the drawing holds one.
       *
       * @param event the key (`{ key: 'right' }`, `{ key: 'a', ctrl: true }`)
       * @example
       * await ui.key({ key: 'return', in: 'board' })
       */
      key: (event: MountKeyEvent) => Promise<void>;
      /**
       * Hands a `Client`'s `onPointer` listener one event, in the cells of its
       * region as every surface that draws a `Client` reports them.
       *
       * @param event the event (`{ type: 'down', x: 3, y: 0, button: 'left' }`)
       * @example
       * await ui.pointer({ type: 'down', x: 2, y: 0, button: 'left' })
       */
      pointer: (event: MountPointerEvent) => Promise<void>;
      /**
       * Posts as a `Client`'s own `surface.post(data)` does: the plugin's
       * `ui.message` hooks run with `e.data`, `e.surface` this drawing's.
       *
       * A `{ props }` they answer reaches the instance, which redraws with
       * its state kept.
       *
       * @param data plain data (JsonValue)
       * @param scope `{ in }`: which `Client`, when the drawing holds several
       * @example
       * await ui.post({ pick: 2 })
       */
      post: (data: JsonValue, scope?: ClientScope) => Promise<void>;
      /**
       * Moves the drawing's frame clock on: each `surface.every(ms, fn)` timer
       * of its `Client`s fires at every interval of its own the move crosses.
       *
       * @param ms how far, in milliseconds
       * @example
       * await ui.advance(250)
       */
      advance: (ms: number) => Promise<void>;
      /**
       * Lays a `Client`'s region out at a size, as the surface measuring it
       * does: what its module reads as `surface.columns` and `surface.rows`.
       *
       * @param size cells across and down; `in`: which `Client`
       * @example
       * await ui.resize({ columns: 40, rows: 3 })
       */
      resize: (size: MountResizeTarget) => Promise<void>;
      /**
       * Draws the instance again, as the engine does when its props change (a
       * tool row's output arrived): the `ui.render` chain with the next props.
       *
       * A plugin's own `$.ui.invalidate` needs no call: the drawing follows it
       * before the next read.
       *
       * @param props the component's next props; the current ones when absent
       * @example
       * await ui.redraw({ ...TOOL_ROW, isRunning: false, output: 'done' })
       */
      redraw: (props?: RenderPropsOf[C]) => Promise<void>;
      /**
       * Lets the drawing go, as the surface dropping the instance does: its
       * `Client`s and their timers end. Later acts on the handle reject.
       *
       * @example
       * await ui.unmount()
       */
      unmount: () => Promise<void>;
  };

  /**
   * What a mounted drawing's `input` takes: the Input's key, the text, which
   * of the two inputs it is (`submit` when unsaid), another plugin's name.
   */
  export type MountInputTarget = {
      key: string;
      text: string;
      kind?: UiInputArgument['kind'];
      plugin?: string;
  };

  /**
   * What a mounted drawing's `key` takes: the key as a `Client`'s `onKey`
   * listener receives it (ClientKeyEvent), and which `Client` when several.
   */
  export type MountKeyEvent = ClientKeyEvent & ClientScope;

  /**
   * What a mounted drawing's `pointer` takes: the event as a `Client`'s
   * `onPointer` listener receives it, in its region's cells, and which one.
   */
  export type MountPointerEvent = ClientPointerEvent & ClientScope;

  /**
   * What a mounted drawing's `press` takes: the Button's key, another
   * plugin's name when the Button is not the mounted plugin's, a link.
   */
  export type MountPressTarget = {
      key: string;
      plugin?: string;
      /**
       * Presses this link of the Markdown keyed `key` instead of a Button.
       */
      link?: PressedLink;
  };

  /**
   * What a mounted drawing's `resize` takes: a `Client` region's size in
   * cells, as the surface measuring it hands it, and which `Client`.
   */
  export type MountResizeTarget = {
      columns: number;
      rows: number;
      in?: string;
  };

  /**
   * What a mounted drawing's `select` takes: the Select's key, the picked
   * option's value, another plugin's name when the Select is not its own.
   */
  export type MountSelectTarget = {
      key: string;
      value: string;
      plugin?: string;
  };

  /**
   * What `$.ui.mount` takes: whose elements the test will act on, the surface
   * that draws, and the component instance the engine asks the plugins for.
   *
   * The envelope a `ui.render` hook sees as `e` (`surface`, `component`,
   * `requestId`, `viewport`, `props`) plus `plugin`. `surface` is never
   * defaulted: one body run over several surfaces is what shows independence.
   *
   * @example
   * $.ui.mount({ plugin: 'notes', surface, component: 'Pane', props: PANE })
   */
  export type MountTarget<P extends RenderSurface = RenderSurface, C extends RenderComponent = RenderComponent> = {
      /**
       * Whose elements the handle's acts address by bare `key`: the plugin
       * under test, usually. An act names another plugin to reach its element.
       */
      plugin: string;
      /**
       * What draws: its element table validates every tree the plugins
       * return, and every dispatch the handle raises carries it as `e.surface`.
       *
       * One of `terminal`, `desktop`, `vscode`, `mobile`.
       */
      surface: P;
      /**
       * Which component the engine asks the plugins to draw (`Pane`,
       * `AbovePrompt`, `ToolUse`, ...): what a `ui.render` matcher narrows on.
       */
      component: C;
      /**
       * The component's props, what the hook reads as `e.props`.
       */
      props: RenderPropsOf[C];
      /**
       * The instance drawn (a pane's id, a tool row's tool_use_id); one is
       * minted when absent. Two mounts of one component are two instances.
       */
      requestId?: string;
      /**
       * What the surface measured, as the hook reads it under `e.viewport`;
       * absent when the surface has not measured, as on `e`.
       *
       * Cells across and down in the surface's monospace metric and whether it
       * docks a pane. A `Client` in the drawing starts laid out at this size
       * (0 by 0 when absent) until the handle's `resize` lays its region out.
       */
      viewport?: RenderViewport;
  };

  /**
   * A set of checks and, under `not`, the same set passing where they fail.
   */
  export type Negatable<M> = M & {
      /**
       * The checks negated.
       */
      not: M;
  };

  /**
   * Written inline in a test and loaded as a plugin folder is: its name, the
   * tier it loads in (`user` when not given), and its hooks module's `register`.
   *
   * `register` is written `register(on) { ... }` and is self-contained, as a
   * module's is: it closes over nothing of the test file.
   */
  export type Plugin = {
      name: string;
      tier?: PluginTier;
      register: Register;
  };

  /**
   * A tier a plugin loads in: every tier but the engine's own.
   */
  export type PluginTier = Exclude<Tier, 'core'>;

  /**
   * What `$.ui.press` takes: the plugin whose `ui.render` hook drew the element,
   * the `key` it gave it, the instance and surface when several, a `link`.
   */
  export type PressTarget = {
      plugin: string;
      key: string;
      /**
       * Which instance holds it, when the plugin drew the key in several.
       */
      requestId?: string;
      /**
       * Which surface's drawing, when the key is drawn on more than one; the
       * press carries the surface of the drawing it lands in either way.
       */
      surface?: RenderSurface;
      /**
       * For a Markdown answering its links: which of them the press lands on.
       */
      link?: PressedLink;
  };

  /**
   * One test: it passes when its body returns or resolves, and fails when it
   * throws, rejects or outlasts its time (5000 ms, or `timeoutMs`).
   *
   * The body gets the engine's `$` and an `on` whose hooks sit beneath every
   * plugin; `plugins` load inline plugins beside the one under test. A failure
   * carries what the engine reported meanwhile: each hook it skipped, and why.
   *
   * @param name the test's name, led in its title by the describes around it
   * @param rest the body, `($, on) => ...`, or the options then the body
   */
  export const test: (name: string, ...rest: TestRest) => void;

  /**
   * A test: the engine's `$`, and `on`, a plugin's registrar, whose hooks sit
   * beneath every plugin; beneath them the bottom hook throws, naming its event.
   *
   * The plugins load at the test's first call on `$`, so a test registers its
   * hooks before it, as a module registers its own in `register()`.
   */
  export type TestBody = ($: Engine, on: On) => unknown;

  /**
   * What `test` takes beside its name: the inline plugins it loads beside the
   * one under test, and how long it may run (5000 ms when not given).
   */
  export type TestOptions = {
      plugins?: readonly Plugin[];
      timeoutMs?: number;
  };

  /**
   * What follows a test's name: its body, or its options then its body.
   */
  export type TestRest = readonly [body: TestBody] | readonly [options: TestOptions, body: TestBody];

  /**
   * What `toThrow` compares the thrown error with: a substring or pattern of
   * its message, its class, a value carrying the whole message, or nothing.
   */
  export type ThrowExpectation = string | RegExp | Constructor | WithMessage;

  /**
   * Says which tier the plugin under test loads in, once, at the top of the
   * file: `prepend`, `user` (when unsaid), `append` or `builtin`.
   *
   * @param tier the tier
   */
  export const tier: (tier: PluginTier) => void;

  /**
   * An error-like value `toThrow` compares by its whole message.
   */
  export type WithMessage = {
      message: string;
  };
}

// The inputs of the built-in tools this build has, from each tool's
// input schema. Merges into ToolCallInput (BuiltinToolInputs) so
// `e.tool === "Bash"` narrows to the tool's arguments.
declare module 'claude-code' {
  interface BuiltinToolInputs {
    Agent: {
      /** A short (3-5 word) description of the task */
      description: string
      /** The task for the agent to perform */
      prompt: string
      /** The type of specialized agent to use for this task */
      subagent_type?: string
      /** Optional model override for this agent. Takes precedence over the agent definition's model frontmatter and the configured default subagent model. If omitted, uses the agent definition's model, else the default (inherits from the parent unless a default subagent model is configured). Ignored for subagent_type: "fork" — forks always inherit the parent model. */
      model?: "sonnet" | "opus" | "haiku" | "fable"
      /** Agents run in the background by default; you will be notified when one completes. Set to false only when your very next action depends on this agent's result and nothing else could usefully happen while it runs — otherwise leave it in the background so the user can hand you other work. */
      run_in_background?: boolean
      /** Name for the spawned agent. Makes it addressable via SendMessage({to: name}) while running. */
      name?: string
      /** Deprecated; ignored. The session has a single implicit team. */
      team_name?: string
      /** Deprecated; ignored. Subagents inherit the parent session's permission mode; agent-definition frontmatter may override it. */
      mode?: "acceptEdits" | "auto" | "bypassPermissions" | "default" | "dontAsk" | "plan"
      /** Isolation mode. "worktree" creates a temporary git worktree so the agent works on an isolated copy of the repo. "remote" launches the agent in a remote cloud environment (always runs in background; availability is gated). */
      isolation?: "worktree" | "remote"
    }
    Bash: {
      /** The command to execute */
      command: string
      /** Optional timeout in milliseconds (max 600000) */
      timeout?: number
      /** Clear, concise description of what this command does in active voice. Never use words like "complex" or "risk" in the description - just describe what it does. Say what the command does in plain words: do not echo the command's text, its flags, or file paths - the user reads this description, often without seeing the command. For simple commands (git, npm, standard CLI tools), keep it brief (5-10 words): - ls → "List files in current directory" - git status → "Show working tree status" - npm install → "Install package dependencies" For commands that are harder to parse at a glance (piped commands, obscure flags, etc.), add enough context to clarify what it does: - find . -name "*.tmp" -exec rm {} \; → "Find and delete all .tmp files recursively" - git reset --hard origin/main → "Discard all local changes and match remote main" - curl -s url | jq '.data[]' → "Fetch JSON from URL and extract data array elements" */
      description?: string
      /** Set to true to run this command in the background. */
      run_in_background?: boolean
      /** Set this to true to dangerously override sandbox mode and run commands without sandboxing. */
      dangerouslyDisableSandbox?: boolean
    }
    CronCreate: {
      /** Standard 5-field cron expression in local time: "M H DoM Mon DoW" (e.g. "* /5 * * * *" = every 5 minutes, "30 14 28 2 *" = Feb 28 at 2:30pm local once). */
      cron: string
      /** The prompt to enqueue at each fire time. */
      prompt: string
      /** true (default) = fire on every cron match until deleted or auto-expired after 7 days. false = fire once at the next match, then auto-delete. Use false for "remind me at X" one-shot requests with pinned minute/hour/dom/month. */
      recurring?: boolean
      /** true = persist to .claude/scheduled_tasks.json and survive restarts. false (default) = in-memory only, dies when this Claude session ends. Use true only when the user asks the task to survive across sessions. */
      durable?: boolean
    }
    CronDelete: {
      /** Job ID returned by CronCreate. */
      id: string
    }
    CronList: {}
    Edit: {
      /** The absolute path to the file to modify */
      file_path: string
      /** The text to replace */
      old_string: string
      /** The text to replace it with (must be different from old_string) */
      new_string: string
      /** Replace all occurrences of old_string (default false) */
      replace_all?: boolean
    }
    EnterWorktree: {
      /** Optional name for a new worktree. Each "/"-separated segment may contain only letters, digits, dots, underscores, and dashes; max 64 chars total. A random name is generated if not provided. Mutually exclusive with `path`. */
      name?: string
      /** Path to an existing worktree to switch into instead of creating a new one. Must appear in `git worktree list` for the current repo — or, on first entry from the launch directory, for a repo nested inside it (multi-repo workspace). Mutually exclusive with `name`. */
      path?: string
    }
    ExitWorktree: {
      /** "keep" leaves the worktree and branch on disk; "remove" deletes both. */
      action: "keep" | "remove"
      /** Required true when action is "remove" and the worktree has uncommitted files or unmerged commits. The tool will refuse and list them otherwise. */
      discard_changes?: boolean
    }
    ListAgents: {
      /** Not available in this build; leave unset. */
      channel?: string
      /** Not available in this build; leave unset. */
      q?: string
    }
    NotebookEdit: {
      /** The absolute path to the Jupyter notebook file to edit (must be absolute, not relative) */
      notebook_path: string
      /** The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified. */
      cell_id?: string
      /** The new source for the cell */
      new_source: string
      /** The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required. */
      cell_type?: "code" | "markdown"
      /** The type of edit to make (replace, insert, delete). Defaults to replace. */
      edit_mode?: "replace" | "insert" | "delete"
    }
    PowerShell: {
      /** The PowerShell command to execute */
      command: string
      /** Optional timeout in milliseconds (max 600000) */
      timeout?: number
      /** Clear, concise description of what this command does in active voice. */
      description?: string
      /** Set to true to run this command in the background. */
      run_in_background?: boolean
      /** Set this to true to dangerously override sandbox mode and run commands without sandboxing. */
      dangerouslyDisableSandbox?: boolean
    }
    Read: {
      /** The absolute path to the file to read */
      file_path: string
      /** The line number to start reading from. Only provide if the file is too large to read at once */
      offset?: number
      /** The number of lines to read. Only provide if the file is too large to read at once. */
      limit?: number
      /** Page range for PDF files (e.g., "1-5", "3", "10-20"). Only applicable to PDF files. Maximum 20 pages per request. */
      pages?: string
    }
    ReportFindings: {
      /** Effort level the review ran at */
      level?: "low" | "medium" | "high" | "xhigh" | "max"
      /** Verified findings, most-severe first; empty if none survived */
      findings: Array<{
        /** Repo-relative path of the file the finding is in */
        file: string
        /** 1-indexed line the finding anchors to */
        line?: number
        /** One-sentence statement of the defect */
        summary: string
        /** Compressed label for compact UI (≤60 chars): the claim alone, no rationale or consequence clause */
        short_summary?: string
        /** Concrete inputs/state → wrong output/crash */
        failure_scenario: string
        /** Short kebab-case slug of the finding type, e.g. "correctness", "simplification", "efficiency", "test-coverage" */
        category?: string
        /** Set when a verify pass ran; absent on inline-only reviews */
        verdict?: "CONFIRMED" | "PLAUSIBLE"
        /** Set ONLY when re-reporting after applying fixes: what happened to this finding */
        outcome?: "fixed" | "skipped" | "no_change_needed"
      }>
    }
    ScheduleWakeup: {
      /** Seconds from now to wake up. Clamped to [60, 3600] by the runtime. Required unless `stop` is true. */
      delaySeconds?: number
      /** One short sentence explaining the chosen delay. Goes to telemetry and is shown to the user. Be specific. Required unless `stop` is true. */
      reason?: string
      /** The /loop input to fire on wake-up. Pass the same /loop input verbatim each turn so the next firing re-enters the skill and continues the loop. For autonomous /loop (no user prompt), pass the literal sentinel `<<autonomous-loop-dynamic>>` instead (the dynamic-pacing variant, not the CronCreate-mode `<<autonomous-loop>>`). Required unless `stop` is true. */
      prompt?: string
      /** Set to true to end the dynamic loop immediately instead of scheduling another wakeup. When true, all other fields are ignored and no further wakeups fire. */
      stop?: boolean
      /** true = nothing changed (you checked and there is nothing to report). false = something happened worth keeping (edited a file, posted a message, advanced state, surfaced a finding). Consecutive noop:true ticks are collapsed in the user's terminal view and tracked as a streak. Required unless `stop` is true. */
      noop?: boolean
    }
    SendMessage: {
      /** Recipient: a name from ListAgents (append its " [ref]" only when a listing or an error shows one), a teammate name, "main", or a background agent's agentId */
      to: unknown & unknown
      /** A 5-10 word label for your own transcript row (not transmitted — the recipient previews the first line of `message`). Truncated to 200 characters rather than rejected. */
      summary?: string
      /** Plain text message content. The recipient's human sees only the FIRST LINE as a one-line preview until they expand it, so make the first line a clear, self-contained sentence saying what this is about — not a greeting, preamble, or bare @-mention. */
      message: string
      /** Ask a session ON THIS MACHINE to send you ONE notice when it next goes idle (finishes its turn with nothing queued) or exits — opt-in, one-shot, no polling. With a message: deliver it now AND subscribe. Without a message (omit it): a pure subscription that costs the other session nothing. */
      notify_when_idle?: boolean
    }
    Skill: {
      /** The name of a skill from the available-skills list. Do not guess names. */
      skill: string
      /** Optional arguments for the skill */
      args?: string
    }
    TaskOutput: {
      /** The task ID to get output from */
      task_id: string
      /** Whether to wait for completion */
      block: boolean
      /** Max wait time in ms */
      timeout: number
    }
    TaskStop: {
      /** The ID of the background task to stop. Agent-team teammates and named background agents are also accepted by agent ID or name. */
      task_id?: string
      /** Deprecated: use task_id instead */
      shell_id?: string
    }
    ToolSearch: {
      /** Query to find deferred tools. Use "select:<tool_name>" for direct selection, or keywords to search. */
      query: string
      /** Maximum number of results to return (default: 5) */
      max_results: number
    }
    WebFetch: {
      /** The URL to fetch content from */
      url: string
      /** The prompt to run on the fetched content */
      prompt: string
    }
    WebSearch: {
      /** The search query to use */
      query: string
      /** Only include search results from these domains */
      allowed_domains?: string[]
      /** Never include search results from these domains */
      blocked_domains?: string[]
    }
    Workflow: {
      /** Self-contained workflow script. Must begin with `export const meta = { name, description, phases }` (pure literal, no computed values) followed by the script body using agent()/parallel()/pipeline()/phase(). */
      script?: string
      /** Name of a predefined workflow (built-in or from .claude/workflows/). Resolves to a self-contained script. */
      name?: string
      /** Ignored — set the workflow description in the script's `meta` block. */
      description?: string
      /** Ignored — set the workflow title in the script's `meta` block. */
      title?: string
      /** Optional input value exposed to the script as the global `args`, verbatim. Pass arrays/objects as actual JSON values, NOT as a JSON-encoded string — a stringified list breaks `args.filter`/`args.map` in the script. Use for parameterized named workflows (e.g. a research question). */
      args?: unknown
      /** Path to a workflow script file on disk. Every Workflow invocation persists its script under the session directory and returns the path in the tool result. To iterate, edit that file with Write/Edit and re-invoke Workflow with the same `scriptPath` instead of re-sending the full script. Takes precedence over `script` and `name`. */
      scriptPath?: string
      /** Run ID of a prior Workflow invocation to resume from. Completed agent() calls with unchanged (prompt, opts) return their cached results instantly; only edited or new calls re-run. Same-session only. Stop the prior run first (TaskStop) before resuming. */
      resumeFromRunId?: string
    }
    Write: {
      /** The absolute path to the file to write (must be absolute, not relative) */
      file_path: string
      /** The content to write to the file */
      content: string
    }
  }
}

// The structured results of the same tools, from each tool's output
// schema. Merges into ToolCallResult (BuiltinToolResults) so after
// `e.tool === "Bash"` the `result` of `next(e)` is the tool's record.
declare module 'claude-code' {
  interface BuiltinToolResults {
    Agent: {
      agentId: string
      /** @internal Count of leading harness-authored content blocks (hand-back provenance bookkeeping; not a stable consumer field) */
      harnessNoteCount?: number
      /** @internal Count of trailing harness-authored content blocks (hand-back provenance bookkeeping; not a stable consumer field) */
      harnessTailCount?: number
      /** @internal Fingerprint binding the harness section counts to the exact content they were computed against; a hook rewrite invalidates the counts rather than misplacing rewritten bytes */
      harnessSectionHash?: string
      agentType?: string
      /** @internal How the report reached this result under the subagent hand-back contract: 'send' = the child's classified SubagentHandback delivery, 'flagged' = that delivery under a SECURITY WARNING, 'withheld' = nothing was delivered (not a stable consumer field) */
      handback?: "send" | "flagged" | "withheld"
      content: Array<{
        type: "text"
        text: string
        citations?: unknown[] | null
      }>
      resolvedModel?: string
      modelsUsed?: string[]
      totalToolUseCount: number
      totalDurationMs: number
      totalTokens: number
      usage: {
        input_tokens: number
        output_tokens: number
        cache_creation_input_tokens: number | null
        cache_read_input_tokens: number | null
        server_tool_use: {
          web_search_requests: number
          web_fetch_requests: number
        } | null
        service_tier: string | null
        cache_creation: {
          ephemeral_1h_input_tokens: number
          ephemeral_5m_input_tokens: number
        } | null
        inference_geo?: string | null
        speed?: string | null
        iterations?: unknown
        output_tokens_details?: {
          thinking_tokens?: number | null
        } | null
      }
      toolStats?: {
        readCount: number
        searchCount: number
        bashCount: number
        editFileCount: number
        linesAdded: number
        linesRemoved: number
        otherToolCount: number
        frameCount?: number
      }
      status: "completed"
      prompt: string
      worktreePath?: string
      worktreeBranch?: string
    } | {
      status: "async_launched"
      isAsync?: true
      /** The ID of the async agent */
      agentId: string
      /** The description of the task */
      description: string
      /** Model in use at the backgrounding transition (a pre-background swap is reflected here) */
      resolvedModel?: string
      /** Ordered distinct models used before backgrounding (length > 1 means a mid-run swap) */
      modelsUsed?: string[]
      /** The prompt for the agent */
      prompt: string
      /** Path to the output file for checking agent progress */
      outputFile: string
      /** Whether the calling agent has Read/Bash tools to check progress */
      canReadOutputFile?: boolean
    } | {
      status: "remote_launched"
      /** The ID of the remote agent task */
      taskId: string
      /** The URL of the cloud session */
      sessionUrl: string
      /** The description of the task */
      description: string
      /** The prompt for the agent */
      prompt: string
      /** Path to the output file for checking agent progress */
      outputFile: string
    }
    Bash: {
      /** The standard output of the command */
      stdout: string
      /** The standard error output of the command */
      stderr: string
      /** Path to raw output file for large MCP tool outputs */
      rawOutputPath?: string
      /** Whether the command was interrupted */
      interrupted: boolean
      /** Flag to indicate if stdout contains image data */
      isImage?: boolean
      /** ID of the background task if command is running in background */
      backgroundTaskId?: string
      /** True if the user manually backgrounded the command with Ctrl+B */
      backgroundedByUser?: boolean
      /** @internal True if a plugin's turn abort moved the running command to the background */
      backgroundedByTurnAbort?: boolean
      /** @internal True if the command was moved to the background so a message queued for the model could reach it */
      backgroundedToDeliverMessage?: boolean
      /** Set when the command hit its timeout and was auto-backgrounded; the timeout value in ms */
      timedOutAfterMs?: number
      /** Model-facing note that the session cwd was not changed by a backgrounded command containing a directory-change builtin (cd/pushd/popd/chdir) */
      backgroundCwdHint?: string
      /** True when this backgrounded command is owned by a synchronous subagent and is therefore terminated when that agent gives its final response; absent when the command survives (main loop, async subagents) */
      backgroundEndsWithFinalResponse?: true
      /** Flag to indicate if sandbox mode was overridden */
      dangerouslyDisableSandbox?: boolean
      /** Semantic interpretation for non-error exit codes with special meaning */
      returnCodeInterpretation?: string
      /** Whether the command is expected to produce no output on success */
      noOutputExpected?: boolean
      /** Structured content blocks */
      structuredContent?: unknown[]
      /** Path to the persisted full output in tool-results dir (set when output is too large for inline) */
      persistedOutputPath?: string
      /** Total size of the output in bytes (set when output is too large for inline) */
      persistedOutputSize?: number
      /** Model-facing note listing readFileState entries whose mtime bumped during this command (set when WRITE_COMMAND_MARKERS matches) */
      staleReadFileStateHint?: string
      /** Model-facing system-reminder appended when a gh command reports a GitHub API rate-limit error */
      ghRateLimitHint?: string
      /** Structured classification of git/gh operations detected in this command (commit/push/merge/rebase/PR). Client-facing — lets clients render git activity without re-parsing stdout; not surfaced to the model. */
      gitOperation?: {
        commit?: {
          sha: string
          kind: "committed" | "amended" | "cherry-picked"
          branch?: string
        }
        push?: {
          branch: string
        }
        branch?: {
          ref: string
          action: "merged" | "rebased"
        }
        pr?: {
          number: number
          url?: string
          action: "created" | "edited" | "merged" | "commented" | "closed" | "reopened" | "ready" | "draft" | "auto-merge-enabled" | "auto-merge-disabled"
        }
      }
      /** @internal Per-file diff of the working-tree changes this command made, for rendering and for PostToolUse Bash hooks (changedFiles: absolute paths of every changed file known, shown or not, at most 200; cut when shorter than files.length + moreFiles); not surfaced to the model. */
      bashEditDiff?: {
        files: {
          filePath: string
          hunks: {
            oldStart: number
            oldLines: number
            newStart: number
            newLines: number
            lines: string[]
          }[]
          created?: true
          deleted?: true
        }[]
        moreFiles: number
        changedFiles?: string[]
        unavailable?: true
        skipped?: true
        shared?: true
      }
    }
    CronCreate: {
      id: string
      humanSchedule: string
      recurring: boolean
      durable?: boolean
    }
    CronDelete: {
      id: string
    }
    CronList: {
      jobs: {
        id: string
        cron: string
        humanSchedule: string
        prompt: string
        recurring?: boolean
        durable?: boolean
      }[]
    }
    Edit: {
      /** The file path that was edited */
      filePath: string
      /** The original string that was replaced */
      oldString: string
      /** The new string that replaced it */
      newString: string
      /** The original file contents before editing */
      originalFile: string | null
      /** Diff patch showing the changes */
      structuredPatch: {
        oldStart: number
        oldLines: number
        newStart: number
        newLines: number
        lines: string[]
      }[]
      /** Whether the user modified the proposed changes */
      userModified: boolean
      /** Whether all occurrences were replaced */
      replaceAll: boolean
      gitDiff?: {
        filename: string
        status: "modified" | "added"
        additions: number
        deletions: number
        changes: number
        patch: string
        /** GitHub owner/repo when available */
        repository?: string | null
      }
      /** True when the edit was held for the machine owner to review instead of written; the file is unchanged */
      staged?: boolean
    }
    EnterWorktree: {
      worktreePath: string
      worktreeBranch?: string
      message: string
    }
    ExitWorktree: {
      action: "keep" | "remove"
      originalCwd: string
      worktreePath: string
      worktreeBranch?: string
      tmuxSessionName?: string
      discardedFiles?: number
      discardedCommits?: number
      message: string
    }
    ListAgents: {
      /** Formatted list of reachable agents */
      listing: string
    }
    NotebookEdit: {
      /** The new source code that was written to the cell */
      new_source: string
      /** The previous cell source (replace/delete only). Enables cell-relative diff rendering without re-reading the notebook. */
      old_source?: string
      /** The ID of the cell that was edited */
      cell_id?: string
      /** The type of the cell */
      cell_type: "code" | "markdown"
      /** The programming language of the notebook */
      language: string
      /** The edit mode that was used */
      edit_mode: string
      /** Error message if the operation failed */
      error?: string
      /** The path to the notebook file */
      notebook_path: string
      /** The original notebook content before modification */
      original_file: string
      /** The updated notebook content after modification */
      updated_file: string
    }
    PowerShell: {
      /** The standard output of the command */
      stdout: string
      /** The standard error output of the command */
      stderr: string
      /** Whether the command was interrupted */
      interrupted: boolean
      /** Semantic interpretation for non-error exit codes with special meaning */
      returnCodeInterpretation?: string
      /** Flag to indicate if stdout contains image data */
      isImage?: boolean
      /** Path to persisted full output when too large for inline */
      persistedOutputPath?: string
      /** Total output size in bytes when persisted */
      persistedOutputSize?: number
      /** ID of the background task if command is running in background */
      backgroundTaskId?: string
      /** True if the user manually backgrounded the command with Ctrl+B */
      backgroundedByUser?: boolean
      /** @internal True if a plugin's turn abort moved the running command to the background */
      backgroundedByTurnAbort?: boolean
      /** @internal True if the command was moved to the background so a message queued for the model could reach it */
      backgroundedToDeliverMessage?: boolean
      /** Set when the command hit its timeout and was auto-backgrounded; the timeout value in ms */
      timedOutAfterMs?: number
      /** True when this backgrounded command is owned by a synchronous subagent and is therefore terminated when that agent gives its final response; absent when the command survives (main loop, async subagents) */
      backgroundEndsWithFinalResponse?: true
      /** Structured classification of git/gh operations detected in this command (commit/push/merge/rebase/PR). Client-facing — lets clients render git activity without re-parsing stdout; not surfaced to the model. */
      gitOperation?: {
        commit?: {
          sha: string
          kind: "committed" | "amended" | "cherry-picked"
          branch?: string
        }
        push?: {
          branch: string
        }
        branch?: {
          ref: string
          action: "merged" | "rebased"
        }
        pr?: {
          number: number
          url?: string
          action: "created" | "edited" | "merged" | "commented" | "closed" | "reopened" | "ready" | "draft" | "auto-merge-enabled" | "auto-merge-disabled"
        }
      }
    }
    Read: {
      type: "text"
      file: {
        /** The path to the file that was read */
        filePath: string
        /** The content of the file */
        content: string
        /** Number of lines in the returned content */
        numLines: number
        /** The starting line number */
        startLine: number
        /** Total number of lines in the file */
        totalLines: number
        /** True when a whole-file read was auto-paginated because it exceeded the token cap (the content is a partial first page). A programmatic signal for internal consumers; survives output reconstruction (unlike the render-time banner). */
        truncatedByTokenCap?: boolean
      }
      /** Set when this Read completed a saved Artifact source file: the Artifact and the version of it that now counts as viewed. */
      artifactRead?: {
        slug: string
        ver: string
      }
    } | {
      type: "image"
      file: {
        /** Base64-encoded image data */
        base64: string
        /** The MIME type of the image */
        type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
        /** Original file size in bytes */
        originalSize: number
        /** Image dimension info for coordinate mapping */
        dimensions?: {
          /** Original image width in pixels */
          originalWidth?: number
          /** Original image height in pixels */
          originalHeight?: number
          /** Displayed image width in pixels (after resizing) */
          displayWidth?: number
          /** Displayed image height in pixels (after resizing) */
          displayHeight?: number
        }
      }
    } | {
      type: "notebook"
      file: {
        /** The path to the notebook file */
        filePath: string
        /** Array of notebook cells */
        cells: unknown[]
      }
    } | {
      type: "pdf"
      file: {
        /** The path to the PDF file */
        filePath: string
        /** Base64-encoded PDF data */
        base64: string
        /** Original file size in bytes */
        originalSize: number
      }
    } | {
      type: "parts"
      file: {
        /** The path to the PDF file */
        filePath: string
        /** Original file size in bytes */
        originalSize: number
        /** Number of pages extracted */
        count: number
        /** Directory containing extracted page images */
        outputDir: string
      }
      /** Document page number of the first extracted page (1 when no range was requested); labels the page images in the model-facing tool_result */
      firstPage?: number
      /** Extracted page images, in page order. Present only transiently in-process: the page image bytes are delivered solely as image blocks in the model-facing tool_result content and are not retained on the tool_use_result, so this key is absent on the emitted/persisted result */
      pages?: Array<{
        /** Base64-encoded page image; empty when the page could not be processed */
        base64: string
        /** The MIME type of the image */
        mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
        /** Why the page could not be processed as an image; set only when base64 is empty */
        error?: string
      }>
    } | {
      type: "file_unchanged"
      file: {
        /** The path to the file */
        filePath: string
      }
      /** Set when the dedup matched a startup-seeded entry (CLAUDE.md / nested memory) rather than a prior Read tool_result */
      source?: "seeded"
    }
    ReportFindings: {
      /** Number of findings reported */
      count: number
      /** Effort level the review ran at */
      level?: "low" | "medium" | "high" | "xhigh" | "max"
      /** Echoed for the result body */
      findings: Array<{
        /** Repo-relative path of the file the finding is in */
        file: string
        /** 1-indexed line the finding anchors to */
        line?: number
        /** One-sentence statement of the defect */
        summary: string
        /** Compressed label for compact UI (≤60 chars): the claim alone, no rationale or consequence clause */
        short_summary?: string
        /** Concrete inputs/state → wrong output/crash */
        failure_scenario: string
        /** Short kebab-case slug of the finding type, e.g. "correctness", "simplification", "efficiency", "test-coverage" */
        category?: string
        /** Set when a verify pass ran; absent on inline-only reviews */
        verdict?: "CONFIRMED" | "PLAUSIBLE"
        /** Set ONLY when re-reporting after applying fixes: what happened to this finding */
        outcome?: "fixed" | "skipped" | "no_change_needed"
      }>
    }
    ScheduleWakeup: {
      /** Epoch ms timestamp when the next wakeup will fire */
      scheduledFor: number
      /** Actual delay used after clamping to runtime bounds */
      clampedDelaySeconds: number
      /** True if the requested delaySeconds was outside [60, 3600] */
      wasClamped: boolean
      /** True when the model ended the loop via `stop: true` */
      stopped?: boolean
      /** How many pending dynamic-loop wakeups stop:true cancelled. 0 means nothing was pending — a recurring /loop cron is not cancelled by stop:true. */
      cancelledWakeups?: number
    }
    SendMessage: unknown
    Skill: {
      /** Whether the skill is valid */
      success: boolean
      /** The name of the skill */
      commandName: string
      /** Tools allowed by this skill */
      allowedTools?: string[]
      /** Resolved model the skill turn runs on when a frontmatter model override took effect; omitted otherwise */
      model?: string
      /** Execution status */
      status?: "inline"
      /** True when the skill instructions were loaded read-only (nothing was executed) */
      readOnly?: boolean
    } | {
      /** Whether the skill completed successfully */
      success: boolean
      /** The name of the skill */
      commandName: string
      /** Execution status */
      status: "forked"
      /** The ID of the sub-agent that executed the skill */
      agentId: string
      /** The result from the forked skill execution */
      result: string
      /** True when the sub-agent was launched in the background: `result` describes the launch, and the skill outcome arrives later as a task notification. */
      background?: boolean
    }
    TaskOutput: unknown
    TaskStop: {
      /** Status message about the operation */
      message: string
      /** The ID of the task that was stopped */
      task_id: string
      /** The type of the task that was stopped */
      task_type: string
      /** The command or description of the stopped task */
      command?: string
    }
    ToolSearch: {
      matches: string[]
      query: string
      total_deferred_tools: number
      pending_mcp_servers?: string[]
      failed_mcp_servers?: {
        name: string
        errorCode?: string
        error?: string
      }[]
    }
    WebFetch: {
      /** Size of the fetched content in bytes */
      bytes: number
      /** HTTP response code */
      code: number
      /** HTTP response code text */
      codeText: string
      /** Processed result from applying the prompt to the content */
      result: string
      /** Time taken to fetch and process the content */
      durationMs: number
      /** The URL that was fetched */
      url: string
      artifactRead?: {
        slug: string
        ver?: string
        seeded?: false
      }
    }
    WebSearch: {
      /** The search query that was executed */
      query: string
      /** Search results and/or text commentary from the model */
      results: Array<{
        /** ID of the tool use */
        tool_use_id: string
        /** Array of search hits */
        content: Array<{
          /** The title of the search result */
          title: string
          /** The URL of the search result */
          url: string
        }>
      } | string>
      /** Time taken to complete the search operation */
      durationSeconds: number
      /** Number of web searches performed */
      searchCount?: number
    }
    Workflow: {
      status: "async_launched" | "remote_launched"
      taskId: string
      /** TaskType of the registered background task — 'local_workflow' for in-process runs, 'remote_agent' when remote:true dispatches to CCR. Set on all new writes; absent only on transcripts written before this field existed. */
      taskType?: "local_workflow" | "remote_agent"
      /** meta.name from the workflow script — same value as task_started.workflow_name. Set on all new writes; absent only on transcripts written before this field existed. */
      workflowName?: string
      /** Local workflow run identifier for resumeFromRunId. Absent for remote_launched (the CCR session URL is the resume handle there) and on transcripts written before this field existed. */
      runId?: string
      summary?: string
      /** Directory where subagent transcripts are written during execution */
      transcriptDir?: string
      /** Path to the persisted workflow script for this invocation. Editable via Write/Edit; pass back as `scriptPath` to re-run without resending the script. */
      scriptPath?: string
      /** CCR session URL when status is remote_launched */
      sessionUrl?: string
      /** Non-blocking heads-up (e.g. local git state diverges from the pushed branch the cloud session will clone) */
      warning?: string
      /** Set if syntax check failed */
      error?: string
    }
    Write: {
      /** Whether a new file was created or an existing file was updated */
      type: "create" | "update"
      /** The path to the file that was written */
      filePath: string
      /** The content that was written to the file */
      content: string
      /** Diff patch showing the changes (empty when nothing changed, the diff timed out, or — with originalFile null on an update — the previous content was too large to diff) */
      structuredPatch: {
        oldStart: number
        oldLines: number
        newStart: number
        newLines: number
        lines: string[]
      }[]
      /** The original file content before the write (null for new files, or when the previous content was too large to include) */
      originalFile: string | null
      gitDiff?: {
        filename: string
        status: "modified" | "added"
        additions: number
        deletions: number
        changes: number
        patch: string
        /** GitHub owner/repo when available */
        repository?: string | null
      }
      /** True when the user edited the proposed content in the permission dialog before accepting */
      userModified?: boolean
      /** True when the write was held for the machine owner to review instead of written; the file is unchanged */
      staged?: boolean
    }
  }
}
