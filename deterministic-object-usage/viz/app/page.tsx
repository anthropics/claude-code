"use client";

import { useState } from "react";
import { AsciiPlayer } from "@/components/ascii-player";
import { MermaidView } from "@/components/mermaid-view";
import { EraTimeline } from "@/components/era-timeline";
import {
  buildAnimationSequence,
  textToFrame,
  titleFrame,
} from "@/lib/ascii-animator";
import { parseChangelog, filterForFeature } from "@/lib/changelog-parser";
import { generateDiagrams } from "@/lib/mermaid-generator";
import { DEFAULT_THEME, THEMES, ghosttyDark } from "@/lib/themes";
import type { FeatureConfig, VizTheme, AnimationSequence } from "@/lib/types";

// ── Demo feature config: Subagents ──
const SUBAGENTS_CONFIG: FeatureConfig = {
  name: "Subagents",
  keywords: [
    "subagent",
    "sub-agent",
    "sub agent",
    "Task tool",
    "agent type",
    "subagent_type",
    "max_turns",
    "SubagentStop",
  ],
  contextKeywords: ["parallel", "background", "spawn", "dispatch"],
  excludePatterns: ["unrelated"],
  eras: [
    {
      id: "foundation",
      label: "Foundation",
      color: "#58a6ff",
      accent: "#79c0ff",
      versions: ["0.2.74", "0.2.75", "0.2.76", "0.2.77"],
    },
    {
      id: "customization",
      label: "Customization",
      color: "#3fb950",
      accent: "#56d364",
      versions: ["0.2.78", "0.2.79", "0.2.80", "0.2.81"],
    },
    {
      id: "enhancement",
      label: "Enhancement",
      color: "#d29922",
      accent: "#e3b341",
      versions: ["1.0.0", "1.0.1", "1.0.2", "1.0.3", "1.0.4"],
    },
    {
      id: "teams",
      label: "Teams",
      color: "#f85149",
      accent: "#ff7b72",
      versions: ["2.0.0", "2.0.1", "2.1.0", "2.1.39"],
    },
  ],
};

/**
 * Build a demo animation sequence using Ghostty-style ASCII art.
 * Each era gets a title card + ASCII representation of the architecture.
 */
