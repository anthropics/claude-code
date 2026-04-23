#!/bin/bash
# Image-build-time installer for ECC curated assets.
# Reads whitelists from /tmp and writes curated content into /home/node/.claude/.
# Docker's named-volume seeding then propagates this into fresh volumes on
# first container start — the same lifecycle as `npm install -g claude-code`.
set -euo pipefail

ECC_SRC="/tmp/ecc-source"
DST="/home/node/.claude"
WL="/tmp/claude-whitelist.txt"
HK="/tmp/claude-hooks-keep.txt"

strip() { grep -vE '^[[:space:]]*(#|$)' "$1" | awk '{$1=$1; print}'; }

echo "[ECC] Cloning repository..."
git clone --depth 1 https://github.com/affaan-m/everything-claude-code.git "$ECC_SRC"

echo "[ECC] Applying whitelist paths..."
while IFS= read -r rel; do
  src="$ECC_SRC/$rel"
  dst="$DST/$rel"
  mkdir -p "$(dirname "$dst")"
  if [ -d "$src" ]; then
    mkdir -p "$dst"
    cp -R "$src/." "$dst/"
  elif [ -f "$src" ]; then
    cp "$src" "$dst"
  else
    echo "  WARN: $src not found in ECC source"
  fi
done < <(strip "$WL")

if [ -f "$ECC_SRC/hooks/hooks.json" ] && [ -f "$HK" ]; then
  echo "[ECC] Filtering hooks.json..."
  keep=$(strip "$HK" | jq -R . | jq -s .)
  mkdir -p "$DST/hooks"
  jq --argjson keep "$keep" '
    .hooks |= with_entries(
      .value |= map(select(.id as $id | $keep | index($id) != null))
    )
  ' "$ECC_SRC/hooks/hooks.json" > "$DST/hooks/hooks.json"
  [ -f "$ECC_SRC/hooks/README.md" ] && cp "$ECC_SRC/hooks/README.md" "$DST/hooks/README.md"
fi

rm -rf "$ECC_SRC"
echo "[ECC] Install complete."
