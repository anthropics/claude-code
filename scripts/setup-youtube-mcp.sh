#!/usr/bin/env bash
# Builds the in-repo MCP servers and writes YOUTUBE_API_KEY into your shell
# profile so the project-scoped servers in .mcp.json can read it.
#
#   ./scripts/setup-youtube-mcp.sh              # prompts for the key
#   ./scripts/setup-youtube-mcp.sh <api-key>    # takes it as an argument
#
# Run this on your own machine, not in a remote/web session container.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

KEY="${1:-}"
LANG_PREF="${YOUTUBE_TRANSCRIPT_LANG:-tr}"

if [[ -z "$KEY" ]]; then
  # -s keeps the key off the screen; it still never enters shell history
  # because it is read rather than typed as an argument.
  read -rsp "YouTube Data API key: " KEY
  echo
fi

if [[ ${#KEY} -ne 39 || "$KEY" != AIza* ]]; then
  echo "Bu bir Google API anahtarina benzemiyor." >&2
  echo "  beklenen: 'AIza' ile baslayan 39 karakter" >&2
  echo "  alinan:   ${#KEY} karakter" >&2
  exit 1
fi

echo -n "Anahtar dogrulaniyor... "
code=$(curl -s -o /dev/null -w '%{http_code}' \
  "https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&type=video&key=${KEY}")
if [[ "$code" != "200" ]]; then
  echo "HTTP $code"
  echo "Anahtar reddedildi. YouTube Data API v3 etkin mi ve anahtar" >&2
  echo "kisitlamalari bu cagriyi engelliyor mu kontrol et." >&2
  exit 1
fi
echo "HTTP 200"

# Pick the profile the caller's LOGIN shell loads, from $SHELL.
#
# Do not test ZSH_VERSION/BASH_VERSION here: this script always runs under
# bash because of its shebang, so BASH_VERSION is set no matter what the user
# actually types in. That mistake sends the exports to .bashrc for zsh users,
# where they are never sourced — and macOS has defaulted to zsh since Catalina.
case "$(basename "${SHELL:-/bin/sh}")" in
  zsh) RC="$HOME/.zshrc" ;;
  bash)
    # bash reads .bash_profile for login shells on macOS and .bashrc elsewhere;
    # prefer whichever already exists so we append where the user is looking.
    if [[ "$(uname -s)" == "Darwin" && -f "$HOME/.bash_profile" ]]; then
      RC="$HOME/.bash_profile"
    else
      RC="$HOME/.bashrc"
    fi
    ;;
  *) RC="$HOME/.profile" ;;
esac

if grep -q 'YOUTUBE_API_KEY' "$RC" 2>/dev/null; then
  echo "$RC icinde zaten bir YOUTUBE_API_KEY satiri var."
  echo "Uzerine yazmiyorum — elle guncelle."
  exit 0
fi

cat >>"$RC" <<EOF

# YouTube MCP server (.mcp.json)
export YOUTUBE_API_KEY="${KEY}"
export YOUTUBE_TRANSCRIPT_LANG="${LANG_PREF}"
EOF

echo "Eklendi: $RC"

# The servers run from compiled output, and dist/ is not tracked in git, so a
# fresh clone needs this before .mcp.json can start anything.
for server in youtube-mcp-server instagram-mcp-server; do
  dir="$REPO_ROOT/mcp-servers/$server"
  [ -d "$dir" ] || continue
  echo
  echo "Derleniyor: $server"
  (cd "$dir" && npm install --silent && npm run build --silent)
done

echo
echo "Simdi:"
echo "  source $RC"
echo "  claude mcp list      # youtube -> Connected bekleniyor"
echo
echo "Instagram sunucusu ayrica INSTAGRAM_ACCESS_TOKEN ister; docs/mcp-servers.md'ye bak."
