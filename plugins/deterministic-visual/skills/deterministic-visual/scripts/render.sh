#!/bin/bash
# render.sh — Main rendering entrypoint for deterministic-visual
#
# Wraps ascii-animate.js for terminal rendering and provides scaffolding
# for Next.js web rendering via beautiful-mermaid.
#
# Usage:
#   ./render.sh --mode <mode> --input <file> [options]
#
# Modes:
#   ascii-static    Single ASCII frame (beautiful-mermaid style)
#   ascii-animate   Animated terminal frames (Ghostty style, default)
#   web-svg         Launch Next.js dev server with beautiful-mermaid SVG
#   frames-json     Output raw frame data as JSON
#
# Options:
#   --input, -i     Input mermaid (.mmd) or process document (.md)
#   --theme, -t     Theme name (default: vercel-dark)
#   --fps, -f       Animation FPS, 1-60 (default: 30)
#   --width, -w     Terminal width (default: auto-detect or 120)
#   --output, -o    Output file (default: stdout)
#   --port, -p      Port for web-svg mode (default: 3000)
#   --help, -h      Show help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANIMATE_JS="${SCRIPT_DIR}/ascii-animate.js"

# ── Defaults ──────────────────────────────────────────────────
MODE="ascii-animate"
INPUT=""
THEME="vercel-dark"
FPS=30
WIDTH="${COLUMNS:-120}"
OUTPUT=""
PORT=3000

# ── Parse Arguments ───────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode|-m)    MODE="$2"; shift 2 ;;
    --input|-i)   INPUT="$2"; shift 2 ;;
    --theme|-t)   THEME="$2"; shift 2 ;;
    --fps|-f)     FPS="$2"; shift 2 ;;
    --width|-w)   WIDTH="$2"; shift 2 ;;
    --output|-o)  OUTPUT="$2"; shift 2 ;;
    --port|-p)    PORT="$2"; shift 2 ;;
    --help|-h)
      echo "deterministic-visual render.sh"
      echo ""
      echo "Modes: ascii-static, ascii-animate, web-svg, frames-json"
      echo ""
      echo "Options:"
      echo "  --mode, -m    Render mode (default: ascii-animate)"
      echo "  --input, -i   Input .mmd or .md file"
      echo "  --theme, -t   Theme (default: vercel-dark)"
      echo "  --fps, -f     FPS for animation (default: 30)"
      echo "  --width, -w   Terminal width (default: auto)"
      echo "  --output, -o  Output file (default: stdout)"
      echo "  --port, -p    Port for web mode (default: 3000)"
      echo ""
      echo "Themes: vercel-dark, vercel-light, dracula, nord, tokyo-night,"
      echo "        catppuccin-mocha, github-dark, rose-pine, gruvbox-dark, monokai"
      echo ""
      echo "Examples:"
      echo "  ./render.sh -i diagram.mmd -t dracula"
      echo "  ./render.sh -i diagram.mmd -m ascii-static -t nord"
      echo "  ./render.sh -i diagram.mmd -m web-svg -p 3001"
      exit 0
      ;;
    *)
      # Positional argument: treat as input file
      if [[ -z "$INPUT" ]]; then
        INPUT="$1"
      else
        echo "Error: Unknown argument: $1" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$INPUT" ]]; then
  echo "Error: No input file specified. Use --input <file> or pass as positional arg." >&2
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Error: Input file not found: $INPUT" >&2
  exit 1
fi

# ── Check Node.js ─────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required but not found." >&2
  echo "Install: https://nodejs.org or 'brew install node'" >&2
  exit 1
fi

# ── Execute ───────────────────────────────────────────────────
case "$MODE" in
  ascii-static)
    if [[ -n "$OUTPUT" ]]; then
      node "$ANIMATE_JS" -i "$INPUT" -m static -t "$THEME" -w "$WIDTH" > "$OUTPUT"
      echo "Written to: $OUTPUT"
    else
      node "$ANIMATE_JS" -i "$INPUT" -m static -t "$THEME" -w "$WIDTH"
    fi
    ;;

  ascii-animate)
    node "$ANIMATE_JS" -i "$INPUT" -m animate -t "$THEME" -f "$FPS" -w "$WIDTH"
    ;;

  frames-json)
    if [[ -n "$OUTPUT" ]]; then
      node "$ANIMATE_JS" -i "$INPUT" -m frames -t "$THEME" -w "$WIDTH" > "$OUTPUT"
      echo "Frames written to: $OUTPUT"
    else
      node "$ANIMATE_JS" -i "$INPUT" -m frames -t "$THEME" -w "$WIDTH"
    fi
    ;;

  web-svg)
    echo "╭──────────────────────────────────────────────────────────╮"
    echo "│  Web SVG Mode — Next.js + beautiful-mermaid              │"
    echo "│                                                          │"
    echo "│  This mode generates a Next.js app scaffold with         │"
    echo "│  beautiful-mermaid SVG rendering.                        │"
    echo "│                                                          │"
    echo "│  Prerequisites:                                          │"
    echo "│    npm install -g create-next-app                        │"
    echo "│    npm install @vercel/beautiful-mermaid                 │"
    echo "│                                                          │"
    echo "│  The scaffold will be created at:                        │"
    echo "│    ./deterministic-visual-web/                           │"
    echo "╰──────────────────────────────────────────────────────────╯"
    echo ""

    WEBAPP_DIR="${SCRIPT_DIR}/../web-app"

    if [[ ! -d "$WEBAPP_DIR" ]]; then
      echo "Creating Next.js scaffold..."
      mkdir -p "$WEBAPP_DIR/app" "$WEBAPP_DIR/lib" "$WEBAPP_DIR/public"

      # Copy mermaid input to web app
      cp "$INPUT" "$WEBAPP_DIR/public/diagram.mmd"

      echo "Scaffold created at: $WEBAPP_DIR"
      echo ""
      echo "To start:"
      echo "  cd $WEBAPP_DIR"
      echo "  npm install"
      echo "  npm run dev -- -p $PORT"
    else
      # Update the diagram file
      cp "$INPUT" "$WEBAPP_DIR/public/diagram.mmd"
      echo "Updated diagram at: $WEBAPP_DIR/public/diagram.mmd"
    fi

    echo ""
    echo "Open: http://localhost:$PORT"
    ;;

  *)
    echo "Error: Unknown mode: $MODE" >&2
    echo "Valid modes: ascii-static, ascii-animate, web-svg, frames-json" >&2
    exit 1
    ;;
esac