function buildDemoSequence(): AnimationSequence {
  const frames = [
    // Title card
    titleFrame(
      "deterministic-viz",
      "beautiful-mermaid + ghostty animation",
      70,
      "accent"
    ),

    // Foundation era
    textToFrame(
      [
        '<span class="b">╔══════════════════════════════════════════════╗</span>',
        '<span class="b">║           FOUNDATION ERA (v0.2.x)           ║</span>',
        '<span class="b">╠══════════════════════════════════════════════╣</span>',
        '<span class="b">║                                              ║</span>',
        '<span class="b">║     ┌──────────┐     ┌──────────────┐       ║</span>',
        '<span class="b">║     │  Claude   │────▶│  Task Tool   │       ║</span>',
        '<span class="b">║     │  Agent    │     │  (subagent)  │       ║</span>',
        '<span class="b">║     └──────────┘     └──────┬───────┘       ║</span>',
        '<span class="b">║                             │               ║</span>',
        '<span class="b">║                      ┌──────▼───────┐       ║</span>',
        '<span class="b">║                      │  Bash Agent  │       ║</span>',
        '<span class="b">║                      └──────────────┘       ║</span>',
        '<span class="b">║                                              ║</span>',
        '<span class="b">╚══════════════════════════════════════════════╝</span>',
      ].join("\n"),
      "foundation"
    ),

    // Customization era
    textToFrame(
      [
        '<span class="g">╔══════════════════════════════════════════════╗</span>',
        '<span class="g">║         CUSTOMIZATION ERA (v0.2.8x)         ║</span>',
        '<span class="g">╠══════════════════════════════════════════════╣</span>',
        '<span class="g">║                                              ║</span>',
        '<span class="g">║  ┌──────────┐     ┌──────────────┐          ║</span>',
        '<span class="g">║  │  Claude   │────▶│  Task Tool   │          ║</span>',
        '<span class="g">║  │  Agent    │     │  max_turns   │          ║</span>',
        '<span class="g">║  └──────────┘     └──────┬───────┘          ║</span>',
        '<span class="g">║                          │                   ║</span>',
        '<span class="g">║           ┌──────────────┼──────────────┐   ║</span>',
        '<span class="g">║           ▼              ▼              ▼   ║</span>',
        '<span class="g">║    ┌────────────┐ ┌────────────┐ ┌───────┐ ║</span>',
        '<span class="g">║    │   Bash     │ │  Explore   │ │  Plan │ ║</span>',
        '<span class="g">║    │   Agent    │ │  Agent     │ │ Agent │ ║</span>',
        '<span class="g">║    └────────────┘ └────────────┘ └───────┘ ║</span>',
        '<span class="g">║                                              ║</span>',
        '<span class="g">╚══════════════════════════════════════════════╝</span>',
      ].join("\n"),
      "customization"
    ),

    // Enhancement era
    textToFrame(
      [
        '<span class="y">╔══════════════════════════════════════════════════════╗</span>',
        '<span class="y">║            ENHANCEMENT ERA (v1.0.x)                  ║</span>',
        '<span class="y">╠══════════════════════════════════════════════════════╣</span>',
        '<span class="y">║                                                      ║</span>',
        '<span class="y">║  ┌──────────┐     ┌──────────────┐                   ║</span>',
        '<span class="y">║  │  Claude   │────▶│  Task Tool   │──┐               ║</span>',
        '<span class="y">║  │  Agent    │     │  max_turns   │  │               ║</span>',
        '<span class="y">║  └──────────┘     │  model        │  │               ║</span>',
        '<span class="y">║       │           └──────────────┘  │               ║</span>',
        '<span class="y">║       │    ┌─────────────────────────┘               ║</span>',
        '<span class="y">║       ▼    ▼                                         ║</span>',
        '<span class="y">║  ┌────────┐ ┌────────┐ ┌──────┐ ┌────────┐          ║</span>',
        '<span class="y">║  │  Bash  │ │Explore │ │ Plan │ │General │          ║</span>',
        '<span class="y">║  │  Agent │ │ Agent  │ │Agent │ │Purpose │          ║</span>',
        '<span class="y">║  └────────┘ └────────┘ └──────┘ └────────┘          ║</span>',
        '<span class="y">║       │         │          │         │               ║</span>',
        '<span class="y">║       └─────────┴──────────┴─────────┘               ║</span>',
        '<span class="y">║                     │                                ║</span>',
        '<span class="y">║              ┌──────▼──────┐                         ║</span>',
        '<span class="y">║              │ SubagentStop│                         ║</span>',
        '<span class="y">║              │   Hook      │                         ║</span>',
        '<span class="y">║              └─────────────┘                         ║</span>',
        '<span class="y">║                                                      ║</span>',
        '<span class="y">╚══════════════════════════════════════════════════════╝</span>',
      ].join("\n"),
      "enhancement"
    ),

    // Teams era
    textToFrame(
      [
        '<span class="r">╔══════════════════════════════════════════════════════════════╗</span>',
        '<span class="r">║                   TEAMS ERA (v2.x)                          ║</span>',
        '<span class="r">╠══════════════════════════════════════════════════════════════╣</span>',
        '<span class="r">║                                                              ║</span>',
        '<span class="r">║  ┌──────────┐     ┌──────────────────┐    ┌──────────────┐   ║</span>',
        '<span class="r">║  │  Claude   │────▶│    Task Tool     │───▶│  Background  │   ║</span>',
        '<span class="r">║  │  Agent    │     │  max_turns       │    │  Execution   │   ║</span>',
        '<span class="r">║  └──────────┘     │  model            │    └──────────────┘   ║</span>',
        '<span class="r">║       │           │  run_in_background│                       ║</span>',
        '<span class="r">║       │           └────────┬─────────┘                       ║</span>',
        '<span class="r">║       │    ┌───────────────┼───────────────┐                  ║</span>',
        '<span class="r">║       ▼    ▼               ▼               ▼                  ║</span>',
        '<span class="r">║  ┌────────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌─────────────┐   ║</span>',
        '<span class="r">║  │  Bash  │ │Explore │ │ Plan │ │General │ │Custom Agent │   ║</span>',
        '<span class="r">║  │  Agent │ │ Agent  │ │Agent │ │Purpose │ │  Types      │   ║</span>',
        '<span class="r">║  └────────┘ └────────┘ └──────┘ └────────┘ └─────────────┘   ║</span>',
        '<span class="r">║       │         │          │         │           │             ║</span>',
        '<span class="r">║       └─────────┴──────────┴─────────┴───────────┘             ║</span>',
        '<span class="r">║                           │                                    ║</span>',
        '<span class="r">║            ┌──────────────┼──────────────┐                     ║</span>',
        '<span class="r">║            ▼              ▼              ▼                     ║</span>',
        '<span class="r">║     ┌────────────┐ ┌────────────┐ ┌──────────┐                ║</span>',
        '<span class="r">║     │SubagentStop│ │ Context    │ │ Resume   │                ║</span>',
        '<span class="r">║     │   Hook     │ │ Sharing    │ │ Agent    │                ║</span>',
        '<span class="r">║     └────────────┘ └────────────┘ └──────────┘                ║</span>',
        '<span class="r">║                                                              ║</span>',
        '<span class="r">╚══════════════════════════════════════════════════════════════╝</span>',
      ].join("\n"),
      "teams"
    ),
  ];

  return buildAnimationSequence(frames, { fps: 24, transitionFrames: 12 });
}

