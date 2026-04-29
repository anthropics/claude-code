# Proposal: inline image rendering in the Claude Code terminal UI

**Tracking issue:** [#54546](https://github.com/anthropics/claude-code/issues/54546)

This directory is a feature proposal, not a working example. It documents
empirical research into adding inline image rendering to the Claude Code (CC)
terminal client, the failure modes that block all known external workarounds,
two community reference implementations that approximate the feature today,
and a recommended design for a real fix in CC itself.

## TL;DR

CC is the only first-party Claude client that cannot render images inline in
its conversation surface (web, VS Code extension, JetBrains plugin all do). We
investigated four independent paths to fix this, three of which we implemented
and verified end-to-end. The conclusion: a true fix has to live inside CC's
renderer. We are submitting this proposal alongside two working community
implementations as proof points.

| Path | Outcome |
| --- | --- |
| In-CC renderer support (this proposal) | Recommended. Requires CC changes. |
| PTY proxy wrapping CC | Working reference at [`xodn348/cc-img-proxy`](https://github.com/xodn348/cc-img-proxy). Approximates inline. |
| iTerm2 Python AutoLaunch agent | Working reference at [`xodn348/cclatex-preview`](https://github.com/xodn348/cclatex-preview). Side-pane preview, not inline. |
| Bun standalone-binary patch | Feasible but fragile and breaks on every CC release. Not recommended. |

## Why this is needed

Use cases observed in real CC sessions where inline images would fundamentally
change the workflow:

- **Math rendering** — projects like [`ccLatex`](https://github.com/xodn348/ccLatex)
  produce KaTeX-rendered PNGs that the user has to open in Preview to see.
- **Plot/chart output from data tools** — Python/Jupyter-style workflows return
  charts that today get summarized in text.
- **Visual diffs** — design reviews and QA skills (`/design-review`, `/qa`)
  capture screenshots that the user must view in a separate app.
- **PDF page previews** — `read-pdf` style workflows produce per-page renders.
- **Diagrams** — Mermaid/Graphviz/PlantUML output.

Every other Claude client handles these natively via Markdown image syntax. The
terminal — where the most agentic work happens — is the gap.

## What we verified does not work

We tested every external output channel into CC for OSC 1337 / Kitty / sixel
passthrough by patching/instrumenting hooks and channels in CC 2.1.123 (a
Bun-compiled Mach-O standalone binary).

| Channel | Passthrough? | Failure mode |
| --- | --- | --- |
| `Bash` tool stdout | No | Captured by CC tool runner; sanitized before display |
| MCP `text` content | No | JSON transport; ESC arrives as `` literal |
| MCP `image` content | No | Routed to vision input; never written to PTY |
| Stop / Pre / PostToolUse / UserPromptSubmit hook stdout | No | All sanitized via `Bun.stripANSI` before render |
| SessionStart `additionalContext` | No | Feeds model context, never PTY |
| Status line script stdout | No | Rendered through Ink `<Text>` after stripANSI |
| Slash command output | No | Same Ink path |
| Output style template | No | Same Ink path |
| `CLAUDE.md` content | No | Read into system prompt; never reaches PTY |
| `--print` mode raw stdout | No | Stream-json wraps everything; markdown renderer strips ESC |
| Direct write to controlling tty from a tool subprocess | N/A | No `/dev/tty` (subprocesses run without a controlling terminal) |
| Direct write to iTerm2 PTY slave found via `ps` ancestry | Reaches iTerm2 | CC's repaint loop overwrites; row-accounting breaks below |

Empirical signal in the binary: `Bun.stripANSI` is bound and called on every
external text path. The TUI renderer is Ink + Yoga + a diff-based PTY writer
that emits its own escape sequences only — input escapes are treated as opaque
graphemes for layout purposes and never reach `process.stdout.write` intact.

A bonus finding worth noting: the CC bundle already contains the
`ansi-escapes` library's OSC 1337 emitter
(`pA.image = (H, _ = {}) => { ... \x1B]1337;File=inline=1; ... }`) but it is
dead code — the markdown renderer's `Gi_.image({ text: H }) { return "" + H }`
just returns the alt text and discards the link. Wiring those up is the work.

## Recommended design (for a real in-CC fix)

### Capability detection at startup

```ts
function detectInlineImageProtocol(): 'iterm-osc1337' | 'kitty-graphics' | 'none' {
  if (process.env.TERM_PROGRAM === 'iTerm.app' || process.env.TERM_PROGRAM === 'WezTerm') {
    return 'iterm-osc1337';
  }
  if (process.env.TERM === 'xterm-kitty' || process.env.GHOSTTY_RESOURCES_DIR) {
    return 'kitty-graphics';
  }
  return 'none';
}
```

Skip if `TMUX` is set without `allow-passthrough on`. Skip if `TERM` indicates
a non-graphical terminal.

### Markdown renderer hook

Replace the no-op `Gi_.image()` with a renderer that:

1. Resolves the path (local fs only for v1; URL fetch is P2).
2. Encodes the image with the detected protocol.
3. Computes the row footprint from image height (queryable via OSC 16 for
   pixel-per-cell, with a fallback table per terminal).
4. Returns an Ink-aware "image cell" component, not a plain string.

### Layout integration

The Ink renderer needs to know the image occupies N rows so subsequent text
flows below it correctly. This is the tricky part. Two approaches:

- **Phantom placeholder approach.** Reserve N rows of `\n` after the image so
  Ink's diff algorithm sees them as occupied. Simpler, but Ink doesn't know
  about the image content for resize/scroll fidelity.
- **Proper Yoga node approach.** Treat the image as a fixed-height block in
  the Yoga layout tree. Higher fidelity but requires teaching Yoga + Ink about
  non-text nodes.

We recommend the phantom-placeholder approach for v1. Proper Yoga integration
is P2.

### Fallbacks for unsupported terminals

In priority order:

1. Unicode block art (4×8 pixels per cell, truecolor) — usable in xterm
   and similar.
2. ASCII placeholder with a clickable file path (current effective behavior,
   but with the path made copy-friendly).

### Settings

```jsonc
{
  "inlineImages": {
    "enabled": "auto",          // "auto" | "always" | "never"
    "maxWidth": 80,             // cells
    "fallback": "unicode-blocks" // "unicode-blocks" | "ascii-placeholder"
  }
}
```

Plus a session toggle: `/inline-images on|off|auto`.

### Tool integration

- `Read` on an image file gains an `inline_display: boolean` parameter
  (default true on capable terminals) that surfaces the image in the
  transcript in addition to feeding it to the model as a vision input.
- A new `DisplayImage` tool, or a Markdown-image convention, lets the model
  emit an image without simultaneously feeding it back as input.

## Reference implementations

Two community projects approximate the feature today and can serve as
testbeds for the in-CC implementation.

### `cc-img-proxy` — PTY proxy wrapper

Repo: <https://github.com/xodn348/cc-img-proxy>

Wraps CC in a PTY proxy. The proxy forwards stdin to CC, intercepts CC's
stdout, detects sentinels (`〚CCIMG:/abs/path.png〛` or
`<!--CCIMG:/abs/path.png-->`) emitted by the assistant, and replaces them with
OSC 1337 inline-image bytes in the output stream sent to iTerm2. Reserves N
rows (computed from PNG dimensions and probed cell-pixel size) so CC's
subsequent cursor writes don't overdraw.

- Stack: TypeScript, Node 20+, `node-pty`.
- Tests: 10/10 passing — streaming sentinel parser unit tests, real-PNG render
  test, full PTY end-to-end test.
- Usage: `claude-img` instead of `claude`.
- Limitations: row reservation is approximate (cell-pixel-size probe + ceil),
  scrollback fidelity is limited to the iTerm2 grid (not CC's transcript),
  iTerm2-only in v1.

This is the closest a community tool can get to true inline rendering today.

### `cclatex-preview` — iTerm2 Python AutoLaunch agent

Repo (in `~/code/cclatex-preview/`, not yet pushed; prepared for publication).

A Python agent runs inside iTerm2 (via the iTerm2 Python API and AutoLaunch),
watches a JSONL request file, and on each request opens a sibling pane
(`session.async_split_pane`) and renders the image there
(`session.async_inject(...)` with chunked OSC 1337). Because the rendering
happens inside iTerm2's process, it bypasses CC's stdout capture entirely.

- Not inline — it's a side pane. But it survives CC repaints unconditionally.
- CLI client: `preview <png> [--split right|below]`.
- Trade-off: requires iTerm2 Python API to be enabled (one-time prompt) and
  takes screen real estate.

This is what most users should run today as a workaround until a proper
in-CC fix lands.

## Roadmap proposal

| Phase | Scope |
| --- | --- |
| P0 | Capability detection + iTerm2 OSC 1337 + Markdown image renderer + phantom-placeholder layout |
| P1 | Kitty graphics protocol, settings + slash command toggle, `Read` `inline_display` parameter |
| P2 | Proper Yoga layout integration, `DisplayImage` tool, sixel, URL fetching |
| P3 | Unicode-block fallback, scrollback fidelity, tmux passthrough handling |

## Files in this proposal

- `README.md` — this document.

The two reference implementations are linked above; no implementation code is
copied into this proposal. The intent is to provide a self-contained design
record alongside the existing tracking issue.

## Acknowledgements

Investigation done with the assistance of Claude Code itself in autonomous
mode, including dispatching parallel sub-agents for each of the four
investigation tracks. Empirical results (channel-passthrough matrix, binary
extraction, PTY proxy implementation, AutoLaunch agent implementation) are
reproducible and the reference repos contain working code and tests.
