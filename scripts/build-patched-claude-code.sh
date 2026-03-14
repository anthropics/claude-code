#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-2.1.63}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d)"
OUT_DIR="$ROOT_DIR/dist"
OUT_FILE="$OUT_DIR/claude-code-${VERSION}-mcp-oauth-redirect-uri.tgz"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

mkdir -p "$OUT_DIR"

TARBALL_URL="$(npm view "@anthropic-ai/claude-code@${VERSION}" dist.tarball --json | tr -d '"')"
if [[ -z "$TARBALL_URL" || "$TARBALL_URL" == "null" ]]; then
  echo "Could not resolve npm tarball URL for version: $VERSION" >&2
  exit 1
fi

echo "Downloading: $TARBALL_URL"
curl -fsSL "$TARBALL_URL" -o "$WORK_DIR/claude-code.tgz"

echo "Extracting package..."
tar -xzf "$WORK_DIR/claude-code.tgz" -C "$WORK_DIR"

PATCH_TARGET="$WORK_DIR/package/cli.js"
if [[ ! -f "$PATCH_TARGET" ]]; then
  echo "Expected file not found: $PATCH_TARGET" >&2
  exit 1
fi

echo "Applying MCP OAuth redirectUri patch..."
node "$ROOT_DIR/scripts/patch-mcp-oauth-redirect-uri.js" "$PATCH_TARGET"
rm -f "${PATCH_TARGET}.bak"

echo "Repacking patched tarball..."
tar -czf "$OUT_FILE" -C "$WORK_DIR" package

echo "Done."
echo "Patched package: $OUT_FILE"