// ── Pre-built demo data ──
const DEMO_MERMAID_ARCH = `graph TD
  CORE[("Subagents")]
  style CORE fill:#6e40c9,stroke:#8b5cf6,color:#fff

  subgraph Agents["Agent Types"]
    BASH["Bash Agent"]
    EXPLORE["Explore Agent"]
    PLAN["Plan Agent"]
    GP["General Purpose"]
  end

  subgraph Config["Configuration"]
    MT["max_turns"]
    MODEL["model"]
    BG["run_in_background"]
    RESUME["resume"]
  end

  subgraph Hooks["Lifecycle"]
    SS["SubagentStop"]
    CTX["Context Sharing"]
  end

  CORE --> BASH
  CORE --> EXPLORE
  CORE --> PLAN
  CORE --> GP
  CORE --> MT
  CORE --> MODEL
  CORE --> BG
  CORE --> RESUME
  CORE --> SS
  CORE --> CTX`;

const DEMO_MERMAID_SEQ = `sequenceDiagram
  participant User
  participant Claude
  participant TaskTool
  participant SubAgent

  User->>Claude: Request
  Claude->>TaskTool: spawn(type, prompt)
  TaskTool->>SubAgent: Initialize
  SubAgent->>SubAgent: Execute tools
  SubAgent-->>TaskTool: Result
  TaskTool-->>Claude: Output
  Claude->>User: Response`;

