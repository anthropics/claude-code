#!/usr/bin/env bash
# Status line: model · cwd · context window bar · cost · rate limit bar
# Works on macOS, Linux, and Windows (Git Bash / WSL). Requires Node.js.
#
# Install:
#   1. Copy this file to ~/.claude/statusline-command.sh
#   2. chmod +x ~/.claude/statusline-command.sh
#   3. Run: claude config set statusLineCommand "bash ~/.claude/statusline-command.sh"
#
# On Windows (Git Bash), use forward-slash path:
#   claude config set statusLineCommand "bash /C/Users/<you>/.claude/statusline-command.sh"

input=$(cat)

node -e "
const d = JSON.parse(process.argv[1]);
const model   = d.model?.display_name ?? '?';
const cwd     = d.cwd ?? d.workspace?.current_dir ?? '';
const remPct  = d.context_window?.remaining_percentage;
const remTok  = remPct != null ? Math.floor(d.context_window.context_window_size * remPct / 100) : null;
const cost    = d.cost?.total_cost_usd;
const now     = new Date().toLocaleTimeString('en', {hour:'2-digit', minute:'2-digit'});

const dim = (c, s) => '\x1b[2;' + c + 'm' + s + '\x1b[0m';

let out = dim(36, model) + '  ' + dim(33, cwd + ' >');

if (remTok != null && remPct != null) {
  const pct      = Math.round(remPct);
  const barWidth = 10;
  const filled   = Math.round((100 - pct) / 10);
  const bar      = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  const color    = pct > 50 ? 32 : pct > 25 ? 33 : 31;
  out += '  ' + dim(color, bar) + ' ' + dim(color, Math.round(remTok / 1000) + 'k left (' + pct + '%)');
}

if (cost != null)
  out += '  ' + dim(35, '\$' + cost.toFixed(4));

out += '  ' + dim(37, now);

const rl = d.rate_limits?.five_hour;
if (rl != null) {
  const usedPct  = Math.round(rl.used_percentage);
  const barWidth = 10;
  const filled   = Math.round(usedPct / 10);
  const bar      = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  const color    = usedPct < 50 ? 34 : usedPct < 80 ? 33 : 31;
  const secsLeft = Math.max(0, rl.resets_at - Math.floor(Date.now() / 1000));
  const hrs      = Math.floor(secsLeft / 3600);
  const mins     = Math.floor((secsLeft % 3600) / 60);
  const resetStr = hrs > 0 ? hrs + ' hr ' + mins + ' min' : mins + ' min';
  out += '  ' + dim(37, 'Resets in ' + resetStr + ' – ') + dim(color, bar) + ' ' + dim(color, usedPct + '% used');
}

process.stdout.write(out + '\n');
" "\$input"
