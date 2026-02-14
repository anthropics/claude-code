"use client";

import { useState } from "react";
import type { VersionBlock, FeatureConfig, Era } from "@/lib/types";
import type { VizTheme } from "@/lib/types";
import { DEFAULT_THEME } from "@/lib/themes";
import { assignEras } from "@/lib/changelog-parser";

interface EraTimelineProps {
  versions: VersionBlock[];
  config: FeatureConfig;
  theme?: VizTheme;
  /** Callback when an era filter is toggled */
  onEraFilter?: (activeEras: Set<string>) => void;
  /** Callback when a version is selected */
  onVersionSelect?: (version: string) => void;
}

const CHANGE_ICONS: Record<string, { symbol: string; color: string }> = {
  added: { symbol: "+", color: "#3fb950" },
  fixed: { symbol: "~", color: "#58a6ff" },
  changed: { symbol: "*", color: "#d29922" },
  breaking: { symbol: "!", color: "#f85149" },
};

/**
 * Interactive timeline showing feature evolution across eras.
 * Each version is a node on the timeline with era-colored dots.
 */
export function EraTimeline({
  versions,
  config,
  theme = DEFAULT_THEME,
  onEraFilter,
  onVersionSelect,
}: EraTimelineProps) {
  const [activeEras, setActiveEras] = useState<Set<string>>(
    new Set(config.eras.map((e) => e.id))
  );
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const versionToEra = assignEras(versions, config);

  const toggleEra = (eraId: string) => {
    setActiveEras((prev) => {
      const next = new Set(prev);
      if (next.has(eraId)) {
        next.delete(eraId);
      } else {
        next.add(eraId);
      }
      onEraFilter?.(next);
      return next;
    });
  };

  const filteredVersions = versions.filter((v) => {
    const era = versionToEra.get(v.version);
    return era ? activeEras.has(era) : true;
  });

  return (
    <div
      className="era-timeline"
      style={{ fontFamily: theme.fontFamily }}
    >
      {/* Era filter buttons */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        {config.eras.map((era) => (
          <button
            key={era.id}
            onClick={() => toggleEra(era.id)}
            style={{
              padding: "6px 16px",
              borderRadius: "20px",
              border: `2px solid ${era.color}`,
              backgroundColor: activeEras.has(era.id)
                ? era.color
                : "transparent",
              color: activeEras.has(era.id) ? "#fff" : era.color,
              cursor: "pointer",
              fontFamily: theme.fontFamily,
              fontSize: "12px",
              fontWeight: 600,
              transition: "all 0.2s ease",
            }}
          >
            {era.label}
            <span style={{ marginLeft: "6px", opacity: 0.7 }}>
              ({era.versions.length})
            </span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div
        style={{
          position: "relative",
          paddingLeft: "24px",
        }}
      >
        {/* Vertical line */}
        <div
          style={{
            position: "absolute",
            left: "11px",
            top: 0,
            bottom: 0,
            width: "2px",
            backgroundColor: theme.border,
          }}
        />

        {filteredVersions.map((block) => {
          const eraId = versionToEra.get(block.version);
          const era = config.eras.find((e) => e.id === eraId);
          const isExpanded = expandedVersion === block.version;

          return (
            <div
              key={block.version}
              style={{ marginBottom: "12px", position: "relative" }}
            >
              {/* Era dot */}
              <div
                style={{
                  position: "absolute",
                  left: "-19px",
                  top: "6px",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: era?.color ?? theme.muted,
                  border: `2px solid ${theme.bg}`,
                  boxShadow: `0 0 0 2px ${era?.color ?? theme.muted}`,
                }}
              />

              {/* Version header */}
              <button
                onClick={() => {
                  setExpandedVersion(isExpanded ? null : block.version);
                  onVersionSelect?.(block.version);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <code
                  style={{
                    color: theme.fg,
                    fontSize: "14px",
                    fontWeight: 600,
                    fontFamily: theme.fontFamily,
                  }}
                >
                  {block.version}
                </code>
                {era && (
                  <span
                    style={{
                      padding: "1px 8px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      backgroundColor: era.color + "22",
                      color: era.color,
                      fontFamily: theme.fontFamily,
                    }}
                  >
                    {era.label}
                  </span>
                )}
                {block.date && (
                  <span
                    style={{
                      color: theme.muted,
                      fontSize: "11px",
                      marginLeft: "auto",
                    }}
                  >
                    {block.date}
                  </span>
                )}
              </button>

              {/* Changes (expanded) */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: "4px",
                    paddingLeft: "8px",
                    borderLeft: `2px solid ${theme.border}`,
                    marginLeft: "4px",
                  }}
                >
                  {block.changes.map((change, i) => {
                    const icon = CHANGE_ICONS[change.type] ?? CHANGE_ICONS.added;
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: "6px",
                          padding: "3px 0",
                          fontSize: "12px",
                          lineHeight: "1.5",
                        }}
                      >
                        <span
                          style={{
                            color: icon.color,
                            fontWeight: 700,
                            fontFamily: theme.fontFamily,
                            flexShrink: 0,
                          }}
                        >
                          {icon.symbol}
                        </span>
                        <span style={{ color: theme.fg }}>
                          {highlightIdentifiers(change.text, theme)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginTop: "16px",
          padding: "12px",
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: "6px",
          fontSize: "12px",
          color: theme.muted,
        }}
      >
        <span>
          {filteredVersions.length} releases shown
        </span>
        <span>
          {filteredVersions.reduce((n, v) => n + v.changes.length, 0)} changes
        </span>
        {Object.entries(CHANGE_ICONS).map(([type, icon]) => {
          const count = filteredVersions.reduce(
            (n, v) => n + v.changes.filter((c) => c.type === type).length,
            0
          );
          return count > 0 ? (
            <span key={type} style={{ color: icon.color }}>
              {icon.symbol} {count} {type}
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}

/**
 * Highlight backtick-wrapped identifiers in change text.
 */
function highlightIdentifiers(
  text: string,
  theme: VizTheme
): (string | JSX.Element)[] {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          style={{
            backgroundColor: theme.surface,
            color: theme.accent,
            padding: "1px 5px",
            borderRadius: "3px",
            fontSize: "11px",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