export default function HomePage() {
  const [activeTheme, setActiveTheme] = useState<VizTheme>(ghosttyDark);
  const [demoSequence] = useState(() => buildDemoSequence());

  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "32px 24px",
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: "40px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: activeTheme.fg,
            marginBottom: "8px",
          }}
        >
          deterministic-viz
        </h1>
        <p
          style={{
            color: activeTheme.muted,
            fontSize: "14px",
            maxWidth: "600px",
          }}
        >
          Beautiful Mermaid diagrams + Ghostty-style ASCII animation for
          visualizing feature evolution from CHANGELOG.md. Powered by{" "}
          <a
            href="https://github.com/vercel-labs/beautiful-mermaid"
            target="_blank"
            rel="noopener"
          >
            @vercel/beautiful-mermaid
          </a>
          .
        </p>

        {/* Theme selector */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "16px",
          }}
        >
          {Object.entries(THEMES).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => setActiveTheme(theme)}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                border: `2px solid ${
                  activeTheme.name === theme.name
                    ? theme.accent
                    : theme.border
                }`,
                backgroundColor:
                  activeTheme.name === theme.name
                    ? theme.accent + "22"
                    : theme.bg,
                color: theme.fg,
                cursor: "pointer",
                fontSize: "12px",
                fontFamily: activeTheme.fontFamily,
              }}
            >
              {theme.name}
            </button>
          ))}
        </div>
      </header>

      {/* Section 1: Ghostty-style ASCII Animation */}
      <section style={{ marginBottom: "48px" }}>
        <h2
          style={{
            fontSize: "18px",
            color: activeTheme.fg,
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              color: activeTheme.accent,
              fontFamily: activeTheme.fontFamily,
            }}
          >
            01
          </span>
          Ghostty-Style ASCII Animation
        </h2>
        <p
          style={{
            color: activeTheme.muted,
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          Frame-by-frame ASCII art animation at 24fps with density-ramp morphing
          transitions. Each era fades into the next through the character density
          ramp: · ~ o x + = * % $ @
        </p>
        <AsciiPlayer
          sequence={demoSequence}
          autoPlay={true}
          showControls={true}
        />
      </section>

      {/* Section 2: Beautiful Mermaid Diagrams */}
      <section style={{ marginBottom: "48px" }}>
        <h2
          style={{
            fontSize: "18px",
            color: activeTheme.fg,
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              color: activeTheme.accent,
              fontFamily: activeTheme.fontFamily,
            }}
          >
            02
          </span>
          Beautiful Mermaid Diagrams
        </h2>
        <p
          style={{
            color: activeTheme.muted,
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          Architecture and sequence diagrams rendered with @vercel/beautiful-mermaid.
          Toggle between animated SVG and Unicode ASCII modes.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          <MermaidView
            diagram={{
              type: "flowchart",
              title: "Subagents Architecture",
              source: DEMO_MERMAID_ARCH,
            }}
            theme={activeTheme}
            animate={true}
            showSource={true}
          />
          <MermaidView
            diagram={{
              type: "sequence",
              title: "Subagent Lifecycle",
              source: DEMO_MERMAID_SEQ,
            }}
            theme={activeTheme}
            animate={true}
            showSource={true}
          />
        </div>
      </section>

      {/* Section 3: Era Timeline */}
      <section style={{ marginBottom: "48px" }}>
        <h2
          style={{
            fontSize: "18px",
            color: activeTheme.fg,
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              color: activeTheme.accent,
              fontFamily: activeTheme.fontFamily,
            }}
          >
            03
          </span>
          Feature Evolution Timeline
        </h2>
        <p
          style={{
            color: activeTheme.muted,
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          Interactive timeline with era filtering. Click a version to expand its
          changelog entries.
        </p>
        <EraTimeline
          versions={DEMO_VERSIONS}
          config={SUBAGENTS_CONFIG}
          theme={activeTheme}
        />
      </section>

      {/* Section 4: How It Works */}
      <section style={{ marginBottom: "48px" }}>
        <h2
          style={{
            fontSize: "18px",
            color: activeTheme.fg,
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              color: activeTheme.accent,
              fontFamily: activeTheme.fontFamily,
            }}
          >
            04
          </span>
          The Deterministic Process
        </h2>
        <div
          style={{
            backgroundColor: activeTheme.surface,
            border: `1px solid ${activeTheme.border}`,
            borderRadius: "8px",
            padding: "24px",
          }}
        >
          <pre
            style={{
              fontFamily: activeTheme.fontFamily,
              fontSize: "13px",
              lineHeight: "1.6",
              color: activeTheme.fg,
              whiteSpace: "pre-wrap",
            }}
          >
            {`1. FETCH    → Read CHANGELOG.md, parse by semver versions
2. FILTER   → Match entries against feature keywords (4-tier)
3. EXPLORE  → Discover object model from codebase
4. ERA      → Group versions into evolutionary milestones
5. MERMAID  → Generate architecture + sequence diagrams
6. ANIMATE  → Render per-era ASCII frames with density morphing
7. SERVE    → Next.js app with beautiful-mermaid SVG + ASCII player`}
          </pre>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${activeTheme.border}`,
          paddingTop: "16px",
          color: activeTheme.muted,
          fontSize: "12px",
        }}
      >
        <p>
          Built with{" "}
          <a href="https://github.com/vercel-labs/beautiful-mermaid">
            @vercel/beautiful-mermaid
          </a>{" "}
          +{" "}
          <a href="https://ghostty.org/">Ghostty</a>-style animation +{" "}
          <a href="https://nextjs.org/">Next.js</a>
        </p>
        <p style={{ marginTop: "4px" }}>
          Testable with{" "}
          <a href="https://agent-browser.dev/">agent-browser</a>:{" "}
          <code
            style={{
              backgroundColor: activeTheme.surface,
              padding: "2px 6px",
              borderRadius: "3px",
            }}
          >
            agent-browser open http://localhost:3000 && agent-browser snapshot -i
          </code>
        </p>
      </footer>
    </main>
  );
}

// ── Demo version data (subset for illustration) ──
const DEMO_VERSIONS = [
  {
    version: "0.2.74",
    date: "2024-08-15",
    changes: [
      {
        type: "added" as const,
        text: "Introduce `Task` tool for spawning subagents with isolated context",
        identifiers: ["Task", "subagent"],
      },
      {
        type: "added" as const,
        text: "Add `Bash` subagent type for command execution",
        identifiers: ["Bash", "subagent_type"],
      },
    ],
  },
  {
    version: "0.2.78",
    date: "2024-09-10",
    changes: [
      {
        type: "added" as const,
        text: "Add `Explore` subagent type for codebase search",
        identifiers: ["Explore", "subagent_type"],
      },
      {
        type: "added" as const,
        text: "Add `max_turns` parameter to control subagent execution depth",
        identifiers: ["max_turns"],
      },
    ],
  },
  {
    version: "0.2.80",
    date: "2024-10-01",
    changes: [
      {
        type: "added" as const,
        text: "Add `Plan` subagent type for architecture planning",
        identifiers: ["Plan", "subagent_type"],
      },
      {
        type: "fixed" as const,
        text: "Fix subagent context isolation when running in parallel",
        identifiers: ["subagent"],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2025-01-15",
    changes: [
      {
        type: "added" as const,
        text: "Add `model` parameter to select specific model for subagent execution",
        identifiers: ["model", "subagent"],
      },
      {
        type: "added" as const,
        text: "Add `SubagentStop` hook for lifecycle management",
        identifiers: ["SubagentStop"],
      },
    ],
  },
  {
    version: "1.0.3",
    date: "2025-03-20",
    changes: [
      {
        type: "changed" as const,
        text: "Improve subagent output streaming for large results",
        identifiers: ["subagent"],
      },
      {
        type: "fixed" as const,
        text: "Fix `general-purpose` subagent tool access permissions",
        identifiers: ["general-purpose", "subagent_type"],
      },
    ],
  },
  {
    version: "2.0.0",
    date: "2025-08-01",
    changes: [
      {
        type: "added" as const,
        text: "Add `run_in_background` parameter for async subagent execution",
        identifiers: ["run_in_background", "subagent"],
      },
      {
        type: "added" as const,
        text: "Add `resume` parameter to continue previous subagent sessions",
        identifiers: ["resume", "subagent"],
      },
    ],
  },
  {
    version: "2.1.39",
    date: "2025-12-10",
    changes: [
      {
        type: "added" as const,
        text: "Add custom `subagent_type` definitions via agent configuration",
        identifiers: ["subagent_type"],
      },
      {
        type: "changed" as const,
        text: "Subagents now share context with parent via `access to current context`",
        identifiers: ["subagent", "context"],
      },
    ],
  },
];
