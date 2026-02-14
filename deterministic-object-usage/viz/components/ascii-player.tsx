"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnimationSequence, AsciiFrame } from "@/lib/types";
import { DEFAULT_THEME } from "@/lib/themes";

interface AsciiPlayerProps {
  sequence: AnimationSequence;
  /** CSS class for the container */
  className?: string;
  /** Whether to auto-play on mount */
  autoPlay?: boolean;
  /** Show playback controls */
  showControls?: boolean;
  /** Callback when frame changes */
  onFrameChange?: (frame: AsciiFrame) => void;
}

/**
 * Ghostty-style ASCII animation player.
 *
 * Renders pre-computed frames in a <pre> element using requestAnimationFrame,
 * throttled to the target FPS. Follows Ghostty's approach:
 * - Pre-rendered frames swapped via innerHTML
 * - requestAnimationFrame with FPS throttling
 * - Page Visibility API to pause when tab is hidden
 * - Fixed dimensions to prevent layout reflow
 */
export function AsciiPlayer({
  sequence,
  className = "",
  autoPlay = true,
  showControls = true,
  onFrameChange,
}: AsciiPlayerProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const rafRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const frameIndexRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fps, setFps] = useState(sequence.config.fps);

  const frameDuration = 1000 / fps;
  const totalFrames = sequence.frames.length;

  // ── Core animation loop (Ghostty pattern) ──
  const animate = useCallback(
    (timestamp: number) => {
      if (timestamp - lastFrameTimeRef.current >= frameDuration) {
        const idx = frameIndexRef.current;
        const frame = sequence.frames[idx];

        if (preRef.current && frame) {
          // innerHTML for colored spans, matching Ghostty's approach
          preRef.current.innerHTML = frame.content;
        }

        setCurrentFrame(idx);
        onFrameChange?.(frame);

        // Advance frame
        const nextIdx = (idx + 1) % totalFrames;
        frameIndexRef.current = nextIdx;

        // Stop at end if not looping
        if (nextIdx === 0 && !sequence.config.loop) {
          setIsPlaying(false);
          return;
        }

        lastFrameTimeRef.current = timestamp;
      }

      rafRef.current = requestAnimationFrame(animate);
    },
    [frameDuration, sequence, totalFrames, onFrameChange]
  );

  // ── Play/pause control ──
  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, animate]);

  // ── Page Visibility API (Ghostty PR #213 pattern) ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else if (isPlaying) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [isPlaying, animate]);

  // ── Initial render ──
  useEffect(() => {
    if (preRef.current && sequence.frames[0]) {
      preRef.current.innerHTML = sequence.frames[0].content;
    }
  }, [sequence]);

  // ── Controls ──
  const togglePlay = () => setIsPlaying((p) => !p);

  const seekTo = (idx: number) => {
    frameIndexRef.current = idx;
    const frame = sequence.frames[idx];
    if (preRef.current && frame) {
      preRef.current.innerHTML = frame.content;
    }
    setCurrentFrame(idx);
  };

  const stepForward = () => {
    const next = (frameIndexRef.current + 1) % totalFrames;
    seekTo(next);
  };

  const stepBackward = () => {
    const prev =
      (frameIndexRef.current - 1 + totalFrames) % totalFrames;
    seekTo(prev);
  };

  // Compute max dimensions for fixed layout
  const maxCols = Math.max(...sequence.frames.map((f) => f.cols));
  const maxRows = Math.max(...sequence.frames.map((f) => f.rows));

  return (
    <div className={`ascii-player ${className}`}>
      {/* Terminal viewport */}
      <div
        className="ascii-viewport"
        style={{
          backgroundColor: DEFAULT_THEME.bg,
          border: `1px solid ${DEFAULT_THEME.border}`,
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* Title bar (Ghostty-style window chrome) */}
        <div
          className="ascii-titlebar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 12px",
            backgroundColor: DEFAULT_THEME.surface,
            borderBottom: `1px solid ${DEFAULT_THEME.border}`,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#f85149",
            }}
          />
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#d29922",
            }}
          />
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#3fb950",
            }}
          />
          <span
            style={{
              marginLeft: "auto",
              color: DEFAULT_THEME.muted,
              fontSize: "11px",
              fontFamily: DEFAULT_THEME.fontFamily,
            }}
          >
            {sequence.frames[currentFrame]?.era ?? "deterministic-viz"} —{" "}
            {fps}fps
          </span>
        </div>

        {/* Frame content */}
        <pre
          ref={preRef}
          style={{
            margin: 0,
            padding: "16px",
            fontFamily: DEFAULT_THEME.fontFamily,
            fontSize: "13px",
            lineHeight: "1.4",
            color: DEFAULT_THEME.fg,
            minWidth: `${maxCols}ch`,
            minHeight: `${maxRows * 1.4}em`,
            whiteSpace: "pre",
            overflow: "auto",
          }}
        />
      </div>

      {/* Playback controls */}
      {showControls && (
        <div
          className="ascii-controls"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "8px",
            padding: "8px 12px",
            backgroundColor: DEFAULT_THEME.surface,
            border: `1px solid ${DEFAULT_THEME.border}`,
            borderRadius: "6px",
            fontFamily: DEFAULT_THEME.fontFamily,
            fontSize: "12px",
            color: DEFAULT_THEME.fg,
          }}
        >
          <button onClick={stepBackward} title="Previous frame">
            ⏮
          </button>
          <button onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button onClick={stepForward} title="Next frame">
            ⏭
          </button>

          {/* Progress bar */}
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            value={currentFrame}
            onChange={(e) => seekTo(Number(e.target.value))}
            style={{ flex: 1 }}
          />

          {/* Frame counter */}
          <span style={{ color: DEFAULT_THEME.muted, minWidth: "80px" }}>
            {currentFrame + 1}/{totalFrames}
          </span>

          {/* FPS control */}
          <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ color: DEFAULT_THEME.muted }}>FPS:</span>
            <select
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              style={{
                backgroundColor: DEFAULT_THEME.bg,
                color: DEFAULT_THEME.fg,
                border: `1px solid ${DEFAULT_THEME.border}`,
                borderRadius: "4px",
                padding: "2px 4px",
                fontSize: "11px",
              }}
            >
              {[12, 24, 30, 48, 60].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Color class styles for Ghostty-style colored ASCII */}
      <style>{`
        .ascii-player .b { color: ${DEFAULT_THEME.eraColors.foundation}; }
        .ascii-player .g { color: ${DEFAULT_THEME.eraColors.customization}; }
        .ascii-player .y { color: ${DEFAULT_THEME.eraColors.enhancement}; }
        .ascii-player .r { color: ${DEFAULT_THEME.eraColors.teams}; }
        .ascii-player .accent { color: ${DEFAULT_THEME.accent}; }
        .ascii-player .muted { color: ${DEFAULT_THEME.muted}; }

        .ascii-controls button {
          background: ${DEFAULT_THEME.bg};
          color: ${DEFAULT_THEME.fg};
          border: 1px solid ${DEFAULT_THEME.border};
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 14px;
        }
        .ascii-controls button:hover {
          background: ${DEFAULT_THEME.border};
        }
      `}</style>
    </div>
  );
}
