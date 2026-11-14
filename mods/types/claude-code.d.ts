// Claude Code function hooks: the plugin API's TypeScript declarations.
//
// EARLY ACCESS: this surface may change between releases without notice.
// The engine writes this file each time it loads a mod from a folder the
// person owns, beside that mod as .claude-plugin/types/claude-code/index.d.ts,
// under a first line naming the Claude Code version that wrote it, and again
// after an update, so don't edit a copy. TypeScript 5.4 or newer reads it.
// `claude plugin validate <dir>` is the other half: it reads a plugin's
// manifest and its hooks module's source the way the engine will and
// reports what the module hooks and calls, the $ nouns an engine.create
// hook adds or withholds, and everything the engine would refuse, before
// any session loads it. Its lists of hooks, calls and nouns are notes
// (`notes` in its JSON report) and fail nothing. Validate also refuses an
// engine.create hook outside its one form, spelled in plugin-authoring's
// reference, which still loads: a check, and no guarantee or security
// boundary.
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
// is no `require`. A file of the plugin is imported with an `import`
// declaration. A module holding `import()` does not load. The elements a
// render hook draws with (`Box`, `Text`, `Button`, ...) are not globals:
// they come from the surface's table,
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
//     "include": [".claude-plugin/types", "hooks", "types", "tests"]
//   }
// ".claude-plugin/types" is where the engine lays this file (claude-code/)
// and, beside it, this build's built-in tools (claude-code-tools/), the MCP
// tools connected when the mod last reloaded (claude-code-mcp/) and one entry
// per plugin the mod's plugin.json lists under "dependencies" (that plugin's
// own contract): what it adds to `$` in engine.create, so a plugin you
// depend on is typed with nothing copied (the include above takes the whole
// folder). "hooks" is the plugin's hooks/ folder, "types" its own contract
// and "tests" its test files. `lib` names no DOM: the environment has
// none, and its `Text` would shadow the element. A mod with no tsconfig of
// its own has these options without writing them: the engine gives it a
// tsconfig.json that extends .claude-plugin/types/tsconfig.json, which
// carries them with that folder as the one type root.
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
   * One plugin's row of the band: what its `AbovePrompt` chain settled to, with a
   * Progress root inside a Box marked as that plugin's.
   */
  type AbovePromptRow = {
      /**
       * Who the row was asked of (`e.plugin` on its `AbovePrompt`).
       */
      plugin: string;
      /**
       * The row's settled tree, validated alone.
       */
      tree: RenderElement;
  };

  /**
   * The argument of `$.agent.call`: a tool, its arguments, and whose call it is.
   */
  export type AgentCallArgs = {
      /**
       * As that agent's model names it (`Bash`, `mcp__server__tool`).
       */
      tool: string;
      /**
       * The tool's arguments (`{ command }` for Bash).
       */
      input: Record<string, unknown>;
      /**
       * The agent the call is made as, running or resting (finished, or stopped
       * by another agent); absent for the main conversation. Pinned.
       */
      agentId?: string;
  };

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
   * or a teammate.
   */
  export type AgentInfo = {
      /**
       * The agent's one id: `agent.spawn` answers it as `agentId`, its loop's
       * events carry it as `agentId`, a spawn inside it as `parentAgentId`.
       *
       * The Agent tool's record spells it `agentId` too, the classic events
       * (SubagentStart, SubagentStop, TeammateIdle) `agent_id`. A teammate in a
       * terminal pane of its own runs no loop here: its id is its address.
       */
      id: string;
      /**
       * A teammate's address in its team, `<name>@<team>`, which the roster keys
       * it by; absent for any other agent.
       *
       * It joins `agent.spawn`'s `teammateId` and the Agent tool's `teammate_id`,
       * and no event's `agentId`: that is `id`. A respawn under the name keeps it.
       */
      teammateId?: string;
      /**
       * The Agent call's own `description` of the task (a few words), as an
       * `agent.spawn` hook left it.
       */
      description: string;
      /**
       * The agent type it was spawned as, `agent.spawn`'s `subagentType`
       * (`general-purpose`, `Explore`, ...); `teammate` for one spawned as none.
       *
       * A teammate's classic events give its `name` as `agent_type`, not this.
       */
      type: string;
      /**
       * Where its loop stands now (AgentStatus): a teammate that waits for a
       * message is `idle`, not `running`.
       *
       * One in a terminal pane of its own is `running` or `idle` by what it last
       * wrote in its team's roster, at a turn's start and at its end: a pane that
       * is closed or dies leaves that word standing.
       */
      status: AgentStatus;
      /**
       * The id of the agent whose loop spawned it; absent when the main loop
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
       *
       * A teammate's is its name in the team, with a suffix when the call's was
       * taken. Two agents may hold one name: `id` tells them apart.
       */
      name?: string;
      /**
       * Which kind of task the engine keeps it as: `local_agent` for every
       * subagent, whatever its `type`; `in_process_teammate` for a teammate.
       */
      kind: 'local_agent' | 'in_process_teammate';
      /**
       * The task's own status, as the engine stores it: `status` before it tells
       * `waiting` and `idle` apart.
       *
       * A subagent that ended its turn is `completed` here whatever still holds
       * it, and a teammate between turns `running`.
       */
      taskStatus: 'pending' | 'running' | 'completed' | 'failed' | 'killed' | 'paused';
      /**
       * What it is doing: its latest progress summary as stored, line breaks and
       * all, else `description`. The summary is a model's text.
       */
      label: string;
      /**
       * When it started, in milliseconds since the epoch.
       */
      startTime: number;
      /**
       * The directory it works in: its own (a worktree), else the session's.
       */
      cwd: string;
      /**
       * The id of the model it runs on, a subagent's moving with a fallback;
       * absent where the engine has none (a teammate in a pane of its own).
       */
      model?: string;
      /**
       * The effort set for it (its definition's or the call's), a level or a
       * number, as written; absent when it takes the session's.
       *
       * What a request carries may be less: a model caps it, or takes none
       * (`lastRequest`).
       */
      effort?: ModelEffort | number;
      /**
       * The context window of `model` in tokens, what `tokenCount` is a share
       * of; absent when `model` is.
       */
      contextWindowSize?: number;
      /**
       * The tokens it has used: its latest request's input and all its output;
       * 0 before the first reading.
       */
      tokenCount: number;
      /**
       * Its last 16 `tokenCount` readings, oldest first, about five seconds
       * apart, the last one `tokenCount` itself.
       *
       * The engine keeps them whether or not a plugin is loaded, and starts them
       * over once the agent's row goes.
       */
      tokenSamples: number[];
      /**
       * The last request of its loop that the API began to answer; absent before
       * the first, and for a teammate in a pane of its own.
       */
      lastRequest?: AgentRequest;
      /**
       * Its own requests' tokens, one entry a model that answered, so a change of
       * model mid-run starts another; absent until `/cost` counts a request.
       *
       * Every request `/cost` counts for it, once: its steps and their retries,
       * its compactions, summaries, advisor, web tools and settings hooks, and
       * auto mode's billed classifier calls on its tool calls and compactions. Not
       * a subagent's or forked skill's, nor a response a hook made up. The observer
       * of an agent it starts adds what its first run asks beside its own steps.
       *
       * A request stopped or cut mid-stream counts too, its input as the response
       * began. Its output is an estimate from what had streamed, not a floor: a
       * little over the bill for text, and low when a long tool call was being
       * written, whose input the API holds until it is whole.
       *
       * They go on over its turns and resumes, plugins or none. They start over
       * where the session's total is reset or swapped for a stored one (`/clear`,
       * `/resume`, a new process), which holds no agent's part.
       *
       * @example
       * const output = (agent.usage ?? []).reduce((n, u) => n + u.output_tokens, 0)
       */
      usage?: TurnUsage[];
      /**
       * What `/cost` was credited for the requests of `usage`: a part of
       * `$.session.usage()`'s `cost`, so an estimate too (SessionCost).
       *
       * `/cost` prices the model asked for (or the API's own fallback), so where a
       * gateway answers on another, `usage` names a model this was not priced at.
       *
       * Fast mode, long prompts and search fees are in it, which the counts of
       * `usage` do not tell. Absent only where the host keeps no cost ledger of
       * the agent: a teammate in a pane of its own.
       */
      cost?: SessionCost;
      /**
       * Whether the at-a-glance agent list holds a row for it (`AgentRow`),
       * anywhere in its tree and hidden or not; false where the layout draws no
       * agent rows.
       *
       * A finished subagent keeps one, undrawn, until the engine drops its task.
       */
      hasRow: boolean;
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
   * One request of an agent's loop (a `turn.step`'s) as it went out, past caps,
   * fallbacks and a hook's rewrite.
   */
  export type AgentRequest = {
      /**
       * When it was sent, in `$.clock.now()`'s milliseconds: the moment a cache
       * lifetime counts from, which is the request's start, not its response's end.
       *
       * A retry that was answered is sent at its own time.
       */
      at: number;
      /**
       * The model that answered, as the step's `usage.model` has it.
       */
      model: string;
      /**
       * The effort it carried; absent where none was sent.
       *
       * The step's `effort` as the hooks left it, unless a limit lowered it or
       * another level was in force (TurnStepInput).
       */
      effort?: ModelEffort | number;
      /**
       * How long from `at` the cache holds what it wrote, the shorter when it
       * wrote both; when it only read, what the agent's last write was given.
       *
       * Absent where it neither read nor wrote, or no lifetime was reported. A
       * progress summary reading the same prompt later renews it unseen.
       *
       * @example
       * const ttlMs = last.cacheTtl === "1h" ? 3_600_000 : 300_000
       * const leftMs = last.at + ttlMs - (await $.clock.now())
       */
      cacheTtl?: '5m' | '1h';
  };

  /**
   * `agent.spawn`'s input as the call takes it: what the Agent tool's caller
   * says; the engine fills the rest.
   *
   * A call's spawn runs in the background: it resolves once the subagent
   * started, and nothing holds it in the foreground.
   */
  export type AgentSpawnArgs = Pick<AgentSpawnInput, 'prompt'> & Partial<Pick<AgentSpawnInput, 'description' | 'subagentType' | 'model' | 'name' | 'cwd' | 'parentAgentId'>>;

  /**
   * The input of `agent.spawn`: what is decided about an agent about to start,
   * before its model is resolved.
   *
   * A subagent, a teammate, a workflow agent or a resumed run. A hook rewrites
   * content (prompt, description, subagentType, model, background, cwd) unless
   * `resume` fixes it, or `workflow` all but two; every other key is pinned.
   */
  export type AgentSpawnInput = {
      /**
       * The Agent tool call this spawn belongs to (for `$.ui.notice`). Pinned:
       * the spawn's identity.
       *
       * For a workflow agent, the Workflow tool call that started its run, shared
       * by all of the run's agents and possibly empty on a resumed or
       * server-launched run. Empty for a fork no tool call starts (`/subtask`,
       * say), so `$.ui.notice` has no call to show under.
       */
      tool_use_id: string;
      /**
       * The task the subagent is given: the Agent tool's `prompt` parameter. A
       * rewrite is the prompt the subagent runs with.
       *
       * For a fork no tool call starts, what followed the command.
       * A workflow agent's is a fixed placeholder on a run that keeps its script
       * out of SDK events (Code Review's, say): a hook has not seen the prompt, so
       * a rewrite of it is not applied, and the agent starts with the script's own.
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
       * spawn, and a fork dispatches no other. A teammate's may be a role no
       * definition has, as the call spelled it, or `teammate` when it named none.
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
       * subagent's model; where the session forces one model on every subagent,
       * that outranks a workflow agent's, a hook's included.
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
       * Given to `$.agent.spawn`, it names the agent the spawn is made under: a
       * running or resting agent of this session, a fork included. The spawn acts
       * as that agent's own: `subagentType: "fork"` copies its conversation, prompt,
       * tools and model, and any child is one deeper than it, under `$.agent.list()`
       * `parentId`, stopped with it, in its directory and permission mode, and
       * reports where its children report. It takes no turn and nothing is written
       * to its conversation. The parent may be running or resting, however long ago
       * and in whichever process it ran: a resting one is rebuilt from its record as a
       * resume rebuilds it, and refused where a resume of it would be, with that reason.
       * An id the session can't read or run from answers `{ deny }`, and nothing falls
       * back to main. So does an agent with no readable record, since nothing says what
       * it was; an older record is judged by the fields it carries. Limits a run was
       * under by name are applied again from its record, and one whose limits have no
       * name this build knows, once this process no longer holds them, answers `{ deny }`
       * too. So does an agent at its own first `turn.start`, whose loop holds nothing
       * yet. Left out, the spawn is main's.
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
       * and disabled background tasks force it off. A teammate's is true, as is
       * that of a fork no tool call starts: a rewrite is left out, said once in
       * the plugin's failure line.
       */
      background: boolean;
      /**
       * True for a fork of the parent: it inherits the parent's context and model,
       * and `model` is ignored. Pinned: the spawn's identity.
       *
       * The Agent tool's, or one no tool call starts (`tool_use_id` is empty).
       */
      fork: boolean;
      /**
       * Present, and true, when the call starts a teammate: a named agent of the
       * session's team, which goes idle between turns and wakes on a message.
       *
       * Absent for any other agent. Pinned: the spawn's identity.
       */
      isTeammate?: true;
      /**
       * Present when a workflow script's `agent()` starts the agent, absent for
       * any other. Pinned: the spawn's identity.
       *
       * A rewrite of its `prompt` and `model` applies; `description`,
       * `subagentType`, `background` and `cwd` do not apply to it, and one is left
       * out and said once. A deny is the error the script's `agent()` call throws.
       *
       * `next` settles with the first attempt's `agentId`; a stalled agent's
       * retry is not raised again. With `isolation: 'remote'` (internal builds
       * only) no `turn.complete`, loop event or list row carries that id.
       */
      workflow?: {
          /**
           * The run's id, which starts `wf_` (empty only outside a real run).
           *
           * A child `workflow()`'s agents carry their parent run's, and a resume
           * keeps it; a Workflow call that starts a fresh run gets a new id.
           */
          runId: string;
          /**
           * This agent's place among the run's `agent()` calls, from 1. Agents
           * replayed from the run's journal count but are not raised.
           *
           * The journal knows an agent by what the script asked, before any hook.
           * It restarts whenever the run's script starts over (a new run, a resume
           * or a background hand-off of the same `runId`); a call that reopens a
           * settled run keeps counting. A cap across resumes keeps its own count.
           */
          agentIndex: number;
      };
      /**
       * Present when the run resumes a subagent or brings a teammate back from
       * disk (`isTeammate` beside it), absent for a new agent.
       *
       * A hook can only refuse it; a changed content key is ignored, said once.
       * `prompt` is the resuming message (empty where none is appended). A deny
       * starts no run and ends nothing: a denied wake leaves its agent parked.
       */
      resume?: {
          /**
           * The id the run continues under, as `$.agent.list()` lists it; `next`
           * settles with it. An agent started with no event raised has one too.
           */
          agentId: string;
      };
      /**
       * Given by the call (`Agent({ name })`, addressable by SendMessage);
       * undefined when unnamed. Pinned: the address the parent routes by.
       *
       * A teammate whose name the team has already gets a suffix (`scout-2`),
       * which the answer's `teammateId` and `$.agent.list()` show. A fork no tool
       * call starts is named by the engine, and gets a suffix if another agent
       * took the name while its hooks ran.
       */
      name?: string;
      /**
       * The directory the subagent runs in when the call set one (`cwd`); undefined
       * means the parent's. A rewrite is where the subagent runs.
       *
       * A teammate runs in the session's, and a fork no tool call starts in its
       * parent's: a rewrite is left out, as `background`'s.
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
       * A workflow's remote agent has no local loop, so nothing else carries
       * it. Set by core; a hook that answers without `next` started none.
       */
      agentId?: string;
      /**
       * A started teammate's address in its team, `<name>@<team>`, as
       * `$.agent.list()` gives it; absent for any other agent.
       *
       * Set by core. It joins the list's `teammateId` and the tool's
       * `teammate_id`; every event of the teammate's loop carries `agentId`.
       */
      teammateId?: string;
      deny?: undefined;
  } | {
      /**
       * Refuses the spawn, so nothing starts; the text is the Agent tool's
       * error, the error a workflow script's `agent()` call throws, or the
       * answer of the command that asked for a fork.
       *
       * Returned after a `next(e)` was answered it fails the hook: its
       * `.catch` is asked (a deny from it fails too), or it is skipped by
       * name and its last `next` stands.
       */
      deny: string;
      model?: undefined;
      agentId?: undefined;
      teammateId?: undefined;
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
       * Token count, 100000 to 1000000, at which the agent compacts its own
       * conversation as a subagent. It only lowers the window the agent would
       * otherwise get.
       */
      autoCompactWindow?: number;
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
   * Where an agent's loop stands: `pending` (not started), `running` a turn,
   * `waiting` (held), `idle` (between turns, until a message wakes it), or ended.
   *
   * `waiting` is on background work it owns, on a plan's approval or, in a
   * background subagent, on an Agent call alone. Ended is `completed`, `failed`
   * or `killed` (stopped); a message may yet resume one, under the same id.
   */
  export type AgentStatus = 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed';

  /**
   * What an Agent call that started a teammate answers as `result` at
   * `tool.call`: the started teammate's two ids, its name and its model.
   *
   * The call answers once the teammate started; each of its turns ends in its
   * own `turn.complete`, carrying `agentId` (none here from a terminal pane).
   */
  export type AgentTeammateRecord = {
      status: 'teammate_spawned';
      /**
       * The teammate's one id, as every Agent record spells it: `agent.spawn`'s
       * `agentId`, its loop's events' `agentId`, its `$.agent.list()` `id`.
       *
       * For one in a terminal pane, which runs no loop here, its address. Absent
       * from a record an earlier version wrote, which a resumed transcript holds.
       */
      agentId?: string;
      /**
       * The same id in this record's older spelling, which the classic events
       * share (`classic.SubagentStop`'s `agent_id`).
       */
      agent_id: string;
      /**
       * Its address in its team, `<name>@<team>`: `$.agent.list()`'s
       * `teammateId`, and no event's `agentId`.
       */
      teammate_id: string;
      /**
       * What SendMessage addresses it by: the call's `name`, any `@` replaced,
       * with a suffix (`scout-2`) when the team already has it.
       */
      name: string;
      /**
       * The team it joined: the session's own.
       */
      team_name?: string;
      /**
       * What it was spawned as, when the call named a type.
       */
      agent_type?: string;
      /**
       * What it was started on, an alias resolved, as every Agent record spells
       * it: `agent.spawn`'s `model`.
       *
       * Absent where `agentId` is: `model` has it then, an alias as spelled.
       */
      resolvedModel?: string;
      /**
       * The older spelling of that, an alias left as the call spelled it.
       */
      model?: string;
      /**
       * The task it was given, as an `agent.spawn` hook left it.
       */
      prompt: string;
  };

  /**
   * The hook `on("*", hook)` takes: it runs on every event, plugin nouns no
   * declaration names included, so `e` is `unknown` and `next` is StarNext.
   *
   * Until `next.is(pattern, e)` narrows `e`, all a hook can do with it is pass
   * it on, time it, log it, or fail it; once narrowed it is an ordinary hook on
   * those events, except `engine.create`, where it only observes the fold.
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
   * One content block of an ApiMessage: `type` names its kind (`text`,
   * `tool_use`, `tool_result`, `image`, `document`, `thinking`, ...).
   *
   * The other fields are that kind's as the Messages API defines them (see its
   * reference); the engine hands the block over as it holds it, nothing renamed
   * or dropped.
   */
  type ApiContentBlock = {
      /**
       * The block's kind; the rest of the block is that kind's fields.
       */
      type: string;
      [field: string]: unknown;
  };

  /**
   * One message of the conversation in Messages API form, as
   * `$.session.messages({ as: "api" })` returns it.
   *
   * The messages are the ones the next request is built from, after the
   * engine's normalization (the last compaction's summary in place of what it
   * replaced, reminders as text blocks); at most 4096, opening on a user one
   * with no tool_result unless the newest 4096 hold none.
   */
  type ApiMessage = {
      /**
       * Who wrote it.
       */
      role: 'user' | 'assistant';
      /**
       * Its blocks in order, always an array: text, tool_use and tool_result
       * (paired across an assistant message and the next), image and document.
       *
       * Media inline as the engine holds it, thinking as it goes back. In no
       * message: the system prompt, the tool list, and what one send adds for
       * its model (cache marks, reminders promoted to system turns).
       */
      content: ApiContentBlock[];
  };

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
   * A named value with its initial, as `atom(ref, initial)` makes it: read, it
   * is never `undefined`; while nothing is written it reads as the initial.
   *
   * Plain frozen data, the plugin's own: pass it to `read`, `update`, `derive`
   * and `memberOf`. The engine knows nothing of it.
   */
  export type Atom<T> = {
      readonly ref: StateAddress;
      readonly initial: T;
      /**
       * The tag the value is kept under, when the atom was given one: a stored
       * value under another tag reads as absent (Shaped).
       */
      readonly shape?: string;
  };

  /**
   * `atom(ref, initial)`: a named value with its initial, so a read is never
   * `undefined`; given `{ shape }`, for a key declared `Shaped<T>`.
   *
   * Pure: it builds a frozen description and calls nothing. A family's
   * reference is given without its `id`, which `memberOf` adds.
   *
   * @example
   * const count = atom({ plugin: "counter", key: "count" } as const, 0)
   */
  export type AtomFunction = {
      <P extends keyof PluginState & string, K extends keyof PluginState[P] & string>(ref: StateName<P, K> & Readonly<Pick<StateAddress, 'id'>>, initial: StateValue<P, K>): Atom<StateValue<P, K>>;
      <P extends keyof PluginState & string, K extends keyof PluginState[P] & string>(ref: StateName<P, K> & Readonly<Pick<StateAddress, 'id'>>, initial: ShapedValue<StateValue<P, K>>, options: AtomOptions): Atom<ShapedValue<StateValue<P, K>>>;
  };

  /**
   * The options of `atom`: `shape`, a tag the value is kept under, so a reload
   * of the plugin's code that names another tag finds the value absent.
   *
   * Bump it when the code's idea of the value changed; the engine keeps whole
   * what the old code wrote, and the tag is how the new code declines it.
   */
  export type AtomOptions = {
      shape: string;
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
       * The clip's URL; the engine fetches it (never the plugin), or refuses
       * it as `$.http.fetch` would refuse the same URL.
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
   * The surface applies a hover as the pointer moves and as what is drawn
   * under a resting pointer changes; a reveal that keeps moving what it rests
   * on settles, never loops.
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
      /**
       * Restyles a border the Box has; it adds none.
       */
      borderStyle?: string;
      borderColor?: Color;
      borderDimColor?: boolean;
      backgroundColor?: Color;
      /**
       * `"flex"` alone, on a Box drawn `display: "none"`: with a `scope`, every
       * member of the lit group is revealed, in whichever site it sits.
       *
       * So a pointer on a glyph in the transcript can swap an entry into a fixed
       * row of the band, or reveal an absolutely positioned card.
       */
      display?: 'flex';
      /**
       * Moves a Box drawn `position: "absolute"`, as `left`, `right` and
       * `bottom` do; none of the four moves a Box in the flow.
       */
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
      /**
       * Space between the children, across and down, in cells or a step name.
       * Spacing flows from the parent: set `gap` on the Box rather than a margin
       * on each child. A graphical surface draws `xs` between the Buttons of a
       * row Box with no gap; the terminal draws them as written.
       */
      gap?: Space;
      columnGap?: Space;
      rowGap?: Space;
      width?: number | string;
      height?: number | string;
      minWidth?: number | string;
      minHeight?: number | string;
      margin?: Space;
      marginX?: Space;
      marginY?: Space;
      marginTop?: Space;
      marginBottom?: Space;
      marginLeft?: Space;
      marginRight?: Space;
      padding?: Space;
      paddingX?: Space;
      paddingY?: Space;
      paddingTop?: Space;
      paddingBottom?: Space;
      paddingLeft?: Space;
      paddingRight?: Space;
      borderStyle?: string;
      borderColor?: Color;
      borderDimColor?: boolean;
      backgroundColor?: Color;
      overflow?: 'visible' | 'hidden';
      display?: 'flex' | 'none';
  };

  /**
   * One variant per built-in tool; with none in the table (a plugin author's
   * project with no tools entry laid), one loose variant over every name.
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
   * The engine lays this build's set beside a mod it loads
   * (claude-code-tools/index.d.ts), from each tool's input schema.
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
   * The engine lays this build's set beside a mod it loads
   * (claude-code-tools/index.d.ts), from each tool's output schema; a tool
   * without one is `unknown`.
   *
   * @example
   * interface BuiltinToolResults { Bash: { stdout: string; stderr: string } }
   */
  export interface BuiltinToolResults {
  }

  /**
   * The props of `Button`, every surface's pressable: an address, a label or
   * children, the closure a press runs, and the styles a hover overrides.
   *
   * The terminal draws `[ label ]` (when `plain`, `1: label` or the label
   * alone), a desktop a native button; a click, a `hotkey`, the chord for its
   * `action`, or Enter under the focus raises `ui.press`, its bottom `onPress`.
   */
  export type ButtonProps = {
      /**
       * The element's address: `e.element` at `ui.press`, what a matcher names.
       * Defaults to the `label`, or the one string child.
       *
       * Needed where the Button holds other children and no `label`: a row's
       * text holds what changes (a count, an age), its address must not.
       *
       * Give every Button in a list its own: a surface finds one again by it
       * after a redraw, and cannot tell apart two that share it.
       */
      key?: string;
      /**
       * The text drawn on the button; or the one string child.
       *
       * Children of strings and `Text` (a chip, a dim part) are drawn in its
       * place, one press wherever on them it lands; any other element is refused.
       * The label then names the control; absent, it is the children's text.
       *
       * @example
       * <Button key={id} onPress={open}>{name} <Text dimColor>2m</Text></Button>
       */
      label?: string;
      /**
       * One digit (`"1"`) or one lowercase letter (`"w"`) that presses it while
       * the plugin's site holds the focus; anything else is refused.
       *
       * Its site holds it after ctrl+x tab, a click or `open({ focus })`: the band
       * or its `Pane`; never the composer, save that a bare digit in an empty one
       * answers a band Button (a survey). Shift+w is `"w"`. Two of one plugin on
       * one hotkey: the later wins. Two plugins on one hotkey: it presses neither.
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
       * Which button of several is the main action: `"primary"` is drawn as the
       * surface marks the one to press, `"secondary"`, and absent, as before.
       *
       * The terminal draws a primary `[ label ]` in the accent color, a desktop
       * its own primary button; `dimColor`, `hover`, the focus and the pointer
       * apply to both. `plain` wins: a plain Button draws the same either way.
       *
       * @example <Button variant="primary" onPress={save}>Save</Button>
       */
      variant?: 'primary' | 'secondary';
      /**
       * Marks the Button that closes its site: a drawing hint only. `onPress`
       * still does the dismissing and the press is raised as for any Button.
       *
       * The terminal draws it as without the prop; a desktop draws its native
       * close control at the site's trailing edge, the label its accessible name.
       *
       * @example <Button role="dismiss" onPress={close}>Dismiss</Button>
       */
      role?: 'dismiss';
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
       *
       * Run with the `ui.press` argument as the chain above left it: `e.surface`
       * names the surface the press came from, which a copy passes on.
       *
       * @example
       * onPress: press => $.ui.copy({ text: url, surface: press.surface })
       */
      onPress: (e: UiPressArgument) => void;
  };

  /**
   * The argument of `$.ui.cancelNotify`.
   */
  type CancelNotifyArgs = {
      /** The `key` the plugin gave `$.ui.notify`. */
      key: string;
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
      /**
       * One piece of the child's output (ProcessSpawnChunk).
       */
      'process.spawn': ProcessSpawnChunk;
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
   *
   * Each fires wherever the engine runs the classic hook, whether or not any
   * settings hook is configured, and reaches a `*` or `classic.*` hook as it
   * reaches a named one.
   */
  export type ClassicEventName = `classic.${ClassicHookEvent}`;

  /**
   * The classic (settings) hook events, one per classic event name: `e` is the
   * hook's whole stdin input, base fields (`transcript_path`, `cwd`) included.
   *
   * The chain is [managed settings hooks, ...hooks modules, the other settings
   * hooks as core], so a managed block ends it above every module. In shape
   * `classic.PreToolUse` alone differs: its `e` is ToolCallEnvelope, no more.
   *
   * @remarks A hook that blocks and fails is skipped and the hooks beneath
   *   decide, unless its `.catch` (CatchHandler) answers in its place.
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
   * terminal's (Elements) less `Client`, `Raster`, `Image` and `Progress`.
   *
   * What `$.ui.resolve(e)` is to a hooks module; a Button, Input or Select
   * keeps its handler here. A tree of them keeps every tree's bounds (20,000
   * nodes, 32 deep, 100,000 characters serialized) or the instance unmounts.
   */
  export type ClientElements = Omit<Elements['terminal'], 'Client' | 'Raster' | 'Image' | 'Progress'>;

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
       * At most 100000 characters serialized; not a channel for closures.
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
       * 20,000 values, 32 deep, 100,000 characters, with no named key on a list and
       * no key named `__proto__`, `constructor` or `prototype`, or the post is not sent.
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
   * Text's, free of control characters the same way; the colour
   * on screen is the engine's, never the plugin's.
   */
  export type CodeProps = {
      /**
       * The text drawn: source code, or under `format: 'diff'` one or more
       * unified-diff hunks.
       *
       * Of any length, one drawing drawing 100000 characters in all; tab and
       * newline its only control characters. A diff cut mid-hunk does not parse.
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
       * A hunk is `@@ -a,b +c,d @@` then ` `, `+` or `-` lines; a `---`/`+++`
       * pair and `\ No newline at end of file` are read past. A source that
       * parses as no hunks is drawn as plain code, unnumbered; the log says so.
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
   * What a prop that paints may hold: a theme key, which follows the person's
   * theme, or any other string, a raw color (a name such as `"red"`, or hex).
   *
   * The keys are named so that an editor lists them; every string is
   * admitted. What a surface draws for one it does not know is its own.
   */
  export type Color = ThemeKey | (string & {});

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
       * Whether `text` is for the person alone and `context` is all the model
       * reads: the output row is drawn and kept, and goes in no request.
       *
       * Read on a hook's own answer without `next`, when every plugin hooking the
       * command is bundled with Claude Code, whose answer reads as the built-in
       * command's own, on the queued lanes: a panel answered mid-turn keeps its
       * text in requests. Any other plugin's text stays in requests.
       */
      isTextDisplayOnly?: true;
      /**
       * What the process exits with when this command was the whole prompt of a
       * headless run (`claude -p "/lint"`): a whole number from 0 to 255.
       *
       * Left out, the run exits as it would have; any other value fails the
       * hook. An interactive session ignores it, and core never sets it. The
       * answer the chain ends on decides: a hook above answering its own drops it.
       *
       * @example
       * on("command.run", { command: "lint" }, () => ({ text, exitCode: 3 }))
       */
      exitCode?: number;
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
   * The menu shows a deny's reason; `$.config.set` resolves with it. A deny
   * after a `next(e)` was answered fails the hook: its `.catch` is asked (a
   * deny from it fails too), or it is skipped by name and its last `next` stands.
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
      source: SkillSource;
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
           * The plugin's directory (the one holding `.claude-plugin/plugin.json`),
           * absolute.
           *
           * @example
           * const { version } = JSON.parse(
           *   await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))
           */
          root: string;
      };
      /**
       * Display: a line under an open dialog, a redraw or a repaint, a log line,
       * panes the surface places, a window or ring, a surface's clipboard.
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
           * A redraw: ten a second at most, thirty in the terminal for a shown pane,
           * expanded band and prompt hint (sooner calls fold). A cached answer drops
           * next turn; a changed tool or section text then waits, as
           * `breakPromptCache` on its answer tells.
           *
           * @remarks An ask ends with the process: a resumed thread sends what it
           *   recorded; asked again, a `tool.describe` hook's answer that says
           *   `breakPromptCache` goes over the recorded description where it differs.
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
           * host receives it as `ui_log`; the debug log has it either way, to 10000
           * characters. Raised as `ui.log`: a hook above may rewrite `e.to`.
           *
           * @param text the line's text, of any length: the terminal draws its
           *   first 2000 characters, a remote surface 10000
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
           * Shows `text` for a few seconds under the plugin's name: a small box on
           * the stack of plugin toasts over the transcript's top right corner.
           *
           * A click takes it off, the pointer over it holds it. Where the transcript
           * is printed into scrollback (nothing to float over) it is one line on the
           * notification bar. It leaves the transcript and the model untouched.
           *
           * @remarks While the pane shown was opened `holdToasts`, by any plugin, it
           *   waits undrawn, its timer not started; past 50 waiting, an older leaves.
           * @param text the line to show, its first 2000 characters drawn (10000
           *   remotely); an unpaired surrogate half in it is drawn as U+FFFD
           * @param options `timeoutMs`: how long it stays (default 4000)
           * @example
           * $.ui.toast(`turn took ${Math.round(e.durationMs / 1000)} s`)
           */
          toast: (text: string, options?: ToastOptions) => void;
          /**
           * Raises a native notification of `text` through the person's own
           * notification channel, the one their `preferredNotifChannel` names.
           *
           * Their `Notification` hooks run first, reading `plugin_notification`,
           * then the channel writes. Raised as `ui.notify`; nothing limits how
           * often. With no terminal the hooks run, then a host that raises
           * notifications is handed it; with none, the hooks alone.
           * Unbound or exiting, none.
           *
           * @remarks A hook that notifies is left out of the hooks its own call
           *   runs. Rejects on a hook's `{ deny }`, and on a failed write.
           * @param text the notification's body, of any length. A terminal sends it
           *   as given; a host gets it cleaned and cut to 1,000 characters
           * @param options `title`: what heads it (default: the plugin's name); the
           *   rest only a host acts on (NotifyOptions)
           * @returns `{ isSent: true, channel }`, `client` for a host, or
           *          `{ isSent: false, reason }`:
           *          turned off (`disabled`), `no-channel`, `no-surface`, `refused`
           * @example
           * const sent = await $.ui.notify("tests passed", { title: "CI" })
           */
          notify: (text: string, options?: NotifyOptions) => Promise<UiNotifyResult>;
          /**
           * Takes back one of this plugin's own notifications by its `key`: a host
           * that raises notifications removes it, shown or still booked. The frame
           * names this plugin's source, which keys are scoped by. Await the
           * `$.ui.notify` first: a cancel sent before it is out takes back nothing.
           *
           * @param key the `key` the notification was sent with
           * @returns whether such a host was handed the cancel
           */
          cancelNotify: (key: string) => Promise<{
              isSent: boolean;
          }>;
          /**
           * Pins `text` as this plugin's status line under the prompt, beside the
           * engine's own pinned notices, until the next call replaces it.
           *
           * One per plugin; `undefined` removes it.
           *
           * @param text the line to keep on screen, its first 2000 characters drawn
           *   (10000 remotely); undefined clears it
           * @example
           * $.ui.status("thinking..."); return next(e)
           */
          status: (text: string | undefined) => void;
          /**
           * Opens a pane, a framed region the surface places and this plugin draws
           * by hooking `ui.render` for `{ component: "Pane" }`; says if it is drawn.
           *
           * One per id (an open id retitles; a `ui.open` hook may refuse). Asked,
           * the person's command, prompt or press behind it (not `focus`), it is
           * placed at any width; unasked, from 144 columns, 110 for one once asked.
           *
           * @remarks Below that it waits undrawn (`$.ui.panes()`: `isPlaced` false)
           *   for their open or a wider terminal; with no surface attached, for one.
           *   A pane another plugin holds is refused: the open rejects, naming it.
           * @param pane `id` (1-64 of letters, digits, `_`, `-`), `title`, `focus`,
           *   `closeOnEscape` and `holdToasts` (a dialog), `backgroundColor` (what
           *   is painted under its body), `rows` / `columns` wanted, `placement` (the
           *   seat to start in: `"widget"`, its small form on the desktop app)
           * @returns `{ isPlaced: true }` once drawn (or retitled), else `{ isPlaced:
           *   false, reason }` (UiOpenResult); the seat it got is on `Pane` props
           * @example
           * await $.ui.open({ id: "clock", title: "Clock" })
           * @example
           * await $.ui.open({ id: "ask", focus: true, closeOnEscape: true, rows: 9 })
           * @example
           * const opened = await $.ui.open({ id: "clock" })
           * if (!opened.isPlaced) $.ui.log("clock: " + opened.reason)
           */
          open: (pane: PaneOpenArgs) => Promise<UiOpenResult>;
          /**
           * Closes one of the open panes; an id that is not open is left alone, and
           * a pane another plugin holds is refused.
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
           * Places one row at the transcript's end, which scrolls with the
           * conversation and draws what `ui.render` answers for `Placed`.
           *
           * A hook reads `e.props.id` and `e.props.plugin`. Display only: the model
           * and the transcript file never read it, and `--resume` brings none back. A
           * hook that passes draws nothing; the same id answers the row that stands.
           *
           * @example
           * await $.ui.place({ id: "build" })
           */
          place: (args: UiPlaceArgs) => Promise<UiPlaceResult>;
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
           * Raised as `ui.focus`, origin `plugin`; the engine's inverse marks it.
           * A site not holding the keys, or holding them on another's element, is
           * `{ deny }`; an element not yet drawn is awaited, bounded: no retrying.
           *
           * @param args `requestId` (which site: a pane's id, the band's) and `key`
           *             (the element's, as drawn)
           * @returns `{}` once it moved, or `{ deny }` saying why not
           * @example
           * await $.ui.open({ id: "files", focus: true })
           * await $.ui.focus({ requestId: "files", key: "row:0" })
           */
          focus: (args: UiFocusArgs) => Promise<UiFocusResult>;
          /**
           * Puts `text` on the clipboard of a surface the session draws on, as the
           * DOM's `navigator.clipboard.writeText`, and says whether it took.
           *
           * `surface` names which (a press hook passes `e.surface`); left out, the
           * session's first. Raised as `ui.copy` with that target on `e`. The
           * terminal writes as `/copy` does; a remote surface has no path yet.
           *
           * @param args `text`, what the person pastes; `surface`, where
           * @returns `{ isCopied: true }`, or `{ isCopied: false, reason }`
           * @example
           * onPress: press => $.ui.copy({ text: url, surface: press.surface })
           */
          copy: (args: UiCopyArgs) => Promise<UiCopyResult>;
          /**
           * Returns what the person last selected with the mouse: the text as a
           * copy would take it, and the transcript row it lies in.
           *
           * A key or a click takes the highlight down before a command or a press
           * runs, so the answer stays what the person last selected, until they
           * select again, dismiss it, or their next prompt or command has run.
           *
           * @returns the selection; `undefined` with nothing selected, and where
           *          none is seen: fullscreen off, -p, a surface that answers none
           * @example
           * const selected = await $.ui.selection()
           */
          selection: () => Promise<UiSelection | undefined>;
          /**
           * Puts an agent's transcript in the main view, as the person's own
           * switch from the tasks list does; `{}` goes back to the main one.
           *
           * Only while the call answers the person's own input (a press, a pick,
           * their prompt or command): the viewed agent takes the prompt's next
           * Enter. A site reads the view in force as `e.props.view`.
           *
           * @param view `agentId`: the agent's `id` in `$.agent.list()`; absent for
           *             the main conversation
           * @returns `{}` once the view shows it, or `{ deny }` saying why not
           * @example
           * onPress: () => $.ui.view({ agentId: agent.id })
           * @example
           * onPress: () => $.ui.view({})
           */
          view: (view: SiteView) => Promise<UiViewResult>;
      };
      /**
       * The session's one theme: how the app looks behind and around the
       * conversation. One theme stands at a time, the latest set, whichever plugin
       * set it; there is no stack.
       */
      theme: {
          /**
           * Sets the session's theme from one object of named top-level attributes,
           * the whole theme: what a set leaves out is gone.
           * `backdrop` is a scene, drawn behind the conversation by what `ui.render`
           * answers for `Backdrop`: full window on desktop under its frosted panels,
           * full screen on mobile under one veil (`tint` and `opacity`, not yet
           * `blur`). Or it's a still ground, which a surface draws with no hook: a
           * color, a gradient or a vector. `{ image }` is refused, so redraw a picture
           * as SVG.
           * `colors` is a theme for a surface to paint itself with, where it reads
           * one. With no scene, no `ui.render` hook is asked to draw.
           * Display only: `--resume` brings none back and a plugin that unloads
           * takes its own with it, so set it at `session.start`.
           *
           * @param attributes `backdrop`: a scene, `scene` and `glass` (`blur`, `tint`,
           *   `opacity`) or `false`, or a still ground, see `ThemeGround`;
           *   `overrideColorScheme` (`light` or `dark`); `colors`: a whole palette
           * @returns `{ isDrawn: true, requestId }`, or `isDrawn: false` and why
           * @example
           * await $.theme.set({ backdrop: { scene: "lagoon", glass: { blur: 14, opacity: 0.55 } } })
           */
          set: (attributes: ThemeSetArgs) => Promise<ThemeResult>;
          /**
           * Clears the session's theme, back to the app's own look.
           *
           * IT CLEARS WHATEVER THEME STANDS, WHICHEVER PLUGIN SET IT: there is one
           * theme, so a clear is the session's and not the caller's own. Clear on a
           * person's ask (a command, a button), never at `session.start` or on a
           * reload: a plugin that clears there wipes another plugin's theme each time.
           *
           * @returns `isDrawn: false` and why
           * @example
           * await $.theme.clear() // a preview ends with no theme to go back to
           */
          clear: () => Promise<ThemeResult>;
      };
      /**
       * Completions through the session's own client and credentials.
       */
      model: {
          /**
           * Runs one text completion through the session's own API client and
           * resolves a result: the reply's text and cost, or why there is no text.
           *
           * No tools, no history, no system prompt beyond the CLI's identity block
           * and `request.system`; ModelCompleteRequest says the rest. Only a request
           * the engine refuses to send (a blocked model, a bad cap) rejects.
           *
           * An answered request counts toward the session's cost total, `/cost` and
           * the cost and token metrics, with `query_source` `plugin_model_complete`;
           * a call cut before an answer counts nothing. Nothing caps it per call.
           *
           * @param request the model (an alias such as `haiku`, or a full id
           *                resolved like `--model`), prompt, cap, effort, time limit
           * @param options `signal`: the plugin's own AbortSignal; aborting it
           *   cuts the call while it runs, which then resolves `aborted`
           * @returns the reply (`isAnswered`, `text`, `usage`), else the `reason`:
           *          `api-error` with `status` and `error`, `empty-reply`, `aborted`
           * @example
           * const r = await $.model.complete({ model: "haiku", prompt, effort })
           * @example
           * // one handler starts it, a later one cancels it while it runs
           * let stop = new AbortController()
           * const start = async () => {
           *   stop = new AbortController()
           *   const r = await $.model.complete(ask, { signal: stop.signal })
           *   if (!r.isAnswered && r.reason === "aborted") $.ui.log("cancelled")
           * }
           * const cancel = () => stop.abort()
           */
          complete: (request: ModelCompleteRequest, options?: ModelCompleteOptions) => Promise<ModelCompleteResult>;
          /**
           * Runs one tool-less completion over the session's OWN transcript as the
           * main thread last sent it, so the API serves that prefix from its cache.
           *
           * The main thread's last request again (its model, system prompt, tools,
           * messages) with `prompt` after it: every tool denied, its own tail never
           * cached, the prefix billed afresh once the entry lapsed, after `/model`, or
           * in a cloud session that continues a chat.
           * It thinks as hard as the session does unless `effort` says otherwise;
           * ModelForkRequest says what holds that level and when it costs the cache.
           *
           * @param request the one user message the fork answers, and its effort
           * @returns always a result, never null: the reply (`isAnswered`, `text`,
           *          `usage`, the `effort` sent), or why there is no text (`reason`:
           *          `nothing-to-fork` before the first request and after `/clear`,
           *          `api-error` with its HTTP `status` and `error` kind,
           *          `empty-reply`, or `aborted` when the turn whose hook forked was
           *          interrupted); a request of the wrong shape (no prompt, an
           *          `effort` that is no level) rejects instead
           * @example
           * const reply = await $.model.fork({ prompt: "One line to learn?" })
           * $.ui.log(reply.isAnswered ? reply.text : `no reply: ${reply.reason}`)
           * @example
           * // a quick side job in a session the person runs at max
           * const cut = await $.model.fork({ prompt: "Shorter.", effort: "low" })
           */
          fork: (request: ModelForkRequest) => Promise<ModelForkResult>;
          /**
           * Picks one of `labels` for `text` with one completion over
           * `$.model.complete` and a fixed classifier prompt.
           *
           * `text` is data; the model answers with a label alone. It resolves
           * `undefined` when the answer named none of `labels`. A failed request,
           * an abort or a reply with no text rejects, naming the cause.
           *
           * An answered request counts as `complete`'s does, with `query_source`
           * `plugin_model_classify`.
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
           * `{ asset }` is the plugin's own file; `afplay` plays it on macOS, and a
           * Linux or Windows terminal, having no player, plays nothing. Resolves once
           * played or skipped; rejects, naming the cause, when the clip cannot play.
           *
           * @param clip the plugin's own file (`{ asset }`), a URL the engine
           *   fetches, or the bytes as base64 with their MIME type
           * @param options `shouldLoop`, `gain`, and an AbortSignal that stops the
           *   clip
           * @example
           * await $.audio.play({ asset: "sounds/done.wav" })
           */
          play: (clip: AudioClip, options?: PlayOptions) => Promise<void>;
          /**
           * Speaks `text` with the platform's own synthesizer (`say` on macOS).
           * Plain text.
           *
           * Utterances are queued among themselves; clips are not. Resolves when
           * the utterance has ended; rejects, naming the cause, when there is no
           * synthesizer, the voice is not installed, or the utterance failed, and
           * at once when `signal` aborts.
           *
           * @param text what to say, as plain text
           * @param options `voice`: the system voice's exact name (`Samantha`);
           *   absent, the synthesizer's default. `signal`: skips the utterance or
           *   cuts it off (SpeakOptions)
           * @returns which synthesizer spoke, once the utterance has ended
           */
          speak: (text: string, options?: SpeakOptions) => Promise<SpeakResult>;
      };
      /**
       * The engine's MCP servers: calling a connected one's tools, and
       * connecting one the plugin lists itself or /mcp lists.
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
          /**
           * Connects an MCP server if the session has not already: one this
           * plugin's own manifest lists, by its key, or any server /mcp lists.
           *
           * A server joins the session at its start unless a hook on `mcp.connect`
           * holds it back; this call brings a held one in, the hooks asked with this
           * plugin as `next.origin`, by the session's own enable under its policy.
           * Connected means its tools ride the next request of the turn. A refusal
           * resolves with `reason`, `message`.
           *
           * @remarks A key of the caller's own manifest is read first; the same
           *   server run under another name answers with that name, and is only
           *   read. A listed server that is off, waits on sign-in or failed answers
           *   as it stands: this call never dials, switches or drops one no hook
           *   holds. A key not yet in the session, when another server is listed
           *   under the same name, answers `failed`.
           *   Under `allowManagedHooksOnly` a `user`-tier plugin loads no hooks: its
           *   gate is absent, yet its server connects. Ship it as managed.
           * @param server the server's key in this plugin's manifest, or its name
           *   as /mcp lists it
           * @returns connected, with the name `call` takes, or why not
           * @example
           * const browser = await $.mcp.connect("browser")
           * if (browser.isConnected) $.mcp.call(browser.server, "open", { url })
           */
          connect: (server: string) => Promise<McpConnectResult>;
      };
      /**
       * The running session, read as plain data; compacting it; and sending a
       * message from it to another agent or session.
       */
      session: {
          /**
           * Returns the transcript so far, one SessionMessage per user or assistant
           * message; progress rows, `$.ui.log` lines and notices are not messages.
           *
           * With `{ agentId }`, one of this session's agents' instead (a subagent, a
           * fork, a teammate in this process): what the session saved for it joined
           * with what the engine holds. With `{ as: "api" }`, either as ApiMessage.
           *
           * The more a read returns the more it costs: `last` or `after` cuts it.
           *
           * @param args `agentId`, the id `tool.call`, `turn.complete` and `$.agent
           *             .list()` carry; `as: "api"` for ApiMessage; `last`, how many
           *             of the newest; `after`, a row's `uuid`; hooks see all four
           * @returns the newest 4096 entries, the newest `last`, or the oldest 4096
           *          after `after`: `{ role, text, toolUses }` (a user message may
           *          add `toolResults`; a `toolUses` entry adds `result` and `text`
           *          once answered, an Agent tool use its `agentId`; a ranged read
           *          adds `uuid`), or with `as` `{ role, content }`, blocks intact,
           *          opening on a user message (ApiMessage); for an `agentId` the
           *          session cannot read or an `after` that is gone, `{ deny }`
           * @example
           * const last = (await $.session.messages()).at(-1)
           * @example
           * // `last` seeds the follower; `after` then skips nothing
           * const range = seen === undefined ? { last: 20 } : { after: seen }
           * const fresh = await $.session.messages(range)
           * seen = "deny" in fresh ? undefined : (fresh.at(-1)?.uuid ?? seen)
           * @example
           * const request = await $.session.messages({ as: "api" })
           * await $.http.fetch(AUDIT_URL, {
           *   method: "POST",
           *   body: JSON.stringify({ session: await $.session.id(), request }),
           * })
           * @example
           * on("turn.complete", async ($, e, next) => {
           *   if (e.agentId === undefined) return next(e)
           *   const found = await $.session.messages({ agentId: e.agentId })
           *   if (!("deny" in found)) $.ui.log(`${found.length} messages`)
           *   return next(e)
           * })
           */
          messages: SessionMessagesCall;
          /**
           * Returns the directory the session runs in, absolute.
           *
           * A timer that outlives its hook reads the session's directory; keep the
           * value read inside the hook if you need the hook's (a subagent's own).
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
           * Returns when the session began, and the context window's fill, the
           * rate-limit windows and the cost as the status line has them, itemized.
           * The cost includes every mod's answered `$.model` calls, and is an
           * estimate, not the bill (SessionCost).
           *
           * The plain call costs nothing; `"full"` counts each category with the
           * token-count API as /context does, `"summary"` estimates locally, and
           * `context.breakdown` comes back in the SDK's `get_context_usage` shape.
           *
           * @param args `{ breakdown, columns }`: how the breakdown is counted and
           *   the width its grid is drawn in; nothing for the status line's figures
           * @returns `{ startedAt, context, rateLimits, cost }` as the status line
           *   has them
           * @example
           * const { context } = await $.session.usage()
           * if ((context.percent ?? 0) >= 85) await $.session.compact()
           * @example
           * const isOlder = stat.mtimeMs < (await $.session.usage()).startedAt
           * @example
           * const usage = await $.session.usage({ breakdown: "full", columns })
           * for (const row of usage.context.breakdown?.gridRows ?? []) draw(row)
           */
          usage: (args?: SessionUsageArgs) => Promise<SessionUsage>;
          /**
           * Returns the version of the engine the session runs on, the release it
           * is built from, and when it was built.
           *
           * The same three values the engine's own analytics rows carry, answered
           * in every mode and build; `base` is absent when the version is not
           * spelled as a release, `builtAt` in a run from source that stamps none.
           *
           * @returns the full `version`, its release `base` (`2.1.280`, or
           *          `2.1.280-dev` for a development build) and an ISO `builtAt`
           * @example
           * const { version, base, builtAt } = await $.session.version()
           * row.env = { version, version_base: base, build_time: builtAt }
           * @example
           * const isRelease = !(await $.session.version()).base?.endsWith("-dev")
           */
          version: () => Promise<SessionVersion>;
          /**
           * Returns the session's transcript file, scratchpad, prompt id, agent type
           * and config root (SessionInfo), as they stand at the call.
           *
           * What a settings hook reads on its input, for a plugin that has seen no
           * classic event yet.
           *
           * @example
           * const { transcriptPath } = await $.session.info()
           */
          info: () => Promise<SessionInfo>;
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
           * Sends a plain-text message to another agent or session: the event
           * `session.send`, the model's SendMessage tool's own call and delivery.
           *
           * `to` is the tool's spelling (a name, an agent id, a received `from`
           * address) or `{ sessionId }` / `{ agentId }`; framed at the receiver as a
           * peer's, `origin.plugin` naming this plugin there. Resolves once queued.
           *
           * @example
           * const sent = await $.session.send({ to: { sessionId }, text: "ok" })
           * @example
           * await $.session.send({ to: { agentId }, text: "stop after this file" })
           */
          send: EventCalls['session']['send'];
          /**
           * Appends a row to a conversation of the session: the event
           * `session.append`, the engine's own call for every row it keeps.
           *
           * A row for the model or a notice, of text blocks alone in this release
           * (else refused with the reason; SessionAppendArgs says how each is sent
           * and stored). `{ deny: reason }` when a plugin above refused it.
           *
           * @example
           * await $.session.append({ message: { type: "user", content: [note] } })
           */
          append: (args: SessionAppendArgs) => Promise<SessionAppendResult>;
          /**
           * Holds the session's Anthropic credential on the host and answers an
           * opaque handle and its kind; the secret never reaches the plugin.
           *
           * The handle is spent through `$.http.fetch(url, { auth: handle })`,
           * which sets the credential header, only for a first-party host. Null
           * with no first-party credential (a 3P provider, a gateway, no login).
           *
           * @example
           * await $.http.fetch(url, { auth: (await $.session.authorize())?.handle })
           */
          authorize: () => Promise<SessionAuthorization>;
          /**
           * Returns how the session is signed in, to a mod the organization's
           * managed settings install; `{ deny }` to any other. No request is made.
           *
           * The account (organization, plan, email) only where managed
           * `forceLoginOrgUUID` lists its organization; else `kind` alone. A
           * contract, not a wall: any mod can read the person's own config file.
           *
           * @example
           * const { kind, organizationId, email } = await $.session.identity()
           */
          identity: () => Promise<SessionIdentity>;
      };
      /**
       * The running model turn: ending it.
       */
      turn: {
          /**
           * Cancels the main loop's running model turn (the id its `turn.start`
           * handed this plugin), its running tools stopped, no interruption marker.
           *
           * The event `turn.abort`, seen by the hooks above; the prompt this
           * plugin submits next is the context. Rejects, naming both ids, when
           * `turnId` is not the running turn's; a hook may end its own turn.
           *
           * @param input `turnId`: the id the main loop's `turn.start` carried
           * @example
           * on("turn.start", ($, e, next) => {
           *   if (e.agentId === undefined) held = e.turnId
           *   return next(e)
           * })
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
           * makes for a typed prompt; a turn of its own, once the session is idle.
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
           * Returns one image or document of the prompt being submitted, by the
           * `id` `e.attachments` lists it under: its bytes, base64, 4 MiB a call.
           *
           * For a `prompt.submit` hook; else `{ deny }`, as once the submission
           * has settled. The engine's own read, no event: no hook answers for it.
           * `{ unreadable }`: no image.
           *
           * @example
           * const media = id ? await $.prompt.media({ id }) : undefined
           */
          media: (args: PromptMediaArgs) => Promise<PromptMedia>;
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
           * Sets this plugin's own decorations over the draft and nothing else.
           *
           * No text, caret or undo entry, no `prompt.change` or `prompt.edit`. Hooks
           * may rewrite or `{ deny }` it. `isPainted: false`, the box handed back,
           * when the draft no longer reads `text`, or another plugin hooks its read.
           *
           * @example
           * await $.prompt.paint({ text, decorations: [{ start, end, bold: true }] })
           */
          paint: (input: PromptPaintArgs) => Promise<PromptPainted>;
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
          /**
           * Returns the system prompt's sections for `facts`: the event
           * `prompt.compose`, the call the engine makes for every prompt it sends.
           *
           * A fact left out is the session's own (its model, its tools). Through
           * every other plugin's hook, over the engine's own composition; composed
           * for nobody to send, so nothing the session holds is written.
           *
           * @example
           * const ids = (await $.prompt.compose()).sections.map(s => s.id)
           */
          compose: EventCalls['prompt']['compose'];
      };
      /**
       * The tools the model has in this session, and running one.
       */
      tool: {
          /**
           * Returns the tools the model can call now, built-in and MCP alike, in
           * the order the model sees them, through the `tool.list` hooks.
           *
           * What those hooks answer the engine's own raise is the session's tool
           * pool, for the model and for every agent: see `ToolInfo`. The hooks
           * of the calling plugin are skipped here as on every op, so a tool it
           * adds itself is not in what it reads back.
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
           * see it), the permission check, then the tool. The check opens no dialog
           * and asks no classifier: every ask becomes an allow, whoever raised it,
           * but for a built-in whose dialog is the call itself, such as ExitPlanMode.
           * Deny rules at every level don't cover this call, an organization's
           * managed ones, a connector tool it set to `blocked` and `--disallowedTools`
           * included: they bind the model, whose own calls and whose subagents' stay
           * refused. An organization's controls over mods are `allowManagedModsOnly`,
           * under which a person's mod doesn't load, and what its own mod leaves on `$`.
           * `{ deny }` answers a PreToolUse, `tool.check` or `tool.call` hook (no
           * PermissionRequest hook is consulted on this call), a tool's own refusal, a
           * server's declared deny, a deny a command or a host sets for its turn, a tool
           * held until a person types, the rules guarding Claude Code's own credentials
           * on a call a machine serves, the person's own machine or browser from a cloud
           * session, or the cloud browser under its mode floor. A tool a `--tools` list
           * leaves out isn't there to call, and the call rejects. A `tool.list` hook's
           * removal deletes the tool from the session, for mods too, even one a deny
           * rule or a `blocked` ceiling also hides, so this call can't run it. A deny
           * rule or a ceiling stops only the model and its agents.
           * A hook that re-issues the model's call this way answers for its input:
           * the model's command runs with nobody asked.
           * A script run through the `REPL` tool, where a session has one, is this
           * call too: it runs with no rules, in the VM it shares with the model's
           * scripts, so code the model left there can run the same way. The refusals
           * above hold for it.
           * `$.tool.check` still reports the session's own verdict, so it can say `ask`
           * or `deny` for a call that runs. Rejects when no tool has that name or the
           * call is aborted.
           *
           * @example
           * const { text } = await $.tool.call({ tool: "Read", file_path: "a.md" })
           */
          call: EventCalls['tool']['call'];
          /**
           * Asks the engine's permission decision for a tool call now: the event
           * `tool.check`, resolved to its verdict (`{ decision, reason?, ... }`).
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
           * Serve it with a hook on `{ tool: "mcp__<plugin>__<name>" }` that returns
           * the result: at `tool.run` once the call is allowed, or at `tool.call`,
           * ahead of the permission check. A call no hook answers fails.
           *
           * @remarks A name registered again is replaced. Rejects until the session
           *   binds, at `session.start`.
           *
           * The model reads a description's first 4096 characters (UTF-16 code
           * units), or its first 16384 once it loads the tool through ToolSearch,
           * then a `[truncated]` mark. `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH` in
           * the session's environment replaces both.
           *
           * @param tool `name`, `description` (what the model reads), `inputSchema`
           *             (default `{ type: "object" }`), `isDeferred` (ToolSpec)
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
           * It runs through every hook but the calling one with `e.origin` `{ kind:
           * 'plugin', name }`, its lines in the transcript. Rejects an unknown name,
           * inside a hook the turn or the session's start waits on, past a Stop or
           * a host's limit.
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
       * Analytics: first-party rows and feature marks for Anthropic, and records
       * for the telemetry collector the session's operator configured.
       */
      telemetry: {
          /**
           * Logs one record to the destination `entry.to` names, the event
           * `telemetry.log`; `e.to` is pinned, and `anthropic` when left out.
           *
           * A first-party row is queued by the built-in plugin that hooks the
           * event, for built-ins and the engine alone. A collector record reaches
           * the collector only when the engine raised it; any plugin may hook.
           *
           * @param entry a first-party row, or a collector record
           * @returns once the hooks have answered; rejects when one denies
           * @example
           * await $.telemetry.log({
           *   to: "anthropic",
           *   event: "survey_answered",
           *   props: { answer: 2, page: { value: "ready", of: ["ready", "later"] } },
           * })
           */
          log: (entry: TelemetryLogArgs) => Promise<void>;
          /**
           * Marks one use of a feature as the CLI's own feature events do, the
           * event `telemetry.mark`; it takes no `to` and always means `anthropic`.
           *
           * The engine does nothing with it: the built-in plugins that hook the
           * event queue the row. They serve built-ins and the engine alone; any
           * plugin may hook it.
           *
           * @param entry the feature, how its use went, why, and its properties
           * @returns once the hooks have answered; rejects when one denies
           * @example
           * await $.telemetry.mark({ feature: "learn_page", kind: "sad",
           *   reason: "blocked" })
           */
          mark: (entry: TelemetryMarkInput) => Promise<void>;
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
           * `{ deny }` is a hook's refusal, or the engine's own with its reason:
           * past a Stop or a host's limit nothing is spawned, as for a prompt.
           *
           * The subagent's own events reach every hook, this plugin's and the calling
           * one's too, `next.origin` naming this plugin. A spawn made handling one
           * counts one level deeper, and the engine refuses it past the depth cap;
           * one made at `turn.complete` or `classic.StopFailure`, or by a timer after
           * the hook returned, counts as from no hook, at depth 1. A hook that spawns on an event its subagent
           * also raises leaves those be. An agent's `turn.complete` comes from the
           * engine, so it is told apart by `e.agentId` alone.
           *
           * With `parentAgentId` the spawn is that agent's own child, and a fork of
           * it with `subagentType: "fork"`: see `AgentSpawnInput.parentAgentId`.
           *
           * @example
           * const { agentId } = await $.agent.spawn({ prompt: "Read README.md." })
           * @example
           * // fork a subagent, running or resting: it starts from that agent's
           * // conversation, prompt, tools and model
           * await $.agent.spawn({ prompt: "Try the other fix.", subagentType: "fork",
           *   parentAgentId: e.agentId })
           * @example
           * // the guard: this plugin's own subagents pass; "lab" is the plugin's name
           * if (e.agentId && next.origin.plugin === "lab") return next(e)
           */
          spawn: EventCalls['agent']['spawn'];
          /**
           * Runs a tool as an agent's own call: the event `agent.call`, and beneath
           * it `tool.call` in that agent's loop. `$.tool.call` is unchanged.
           *
           * The call has that agent's tools, folder, mode and rules, and meets the
           * hooks, the dialog and auto mode's classifier as its model's call does
           * (`tool.judge` before the classifier, which reads the agent's conversation
           * so far). What the agent's running turn tightened binds it; what that turn
           * was granted does not carry. Nothing joins the agent's conversation. As a
           * resting agent it starts no background work but an agent.
           *
           * Made outside a hook, it reaches this plugin's hooks too, `next.origin`
           * naming the plugin. `Agent` is that agent's own spawn or fork: in the
           * background it answers at once, `result.agentId` the child's id.
           * `Workflow` is refused, as `$.tool.call` refuses it.
           *
           * @param args `tool`, `input`, and `agentId` (absent: the main conversation)
           * @returns the tool's result, or `{ deny }`: refused by a check, a tool
           *          the agent lacks, or an agent this session cannot run from;
           *          rejects on an `agent.call` hook's deny
           * @example
           * const { text, deny } = await $.agent.call({ tool: "Bash",
           *   input: { command: "git status" }, agentId: e.agentId })
           */
          call: (args: AgentCallArgs) => Promise<OpValueOf['agent.call']>;
          /**
           * Returns the session's agents so far, subagents and teammates: the ones
           * the model spawned and the ones plugins did alike.
           *
           * One entry an agent, until the engine drops its task: as a teammate ends
           * or seconds after, a subagent's later. Loops the engine tracks as agents
           * with no `agent.spawn` (a forked skill) are here; a workflow's are not.
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
       * to say. A read's answer or a write over 4 MiB rejects, the implementation
       * beneath the hooks rejects a network location untouched, an OS refusal with
       * its errno.
       */
      fs: {
          /**
           * Reads a file and returns its text, or with `{ as: "bytes" }` its bytes
           * as `{ base64 }`; with `offset` or `length`, that range of bytes alone.
           *
           * Rejects when missing, or when the answer would be over 4 MiB, which
           * bounds what one read copies into the plugin's environment: read a larger
           * file by ranges. A file the plugin ships is under `$.plugin.root`.
           *
           * A text range that cuts a character gives U+FFFD at that edge; read bytes
           * when that matters. A range reads only a file: on a pipe, a socket, a
           * device or a directory it rejects, and takes nothing from it.
           *
           * @param path relative to the working directory, or absolute
           * @param options `as`: `"text"` (the default) or `"bytes"`; `offset`: bytes
           *                from the start, 0 when left out, empty past the end;
           *                `length`: the most bytes to read, up to 4 MiB
           * @returns the text, or `{ base64 }`
           * @example
           * const readme = await $.fs.read("README.md")
           * @example
           * const { base64 } = await $.fs.read(
           *   `${$.plugin.root}/hooks/weights.bin`, { as: "bytes" })
           * const weights = Uint8Array.fromBase64(base64)
           * @example
           * let seen = 0
           * $.clock.every(1000, async () => {
           *   const { size } = await $.fs.stat("server.log")
           *   const offset = Math.max(size < seen ? 0 : seen, size - 65536)
           *   const added = await $.fs.read(
           *     "server.log", { offset, length: size - offset })
           *   seen = size
           *   if (added !== "") $.ui.log(added)
           * })
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
           * Lists a directory by name: `{ name, kind, size, mtimeMs, isLink }` per
           * entry, each entry as it stands.
           *
           * A symbolic link is `other` with `isLink`; `size` and `mtimeMs` are a
           * regular file's own and 0 for every other kind (`$.fs.stat` has those).
           *
           * @param path the directory's path; absent, the working directory
           * @returns the entries, `{ name, kind, size, mtimeMs, isLink }` each
           * @example
           * const logs = await $.fs.list("logs")
           * const newest = [...logs].sort((a, b) => b.mtimeMs - a.mtimeMs)[0]
           */
          list: (path?: string) => Promise<FsEntry[]>;
          /**
           * Returns whether the path exists; rejects only a network location, which
           * the implementation beneath the hooks never touches.
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
       * Named values held by the host for the session, each with a version: plain
       * data that survives a hot reload of the plugin's code.
       *
       * A `get` made while a `ui.render` hook draws subscribes that instance: a
       * later `set` draws it again, nobody calling `$.ui.invalidate`. Any plugin
       * reads any value; its owner alone writes it. Persist through `$.store`.
       */
      state: {
          /**
           * Resolves the value under `ref` and the version it stands at; a value
           * never written is `undefined` at version 0.
           *
           * Every `get` of one dispatch reads one moment, whatever is written
           * meanwhile. `plugin` and `key` must be literals in source (`claude plugin
           * validate` lists them); only a family member's `id` may be computed.
           *
           * @param ref `{ plugin, key }` as the owner's contract declares it in
           *   PluginState, with `id` for a StateFamily key
           * @returns `{ value, version }`
           * @example
           * const workers = { plugin: "swarm", key: "workers" } as const
           * const { value = [] } = await $.state.get(workers)
           */
          get: <P extends keyof PluginState & string, K extends keyof PluginState[P] & string>(ref: StateRef<P, K>) => Promise<StateRead<StateValue<P, K>>>;
          /**
           * Writes `value` under `ref`, which must be this plugin's own; the sites
           * that read it while drawing are drawn again, at the redraw rate.
           *
           * Refused while a `ui.render` hook draws (write from `onPress` or another
           * event) and for another plugin's value (hook its `state.set` and rewrite
           * `e.value`). JSON data, as `$.store.set` takes; never `undefined`.
           *
           * @param ref `{ plugin, key }`, with `id` for a StateFamily key
           * @param value the value, of the type the contract declares
           * @param options `ifVersion`: write only while it stands at that version
           * @returns `{ isSet, version }`; `isSet` false when `ifVersion` missed
           * @example
           * await $.state.set(count, held.value + 1, { ifVersion: held.version })
           */
          set: <P extends keyof PluginState & string, K extends keyof PluginState[P] & string>(ref: StateRef<P, K>, value: StateValue<P, K>, options?: StateSetOptions) => Promise<StateSetResult>;
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
           * The wait is the hook's own time and its budget runs on through it, as
           * through no other `$` call: a `turn.step` generator that polls with it
           * pays every sleep out of its one budget (`next.budget.remainingMs`).
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
           * http or https, to whatever the host reaches, unless the organization's
           * web-fetch policy refuses it. `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
           * refuses a built-in's request, and any plugin's that carries `auth`.
           *
           * @param url the URL (http or https)
           * @param init `{ method, headers, body, auth, socketPath }` (body a
           *             string; socketPath a Unix socket to go over instead of TCP)
           * @returns `{ status, ok, headers, text }` once the body is read
           * @example
           * const { ok, text } = await $.http.fetch("https://example.com/status")
           * @example
           * // Every model request the engine sends raises this event too, with
           * // `next.origin.plugin` "engine", once per send: after any signing (a
           * // signed request a hook rewrites no longer verifies), above compression
           * // (see `compress`). A hook rewrites the url, method, headers, Authorization
           * // included, and body, answers `{ value }` or refuses with `{ deny }`,
           * // which the caller reads as a 403. A hook that fails is skipped and the
           * // request goes on, so one used as a gate carries a `.catch`. Where the
           * // organization's guard loads, only its own mods see engine requests.
           * //
           * // A header that may hold a credential reads "[redacted]": left in place
           * // it holds its value at the send, on the origin raised and no other, and
           * // a hook writes its own to replace it. A request sent elsewhere is under
           * // the policy `$.http.fetch` is under.
           * on("http.fetch", ($, e, next) =>
           *   next.origin.plugin === "engine" && !allowed(e.url)
           *     ? { deny: "not on the list" }
           *     : next(e),
           * ).catch(() => ({ deny: "the gate failed" }))
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
           * @returns `{ exitCode, stdout, stderr }`, each stream's first 4194304
           *          bytes (`isStdoutTruncated`, `isStderrTruncated` say when cut)
           * @example
           * const { exitCode, stdout } = await $.process.run(["git", "status"])
           */
          run: (argv: readonly string[], init?: ProcessRunInit) => Promise<ProcessRunResult>;
          /**
           * Starts a command on the host by its argument vector (no shell) and
           * streams what it writes, piece by piece, then how it ended.
           *
           * The loop is the child's life: leaving it, `return()` on the stream,
           * `next.signal` aborting or the module unloading kills the child, and
           * nothing else does, a hook's return included: end the loop to end it.
           *
           * @param request `{ argv, cwd, env, input }`, `$.process.run`'s rules;
           *   `e` for a hook on `process.spawn` (a generator, its budget per piece)
           * @returns the pieces `{ stream, text }` (text as it came, not lines),
           *   then `{ code, signal }`; rejects its first pull if it cannot start
           * @example
           * // inline: the hook's dispatch waits on the loop; leaving it kills make
           * const make = $.process.spawn({ argv: ["make"], cwd: "build" })
           * for await (const { stream, text } of make) {
           *   if (stream === "stderr" && text.includes("error")) break
           * }
           * @example
           * // a child for the session's life: the loop runs on after the hook
           * // returns, and ends with the child or with the module
           * on("session.start", async ($, e, next) => {
           *   const started = await next(e)
           *   void (async () => {
           *     const bridge = $.process.spawn({ argv: ["bridge", "watch", e.cwd] })
           *     for await (const { text } of bridge) $.ui.log(text, { to: "debug" })
           *   })()
           *   return started
           * })
           * @example
           * // above another plugin's spawn: redact each piece before it reads it
           * on("process.spawn", async function* ($, e, next) {
           *   for await (const chunk of next(e)) {
           *     yield { ...chunk, text: chunk.text.replaceAll(token, "***") }
           *   }
           * })
           */
          spawn: (request: ProcessSpawnRequest) => HookStream<ProcessSpawnChunk, ProcessSpawnResult>;
          /**
           * Returns the variables that name the session and this plugin, as its
           * command hook gets them, to pass as a child's `env`; `run` and `spawn`
           * set none of them.
           *
           * `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_CHILD_SESSION`,
           * `CLAUDE_CODE_SESSION_ATTENDED`, `CLAUDE_PID`, `CLAUDE_PROJECT_DIR`,
           * `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, and `TRACEPARENT` while a
           * trace is passed on. `CLAUDE_PLUGIN_DATA` is this plugin's data folder,
           * kept across updates: the call makes it, and rejects when it cannot.
           *
           * @example
           * await $.process.run(["./rows.sh"], { env: await $.process.hookEnv() })
           */
          hookEnv: () => Promise<Record<string, string>>;
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
           * Resolves with the settings merged over every source, with one
           * source's settings as loaded (`{ source }`), or with the value of one
           * top-level key (`{ key }`), undefined when the settings hold none.
           *
           * A snapshot in plain data each call; a source with no file answers
           * `{}`. Every read raises `settings.read` once, its layers on `e`
           * (SettingsReadInput); a read of one key is the read of the object,
           * projected, and raises no event of its own.
           *
           * The sources (SettingsSource) rise in precedence from `user` to
           * `policy`; with no hook the object is the engine's merge: a scalar
           * from the last source that has it, lists joined, objects merged.
           *
           * Raised by a plugin's call, and by the engine for its own merge once
           * the loaded plugins or the settings have changed, `next.origin` then
           * the engine. What the hooks answer there is what every reader of the
           * merged settings reads, and a changed answer takes effect as a changed
           * settings file does.
           *
           * No key is closed to a hook, the keys that decide which plugins load
           * included: those are read before any plugin is loaded, so the first set
           * loads by the files' own values and an answer applies from the load
           * after. A merge that never settles, an answer changing which plugins
           * load and those answering otherwise, is told in the settings error
           * list, and the files' own value stands for that key.
           *
           * @param args `{ source }` for one source, `{ key }` for one key's
           *             value, nothing for the merge
           * @returns the settings object, keyed as a settings.json is, or the
           *          key's value
           * @example
           * const { permissions } = await $.settings.read()
           * const policy = await $.settings.read({ source: "policy" })
           * const days = await $.settings.read({ key: "cleanupPeriodDays" })
           */
          read: SettingsReadOverloads;
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
           * @returns `{}` once it is set or unset, or `{ deny }` saying why not
           * @example
           * await $.env.set("GIT_PAGER", "cat")
           */
          set: (name: string, value: string | undefined) => Promise<EnvSetResult>;
      };
      /**
       * WebAssembly, run in the module's own environment, where its hooks run.
       *
       * A module that calls `compile` has a `WebAssembly` global, the standard API
       * less every other way to compile; any other module has none. The engine
       * supplies no imports (no WASI): a module reaches what you hand it.
       */
      wasm: {
          /**
           * Compiles a WebAssembly binary and resolves with its `WebAssembly.Module`,
           * to instantiate with the standard API or hand to emscripten's or
           * wasm-bindgen's glue.
           *
           * `source` is a string literal naming a `.wasm` file of the plugin's own,
           * relative to the calling file as a `Client`'s module is, or bytes made at
           * run time, copied as the call is made. Either may hold 64 MiB. A path
           * that is no literal does not load, and no file is read but those the
           * literals name. `claude plugin validate` lists each with its size,
           * SHA-256, imports and exports; saving one reloads a mod being written.
           *
           * A hook above reads the bytes, replaces them or refuses (WasmCompileInput).
           * Rejects with a `WebAssembly.CompileError` for bytes that are no module;
           * and for a module that defines or imports a shared memory, and on the
           * hosted server, which has no WebAssembly and where the mod still loads.
           *
           * Nothing compiles synchronously, so glue that builds a module as it runs
           * (emscripten's `addFunction`) does not work. Nothing caps memory: set
           * `maximum`. A module, instance, memory or export never leaves for another
           * plugin.
           *
           * An import calls `$` as any function does; one wrapped in
           * `WebAssembly.Suspending`, under an export wrapped in
           * `WebAssembly.promising`, may await it, as the hook that called the export.
           *
           * Nothing stops a loop that stays inside WebAssembly. The session carries
           * on and unloads the mod, but the loop holds a processor core until Claude
           * Code exits. Have long-running code call an import that throws past a
           * deadline: the throw unwinds it.
           *
           * @param source a literal path, or the binary's bytes
           * @returns the compiled module
           * @example
           * const module = await $.wasm.compile("./engine.wasm")
           * const deadline = performance.now() + 2000
           * const { exports } = await WebAssembly.instantiate(module, {
           *   env: {
           *     tick() {
           *       if (performance.now() > deadline) throw new Error("out of time")
           *     },
           *   },
           * })
           */
          compile: (source: string | ArrayBuffer | ArrayBufferView) => Promise<WebAssembly.Module>;
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

  /**
   * One `prompt.attachment` input of a type PromptAttachmentDetailOf names:
   * the attachment's text, and under `detail` the facts it was rendered from.
   *
   * A row the engine made holds them, unless its session keeps no plan file. That
   * one, or one edited by hand, carries no `detail` key: read it as it may be.
   */
  type DeclaredAttachmentInput<K extends keyof PromptAttachmentDetailOf> = {
      /**
       * As the engine names the attachment's kind, one of the names that
       * carry a `detail`; the key a matcher narrows on. Pinned.
       */
      type: K;
      /**
       * What the model reads for this attachment, inside the engine's framing;
       * rewritable with `next({ ...e, text })`.
       *
       * The `<system-reminder>` wrapper (or the system channel that replaces
       * it) goes around what the chain answers, never inside it.
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
       * The loop whose request carries the attachment: a subagent's id, the
       * `id` `$.agent.list()` gives it; absent on main.
       *
       * Pinned: a different value is refused, one left out is kept. A loop
       * forked from another carries the rows made for that one.
       */
      agentId?: string;
      /**
       * Facts of the row the engine computed as it rendered `text`, by `type`:
       * what a hook with words of its own reads in place of the engine's.
       *
       * Pinned: a different value is refused, one left out is kept. Not all
       * the text says: a host's own plan instructions are in `text` alone.
       * Absent on a row that does not hold its facts.
       *
       * @example
       * if (e.detail === undefined) return next(e)
       */
      detail?: PromptAttachmentDetailOf[K];
  };

  /**
   * The state events of each declared value in a union of `[plugin, key]`
   * pairs, one variant per pair (it distributes), so a matcher narrows `e`.
   */
  type DeclaredEvents<Pair> = Pair extends readonly [
  infer P extends keyof PluginState & string,
  infer K
  ] ? K extends keyof PluginState[P] & string ? DeclaredEventsOf<P, K> : never : never;

  /**
   * `e` of `state.get` and of `state.set` for one declared value: its typed
   * reference, and for a write the change, of the declared type.
   */
  type DeclaredEventsOf<P extends keyof PluginState & string, K extends keyof PluginState[P] & string> = {
      get: StateRef<P, K>;
      set: StateRef<P, K> & DeclaredStateChange<P, K>;
  };

  /**
   * Every named value the enabled contracts declare, as one union of
   * `[plugin, key]` pairs; `never` while PluginState is empty.
   */
  type DeclaredPair = {
      [P in keyof PluginState & string]: {
          [K in keyof PluginState[P] & string]: readonly [plugin: P, key: K];
      }[keyof PluginState[P] & string];
  }[keyof PluginState & string];

  /**
   * What a `state.set` on one declared value carries beside its reference:
   * the value being written and the one that stood there, of the declared type.
   */
  type DeclaredStateChange<P extends keyof PluginState & string, K extends keyof PluginState[P] & string> = {
      value: StateValue<P, K>;
      previous: StateValue<P, K> | undefined;
      /**
       * The version the caller's write is conditional on, when it gave one.
       */
      ifVersion?: number;
  };

  /**
   * A value computed from other values, as `derive(sources, fn)` makes it:
   * `read` runs `fn` again only when a source's version moved.
   *
   * It holds nothing on the host: the cache is the plugin's own, lost with a
   * reload of its code, and rebuilt by the next read.
   */
  export type Derived<T> = {
      /**
       * The atoms and references it is computed from, read in this order.
       */
      readonly sources: readonly (Atom<unknown> | StateAddress)[];
      /**
       * The function over the sources' values, in the order they were given.
       */
      readonly compute: (...values: never[]) => T;
  };

  /**
   * `derive(sources, fn)`: a value computed from atoms and references, cached
   * by their versions: `read` runs `fn` again only when one moved.
   *
   * Pure: it builds a description and calls nothing; reading it while drawing
   * subscribes the drawing to every source.
   *
   * @example
   * const busy = derive([workers], list => list.filter(w => w.isBusy).length)
   */
  export type DeriveFunction = <const S extends readonly unknown[], T>(sources: S, compute: (...values: SourceValues<S>) => T) => Derived<T>;

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
   * Each surface's primitive tags and their prop types, by `e.surface`, for
   * the surfaces the plugin was compiled against.
   *
   * A surface declares its own three (jsx, elements, components): an interface,
   * so one not listed here adds its table by declaration merging. With the
   * surface fixed, that table exactly; with none fixed, only what all share.
   *
   * @remarks On a surface unknown at compile time, an element it doesn't know
   *   renders as a fragment. A surface that attaches again replaces all three.
   * @example
   * declare module "claude-code" { interface Elements { slack: SlackTable } }
   */
  export interface Elements {
      /**
       * The terminal's, drawn with Ink: the nine every surface here carries and
       * `Client`.
       *
       * The one surface with `Raster` and `Image`, and the one without `Svg`.
       */
      terminal: {
          Box: ElementConstructor<BoxProps>;
          Text: ElementConstructor<TextProps>;
          Button: ElementConstructor<ButtonProps>;
          Input: ElementConstructor<InputProps>;
          Select: ElementConstructor<SelectProps>;
          Link: ElementConstructor<LinkProps>;
          Code: ElementConstructor<CodeProps>;
          Markdown: ElementConstructor<MarkdownProps>;
          Progress: ElementConstructor<ProgressProps>;
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
      /**
       * Claude Code Desktop's: the nine every surface here carries, `Svg` and
       * `Client`.
       */
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
          Progress: ElementConstructor<ProgressProps>;
          Client: ElementConstructor<ClientProps>;
      };
      /**
       * An app is sent an `Input` or `Select` only if it named it in `draws` on
       * its `ui_attach`, and an empty Box otherwise; a `Progress` the same way, and
       * its Box and Text otherwise. A hook cannot tell which the app got.
       *
       * On a tool row (`ToolUse`) in mobile apps, a `borderStyle` or
       * `backgroundColor` on the Box that holds the row and something else asks for
       * a card under the row;
       * otherwise a tree that keeps the row usually draws as one quiet line under
       * it, with the rest behind a tap, so plain Text suits a small status.
       */
      mobile: {
          Box: ElementConstructor<BoxProps>;
          Text: ElementConstructor<TextProps>;
          Button: ElementConstructor<ButtonProps>;
          Input: ElementConstructor<InputProps>;
          Select: ElementConstructor<SelectProps>;
          Svg: ElementConstructor<SvgProps>;
          Link: ElementConstructor<LinkProps>;
          Code: ElementConstructor<CodeProps>;
          Markdown: ElementConstructor<MarkdownProps>;
          Progress: ElementConstructor<ProgressProps>;
      };
      /**
       * The desktop's table without `Client`: a remote `Client`'s module, presses
       * and posts (ui_client_module, ui_client_press, ui_message) name no surface.
       *
       * They are the desktop's alone until those asks name a surface, no limit of
       * the editor's webview.
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
          Progress: ElementConstructor<ProgressProps>;
      };
  }

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
   *
   * @remarks So a guard fails open unless its registration carries a `.catch`
   *   (Registration) that refuses in its place, at any event an answer refuses.
   */
  export type EngineEventOf = {
      /**
       * Fires when the engine is about to run a tool. Each `next(e)` runs the
       * hooks beneath, then core (the permission prompt, the tool itself).
       *
       * `{ deny: reason }` refuses and `{ result }` answers in place of `next`: a
       * deny after `next(e)` resolved undoes nothing it ran; returning with `next`
       * pending aborts what runs beneath. Managed-settings hooks' deny comes first.
       *
       * @remarks A guard that fails is skipped and the tool runs, so give it
       *   `.catch(($, e, next) => next.called ? next(e) : { deny: "no" })`. A hook
       *   that checks the result refuses in its `.catch` even where `next` was called.
       */
      'tool.call': ToolCallInput;
      /**
       * Fires when the engine decides whether a tool call may run, after the
       * `tool.call` and PreToolUse hooks and before the mode settles an ask.
       *
       * `next(e)` resolves to the engine's verdict (rules, mode, the tool's own
       * check, PreToolUse's decision) and runs no tool: return any `{ decision }`,
       * a deny after it too. `$.tool.check` runs the same chain, executing nothing.
       *
       * @remarks A guard that fails is skipped, leaving the verdict beneath.
       *   Nothing has run, so give it `.catch(() => ({ decision: "deny" }))`.
       * @example
       * on("tool.check", { tool: "Read" }, () => ({ decision: "allow" }))
       */
      'tool.check': ToolCheckInput;
      /**
       * Fires when auto mode is about to ask its classifier about a call, after
       * every rule, hook and check that only a person may answer.
       *
       * `next(e)` asks it, once however often it runs, and runs no tool: the
       * server's verdict where it judged the model's call, else the local
       * classifier's. A call auto mode settles with no classifier raises none.
       *
       * @remarks A hook that fails is skipped and the classifier decides, so give
       *   a guard `.catch(() => ({ decision: "deny" }))`. The classifier's allow is
       *   no proof the call ran: a hook's ask or a change of mode may still hold it.
       * @example
       * // "lab" is this plugin: its own `$.agent.call` of a read needs no classifier
       * on("tool.judge", ($, e, next) => next.origin.plugin === "lab" &&
       *   e.isReadOnly ? { decision: "allow" } : next(e))
       */
      'tool.judge': ToolJudgeInput;
      /**
       * Fires when a call has been allowed and is about to run: after `tool.call`,
       * PreToolUse, `tool.check` and whoever settled an ask; never for a refusal.
       *
       * `e` is the call as allowed, all of it pinned: a rewrite is refused.
       * `next(e)` runs the tool; `{ result, context? }` answers in its place, a
       * success PostToolUse sees; `{ deny }` is the call's error, as a tool's own.
       *
       * @remarks One check, one run: a second `next(e)` starts nothing and
       *   resolves to a `{ deny }`, whatever became of the first. A guard that
       *   fails is skipped and the tool runs, so give it
       *   `.catch(($, e, next) => next.called ? next(e) : { deny: "no" })`.
       *   Where a tool still runs on an aborted turn it fires, `next.signal`
       *   aborted; a turn aborted while a hook holds the call does not run it,
       *   and the call reads as interrupted. Who hears a call is settled ahead
       *   of its permission check: a plugin that loads during the call's ask
       *   misses that call. As at
       *   `tool.call`, a hook that may match a tool, even one that only passes
       *   `next(e)` on, turns off for that tool what would carry its output past
       *   the hook: the move to the background, a served call's live output,
       *   Code Mode's wait for a stopped result. An answer of your own after
       *   `next(e)` drops what the tool sent beside its result (a skill's text
       *   and allowed tools); a limit it set, or a settings hook's stop, stays.
       *   An answer aborts a run it left going, and waits for it to end.
       * @example
       * on("tool.run", { tool: "mcp__lab__ping" }, () => ({ result: "pong" }))
       */
      'tool.run': ToolCallInput;
      /**
       * Fires when the engine is about to draw a component: once per input value
       * (props, viewport width), plugin load or `$.ui.invalidate("ui.render")`.
       *
       * A repaint reuses the answer; a clock invalidates. `next(e)` resolves to the
       * drawing: return it, wrap it, draw your own, or rewrite `props`. An invalid
       * tree, or a throw while drawn, draws the engine's; `--plugin-dir` is told.
       *
       * @remarks Also on a write of `$.state` it read while drawn, at the redraw
       *   rate; an invalidate is any plugin's whose matcher may select it.
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
       * Fires when a `Client` THIS plugin drew failed on a surface: its module
       * did not load, its drawing failed, or its code failed after it had drawn.
       *
       * Only this plugin's hooks see it; `e.phase` says when, `e.reason` why.
       * Observe only: core answers `{}`. The engine then draws that site again,
       * unasked: fall back by leaving the `Client` out.
       *
       * @remarks A `Client` born in that redraw that fails is heard too, and the
       *   engine draws nothing again for it: to go on, ask (`$.ui.invalidate`).
       * @example
       * on("ui.fault", ($, e, next) => ($.ui.log(e.reason), next(e)))
       */
      'ui.fault': UiFaultInput;
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
       * @remarks So give a guard here
       *   `.catch(($, e, next) => next.called ? next(e) : { isOffered: false })`.
       * @example
       * on("agent.offer", { agent: "Plan" }, () => ({ isOffered: false }))
       */
      'agent.offer': AgentOfferInput;
      /**
       * Fires when the Agent tool, or a workflow script's `agent()`
       * (`e.workflow`), is about to start an agent, its model not yet resolved.
       *
       * Also for a fork a command starts with no tool call (`e.fork`, an empty
       * `tool_use_id`): `/subtask`, `/btw`'s fork key, and `/fork` where it starts
       * a subagent. A fork the engine starts by itself, to answer an artifact's
       * comment or a Slack thread, does not raise it.
       *
       * `next(e)` resolves to `{ model }`. Return it, `next({ ...e, model })`,
       * `{ model }` of your own (an alias resolves like the tool's parameter), or
       * `{ deny: reason }`.
       *
       * @remarks A guard that fails is skipped and the subagent starts, so give
       *   it `.catch(($, e, next) => next.called ? next(e) : { deny: "no" })`.
       */
      'agent.spawn': AgentSpawnInput;
      /**
       * Fires when a prompt is submitted, before the turn starts. `next(e)` runs
       * the hooks beneath and the UserPromptSubmit settings hooks, then it enters.
       *
       * Rewrite with `next({ ...e, text })` (the user message on screen follows)
       * or, in its place, stop it with `{ drop: reason }`; a broken plugin never
       * blocks one. Typed while a turn ran, it fires at Enter, with that turn's id.
       *
       * @remarks So a guard that fails lets the prompt through, unless given
       *   `.catch(($, e, next) => next.called ? next(e) : { drop: "no" })`.
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
       * on("prompt.suggest", () => ({ isShown: false }))
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
       * on("prompt.edit", ($, e) => ({ text: e.text, cursor: e.cursor }))
       */
      'prompt.edit': PromptEditInput;
      /**
       * Fires after the main prompt box's text changed and no `prompt.edit`
       * carried it: a recalled history entry, a clear, a plugin's fill.
       *
       * `e` is the box as it stands and `e.origin` who changed it. Observe only:
       * the change is in the box. One per batch of changes, one at a time.
       *
       * @example
       * on("prompt.change", ($, e, next) => ($.ui.status(e.origin.kind), next(e)))
       */
      'prompt.change': PromptChangeInput;
      /**
       * Fires as the person types in the main prompt box, for the token at the
       * cursor; `next(e)` resolves to `{ suggestions }`, rows for the typeahead.
       *
       * Nothing waits on it: the engine's own rows draw first and these join
       * beneath them, unhighlighted, for the word still being typed. Taking one
       * writes its `text` over the token. Only while a plugin hooks it.
       *
       * @example
       * on("prompt.autocomplete", () => ({ suggestions: [{ text: "#123" }] }))
       */
      'prompt.autocomplete': PromptAutocompleteInput;
      /**
       * Fires once per named section of the system prompt, when the engine
       * assembles it; `next(e)` resolves to `{ text }` as core computed it.
       *
       * `e.name` is the section's id, on every model the one `prompt.compose`
       * lists. Cached, so keep it steady: after `$.ui.invalidate("prompt.section")`
       * a changed answer waits for a new thread or a compaction, unless it carries
       * `breakPromptCache: true` (PromptSectionResult). A failed hook passes through.
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
       * answer stands until `$.ui.invalidate("prompt.context")` or a re-read
       * (compaction, `/clear`). `PromptContextResult` says what the model is sent.
       *
       * @example
       * on("prompt.context", () => ({ blocks: [] }))
       */
      'prompt.context': PromptContextInput;
      /**
       * Fires when the engine renders a system prompt; `next(e)` resolves to
       * `{ sections }`, each `{ id, text, scope }`, in the order they are sent.
       *
       * The ids depend on the prompt composed (`lean`, `bare` in `e.traits`): read
       * them off `next(e)`. Append (as `session`), replace, reorder or drop; a list
       * with a `shared` section after a `session` one skips the hook.
       */
      'prompt.compose': PromptComposeInput;
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
       * Fires once per path a prompt names after an `@`, a directory aside,
       * before the engine reads it; `next(e)` reads it and resolves `{ type }`.
       *
       * No `tool.call` is raised for this read. Add `context` to what `next`
       * gave, read another `path` with `next({ ...e, path })`, or answer
       * `{ deny: reason }` so nothing is read.
       *
       * @remarks A guard that fails is skipped and the file is read, so give it
       *   `.catch(($, e, next) => next.called ? next(e) : { deny: "no" })`.
       * @example
       * on("prompt.mention", { path: /\.env$/ }, () => ({ deny: "a secret" }))
       */
      'prompt.mention': PromptMentionInput;
      /**
       * Fires when the engine first renders the tool's schema in a session;
       * `next(e)` resolves to `{ description, isDeferred? }`.
       *
       * An MCP tool behind ToolSearch fires twice: its short text, then the one
       * loaded. Cached until `$.ui.invalidate("tool.describe")`: a changed answer
       * for a tool a thread has sent waits for a new thread or a compaction, unless
       * it carries `breakPromptCache: true` (ToolDescribeResult).
       *
       * @remarks Fires again when an MCP server replaced under the same name brings
       *   another `mcpServer`. A description changed then waits the same way, and
       *   `breakPromptCache` sends it only after `$.ui.invalidate`.
       * @remarks Twice for an MCP tool behind ToolSearch: its short text, then
       *   the one loaded.
       * @remarks An explicit `isDeferred` moves the tool behind ToolSearch (true)
       *   or into the prompt's list (false).
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
       * @remarks A guard that fails is skipped and the command runs, so give it
       *   `.catch(($, e, next) => next.called ? next(e) : { text: "no" })`.
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
       * @remarks A guard that fails is skipped and the row is written, so give
       *   it `.catch(($, e, next) => next.called ? next(e) : { deny: "no" })`.
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
       * Fires when a record is about to be logged to the destination `e.to`
       * names: a built-in's `$.telemetry.log`, or the engine's own events.
       *
       * `e.to` is pinned: a hook rewrites what the record carries, never where
       * it goes. `next(e)` resolves `{ value: undefined }`; `{ deny }` rejects the
       * caller. Beneath the hooks the engine exports its own collector records.
       *
       * @example
       * on("telemetry.log", { to: "collector" }, ($, e, next) => next(e))
       */
      'telemetry.log': TelemetryLogInput;
      /**
       * Fires when one use of a feature is marked (`$.telemetry.mark`), as the
       * CLI's own feature events mark one; always for `anthropic`, no `to`.
       *
       * `next(e)` resolves `{ value: undefined }`; `{ deny }` rejects the caller.
       * The engine does nothing with a mark: the built-ins hooked here do.
       *
       * @example
       * on("telemetry.mark", { kind: "bad" }, ($, e, next) => next(e))
       */
      'telemetry.mark': TelemetryMarkInput;
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
       * Fires when a delivery reaches the session, before it is queued: a relay's
       * event, a peer's message, a Remote Control prompt, room events; `{ text }`.
       *
       * Rewrite with `next({ ...e, text })`, or return `{ consumed: reason }` to
       * take it: nothing is queued, shown or read by the model. `origin`,
       * `event` and `agentId` pass on as received; `session.send` is its dual.
       *
       * @example
       * on("session.receive", { origin: "peer" }, () => ({ consumed: "muted" }))
       */
      'session.receive': SessionReceiveInput;
      /**
       * Fires once per row a conversation of this session keeps (a prompt, a
       * response block, a tool result, a notice), before it is stored.
       *
       * `next({ ...e, message })` rewrites `content`: stored and sent after. The
       * screen, an SDK stream or Remote Control may show the row just before its
       * rewrite; the model and the transcript file never read that form.
       *
       * @example
       * on("session.append", { door: "tool-result" }, ($, e, n) => n(scrub(e)))
       */
      'session.append': SessionAppendInput;
      /**
       * Fires when a plain-text message is about to leave this conversation for
       * another agent or session (the SendMessage tool, or `$.session.send`).
       *
       * `e.origin` says who sends, `e.agentId` which loop. Rewrite `text` or
       * readdress `to` with `next` (a new `to` is judged again); `{ isDelivered:
       * false, reason }` without `next` refuses it. `next(e)` resolves queued.
       *
       * @example
       * on("session.send", ($, e, next) => next({ ...e, text: redact(e.text) }))
       */
      'session.send': SessionSendInput;
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
       *
       * With reason `end` it runs inside `session.end`'s one short bound: there
       * `next.budget` reads that bound and `next.signal` aborts at it.
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
       * `next(e)` runs the engine's end step, `{ sessionId }`; `e.resume.id` is
       * `--resume`'s. Exits stay fast whatever is loaded: the whole chain shares
       * one short wall-clock bound, which `next.budget` reads (SessionEndInput).
       *
       * @example
       * on("session.end", async ($, e, next) => (await save(next.budget), next(e)))
       */
      'session.end': SessionEndInput;
      /**
       * Fires once per hooks module about to join the chain, at load (the set
       * folded and built, nothing swapped in) and at reload; core allows.
       *
       * Return `{ refuse: reason }` and it never joins: no hook, no noun, no tool
       * of it; the debug log names who refused. Its judges, `$` whole, are the
       * plugins admitted before it and the binary's; judge by `tier` and `uses`.
       *
       * @remarks A judge that fails is skipped and the module joins, so give it
       *   `.catch(($, e, next) => next.called ? next(e) : { refuse: "no" })`.
       * @example
       * on("plugin.register", { tier: "user" }, () => ({ refuse: "managed only" }))
       */
      'plugin.register': PluginRegisterInput;
      /**
       * Fires when a model turn begins, main's or a subagent's (`e.agentId`),
       * before its first model call; `next(e)` resolves to `{ turnId }`.
       *
       * Observe: a different return changes nothing. For the main loop alone,
       * return `next(e)` first when `e.agentId !== undefined`. Every hook hears
       * an agent's start, the spawner's too, as at its `turn.step`s, but for the
       * hook whose `$` call ran a skill or command as a fork.
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
       *
       * @remarks Every hook hears an agent's end (`e.agentId`), the spawner's
       *   too; a hook that heard the turn's start hears its end after it.
       */
      'turn.complete': TurnCompleteInput;
      /**
       * Runs while `$` is being built, once per load or reload of this plugin
       * and before any other hook of it; `next(e)` resolves to `$` built so far.
       *
       * A step may ADD nouns and, outside `user`, WITHHOLD them (leave one out, or
       * return without `next`). It fails, and its plugin unloads, when it REPLACES
       * another's; in `user`, also past its own stub, or adding a seated name.
       * Throwing or answering a wrong shape unloads it too, where another event's
       * hook is skipped.
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
       * `{ decision, reason?, rule?, hook?, setting?, plugin?, ceiling? }`.
       */
      'tool.check': ToolCheckResult;
      /**
       * `{ decision, reason?, plugin? }`.
       */
      'tool.judge': ToolJudgeResult;
      /**
       * `{ result, context? }`, `{ deny }`, or core's `{ ref, result }`, read
       * before any PostToolUse hook has had it.
       */
      'tool.run': ToolCallResult;
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
       * `{}`: the fault was heard.
       */
      'ui.fault': UiFaultResult;
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
       * `{ text }`.
       */
      'prompt.change': PromptChangeResult;
      /**
       * `{ suggestions }`, the rows the plugins add to the typeahead.
       */
      'prompt.autocomplete': PromptAutocompleteResult;
      /**
       * `{ text }` (null leaves the section out).
       */
      'prompt.section': PromptSectionResult;
      /**
       * `{ blocks }` (a block left out is not sent).
       */
      'prompt.context': PromptContextResult;
      /**
       * `{ sections }`, every `shared` one ahead of every `session` one (a
       * section left out is not sent).
       */
      'prompt.compose': PromptComposeResult;
      /**
       * `{ text }` (null leaves the attachment out).
       */
      'prompt.attachment': PromptAttachmentResult;
      /**
       * `{ type, context? }` (null when nothing was attached) or `{ deny }`.
       */
      'prompt.mention': PromptMentionResult;
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
       * `{ value: undefined }`, or `{ deny }`.
       */
      'telemetry.log': TelemetryLogResult;
      /**
       * `{ value: undefined }`, or `{ deny }`.
       */
      'telemetry.mark': TelemetryMarkResult;
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
       * `{ message, uuid }`, the row as stored.
       */
      'session.append': SessionAppendResult;
      /**
       * `{ isDelivered: true }`, or `{ isDelivered: false, reason }`.
       */
      'session.send': SessionSendResult;
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
       * The response: `{ turnId, index, answer, toolUses, stopReason, usage }`,
       * and `serverToolUses` when the API ran tools of its own in the request.
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
   * What `$.env.set` resolves to and what an `env.set` hook's `{ value }`
   * holds: `{}` once the variable is set or unset, or why it was not.
   */
  type EnvSetResult = {
      /**
       * Absent when the write was made; else why not, in one line.
       *
       * In a session that takes its settings from its organization, the engine
       * holds a write a plugin that is not built in stands behind where a
       * person's own settings file could not set the variable there.
       *
       * @remarks The engine's hold resolves; a hook's own `{ deny }` rejects the
       *   caller, and one given after `next(e)` was answered fails the hook: deny
       *   in its place. A hook above may answer another `{ value }`: no write.
       */
      deny?: string;
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
          judge: (input: ToolJudgeInput) => Promise<ToolJudgeResult>;
          run: (input: ToolCallInput) => Promise<ToolCallResult>;
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
          mention: (input: PromptMentionInput) => Promise<PromptMentionResult>;
          compose: (input?: PromptComposeArgs) => Promise<PromptComposeResult>;
      };
      skill: {
          prompt: (input: SkillPromptArgs) => Promise<SkillPromptResult>;
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
          append: (input: SessionAppendInput) => Promise<SessionAppendResult>;
          send: (input: SessionSendArgs) => Promise<SessionSendResult>;
          compact: (input?: SessionCompactArgs) => Promise<SessionCompactResult>;
          attach: (input: SessionAttachInput) => Promise<SessionAttachResult>;
          detach: (input: SessionDetachInput) => Promise<SessionDetachResult>;
          measure: (input: SessionMeasureInput) => Promise<SessionMeasureResult>;
          end: (input: SessionEndInput) => Promise<SessionEndResult>;
      };
      telemetry: {
          log: (input: TelemetryLogArgs) => Promise<TelemetryLogResult>;
          mark: (input: TelemetryMarkInput) => Promise<TelemetryMarkResult>;
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
   * A string is kept as typed, so a union that names some strings keeps them.
   */
  export type Frozen<T> = T extends string | ((...args: never[]) => unknown) ? T : T extends readonly unknown[] ? {
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
   *
   * Where a rule or a hold confines the session's reads, a file is found
   * only where every name its path goes by may be read; under a hold a
   * folder above the working directory gives only instruction files of its own.
   */
  export type FsAncestorsRequest = {
      /**
       * Relative `.md` file names, each looked for in every directory.
       */
      names: readonly string[];
      /**
       * The file the walk goes on down to the directory of, relative to the
       * working directory or absolute; absent, it ends at the working directory.
       *
       * Without `below`, a plain name or one under `.claude`, in the working
       * directory or above it, is judged as the engine's start-up load is; any
       * other file by the main session, and with none bound the call rejects.
       */
      of?: string;
      /**
       * The directory the walk starts beneath, relative to the working directory
       * or absolute; absent, the walk starts at the filesystem root.
       *
       * Only directories strictly inside it are read, each file as the main
       * session's rules on reads judge it, as the engine reads a nested
       * CLAUDE.md; a file not inside it finds nothing.
       */
      below?: string;
  };

  /**
   * What `$.fs.read(path, { as: "bytes" })` resolves with: the file's bytes,
   * base64, since only plain data crosses into a plugin's environment.
   */
  export type FsBytes = {
      /**
       * The bytes read, standard padded base64;
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
       * Last modification, milliseconds since the epoch, for a file, as
       * `$.fs.stat` spells it; 0 for a directory, a link or any other kind.
       *
       * The listing reads a regular file's size and time in its one call and
       * looks no other entry up: `$.fs.stat` answers a directory's.
       *
       * @example
       * const newest = [...entries].sort((a, b) => b.mtimeMs - a.mtimeMs)[0]
       */
      mtimeMs: number;
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
      /**
       * Where the read starts, in bytes (FsReadOptions).
       */
      offset?: number;
      /**
       * The most bytes to read, up to 4 MiB (FsReadOptions).
       */
      length?: number;
  };

  /**
   * `$.fs.read`: the file's text, or with `{ as: "bytes" }` its bytes as
   * `{ base64 }`; with `offset` or `length`, that range of it.
   */
  export type FsReadCall = {
      (path: string): Promise<string>;
      (path: string, options: FsReadBytesOptions): Promise<FsBytes>;
      (path: string, options: FsReadTextOptions): Promise<string>;
      (path: string, options: FsReadOptions): Promise<string | FsBytes>;
  };

  /**
   * The options of `$.fs.read`: how it answers, and which bytes of the file.
   */
  export type FsReadOptions = {
      /**
       * `bytes` answers `{ base64 }` for a binary file; `text` (the default) the
       * file's text.
       */
      as?: FsReadAs;
      /**
       * Where the read starts, a whole number of bytes from the file's start.
       * Absent, the start; past the end, the read is empty.
       */
      offset?: number;
      /**
       * The most bytes to read, a whole number up to 4 MiB; fewer come back where
       * the file ends first. Absent, the rest, refused when over 4 MiB.
       */
      length?: number;
      /**
       * Never given: it keeps a string or an array, which has a `length` too, from
       * passing as options.
       */
      [Symbol.iterator]?: never;
  };

  /**
   * The options of `$.fs.read` that ask for the text: the call answers a
   * string, U+FFFD at an edge where the range cuts a character.
   */
  export type FsReadTextOptions = {
      /**
       * `text`, the default.
       */
      as?: 'text';
      /**
       * Where the read starts, in bytes (FsReadOptions).
       */
      offset?: number;
      /**
       * The most bytes to read, up to 4 MiB (FsReadOptions).
       */
      length?: number;
      /**
       * Never given: it keeps a string or an array, which has a `length` too, from
       * passing as options.
       */
      [Symbol.iterator]?: never;
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
   *
   * But a telemetry event, which is hooked by name (`telemetry.log`, or
   * `telemetry.*` for all): `*` does not select one for an installed plugin.
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
   * On `tool.list` a hook's `$` calls hold it for 30 seconds in all, then fail it;
   * on `plugin.register` for 10 seconds, `$.ui.ask` aside: a person answers in their
   * own time.
   *
   * @example
   * await $.model.complete(ask) // a minute; next.budget.remainingMs unmoved
   */
  export type HookBudget = {
      /**
       * A hook's budget per dispatch, from its call to its return; past it the
       * hook is absent (its `.catch` asked, else `next(e)` run on its behalf).
       *
       * A streaming hook's (an async generator) counts only while its own code
       * runs, never at a `yield` or while it reads beneath: on `turn.step` the
       * sum over the response; on `process.spawn` per piece, anew at each pull.
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
   * `throw`: it threw, returned what the site refuses, or its hooks worker
   * ended under it, `message` saying what; `timeout`: it outran its budget,
   * `message` then what its last `next()` rejected with, if it did.
   */
  export type HookFailure = {
      readonly kind: 'throw' | 'timeout';
      /**
       * What was thrown or why the worker ended, or for a timeout what the last
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
   * streaming event (StreamingEventName), `($, e, next) => result` otherwise.
   */
  export type HookOf<E extends EventName> = Events[E];

  /**
   * What a hooks module exports: `register`, and nothing the loader reads
   * besides.
   *
   * Each file of the module is at most 1 MiB, and the entry with every file it
   * imports 8 MiB in all; past either it does not load. Splitting a file across
   * static `import` declarations is the way past the first.
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
   * A request body: text, or bytes that are not valid UTF-8 as `{ base64 }`.
   */
  type HttpBody = string | {
      base64: string;
  };

  /**
   * The encoding the engine gives a request body beneath the hooks.
   */
  type HttpCompress = boolean | 'gzip' | 'deflate' | 'br' | 'zstd' | {
      encoding: 'gzip' | 'deflate' | 'br' | 'zstd';
      level?: number;
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
       * The request body: text, or `{ base64 }` for bytes that are not UTF-8,
       * which only an engine request carries.
       */
      body?: HttpBody;
      /**
       * What the engine does to the body beneath the hooks, on an engine request
       * alone.
       *
       * `body` is the plain body. Delete this and it leaves as written; set this
       * and the engine gzips it. For exact bytes, delete this and write them with
       * your own `content-encoding` header.
       *
       * @example
       * next({ ...e, init: { ...e.init, compress: undefined } })
       */
      compress?: HttpCompress;
      /**
       * The handle `$.session.authorize()` answered: the engine sets the
       * session's credential header itself, only for a first-party host.
       *
       * It rides https only. While `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
       * is set, a request that carries it is refused, whichever plugin asks.
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
       * The body, as text: empty while `isStreaming` is set.
       */
      text: string;
      /**
       * Set on what `next(e)` gives for an engine request: the body stays the
       * engine's, streaming to its reader, and hooks read the status and headers.
       *
       * Pass it on, with other headers or status if you like, and the body goes
       * on under them; answer without it and `text` is the body instead.
       */
      isStreaming?: true;
      /**
       * Set beside `isStreaming`: which of the request's sends gave this answer.
       * Pass it on, and that send's body is the one that goes on.
       */
      sendIndex?: number;
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
   * box of cells where the terminal can (kitty and Ghostty, or iTerm2 3.5 and
   * later for `png` and `rgba` bytes under fullscreen rendering; inside tmux
   * too, for bytes only, with tmux's `allow-passthrough` and `focus-events`
   * on), the `alt` elsewhere.
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
   * An object with the declared keys of `T` and no other: its string and
   * number index signatures are left out. What KnownKeys reads the keys of.
   */
  type IndexFree<T> = {
      [K in keyof T as string extends K ? never : number extends K ? never : K]: 0;
  };

  /**
   * The props of `Input`, every surface's text field: an address, optional
   * texts, and the closures a change and a submit run. A leaf.
   *
   * One line, or with `rows` several. Focused through the same ring as `Button`
   * (`abovePrompt:focus`); while it has focus every printable key reaches it
   * alone and Esc returns them. A change and Enter raise `ui.input`.
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
       * How many lines tall the field is, a whole number of at least 1; from 2
       * it holds several lines, as the DOM's `<textarea rows>`. Defaults to 1.
       *
       * Drawn that tall whatever it holds, its site's window at most; a longer
       * text scrolls within. Enter submits; a newline is typed as in the prompt
       * box. Up and Down walk its rows, then go to the element before or after.
       */
      rows?: number;
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
       *
       * The text is whole, its lines joined by `\n`.
       */
      onInput?: (value: string, e: UiInputArgument) => void;
      /**
       * Runs on Enter with the text, in the plugin's own environment: the bottom
       * of a `ui.input` chain of kind `submit`. No model turn unless it asks one.
       *
       * The text is whole, newlines kept and nothing trimmed.
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
      /**
       * Present where this session's own account could have written the file,
       * or where a person's own plugin added or rewrote a `managed` file.
       *
       * It is then not told as the organization's. The host stamps it; a hook's
       * own value for it is ignored.
       */
      isUnverified?: true;
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
   * What `$.ui.invalidate` takes: a render event, or one of the seven events
   * whose answers the engine caches for the session.
   *
   * For `ui.render`, the instances this plugin's matchers on it may select: one
   * naming no `requestId`, every instance of its component. For a thread resumed
   * in a new process the recorded `prompt.section` text stands, asked or not.
   */
  export type InvalidatableEventName = RenderEventName | 'prompt.section' | 'prompt.context' | 'prompt.attachment' | 'tool.describe' | 'tool.list' | 'command.describe' | 'config.describe';

  /**
   * Whether tag key `K` selects members of `I`: it does when each member gives
   * it ONE literal (`component: "ToolUse"` on the ToolUse variant).
   *
   * A key that is the same union on every member is a filter at runtime; it
   * is left out of the selection so that it cannot defeat the narrowing the
   * other keys give.
   */
  type IsDiscriminant<I, K> = I extends unknown ? K extends KnownKeys<I> ? IsSingleLiteral<I[K & keyof I]> : true : never;

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
   * A function, a class instance, `undefined`, a cycle, a named key on a list or a
   * key named `__proto__`, `constructor` or `prototype` is not plain data; the engine
   * refuses one where it checks, and drops it where it clones.
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
   *
   * A type with an index signature is mapped to be rid of it (IndexFree); any
   * other is read as it stands, which costs nothing per key. A key of these
   * indexes `T` as `T[K & keyof T]`.
   */
  type KnownKeys<T> = keyof (string extends keyof T ? IndexFree<T> : number extends keyof T ? IndexFree<T> : T);

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
   * elements; absent children the `label`, absent both the URL. What `href`
   * spells is the plugin's own; what a click opens is the surface's.
   */
  export type LinkProps = {
      /**
       * Where the link goes, as written: any scheme, host and port; at most
       * 2048 characters once what a terminal acts on is percent-encoded.
       *
       * A blank or no string, and on a remote surface anything but the
       * `https:` URL its wire promises: the text is drawn plain, and said so;
       * the tree stands. A click opens what the terminal, or the surface, opens.
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
       * The markdown drawn, checked as a Text's string is.
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
   * checked the same way. With `onLinkPress` the links it draws are the
   * plugin's to answer: a press on one raises `ui.press` addressed to `key`.
   */
  export type MarkdownProps = {
      /**
       * The element's address: `e.element` at `ui.press`, what a matcher names.
       * Required with `onLinkPress`, since a press needs one; else optional.
       */
      key?: string;
      /**
       * The markdown drawn, as an assistant reply would write it; a `<context>`
       * block, hidden in a reply's own text, is drawn here as written.
       *
       * Of any length (one drawing draws 100000 characters in all), tab and
       * newline its only control characters; a link not `https:`, `http:` or
       * `file:` draws as text. The terminal refuses it by the question dialog.
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
       * of at most 2048 characters, compared with the pressed link's target;
       * none where the drawing has no room left for them.
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
   *
   * Settled by `infer`: while `P` is open the compiler reads them as EventName
   * and selects nothing; a type keyed by them is worked out once, for the `P`
   * a registration gives.
   */
  type MatchedNames<P, M = never> = (P extends EventName ? P : {
      [N in Selected<P & string>]: [M] extends [never] ? N : keyof M extends AnyKeyOf<Args<N>> ? N : never;
  }[Selected<P & string>]) extends infer Names extends EventName ? Names : never;

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
   *
   * `plugin` is a default matcher key: where the engine sets it on `e`
   * (`ui.press`, a band row), a matcher leaving it out is read as naming the
   * hook's own plugin; `"*"` names every one, and hears an `e` without the key.
   * `claude plugin validate` notes such a hook: `(default matcher key: plugin)`;
   * a `component` there keeps the hook off `AbovePromptList`.
   */
  export type Matcher<I, All = I> = I extends unknown ? {
      readonly [K in KnownKeys<I>]?: MatcherValue<I[K & keyof I], MatcherValueOf<All, K>>;
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
   * The matcher type per pattern: a Matcher of the `e` of the event named, or
   * of each event a glob or a negation selects.
   *
   * Settled by `infer`: while `P` is open the bound reads as `unknown`; once
   * `P` is known it is that Matcher exactly. A mistake on a name is refused
   * where it is written; a pattern takes what any event it selects takes.
   */
  type MatcherFor<P extends Pattern> = Matcher<Args<MatchedNames<P>>> extends infer Settled ? Settled : never;

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
   * The type of key `K` across the variants of `I` that declare it, read
   * variant by variant: what MatcherValueOf reads for a key as wide as `symbol`.
   */
  type MatcherValueAcross<I, K> = I extends unknown ? K extends KnownKeys<I> ? I[K & keyof I] : never : never;

  /**
   * The type of key `K` across the variants of `I` that declare it: one read
   * of their table by key (MatcherValues), for a key some variant declares.
   *
   * A key as wide as `symbol` is an index signature's, which the table's own
   * would meet with `never`: it is read variant by variant. While `I` is open
   * the table is left unmade, since the variants of `I` are what it is made of.
   */
  type MatcherValueOf<I, K> = [I] extends [unknown] ? symbol extends K ? MatcherValueAcross<I, K> : MatcherValues<I>[K & PropertyKey] : never;

  /**
   * The type of each declared key of `I` across the variants that declare it,
   * as one table by key: made once per `I`, then read at a key.
   *
   * Each variant gives an entry per key it declares; the entries of one key
   * fall into one property, their values a union. Read at a key some variant
   * declares.
   */
  type MatcherValues<I> = {
      [Entry in I extends unknown ? {
          [K in KnownKeys<I>]-?: [key: K, value: I[K & keyof I]];
      }[KnownKeys<I>] : never as Entry[0]]: Entry[1];
  } & Record<PropertyKey, never>;

  /**
   * Why `$.mcp.connect` left a server unconnected, in one word; `unlisted`
   * too where the session's host runs the plugin's servers itself.
   *
   * `unlisted`: neither in the caller's own manifest nor a server /mcp lists.
   * `unapproved`: a repository server not approved. `disabled`: turned off.
   * `policy`: enterprise MCP policy. `auth`: needs sign-in. `failed`: not
   * resolved, did not connect, or another provider's than its hooks were shown.
   */
  type McpConnectRefusal = 'unlisted' | 'unapproved' | 'disabled' | 'policy' | 'auth' | 'failed';

  /**
   * What `$.mcp.connect` resolves to and what an `mcp.connect` hook's
   * `{ value }` holds: the server connected, or why not.
   *
   * @example
   * const browser = await $.mcp.connect("browser")
   */
  type McpConnectResult = {
      /**
       * True: the server is connected and its tools are the session's.
       */
      isConnected: true;
      /**
       * The name /mcp lists it under and `$.mcp.call` takes: usually
       * `plugin:<plugin>:<server>`.
       *
       * Or the name the session already runs the same server under.
       */
      server: string;
  } | {
      /**
       * False: the server is not connected.
       */
      isConnected: false;
      /**
       * Why, in one word.
       */
      reason: McpConnectRefusal;
      /**
       * The same as one plain sentence, to log or toast.
       */
      message: string;
  };

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
   * McpToolInputs has no entries until a type root's MCP entry declares the
   * connected tools; also the `input` of `$.tool.call({ tool:
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
   * A `.d.ts` in the author's project (the type root's MCP entry, laid from
   * the connected servers' JSON Schemas, or one written by hand) adds entries
   * under `declare module "claude-code"`; `e.tool === <name>` narrows to them.
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
   * `memberOf(family, e)`: the member of a family for the instance being
   * drawn, keyed by `e.requestId`; of an atom over a family, that member's.
   *
   * @example
   * const open = await read($, memberOf(isOpen, e))
   */
  export type MemberOfFunction = {
      <T>(family: Atom<T>, e: Pick<RenderInput, 'requestId'>): Atom<T>;
      <P extends string, K extends string>(family: StateName<P, K>, e: Pick<RenderInput, 'requestId'>): StateName<P, K> & Readonly<Required<Pick<StateAddress, 'id'>>>;
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
   * Which kind of API failure ended a model call (a completion, a fork), in
   * the word Claude Code classifies every API error with (StopFailure's).
   *
   * `rate_limit`, `overloaded` and `server_error` may clear on their own;
   * `authentication_failed`, `billing_error`, `invalid_request`,
   * `model_not_found` will not; `unknown` fits none of the named kinds.
   */
  export type ModelApiError = ClassicHookInputs['StopFailure']['error'];

  /**
   * What a hook on `model.complete` reads as `e`: the request with its text as
   * strings, as it always was, and the caller's blocks beside them.
   *
   * A hook written when `prompt` was only ever a string reads what it read. A
   * caller's list of blocks arrives joined in `prompt` (or `system`) and, as
   * given, in `promptBlocks` (or `systemBlocks`), where its cache marks are.
   *
   * @example
   * on("model.complete", ($, e, next) => (BAD.test(e.prompt) ? NO : next(e)))
   */
  export type ModelCompleteInput = {
      /**
       * Which model answers, as the request named it (ModelCompleteRequest).
       */
      model: string;
      /**
       * The one user message, as text: a string as the caller gave it, or the
       * texts of its blocks joined in order with nothing between them.
       *
       * It is what the model is sent: a hook that passes another string down
       * has rewritten the prompt, whatever `promptBlocks` still says.
       */
      prompt: string;
      /**
       * What precedes the completion as its system prompt, as text joined as
       * `prompt` is; absent when the caller gave none.
       *
       * Passing `null` or `false` down sends none.
       */
      system?: string;
      /**
       * The caller's blocks of `prompt`, as given, when it gave a list: where
       * the cache marks are. Absent for a string.
       *
       * They place marks and change no text. The leading blocks whose texts,
       * joined, still open `prompt` are sent as they stand, marks kept; what is
       * left of `prompt` follows unmarked, so a rewritten opening keeps no mark.
       *
       * @remarks A hook that strips or adds a `cache` here and leaves the texts
       *   is taken at its word; one that rewrites both keeps them in step.
       * @example
       * next({ ...e, prompt: e.prompt + NOTE }) // the marks ahead of NOTE hold
       */
      promptBlocks?: readonly ModelTextBlock[];
      /**
       * The caller's blocks of `system`, read against `system` exactly as
       * `promptBlocks` is against `prompt`. Absent for a string or none.
       */
      systemBlocks?: readonly ModelTextBlock[];
      /**
       * The reply's token cap, as the request gave it.
       */
      maxTokens?: number;
      /**
       * How hard the model thinks about it, as the request gave it.
       */
      effort?: ModelEffort;
      /**
       * How long the whole call may take, in milliseconds, as the request gave
       * it.
       */
      timeoutMs?: number;
  };

  /**
   * Options of `$.model.complete`: what is no part of the request, so no hook
   * on `model.complete` reads it on `e`.
   */
  export type ModelCompleteOptions = {
      /**
       * Aborting it cuts the call while it runs: it resolves `aborted`, as when
       * its dispatch is aborted. Already aborted, no request is made.
       *
       * The plugin's own (`new AbortController()`), kept where a later handler
       * reaches it, so a Cancel button stops a call an earlier press started;
       * it never leaves the plugin's environment, only its firing does.
       *
       * @example
       * const r = await $.model.complete(ask, { signal: stop.signal })
       */
      signal?: AbortSignal;
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
       * The one user message: a string, or blocks of text sent in order
       * (ModelTextBlock), any of which may be marked for the prompt cache.
       *
       * The result always says what happened: the reply's text and usage when
       * the model answered, else a `reason` (an API error with its status, a
       * reply with no text, or the call cut short).
       *
       * @remarks Marks go uncounted: one too many is the API's own `api-error`
       *   (status 400). A hook reads the text joined (ModelCompleteInput).
       * @example
       * await $.model.complete({ model, prompt: [{ text: RULES, cache: true }] })
       */
      prompt: string | readonly ModelTextBlock[];
      /**
       * Precedes the completion as its system prompt, after the CLI's identity
       * block: a string, or blocks of text as `prompt` takes. Default none.
       *
       * @remarks On Bedrock, Vertex, Foundry or behind a gateway, text marked here
       *   is found again only while `prompt` opens the same: mark it there.
       */
      system?: string | readonly ModelTextBlock[];
      /**
       * The reply's token cap: any positive integer up to what one reply can
       * hold, the model's own output limit or 64000, whichever is lower.
       *
       * Default 1024. The reply comes back whole, not streamed, and a provider
       * ends such a request at ten minutes, hence the 64000. One past the limit
       * is refused, naming it.
       */
      maxTokens?: number;
      /**
       * How hard the model thinks about it (ModelEffort): `low` for a cheap
       * label, `max` for a hard judgment. Default: the model's own.
       *
       * Sent as the request's effort where the model takes one and dropped
       * where it does not, as the session's own requests do; a value outside
       * the five levels is refused.
       *
       * @example
       * await $.model.complete({ model: "haiku", prompt, effort: "low" })
       */
      effort?: ModelEffort;
      /**
       * How long the whole call may take, in milliseconds, before it resolves
       * `aborted` and the request is abandoned; default none.
       *
       * A `$` call's time never counts against the calling hook's budget, so this
       * is how a hook bounds the completion itself, by the clock. A positive whole
       * number, held to what a timer holds (2147483647); anything else is refused.
       *
       * @example
       * await $.model.complete({ model: "haiku", prompt, timeoutMs: 8000 })
       */
      timeoutMs?: number;
  };

  /**
   * What one model call resolves to: the reply when the model answered
   * (`isAnswered`), else which of three things left it without text (`reason`).
   *
   * `$.model.complete`'s result whole, and `$.model.fork`'s once it had
   * something to fork. What the provider did never rejects the call, so a
   * plugin branches on `isAnswered` and `reason`; `usage` rides every arm.
   *
   * @example
   * const r = await $.model.complete(ask); if (!r.isAnswered) log(r.reason)
   */
  export type ModelCompleteResult = {
      /**
       * True: the model answered; `text` and `usage` are its reply.
       *
       * @example
       * if (r.isAnswered) spent += r.usage.output_tokens
       */
      isAnswered: true;
      /**
       * The reply's text: a completion's text blocks joined; on a fork, the
       * non-error replies' text joined by newlines.
       */
      text: string;
      /**
       * What the call cost (ModelUsage); on a fork its completions summed.
       *
       * On a fork `cache_read_input_tokens` is how much of the transcript
       * the main thread's prompt cache served: near zero, the fork paid for
       * the whole prefix (the entry lapsed, the model changed since, or its
       * `effort` could not ride its own message: ModelForkRequest).
       */
      usage: ModelUsage;
      /**
       * On a fork, the effort its last response was asked for: what the
       * request's `effort` came to under its limits, or the session's own
       * level when it named none. The level stated after `prompt` where the
       * model takes effort per message, else the request's own setting. A
       * completion's result carries none.
       *
       * Absent too when the fork's request carried no named level: a model
       * that takes none, `CLAUDE_CODE_EFFORT_LEVEL` set to `auto` or `unset`
       * with no `maxEffortLevel` setting, or a fork that ran as if it had named
       * none in a session on a numeric level.
       *
       * @example
       * if (r.isAnswered) $.ui.log(`${r.effort}: ${r.usage.output_tokens}`)
       */
      effort?: ModelEffort;
  } | {
      isAnswered: false;
      /**
       * The API answered with an error and no reply carried text.
       *
       * @example
       * if (!r.isAnswered && r.reason === "api-error") retry(r.status)
       */
      reason: 'api-error';
      /**
       * The error reply's HTTP status (429, 500, 529, ...); null when no
       * response arrived at all (a dropped connection, a provider timeout).
       */
      status: number | null;
      /**
       * Which kind of failure, as Claude Code classifies API errors; never
       * the error's text or body.
       *
       * `rate_limit`, `overloaded`, `invalid_request`,
       * `authentication_failed`, `server_error`, ...; `unknown` when it fits
       * none of the named kinds.
       */
      error: ModelApiError;
      /**
       * What the call cost before it failed: all zeros for a completion (its
       * one request was the one refused); on a fork, the turns before it.
       */
      usage: ModelUsage;
      /**
       * On a fork, the effort of the last response before the error, as on
       * the answered arm; absent when its first request was the one refused.
       */
      effort?: ModelEffort;
  } | {
      isAnswered: false;
      /**
       * The model replied and its reply carried no text.
       *
       * A completion whose content held no text block, or a fork answered
       * with a tool attempt alone (denied, as every fork tool is) or nothing.
       *
       * @example
       * if (!r.isAnswered && r.reason === "empty-reply") $.ui.log("no words")
       */
      reason: 'empty-reply';
      /**
       * What the call cost.
       */
      usage: ModelUsage;
      /**
       * On a fork, the effort of its last response, as on the answered arm.
       */
      effort?: ModelEffort;
  } | {
      isAnswered: false;
      /**
       * The call was cut before a reply came; whatever had come back is
       * discarded.
       *
       * The dispatch that made the call was aborted while it ran (escape on
       * the turn whose hook called; the plugin's environment unloaded), or a
       * completion's own `options.signal` aborted or `timeoutMs` elapsed.
       *
       * @example
       * if (!r.isAnswered && r.reason === "aborted") return next(e)
       */
      reason: 'aborted';
      /**
       * What the call cost before it was cut: all zeros for a completion (no
       * response arrived); on a fork, what came back before the abort.
       */
      usage: ModelUsage;
      /**
       * On a fork, the effort of the last response that had started, as on
       * the answered arm; absent when none had.
       */
      effort?: ModelEffort;
  };

  /**
   * How hard a request asks the model to think, by the levels the engine and
   * `turn.step` name: `low` to `max`, `xhigh` between `high` and `max`.
   *
   * A model that takes no effort setting is sent none, whatever is asked.
   */
  export type ModelEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

  /**
   * What `$.model.fork` takes.
   */
  export type ModelForkRequest = {
      /**
       * The one user message, appended to the session's own transcript as the
       * main thread last sent it.
       *
       * The result always says what happened: the reply's text and usage when
       * the fork answered, else a `reason` (nothing to fork yet, an API error
       * with its status, a reply with no text, or the turn's abort cut it).
       */
      prompt: string;
      /**
       * How hard the fork thinks about it (ModelEffort): `low` for a quick side
       * job, whatever the person chose for the main work. Default: the level the
       * session runs at, which is the main thread's and no ceiling: a fork may ask
       * for more. Where the model does not take effort per message, a level other
       * than the session's costs a cache write of the whole conversation: see the
       * remarks.
       *
       * Held to what the person and the organization allow: the organization's
       * cap, the `maxEffortLevel` setting and the model's own levels lower what is
       * asked, and a model that takes no effort is sent none. A level that
       * `CLAUDE_CODE_EFFORT_LEVEL` names is a ceiling: a fork may go under it, and
       * one that asks for more runs as if it had named none, as every fork does
       * where that variable is `auto` or `unset` (the session then sends no effort,
       * or under a `maxEffortLevel` setting the model's default). The result's
       * `effort` is what was sent. A value outside the five levels rejects the
       * call. The main thread keeps its own level, and its next request and its
       * cache entry are as after any fork.
       *
       * @remarks What a level other than the main thread's costs turns on how
       *   the model takes effort. Per message: the level is stated after
       *   `prompt`, everything before it stands as the main thread sent it, and
       *   the cached transcript is read as for any fork. As one setting of the
       *   whole request (a model or provider with no per-message effort, a
       *   conversation whose per-message effort the API refused, a session on a
       *   numeric level): the level is applied all the same, but the first fork
       *   at it reads at most the system prompt and tools from the cache and
       *   writes the whole conversation again as an entry of its own, billed as
       *   `usage.cache_creation_input_tokens` and waited for, the longer the
       *   conversation the longer; later forks at that level read that entry
       *   while it lives. The main thread's entry stands. There are two ways
       *   round that cost. The person can have the session's model take effort per
       *   message, with `CLAUDE_CODE_MODEL_CAPABILITIES=per_turn_effort` in their
       *   shell or in the `env` of their user or managed settings: first-party API
       *   only, and until the API refuses it. Or the fork can name no effort and
       *   ask for haste in `prompt` (that it has no tools, and should answer
       *   straight away without thinking it over), which moves nothing ahead of
       *   `prompt`, so the cache is read on every model.
       * @example
       * await $.model.fork({ prompt: "Say that again, shorter.", effort: "low" })
       */
      effort?: ModelEffort;
  };

  /**
   * What `$.model.fork` resolves to: a completion's result (ModelCompleteResult)
   * or that there was nothing to fork yet.
   *
   * The completion's arms are the reply when the fork answered, else
   * `api-error`, `empty-reply` or `aborted`, `usage` on each and beside it,
   * once a response came back at a named level, the `effort` it ran at.
   *
   * @example
   * const r = await $.model.fork({ prompt }); if (!r.isAnswered) log(r.reason)
   */
  export type ModelForkResult = ModelCompleteResult | {
      isAnswered: false;
      /**
       * Nothing to fork, so no request was made: the session holds no
       * snapshot of this conversation's main thread that a fork may share.
       *
       * Until a turn has run to its end, that is while none of its requests
       * is out, and on a host that keeps none; again after a `/clear`, or a
       * resume that starts the conversation afresh.
       *
       * @example
       * if (!r.isAnswered && r.reason === "nothing-to-fork") return next(e)
       */
      reason: 'nothing-to-fork';
  };

  /**
   * One block of text in a `$.model.complete` request's `prompt` or `system`:
   * sent as written, in the order given, and markable for the prompt cache.
   *
   * Put the text every call repeats first and mark its last block (`cache`);
   * whatever follows the last mark is paid for whole on every call.
   *
   * @example
   * const prompt = [{ text: RULES, cache: true }, { text: diff }]
   */
  export type ModelTextBlock = {
      /**
       * The block's text, sent as written; an empty one is the API's to
       * refuse, as an `api-error` of status 400.
       */
      text: string;
      /**
       * Keeps the request up to and including this block in the prompt cache; a
       * call within five minutes that opens with the same text reads it there.
       *
       * The result's `usage` shows it: `cache_creation_input_tokens` when the
       * call wrote, `cache_read_input_tokens` when it read. Both zero, nothing
       * was cached: text under the model's minimum, or caching switched off.
       *
       * @remarks On Bedrock, Vertex, Foundry or behind a gateway the text is found
       *   again only while `prompt` opens the same way: put the fixed text first.
       */
      cache?: true;
  };

  /**
   * What one model call cost, as the API counted it: the four token counts in
   * the API's spelling, summed over the call's responses when it made several.
   *
   * The one shape every place that reports a call's cost uses:
   * `$.model.complete`'s result on every arm and `$.model.fork`'s on each arm
   * where a request was made (ModelCompleteResult), `session.compact`'s result
   * when core ran the summarizer, `turn.step` and `turn.complete` (TurnUsage,
   * which adds the `model` that answered), and the context breakdown's
   * `apiUsage` (the live window's last response). All four counts are always
   * present; a count the response left out reads as zero.
   *
   * These are token counts: dollars a mod works out from them are an estimate
   * too, not the bill (SessionCost).
   *
   * @example
   * const r = await $.model.complete(ask); if (r.isAnswered) spend(r.usage)
   */
  export type ModelUsage = {
      /**
       * Uncached input tokens the call was answered over: the part of the
       * prompt neither read from nor written to the prompt cache.
       */
      input_tokens: number;
      /**
       * Tokens the call generated.
       */
      output_tokens: number;
      /**
       * Input tokens the prompt cache served.
       *
       * On a fork, how much of the main thread's transcript the cache still
       * held: near zero, the fork paid for the whole prefix (the entry had
       * lapsed, the model changed since it was made, or the fork's `effort`
       * could not ride its own message: ModelForkRequest).
       */
      cache_read_input_tokens: number;
      /**
       * Input tokens the call wrote to the prompt cache.
       */
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
   * key's optionality, stays as declared, as does `plugin` under `"*"`: a default
   * matcher key's wildcard says nothing of the value.
   */
  type NarrowedMember<E, P, D extends readonly unknown[]> = [
  ImpossibleKeys<E, P, D>
  ] extends [never] ? {
      [K in keyof E]: K extends keyof P ? K extends 'plugin' ? P[K] extends '*' ? E[K] : NarrowedValue<E[K], P[K], D> : NarrowedValue<E[K], P[K], D> : E[K];
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
   *
   * It names no event, so like `*` it selects no telemetry event for an
   * installed plugin: those are hooked by name.
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
       * A managed hook's: prepend may name user, append, builtin or core, append
       * core; it never skips a tier with more authority, so no user hook skips
       * the org's. `user` skips each prepend peer below the hook, never one
       * above it, and an outer `next.to` to a deeper tier still wins. A literal
       * on the hook's own `next`; skipped links are traced.
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
       * in a `.catch` handler it is the grace, `ms` being `next.error.budget`;
       * at `session.end` it reads the exit's one short bound, which never stops.
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
   * (what `next.error.budget` names); on a `next` nothing meters (the engine's
   * own, a test's root one) `ms` is 0 and `remainingMs` Infinity.
   *
   * @example
   * if (next.budget.remainingMs < 2_000) return next(e) // skip the slow path
   */
  export type NextBudget = {
      /**
       * The whole budget in milliseconds; 0 where nothing meters this `next`.
       *
       * On a dispatch the engine cuts short as a whole (`session.end`: one short
       * wall-clock bound for the entire chain, so an exit stays fast whatever is
       * loaded) it is no more than that cut left when the hook started, 0 past it.
       */
      readonly ms: number;
      /**
       * What is left of it now, in milliseconds, never below 0; Infinity where
       * nothing meters. It stands still while a `next` or `$` call is in flight.
       *
       * Except under a cut of the whole dispatch (`session.end`): the cut's clock
       * never stops, `$` waits included, and this reads no more than it leaves,
       * so a later hook in that chain starts with what the earlier ones left.
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
   * and `tool.run` the result typed for that tool; else `O` as declared.
   *
   * `result` is Bash's record after `e.tool === "Bash"`; an un-narrowed `e`
   * names every tool, and `result` stays `unknown`.
   */
  export type NextResultFor<N extends EventName, O, T extends string> = [
  N
  ] extends ['tool.call' | 'tool.run'] ? ToolCallResult<T> : O;

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
   * Options of `$.ui.notify`.
   */
  export type NotifyOptions = {
      /**
       * What heads the notification, sent as the mod gives it: the engine puts
       * no name of its own beside it. Left out or empty, the plugin's name.
       */
      title?: string;
      /**
       * A name for this notification, unique within the plugin. Sent again, it
       * replaces the one a client holds under that key; `$.ui.cancelNotify` takes
       * it back. A terminal has nothing to replace and ignores it.
       */
      key?: string;
      /**
       * Milliseconds a client holds it before raising it, so it can fire with the
       * session out of reach. More than 7 days rejects the call on every surface.
       * A terminal otherwise ignores it and raises it now.
       */
      delayMs?: number;
      /**
       * The time a client raises it, in epoch milliseconds, for a moment fixed on
       * the clock. Never beside `delayMs`. More than 7 days ahead rejects the call
       * on every surface. A terminal otherwise ignores it and raises it now.
       */
      at?: number;
      /**
       * With `delayMs` or `at`: a client throws it away if the person returns to
       * the session before it fires, so it can only speak to someone who left.
       */
      untilBack?: boolean;
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
   * A name this build does not know, or a glob that selects no event, refuses
   * the whole module. To span versions, state an `engines["claude-code"]` range
   * in plugin.json (honoured from 2.1.323; install and update pick the newest
   * version that fits, up to five `<name>--v<version>` tags back), or hook a
   * glob such as `prompt.*` and test `next.event`. A call on `$` this build
   * lacks loads, and throws a TypeError where it is made: a try/catch takes it.
   *
   * @see HookBudget the time each hook has per dispatch (its own time: waits
   * on `next` and `$` are free), read live from `next.budget`
   */
  export type On = {
      <P extends Pattern>(pattern: P, hook: NoInfer<HookFor<P>>): Registration<HookFor<P>>;
      <P extends Pattern, const M extends MatcherFor<P>>(pattern: P, matcher: M, hook: NoInfer<MatchedHook<P, M>>): Registration<MatchedHook<P, M>>;
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
      readonly [K in Exclude<MatcherKeys<All>, keyof IndexFree<I>>]?: MatcherValue<MatcherValueOf<All, K>>;
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
   *
   * @remarks A guard that fails is skipped and the call goes on, unless its
   *   `.catch` (CatchHandler) answers `{ deny }` in its place.
   */
  export type OpEventOf = {
      /**
       * The argument of `$.model.complete(request, { signal })`, its text as
       * strings and its blocks beside them (ModelCompleteInput).
       *
       * The signal does not cross, it aborts the call.
       */
      'model.complete': ModelCompleteInput;
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
       * The argument of `$.audio.speak(text, { voice, signal })`; the signal
       * does not cross, it aborts the call.
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
       * The argument of `$.mcp.connect(server)`, `next.origin` the calling
       * plugin; also raised by the engine, for each server it is about to join by
       * itself, `next.origin` the engine's.
       *
       * A hook on the engine's raise that answers without calling `next` holds
       * the server back: nothing is dialed, and `/mcp` lists it as held by that
       * hook's plugin until `$.mcp.connect` or a later raise lets it through.
       * There `next` answers once the hooks beneath pass, and the dial follows.
       *
       * @remarks Headless plugin install, sync and reload raise nothing: a server
       *   they bring in first dials with no hook asked, and one held before stays
       *   held. Nor is it raised for the dial `$.mcp.connect` itself starts.
       */
      'mcp.connect': {
          /**
           * The server as `$.mcp.connect(server)` spelled it, a key of the caller's
           * manifest or a name /mcp lists; on the engine's raise the name /mcp lists
           * it under, usually `plugin:<plugin>:<server>`. Pinned: a rewrite is refused.
           */
          server: string;
          /**
           * Who provides the server, as at `tool.describe`: the plugin and its tier,
           * or `mcp:<server>` for one that settings configure; the caller for its
           * own key. Pinned: a rewrite is refused, and a `$.mcp.connect` that then
           * resolves to another provider's server answers `failed`.
           */
          provider: Origin;
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
       * The argument of `$.session.messages(args)`: `{}` for the main
       * conversation, `{ agentId }` for one of its agents, `as` for the form.
       *
       * `last` or `after` for part of it.
       */
      'session.messages': SessionMessagesArgs;
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
       * The argument of `$.session.identity()`.
       */
      'session.identity': NoArgs;
      /**
       * The argument of `$.session.usage({ breakdown, columns })`.
       */
      'session.usage': SessionUsageArgs;
      /**
       * The argument of `$.session.version()`.
       */
      'session.version': NoArgs;
      /**
       * The argument of `$.session.info()`.
       */
      'session.info': NoArgs;
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
       * The argument of `$.prompt.paint(...)`: the draft and this plugin's runs.
       */
      'prompt.paint': PromptPaintArgs;
      /**
       * The argument of `$.tool.list()`, and of the engine's own raise of its
       * tools: what the hooks answer that raise is the session's tool pool
       * (`ToolInfo`).
       */
      'tool.list': NoArgs;
      /**
       * The argument of `$.tool.register(spec)`.
       */
      'tool.register': RegisteredToolSpec;
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
       * The argument of `$.agent.call(args)`. A hook above may rewrite the tool
       * and its input, and the call is then no longer its caller's own at
       * `tool.judge`; `agentId` is pinned.
       */
      'agent.call': AgentCallArgs;
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
       * The argument of `$.ui.place({ id })`.
       */
      'ui.place': UiPlaceArgs;
      /**
       * The argument of `$.theme.set(attributes)`: the attributes themselves.
       */
      'theme.set': ThemeSetArgs;
      /**
       * The argument of `$.theme.clear()`.
       */
      'theme.clear': NoArgs;
      /**
       * The argument of `$.ui.selection()`.
       */
      'ui.selection': NoArgs;
      /**
       * The argument of `$.ui.copy({ text, surface })`, `surface` filled with
       * the session's first when left out; rewritable, deniable, answerable.
       */
      'ui.copy': UiCopyArgs;
      /**
       * The argument of `$.ui.view({ agentId })`: whose transcript the main view
       * is to show, none for the main conversation; rewritable and deniable.
       */
      'ui.view': SiteView;
      /**
       * The argument of `$.ui.notify(text, { title, key, delayMs, at, untilBack })`,
       * `title` the plugin's name when left out or empty; rewritable, deniable,
       * answerable. A rewrite by another plugin's hook is marked, so a client can
       * show that it may not be as the sender wrote it.
       *
       * A notification is heard twice: here, and by `classic.Notification`
       * hooks. Two mods that each notify again from a timer on hearing one
       * echo each other without end: nothing in the engine stops them.
       */
      'ui.notify': {
          text: string;
          title?: string;
          key?: string;
          delayMs?: number;
          at?: number;
          untilBack?: boolean;
      };
      /**
       * The argument of `$.ui.cancelNotify(key)`: the key of the plugin's own
       * notification to take back; rewritable, deniable, answerable, like
       * `ui.notify`. Only a client's surface holds one to take.
       */
      'ui.cancelNotify': CancelNotifyArgs;
      /**
       * The argument of `$.ui.blit(...)`: a Raster's `cells` or a keyed Image's
       * `source`; a hook above may rewrite either with `next`, or `{ deny }`.
       */
      'ui.blit': UiBlitArgs;
      /**
       * The argument of `$.fs.read(path, { as, offset, length })`: `as` is `text`
       * unless the caller asked for `bytes`; a range's keys only when given.
       *
       * A hook that answers in the host's place cuts its answer to the range.
       */
      'fs.read': {
          path: string;
          as: FsReadAs;
          offset?: number;
          length?: number;
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
       * The argument of `$.state.get(ref)`: the reference itself, `plugin`, `key`
       * and a family member's `id`; identity, pinned.
       */
      'state.get': StateGetEvent;
      /**
       * The argument of `$.state.set(ref, value, { ifVersion })`: the reference,
       * the value, the condition, and `previous`, what stood there (the host's).
       *
       * A hook above rewrites `value` with `next({ ...e, value })`; the
       * reference is identity, pinned. Raised by the value's owner alone. A
       * `{ deny }` after `next(e)` was answered, a `.catch`'s too, fails the hook.
       */
      'state.set': StateSetEvent;
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
       * The argument of `$.process.spawn(request)`: the request itself.
       *
       * A hook's `{ deny }` rejects the caller's stream and lets the child go
       * (one still running is killed). Once a child of the call handed up a
       * piece or its exit, the rejection says it started or ran.
       */
      'process.spawn': ProcessSpawnRequest;
      /**
       * The argument of `$.process.hookEnv()`.
       */
      'process.hookEnv': NoArgs;
      /**
       * The argument of `$.settings.read({ source })`, and the layers the read
       * is made of, which the engine fills; rewritable, deniable.
       */
      'settings.read': SettingsReadInput;
      /**
       * The argument of `$.env.get(name)`; `name` is identity, pinned.
       */
      'env.get': {
          name: string;
      };
      /**
       * The argument of `$.env.set(name, value)`; `name` is identity, pinned,
       * and no `value` unsets.
       *
       * A `{ deny }` after `next(e)` was answered, a `.catch`'s too, fails the
       * hook: deny in its place.
       */
      'env.set': {
          name: string;
          value?: string;
      };
      /**
       * The bytes `$.wasm.compile(source)` is about to compile, and the file
       * they were read from; `path` is identity, pinned.
       *
       * A hook replaces them going down (`next({ ...e, base64 })`), coming back
       * or by answering alone (`{ value: { base64 } }`), or refuses (`{ deny }`).
       */
      'wasm.compile': WasmCompileInput;
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
      'model.complete': ModelCompleteResult;
      'model.classify': string | undefined;
      'model.fork': ModelForkResult;
      'audio.play': void;
      'audio.speak': SpeakResult;
      'mcp.call': McpToolResult;
      'mcp.connect': McpConnectResult;
      'session.cwd': string;
      'session.root': string;
      'session.model': string;
      'session.turns': number;
      'session.id': string;
      /**
       * The conversation's messages, as rows or in Messages API form; `{ deny }`
       * for an `agentId` the session cannot read or an `after` that is gone.
       */
      'session.messages': SessionMessagesValue;
      'session.repo': SessionRepo | null;
      'session.surface': RenderSurface | null;
      'session.surfaces': readonly RenderSurface[];
      /**
       * The credential handle, or null where the session holds no first-party
       * credential (a third-party provider, a cloud gateway, no login or key).
       */
      'session.authorize': SessionAuthorization;
      /**
       * How the session is signed in and, under a pin of its organization, as
       * whom, for a plugin managed settings install; the refusal for any other.
       */
      'session.identity': SessionIdentity;
      'session.usage': SessionUsage;
      /**
       * The engine's version, its release, and its build time when stamped.
       */
      'session.version': SessionVersion;
      'session.info': SessionInfo;
      'turn.abort': void;
      /**
       * The box as it stands; the empty box where the session draws none.
       */
      'prompt.read': PromptBox;
      /**
       * Whether the runs were painted, and the box as it stands.
       */
      'prompt.paint': PromptPainted;
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
      'agent.call': ToolCallResult;
      'ui.toast': void;
      'ui.status': void;
      'ui.log': void;
      'ui.notice': void;
      'ui.invalidate': void;
      /**
       * Whether a surface draws the pane now, or why it waits undrawn.
       */
      'ui.open': UiOpenResult;
      'ui.close': void;
      /**
       * The calling plugin's open panes, placed then unplaced, in open order.
       */
      'ui.panes': readonly UiPane[];
      /**
       * The row's id, or why nothing draws it.
       */
      'ui.place': UiPlaceResult;
      /**
       * Its request id, or why nothing draws it.
       */
      'theme.set': ThemeResult;
      /**
       * `isDrawn: false`, and whether a theme stood to be cleared.
       */
      'theme.clear': ThemeResult;
      /**
       * What the person last selected; `undefined` when there is nothing.
       */
      'ui.selection': UiSelection | undefined;
      'ui.copy': UiCopyResult;
      'ui.view': UiViewResult;
      /**
       * The channel that sent the notification, or why none did.
       */
      'ui.notify': UiNotifyResult;
      /**
       * Whether a client was handed the cancel.
       */
      'ui.cancelNotify': {
          isSent: boolean;
      };
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
       * The value and the version it stands at; `undefined` at 0 when never
       * written.
       */
      'state.get': StateRead;
      /**
       * Whether the write landed, and the version the value stands at now.
       */
      'state.set': StateSetResult;
      /**
       * Milliseconds since the epoch.
       */
      'clock.now': number;
      'clock.sleep': void;
      'clock.after': void;
      'clock.every': void;
      'http.fetch': HttpResponse;
      'process.run': ProcessRunResult;
      'process.spawn': ProcessSpawnResult;
      'process.hookEnv': Record<string, string>;
      'settings.read': Settings;
      'env.get': string | undefined;
      'env.set': EnvSetResult;
      /**
       * The bytes that compile; the caller is resolved the module they make.
       */
      'wasm.compile': WasmBytes;
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
   * person's keyboard, its dialog manners, its size (rows, columns), its seat.
   *
   * An open answering the person's input (a command or prompt they entered, a
   * press) is placed at any width; one the plugin makes on its own waits
   * undrawn below 144 terminal columns, 110 once they asked for that id (in
   * this session or an earlier one, until they close the pane by hand), and
   * the call resolves `{ isPlaced: false, reason }` (UiOpenResult) saying so.
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
       * again (the person typed, or `focus` was refused); over text, a turn, a
       * dialog, a footer selection, a viewed agent or a prompt mode it is theirs.
       *
       * @remarks A hook may refuse that close and keep it open. Left out, Escape
       *   returns the keys and the pane stays. Each open sets it anew, as a title.
       */
      closeOnEscape?: true;
      /**
       * While the pane is the one shown the surface holds every transient toast:
       * each other plugin's `$.ui.toast` and the engine's own, as this plugin's.
       *
       * The toast stack is not drawn, its timers waiting; the notification line
       * queues all but the engine's standing warnings, and one up as the pane opens
       * may end unseen. After, the stack draws its newest few, the line one by one.
       *
       * @remarks For a dialog the person answers and leaves, not a pane that stays.
       *   Left out, toasts show. Every open sets it; a `ui.open` hook may drop it.
       */
      holdToasts?: true;
      /**
       * What the surface paints under the pane's body while it is the one shown, as
       * a Box takes it: a theme key, a raw color, or `"transparent"`.
       *
       * `"transparent"` paints nothing, so what lies behind the pane shows through;
       * a color stops at the body. Left out, the surface's own look stands. Anything
       * else is refused. Each open sets it anew; a `ui.open` hook may drop it.
       *
       * @remarks A request, not a grant: a surface with no counterpart for a theme
       *   key keeps its own look.
       */
      backgroundColor?: Color;
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
       * fullscreen transcript: the dock opens that wide, at most 45% of the
       * terminal's columns and at least 24. Each open sets it anew.
       *
       * A request, not a grant: a width the person dragged or keyed the dock to,
       * this session's or a kept one, wins under the same ceiling, and the
       * inline block ignores it. A positive whole number; left out, the share.
       *
       * @example
       * await $.ui.open({ id: "browser", focus: true, rows: 24, columns: 60 })
       */
      columns?: number;
      /**
       * Asks that the pane start as a `"widget"`, the small form of a minimized pane
       * on the desktop app; drawn so, its `Pane` props say `placement: "widget"`.
       *
       * A request: the surface decides, and the person can expand or minimize the
       * pane afterwards. A surface with no widgets (the terminal, VS Code, a desktop
       * app without them) opens the pane as if this were left out. Any other value
       * is ignored.
       *
       * @remarks Each open sets it anew, but a surface is meant to read it only when
       *   it first shows the pane. A `ui.open` hook may set or drop it.
       * @example
       * await $.ui.open({ id: "ticker", placement: "widget" })
       */
      placement?: 'widget';
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
   * What the engine knew as it made a plan-mode reminder: which of its two
   * wordings the row carries, where the plan is kept, whether one is there.
   */
  type PlanModeDetail = {
      /**
       * Which wording the row carries: `full`, the whole workflow, or `sparse`,
       * the one line that restates it between two full ones.
       *
       * A row made for a subagent reads the same under either.
       */
      reminder: 'full' | 'sparse';
      /**
       * Where the plan is kept, as the text names it: the file the model
       * writes its plan to, of the loop the row was made for.
       */
      planFilePath: string;
      /**
       * True when the engine found that file as it made the row.
       */
      hasPlan: boolean;
  };

  /**
   * What the engine knew as it made the note that plan mode has ended:
   * where the plan is kept, whether one is there.
   */
  type PlanModeExitDetail = {
      /**
       * Where the plan is kept; the text names it only when `hasPlan`.
       */
      planFilePath: string;
      /**
       * True when the engine found that file as it made the row.
       */
      hasPlan: boolean;
  };

  /**
   * What the engine knew as it made the note that plan mode is entered
   * again: where the plan of the earlier planning is kept.
   */
  type PlanModeReentryDetail = {
      /**
       * Where the earlier plan is kept, as the text names it; the note is made
       * only when the engine finds that file.
       */
      planFilePath: string;
  };

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
   *
   * Where a hook with no `.catch` is run again beneath its call to one and
   * makes that call again for the same event, the third identical open call
   * waits behind the second, and ends with it if the second goes unanswered.
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
   * The input of `plugin.register`: one plugin the engine is about to load, with a
   * hooks module or without one, read off its manifest and, where it has a module,
   * its scanned source. Every field is pinned.
   *
   * The event judges the plugin whole: a `{ refuse }` keeps out its hooks module,
   * command hooks, MCP servers, LSP servers, skills, commands, agents, output
   * styles, themes, monitors, settings and `bin/`. None of them starts before the
   * verdict.
   *
   * `tier` and `uses` are the host's reading of the plugin, what a gate holds
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
       * The plugin's directory (the one holding `.claude-plugin/plugin.json`),
       * absolute.
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
       * What its hooks module hooks and calls, as scanned (PluginRegisterUses).
       * Empty for a plugin with no module, or whose module did not load, and for a
       * module that scans empty: with no hook and no `$`, it can touch nothing.
       */
      uses: PluginRegisterUses;
  };

  /**
   * What a `plugin.register` hook returns and what `next(e)` resolves to:
   * `{ allow: true }` from core, or `{ refuse: reason }`.
   */
  export type PluginRegisterResult = {
      /**
       * The plugin loads: its module's `engine.create` step runs and its hooks
       * join, and the rest of its parts follow.
       */
      allow: true;
      refuse?: undefined;
  } | {
      /**
       * The whole plugin does not load: no step, no hooks, no tools or commands
       * from its module, and none of its other parts (command hooks, MCP and LSP
       * servers, skills, commands, agents, output styles, themes, monitors,
       * settings, `bin/`) take effect, but for a monitor armed before the refusal,
       * which runs on. The debug log names the plugin that refused and this reason.
       */
      refuse: string;
      allow?: undefined;
  };

  /**
   * What a hooks module uses, as the host scanned its source before loading it:
   * the same lists `claude plugin validate` prints and the host's rule reads.
   *
   * Exact, since a module that spells `on`, `$`, `$.env` or a `$.state`
   * reference other than literally does not load.
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
      /**
       * The named values its `$.state.get` and `$.state.set` calls refer to by
       * literal, each `{ plugin, key }`; absent when it calls neither.
       */
      state?: {
          /**
           * The values its `$.state.get` calls spell, sorted, each once.
           */
          reads: readonly StateName[];
          /**
           * The values its `$.state.set` calls spell, sorted, each once.
           */
          writes: readonly StateName[];
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

  /**
   * The named values plugins keep in the session (`$.state`), by plugin name
   * then key, for declaration merging; empty by default.
   *
   * A plugin declares its own in the contract it ships, inside `declare module
   * "claude-code"`; a key's type is the value `$.state.get` answers and
   * `$.state.set` takes, and a StateFamily key holds one value per `id`.
   *
   * @example
   * interface PluginState { swarm: { workers: Worker[] } }
   */
  export interface PluginState {
  }

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
   *
   * The event fires inside `tool.call`, beneath every plugin's `tool.call` hook
   * (a test raises it by calling `$.tool.call`).
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
   *
   * @example
   * const { stdout, isStdoutTruncated } = await $.process.run(["git", "log"])
   */
  export type ProcessRunResult = {
      /**
       * The child's exit status; a child ended by a signal reads as 1.
       */
      exitCode: number;
      /**
       * What the child wrote to standard output, as text: its first 4194304
       * bytes (4 MiB), the rest read and dropped (`isStdoutTruncated`).
       *
       * The limit counts bytes, not characters, and is standard output's own:
       * standard error has the same limit again. A cut inside a multi-byte
       * character drops that character.
       */
      stdout: string;
      /**
       * What the child wrote to standard error, as text: its first 4194304
       * bytes (4 MiB), the rest read and dropped (`isStderrTruncated`).
       */
      stderr: string;
      /**
       * True when the child wrote more than 4194304 bytes to standard output
       * and `stdout` is only the first of them; false when `stdout` is whole.
       */
      isStdoutTruncated: boolean;
      /**
       * True when the child wrote more than 4194304 bytes to standard error
       * and `stderr` is only the first of them; false when `stderr` is whole.
       */
      isStderrTruncated: boolean;
  };

  /**
   * One piece of a spawned child's output as `$.process.spawn` streams it:
   * which pipe it came from, and the text.
   *
   * The text is UTF-8 decoded as it arrived, in order per pipe: a piece ends
   * wherever the child's write did, so a line may span two pieces and one
   * piece may hold several lines; a multi-byte character is never split.
   */
  export type ProcessSpawnChunk = {
      /**
       * The pipe the text came from.
       */
      stream: 'stdout' | 'stderr';
      /**
       * What the child wrote, decoded; never empty, and never cut.
       *
       * Nothing of the stream is dropped: once 1048576 characters wait unread,
       * the child blocks on its next write until the loop pulls.
       */
      text: string;
  };

  /**
   * The argument of `$.process.spawn(request)`, and the `e` its hooks see:
   * the command by its argument vector and how the child is started.
   *
   * The same rules as `$.process.run`: no shell, the session's working
   * directory unless one is named, the host's environment with `env` over it.
   */
  export type ProcessSpawnRequest = {
      /**
       * The command and its arguments, `argv[0]` the executable.
       */
      argv: readonly string[];
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
       * Text written to the child's standard input, which is then closed;
       * absent, standard input is closed from the start.
       *
       * A string today; a later form may take the text in pieces.
       */
      input?: string;
  };

  /**
   * How a spawned child ended, as the stream of `$.process.spawn` returns it
   * once every piece has been read: its exit code, or the signal that did it.
   */
  export type ProcessSpawnResult = {
      /**
       * The child's exit status; null when a signal ended it.
       */
      code: number | null;
      /**
       * What ended the child from outside (`SIGTERM`); null when it exited on
       * its own. On Windows a killed child reads as an exit code, this null.
       */
      signal: string | null;
  };

  /**
   * The props of `Progress`, how far along a task is. A leaf: no children.
   *
   * Use it for a task moving toward done. For a level that is not heading
   * anywhere, such as usage against a limit, draw a bar of Boxes instead. The
   * `ToolProgress` render site is unrelated.
   */
  export type ProgressProps = {
      /**
       * What is being done, drawn and read out by a screen reader. Not blank.
       */
      label: string;
      /**
       * From 0 to `max`. Absent or not finite, the task is running with no known
       * end. Past either end it draws as that end.
       */
      value?: number;
      /**
       * Where `value` ends. Absent, 1. Zero or less, or not finite, makes no
       * fraction, so the task draws as running.
       */
      max?: number;
      /**
       * The figure as a person reads it, such as `412 of 900`. Absent, a surface
       * draws the whole percent, or says the task is running.
       */
      valueText?: string;
      /**
       * The fill, as Box's `backgroundColor` takes it. Absent, the surface's own.
       */
      color?: Color;
  };

  /**
   * The facts `prompt.attachment` pins under `e.detail`, by attachment type:
   * what the engine computed for the row, as it rendered the row's text.
   *
   * A type named here carries them on every row the engine made for a session
   * whose plan goes in a file; a type not named carries no `detail` at all. Read
   * off the row, never computed again: sent again, it says what it was made with.
   */
  export type PromptAttachmentDetailOf = {
      /**
       * The reminder a request carries while plan mode is on: `full` the first
       * of a planning session and after a compaction, `sparse` most others.
       *
       * @example
       * const isSparse = e.detail?.reminder === "sparse"
       */
      plan_mode: PlanModeDetail;
      /**
       * The note made when plan mode is entered again by the process that left
       * it, the earlier plan still in its file; it precedes the reminder.
       *
       * @example
       * const planFilePath = e.detail?.planFilePath
       */
      plan_mode_reentry: PlanModeReentryDetail;
      /**
       * The note made once when plan mode has ended: the model may act again,
       * and is told where its plan is when there is one.
       *
       * @example
       * const hasPlan = e.detail?.hasPlan === true
       */
      plan_mode_exit: PlanModeExitDetail;
  };

  /**
   * The input of `prompt.attachment`: one message the engine injects into the
   * conversation for the model on its own, as a request is about to carry it.
   *
   * A reminder, a mode transition, a listing, a mentioned file, a hook's
   * context: only one that carries text for the model is raised. A union on
   * `type`: a name PromptAttachmentDetailOf declares carries its `detail`.
   */
  export type PromptAttachmentInput = {
      [K in keyof PromptAttachmentDetailOf]: DeclaredAttachmentInput<K>;
  }[keyof PromptAttachmentDetailOf] | UndeclaredAttachmentInput;

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
       * Text a plugin's hook attached through a chain's `context`, as the
       * model reads it.
       *
       * The chains that carry one: `prompt.submit`, `prompt.mention`,
       * `tool.call`.
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
   * The input of `prompt.autocomplete`: the prompt box as the person left it
   * and the token at its cursor, which a taken suggestion replaces.
   *
   * All four are pinned, facts of the box: a rewrite that changes one is
   * refused, one left out is kept. Offsets count UTF-16 code units.
   */
  export type PromptAutocompleteInput = {
      /**
       * The whole draft in the prompt box.
       */
      text: string;
      /**
       * Where the person's caret stands in `text`, 0 to `text.length`.
       */
      cursor: number;
      /**
       * The run of characters that are not whitespace and that ends at the
       * cursor: `text.slice(start, cursor)`, never empty.
       *
       * What a matcher names to answer one lead character only.
       *
       * @example
       * on("prompt.autocomplete", { token: /^#/ }, hook)
       */
      token: string;
      /**
       * Where `token` begins in `text`.
       */
      start: number;
  };

  /**
   * What a `prompt.autocomplete` hook returns and what `next(e)` resolves to:
   * the rows the plugins add to the typeahead for the token.
   */
  export type PromptAutocompleteResult = {
      /**
       * The rows, in the order drawn beneath the engine's own; from core, none.
       *
       * A hook puts its rows before or after what `next(e)` gave; the engine's
       * own rows are not on this event and stay where they were drawn.
       *
       * @example
       * return { suggestions: [...(await next(e)).suggestions, mine] }
       */
      suggestions: readonly PromptAutocompleteSuggestion[];
  };

  /**
   * One row a `prompt.autocomplete` hook adds to the prompt box's typeahead:
   * what taking it writes, what the row shows, and a dim line beside it.
   */
  export type PromptAutocompleteSuggestion = {
      /**
       * What taking the row writes in place of the token, the cursor after it;
       * never empty. The box's new token is then asked again.
       */
      text: string;
      /**
       * What the row shows, on one line; the `text` when absent.
       */
      label?: string;
      /**
       * The dim line drawn beside the label, cut to the row by the surface.
       */
      description?: string;
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
   * The input of `prompt.change` (prompt-change/): the prompt box after a
   * change of its text that no `prompt.edit` carried, and who made it.
   *
   * The change is already in the box. Every field is the engine's: a hook
   * observes, and `next(e)` passes them on as received.
   */
  export type PromptChangeInput = {
      /**
       * The draft as it stands when the event is raised; what `$.prompt.read()`
       * answers then.
       */
      text: string;
      /**
       * Where the caret stands in `text` then, 0 to `text.length`.
       */
      cursor: number;
      /**
       * Who changed the box (PromptChangeOrigin), set by the engine: the act
       * that left the box as it stands.
       *
       * @example on('prompt.change', { origin: { kind: 'history' } },
       *   ($, e, next) => next(e))
       */
      origin: PromptChangeOrigin;
  };

  /**
   * Who changed the prompt box at `prompt.change`, as the engine stamps it
   * where the text is written; a matcher narrows on its `kind`.
   *
   * The set of kinds may grow: treat a kind you do not know as `engine`.
   * `next(e)` passes it on as received; no hook sets one.
   */
  export type PromptChangeOrigin = {
      /**
       * A recalled entry of the prompt history was put in the box: the up
       * and down arrows, the history search, the history picker.
       *
       * Stepping back out of a recall is `history` too: the newest entry
       * passed, the search cancelled, the person's own draft put back.
       */
      kind: 'history';
  } | {
      /**
       * The box was emptied by something other than an edit or an undo: a
       * submit took the draft, a clear, a stash.
       *
       * `text` is the box when raised: a key typed since is in it.
       */
      kind: 'clear';
  } | {
      /**
       * The person took an edit back (`chat:undo`): the box holds an
       * earlier text of theirs, which may be empty.
       */
      kind: 'undo';
  } | {
      /**
       * A plugin's `$.prompt.fill` landed, as its `prompt.fill` chain left it
       * and as the engine finished it (an over-long text collapsed).
       */
      kind: 'plugin';
      /**
       * The filling plugin's name; a hook that fills tells its own fill by it.
       */
      name: string;
  } | {
      /**
       * A remote surface's own Composer changed by the app's hand; reserved,
       * nothing raises it as shipped.
       */
      kind: 'app';
  } | {
      /**
       * Every other write: a draft put back, an accepted completion,
       * dictation, a prefill, and an edit `prompt.edit` does not carry.
       */
      kind: 'engine';
  };

  /**
   * What a `prompt.change` hook returns and what `next(e)` resolves to:
   * `{ text }`, echoed by core; a hook's own value changes nothing.
   */
  export type PromptChangeResult = {
      text: string;
  };

  /**
   * What a plugin passes `$.prompt.compose`: the facts it wants composed for,
   * each one it leaves out read off the session (its model, its tools).
   */
  export type PromptComposeArgs = Partial<PromptComposeInput>;

  /**
   * The input of `prompt.compose`: the facts a system prompt is composed from,
   * each already resolved by the engine, at the moment it renders one.
   */
  export type PromptComposeInput = {
      /**
       * The id of the model the request is for; pinned, the field a matcher
       * narrows on.
       */
      model: string;
      /**
       * The model whose prompt is rendered: `model`, unless the engine renders
       * another model's prompt for it (a model it holds no prompt of its own for).
       */
      promptModel: string;
      /**
       * Where the session draws at this render, as `$.session.surfaces()`
       * answers: `terminal` first under the REPL; empty where nothing draws.
       */
      surfaces: readonly RenderSurface[];
      /**
       * The names of the tools the request offers the model; the engine's own
       * composition reads them against the session's, an unknown name ignored.
       */
      tools: readonly string[];
      /**
       * What the person chose in place of the default way of answering, and
       * whether it keeps the coding instructions; null for the default style.
       */
      outputStyle: {
          name: string;
          isKeepingCodingInstructions: boolean;
      } | null;
      traits: readonly PromptComposeTrait[];
  };

  /**
   * What a `prompt.compose` hook returns: the sections of the system prompt,
   * in order, every `shared` one ahead of every `session` one.
   *
   * A section left out is not sent; a hook that never calls `next` answers
   * the whole list. The engine joins each side, places the cache boundary
   * between them and every cache marker itself.
   */
  export type PromptComposeResult = {
      sections: readonly PromptComposeSection[];
  };

  /**
   * Which side of the prompt cache's boundary a section of the system prompt
   * sits on: `shared` before it, `session` after it.
   *
   * `shared` text reads the same for everyone on this build and model: the API
   * may cache it across organizations, and text that varies hits that cache for
   * nobody. `session` text varies. In a list every `shared` section comes first.
   */
  export type PromptComposeScope = 'shared' | 'session';

  /**
   * One section of the system prompt as `prompt.compose` answers it: a stable
   * id, the text the model reads, and the side of the cache boundary it is on.
   *
   * @example
   * const POLICY = { id: "acme:policy", text: "...", scope: "session" } as const
   */
  export type PromptComposeSection = {
      /**
       * What a hook above finds the section by, to replace, move or drop it;
       * never empty, and unique in one list.
       *
       * A plugin's own is `<plugin>:<name>`; a bare name is the engine's. The full
       * prompt opens `intro`, `system`, `doing_tasks`, `actions`, `tools`, `tone`;
       * the short one opens `lean_body` instead; `--bare`'s one section is `bare`.
       */
      id: string;
      /**
       * The section's text, sent as written; sections on one side of the
       * boundary are joined by a blank line, in the list's order.
       */
      text: string;
      /**
       * The side of the cache boundary the section is sent on; in one list
       * every `shared` section comes before every `session` one.
       *
       * A section added at the end of what `next(e)` answered is `session`.
       */
      scope: PromptComposeScope;
  };

  /**
   * One branch the engine's own composition of the system prompt takes on the
   * request or the session before it computes any section: a closed set.
   *
   * `bare`: the session runs with the one-line prompt (`--bare`). `lean`: the
   * prompt model takes the short body. `sdk-preset`: the SDK's `claude_code`
   * preset, whose per-person sections ride the first user message instead.
   *
   * `teammate`: an in-process teammate's render of its lead's prompt.
   * `analysis`: a render that measures the prompt (`/context`) and sends
   * nothing. `print`: a session with no terminal behind it (`-p`, the SDK).
   *
   * `skills`: the Skill tool has commands to list. `send-user-message`: the
   * session speaks to the person through a message tool.
   *
   * Rewritten going down, `sdk-preset`, `teammate` and `analysis` steer the
   * engine's composition; the rest it derives itself, so they tell a hook what
   * it will do. What one section's own text turns on (a flag) is not here.
   *
   * `bare` and `lean` say which sections come back. With `bare`: one, `bare`.
   * With `lean`: `lean_body`, where the full prompt opens `intro`, `system`,
   * `doing_tasks`, `actions`, `tools`, `tone`.
   *
   * Past that opening the full and the short prompt hold the session's
   * sections (`communication`, `pronouns`, `memory`, ...), each left out when
   * it has no text.
   */
  export type PromptComposeTrait = 'bare' | 'lean' | 'sdk-preset' | 'teammate' | 'analysis' | 'print' | 'skills' | 'send-user-message';

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
   *
   * By name: `userEmail`, `attachedProject` and `perforceMode` are sent again
   * when the text differs, `workerToolsContext` too where the session's mode
   * announces it; for `gitStatus` and `currentDate` the engine sends its own.
   *
   * @remarks After a failure to send the context as copies, the engine renders
   *   it into the first message at each turn instead, from the latest answer.
   */
  export type PromptContextResult = {
      /**
       * What the conversation carries, in order.
       *
       * A block whose name the engine does not route reaches the model in one copy,
       * made when the conversation holds none (first request, after a compaction).
       * While it stands, a later answer adds, changes and takes back none.
       *
       * @remarks Text that changes goes in `instructionFiles`, sent again when
       *   a file differs, or in a `prompt.submit` hook's `context`.
       */
      blocks: readonly PromptContextBlock[];
      /**
       * The files now behind `claudeMd`; left out, the ones from below stand.
       *
       * Kept in step with the `claudeMd` text at every link: a changed list
       * renders the text the next reader gets, a rewritten text makes the files
       * unknown from there on. Every kind is the hook's to add, drop or rewrite;
       * a `managed` file a person's own plugin added or rewrote keeps its text
       * and is marked `isUnverified`.
       */
      instructionFiles?: readonly InstructionFile[];
  };

  /**
   * One styled run a surface paints over the prompt draft: `[start, end)` of
   * a text, in UTF-16 code units like PromptBox `cursor`. Paint only.
   *
   * Clamped into the text, an empty range with no `virtualText` dropped, and a
   * boundary moved back to its grapheme's start. Later entries win per key. The
   * caret's cell keeps its run's style, less a color that would hide the caret:
   * `color` matching its background, or an end matching the terminal's other one.
   *
   * @example { start: 4, end: 8, color: 'warning', bold: true }
   */
  export type PromptDecoration = {
      /**
       * The first code unit painted: an integer offset into the text the list
       * travels beside, clamped into it.
       */
      start: number;
      /**
       * The code unit past the last one painted; a run with `end <= start`,
       * once clamped, paints nothing.
       */
      end: number;
      /**
       * Drawn in bold; a decoration takes no `weight`.
       */
      bold?: boolean;
      /**
       * A text drawn before the character at `start`, in this entry's own style
       * keys: never in the draft, counted by no offset, never holding the cursor.
       *
       * Typed text at `start` lands before it. A tab is drawn as four spaces, and
       * control characters but a newline are dropped. Not drawn in the empty box,
       * by a remote host, or in screen-reader mode, where it is heard as typed.
       *
       * @example { start: 7, end: 7, virtualText: ' bug', dimColor: true }
       */
      virtualText?: string;
  } & Pick<TextProps, 'color' | 'backgroundColor' | 'dimColor' | 'italic' | 'underline' | 'strikethrough'>;

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
       * The one key that made the edit, in `Client` `onKey`'s shape; absent for
       * a paste, a keybinding's newline and a burst of keys folded into one edit.
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
  export type PromptEditResult = PromptBox & {
      /**
       * Runs to paint over this answer's own `text` (PromptDecoration); none
       * when absent.
       *
       * Kept on the same characters while the next edit's answer is pending,
       * then replaced by that answer's list (or by none).
       *
       * @example const r = await next(e)
       * return { ...r, decorations: [...(r.decorations ?? []), mine] }
       */
      decorations?: PromptDecoration[];
  };

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
      /**
       * Runs to paint over `text` (PromptDecoration), offsets into `text` as
       * given; the engine moves them to where it lands. None when absent.
       *
       * Replaced by the next edit's `prompt.edit` answer; with no hook on it,
       * gone at the draft's next change.
       *
       * @example $.prompt.fill({ text: ' next', mode: 'append',
       *   decorations: [{ start: 1, end: 5, italic: true }] })
       */
      decorations?: PromptDecoration[];
      /**
       * Where the caret stands after the write, counted as PromptFilled `cursor`
       * is: an offset into the whole draft the box then holds.
       *
       * In every `mode`, hidden code points gone, accents counted as NFC; clamped
       * to the draft, moved to the start of a character or chip it falls inside;
       * not an integer is refused. Left out: past an `insert`, else at the end.
       *
       * @example const box = await $.prompt.read()
       *   await $.prompt.fill({ text: box.text.toUpperCase(), cursor: box.cursor })
       */
      cursor?: number;
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
       * Why the box did not take the text, when the engine itself refused
       * (PromptFillResult): `no_composer` where the session binds no box,
       * `dialog` while one holds the keys. A hook's refusal carries none, so
       * a caller choosing a fallback treats an absent cause as unknown and
       * does not act as if no box existed.
       */
      refusal?: 'no_composer' | 'dialog';
      /**
       * The draft after the fill; unchanged when `isFilled` is false; `''` where
       * no box is drawn or the caller may not read it (see above).
       */
      text: string;
      /**
       * Where the person types next: an offset into `text`, where the call's
       * `cursor` stood it, else past the fill's text for `insert`, at the end
       * for `replace` and `append`.
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
       *
       * The box takes it without the code points a terminal draws as nothing, as
       * the composer removes them when a person sends; all else lands as written.
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
      /**
       * Runs to paint over `text` once it lands (PromptDecoration), offsets
       * into `text`; absent when the call named none.
       *
       * What the chain passes down is what paints: a hook strips them so.
       *
       * @example on('prompt.fill', ($, e, next) =>
       *   next({ ...e, decorations: [] }))
       */
      decorations?: PromptDecoration[];
      /**
       * Where the caret stands after the write (PromptFillArgs `cursor`), an
       * offset into the whole draft; absent when the call named none.
       *
       * What the chain passes down is what moves it: left out of a rewrite, the
       * box stands the caret by `mode`.
       *
       * @example on('prompt.fill', ($, e, next) => next({ ...e, cursor: 0 }))
       */
      cursor?: number;
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
      /**
       * Why the box did not take the text, on the two refusals the engine
       * itself answers: the session binds no prompt box (`no_composer`:
       * headless, or a surface that draws its own composer), or a dialog holds
       * the keys (`dialog`), so the write would land under it, unseen. A hook's
       * own refusal carries none: the site strips a cause a hook writes itself,
       * keeping only one its `next` gave it, passed up as it was. A caller
       * branching on the cause treats an absent one as unknown and takes its
       * refusing arm; `no_composer` is the only value that says no box exists
       * to protect.
       */
      refusal?: 'no_composer' | 'dialog';
  };

  /**
   * What `$.prompt.media({ id })` answers: one attached item's bytes as the
   * engine would send them now, or why there are none to read.
   *
   * An image is read after the engine's own resize, a document as held. One
   * call answers at most 4 MiB: `size` is the whole item's, `next` goes on.
   * Only a hook on the `prompt.submit` that lists the item is answered.
   */
  export type PromptMedia = {
      /**
       * The item's kind.
       */
      type: 'image' | 'document';
      /**
       * The MIME type of the bytes answered (`image/png`), after the resize.
       */
      mediaType: string;
      /**
       * This call's slice of the item, base64. The slices' strings, joined in
       * order, are the whole item's base64.
       */
      base64: string;
      /**
       * How many bytes the whole item holds, decoded.
       */
      size: number;
      /**
       * The offset the following slice starts at; absent on the last one.
       */
      next?: number;
      unreadable?: undefined;
      deny?: undefined;
  } | {
      /**
       * Why the model will not receive the item as media: the engine could
       * not process it, and sends a line of text in its place.
       */
      unreadable: string;
      type?: undefined;
      mediaType?: undefined;
      base64?: undefined;
      size?: undefined;
      next?: undefined;
      deny?: undefined;
  } | {
      /**
       * Why this read is refused: no submission in flight carries the id
       * for this caller, the item is not held as inline bytes, or the offset
       * is past its end.
       */
      deny: string;
      type?: undefined;
      mediaType?: undefined;
      base64?: undefined;
      size?: undefined;
      next?: undefined;
      unreadable?: undefined;
  };

  /**
   * What `$.prompt.media(args)` takes: which attached item of the prompt
   * being submitted to read, and from where in it.
   */
  export type PromptMediaArgs = {
      /**
       * The item's handle, as `e.attachments` of the `prompt.submit` in flight
       * lists it.
       */
      id: string;
      /**
       * Where the slice starts, in bytes of the item: an earlier read's `next`.
       * Absent, the start.
       */
      offset?: number;
  };

  /**
   * How the engine attached a mentioned file, in the names `prompt.attachment`
   * gives its `type`.
   *
   * `file`: read now, whole or in part. `already_read_file`: the model holds
   * it unchanged, nothing is sent again. `pdf_reference`: a PDF too long to
   * inline, named for the model to open by pages.
   */
  export type PromptMentionAttached = 'file' | 'already_read_file' | 'pdf_reference';

  /**
   * The input of `prompt.mention`: one file a prompt names after an `@`, as
   * the engine resolved it and before it is read for the model.
   *
   * A hook rewrites what is read (`path`, `offset`, `limit`); `mention` and
   * `agentId` are pinned. A directory and a path a deny rule covers raise
   * nothing; whether a file is there is the read's to find.
   */
  export type PromptMentionInput = {
      /**
       * What followed the `@`, a path as the person typed it, a fragment
       * included (`#L10-20`). Pinned: what the prompt said.
       */
      mention: string;
      /**
       * The file's absolute path, as the engine resolved the mention.
       *
       * `next({ ...e, path })` reads another file, judged by the deny rules
       * where it lands, links followed. One read per mention: a second `next`
       * settles with the first's.
       */
      path: string;
      /**
       * The first line read, counted from 1, when the mention names lines
       * (`#L10`); absent for a whole file. A rewrite is where the read starts.
       */
      offset?: number;
      /**
       * How many lines are read when the mention names lines (`#L10-20` reads
       * 11); absent for a whole file. A rewrite is how many are read.
       */
      limit?: number;
      /**
       * The loop whose prompt carries the mention: a subagent's id, the `id`
       * `$.agent.list()` gives it; absent on main.
       *
       * Pinned: a different value is refused, one left out is kept.
       */
      agentId?: string;
  };

  /**
   * What a `prompt.mention` hook returns and what `next(e)` resolves to: how
   * the file was attached (`{ type, context? }`), or `{ deny: reason }`.
   *
   * The file's text is its attachment's, which `prompt.attachment` rewrites.
   * A hook that answers without `next` had no file read.
   */
  export type PromptMentionResult = {
      /**
       * How the engine attached the file; null when it attached nothing: no
       * file is there, it is too large, or it cannot be read.
       *
       * From a hook answering without `next`: null, nothing was read.
       */
      type: PromptMentionAttached | null;
      /**
       * What the model reads after the prompt's mentioned files and the
       * person never sees, each entry one block. From core, none.
       *
       * An answer keeps every entry its `next` gave, none empty: one with
       * no `context` over a `next` that had one is refused. Past 100,000
       * characters (200,000 together) the model reads a head and a path.
       *
       * @example
       * return { ...result, context: [...(result.context ?? []), mine] }
       */
      context?: readonly string[];
      deny?: undefined;
  } | {
      /**
       * Refuses the mention: nothing of the file is attached, and a read
       * already made is forgotten. The debug log names the reason.
       *
       * From core: a deny rule covers the path a hook passed on. A context
       * beside it is dropped. A hook that throws or outlasts its budget is
       * skipped, and the file is read as if the hook were not there.
       */
      deny: string;
      type?: undefined;
      context?: undefined;
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
       * A scheduled task or /loop firing its stored prompt.
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
       * A plugin's `$.prompt.submit`.
       *
       * The model reads the prompt under the plugin's name ("The <name> plugin
       * sent a message: ...") unless the plugin submitted it `asUser`.
       */
      kind: 'plugin';
      /**
       * The submitting plugin's name.
       */
      name: string;
      /**
       * True when the plugin submitted the text as the person's own words
       * (`$.prompt.submit({ text, asUser: true })`).
       *
       * The model reads it bare; the origin is still the plugin's for every
       * hook and provenance gate.
       */
      asUser?: true;
  };

  /**
   * What a plugin's `$.prompt.paint(args)` takes, and a hook on `prompt.paint`
   * sees as `e` and may rewrite.
   *
   * Whose runs they are is the caller's name, which no argument or hook sets.
   */
  export type PromptPaintArgs = {
      /**
       * The draft `decorations` were computed for: nothing paints unless the box
       * reads exactly this. May be left out only with an empty list.
       */
      text?: string;
      /**
       * This plugin's runs over the draft (PromptDecoration), replacing those it
       * painted before; an empty list clears them.
       *
       * Another plugin's stand, a later one winning per style key. The draft's next
       * change drops them, but for a `prompt.edit` hook in the terminal.
       *
       * @example await $.prompt.paint({ text,
       *   decorations: [{ start: 0, end: 4, underline: true }] })
       */
      decorations: PromptDecoration[];
  };

  /**
   * What `$.prompt.paint` resolves to: whether the runs were painted, and the
   * box as it stands (PromptBox).
   *
   * A mod whose text went stale computes again from `text`.
   *
   * The box goes to a plugin whose module calls `$.prompt.read`, through the
   * hooks on it; one that never does, or is refused there, gets the empty box.
   */
  export type PromptPainted = {
      /**
       * True once the runs stand over the draft, or a clear took them off; false
       * where the box does not read `text`, or no box can take them.
       */
      isPainted: boolean;
      /**
       * The draft as it stands, which the call did not change; `''` where no box
       * is drawn or the caller may not read it (see above).
       */
      text: string;
      /**
       * Where the person types next: an offset into `text`, which the call did
       * not move.
       */
      cursor: number;
  };

  /**
   * The input of `prompt.section`: one named section of the system prompt, at
   * the moment the engine assembles it.
   */
  export type PromptSectionInput = {
      /**
       * The section's id (`env_info_simple`, `memory`, ...), the same on every
       * model and the one `prompt.compose` lists; the key a matcher narrows on.
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
      /**
       * Sends a changed answer at the next turn, rewriting the cache from the
       * system prompt on and dropping the model's earlier thinking.
       *
       * Left out, it waits for a new thread or a compaction. The outermost hook's
       * answer says so: a hook above that keeps it spreads what `next` gave.
       */
      breakPromptCache?: boolean;
  };

  /**
   * `prompt.submit`'s input as a plugin's call takes it: `origin`, `turnId`
   * and `wait` are the engine's to set, `context` the hooks' to attach.
   *
   * `origin` is the calling plugin's name; `turnId` is the turn a prompt typed
   * mid-turn ran over; `wait` is false, as a plugin's prompt runs once idle.
   */
  export type PromptSubmitArgs = Omit<PromptSubmitInput, 'origin' | 'turnId' | 'wait' | 'context' | 'command' | 'isMeta'> & {
      /**
       * Submit the text as the person's own words, read bare without the "The
       * <plugin> plugin sent a message" frame; absent means framed.
       *
       * The origin every hook sees stays `{ kind: 'plugin', name, asUser: true }`
       * and the transcript still names the plugin; `@file` mentions and pasted
       * images are not expanded for a plugin's prompt, `asUser` or not.
       * The turn is listed in /rewind, as a typed prompt is.
       *
       * @example
       * await $.prompt.submit({ text: 'what the person typed', asUser: true })
       */
      asUser?: true;
  };

  /**
   * A pasted or attached non-text item of a submitted prompt; its kind, never
   * its bytes, which `$.prompt.media` reads by the item's `id`.
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
      /**
       * The engine's handle for the item while this `prompt.submit` is in flight:
       * `$.prompt.media({ id })` reads its bytes.
       *
       * Opaque, and the engine's to set, as the whole list is: whatever a hook
       * passes down for it, the hooks beneath read the engine's.
       */
      id?: string;
  };

  /**
   * The slash command a submission runs, as the engine tells `prompt.submit`:
   * the command as `command.run`'s hooks left it, their change of arguments included.
   *
   * @example
   * const typed = { name: 'review', args: 'the diff' } // "/review the diff"
   */
  export type PromptSubmitCommand = {
      /**
       * Which command, without its slash (`compact`, `hello`), aliases and
       * folds resolved: `command.run`'s `command`.
       */
      name: string;
      /**
       * Everything after the command: what was typed, or what a
       * `command.run` hook left of it; `""` when there was nothing.
       */
      args: string;
  };

  /**
   * The input of `prompt.submit`: the prompt as typed, after the input became
   * a user message and before it enters the session.
   */
  export type PromptSubmitInput = {
      /**
       * The prompt's text as typed, pastes already expanded: what will reach
       * the model, or a slash command's line as `command.run` left it (`command`).
       */
      text: string;
      /**
       * The slash command the submission runs (PromptSubmitCommand), set by the
       * engine; a rewrite of `text` is then not applied, and the person is told.
       *
       * A `{ drop }` stops a skill or prompt command before it is rendered, and only
       * the turn of a built-in that asks the model, which has run. A command that
       * runs as a fork raises no `prompt.submit`. Mask arguments at `command.run`, a
       * skill's body at `skill.prompt`. Pinned: left out it is put back, changed it
       * fails the hook.
       *
       * @example
       * on('prompt.submit', ($, e, next) => next(e.command ? e : masked(e)))
       */
      command?: PromptSubmitCommand;
      /**
       * True, set by the engine, on a prompt the person does not see as typed.
       * Delivered into a running turn it takes a rewrite; starting a turn, none.
       *
       * Pinned: left out it is put back, changed it fails the hook.
       *
       * @example
       * ($, e, next) => (e.isMeta && bad(e) ? { drop: 'no' } : next(masked(e)))
       */
      isMeta?: true;
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
       * The prompt did not enter: a hook's refusal, a settings hook's block
       * beneath, or the engine's own (a Stop stands, a host's limit reached).
       *
       * A hook's text is shown to the user as the reason; the engine's is
       * logged. After a `next(e)` of the hook's was answered, a drop fails it:
       * its `.catch` is asked, or it is skipped by name, its last `next` kept.
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
   * `read($, source)`: the value of an atom (its initial while absent), of a
   * derived value, or under a plain reference; one `$.state.get` per value.
   *
   * Made while a `ui.render` hook draws, it subscribes the drawing as the
   * calls it makes would.
   *
   * @example
   * const n = await read($, count)
   */
  export type ReadFunction = {
      <T>($: StateDollar, source: Atom<T>): Promise<T>;
      <T>($: StateDollar, source: Derived<T>): Promise<T>;
      <P extends keyof PluginState & string, K extends keyof PluginState[P] & string>($: StateDollar, source: StateRef<P, K>): Promise<StateValue<P, K> | undefined>;
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
   * A ToolSpec as `$.tool.register` hands it on: the input schema filled in,
   * `isDeferred` as the plugin gave it.
   */
  export type RegisteredToolSpec = {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      isDeferred?: ToolDeferral;
  };

  /**
   * What `on(...)` returns for a hook of type `F`: the registration, which
   * takes one `.catch` (CatchHandler); without it a failed hook is absent.
   *
   * A second `.catch` on one registration throws, as does one after
   * register() returned and one on `engine.create`, whose hook has no budget
   * and whose failure is the load's.
   *
   * @remarks A guard judges before it calls `next` and carries one, or what
   *   it judges goes on when it fails: refuse where `next` was not called.
   * @example
   * on(...).catch(($, e, next) => next.called ? next(e) : { deny: "no" })
   */
  export type Registration<F> = {
      /**
       * Sets the handler run when the hook throws or overruns its budget; its
       * answer within the grace stands as the hook's result for the dispatch.
       *
       * The budget is HookBudget's `ms` and the grace its `catchMs`, both on
       * the clock that stops while the code waits on `next` or `$`.
       *
       * @remarks `claude plugin validate` lists each gating hook with or
       *   without one.
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
   * a component whose instances a plugin opens (`$.ui.open`), `Placed`
   * another (`$.ui.place`), and `Backdrop` the one a plugin sets
   * (`$.theme.set`), drawn behind the conversation by the desktop and mobile
   * apps alone. `AbovePromptList` is the band's arrangement of its `AbovePrompt`
   * rows.
   */
  export type RenderComponent = 'AskUserQuestion' | 'UserMessage' | 'AssistantMessage' | 'ToolUse' | 'ToolResult' | 'ToolGroup' | 'ToolProgress' | 'CommandOutput' | 'Spinner' | 'TurnDuration' | 'InfoNotice' | 'SessionMode' | 'PromptHint' | 'AbovePrompt' | 'AbovePromptList' | 'AgentRow' | 'Pane' | 'Placed' | 'Backdrop';

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
       * holds the handle for the lifetime of the drawing.
       */
      type: 'Button';
      props: {
          /**
           * The element's address: what `e.element` carries and what a matcher
           * names (`{ element: "explain" }`).
           */
          key: string;
          /**
           * The text drawn on the button; where it holds `children`, the name
           * of the control, which a surface that draws no children draws.
           */
          label: string;
          /**
           * One digit (`"1"`) or one lowercase letter (`"w"`) that presses it
           * while the plugin's site holds the focus; anything else is refused.
           *
           * The band after ctrl+x tab or a click, a focused `Pane`: on keydown,
           * lowercased; never from the composer, save a bare digit in an empty
           * one pressing a band Button. Two of one plugin on one hotkey: the
           * later wins. Two plugins on one hotkey: it presses neither.
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
           * `"primary"` marks the main action of several, drawn as the surface
           * marks the one to press; `"secondary"`, and absent, draw as before.
           *
           * The terminal draws a primary in the accent color; `plain` wins over
           * it. Carried to every surface as written, never filled in.
           *
           * @example { key: 'save', label: 'Save', variant: 'primary' }
           */
          variant?: ButtonProps['variant'];
          /**
           * `"dismiss"` marks the Button that closes its site, a drawing hint
           * only: the terminal draws it as without, a desktop its close control.
           *
           * Carried to every surface as written, never filled in.
           *
           * @example { key: 'dismiss', label: 'Dismiss', role: 'dismiss' }
           */
          role?: ButtonProps['role'];
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
      /**
       * What is drawn in the label's place, all of it one pressable: strings
       * and `Text` (a chip, a dim part), any other element refused.
       *
       * Absent for a Button of a label alone, drawn as it always was.
       */
      children?: RenderNode[];
  } | {
      /**
       * A text field on every surface, of one line or of `rows`; a change and
       * Enter raise `ui.input` (`e.element`, `e.kind`, `e.value` the text).
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
           * How many lines tall the field is; from 2 it holds several lines.
           * Absent is one.
           */
          rows?: number;
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
       * absent children the label, absent both the URL. `href` is drawn as
       * written; one that is no string draws the text plain.
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
       * checked as a Text's string is, or the tree is refused.
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
       * checked as a Text's string is, or the tree is refused. Without a
       * `press` its links are the surface's own, opened as it opens links.
       */
      type: 'Markdown';
      props: MarkdownLeafProps;
      /**
       * Whose `key` it is, set by the engine on a keyed one as the tree
       * leaves its hook, as a Box's `part` is.
       */
      part?: PluginStamp;
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
       * How far along a task is, or that it is still running. Hooks above wrap
       * it, replace it or rewrite its props. A mobile client that names it in
       * `draws` is sent this node; any other client, on any surface, gets its
       * Box and Text. A surface module cannot draw one.
       */
      type: 'Progress';
      props: ProgressProps;
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
       * Whose this drawing is, where it is one plugin's: the plugin an
       * `AbovePrompt` row is asked of, the plugin that opened a `Pane`.
       *
       * The engine's word, pinned: a rewrite carries it on as received. It is a
       * default matcher key: a hook leaving it out hears its own plugin's drawings
       * alone here; one naming it is read as written, `{ plugin: "*" }` for all.
       */
      plugin?: string;
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
       * A tree for it holds the engine's node once, nothing below it, in at most
       * 12 rows on the terminal and 48 on desktop, vscode and mobile, counted at
       * 40 columns; Markdown on those three alone; no size or place on any.
       *
       * Raised on every attached surface.
       */
      AskUserQuestion: {
          /**
           * The name of the tool whose call opened the dialog (`AskUserQuestion`).
           */
          tool: string;
          /**
           * The tool's `questions` input, as the dialog will draw them; a rewrite
           * must still fit the tool's schema or the original is drawn. Claude Code's
           * own confirmations are drawn as asked, whatever a rewrite says.
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
       * Raised on every attached surface.
       */
      UserMessage: {
          /**
           * What the row shows: the prompt as typed, a notification's summary, or
           * a message's body less the engine's framing (summary line included).
           * A plugin's prompt is the text it sent; `origin.name` names the plugin.
           *
           * A rewrite is printable text, drawn up to its first 100000 characters
           * where the engine draws the body; a teammate block of several frames or
           * with a summary line keeps the engine's drawing: one string is not those.
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
           * So does a row under a speaker label whose body fits the label view's
           * cap. False, a message row is one dim line naming its sender (under a
           * speaker label, the capped head of a long body).
           *
           * @remarks A hook that draws a compact row of its own passes when true,
           *   so ctrl+o shows all.
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
       * One block of an assistant reply in the transcript: its text, or a summary
       * of the text the model wrote between two tool calls.
       *
       * A rewrite changes the drawing and leaves the stored message alone
       * (ctrl+o). `isSummary` tells the two apart.
       *
       * Raised on every attached surface.
       */
      AssistantMessage: {
          /**
           * The block's text, markdown, as the surface's transcript will draw it:
           * what it hides of a reply (the terminal's, a `<context>` block) is gone.
           */
          text: string;
          /**
           * True on the block that draws the bullet opening a reply.
           */
          isFirstOfReply: boolean;
          /**
           * True on a block that holds a summary of the model's text, not the text
           * itself; absent on any other block, and where the surface does not say.
           *
           * Where the terminal marks such a row (a faint ` · summary` after its last
           * line), it marks a rewritten `text` too; a hook's own tree draws without
           * the mark. Read-only.
           *
           * @remarks A rewrite carries it on as received; one that changes or drops
           *   it, or adds it, is refused, the hook that passed it failing.
           */
          isSummary?: true;
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
       * In mobile apps, a `borderStyle` or `backgroundColor` on the Box that holds
       * the row and something else asks for a card under the row; otherwise a tree
       * that keeps the row usually draws as one quiet line under it, with the rest
       * behind a tap, so plain Text suits a small status.
       *
       * Raised on every attached surface.
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
           * Whether the view draws the row in full: the ctrl+o transcript,
           * `--verbose`, or a `ToolGroup` that a hook unfolded into rows. Absent
           * where the surface does not say. Read-only.
           *
           * A hook that draws a compact row of its own passes when true, so ctrl+o
           * shows all.
           */
          isExpanded?: boolean;
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
       * Raised on every attached surface.
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
           * Whether the view draws the row in full: the ctrl+o transcript,
           * `--verbose`. Absent where the surface does not say. Read-only.
           *
           * A hook that draws a compact row of its own passes when true, so ctrl+o
           * shows all.
           */
          isExpanded?: boolean;
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
       * @remarks In fullscreen mode the ctrl+o transcript does not fold runs: each
       *   call there is a `ToolUse` row and no `ToolGroup` is drawn.
       *
       * Raised on every attached surface.
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
           * Whether each call draws as its own `ToolUse` row, or the group draws
           * one line.
           *
           * True under `--verbose` and in the non-fullscreen ctrl+o transcript. The
           * only prop a rewrite changes on the screen.
           */
          isExpanded: boolean;
          /**
           * True when the group holds nothing but `calls` and the model's thinking
           * between them, and no call errored or was interrupted: no recalled
           * memory, hook timing or other row. What the line shows from the calls'
           * own input and output (paths, patterns, git results) counts as calls.
           * Absent where the surface does not say. Read-only.
           *
           * A hook that draws a group of its own calls in its own way checks it is
           * true. Such a hook still replaces the summary of the current task that
           * the live group's line can show in place of its counts.
           */
          isCallsOnly?: boolean;
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
       * Raised on every attached surface.
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
       * tokens)`); on the desktop, the row that carries the turn's mark.
       *
       * Reads `word` (or `message` while one overrides it), `suffix`, then what
       * the surface keeps and no prop carries: elapsed time, tokens, effort. A
       * hook rewrites the first three, or draws a tree in place of all of it.
       *
       * Raised on the terminal, desktop and vscode surfaces only.
       */
      Spinner: {
          /**
           * Animated by the line (`Sauteing`), as sampled for this turn.
           *
           * On the desktop, what the row says its step is doing (`Creating
           * notes.md`), or `Working` while the row shows no words.
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
           * What the turn is doing. The desktop tells `thinking`, `requesting`,
           * `tool-use` and `responding` apart and never says `tool-input`.
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
           * Whether the view is the ctrl+o transcript or `--verbose`. Absent where
           * the surface does not say. Read-only.
           *
           * A hook that draws a compact row of its own passes when true, so ctrl+o
           * shows all.
           */
          isExpanded?: boolean;
          /**
           * What the line waits on while it draws only its waiting text
           * (`Waiting for 2 background agents to finish`: no budget, no
           * hidden-messages count), read when the row mounts: the pending agents
           * that started at or before the line's time. That can include an agent
           * the line did not count, such as one resumed since the line, or, in a
           * subagent's transcript, one that is not that subagent's child. Absent
           * while it draws anything else, or when their count differs from the
           * count it draws. Read-only.
           *
           * A hook that redraws the line for its own agents checks that each agent
           * is its own and that `workflows` is 0.
           */
          waitingFor?: WaitingFor;
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
       * A hook rewrites `hint`, drawn in the line's place, sets `tail` to add to
       * the line as the engine draws it, or draws its own tree; `isDraft` and
       * `isWorking` say what the line is for.
       *
       * @remarks On the terminal, until a new answer lands the last keeps its row
       *   (the engine's line before any).
       *
       * Raised on the terminal, desktop and mobile surfaces only.
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
          /**
           * Text a hook adds after the line; absent as the engine hands it.
           *
           * The terminal keeps the engine's line (its pills stay live) and draws
           * `tail` dim at its end, cut where the row ends and left out where under
           * four columns of it would show; no other surface draws it yet.
           *
           * @remarks A rewritten `hint` replaces the line, `tail` with it.
           */
          tail?: string;
      };
      /**
       * The band directly above the prompt input, where the surveys draw; of its
       * own the engine draws a `[-]` beside the tree, an `n more` row under it.
       *
       * Asked once for each plugin that hooks it, `e.plugin` naming the plugin:
       * a hook draws that plugin's row, or passes. `AbovePromptList` stacks them.
       *
       * A row costs only itself: one that does not validate draws nothing, and so
       * does one past a tree's limits: they count across the rows, kept from the
       * top, and stacking adds a level of depth. While the session hot-reloads a
       * plugin folder that is told as
       * `ui.render (AbovePrompt) refused: a row past the limits of the band`, whose
       * `nothing was drawn` means that row. Another plugin takes a row away by a
       * hook above naming its plugin or `"*"` that answers over it, or an
       * `AbovePromptList` hook leaving it out. On the terminal, a tree that throws
       * while drawn empties the band.
       *
       * The person collapses the band (ctrl+x ctrl+a, `[-]`) or focuses it (a
       * click, ctrl+x tab): an Input types, a Button arms the hotkeys, a tree
       * taller than it scrolls.
       *
       * Raised on the terminal, desktop and mobile surfaces only.
       */
      AbovePrompt: {
          /**
           * True while a survey holds the band; a hook yields to it. Read-only.
           */
          hasSurvey: boolean;
          /**
           * True while the person has collapsed the band: a tree still returns, and
           * nothing of it is on screen. False where the band cannot collapse.
           * Read-only.
           */
          isCollapsed: boolean;
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
           * window of `scroll.bodyRows`.
           *
           * @remarks A bare digit arms only the hotkeys of the Buttons wholly inside
           *   that window, never one scrolled out of view.
           */
          maxRows: number;
          /**
           * Cells the band's tree is laid out in, none under a mark of the engine's:
           * its column's width less the engine's five at the right end. Read-only.
           *
           * The column is the terminal, or the transcript's beside a docked `Pane`;
           * the five hold the `[-]`. A wider tree wraps or truncates as its Text
           * props say; size a table to it rather than to `viewport.columns`.
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
       * The band's arrangement once its rows settled, heard by a hook naming it or
       * a bare `on("*")`; what settles is the whole band.
       *
       * Core stacks `rows`. A hook hides or reorders them in what `next(e)` gets,
       * and wraps them by answering around it, never with rows copied by value; an
       * organization's mod wins by the chain's order. A bad answer is passed over:
       * to fail closed, answer no rows in its `.catch`.
       *
       * A wrapper counts toward a tree's limits with the rows. Past one, the rows
       * that no longer fit are left out; where several hooks' wrappers together
       * pass it, the band is blank. While the session hot-reloads a plugin folder
       * either is told as `ui.render (AbovePromptList) refused:`, whatever that
       * line's ending says.
       *
       * Raised on the terminal, desktop and mobile surfaces only.
       */
      AbovePromptList: {
          /**
           * The settled rows that fit, in chain order, one for each plugin that drew
           * one.
           *
           * A rewrite holds rows it was handed, in any order and no more often than
           * they came, compared by value: an unchanged copy passes, one changed or
           * repeated fails the hook. What it leaves is what core stacks.
           */
          rows: readonly AbovePromptRow[];
          /**
           * As `AbovePrompt`'s. Read-only.
           */
          hasSurvey: boolean;
          /**
           * As `AbovePrompt`'s. Read-only.
           */
          isCollapsed: boolean;
          /**
           * As `AbovePrompt`'s. Read-only.
           */
          isWorking: boolean;
          /**
           * As `AbovePrompt`'s: the rows the band may take, all its rows together.
           * Read-only.
           */
          maxRows: number;
          /**
           * As `AbovePrompt`'s. Read-only.
           */
          bodyColumns: number;
          /**
           * As `AbovePrompt`'s: the window over the whole stacked tree. Read-only.
           */
          scroll: SiteScroll;
          /**
           * As `AbovePrompt`'s. Read-only: a rewrite carries it on as received.
           */
          view: SiteView;
      };
      /**
       * One agent's row in the at-a-glance agent list (the terminal's, under the
       * prompt; the desktop's, in the session rail's Background tasks; VS Code's
       * running subagents): a subagent's or a teammate's, `requestId` its `id`.
       *
       * The agent as `$.agent.list()` gives it, `parentId` naming the agent that
       * spawned it (absent when the main loop did); read-only but for `label`, the
       * words the engine's own row shows beside the name. A tree, or `body`,
       * stands for everything after the row's pointer, connector and bullet, dim
       * or bold as the row is selected or viewed. On every surface the surface
       * keeps opening and stopping the agent, and hiding never removes an agent
       * from the full list. Not raised where the layout draws no agent rows, nor
       * for the `main` row, a workflow's or the folded idle summary.
       *
       * Asked for every agent with `hasRow` (in VS Code, a blocking forked skill's
       * too, which has none), drawn now or not, and again as a prop changes;
       * `tokenCount`, `tokenSamples`, `lastRequest`, `usage` and `cost` are read
       * every five seconds, on `$.ui.invalidate` and with a new `status` or
       * `taskStatus`. The last answer stands until the next lands; a new row waits
       * 300 ms at most for its first, then shows as the engine's.
       *
       * In mobile apps, the background tasks sheet asks only for the subagents on
       * screen. It keeps its own row, draws the tree or `body` under it and shows a
       * changed `label` in the row; a hidden row stays listed, with nothing of the
       * mod's.
       *
       * The desktop shows one line and takes no presses in the tree: a tree stands
       * for the row's words, a Link is drawn as its text and a Button is left out.
       *
       * @example
       * on("ui.render", { component: "AgentRow" }, ($, e, next) =>
       *   next({ ...e, props: { ...e.props, isHidden: e.props.status === "idle" } }))
       *
       * Raised on every attached surface.
       */
      AgentRow: AgentInfo & {
          /**
           * The `id` of every agent with `hasRow`, so each row is asked again as
           * one comes or goes. Read-only.
           */
          rowIds: string[];
          /**
           * The columns a top-level row's body has, where the surface measures
           * them; a nested row's connector takes two a level of them. Read-only.
           */
          columns?: number;
          /**
           * Text drawn as the whole of the row's body in place of the engine's
           * columns, cut at the row's edge; `""` hides the row as `isHidden` does.
           * It arrives set where the person's settings already draw the row; leave
           * it out for the engine's columns.
           *
           * It alone may hold escape sequences: SGR styles and OSC 8 links are
           * drawn, any other is dropped. A line break makes the row taller. A
           * remote surface is sent it as Text and Link elements.
           */
          body?: string;
          /**
           * Whether the row is left out of the list: of its drawing, its count and
           * its keys. A hidden row is still asked, so a hook may show it again.
           *
           * What the last `next` in the chain passed decides, whoever draws: pass
           * `false` to show a row that arrives hidden by the person's settings.
           */
          isHidden: boolean;
      };
      /**
       * The framed region a plugin opened with `$.ui.open({ id })`: one instance
       * per id (`requestId`), its body the hook's tree, one shown, the rest tabs.
       *
       * Placed by the surface (docked in fullscreen, else above the prompt) and
       * keyed by the person (ctrl+x tab, Esc), who closes it from the engine's mark
       * or ctrl+x x: `ui.close` with origin `person`, which a hook may refuse.
       *
       * Raised on every attached surface.
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
           * Present, and true, while keys typed in the terminal may go to something
           * other than the prompt or this pane: a dialog (a permission prompt,
           * `/model`), a search, a field in the band. Read-only.
           */
          isPromptCovered?: true;
          /**
           * Cells across the body, inside the frame, none under a mark of the
           * engine's: the close mark sits on a row of the frame's own. Read-only.
           */
          bodyColumns: number;
          /**
           * Where the surface seated the pane: `dock` beside the transcript (the
           * terminal in fullscreen from 110 columns), or `inline` above the prompt.
           *
           * On the desktop app also `widget`, the small form of a minimized pane.
           * Draw what reads at a glance there: clicks may not reach it. The hook runs
           * again when the seat changes. Treat any other value as `dock`.
           *
           * Read-only: a rewrite carries it on as received; one that changes or
           * drops it is refused, the hook that passed it failing.
           *
           * @example
           * return e.props.placement === "widget" ? glance(e) : fullApp(e)
           */
          placement: 'dock' | 'inline' | 'widget';
          /**
           * The edges of the chat area that a `widget` is anchored on, to align the
           * drawing by: `["bottom", "right"]` in that corner, `["right"]` stacked on
           * another widget there, `[]` in the session rail (the column beside the
           * chat).
           *
           * Absent in every other seat. The hook runs again when they change. Ignore
           * a value outside these four. No call moves a widget.
           *
           * @example
           * const isOnBottom = e.props.anchoredEdges?.includes("bottom") ?? false
           */
          anchoredEdges?: readonly ('top' | 'right' | 'bottom' | 'left')[];
          /**
           * The body's window over the tree: engine-owned, moved by the person's
           * keys while the pane is focused. Read-only.
           *
           * `bodyRows` is the room's rows, never the rows showing: the most the frame
           * may take less the engine's (an inline border's two, the tab row while one
           * shows, a dock's row for the close mark). Inline the frame fits the tree.
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
      /**
       * A row a plugin placed in the transcript (`$.ui.place`): empty until a hook
       * draws it, in the row's place in the conversation.
       *
       * Every plugin's hook hears every row, so read `plugin` beside `id`. Outside
       * fullscreen a compaction ends the row, and the same id then places a new one.
       *
       * Raised on every attached surface.
       */
      Placed: {
          /**
           * What `$.ui.place` was given, unique among that plugin's rows. Read-only.
           */
          id: string;
          /**
           * Who placed the row, so a hook can leave another's alone. Read-only.
           */
          plugin: string;
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
       * The session's backdrop (`$.theme.set`), drawn behind the conversation by
       * the desktop and mobile apps alone: empty until a hook draws it.
       *
       * Every plugin's hook hears it, so read `plugin` beside `scene`. The surface
       * sizes the drawing to its window or screen and lets presses through to what
       * is over it. Each surface asks separately, so a hook can read `e.surface` to
       * draw a different scene on each.
       *
       * An answer holds only `Box`, `Text` and `Svg`, and an `Svg` is pure vector, or
       * the answer is refused: no `data:` URL, base64, `<image>`, `feImage`,
       * `foreignObject`, `@font-face`, `@import`, `image-set()`, `src()`,
       * `cross-fade()` or `<?xml-stylesheet`; no `url()` or `href` but a local
       * `#fragment`, and no SMIL on an `href`. Nor anything that could hide one of
       * these: a backslash in `<style>` or a tag, a character reference other than
       * `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&apos;`, a control character, an XML
       * declaration with an encoding other than UTF-8, a DOCTYPE, ENTITY or CDATA,
       * `<?`, an element inside `<style>`, a `<style>` with no end tag, or a tag with
       * an attribute that has no value or whose value holds `<` or `>`.
       *
       * A plain comment stands, and its words are read like the rest: an XML one
       * between tags, outside `<style>`, with no `<` or `--` in it, or a closed CSS
       * one in `<style>` or a `style` attribute, outside any string or `url()`. A
       * bare `&` stands in an XML one alone.
       *
       * Raised on the desktop and mobile surfaces only.
       */
      Backdrop: {
          /**
           * The `scene` `$.theme.set` was given in `backdrop`. Read-only.
           */
          scene: string;
          /**
           * Who set the backdrop, so a hook can leave another's alone. Read-only.
           */
          plugin: string;
          /**
           * How the surface frosts its panels over the drawing, defaults filled in;
           * `false` where they stay as they are. Read-only.
           */
          glass: {
              blur: number;
              tint?: string;
              opacity: number;
          } | false;
          /**
           * The `overrideColorScheme` of `$.theme.set`; absent where the plugin named
           * none. Read-only.
           */
          overrideColorScheme?: 'light' | 'dark';
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
   * The surface a render event's component is drawn on, by name. Plugins draw
   * into surfaces; they do not provide them.
   *
   * The surfaces the plugin was compiled against (the keys of Elements):
   * `terminal` is Ink, drawing the hook's whole tree; `desktop`, `mobile` and
   * `vscode` (Claude Code Desktop, the mobile app, VS Code) ask over the wire.
   *
   * A name here is no promise that its host draws. Under a host that attaches
   * no surface, hooks, tools and commands run and nothing drawn shows:
   * `$.session.surfaces()` is empty there.
   *
   * @remarks A surface unknown at compile time may ask at run time under a
   *   name of its own; `e.surface` then holds a name outside this type.
   */
  export type RenderSurface = keyof Elements & string;

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
       * @remarks A remote surface that reports it places panes (`$.ui.open` is
       *   placed there); the mobile app reports `false`. A change re-draws.
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
      [K in keyof M & TagKeys<I, keyof M>]: Literal<M[K] extends readonly (infer One)[] ? One : M[K]>;
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
   * `session.append`'s input as a plugin's `$.session.append(args)` takes it:
   * the row's kind and text, and the loop it joins.
   *
   * Its door (`note`), origin (the calling plugin) and id are the engine's to
   * set; a hook above, or the organization's policy plugin, may rewrite or
   * refuse it like any call on `$`.
   */
  type SessionAppendArgs = {
      /**
       * The row: `type: "user"` for a row the model reads and the person does not
       * see as typed, `"system"` for a notice the model never reads.
       *
       * Its `content` is text blocks alone (one, for a notice): the bottom
       * refuses any other block, and any other row type, with the reason. A
       * notice is stored at once.
       *
       * A `user` row waits for the next request of its loop (on an idle main, the
       * next turn that calls the model) and is stored where that request sends
       * it, never between a call and its result.
       *
       * It goes out as a reminder under a line naming the plugin; a reminder tag
       * around the text is not doubled. Right behind tool results it is a system
       * message on a model that takes them, as a `tool.call` context is.
       *
       * It is folded into the result instead on other models, when sent after a
       * restart, and where managed PostToolUse hooks are set or managed settings
       * have not loaded cleanly. Anywhere else it is fenced in the user turn.
       *
       * A result that takes no folded text (search results) holds it back to a
       * later request, or to the next turn when no later result takes it: text
       * behind the result would end the round's screening.
       *
       * It is never the person's words, even when it quotes them: a reminder to
       * the model and to auto mode's server classifier, a plugin's message to its
       * client classifier. A prompt is `$.prompt.submit`.
       *
       * A waiting row survives a restart once a copy of it is stored, which is
       * when no loop is there to take it. The copy is sent once, fenced or folded,
       * even when its plugin is off or gone (`--safe-mode`, `--bare`).
       *
       * It is lost with the process while its loop runs, until a request of that
       * loop carries it or the loop ends, and while main ends in a call with no
       * result.
       *
       * It is lost too on an idle headless session that exits before its next
       * write, and when both a `/compact` and a restart come while it waits.
       */
      message: {
          type: 'user' | 'system';
          content: ApiContentBlock[];
      };
      /**
       * The running subagent whose conversation the row joins; absent for main.
       * One that names no running loop is refused.
       */
      agentId?: string;
  };

  /**
   * Which door a row came in by, decided from the row alone; a closed set,
   * pinned on the event and the key a matcher narrows on.
   *
   * `queue` is no row of the conversation: it is the text of a message
   * queue record (the transcript file's `queue-operation` entries), a
   * prompt's or a machine-made one's alike, raised as a user row the
   * conversation never keeps, a prompt's as `prompt.submit` left it.
   */
  type SessionAppendDoor = 'prompt' | 'command' | 'response' | 'tool-result' | 'tool-message' | 'delivery' | 'attachment' | 'hook-context' | 'note' | 'compaction' | 'notice' | 'queue';

  /**
   * The input of `session.append`: one row being appended to a conversation of
   * this session, by the engine site that originates it or by a plugin's call.
   *
   * Not on `e`, so stored as made: a tool result's structured record, the row's
   * timestamps, parent links and provenance stamps, an attachment's payload
   * (the model reads its recorded rendering, which `content` rewrites).
   */
  type SessionAppendInput = {
      /**
       * The row as it will be kept (SessionAppendMessage). Its `content` is a
       * hook's to rewrite; the engine puts back what it pins.
       */
      message: SessionAppendMessage;
      /**
       * Which door the row came in by (SessionAppendDoor); the key a matcher
       * narrows on. Pinned.
       */
      door: SessionAppendDoor;
      /**
       * Who caused the row (SessionAppendOrigin): the person, the model, a tool,
       * the engine, a settings hook, a plugin. Pinned.
       */
      origin: SessionAppendOrigin;
      /**
       * The row's id, the same in the transcript file and on every later read,
       * so a hook can keep a table by row before calling `next`. Pinned.
       */
      uuid: string;
      /**
       * The loop whose conversation keeps the row: a subagent's id, as `turn.step`
       * and `tool.call` carry it; absent on main.
       *
       * Pinned: a different value is refused, one left out is kept.
       */
      agentId?: string;
  };

  /**
   * One row of a conversation as `session.append` hands it: how the transcript
   * files it, under which role a request carries it, and its blocks.
   *
   * `{ role, content }` of a row a request carries is an ApiMessage, so code
   * written for `$.session.messages({ as: "api" })` reads it unchanged.
   */
  type SessionAppendMessage = {
      /**
       * How the transcript files the row: `user`, `assistant`, `attachment` (what
       * the engine injects beside the conversation), `system` (a notice).
       *
       * Pinned, as `name`, `role` and `isMeta` are: left out it is kept, changed
       * it fails the hook.
       */
      type: 'user' | 'assistant' | 'attachment' | 'system';
      /**
       * An attachment's type (`queued_command`, `nested_memory`, ...) or a
       * notice's subtype (`compact_boundary`, `local_command`, ...). Pinned.
       *
       * Absent on user and assistant rows. Builds add and retire names.
       */
      name?: string;
      /**
       * Under which role a request carries the row; absent when none does (a
       * notice, a record with no bytes on the wire, a virtual row). Pinned.
       */
      role?: 'user' | 'assistant';
      /**
       * True on a user-side row the person does not see as typed (a reminder, a
       * nudge, a delivery's text). Pinned.
       */
      isMeta?: true;
      /**
       * The row's blocks in order (ApiContentBlock): an attachment's as the
       * engine recorded its rendering, a notice's as one text block.
       *
       * Rewritable: text blocks, a tool_result's `content` and `is_error`. Media
       * blocks may be dropped or moved, not changed or added. Thinking, tool_use,
       * unknown kinds and every tool_result's `tool_use_id` are put back.
       */
      content: ApiContentBlock[];
  };

  /**
   * Who caused a row, as the engine knows it from the row itself: a submission's
   * sender, an injected row's author, the model, or the tool that was called.
   */
  type SessionAppendOrigin = PromptOrigin | PromptAttachmentOrigin | {
      /**
       * A block of the model's response, or the engine's stand-in for one.
       */
      kind: 'model';
      /**
       * Whose response it is: the id the response names.
       */
      model: string;
  } | {
      /**
       * A tool call's result, or a row a tool handed over beside it.
       */
      kind: 'tool';
      /**
       * Which one was called, by name; `unknown` when no call of that id is
       * found.
       */
      tool: string;
  };

  /**
   * What a `session.append` hook returns and what `next(e)` resolves to: the
   * row as the session stored it, or `{ deny: reason }` for a plugin's own call.
   *
   * `next(e)` resolves once the row is kept. A hook relays it unchanged: one
   * that answers without `next`, or another row, is skipped. Only a plugin's own
   * append (door `note`) may be refused, in place of `next`: nothing is stored.
   *
   * A plugin's own `user` row resolves once it is accepted, as the row asked
   * for. The request that carries it stores it, as a `plugin_note` attachment,
   * and raises the event no second time.
   */
  type SessionAppendResult = {
      /**
       * The row as stored: what arrived at the bottom, the pinned parts put
       * back.
       */
      message: SessionAppendMessage;
      /**
       * The stored row's id: the same in the transcript file and on every
       * later read.
       *
       * A plugin's own `user` row sent only after a restart or a rewind is
       * stored under a new one.
       */
      uuid: string;
      deny?: undefined;
  } | {
      /**
       * Refuses a plugin's own append, so nothing is stored: the call
       * resolves to this, the reason the refusing hook gave.
       */
      deny: string;
      message?: undefined;
      uuid?: undefined;
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
   * A compaction that stands: the conversation as it reads afterwards, and the
   * counts and request usage the engine recorded when it was the one compacting.
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
      /**
       * What the compaction's own model request cost (ModelUsage), when core
       * made one: the summarizer's token counts as the API reported them.
       *
       * Absent when a hook answered in core's place, when core reused a summary
       * already computed, and when the response reported none. Accounting only:
       * the session's cost ledger (`session.measure`'s `cost`) already holds it.
       *
       * @example
       * const { usage } = await next(e); if (usage) spent += usage.output_tokens
       */
      usage?: ModelUsage;
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
       * `e.messages` is this loop's transcript; `$.session.messages()` stays the
       * main conversation, and `$.session.messages({ agentId })` reads this one.
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
   * compaction (`{ messages, tokensBefore?, tokensAfter?, usage? }`) or a skip.
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
   * for the next compaction, if the conversation still holds what it ran over.
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
       * The token counts (ModelUsage) the live window's last API response
       * reported, or null before one came back.
       *
       * The breakdown's `Messages` row is reconciled to it.
       */
      apiUsage: ModelUsage | null;
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
   * What the session has cost, as `/cost` and the status line total it; on an
   * agent (AgentInfo), its own requests' part of that.
   *
   * A client-side estimate, priced locally at list price or the managed
   * `modelPricing` rates, not authoritative billing data: it can run over or
   * under. Server-side billing (the invoice, or the cloud provider's bill) is
   * the final authority. On a subscription, usage inside the plan is not billed
   * in dollars, so there the figure is no charge at all.
   *
   * Do not bill anyone or make a financial decision from it. A mod that shows
   * it should label it an estimate.
   */
  export type SessionCost = {
      /**
       * US dollars, summed over every priced API response this session, a mod's
       * `$.model` calls among them, and auto mode's classifier calls where the
       * account is billed for them; the engine's other side queries stay out.
       */
      usd: number;
      /**
       * Present once `usd` includes a model with no known price, which goes at
       * another model's rates: the note `/cost` prints.
       *
       * On an agent, only its own requests set it.
       */
      hasUnknownPrice?: true;
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
   * to it; every field is the engine's: a hook observes, `next(e)` passes it on.
   *
   * One short wall-clock bound (1.5 s by default) covers every hook, its `$`
   * waits and core, and `next.budget` reads it: at it `next.signal` aborts, a
   * `$` call in flight with it; only a process a command let go of outlives it.
   */
  export type SessionEndInput = {
      /**
       * Why it ends (SessionEndReason), the word the classic SessionEnd hook
       * receives as its `reason`.
       *
       * `clear` is how a hook sees a `/clear`: the conversation ends, the process
       * goes on under a new session id, and no `session.start` fires for it.
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
   * What `$.session.identity()` answers: how the session is signed in and,
   * under a managed pin of its organization, the account the session holds.
   *
   * Answered only to a mod the organization's managed settings install. That
   * is a contract, not a wall: any mod can read the person's own config file,
   * where a login keeps the same facts.
   */
  export type SessionIdentity = {
      /**
       * How the session is authenticated: `claude.ai`, `console`, `api-key`,
       * `oauth-token` (a token its host handed it), `none`, or a cloud
       * provider's name (`bedrock`, `vertex`, ...).
       *
       * Builds add kinds: read an unknown one as a session with no identity.
       */
      kind: string;
      /**
       * The organization the account belongs to, by its id, only where
       * managed `forceLoginOrgUUID` lists that organization.
       *
       * Absent everywhere else, as are the two fields below: with no pin, a
       * pin on another organization, an API key or a cloud provider. So an
       * organization's mod never learns of another organization's account.
       */
      organizationId?: string;
      /**
       * The organization's plan as the server names it (`claude_team`,
       * `claude_enterprise`, ...), when the login recorded one.
       *
       * Always read from the login record on disk, which the person can
       * edit, whatever `isVerified` says.
       */
      organizationType?: string;
      /**
       * The account's email address, where the session holds one.
       */
      email?: string;
      /**
       * Whether `organizationId` and `email` are the account the server told
       * this process its credential signed in as, not the login record on disk.
       *
       * The person can edit that record. False until the server has answered
       * this process, as with nonessential traffic off, and with no account.
       */
      isVerified: boolean;
      deny?: undefined;
  } | {
      /**
       * Why nothing is answered: the calling mod is not one managed settings
       * enable and load in place from a source they name.
       */
      deny: string;
      kind?: undefined;
      organizationId?: undefined;
      organizationType?: undefined;
      email?: undefined;
      isVerified?: undefined;
  };

  /**
   * What `$.session.info()` answers: what a settings hook's input says of the
   * session that no other read on `$.session` does.
   */
  export type SessionInfo = {
      /**
       * The main conversation's transcript file (`transcript_path`); empty in a
       * session that keeps none on this machine.
       *
       * A subagent's lies under the folder of that name, in `subagents/`.
       */
      transcriptPath: string;
      /**
       * The session's scratchpad directory (`scratchpad_dir`); absent where the
       * session has none.
       */
      scratchpadDir?: string;
      /**
       * The id of the prompt the session is on (`prompt_id`); absent before the
       * first.
       */
      promptId?: string;
      /**
       * The agent the session itself runs as (`--agent`, `agent_type`); absent
       * when it runs as none.
       */
      agentType?: string;
      /**
       * The folder the project's settings are read from when it is not where the
       * session stands, which a settings hook's command starts in; else absent.
       */
      configRoot?: string;
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
       * What the session has cost so far, an estimate, not the bill
       * (SessionCost); absent where the host keeps no ledger.
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
       * The row's id, as `session.append` carries it: what a later
       * `$.session.messages({ after })` reads on from.
       *
       * On a read that names `last` or `after`; absent on every other.
       */
      uuid?: string;
      /**
       * An opaque token the engine stamps on a message it hands a
       * `session.compact` hook, so a list handed back maps to its own messages.
       *
       * Absent on `$.session.messages()` and on a message a hook built.
       */
      handle?: string;
  };

  /**
   * A `$.session.messages` call for the rows (SessionMessage) of the main
   * conversation or of one agent's, whole or in part: no `as`.
   */
  type SessionMessagesAgentArgs = {
      /**
       * Whose conversation; absent, the main one.
       */
      agentId?: string;
      /**
       * Left out: the rows.
       */
      as?: undefined;
      /**
       * How many of the newest rows (SessionMessagesArgs). Not with `after`.
       */
      last?: number;
      /**
       * The row to read on from (SessionMessagesArgs). Not with `last`.
       */
      after?: string;
  };

  /**
   * A `$.session.messages` call for the Messages API form (ApiMessage) of the
   * main conversation or, with `agentId`, of one of this session's agents'.
   */
  type SessionMessagesApiArgs = {
      /**
       * `"api"`.
       */
      as: 'api';
      /**
       * Whose conversation; absent, the main one.
       */
      agentId?: string;
      /**
       * How many of the newest messages, walked back to a clean user one
       * (SessionMessagesArgs).
       */
      last?: number;
      /**
       * Left out: this form has no row to read on from.
       */
      after?: undefined;
  };

  /**
   * What `$.session.messages({ as: "api", agentId })` resolves to: the
   * agent's conversation as ApiMessage, or `{ deny }` (SessionMessagesDeny).
   *
   * `Array.isArray` tells the two apart; without `agentId` it is always the
   * messages.
   */
  type SessionMessagesApiResult = ApiMessage[] | SessionMessagesDeny;

  /**
   * What `$.session.messages(args)` takes and a `session.messages` hook reads
   * on `e`: whose conversation, in which form, and which part of it.
   */
  type SessionMessagesArgs = {
      /**
       * Whose conversation to read: the id `tool.call`, `turn.step` and
       * `turn.complete` carry inside that agent's loop. Absent, the main one.
       *
       * A subagent (foreground or background), a fork, or a teammate running in
       * this process; `$.agent.list()` lists it, an Agent tool use's `toolUses`
       * entry names it. Not an agent a workflow run filed under the run.
       */
      agentId?: string;
      /**
       * `"api"` for the Messages API form (ApiMessage: `{ role, content }` with
       * the content blocks intact); absent, the rows (SessionMessage).
       */
      as?: 'api';
      /**
       * How many of the newest entries, a whole number from 1 to 4096; absent,
       * 4096. Rows of a read naming it carry `uuid`. Not with `after`.
       *
       * With `as`, the cut walks back to the nearest user message carrying no
       * tool_result, so more may come (4096 at most); with none that near, it
       * opens on the first inside the cut, else mid-exchange where it was cut.
       */
      last?: number;
      /**
       * A row's `uuid`: the rows after it, oldest first, none skipped, each with
       * `uuid`; 4096 back may have more behind them. Not with `last` or `as`.
       *
       * Any row since the last compaction or kept by it anchors, listed or not;
       * any other is `{ deny }` (SessionMessagesDeny). Nothing ahead of it comes:
       * not a row whose tool answered since (its result row does), nor the
       * summary of a compaction that kept it.
       *
       * The id `session.append` answered for a `user` row anchors at main's copy
       * of it while that anchors. Else it stands where a request carries it: rows
       * stored before then are ahead of it, and none is after it while it waits.
       */
      after?: string;
  };

  /**
   * `$.session.messages`: the main conversation's rows with no argument, with
   * `{ as: "api" }` its Messages API form; with `agentId` an agent's, or deny.
   *
   * `last` or `after` asks for part of it; ranged rows are typed rows or deny,
   * as a hook above may add an `after` that no longer anchors.
   */
  type SessionMessagesCall = {
      (): Promise<SessionMessage[]>;
      (args: SessionMessagesMainApiArgs): Promise<ApiMessage[]>;
      (args: SessionMessagesApiArgs): Promise<SessionMessagesApiResult>;
      (args: SessionMessagesAgentArgs): Promise<SessionMessagesResult>;
      (args: SessionMessagesArgs): Promise<SessionMessagesValue>;
  };

  /**
   * What `$.session.messages` resolves to when `agentId` names no conversation
   * this session can read, or `after` no row to read on from: why, in `deny`.
   *
   * The agent is not one of this session's, runs in another process (a
   * pane-hosted teammate), or finished and the session reads no saved transcript
   * back for it (none saved; a workflow run's). Never main's rows in its place.
   */
  type SessionMessagesDeny = {
      /**
       * Why nothing was read, naming the agent's id or the row's uuid.
       *
       * A row was cleared, rewound or left behind the last compaction. Or, for a
       * moment: a compaction that keeps it is still landing, or it is a turn's
       * own row and its `session.append` hook still runs.
       */
      deny: string;
  };

  /**
   * A `$.session.messages({ as: "api" })` call naming no agent: the main
   * conversation, whose answer is always the messages (ApiMessage).
   */
  type SessionMessagesMainApiArgs = {
      /**
       * `"api"`.
       */
      as: 'api';
      /**
       * Left out: the main conversation.
       */
      agentId?: undefined;
      /**
       * How many of the newest messages, walked back to a clean user one
       * (SessionMessagesArgs).
       */
      last?: number;
      /**
       * Left out: this form has no row to read on from.
       */
      after?: undefined;
  };

  /**
   * What `$.session.messages({ agentId, last, after })` resolves to: the messages
   * (SessionMessage), or `{ deny }` (SessionMessagesDeny).
   *
   * With an agent the session cannot read or a row it cannot read on from,
   * the deny. `Array.isArray` tells the two apart.
   */
  type SessionMessagesResult = SessionMessage[] | SessionMessagesDeny;

  /**
   * What a `session.messages` hook's `{ value }` holds, for any call: the
   * rows (SessionMessage), the Messages API form (ApiMessage), or `{ deny }`.
   */
  type SessionMessagesValue = SessionMessagesResult | SessionMessagesApiResult;

  /**
   * One rate-limit window as the rate-limit notices read it.
   */
  export type SessionRateLimit = {
      /**
       * Which window: `five_hour`, `seven_day`, or a Claude gateway's
       * `spend_limit`, which comes from the gateway's own estimate from token
       * counts, not a billed amount.
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
       * The producing service (`github`; `artifact-room` for a page's events).
       */
      source: string;
      /**
       * The event's discriminator (`pull_request.closed`, `check_suite`).
       */
      kind: string;
      /**
       * The envelope's sender-kind attribute as the server stamped it (`system`
       * for a relay's own event, `rc_owner` for the user's own relayed message);
       * absent when the envelope carries none.
       */
      from?: string;
      /**
       * The envelope's JSON body (`{ pr: "acme/app#12", outcome: "merged" }`).
       *
       * For `artifact-room`, kind `events`: `{ artifact, events, overflow }`, one
       * burst under origin `task-notification`, each event `{ topic, from,
       * isOwnViewer, data, isTruncated }` as the page's viewers wrote it.
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
   * The input of `session.receive`: one inbound delivery, sanitized, before it
   * is queued (a relay's event, a peer's message, a message for an agent).
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
      /**
       * The id of the loop the delivery is for, when it is one of this session's
       * agents (`$.agent.list()` lists it); absent for the main conversation's.
       *
       * Pinned: a rewrite that changes it is refused. An agent's message raises
       * `session.send` with the sender's `agentId`, then this with the receiver's
       * inside its turn, where a hook awaiting its own `$.prompt.submit` hangs.
       *
       * @example
       * on("session.receive", { agentId: worker }, ($, e) => ({ consumed: "no" }))
       */
      agentId?: string;
  };

  /**
   * Where an inbound delivery came from, as the bridge classified it from the
   * server's stamps: `prompt.submit`'s `e.origin`, less what never arrives.
   */
  export type SessionReceiveOrigin = {
      /**
       * `bridge` the user's own from a Remote Control client; `unclassified`
       * one nobody could place; the rest as at `prompt.submit`.
       *
       * `task-notification` a relay's event or a trigger.
       */
      kind: 'bridge' | 'task-notification' | 'scheduled-trigger' | 'peer-send-message' | 'projects-relay' | 'slack-ping' | 'unclassified';
  } | {
      /**
       * `peer` another session's or agent's model; `coordinator` the main
       * conversation to an agent of its own.
       */
      kind: 'peer' | 'coordinator';
      /**
       * Which plugin's `$.session.send` composed it, AS THE SENDER SAYS;
       * absent for a message the sending model wrote itself.
       *
       * A claim over a same-user channel, exactly as trustworthy as the
       * sender's name: name it in a log line, never key a guard on it.
       */
      plugin?: string;
  } | {
      /**
       * A delivery through this session's agent-team mailbox: `coordinator`
       * from the lead's harness, `peer` from a teammate's or when unverified.
       */
      kind: 'peer' | 'coordinator';
      /**
       * Which plugin's `$.session.send` composed it, as the mailbox entry
       * says; absent for a message the sending model wrote itself.
       */
      plugin?: string;
      /**
       * The sending member's name in the team (`team-lead` for the lead):
       * the harness's stamp when `isVerified`, else whatever the writer put.
       *
       * @example
       * on("session.receive", { origin: { teammate: "researcher" } }, hook)
       */
      teammate: string;
      /**
       * Whether this process can vouch for the mailbox entry: it wrote it (the
       * lead's process, for its own and in-process teammates' sends), or it is
       * a teammate in its own pane that accepted the lead's signature on it.
       *
       * `false`: this process could not check it, or it failed the check. The
       * lead's process cannot check a pane teammate's send, and a pane teammate
       * can check only what its lead sends, with a key from that lead. A failed
       * check is no proof of forgery: such a teammate fails every entry its
       * lead writes after restarting.
       *
       * @example
       * on("session.receive", { origin: { isVerified: false } }, hook)
       */
      isVerified: boolean;
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

  /**
   * Whom `$.session.send` addresses: a recipient as the SendMessage tool
   * names one (a string), or a session or an agent of this session by id.
   *
   * The engine spells the two id forms the tool's way before the send, and a
   * `session.send` hook reads that spelling on `e.to`: `{ agentId }` as the
   * id (a live teammate's as its name), `{ sessionId }` as its address.
   */
  export type SessionSendAddress = string | {
      /**
       * One of the person's own sessions: what its `$.session.id()` answers
       * on this machine, or a Remote Control or cloud id (`session_...`).
       *
       * A session that is not running now is not delivered to: the result
       * says so.
       */
      sessionId: string;
  } | {
      /**
       * A subagent or teammate of this session: the id `$.agent.list()`
       * lists and `agent.spawn` answered.
       *
       * A finished subagent is resumed from its transcript with the message,
       * as the tool does. A live teammate's `teammateId` reaches it too.
       */
      agentId: string;
  };

  /**
   * `session.send`'s input as a plugin's `$.session.send(args)` takes it:
   * `origin` (the calling plugin) and `agentId` are the engine's to set.
   */
  export type SessionSendArgs = {
      /**
       * The recipient: the tool's own spelling (a name, an agent id, a received
       * `from` address), or `{ sessionId }` / `{ agentId }`.
       */
      to: SessionSendAddress;
      /**
       * The message's text, non-empty.
       */
      text: string;
  };

  /**
   * The input of `session.send`: one plain-text message about to leave this
   * conversation for another agent or session; the dual of `session.receive`.
   */
  export type SessionSendInput = {
      /**
       * Whom it goes to, as the SendMessage tool spells a recipient: a name as
       * ListAgents lists it, an agent id, or a received `from` address.
       *
       * A plugin's `{ sessionId }` or `{ agentId }` arrives already spelled so.
       * `next({ ...e, to })` readdresses it, judged again as the tool judges a
       * send there; a name nobody carries is refused after the hooks.
       */
      to: string;
      /**
       * The message's text as the recipient will read it inside the engine's
       * envelope; `next({ ...e, text })` is what is sent, with no new approval.
       */
      text: string;
      /**
       * Who is sending: the model through its SendMessage tool, or a plugin
       * through `$.session.send`. Pinned: a rewrite that changes it is refused.
       */
      origin: SessionSendOrigin;
      /**
       * The id of the loop sending, when a subagent's or teammate's model sends
       * (`$.agent.list()` lists it); absent for the main conversation's send.
       *
       * Pinned: the agent axis, not the origin. A message between two subagents
       * carries the sender's id here and reaches the receiver's
       * `session.receive` with that loop's own `agentId`.
       */
      agentId?: string;
  };

  /**
   * Who is sending at `session.send`: the model through its SendMessage tool,
   * or a plugin through `$.session.send`; stamped by the engine, pinned.
   *
   * The receiver's `session.receive` reads a plugin's name on its own
   * `e.origin.plugin`, beside the `peer` or `coordinator` kind it keeps.
   */
  export type SessionSendOrigin = {
      /**
       * The model's own SendMessage tool call, in the main conversation or
       * in a subagent's or teammate's loop (`e.agentId` says which).
       */
      kind: 'model';
  } | {
      /**
       * A plugin's `$.session.send`, its `$.tool.call` of SendMessage, or the
       * model inside an agent it spawned. Every hook of the plugin sees it, but
       * for the one that made the `$` call.
       */
      kind: 'plugin';
      /**
       * The sending plugin's name, which the receiver reads as its
       * `session.receive` origin's `plugin` and shows beside the sender.
       */
      name: string;
  };

  /**
   * What a `session.send` hook returns and `next(e)` and `$.session.send`
   * resolve to: whether the message was delivered, and why not when not.
   *
   * Delivered means queued at the recipient (an agent's inbox, another
   * session's socket, the server for a remote session), never read: the
   * receiver's turn is its own, and it may hold the message for its person.
   *
   * @example
   * const { isDelivered, reason } = await $.session.send({ to, text })
   */
  export type SessionSendResult = {
      /**
       * True: the message reached its recipient's queue or inbox.
       */
      isDelivered: true;
      reason?: undefined;
  } | {
      /**
       * False: nothing was delivered. A hook answering this without `next`
       * refuses the send, and the model reads `reason` as the tool's result.
       */
      isDelivered: false;
      /**
       * Why not, as the SendMessage tool words it: nobody by that name,
       * several by it, the recipient gone or refusing, or a hook's refusal.
       *
       * @example
       * on('session.send', { to: 'prod' }, () => NOT_FROM_HERE)
       */
      reason: string;
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
   * What `$.session.usage()` answers: when the session began, the context
   * window's fill, the account's rate-limit windows and the session's cost.
   *
   * The status line's figures. One the engine does not have is left out, never
   * zeroed: `rateLimits` is empty off a subscription, `cost` absent where the
   * host keeps no ledger.
   */
  export type SessionUsage = {
      /**
       * When the session these figures count from began, in `$.clock.now()`'s
       * milliseconds: its launch, or for a resumed session its first launch.
       *
       * So what happened while a resumed or continued session was away still
       * counts as its own; `/clear` starts it over at that moment. The line the
       * engine's diff panel draws between this session's edits and earlier ones.
       *
       * @example
       * const isOlder = stat.mtimeMs < (await $.session.usage()).startedAt
       */
      startedAt: number;
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
       * What the session has cost so far, as /cost totals it, every mod's answered
       * `$.model` calls included; absent only where the host keeps no cost ledger
       * (the CLI always has one). An estimate, not the bill (SessionCost).
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
   * What `$.session.version()` answers: the version of the engine the session
   * runs on, the release that version is built from, and when it was built.
   *
   * The three are what the engine's own analytics rows carry as `version`,
   * `version_base` and `build_time`, so a row a plugin sends and a row the
   * engine sends from the same binary agree.
   */
  export type SessionVersion = {
      /**
       * The engine's full version, as `claude --version` prints it.
       *
       * A release's is `2.1.280`; a development build's adds the build's date,
       * time and commit (`2.1.280-dev.20260920.t101500.sha1a2b3c4`).
       */
      version: string;
      /**
       * The release the version is built from, its semantic core and channel:
       * `2.1.280` for that release, `2.1.280-dev` for a development build of it.
       *
       * Absent when the version is not spelled as a release.
       */
      base?: string;
      /**
       * When the binary was built, an ISO 8601 timestamp
       * (`2026-09-20T10:15:00Z`). Absent in a run from source that stamps none.
       */
      builtAt?: string;
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
   * A read of one key: the key, and optionally the one source asked. It is
   * the read of the object, projected: no event of its own.
   */
  type SettingsKeyRead = {
      key: string;
      source?: SettingsSource;
  };

  /**
   * One layer a settings read is made of: what one source holds, as that
   * source loads. The engine's merge is a fold over the layers.
   */
  type SettingsLayer = {
      /**
       * Pinned: whose settings these are. `policy` is the managed settings,
       * every managed tier merged; a matcher cannot narrow on it.
       */
      source: SettingsLayerSource;
      /**
       * As a person or an administrator wrote them, so a value may be of any
       * type.
       */
      settings: Settings;
  };

  /**
   * Whose settings one layer of a read holds: a settings source, or `plugin`,
   * the base the enabled plugins' own settings make, beneath `user`.
   */
  type SettingsLayerSource = 'plugin' | SettingsSource;

  /**
   * A read of a settings object: the settings merged over every source, or
   * the one source asked. It names no key.
   */
  type SettingsObjectRead = {
      source?: SettingsSource;
      key?: undefined;
  };

  /**
   * What a `settings.read` call carries to the host: the one source asked,
   * or none for the settings merged over every source.
   */
  export type SettingsReadArgs = {
      /**
       * The one source read, as loaded; absent, the settings merged over every
       * source, as the engine runs under them.
       */
      source?: SettingsSource;
      /**
       * The engine's to fill, for the event (SettingsReadInput): what a call
       * passes here is replaced.
       */
      layers?: readonly SettingsLayer[];
  };

  /**
   * The event `settings.read` as a hook receives it: what was asked, and the
   * layers the answer is made of. One event, one granularity: the whole read.
   *
   * A hook awaits `next(e)` and answers the settings object rewritten; the
   * law it keeps is that its answer is a function of `layers` and of what
   * `next` gave, so the same read gives the same answer.
   */
  type SettingsReadInput = {
      /**
       * Present for a read of one source, as loaded: its one layer.
       *
       * Pinned: changed, the hook fails and is skipped; left out, kept.
       */
      source?: SettingsSource;
      /**
       * What each source holds, lowest precedence first; a source with no
       * settings, or that the engine bars from the read, is left out.
       *
       * The engine's: whatever is passed down in their place, the same ones
       * reach the hooks beneath.
       */
      layers: readonly SettingsLayer[];
  };

  /**
   * `$.settings.read` by what it is asked: a key resolves to that key's
   * value, anything else to a settings object.
   */
  type SettingsReadOverloads = {
      (args: SettingsKeyRead): Promise<unknown>;
      (args?: SettingsObjectRead): Promise<Settings>;
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
   * A value kept with a shape tag, as an `atom` given `{ shape }` keeps it: a
   * reload whose code names another tag reads the value as absent.
   *
   * Declare the key as `Shaped<T>` in PluginState when its atom names a shape;
   * the atom reads and takes `T`.
   *
   * @example
   * interface PluginState { board: { cells: Shaped<Cell[]> } }
   */
  export type Shaped<T> = {
      shape: string;
      value: T;
  };

  /**
   * What an atom given a shape reads and takes for a key declared `Shaped<T>`:
   * `T`; `never` for a key declared otherwise, so that atom does not compile.
   */
  export type ShapedValue<V> = V extends Shaped<infer T> ? T : never;

  /**
   * Where a site's window sits over the tree a hook drew in it (a pane's body,
   * the band): the engine's to move (the person scrolls), the plugin's to read.
   */
  export type SiteScroll = {
      /**
       * The first row of the tree the window showed when the hook was asked; 0
       * at the top. Read-only.
       *
       * A move through `ui.scroll` (the person's, `$.ui.scroll`) asks again. On
       * the terminal the engine's own does not (an end followed, a clamp, a held
       * element kept in view): the next ask reads where the window stands then.
       */
      offset: number;
      /**
       * How many rows of the tree the window may show at once: the rows the
       * surface gave the body, whatever the tree's own height. Read-only.
       */
      bodyRows: number;
  };

  /**
   * Which transcript the person has on screen where a site draws: the main
   * conversation's, or one agent's, opened from the tasks list.
   *
   * A site reads it: a switch re-runs the site's hooks with the new view, the
   * site itself staying where it is. `$.ui.view` takes the same shape to ask
   * for a switch, which only the person's own input brings about.
   */
  export type SiteView = {
      /**
       * The agent whose transcript is in view: the `id` `$.agent.list()` gives
       * it, the `agentId` its `turn.step` and `tool.call` events carry.
       *
       * Absent while the main conversation is in view. Read-only on a site.
       */
      agentId?: string;
  };

  /**
   * What a skill's file declares above its text, parsed and JSON-safe: each
   * key as YAML reads it, none respelled, each value whatever JSON holds.
   *
   * Plain data within its bounds (32 levels, 20,000 values, 100,000
   * characters): a block past them is handed as `{}`. An interface, since a
   * JSON type that is one recursive alias fails where `e` is passed to `next`.
   */
  export interface SkillFrontmatter {
      readonly [key: string]: SkillFrontmatterValue;
  }

  /**
   * A YAML sequence in a skill's frontmatter, as JSON holds it.
   */
  export interface SkillFrontmatterList extends ReadonlyArray<SkillFrontmatterValue> {
  }

  /**
   * One value in a skill's frontmatter: what JSON holds, and assignable to
   * and from `JsonValue`.
   *
   * A date is the text its author wrote. What JSON cannot hold (NaN, an
   * infinity) is null.
   */
  export type SkillFrontmatterValue = null | boolean | number | string | SkillFrontmatterList | SkillFrontmatter;

  /**
   * `skill.prompt`'s input as a call takes it: `frontmatter` and `source` may
   * be left out, as a caller written before the event carried them does.
   *
   * Left out, they read `{}` and `built-in`: a skill with no file. What a
   * call states is the caller's word, which the hooks it reaches are handed.
   */
  export type SkillPromptArgs = Omit<SkillPromptInput, 'frontmatter' | 'source'> & Partial<Pick<SkillPromptInput, 'frontmatter' | 'source'>>;

  /**
   * The input of `skill.prompt`: one skill's prompt, at the moment the engine
   * expanded it for the model.
   *
   * Typed as `/name`, run by the Skill tool, or preloaded into a subagent
   * (named there as its agent wrote it). `text` and `frontmatter` are a hook's
   * to rewrite for the hooks beneath it; the rest is pinned.
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
      /**
       * What the skill's file declares above its text, as its author wrote it: keys
       * as YAML reads them, a remote author's strings scrubbed.
       *
       * No key `__proto__`, `constructor` or `prototype` (left out of a file, the
       * last two named in `frontmatterProblem`). Not the effective grants: a plugin
       * manifest or managed setting may differ; a call's are read at `tool.check`.
       */
      frontmatter: SkillFrontmatter;
      /**
       * Why the file's frontmatter was left out (`{}`), or a key of it: prose for
       * a person, not to match on; absent if handed whole or none exists.
       *
       * The engine refuses nothing for it: a hook that decides on frontmatter
       * is the one to refuse a skill whose problem is set.
       */
      frontmatterProblem?: string;
      /**
       * Whose words these are, in `SkillSource`'s words.
       *
       * A `projectSettings` skill's words are its repository's, wherever its
       * checkout is read (another machine's too), an `mcp` skill's its server's:
       * as loaded, vouched for by none. A call's is the caller's word.
       */
      source: SkillSource;
      /**
       * An installed plugin's name, when the skill comes from one.
       */
      pluginName?: string;
      /**
       * Where the file it was loaded from is, as an absolute path: a skill's
       * SKILL.md, or a command's own `.md` file.
       *
       * As the loader joined it, no link resolved; on a call, the caller's word.
       * Absent with no file on this machine: a built-in, an MCP server's, a
       * plugin command written inline in its manifest.
       */
      path?: string;
  };

  /**
   * What a `skill.prompt` hook returns: the text the model reads for that
   * skill.
   */
  export type SkillPromptResult = {
      text: string;
  };

  /**
   * Whose words a skill is, in the engine's own words: the settings tier whose
   * skills folder holds it, or what else provides it.
   *
   * `built-in` ships in the build, which holds no file: its frontmatter is
   * `{}`. `plugin` comes with a plugin, `mcp` from a server, `syncedSkills`
   * from the account. The list is open: a newer source is a word of its own.
   */
  export type SkillSource = 'userSettings' | 'projectSettings' | 'policySettings' | 'plugin' | 'built-in' | 'mcp' | 'syncedSkills' | (string & {});

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
   * The values `derive`'s function receives for its sources, in their order:
   * an atom's or a derived value's own, a plain reference's or `undefined`.
   */
  export type SourceValues<S extends readonly unknown[]> = {
      [I in keyof S]: S[I] extends Atom<infer V> ? V : S[I] extends Derived<infer V> ? V : S[I] extends StateName<infer P, infer K> ? P extends keyof PluginState & string ? K extends keyof PluginState[P] & string ? StateValue<P, K> | undefined : unknown : unknown : unknown;
  };

  /**
   * A Box's spacing: a number of character cells, the same on every surface,
   * or a step name that each surface sizes its own way. The terminal and VS
   * Code draw a step as cells: across, `xs` and `sm` 1, `md` 2, `lg` 3, `xl` 4;
   * down, `xs` and `sm` 0, `md` and `lg` 1, `xl` 2. Desktop and the phones each
   * use their own spacing scale, so there a step can be larger or smaller than
   * those cells.
   */
  export type Space = number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Options of `$.audio.speak`.
   */
  export type SpeakOptions = {
      /**
       * The system voice's exact name as the platform lists it (`Samantha`, or the
       * name of a voice you installed). Absent: the synthesizer's default voice.
       */
      voice?: string;
      /**
       * Aborting it skips the utterance while it is queued, or cuts it off while
       * it is spoken; either way the promise rejects at once.
       *
       * It rejects with an Error whose message is the abort reason's text and
       * whose name depends on the host: read `signal.aborted` to tell. Already
       * aborted, it rejects so and nothing is queued. A hook on `audio.speak`
       * has it as `next.signal`, and one that answers the call settles it.
       *
       * @example
       * // another hook calls stop.abort() when the person starts talking
       * try { await $.audio.speak(text, { signal: stop.signal }) }
       * catch (error) { if (!stop.signal.aborted) throw error }
       */
      signal?: AbortSignal;
  };

  /**
   * The argument of `$.audio.speak(text, options)` as the event carries it:
   * the signal does not cross.
   */
  type SpeakRequest = {
      /**
       * What to say, as plain text: its first 4096 characters are spoken.
       */
      text: string;
      /**
       * The system voice's exact name (SpeakOptions); absent, the default.
       */
      voice?: SpeakOptions['voice'];
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

  /**
   * Which named value a `$.state` call is about, as it crosses to the host: the
   * owning plugin, the key, and a family member's `id`.
   *
   * The untyped form of a StateRef; identity, pinned on every `next`.
   */
  export type StateAddress = {
      plugin: string;
      key: string;
      id?: string;
  };

  /**
   * What the state library's `read` and `update` take of `$`: its `state` noun,
   * on which they make the calls a hook would make itself.
   */
  export type StateDollar = Pick<CoreEngineInterface, 'state'>;

  /**
   * A key of PluginState that holds one value of type `T` per `id` (one per
   * drawn row, per worker): its reference must carry `id: string`.
   *
   * Only a marker in the registry; no value has this shape. `$.state.get` on a
   * member answers `T`, and a reference to the family without an `id` does not
   * compile.
   *
   * @example
   * interface PluginState { notes: { isOpen: StateFamily<boolean> } }
   */
  export type StateFamily<T> = {
      readonly byId: T;
  };

  /**
   * `e` of `state.get`: one variant per value a contract declares, so a matcher
   * on `plugin` and `key` narrows it; the untyped address while none does.
   *
   * @example
   * on("state.get", { plugin: "swarm" }, ($, e, next) => next(e))
   */
  export type StateGetEvent = [DeclaredPair] extends [never] ? StateAddress : DeclaredEvents<DeclaredPair>['get'];

  /**
   * Which named value: the plugin that owns it and its key there, both
   * literals where a contract declares the value.
   */
  type StateName<P extends string = string, K extends string = string> = {
      readonly plugin: P;
      readonly key: K;
  };

  /**
   * What `$.state.get` answers: the value and the version it stands at; a
   * value never written is `undefined` at version 0.
   *
   * The version goes up by one on every write that lands; hand it back as
   * `ifVersion` to write only if nobody wrote in between.
   */
  export type StateRead<T = unknown> = {
      value: T | undefined;
      version: number;
  };

  /**
   * A typed reference to one named value: the owning plugin and the key, both
   * literals, and for a StateFamily key the member's `id`.
   *
   * Written once as a constant and passed to `$.state.get` and `$.state.set`;
   * `plugin` and `key` must be literals in source so `claude plugin validate`
   * lists what a module reads and writes. Only `id` may be computed.
   *
   * @example
   * const workers = { plugin: "swarm", key: "workers" } as const
   */
  export type StateRef<P extends keyof PluginState & string, K extends keyof PluginState[P] & string> = StateName<P, K> & (PluginState[P][K] extends StateFamily<unknown> ? Readonly<Required<Pick<StateAddress, 'id'>>> : Readonly<Partial<Record<'id', undefined>>>);

  /**
   * `e` of `state.set`: one variant per value a contract declares, so a matcher
   * on `plugin` and `key` narrows `e.value`; the untyped write while none does.
   *
   * `plugin`, `key` and `id` are identity, pinned; `value` is a hook's to
   * rewrite, which is how a plugin that does not own a value changes it.
   *
   * @example
   * on("state.set", DRIVE, ($, e, next) => next({ ...e, value: false }))
   */
  export type StateSetEvent = [DeclaredPair] extends [never] ? StateWrite : DeclaredEvents<DeclaredPair>['set'];

  /**
   * The options of `$.state.set`: `ifVersion` makes the write conditional on
   * the value still standing at that version (compare-and-set).
   */
  export type StateSetOptions = {
      ifVersion?: number;
  };

  /**
   * What `$.state.set` answers: whether the write landed, and the version the
   * value stands at now (a landed write's own, a missed one's the current).
   *
   * `isSet` is false only for a write given `ifVersion` that another write beat;
   * nothing changed then, and a `$.state.get` reads what stands.
   */
  export type StateSetResult = {
      isSet: true;
      version: number;
  } | {
      isSet: false;
      version: number;
  };

  /**
   * The type of the value under key `K` of plugin `P`, as its contract declares
   * it in PluginState; a StateFamily's member type for a family key.
   */
  export type StateValue<P extends keyof PluginState & string, K extends keyof PluginState[P] & string> = PluginState[P][K] extends StateFamily<infer Member> ? Member : PluginState[P][K];

  /**
   * A `$.state.set` as it crosses to the host and as its hooks see it when no
   * contract declares the value: the address, the value, and the condition.
   *
   * `previous` is the host's, put on `e` ahead of every hook: what stood there
   * when the write was raised.
   */
  export type StateWrite = StateAddress & {
      value: unknown;
      previous?: unknown;
      ifVersion?: number;
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
   * Two events stream: `turn.step`, the model's response arriving in pieces,
   * where a hook that saw it whole could not change what had already been
   * shown; and `process.spawn`, a call on `$` whose child's output arrives in
   * pieces for as long as the child runs.
   */
  export type StreamingEventName = 'turn.step' | 'process.spawn';

  /**
   * The rest of the chain as a hook on a streaming event receives it: Next,
   * except that `next(e)` is the stream beneath (HookStream), not a promise.
   *
   * Each call opens a fresh stream (for `turn.step` a model request, for
   * `process.spawn` a child), so a hook that calls it twice makes two. Not
   * calling it yields the hook's own chunks and result; nothing beneath runs.
   *
   * @template S what `next.is(pattern, e)` narrows `e` to, as Next's
   * @see HookBudget `ms`: the hook's budget counts its own code, never a wait
   * at a `yield` or on this stream, however long the response beneath takes
   */
  export type StreamNext<N extends StreamingEventName = StreamingEventName, E = Args<N>, O = EventResult<N>, S extends {
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
   * an optional `hover`, the group stamp a `hover.scope` earns, the mark of
   * the plugin whose drawing starts there, and children.
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
       * Whose part of the drawing starts here, set by the engine on each hook's
       * returned root. A hook's own mark is kept; another plugin's at most as
       * often as `next(e)` handed it, and it may move. It proves no author.
       */
      part?: PluginStamp;
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
   * (the engine bounds it; the desktop draws it as an image, or in a sandboxed
   * frame when `isInteractive`; the editor as an image; the mobile app in a
   * web view).
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
       * The editor ignores it and always draws an image, where SMIL and CSS
       * animation can run but hover, CSS `:hover` and `<title>` tooltips never
       * work.
       *
       * It never enables script or event-handler attributes (the frame has no
       * allow-scripts and the scrub strips them); presses that other plugins
       * should observe go on an enclosing element.
       */
      isInteractive?: boolean;
  };

  /**
   * The keys among `Among` a matcher may select variants of `I` by: valued by
   * literals in every variant, one literal per variant (IsDiscriminant).
   *
   * Asked of each key given and of no other: of a matcher's own keys, never
   * of every key of every variant.
   */
  type TagKeys<I, Among> = Among extends MatcherKeys<I> ? IsLiteralValued<MatcherValueOf<I, Among>> extends true ? IsDiscriminant<I, Among> extends true ? Among : never : never : never;

  /**
   * A tier `next.to(e, tier)` may name: one a floor can reach past links of
   * less authority to, so never `prepend`, which nothing skips to; `user` is
   * for a prepend hook alone, and skips the peers below it.
   */
  export type TargetTier = Exclude<Tier, 'prepend'>;

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
   * One attribute of a collector record, as the collector receives it.
   */
  export type TelemetryAttribute = string | number | boolean | readonly string[];

  /**
   * A string property of a first-party row: the value and the list it is
   * chosen from, so no free text reaches a row.
   *
   * Every member of `of` is a lowercase token of letters, digits, `_` and `-`,
   * at most 32 of them; `value` is one of them.
   *
   * @example
   * const page = { value: "ready", of: ["ready", "later"] }
   */
  export type TelemetryChoice = {
      /**
       * What the row carries, one member of `of`.
       */
      value: string;
      /**
       * Every value the property may take.
       */
      of: readonly string[];
  };

  /**
   * Where a telemetry record goes: `anthropic`, Anthropic's first-party
   * analytics, or `collector`, the one the session's operator configured.
   *
   * A closed union and the record's identity: `e.to` reads the same at every
   * hook as it was raised, so a hook may rewrite what a record carries, never
   * redirect or copy it. A hook picks its stream with the matcher.
   *
   * @example
   * on("telemetry.log", { to: "collector" }, ($, e, next) => next(e))
   */
  export type TelemetryDestination = 'anthropic' | 'collector';

  /**
   * What a call of `$.telemetry.log` passes: a first-party row, `to` optional,
   * or a collector record.
   */
  export type TelemetryLogArgs = TelemetryRowArgs | TelemetryRecordEntry;

  /**
   * The input of `telemetry.log`: one record about to be logged to the
   * destination `to` names, which is always present and pinned.
   */
  export type TelemetryLogInput = TelemetryRowEntry | TelemetryRecordEntry;

  /**
   * What a `telemetry.log` hook returns and `next(e)` resolves to:
   * `{ value: undefined }`, or `{ deny }`, which rejects the caller's promise.
   */
  export type TelemetryLogResult = ValueOrDeny<undefined>;

  /**
   * The input of `telemetry.mark`: one use of a feature, as the CLI's own
   * feature events mark one.
   *
   * A mark takes no `to`: it always means `anthropic`.
   */
  export type TelemetryMarkInput = {
      /**
       * Which feature was used, by its snake_case name.
       */
      feature: string;
      /**
       * How the use went (TelemetryMarkKind).
       */
      kind: TelemetryMarkKind;
      /**
       * Why it went so, as a short token.
       */
      reason?: string;
      /**
       * The mark's properties, by name.
       */
      props?: Readonly<Record<string, TelemetryProp>>;
  };

  /**
   * How one use of a feature went, as the CLI's own feature events count it.
   *
   * `ok`: used, the person got what they asked. `sad`: degraded, they still
   * got something. `bad`: failed, they got nothing.
   */
  export type TelemetryMarkKind = 'ok' | 'sad' | 'bad';

  /**
   * What a `telemetry.mark` hook returns and `next(e)` resolves to:
   * `{ value: undefined }`, or `{ deny }`, which rejects the caller's promise.
   */
  export type TelemetryMarkResult = ValueOrDeny<undefined>;

  /**
   * One property of a first-party row or a mark: a number, a boolean, or a
   * string chosen from a list (TelemetryChoice).
   */
  export type TelemetryProp = number | boolean | TelemetryChoice;

  /**
   * A record for the telemetry collector the session's operator configured.
   */
  export type TelemetryRecordEntry = {
      /**
       * The operator's collector. Pinned.
       */
      to: 'collector';
      /**
       * The record's event; it leaves named `claude_code.<event>`.
       */
      event: string;
      /**
       * The record's attributes; they go out as they stand, in the order
       * written.
       */
      attributes: Readonly<Record<string, TelemetryAttribute>>;
      /**
       * When it was logged: an ISO 8601 instant to the millisecond.
       */
      loggedAt: string;
      /**
       * Where in a trace the record belongs, when it belongs to one.
       */
      span?: TelemetrySpan;
  };

  /**
   * A first-party row as a call passes it: `to` left out reads as
   * `anthropic`.
   */
  export type TelemetryRowArgs = {
      /**
       * The destination, Anthropic's first-party analytics; optional here.
       */
      to?: 'anthropic';
      /**
       * The row's event name.
       */
      event: string;
      /**
       * The row's properties, by name.
       */
      props?: Readonly<Record<string, TelemetryProp>>;
  };

  /**
   * A first-party row as a hook reads it: `to` is always present, the engine
   * having completed it before any hook or matcher reads `e`.
   */
  export type TelemetryRowEntry = {
      /**
       * Anthropic's first-party analytics. Pinned.
       */
      to: 'anthropic';
      /**
       * The row's event name.
       */
      event: string;
      /**
       * The row's properties, by name.
       */
      props?: Readonly<Record<string, TelemetryProp>>;
  };

  /**
   * The span a collector record belongs to, as W3C trace context spells it:
   * the ids in lowercase hex.
   */
  export type TelemetrySpan = {
      /**
       * The trace's id, 32 hex digits.
       */
      traceId: string;
      /**
       * The span's id, 16 hex digits.
       */
      spanId: string;
      /**
       * Bit 0 set when the trace is sampled, as W3C trace context spells it.
       */
      traceFlags: number;
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
      color?: Color;
      backgroundColor?: Color;
      dimColor?: boolean;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      inverse?: boolean;
  };

  /**
   * The props of `Text`: colors, styles, and the size, weight, face and digits
   * each surface draws its own way. Colors are a theme key or a raw color.
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
      color?: Color;
      backgroundColor?: Color;
      /**
       * The run dimmed: on the terminal, drawn in the theme's dim color.
       *
       * Faint too where that color is the palette's own white or black, as
       * plain text is, unless the run is bold, inverse or on a background of
       * any other color.
       */
      dimColor?: boolean;
      /**
       * The text size, a step on a scale each surface maps to its own type sizes.
       *
       * Absent, the enclosing Text's, or `body`. The terminal has one size and
       * ignores it.
       */
      size?: 'caption' | 'footnote' | 'body' | 'heading' | 'title';
      /**
       * How heavy the text is, drawn at the nearest weight the surface has.
       *
       * Absent, the enclosing Text's. The terminal draws `semibold` and `bold`
       * as bold and cannot draw a lighter weight inside a bold Text.
       */
      weight?: 'regular' | 'medium' | 'semibold' | 'bold';
      /**
       * The surface's monospaced face at the same size. The terminal is always
       * monospaced and ignores it.
       */
      mono?: boolean;
      /**
       * Digits of one width, for a number that changes by itself on screen (a
       * timer, a percentage) or numbers stacked in a column to line up.
       *
       * The terminal's digits are already one cell each.
       */
      tabular?: boolean;
      /**
       * The older spelling of a semibold weight.
       *
       * @deprecated Use `weight`. `bold: true` is read as `weight: 'semibold'`,
       * and an explicit `weight` outranks it; a `hover`'s `bold` still applies.
       */
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      inverse?: boolean;
      /**
       * The direction the text reads in: `rtl` for a right-to-left script, so a
       * row of it that opens with a Latin word or a number reads right to left.
       *
       * Absent, each row reads by its first strong letter. Where the engine
       * orders the letters itself, `rtl` rows are also flush right; a terminal
       * that reorders text by itself draws the Text exactly as without `dir`.
       */
      dir?: 'ltr' | 'rtl';
      wrap?: 'wrap' | 'end' | 'middle' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';
  };

  /**
   * The `backdrop` attribute of `$.theme.set`: what is behind the conversation.
   * `scene` makes a live scene, and `color`, `gradient` or `vector` make a still
   * ground. All of them are pure vector, with no embedded pictures or fonts.
   */
  export type ThemeBackdrop = ThemeScene | ThemeGround;

  /**
   * How a surface keeps its text readable over a backdrop: the desktop app
   * frosts its own panels, and the mobile app lays one veil over the backdrop.
   * Each key absent takes the surface's default, so `{}` is the default glass.
   */
  export type ThemeBackdropGlass = {
      /**
       * How far the backdrop blurs behind a panel, in points: 0 to 64. Absent, 16.
       */
      blur?: number;
      /**
       * What colors a panel or veil over the backdrop: a raw color, `#hex` or `rgb()`,
       * `rgba()`, `hsl()` or `hsla()` of numbers; a theme key or a name is refused.
       * Absent, the surface's own panel color.
       */
      tint?: string;
      /**
       * How opaque the tinted panel or veil is over the backdrop: 0 to 1. Absent,
       * 0.6.
       */
      opacity?: number;
  };

  /**
   * A color in a still `backdrop`. A surface uses a raw color as it is, works out a
   * name from the look's `colors` in the look's mode, or from the app's own colors where
   * the look gives none, and refuses the ground over anything else. Annotate a color kept
   * in an object or a list with this type, or it widens to `string`.
   */
  export type ThemeColor = ThemeColorName | 'transparent' | `#${string}` | `rgb${string}` | `hsl${string}`;

  interface ThemeColorGround extends ThemeGroundBase {
      /**
       * The one color of the ground.
       */
      color: ThemeColor;
      gradient?: never;
      vector?: never;
  }

  /**
   * One mode's colors in `ThemeColors`: a six-digit hex color such as `#1e1e2e`
   * under the name of each design system token the theme sets. The type checks
   * the leading `#` alone.
   *
   * The names are the design system's, so the type lists none. A surface keeps its own color for a token that is left out.
   */
  export type ThemeColorInputs = {
      [token: string]: `#${string}`;
  };

  /**
   * The design system's color names. A surface works each one out from the look's
   * `colors`, so one rule serves light and dark.
   * A name is not a key of `colors`, and a `ThemeKey` from a drawn tree isn't one of
   * these names. In the stock palette `fill-primary` is near-black in light and
   * near-white in dark, not the brand color.
   */
  export type ThemeColorName = 'surface-0' | 'surface-1' | 'surface-2' | 'surface-3' | 'text-primary' | 'text-secondary' | 'text-muted' | 'text-disabled' | 'fill-primary' | 'on-primary' | 'border' | 'border-strong' | 'border-stronger' | 'fill-accent' | 'text-accent' | 'bg-accent' | 'on-accent' | 'border-accent' | 'fill-danger' | 'text-danger' | 'bg-danger' | 'on-danger' | 'border-danger' | 'fill-success' | 'text-success' | 'bg-success' | 'on-success' | 'border-success' | 'fill-warning' | 'text-warning' | 'bg-warning' | 'on-warning' | 'border-warning' | 'fill-pro' | 'text-pro' | 'bg-pro' | 'on-pro' | 'border-pro';

  /**
   * The `colors` attribute of `$.theme.set`: a whole palette as JSON data, for a
   * surface to paint itself with, where it reads one.
   *
   * Its token names are the design system's, and a wrong one paints nothing. A palette kept in a constant is annotated with this type, or its
   * `v` and its colors widen and no longer fit.
   *
   * The engine holds `colors` only to bounded JSON data with no key `__proto__`,
   * `constructor` or `prototype` and no named key on a list, so a surface judges what
   * it reads, and so does a `theme.set` hook over another mod's call. A surface refuses
   * a whole palette whose text contrast is too low, and `isDrawn` stays true.
   */
  export type ThemeColors = {
      /**
       * The version of this shape.
       */
      v: 1;
      /**
       * The id the palette was made with.
       */
      id?: string;
      /**
       * The palette's name, for a surface to show: 1 to 64 characters.
       */
      label: string;
      /**
       * The colors for a surface's light mode, and for its dark mode. Give one alone
       * and a surface acts as if `overrideColorScheme` named that mode. Where it names
       * the other, the surface keeps its own colors.
       */
      inputs: {
          light?: ThemeColorInputs;
          dark?: ThemeColorInputs;
      };
      /**
       * The code highlighting theme to pair with each mode, by name. A surface
       * keeps its own for a name it does not offer.
       */
      codeTheme?: {
          light?: string;
          dark?: string;
      };
      /**
       * `more` asks for stronger borders and focus rings, as a high contrast theme
       * needs. Absent, the surface's own.
       */
      contrast?: 'more';
  };

  /**
   * Colors that run across their box.
   */
  interface ThemeGradient extends ThemeTiling {
      /**
       * Two to 16 colors, evenly spaced, or `{ at, color }` with `at` from 0 to 1. A
       * bare color in a list with `at` stops takes the place its index gives, and the
       * places must run in order, or the gradient is refused.
       */
      stops: readonly (ThemeColor | {
          at: number;
          color: ThemeColor;
      })[];
      /**
       * Degrees from -360 to 360, as in CSS: 0 runs up, 90 runs right and 180, the
       * default, runs down.
       */
      angle?: number;
      /**
       * `radial` makes an ellipse out to the edges of its box, and ignores `angle`.
       * Absent, `linear`.
       */
      shape?: 'linear' | 'radial';
  }

  interface ThemeGradientGround extends ThemeGroundBase {
      gradient: ThemeGradient;
      color?: never;
      vector?: never;
  }

  /**
   * A still ground behind the conversation: a flat color, a gradient or a drawing in
   * paths. A scene draws what moves, and any other pattern. There is no picture ground
   * for now, so redraw a picture as SVG.
   *
   * @example
   * backdrop: { gradient: { stops: ['surface-0', 'surface-2'] } }
   */
  export type ThemeGround = ThemeColorGround | ThemeGradientGround | ThemeVectorGround;

  /**
   * A scene's keys, which no ground has.
   */
  interface ThemeGroundBase {
      /**
       * A scene's key, which no ground has.
       */
      scene?: never;
      /**
       * A scene's key, which no ground has.
       */
      glass?: never;
  }

  /**
   * The theme keys named for what a color means: text, status, the prompt box
   * and its modes, and diffs, as the custom theme reference lists them.
   *
   * A tree that names one follows the person's theme. Another key the theme
   * holds resolves too, typed as any string is (Color).
   */
  export type ThemeKey = 'text' | 'inverseText' | 'inactive' | 'subtle' | 'suggestion' | 'remember' | 'success' | 'error' | 'warning' | 'merged' | 'claude' | 'permission' | 'planMode' | 'autoAccept' | 'promptBorder' | 'bashBorder' | 'ide' | 'diffAdded' | 'diffRemoved' | 'diffAddedDimmed' | 'diffRemovedDimmed' | 'diffAddedWord' | 'diffRemovedWord';

  /**
   * What `$.theme.set` and `$.theme.clear` resolve to, and what a `theme.set` or
   * `theme.clear` hook's `{ value }` holds.
   *
   * A theme that was set stands for the session either way, so a surface that
   * attaches later draws it; a clear resolves `isDrawn: false` with its reason.
   *
   * @example
   * const set = await $.theme.set({ backdrop: { scene: "lagoon" } })
   */
  export type ThemeResult = {
      /**
       * True: a client that says it draws the theme is attached. It says nothing of
       * whether that client paints `colors`, follows `overrideColorScheme` or draws
       * each part of a look.
       */
      isDrawn: true;
      /**
       * `backdrop`, the `e.requestId` of every backdrop at `ui.render`, where
       * `e.props.scene` and `e.props.plugin` say which; `theme` with no scene, a
       * still ground included.
       */
      requestId: string;
  } | {
      /**
       * False: a client it needs is missing, or the theme was cleared. `reason`
       * says which.
       */
      isDrawn: false;
      /**
       * The theme's request id, when it stands for a surface yet to attach.
       */
      requestId?: string;
      /**
       * Why nothing draws it, one line to show or log.
       */
      reason: string;
  };

  /**
   * A live scene: what `ui.render` answers for `Backdrop`, and how the surface
   * frosts its panels over it.
   */
  export type ThemeScene = {
      /**
       * Names the scene among this plugin's: 1 to 64 of letters, digits, `_` and `-`.
       * A `ui.render` hook reads it as `e.props.scene`.
       */
      scene: string;
      /**
       * How the surface frosts its panels over the backdrop: absent, the default
       * glass; `false`, the panels stay as they are.
       */
      glass?: ThemeBackdropGlass | false;
      /**
       * A ground's key, which no scene has.
       */
      color?: never;
      /**
       * A ground's key, which no scene has.
       */
      gradient?: never;
      /**
       * A ground's key, which no scene has.
       */
      vector?: never;
  };

  /**
   * The argument of `$.theme.set`: one object of named attributes, so a later
   * attribute is an addition and never a change of the call.
   *
   * A set names the whole theme, so what it leaves out is gone, and it names at
   * least one attribute. An attribute the build does not know is refused by
   * name, never dropped.
   */
  export type ThemeSetArgs = {
      /**
       * What is behind the conversation: a live scene or a still ground. Absent, the
       * app's own.
       */
      backdrop?: ThemeBackdrop;
      /**
       * Overrides the person's own mode with `light` or `dark`, so a surface can draw
       * its own text to suit. Absent, a surface
       * acts as if it named the only mode `colors.inputs` gives, else the person's own
       * stands. Set it for a look or a scene made for one mode, where `colors` gives
       * both.
       */
      overrideColorScheme?: 'light' | 'dark';
      /**
       * Every surface, word and line of the app, in each mode, by the design system's
       * token names. The engine doesn't read it, so a wrong name paints nothing and says
       * nothing.
       */
      colors?: ThemeColors;
  };

  /**
   * How a drawing or a gradient lies in its box.
   */
  interface ThemeTiling {
      /**
       * `[width, height]` in points, such as `[24, 8]`: the box one copy fills under
       * `repeat`, each side from 1 to 256. Absent, a drawing takes its own
       * size, and a gradient fills its box.
       */
      size?: readonly [number, number];
      /**
       * Tiles the art at its size.
       * Absent, a drawing or a gradient stretches to the box.
       */
      repeat?: boolean;
  }

  /**
   * A drawing in SVG path data, the text of a path's `d` attribute.
   */
  interface ThemeVector extends ThemeTiling {
      /**
       * A square's side, or `[width, height]`, from 1 to 256.
       */
      viewBox: number | readonly [number, number];
      /**
       * At most 64 paths. A string or `{ d }` is filled by the even-odd rule, and
       * `{ d, strokeWidth }` is stroked at a width that doesn't scale, above 0 and at
       * most 64. A surface refuses a ground whose `d` isn't whole path data of at most
       * 16,384 characters, with no number past 1,000,000 either way.
       */
      paths: readonly (string | {
          d: string;
          strokeWidth?: number;
          color?: ThemeColor;
      })[];
      /**
       * Each path's color, where it names none of its own: a path with neither draws
       * nothing, and a surface refuses a drawing left with no path.
       */
      color?: ThemeColor;
  }

  interface ThemeVectorGround extends ThemeGroundBase {
      vector: ThemeVector;
      color?: never;
      gradient?: never;
  }

  /**
   * One of the chain's five tiers (TIERS), outermost first; on every
   * `next.trace` entry, and what `next.to(e, tier)` names.
   *
   * `prepend` and `append` are the managed plugins an administrator lists. With
   * no managed settings, they are a person's own plugins listed in user settings,
   * except where plugin-authoring's reference says that list is set aside. `user`
   * is every other plugin a person installs, `builtin` the plugins bundled in the
   * binary, `core` the engine's innermost link.
   *
   * Under an organization's managed settings, a mod from a marketplace with a
   * remote source (`github`, `git`, `url` or inline `settings`) takes the
   * organization's tier when those settings do three things: set it true in
   * `enabledPlugins`, declare that marketplace in `extraKnownMarketplaces`, and
   * list it in `prependPlugins` or `appendPlugins`. Missing any of the three, it
   * stays in `user`. A marketplace's `pluginDigests` is deprecated and ignored, so
   * a new release reaches machines with no settings change.
   *
   * Claude Code stores a hash (`copyHash`) on a listed mod's install record when it
   * writes a copy from the marketplace's declared origin that fits this build, and
   * checks the copy against it at each load, so an edit made after that is caught.
   * A copy that doesn't match is fetched afresh once before the first turn. Some
   * starts run no fetch, such as `--bare` or a session with hooks modules off
   * (`--safe-mode`, a managed `disableAllHooks`). Where a fetch
   * ran and the copy still isn't mended, the session carries on and the debug log
   * says `listed mod <id> does not run in this session: <why>`. A copy that doesn't
   * match runs without its hooks module, and a copy outside its
   * `engines["claude-code"]` range is off whole.
   */
  export type Tier = (typeof TIERS)[number];

  /**
   * The chain's five tiers, outermost first: earlier is outer is more
   * authority, and same-event hooks nest in this order and no other way.
   *
   * `Tier` says which plugins are in each; a built-in's `$` calls still raise
   * everywhere.
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
   * The input of `tool.call` and `tool.run`: the tool, the call's id, the tool's
   * arguments beside them (`e.command` for Bash), and `agentId` in a subagent.
   *
   * A union discriminated by `tool`: after `if (e.tool === "Bash")`, `e.command`
   * is a string and a rewrite is checked against Bash's schema. `tool`,
   * `tool_use_id` and `agentId` are reserved: a rewrite of any is refused.
   * `requestMeta` is a hook's to set (ToolRequestMeta). `tool.run` pins it all.
   */
  export type ToolCallInput = ToolCallEnvelope & AgentLoop & ToolRequestMeta;

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
   * What a `tool.call` or `tool.run` hook returns and what `next(e)` and
   * `$.tool.call(input)` resolve to: `{ result, context? }` or `{ deny }`.
   *
   * From core the result is `{ ref, result, text }` or, when the tool reported
   * an error, `{ ref, result, text, isError }`, either with `isReadOnly` when
   * the tool held the input it ran read-only; `ref` names core's messages.
   *
   * @template Name the tool the call went to, typing `result` per built-in
   *   tool (BuiltinToolResults) once `e.tool` is narrowed; else `unknown`
   */
  export type ToolCallResult<Name extends string = string> = {
      /**
       * Refuses the call: the model receives the text as an error result.
       * Absent when the call was answered.
       *
       * Returned after the tool answered without error it withholds that
       * result and undoes nothing: in its place the model reads `<tool> ran,
       * and a plugin withheld its result: <text>`.
       */
      deny: string;
      result?: undefined;
      context?: undefined;
      ref?: undefined;
      text?: undefined;
      isError?: undefined;
      isReadOnly?: undefined;
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
       * sees. From core, none; what `tool.run`'s hooks attach goes ahead of it.
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
      /**
       * Set by core, present only when the tool held the input it executed
       * read-only by its own check (the one its permissions use).
       *
       * It speaks for this call as run, rewrites included, not for calls it
       * causes (a subagent's tools raise their own `tool.call`); for an MCP
       * tool, its server's declaration. Bash `ls`: set; a hook's own: never.
       */
      isReadOnly?: true;
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
      /**
       * As on an answered result: the tool held the input it ran read-only.
       */
      isReadOnly?: true;
      deny?: undefined;
  };

  /**
   * Who answers the asks of a `tool.check` evaluation.
   *
   * `host`, the program that answers a hosted session's asks or a served call's
   * own session; `person`, a dialog or a card the person answers.
   */
  type ToolCheckApprover = 'host' | 'person';

  /**
   * `tool.check`'s input as `$.tool.check` takes it: the tool and its arguments;
   * the call's id, `agentId`, ceiling, approver and `isReadOnly` are the
   * engine's to set.
   */
  type ToolCheckArgs = Pick<ToolCheckInput, 'tool' | 'input'>;

  /**
   * The verdict of `tool.check`: run the tool, put it to the mode's decider
   * (the dialog, the auto-mode classifier, a headless host) or, a hook's ask, to
   * a person, or refuse it.
   */
  type ToolCheckDecision = 'allow' | 'ask' | 'deny';

  /**
   * The input of `tool.check`: the tool, its arguments, the organization's
   * ceiling if it set one, and on a real call its id and the loop's `agentId`.
   *
   * All are the question's identity and are pinned: a hook decides about
   * this call, it does not change it (`tool.call` rewrites a call). A
   * `$.tool.check` query is asked outside any loop and carries no `agentId`.
   */
  type ToolCheckInput = {
      /**
       * As the model names it (`Bash`, `mcp__server__tool`); the key a matcher
       * narrows on.
       *
       * A matcher on any name the host declares for the tool admits it.
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
      /**
       * The id of the loop the call is decided in, on a real call inside a
       * subagent's or a teammate's loop: the one its `tool.call` carried.
       *
       * Absent on the main loop and on a query. Which loop, not which plugin
       * caused the call (that is `next.origin`).
       */
      agentId?: string;
      /**
       * The most permissive verdict the organization lets a call of the tool
       * reach (`ask`), as its administrators set it on a connector's tool.
       *
       * Set by the engine, from the tool, never by a query, and pinned. A
       * hook's own `ceiling`, on its answer, is dropped. Absent where none is
       * set.
       */
      ceiling?: ToolCheckDecision;
      /**
       * Who answers this evaluation's asks, known before any hook runs.
       *
       * `host` where a host's permission callback does, `person` where a person
       * can be asked, a pane's card included; absent where nobody can be. Pinned.
       */
      approver?: ToolCheckApprover;
      /**
       * Set by the engine, present only when the tool's own `isReadOnly` holds
       * this input read-only, and pinned; a matcher can select reads, never writes.
       *
       * Absent also means the tool cannot say: a careful hook reads it as a write.
       * It is the tool's word, no proof of no effect (a fetch, a sent message, an
       * agent that delegates all say it); an MCP tool's is its server's, unproven.
       */
      isReadOnly?: true;
  };

  /**
   * What a `tool.check` hook returns and what `next(e)` resolves to: the
   * verdict, why, and what stands behind it, never who answers it.
   *
   * From core, the engine's declarative decision for the session's mode and
   * rules. A hook may answer any verdict in either direction; the last word up
   * the chain is the decision.
   */
  type ToolCheckResult = {
      /**
       * `allow` runs the tool; `ask` puts it to the mode's decider, or to a
       * person when a hook made it (`plugin`); `deny` refuses it, the reason the
       * model's error.
       *
       * For a tool that requires the person (a question put to them, a plan to
       * approve) a hook only tightens: its `allow` does not dismiss the dialog.
       * In plan mode a hook only tightens a call not shown to be a read, too.
       * For a tool only auto mode's classifier may allow (a subagent's report) a
       * hook's `allow` is ignored and core's verdict stands, except on a mod's
       * own `$.tool.call`.
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
      /**
       * The classic hook event that decided, or whose ask the verdict was reached
       * under (`PreToolUse`), whoever configured the hook.
       *
       * Absent on a `$.tool.check` query, which runs no classic hook.
       */
      hook?: string;
      /**
       * The key of the option whose own check asked, whoever configured it
       * (`permissions.blockReadsOutsideWorkingDirectories`).
       *
       * From core, for the read block: its ask on a shell command that reads
       * outside the working directories or, the block on, leaves the sandbox.
       */
      setting?: string;
      /**
       * The plugin whose hook made this ask, set by the engine and pinned:
       * whatever a hook writes here is dropped.
       *
       * On an `ask` a hook answered, rewording included; one it hands up as it
       * heard it keeps what it carried, so core's own names none. Such an ask is
       * a person's: the dialog, the host's callback or a PermissionRequest hook
       * answers. No classifier's allow settles it, its block still refuses, and
       * a rule for the whole tool is not kept; a narrower rule the person saves
       * is theirs and settles nothing while the hook asks. Where nobody can be
       * asked it is a deny, this verdict's reason the model's error. A tool no
       * prompt is raised for keeps its own rule. A hook above may answer anything
       * over it.
       */
      plugin?: string;
      /**
       * The most permissive verdict the organization lets a call of the tool
       * reach (`ask`), as its administrators set it on a connector's tool.
       *
       * The question's own (`e.ceiling`), set by the engine, from the tool, on
       * every verdict for it, core's and each hook's alike: a hook's own
       * `ceiling` is dropped. Where the question has none, it is the one that
       * core's check found for this call, on core's verdict and on each hook's
       * that asked beneath. Absent where none is set.
       */
      ceiling?: ToolCheckDecision;
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
       * unless a rule keeps it in front (a plugin's `$.tool.register` tool
       * whose spec says `isDeferred: false` is kept in front).
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
      /**
       * The MCP server this tool comes from, off the connection that listed it, so
       * no config file need be read and a server added at runtime is covered.
       * Absent on any other tool, a built-in or a `tool.list` hook's among them, and
       * on an MCP tool whose server facts are not known. Pinned: a rewrite that
       * changes or adds it is refused, and one that leaves it out has it restored.
       */
      mcpServer?: ToolMcpServer;
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
      /**
       * Sends a changed description or placement at the next turn, rewriting the
       * whole prompt cache and dropping the model's earlier thinking.
       *
       * Left out, a description waits for a new thread or a compaction, and a
       * placement for a new thread or `/clear`, as a compaction keeps the tool block.
       */
      breakPromptCache?: boolean;
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
   * One tool as `$.tool.list()` returns it and a `tool.list` hook answers it.
   *
   * What the hooks answer the engine's own raise is the session's tool pool: for
   * the model, every agent, foreground or background, ToolSearch and `$.tool.call`,
   * which also reaches a tool only a deny rule or a `blocked` ceiling hides, but a
   * hook's removal stops it. A removal deletes the tool from the session, for mods
   * too, even one a deny rule or a ceiling also hides, while a deny rule or a
   * ceiling stops only the model and its agents.
   * The tools of an MCP server that joins later are asked about before a request
   * carries them. What the hooks answer a mod's `$.tool.list()` is only what that
   * call reads. `next(e)` holds the tools as the engine built them, with what an
   * earlier answer removed and without what it added, so answer the whole list
   * each time. The order of the list is ignored, so that the prompt cache holds.
   *
   * The engine raises the event before a thread's first request, once a load of
   * hooks modules is over or 10 seconds have passed, and again when the loaded
   * plugins, the names of the tools or a setting change, or at the turn after
   * `$.ui.invalidate('tool.list')`. It never raises it per turn: a pool that moves
   * breaks the prompt cache.
   *
   * Leave an entry out and the tool goes, with what a deny rule on it takes out;
   * what such a rule brings back, such as Glob and Grep without Bash, is asked
   * about too. A tool no deny rule can leave out stays while any other does. A
   * call of a removed tool is refused, by a script, an agent, the host's `mcp_call`,
   * an `mcp_tool` settings hook or a Monitor poll, and a running watch of it ends.
   * Those last three don't wait for a hooks load, so one made before a module has
   * loaded isn't refused by what that module removes. A tool a thread already
   * declared stays declared until a compaction, so as not to break the prompt
   * cache, and a call of it is refused saying why. `$.ui.ask` and `$.agent.spawn`
   * are the host's: removing their tools does not reach them.
   *
   * Add `{ name, description, mcp: false, inputSchema? }` under a new name and the
   * tool joins, checked as `$.tool.register` checks a spec: an entry that fails is
   * left out. A `tool.call`
   * hook on its name answers its calls, with no permission prompt; a call no hook
   * answers is a tool error naming it. A schema the API refuses is declared with no
   * parameters. New words reach a thread at its next compaction. An `mcp__` name, a
   * name a request declares itself (`advisor`, `DeferredToolPlaceholder`), or a
   * tool's or a built-in's name in any case or with its words apart, on or off,
   * cannot be added. An entry with the name or alias of a tool that exists leaves
   * that tool as it is: `tool.describe` changes a description. A deny rule, a
   * `--tools` list and an agent's `tools:` hold over an added tool as over any
   * other, a deny rule for the model and its agents alone (`$.tool.call` says so),
   * and a real tool takes its name when it joins.
   *
   * A hook that throws, crashes or runs past its 10-second budget is skipped, unless
   * its `.catch` answers: the answer is what the others said, without what the hook
   * removed or added on any run, and the event is raised again at the next turn. So
   * is one whose `$` ops hold it past 30 seconds in all: they are aborted. A crash
   * traced to a mod can unload it, and a mod's removals lapse when it is unloaded,
   * with no retry owed. A `{ deny }` or a list with nothing in it to read
   * leaves the last answer standing, and the event is raised again at the next turn.
   * A turn waits at most 10 seconds for a raise, then goes on with the answer that
   * stood, or the tools as built before the first; the raise goes on, and its answer
   * counts unless a later raise has answered. A `$.tool.call` of a `tool.list` hook
   * doesn't wait for the raise: the other hooks are asked about it, and a list that
   * leaves the tool out refuses it, as does a removal that stood; an agent the hook
   * spawns reads the answer that stood, or the tools as built on the first raise.
   * `$.prompt.submit` and `$.command.run` are refused there.
   *
   * Where sec-default is seated, a person's hook can't remove a tool of the
   * organization's managed MCP servers or seated plugins, or bring back a tool an
   * organization's hook removed. Its addition is dropped while managed
   * `allowedMcpServers` is set, or where the name reads as a tool the organization
   * delivers. A person's hook that overruns or crashes is skipped and sec-default
   * still answers, though that hook can delay the answer. The engine puts no other
   * limit on the answer; a policy is a mod's to hold.
   *
   * @example
   * on('tool.list', async ($, e, next) => {
   *   const listed = await next(e)
   *
   *   return listed.value === undefined
   *     ? listed
   *     : { value: listed.value.filter(t => t.name !== 'AskUserQuestion') }
   * })
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
      /**
       * On an entry a `tool.list` hook adds: a JSON schema object for the input
       * (`{ type: "object", properties, required }`), default `{ type: "object" }`
       * as on `$.tool.register`. Never on a tool the session lists.
       */
      inputSchema?: Record<string, unknown>;
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
   * The input of `tool.judge`: `tool.check`'s question about a real call. All
   * of it is pinned.
   */
  type ToolJudgeInput = ToolCheckInput & {
      /**
       * The call being judged: the id its `tool.call` and `tool.check` carried.
       *
       * `next.origin` names a plugin only on its own `$.agent.call`, where its
       * allow stands in the classifier's place; on any other call, the engine.
       */
      tool_use_id: string;
  };

  /**
   * What a `tool.judge` hook returns and what `next(e)` resolves to: a verdict
   * on one call, why, and whose it is.
   */
  type ToolJudgeResult = {
      /**
       * From the classifier: `allow` and `deny` are its verdict, `ask` says it
       * gave none (an outage, a conversation too long, a session without one).
       *
       * From a hook: `deny` refuses the call, `ask` puts it to a person (a deny
       * where nobody can be asked), and `allow` runs it in the classifier's place
       * on a call this plugin made with `$.agent.call` and no hook rewrote. Any
       * other allow is held to what a `tool.check` hook's is, and so is one on a
       * write in plan mode or a call auto mode always judges by itself.
       */
      decision: ToolCheckDecision;
      /**
       * Why, in a sentence: the classifier's own, or what the caller reads on a
       * hook's deny. The dialog shows it on an ask the tool gave no reason for.
       */
      reason?: string;
      /**
       * The plugin whose hook made this answer, set by the engine and pinned:
       * whatever a hook writes here is dropped. Absent for the classifier.
       *
       * An answer a hook hands up as it heard it keeps what it carried.
       */
      plugin?: string;
  };

  /**
   * The MCP server a tool comes from, as `tool.describe` reports it
   * (ToolDescribeInput.mcpServer).
   *
   * @example
   * on("tool.describe", ($, e, next) => {
   *   if (e.mcpServer?.origin === "https://gateway.corp.example") tag(e.tool)
   *   return next(e)
   * })
   */
  export type ToolMcpServer = {
      /**
       * The transport in the server's config. A config with no `type` reads
       * `stdio`.
       */
      type: 'stdio' | 'http' | 'sse' | 'ws' | 'sdk' | 'sse-ide' | 'ws-ide' | 'claudeai-proxy';
      /**
       * Where the server is: scheme, host and a port that is not the default, as
       * WHATWG `URL.origin` gives it, of the URL after `${VAR}` expansion. Never a
       * login, path, query or fragment.
       *
       * An entry on a session proxy reads the host dialed, not the server the proxy
       * reaches. For `claudeai-proxy`, claude.ai's own connector reads the upstream
       * claude.ai states, and any other entry the proxy it dials, never the `url` it
       * wrote.
       *
       * Absent for `stdio` and `sdk`; for a URL that does not parse or has no origin
       * of its own; for a connector whose address claude.ai withholds; for a
       * `claudeai-proxy` entry with no route to dial; and for a server a cloud
       * session's tool container relays, whatever its `type`.
       */
      origin?: string;
      /**
       * The claude.ai connector's id, only where it is vouched for: claude.ai's own
       * connector, or the `connectorId` a host states on its own `sdk` entry. Never
       * one written in a file, a plugin or `--mcp-config`.
       */
      connectorId?: string;
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
   * What a `tool.call` hook sets for the request of an MCP server's tool.
   */
  export type ToolRequestMeta = {
      /**
       * Entries for the `_meta` of the request this call sends its MCP server,
       * set with `next({ ...e, requestMeta })`; never an argument of the tool.
       *
       * The one key a hook may set is `anthropic/sources`, its value a string
       * (JSON for anything structured) of at most 256 KiB in UTF-8: any other
       * shape is refused. It is carried only to the session's own relay to a
       * connector, which takes it off before a vendor sees the call; a call to
       * any other server, and any tool that is not an MCP server's, goes out
       * without it. The engine's own request keys are not shown here and stay
       * as they are. Left out of a rewrite, what a hook above set is kept; `{}`
       * clears it.
       */
      requestMeta?: Record<string, string>;
  };

  /**
   * The structured result of the tool named `Name`: its BuiltinToolResults
   * entry for a built-in tool, else `unknown`.
   *
   * Agent's is its entry, an AgentTeammateRecord (a started teammate's) or an
   * AgentCallRecord (a plugin-raised call's). `unknown` covers an MCP tool, a
   * name the results table lacks, and `Name` left at `string`.
   */
  export type ToolResultOf<Name extends string> = string extends Name ? unknown : Name extends keyof BuiltinToolResults & string ? BuiltinToolResults[Name] | (Name extends 'Agent' ? AgentCallRecord | AgentTeammateRecord : never) : unknown;

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
       * record less its bulk (Bash blanks `stdout`), and a subagent's transcript
       * stores none; `text` is what the model read either way.
       */
      result?: unknown;
      /**
       * What the tool's MCP server addressed to plugins in the stored result's
       * `_meta`: its entries under `"claude/plugins"` and `"anthropic/sources"`,
       * by key and as the server wrote them. The model never reads it.
       * `anthropic/sources` is handed over only from the session's own relay to a
       * connector; `claude/plugins` is any server's own claim. A key over
       * 256 KiB is left out and named in the list under `"claude/omitted"`, and
       * so is `claude/plugins` where a `tool.run` hook replaced the result.
       *
       * Off by default. Absent on an error result, and when the server
       * addressed nothing; a subagent's transcript keeps at most 8 KiB.
       */
      meta?: Record<string, unknown>;
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
      /**
       * Where the tool waits: `false` puts its schema in the prompt's tool list,
       * `true` behind ToolSearch.
       *
       * Left out, the engine's rule places it: behind ToolSearch, as it places
       * an MCP server's tool. A `tool.describe` hook's answer is read first.
       */
      isDeferred?: ToolDeferral;
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
       * (`-p`), a tool may store the record less its bulk (Bash blanks `stdout`)
       * and a subagent's transcript stores none; `text` holds either way.
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
      /**
       * On an Agent tool use, the id of the agent it spawned: what
       * `$.session.messages({ agentId })` reads and its `turn.complete` carries.
       *
       * Known while the session tracks the run and once the call is answered
       * (from what it stored). Absent on every other tool, and on an Agent call
       * the session refused before an agent started.
       *
       * @example
       * if (use.agentId) child = await $.session.messages({ agentId: use.agentId })
       */
      agentId?: string;
      /**
       * On an answered Agent tool use that ran to completion, how long the agent
       * ran, in milliseconds, as the call's stored record has it.
       *
       * Absent while it runs, on a background launch, and on every other tool.
       */
      durationMs?: number;
      /**
       * What the tool's MCP server addressed to plugins in the stored result's
       * `_meta`: its entries under `"claude/plugins"` and `"anthropic/sources"`,
       * by key and as the server wrote them. The model never reads it.
       * `anthropic/sources` is handed over only from the session's own relay to a
       * connector; `claude/plugins` is any server's own claim. A key over
       * 256 KiB is left out and named in the list under `"claude/omitted"`, and
       * so is `claude/plugins` where a `tool.run` hook replaced the result.
       *
       * Off by default. Absent on an error result, and when the server
       * addressed nothing; a subagent's transcript keeps at most 8 KiB.
       */
      meta?: Record<string, unknown>;
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
       *
       * For a subagent's run that handed its report back to its spawner, the
       * report delivered: whole, made safe as the spawner's copy is, and led by
       * the review's warning if it raised one. A refused hand-back changes nothing.
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
       * carried, on the main loop and in a subagent's run alike.
       *
       * A hook that heard a turn's start hears its end after it, an aborted
       * run's too. One that heard no start of an agent's turn hears the end
       * alone: the start was held past its bound, or its `$` call ran a skill or
       * command as this fork.
       */
      turnId: string;
      /**
       * The loop the turn ran in: a subagent's id, as `$.agent.spawn` resolves
       * it, each run of its loop one turn; absent on the main loop.
       *
       * Pinned: a different value is refused, one left out is kept. Every hook
       * hears an agent's end, the spawner's too: so a plugin gets its child's
       * answer, and a hook that spawns at each end sees them and bounds itself.
       */
      agentId?: string;
      /**
       * What the turn cost: its real requests' token counts, plus what a made-up
       * response's stop stated, summed, and the model of the last that counted.
       *
       * A response a `turn.step` hook made up adds nothing unless its stop states
       * usage; absent when nothing counted (an interrupt, an API error).
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
   * it, and one that answers its own may leave it out. `by` is the engine's: the
   * plugins that wrote the text or rewrote the answer they passed down, which
   * head its note. What a hook puts there is replaced.
   */
  export type TurnCompleteResult = {
      text: string;
      usage?: TurnUsage;
      by?: readonly string[];
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
   * The input of `turn.start`: the prompt a model turn begins with, the main
   * loop's or a subagent's or teammate's run (`agentId`).
   *
   * On the main loop it comes after `prompt.submit` settled the text and the
   * UserPromptSubmit settings hooks ran; a hook that follows the main loop
   * alone returns `next(e)` first when `e.agentId !== undefined`.
   */
  export type TurnStartInput = {
      /**
       * The user's text as the turn proceeds with it ("" for a turn started without
       * a typed prompt, e.g. a continuation).
       *
       * In a subagent's run, the prompt the run begins with: the Agent call's
       * as the `agent.spawn` hooks left it, or the message that woke the loop;
       * "" for a continued turn and for a run whose steps no hook sees.
       */
      text: string;
      /**
       * The turn's id, minted here; the same one every `turn.step` and the
       * `turn.complete` of this turn carry.
       */
      turnId: string;
      /**
       * The loop the turn runs in: a subagent's or teammate's id, as `agent.spawn`
       * answers it and `$.agent.list()` lists it; absent on the main loop.
       *
       * Each run of the loop is one turn. Pinned: a different value is refused,
       * one left out is kept. Every hook hears its start, the spawner's too, but
       * for the hook whose `$` call ran a skill or command as this fork.
       */
      agentId?: string;
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
   * A tool call the API runs itself streams as these too: the step's result
   * lists it (`serverToolUses`). Pass each on where it came; a hook that
   * yields its own response has none, and the engine supplies the rest.
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
   * request carries, and `$.session.messages()` reads them (in a subagent's
   * loop, `$.session.messages({ agentId: e.agentId })`). A hook rewrites
   * `model` or `effort` going down; the rest is pinned.
   */
  export type TurnStepInput = {
      /**
       * The turn this step belongs to: its `turn.start`'s id, which its
       * `turn.complete` will carry too. Pinned.
       */
      turnId: string;
      /**
       * The step's position in the turn, from 0. Pinned.
       */
      index: number;
      /**
       * Which model the request names, as the engine resolved it for this step
       * (the session's, a fallback's). `next({ ...e, model })` names another, by
       * an alias (`haiku`) or a full id.
       */
      model: string;
      /**
       * How hard the request asks the model to think: the level its loop,
       * `CLAUDE_CODE_EFFORT_LEVEL`, turn or session set, or the model's default.
       * Absent on a model without effort, or if that variable is `unset` or `auto`
       * with no `maxEffortLevel` cap. A rewrite lasts one step. On a model that
       * takes effort per message, a level on tool results alone is not sent if
       * another is in force, and one on a step with input stays for later tool
       * steps whose `effort` is a level. A number goes out at once on internal
       * builds only, unless that cap makes it a level; public ones refuse a hook's.
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
       * Pinned: a different value is refused, one left out is kept. Every hook
       * sees its steps, the spawner's too, as it does its tool calls, but for the
       * hook whose `$` call ran a skill or command as this fork.
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
       * The tool calls the response asks the engine to run, in order; empty
       * for a step that asks for none.
       */
      toolUses: readonly TurnStepToolUse[];
      /**
       * The tool calls the API ran itself inside the request (the advisor is
       * one), in order, each with when it started and ended.
       *
       * Absent when the response made none. The engine runs nothing for them:
       * no `tool.check` and no `tool.call` chain, so a hook reads them here and
       * cannot refuse or rewrite one. `toolUses` never lists them.
       *
       * @example
       * for (const use of response.serverToolUses ?? []) $.ui.log(use.name)
       */
      serverToolUses?: readonly TurnStepServerToolUse[];
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
   * One tool call of a step that the API ran itself, inside the request (the
   * advisor is one): the engine ran nothing for it.
   *
   * No `tool.check`, `tool.call` or `tool.describe` chain runs for it, and no
   * classic PreToolUse or PostToolUse hook: a hook cannot refuse, rewrite or
   * answer it. A tool the engine runs (`WebSearch` too) is in `toolUses`.
   */
  export type TurnStepServerToolUse = {
      /**
       * The call's id, as its result block names it (`tool_use_id` there).
       */
      id: string;
      /**
       * The server tool's name as the API spells it (`advisor`).
       */
      name: string;
      /**
       * The arguments the model gave it.
       */
      input: unknown;
      /**
       * When the model had written the call and the API began to run it, in
       * `$.clock.now()`'s milliseconds.
       */
      startedAt: number;
      /**
       * When the call's result had arrived, in the same milliseconds.
       *
       * The API answers in the same response, so the step's result has it.
       * Absent when the response ended before the result (a stream cut short,
       * a turn paused); a response that came whole stamps both alike.
       */
      endedAt?: number;
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
   * the four token counts (ModelUsage), the cache writes by lifetime and the
   * model's id.
   *
   * A turn's counts are its responses' summed; its model is the last response's.
   */
  export type TurnUsage = ModelUsage & {
      /**
       * The part of `cache_creation_input_tokens` written for five minutes.
       *
       * Present with `ephemeral_1h_input_tokens` or not at all: absent where no
       * write named its lifetime (none was made, or the provider reports none).
       * The two never sum past the whole; `/cost` prices the rest as five minutes.
       */
      ephemeral_5m_input_tokens?: number;
      /**
       * The part of `cache_creation_input_tokens` written for one hour; present
       * with `ephemeral_5m_input_tokens`.
       */
      ephemeral_1h_input_tokens?: number;
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
       * the size is not the mounted one, the cells or source are bad, or the Image
       * draws its `alt` there. With no surface attached `no-surface` heads it.
       */
      deny?: string;
      /**
       * With `deny`, a stable code to key on instead of the words of `deny`.
       * `tmux-passthrough`: tmux 3.3 or later holds back images the terminal
       * outside it can draw, because `allow-passthrough` or `focus-events` is off;
       * both must be on. Absent for every other cause.
       */
      fix?: 'tmux-passthrough';
  };

  /**
   * The argument of `$.ui.copy` and the input of `ui.copy`: the text, and
   * which surface's clipboard takes it, the caller's choice.
   *
   * A hook above the caller reads the same two fields: it may rewrite either
   * with `next`, refuse the copy with `{ deny }`, or answer `{ value }` itself
   * (a plugin whose `Client` runs on a remote surface can take copies for it).
   */
  export type UiCopyArgs = {
      /**
       * What the person pastes afterwards, verbatim: any string, newlines and
       * all; never shown on screen by the copy itself.
       */
      text: string;
      /**
       * Which surface to copy on; the caller's choice, one the session draws on:
       * a press, field or message hook passes `e.surface`.
       *
       * Left out: the first of `$.session.surfaces()`, so a hook on `ui.copy`
       * reads the target either way and a matcher narrows on it
       * (`on("ui.copy", { surface: "desktop" }, ...)`); absent: nothing draws.
       */
      surface?: RenderSurface;
  };

  /**
   * What `$.ui.copy` resolves to and what a `ui.copy` hook's `{ value }`
   * holds: whether the text reached a clipboard (`isCopied`), else why not.
   *
   * @example
   * if (!(await $.ui.copy({ text, surface: e.surface })).isCopied) warn()
   */
  export type UiCopyResult = {
      /**
       * True: the surface took the text: the terminal's clipboard tool or its
       * OSC 52 write, or a remote surface's app writing its own clipboard.
       *
       * OSC 52 does not report back: a terminal that drops it, with no tool
       * on the machine (pbcopy, wl-copy, xclip, PowerShell, tmux's buffer),
       * still reads true.
       */
      isCopied: true;
  } | {
      /**
       * False: nothing was copied.
       */
      isCopied: false;
      /**
       * Why not, a closed set: `no-surface`, `no-clipboard` or `refused`; a
       * hook above answering without copying says `refused`.
       *
       * `no-surface`: nothing draws (a `-p` run, the SDK), or the named
       * surface is not attached. `no-clipboard`: it draws but nothing was
       * written (no clipboard tool ran and OSC 52 was past its bound or left
       * out, as for VTE before 0.53; a remote app declined or was silent).
       *
       * @example
       * on('ui.copy', { surface: 'mobile' }, () => ({ value: REFUSED }))
       */
      reason: 'no-surface' | 'no-clipboard' | 'refused';
  };

  /**
   * The input of `ui.fault`: a `Client` this plugin drew failed on a surface,
   * addressed by where the instance is drawn.
   *
   * Every key is the engine's word, pinned: `next(e)` passes them on, a
   * rewrite that leaves one out keeps it, one that changes it fails the hook.
   */
  type UiFaultInput = {
      /**
       * Where the instance failed: `terminal`, or the remote surface that told
       * the engine (`desktop`).
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
       * The `Client`'s `key`: which instance failed.
       */
      element: string;
      /**
       * The `Client`'s `module`: which surface module ran there, as its path
       * under the plugin's folder.
       */
      module: string;
      /**
       * When it failed (UiFaultPhase): loading, drawing, or running after it
       * had drawn.
       *
       * A tree the terminal itself threw on while drawing it (`render`) is tried
       * again, state dropped, once drawn with props of another value or at another
       * terminal size, so an `element` may fail again; others wait for a reload.
       */
      phase: UiFaultPhase;
      /**
       * Why, as the surface said it: one line of 1 to 200 characters, no
       * control character in it, a longer one cut and ended with an ellipsis.
       *
       * With no message: `the module failed without a message`, or in the
       * terminal a named error's name (`RangeError`). Untrusted text, it may quote
       * what the plugin's module threw: show or log it, never act on or parse it.
       */
      reason: string;
  };

  /**
   * When a `Client` failed, as `ui.fault` names it; a closed set a matcher
   * narrows on.
   *
   * `load`: before its module ran (not fetched, refused, a throw at mount).
   * `render`: a throw while drawing, a tree the surface cannot draw, a render
   * that never answered. `run`: a listener, timer or handler; a loop; a flood.
   */
  type UiFaultPhase = 'load' | 'render' | 'run';

  /**
   * What a `ui.fault` hook returns and what `next(e)` resolves to: `{}`, the
   * fault was heard.
   *
   * Observe only. Once the hooks have answered the engine draws the site the
   * `Client` failed in again, unasked: the plugin's `ui.render` hook falls back
   * by leaving the `Client` out of that drawing.
   *
   * @remarks A redraw a fault caused causes no other: a `Client` born in it that
   *   fails is heard, and no more is drawn for it until `$.ui.invalidate`.
   */
  type UiFaultResult = Record<string, never>;

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
       *
       * One the site's next drawing brings is waited for, bounded, except from
       * inside that drawing's own hook, which cannot wait on itself; one it
       * never draws is `{ deny }` once the wait is over.
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
       * `element`. Read-only. A hook naming no `plugin` hears its own plugin's
       * elements and the engine's stops; `{ plugin: "*" }` every plugin's.
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
       * A hook kept the ring; the site is not this plugin's, holds no keyboard, or
       * another plugin's element does; no element of `plugin` is drawn under
       * `element`; another move came first. With no surface `no-surface` heads it.
       *
       * @remarks A `{ deny }` after `next(e)` was answered, a `.catch`'s too,
       *   fails the hook, and its last `next` stands: deny in its place.
       */
      deny?: string;
  };

  /**
   * The argument of `ui.input`: a change of, or a submit from, an `Input` a
   * render hook drew. Flat and frozen like every event's.
   *
   * A hook naming no `plugin` hears its own plugin's fields alone. Another
   * plugin addresses one field by matcher, `{ plugin: "*" }` for every one:
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
       *
       * A field of several lines joins them with `\n`; a submit trims nothing.
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
       * What the instance posted: plain data (JsonValue) of at most 100000
       * characters; typed `unknown` since it came from code. Rewritable.
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
   * What `$.ui.notify` resolves to and what a `ui.notify` hook's `{ value }`
   * holds: whether a channel sent it (`isSent`) and which, else why not.
   *
   * @example
   * if (!(await $.ui.notify(text)).isSent) $.ui.toast(text)
   */
  export type UiNotifyResult = {
      /**
       * True: the person's notification channel wrote it to their terminal,
       * as its notification sequence, its bell, or both.
       *
       * A terminal does not report back: one that drops the sequence, or a
       * system that mutes its banners, still reads true.
       */
      isSent: true;
      /**
       * Which channel sent it, spelt as the `preferredNotifChannel` setting
       * spells it; under `auto`, the one their terminal resolved to.
       *
       * `terminal_bell` rings and shows neither the text nor the title.
       * `client` means a host that raises notifications was handed it to raise;
       * it does not report back.
       */
      channel: 'iterm2' | 'iterm2_with_bell' | 'kitty' | 'ghostty' | 'terminal_bell' | 'client';
  } | {
      /**
       * False: no channel sent it.
       */
      isSent: false;
      /**
       * Why not, a closed set: `disabled`, `no-channel`, `no-surface` or
       * `refused`, which a hook above says when it answers without sending.
       *
       * `disabled`: they set `notifications_disabled`. `no-channel`: `auto`
       * found no terminal that notifies. `no-surface`: no terminal and no host
       * that raises it (a `-p` run, the SDK, a cloud session), no session bound
       * yet, the session is exiting, or the mod unloaded before the notification
       * went out.
       *
       * @example
       * on('ui.notify', { title: 'CI' }, () => ({ value: REFUSED }))
       */
      reason: 'disabled' | 'no-channel' | 'no-surface' | 'refused';
  };

  /**
   * What `$.ui.open` resolves to and what a `ui.open` hook's `{ value }` holds.
   *
   * Whether a surface draws the pane now, in `$.ui.panes()`' word
   * (`isPlaced`).
   *
   * Asked (the hook of a command the person typed or a prompt they entered, a
   * Button, Input or Select they worked; never a timer, `session.start`, a
   * queued prompt, nor `focus`) a pane is placed at any width: docked beside a
   * fullscreen transcript from 110 columns, else inline above the prompt.
   * Unasked it is placed from 144 terminal columns (110 for an id the person
   * opened from this plugin before, in this session or an earlier one, and
   * has not closed by hand since) and waits undrawn below that, no
   * `ui.render` raised, until the person opens it or the terminal widens to
   * the floor. Where a surface seated it (`placement`) is on the `Pane`
   * render props, per surface; a plugin's tests answer with a hook beneath.
   *
   * @example
   * const opened = await $.ui.open({ id: "clock" })
   */
  export type UiOpenResult = {
      /**
       * True: the pane is open and drawn (or retitled in place); the first
       * `ui.render` for `{ component: "Pane", requestId: id }` follows.
       */
      isPlaced: true;
  } | {
      /**
       * False: the pane is open but undrawn: opened unasked on a narrow
       * terminal, or where no surface places panes, or none is attached.
       *
       * With none attached keep the pane, which stays open: `session.attach`
       * is raised when one is, `$.ui.panes()` then says placed, and a surface
       * that places panes asks the pane's `ui.render`.
       */
      isPlaced: false;
      /**
       * Why it waits and what seats it: the floor it fell under (144 columns
       * unasked, 110 for an id the person once opened) and the width now.
       *
       * Or the attached surfaces that place nothing, until one that does
       * attaches or they leave. Or, starting `no-surface` (`$.ui.copy`'s word),
       * that none is: every open's in a `-p` run, and until a page attaches.
       *
       * @example
       * on('ui.open', { id }, () => ({ value: { isPlaced: false, reason } }))
       */
      reason: string;
  };

  /**
   * One of this plugin's open panes as `$.ui.panes()` lists it: the pane's
   * id and title, and where it stands with the person right now.
   *
   * Where a surface seated it (`dock`, `inline`, `widget`) is that surface's to
   * say, on the `Pane` render props (`placement`); a session may draw on several.
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
       * for an unrequested pane, its `$.ui.open` answered `{ isPlaced: false }`.
       *
       * It turns true when the person opens the pane or the terminal is widened
       * to its floor (UiOpenResult `reason`). False on every row, none shown or
       * focused, while an open answers `no-surface`.
       */
      isPlaced: boolean;
  };

  /**
   * The argument of `$.ui.place`.
   */
  type UiPlaceArgs = {
      /**
       * Names the row among this plugin's: 1 to 64 of letters, digits, `_` and
       * `-`, as a pane's id. A `ui.render` hook reads it as `e.props.id`.
       */
      id: string;
  };

  /**
   * What `$.ui.place` resolves to and what a `ui.place` hook's `{ value }` holds.
   *
   * The row stands in the conversation either way but past the cap and with no
   * conversation, where there is no `requestId`.
   *
   * @example
   * const placed = await $.ui.place({ id: "build" })
   */
  type UiPlaceResult = {
      /**
       * True: a surface is attached to draw the row.
       */
      isPlaced: true;
      /**
       * The row's `e.requestId` at `ui.render`, and what `$.ui.scroll` takes.
       */
      requestId: string;
  } | {
      /**
       * False: nothing draws the row now, for the `reason` given.
       */
      isPlaced: false;
      /**
       * The row's id when it stands for a surface yet to attach.
       */
      requestId?: string;
      /**
       * Why nothing draws it, one line to show or log.
       */
      reason: string;
  };

  /**
   * The argument of `ui.press`: a press on a `Button` a render hook drew, or
   * on an answered `Markdown` link. Flat and frozen like every event's.
   *
   * A hook naming no `plugin` hears its own plugin's presses alone. Another
   * plugin addresses one button by matcher, `{ plugin: "*" }` for every one:
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
   * scrolls adds the row its window shows. The frame lies outside.
   */
  export type UiScrollPointer = {
      /**
       * 0 at the body's left edge, as `bodyColumns` counts them; negative, or
       * `bodyColumns` and past, over an inline pane's sides or the band's `[-]`.
       */
      column: number;
      /**
       * 0 at the body's first showing row, as `bodyRows` counts them.
       *
       * The tree's row is `row` under a hook's own window, the window's row plus
       * `row` under the engine's: the `scroll.offset` last read, short of a move
       * the engine made since. Negative above the body, `bodyRows` or more below.
       */
      row: number;
  };

  /**
   * What a `ui.scroll` hook returns, what `next(e)` resolves to, and what
   * `$.ui.scroll` hands back: `{}` once the window moved, or why it did not.
   *
   * `{}` doesn't say the person saw the move: a band folded away shows nothing,
   * and a mobile app's closed Mods sheet shows nothing and keeps nothing.
   */
  export type UiScrollResult = {
      /**
       * Absent when the window is where the chain left it; else why nothing
       * moved, as `tool.call` and `config.set` spell a refusal.
       *
       * A hook kept the window; the target is not this plugin's; another move came
       * first (`the window moved meanwhile`); a transcript row was unasked (`not
       * person-initiated`) or none scrolls. With no surface `no-surface` heads it.
       *
       * @remarks A `{ deny }` after `next(e)` was answered, a `.catch`'s too,
       *   fails the hook, and its last `next` stands: deny in its place.
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
   * A hook naming no `plugin` hears its own plugin's pickers alone. Another
   * plugin addresses one picker by matcher, `{ plugin: "*" }` for every one:
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
   * What the person has selected on screen, as `$.ui.selection()` answers it:
   * the text, and the transcript row it lies in when it lies in one.
   *
   * @example
   * const selected = await $.ui.selection()
   */
  type UiSelection = {
      /**
       * The selected text as the person sees it: what a copy would put on the
       * clipboard, wrapped rows joined back into their lines.
       */
      text: string;
      /**
       * The transcript row the selection lies in, by the id its `ui.render`
       * hook reads as `e.requestId` and `$.ui.scroll` takes.
       *
       * A tool call's row by its `tool_use_id`. Absent when the selection spans
       * several rows, lies outside the transcript (the prompt, a pane), or has
       * scrolled out of the rows the transcript keeps drawn.
       */
      requestId?: string;
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
   * What `$.ui.view` hands back and what a `ui.view` hook's `{ value }` holds:
   * `{}` once the main view shows what was asked, or why it does not.
   *
   * As `ui.scroll` spells it.
   *
   * @example
   * $.ui.view({ agentId }).then(shown => shown.deny && $.ui.toast(shown.deny))
   */
  export type UiViewResult = {
      /**
       * Absent when the main view shows the transcript asked for; else why the
       * view did not move.
       *
       * The call did not answer the person's own input; no agent holds the id,
       * or the tasks list shows none for it; a teammate was stopped, or runs in
       * a pane of its own; the view moved meanwhile; the session draws none.
       */
      deny?: string;
  };

  /**
   * One `prompt.attachment` input of every other type, the ones
   * PromptAttachmentDetailOf does not name: the attachment's text alone.
   */
  type UndeclaredAttachmentInput = {
      /**
       * As the engine names the attachment's kind; the key a matcher narrows on.
       * Pinned. Builds add and retire kinds: match by name.
       *
       * Among them `todo_reminder`, `auto_mode`, `auto_mode_exit`, `instructions`,
       * `nested_memory`, `skill_listing`, `deferred_tools_delta`, `file`,
       * `edited_text_file`, `queued_command`; the plan rows carry a `detail`.
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
       * Pinned: a different value is refused, one left out is kept. Every hook
       * resolves it, the spawner's too, but for the hook whose `$` call ran a skill
       * or command as this fork.
       */
      agentId?: string;
      /**
       * Absent, the key itself: the engine declares no facts for the type, and
       * a rewrite that adds the key is refused.
       *
       * @example
       * if (!("detail" in e)) return next(e)
       */
      detail?: undefined;
  };

  /**
   * The intersection of a union's members (`A | B` to `A & B`), by inferring
   * one parameter type from the contravariant positions.
   */
  type UnionToIntersection<U> = (U extends unknown ? (member: U) => void : never) extends (member: infer I) => void ? I : never;

  /**
   * `update($, target, fn)`: reads the value, applies `fn` here in the
   * plugin's environment, writes with `ifVersion`, and tries again on a miss.
   *
   * What a handler closure uses in place of `$.state.set(ref, stale + 1)`:
   * two presses before a redraw both land. Functions do not cross to the host,
   * so the loop lives on the plugin's side. Resolves what it wrote.
   *
   * @example
   * <Button key="more" onPress={() => update($, count, n => n + 1)} />
   */
  export type UpdateFunction = {
      <T>($: StateDollar, target: Atom<T>, change: (value: T) => T): Promise<T>;
      <P extends keyof PluginState & string, K extends keyof PluginState[P] & string>($: StateDollar, target: StateRef<P, K>, change: (value: StateValue<P, K> | undefined) => StateValue<P, K>): Promise<StateValue<P, K>>;
  };

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
       * Who authored/injected the prompt: `user` = submitted from the interactive composer, `sdk` = non-interactive entrypoint (`-p` / Agent SDK), `loop_wakeup` = dynamic /loop wakeup, `schedule_wakeup` = scheduled-task fire (CronCreate or a cloud scheduled task), `system` = other machine-injected turns (peer/channel messages, task notifications, auto-continuation), `poll_event` = the poll-event channel enqueue-time pass (the hook fires when the host submits an event, before its delivery ack exists - a blocking verdict rejects the event). Payloads may omit it while the field rolls out.
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

  /**
   * One background agent a line waits on, as `ui.render` sees it under
   * `waitingFor.agents`.
   */
  type WaitingAgent = {
      /**
       * The same id as `task.id` on the UserMessage notification row that
       * reports its end.
       */
      id: string;
      /**
       * Which agent it runs (`general-purpose`, `<plugin>:<agent>`).
       */
      agentType: string;
      /**
       * The call that started it, as `tool.call` carried it
       * (`e.tool_use_id`), when its task records one.
       */
      tool_use_id?: string;
  };

  /**
   * What a line waits on, as `ui.render` sees it under `waitingFor`.
   */
  type WaitingFor = {
      /**
       * Each background agent the line waits on.
       */
      agents: ReadonlyArray<WaitingAgent>;
      /**
       * How many workflows the line waits on.
       */
      workflows: number;
  };

  /**
   * A WebAssembly binary as a hook on `wasm.compile` reads and answers it:
   * base64, since only plain data crosses between environments.
   */
  export type WasmBytes = {
      /**
       * The binary, standard padded base64; `Uint8Array.fromBase64(base64)`
       * gives the bytes back. Empty in `next.trace`, which keeps no bytes. Text
       * that does not decode, or holds more than 64 MiB, fails the hook.
       */
      base64: string;
  };

  /**
   * What a hook on `wasm.compile` receives: the bytes about to compile, and
   * the file they were read from when the call named one.
   */
  export type WasmCompileInput = {
      /**
       * The file under the calling plugin's folder, `/`-separated, as `claude
       * plugin validate` prints it; absent for bytes made at run time. Pinned:
       * `next(e)` passes it on.
       */
      path?: string;
      /**
       * The binary (WasmBytes): the file as read for this call, or the bytes as
       * they were when the call was made. A hook's to replace.
       */
      base64: string;
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
   * A named value with its initial: `read` answers the initial while nothing
   * is written, so never `undefined`. Pure; runs in the plugin's environment.
   *
   * @example
   * import { atom, read, update } from "claude-code"
   * const count = atom({ plugin: "counter", key: "count" } as const, 0)
   */
  export const atom: AtomFunction

  /**
   * A value computed from atoms and references, cached by their versions.
   *
   * @example
   * const busy = derive([workers], list => list.filter(w => w.isBusy).length)
   */
  export const derive: DeriveFunction

  /**
   * A family's member for the instance being drawn, keyed by `e.requestId`.
   *
   * @example
   * const open = await read($, memberOf(isOpen, e))
   */
  export const memberOf: MemberOfFunction

  /**
   * Reads an atom, a derived value or a reference through `$.state.get`;
   * while a `ui.render` hook draws, that subscribes the drawing.
   *
   * @example
   * const n = await read($, count)
   */
  export const read: ReadFunction

  /**
   * Reads, applies `fn` in the plugin's environment, writes with
   * `ifVersion`, and tries again on a miss: what a handler closure calls.
   *
   * @example
   * <Button key="more" onPress={() => update($, count, n => n + 1)} />
   */
  export const update: UpdateFunction

  /**
   * The globals of a hooks module's environment: these and no others (no DOM,
   * no Node). No code generation either: `eval` and `new Function` over a
   * string throw. `WebAssembly` is there only in a hooks module that calls
   * `$.wasm.compile`, the one way to compile. A surface module's
   * environment (Client) has the same globals less that one, and a
   * `console`; neither has timers (a hooks module waits on `$.clock`, a
   * surface module on `surface.every`). In both, `obj.__proto__ = p` on
   * anything but a function writes an own key named `__proto__`, as data
   * handed in holds one; set a prototype with `Object.setPrototypeOf` or
   * `Object.create`.
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

    /**
     * The standard API over the modules `$.wasm.compile` answers, frozen.
     *
     * `new WebAssembly.Module` throws, and `compile` and `instantiate` over
     * bytes reject, naming `$.wasm.compile`. No memory is shared. `validate`
     * answers true for what `$.wasm.compile` would take.
     */
    namespace WebAssembly {
      interface Module {}
      var Module: {
        prototype: Module
        imports(module: Module): { module: string; name: string; kind: string }[]
        exports(module: Module): { name: string; kind: string }[]
        customSections(module: Module, name: string): ArrayBuffer[]
        [Symbol.hasInstance](value: unknown): value is Module
      }
      interface Instance {
        readonly exports: Record<string, Function | Global | Memory | Table>
      }
      var Instance: {
        prototype: Instance
        new (
          module: Module,
          imports?: Record<string, Record<string, unknown>>,
        ): Instance
      }
      function instantiate(
        module: Module,
        imports?: Record<string, Record<string, unknown>>,
      ): Promise<Instance>
      function validate(bytes: ArrayBuffer | ArrayBufferView): boolean
      interface Memory {
        readonly buffer: ArrayBuffer
        grow(delta: number): number
        toFixedLengthBuffer(): ArrayBuffer
        toResizableBuffer(): ArrayBuffer
      }
      var Memory: {
        prototype: Memory
        new (descriptor: { initial: number; maximum?: number }): Memory
      }
      interface Table {
        readonly length: number
        get(index: number): any
        grow(delta: number, value?: any): number
        set(index: number, value?: any): void
      }
      var Table: {
        prototype: Table
        new (
          descriptor: { element: string; initial: number; maximum?: number },
          value?: any,
        ): Table
      }
      interface Global<T = any> {
        value: any
        valueOf(): any
      }
      var Global: {
        prototype: Global
        new (descriptor: { value: string; mutable?: boolean }, value?: any): Global
      }
      interface Tag {}
      var Tag: {
        prototype: Tag
        new (type: { parameters: string[] }): Tag
      }
      var JSTag: Tag
      interface Exception {
        readonly stack: string | undefined
        getArg(tag: Tag, index: number): any
        is(tag: Tag): boolean
      }
      var Exception: {
        prototype: Exception
        new (
          tag: Tag,
          payload: readonly unknown[],
          options?: { traceStack?: boolean },
        ): Exception
      }
      interface Suspending {}
      var Suspending: {
        prototype: Suspending
        new (fn: (...args: any[]) => unknown): Suspending
      }
      function promising(fn: Function): (...args: any[]) => Promise<any>
      interface CompileError extends Error {}
      var CompileError: {
        prototype: CompileError
        new (message?: string): CompileError
      }
      interface LinkError extends Error {}
      var LinkError: { prototype: LinkError; new (message?: string): LinkError }
      interface RuntimeError extends Error {}
      var RuntimeError: {
        prototype: RuntimeError
        new (message?: string): RuntimeError
      }
      interface SuspendError extends Error {}
      var SuspendError: {
        prototype: SuspendError
        new (message?: string): SuspendError
      }
    }
  }
}

declare module 'claude-code/testing' {
  import type { AgentLoop } from 'claude-code';
  import type { Args } from 'claude-code';
  import type { Chunk } from 'claude-code';
  import type { ClassicEventName } from 'claude-code';
  import type { ClassicEventOf } from 'claude-code';
  import type { ClassicResultOf } from 'claude-code';
  import type { ClientKeyEvent } from 'claude-code';
  import type { ClientPointerEvent } from 'claude-code';
  import type { Elements } from 'claude-code';
  import type { EventCalls } from 'claude-code';
  import type { EventName } from 'claude-code';
  import type { HookStream } from 'claude-code';
  import type { JsonValue } from 'claude-code';
  import type { On } from 'claude-code';
  import type { PluginOptions } from 'claude-code';
  import type { PressedLink } from 'claude-code';
  import type { Register } from 'claude-code';
  import type { RenderComponent } from 'claude-code';
  import type { RenderElement } from 'claude-code';
  import type { RenderPropsOf } from 'claude-code';
  import type { RenderSurface } from 'claude-code';
  import type { RenderViewport } from 'claude-code';
  import type { ResultOf } from 'claude-code';
  import type { SessionAppendInput } from 'claude-code';
  import type { StreamingEventName } from 'claude-code';
  import type { Tier } from 'claude-code';
  import type { ToolCallArgs } from 'claude-code';
  import type { ToolCallReserved } from 'claude-code';
  import type { ToolCallResult } from 'claude-code';
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
   * A classic hook event the engine raises on its own, by its own name
   * (`SessionStart`, `Stop`): all but `PreToolUse`, which rides `tool.call`.
   *
   * `$.tool.call` raises `classic.PreToolUse` as a session does: beneath every
   * plugin's `tool.call` hook and above the test's own, which a deny never
   * reaches (the call resolves errored, the reason its `text`).
   */
  export type ClassicEvent = Exclude<ClassicEventName, 'classic.PreToolUse'> extends `classic.${infer E}` ? E : never;

  /**
   * What `$.classic.<Event>` takes: the event's own fields as its hook sees
   * them on `e`, less what the engine stamps at every call site.
   *
   * `hook_event_name` is the call's; `session_id`, `transcript_path` and
   * `cwd` are the session's unless the test gives them (the test session's
   * id, `''` for no local transcript, the plugin's folder).
   */
  export type ClassicFields<E extends ClassicEvent> = Omit<ClassicEventOf[`classic.${E}`], 'hook_event_name' | 'session_id' | 'transcript_path' | 'cwd'> & Partial<Pick<ClassicEventOf[`classic.${E}`], 'session_id' | 'transcript_path' | 'cwd'>>;

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
   * `input` needs `Input` and `select` needs `Select` (every surface today);
   * `key`, `pointer`, `post`, `advance` and `resize` reach a `Client`
   * (terminal and desktop today). The rest need nothing but a tree.
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
   * or Link's label, a Markdown's text, a Code's source, an Input's value, a
   * Progress's label and figure): a string by inclusion, a RegExp by test.
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
   * `next.origin` is the engine, the chain every plugin loaded. `$.ui.mount`
   * is a surface drawing an instance; `press`, `input` and `select` a person
   * acting on an element the test drew; `$.classic` the classic hook events.
   */
  export type Engine = {
      [N in keyof EventCalls]: N extends 'ui' ? EngineNoun<N> & EnginePress & EngineInput & EngineSelect & EngineMount : EngineNoun<N>;
  } & {
      classic: EngineClassic;
  };

  /**
   * One call on the engine's `$`: the event's input whole, as an engine call
   * site passes it, to its result, or for a streaming event to its stream.
   */
  export type EngineCall<E extends EventName> = E extends StreamingEventName ? (e: Args<E>) => HookStream<Chunk<E>, ResultOf[E]> : (e: Args<E>) => Promise<ResultOf[E]>;

  /**
   * The classic (settings) hook events as the engine raises them: each a call
   * running the `classic.<Event>` chain over every plugin hooked on it.
   *
   * No settings hook runs beneath, so the test's `on('classic.<Event>')` is the
   * bottom; the envelope (`hook_event_name`, `session_id`, `transcript_path`,
   * `cwd`) is stamped unless given. `PreToolUse` rides `$.tool.call` instead.
   *
   * @example
   * await $.classic.SessionStart({ source: 'clear' })
   */
  export type EngineClassic = {
      [E in ClassicEvent]: (e: ClassicFields<E>) => Promise<ClassicResultOf[`classic.${E}`]>;
  };

  /**
   * A surface typing into an Input a test rendered: the `ui.input` chain over
   * every plugin hooked on it, the Input's own handler last.
   */
  export type EngineInput = {
      /**
       * Types into the Input, as an edit (`kind` `change`, reaching `onInput`) or
       * Enter (`submit`, the default, reaching `onSubmit`) with that text.
       *
       * Resolves once the chain, the handler and the work it started settled.
       * `e.surface` is the surface of the drawing that holds it.
       *
       * @param target whose Input, its key, the text, the kind, and the instance
       *               and surface when several hold it
       * @returns what the chain settled on; rejects when no such Input is drawn, or
       *          several are and neither instance nor surface tells them apart
       * @example
       * await $.ui.input({ plugin: 'notes', key: 'q', text: 'g', kind: 'change' })
       * await $.ui.input({ plugin: 'notes', key: 'q', text: 'groceries' })
       */
      input: (target: InputTarget) => Promise<UiInputResult | undefined>;
  };

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
       * @param target whose elements, the surface, component, props and requestId
       * @returns the mounted drawing; rejects when no `surface` (or an unknown
       *   one) is named, when the surface cannot draw the tree returned (with
       *   the reason: an element or a prop it lacks, a dialog's tree past its
       *   rows), or when a `Client`'s module failed or drew nothing
       */
      mount: <P extends RenderSurface, C extends RenderComponent>(target: MountTarget<P, C>) => Promise<Mounted<P, C>>;
  };

  /**
   * One noun of the engine's `$`: each of its events as the engine calls it,
   * `tool.call` typed per tool and `ui.render` per component, `ui.resolve` out.
   *
   * `skill.prompt` takes a call's input: its frontmatter and source may be
   * left out, as a test written before the event carried them does.
   */
  export type EngineNoun<N extends keyof EventCalls> = {
      [V in EngineNounEvent<N>]: `${N}.${V}` extends 'tool.call' ? EngineToolCall : `${N}.${V}` extends 'ui.render' | 'skill.prompt' ? EventCalls[N][V] : EngineCall<`${N}.${V}` & EventName>;
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
       * Resolves once the chain, `onPress` and any work `onPress` left running
       * unawaited have settled (work asleep on `mock.clock` waits for the test
       * to advance it). `e.surface` is the surface of the drawing that holds it.
       *
       * @param target whose element, its key, the instance and surface when
       *   several hold it, and for a Markdown the link
       * @returns what the chain settled on; rejects when no such element is
       *   drawn, or several are and neither instance nor surface tells them apart
       */
      press: (target: PressTarget) => Promise<UiPressResult | undefined>;
  };

  /**
   * A surface picking an option of a Select a test rendered: the `ui.select`
   * chain over every plugin hooked on it, the Select's own `onSelect` last.
   */
  export type EngineSelect = {
      /**
       * Picks the option, as choosing it on the surface does; resolves once the
       * chain, `onSelect` and the work it started have settled.
       *
       * `e.surface` is the surface of the drawing that holds it.
       *
       * @param target whose Select, its key, the option's value, and the
       *   instance and surface when several hold it
       * @returns what the chain settled on; rejects when no such Select is
       *   drawn, or several are and neither instance nor surface tells them apart
       * @example
       * await $.ui.select({ plugin: 'notes', key: 'sort', value: 'date' })
       */
      select: (target: SelectTarget) => Promise<UiSelectResult | undefined>;
  };

  /**
   * `$.tool.call` on a test's `$`: a call as the engine raises one, `agentId`
   * the loop it runs in (a subagent's, a teammate's); left out, the main loop.
   *
   * A hooked `tool.check` runs as for a background subagent: a test's
   * `classic.PermissionRequest` answers an ask; no test plays a person's yes. A
   * test states `isReadOnly` on `$.tool.check`; `$.ui.ask` states its own.
   *
   * @example
   * await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'a1' })
   */
  export type EngineToolCall = {
      <T extends string>(input: ToolCallArgs & Pick<ToolCallReserved<T>, 'tool'> & AgentLoop): Promise<ToolCallResult<T>>;
      (input: ToolCallArgs & AgentLoop): Promise<ToolCallResult>;
  };

  /**
   * The checks on a value (`expect(received)`), and with them the matchers
   * that stand inside an expected value (`expect.any(Number)`).
   *
   * A check that fails throws. In a hook the test registered with `on` the
   * engine skips the hook as it skips any that throws, and the test fails all
   * the same, with the check's message and the hook's event.
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
   * What each surface is handed to draw, not what it painted: the same on all,
   * except that a Progress is Box and Text on every surface but mobile.
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
   * What `$.ui.input` takes: the plugin whose hook drew the Input, its `key`,
   * the field's text, which input it is, instance and surface when several.
   */
  export type InputTarget = {
      plugin: string;
      key: string;
      /**
       * The field's whole text at that moment: `e.value` for the chain.
       */
      text: string;
      /**
       * `submit` (the default) is Enter with that text and reaches `onSubmit`;
       * `change` is one edit left in the field and reaches `onInput`.
       *
       * A person typing is a run of `change`s, then a `submit`.
       */
      kind?: UiInputArgument['kind'];
      /**
       * Which instance holds it, when the plugin drew the key in several.
       */
      requestId?: string;
      /**
       * Which surface's drawing, when the key is drawn on more than one; the
       * input carries the surface of the drawing it lands in either way.
       */
      surface?: RenderSurface;
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
      /**
       * Records what is appended to the session's conversations: each row the
       * kit stored for a plugin's `$.session.append`, or for the test's own.
       *
       * The kit answers with or without this, as a session stores the row: a
       * plugin's minted or refused, a raised one's pinned blocks put back. This is
       * the test's `session.append` hook: one more needs a matcher (`{ door }`).
       *
       * @param on the test's `on`
       * @returns the session: the rows appended so far
       */
      session: (on: On) => MockSession;
  };

  /**
   * The world beneath the plugins, mocked noun by noun: `mock.clock`,
   * `mock.store`, `mock.env` and `mock.session`.
   *
   * Each registers hooks of the test's on the `on` it is handed, visible where
   * the test calls it, and answers its noun from memory or records it.
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
   * The session `mock.session` hands back: what was appended to its
   * conversations while the test ran.
   */
  export type MockSession = {
      /**
       * The rows stored so far, oldest first, each as the event carried it:
       * `message` as stored, `door`, `origin`, `uuid` and `agentId`.
       *
       * A plugin's own row has the door `note`, the plugin as `origin` and a
       * fresh `uuid`; a row a hook above refused, or the kit, is left out.
       *
       * @returns the rows
       */
      appended: () => readonly SessionAppendInput[];
  };

  /**
   * A drawing of component `C` the test mounted on surface `P`: reads over its
   * description, acts on its elements by key, `Client` acts where `P` has one.
   *
   * Narrowed by the `surface` the test passed, as `e.surface` narrows
   * `$.ui.resolve(e)`: no `key` on `mobile` or `vscode`, whose tables
   * (Elements) lack `Client`; over a union, their meet.
   */
  export type Mounted<P extends RenderSurface = RenderSurface, C extends RenderComponent = RenderComponent> = {
      [K in keyof MountedMembers<P, C> as K extends keyof ElementOfAct ? ElementOfAct[K] extends keyof Elements[P] ? K : never : K]: MountedMembers<P, C>[K];
  };

  /**
   * Every member a mounted drawing of component `C` can have; `Mounted<P, C>`
   * keeps the ones surface `P` has the element for (ElementOfAct).
   *
   * Each act resolves once the work it started settled (chain, handler, what
   * the handler left running) and what a plugin invalidated was drawn again.
   * The kit exercises the mod's hooks and modules, never a surface's paint.
   */
  export type MountedMembers<P extends RenderSurface, C extends RenderComponent = RenderComponent> = {
      /**
       * Where this drawing is, as the test named it.
       */
      readonly surface: P;
      /**
       * The tree as last drawn, as plain data: what the `ui.render` chain returned,
       * checked by the surface's table, with a Progress as Box and Text except on mobile.
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
       * Whether the tree as last drawn holds what `next(e)` answered, so what is
       * beneath the plugins is drawn with it; false when a hook left it out.
       *
       * Calling it says the test has looked: `claude plugin test` then prints no
       * advice for this drawing, whichever answer the test expects.
       *
       * @returns whether what is beneath was kept; rejects when it is not in the
       *   tree and the test has its own `ui.render` hook at this site: `find` it
       * @example
       * expect(await ui.keepsBeneath()).toBe(true)
       */
      keepsBeneath: () => Promise<boolean>;
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
   * What `$.ui.select` takes: the plugin whose hook drew the Select, its
   * `key`, the picked option's value, instance and surface when several.
   */
  export type SelectTarget = {
      plugin: string;
      key: string;
      /**
       * Which option is picked, by the `value` the Select listed it under.
       */
      value: string;
      /**
       * Which instance holds it, when the plugin drew the key in several.
       */
      requestId?: string;
      /**
       * Which surface's drawing, when the key is drawn on more than one; the
       * pick carries the surface of the drawing it lands in either way.
       */
      surface?: RenderSurface;
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
   * It registers hooks before its first call on `$`, which loads the plugins.
   * Beneath `$.state`, `ui.render`, its `$.ui.invalidate` and `session.append`
   * the kit answers. A check that fails in a hook, or a refused answer, fails it.
   */
  export type TestBody = ($: Engine, on: On) => unknown;

  /**
   * What `test` takes beside its name: the inline plugins it loads beside the
   * one under test, and how long it may run (5000 ms when not given).
   *
   * Also the plugin under test's `userConfig` values.
   */
  export type TestOptions = {
      plugins?: readonly Plugin[];
      timeoutMs?: number;
      /**
       * The plugin under test's `userConfig` values, standing as the ones
       * stored in settings.
       *
       * `register(on, options)` receives them as a load does: unlisted values
       * unset, defaults filled in, then validated, a bad required field failing
       * the load. Left out: the manifest's defaults. Inline plugins get none.
       *
       * @example
       * test('greets', { options: { greeting: 'yo' } }, body)
       */
      options?: PluginOptions;
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
