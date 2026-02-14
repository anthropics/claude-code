"use client";

import { useEffect, useRef, useState } from "react";
import type { DiagramSpec } from "@/lib/types";
import type { VizTheme } from "@/lib/types";
import { DEFAULT_THEME, toMermaidColors } from "@/lib/themes";

interface MermaidViewProps {
  diagram: DiagramSpec;
  theme?: VizTheme;
  /** Enable beautiful-mermaid's built-in animation */
  animate?: boolean;
  /** Show the mermaid source code */
  showSource?: boolean;
  className?: string;
}

/**
 * Renders a mermaid diagram using @vercel/beautiful-mermaid.
 *
 * Supports both SVG (animated, colored) and ASCII output modes.
 * Loads beautiful-mermaid dynamically to keep the client bundle small.
 */
export function MermaidView({
  diagram,
  theme = DEFAULT_THEME,
  animate = true,
  showSource = false,
  className = "",
}: MermaidViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [asciiOutput, setAsciiOutput] = useState<string>("");
  const [mode, setMode] = useState<"svg" | "ascii">("svg");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setLoading(true);
      setError(null);

      try {
        // Dynamic import to avoid SSR issues and reduce bundle
        const bm = await import("@vercel/beautiful-mermaid");

        if (cancelled) return;

        if (mode === "svg") {
          const svg = await bm.renderMermaid(diagram.source, {
            ...toMermaidColors(theme),
            animate: animate
              ? {
                  duration: 650,
                  nodeOverlap: 0.35,
                  nodeAnimation: "fade-up",
                  edgeAnimation: "draw",
                }
              : false,
            font: theme.fontFamily.split(",")[0].replace(/"/g, ""),
            fontSize: 13,
            cornerRadius: 6,
          });
          if (!cancelled) setSvgHtml(svg);
        } else {
          const ascii = bm.renderMermaidAscii(diagram.source, {
            useAscii: false, // Use unicode box drawing chars
            paddingX: 3,
            paddingY: 1,
          });
          if (!cancelled) setAsciiOutput(ascii);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to render diagram"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [diagram.source, theme, animate, mode]);

  return (
    <div className={`mermaid-view ${className}`}>
      {/* Mode toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <h3
          style={{
            margin: 0,
            color: theme.fg,
            fontFamily: theme.fontFamily,
            fontSize: "14px",
          }}
        >
          {diagram.title}
          {diagram.era && (
            <span
              style={{
                marginLeft: "8px",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                backgroundColor: theme.eraColors[diagram.era] ?? theme.accent,
                color: "#fff",
              }}
            >
              {diagram.era}
            </span>
          )}
        </h3>

        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={() => setMode("svg")}
            style={{
              padding: "4px 12px",
              borderRadius: "4px",
              border: `1px solid ${theme.border}`,
              backgroundColor: mode === "svg" ? theme.accent : theme.bg,
              color: mode === "svg" ? "#fff" : theme.fg,
              cursor: "pointer",
              fontFamily: theme.fontFamily,
              fontSize: "11px",
            }}
          >
            SVG
          </button>
          <button
            onClick={() => setMode("ascii")}
            style={{
              padding: "4px 12px",
              borderRadius: "4px",
              border: `1px solid ${theme.border}`,
              backgroundColor: mode === "ascii" ? theme.accent : theme.bg,
              color: mode === "ascii" ? "#fff" : theme.fg,
              cursor: "pointer",
              fontFamily: theme.fontFamily,
              fontSize: "11px",
            }}
          >
            ASCII
          </button>
        </div>
      </div>

      {/* Render area */}
      <div
        ref={containerRef}
        style={{
          backgroundColor: theme.bg,
          border: `1px solid ${theme.border}`,
          borderRadius: "8px",
          padding: "16px",
          overflow: "auto",
        }}
      >
        {loading && (
          <div
            style={{
              color: theme.muted,
              fontFamily: theme.fontFamily,
              fontSize: "13px",
              textAlign: "center",
              padding: "40px",
            }}
          >
            Rendering diagram...
          </div>
        )}

        {error && (
          <div
            style={{
              color: theme.eraColors.teams,
              fontFamily: theme.fontFamily,
              fontSize: "13px",
              padding: "16px",
            }}
          >
            Error: {error}
          </div>
        )}

        {!loading && !error && mode === "svg" && (
          <div dangerouslySetInnerHTML={{ __html: svgHtml }} />
        )}

        {!loading && !error && mode === "ascii" && (
          <pre
            style={{
              margin: 0,
              fontFamily: theme.fontFamily,
              fontSize: "13px",
              lineHeight: "1.4",
              color: theme.fg,
              whiteSpace: "pre",
            }}
          >
            {asciiOutput}
          </pre>
        )}
      </div>

      {/* Source toggle */}
      {showSource && (
        <details
          style={{
            marginTop: "8px",
            border: `1px solid ${theme.border}`,
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <summary
            style={{
              padding: "8px 12px",
              backgroundColor: theme.surface,
              color: theme.muted,
              fontFamily: theme.fontFamily,
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            View Mermaid Source
          </summary>
          <pre
            style={{
              margin: 0,
              padding: "12px",
              backgroundColor: theme.bg,
              color: theme.fg,
              fontFamily: theme.fontFamily,
              fontSize: "12px",
              lineHeight: "1.5",
              overflow: "auto",
            }}
          >
            {diagram.source}
          </pre>
        </details>
      )}
    </div>
  );
}
