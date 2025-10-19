# Bootstrap Kit Release Playbook

## When Claude Code upgrades

1) Prep
- Ensure local clones:
  - Kit: `~/github/Claude-Bootstrap-Kit`
  - Upstream Claude Code: `~/github/claude-code`
- `git -C ~/github/Claude-Bootstrap-Kit pull --ff-only`
- `git -C ~/github/claude-code pull --ff-only`

2) Discover changes
- Read `~/github/claude-code/CHANGELOG.md`
- Identify impacts: `.claude/commands`, `.claude/skills`, `.claude/hooks`, `.claude/templates`

3) Refresh kit
- Use `/kit-refresh` to draft, apply and validate updates
- Test in a sample repo: `/project-bootstrap` → `/doctor` → run `/auto-dev` on a small task

4) Version & release
- Bump `VERSION` (semver)
- Update `CHANGELOG.md`
- `git add -A && git commit -m "chore(kit): refresh for Claude Code upgrade"`
- `git push` (optionally `git tag vX.Y.Z && git push --tags`)

5) Notify team
- Consumers run `/kit-update` then in each project `/project-bootstrap` if needed

6) Rollback plan
- If issues, `./scripts/rollback.sh` to restore previous `~/.claude`

## Gotchas
- Keep safety defaults (AutoGuard, interop flags, minimal writes)
- Don’t ship secrets; only `.env.example`
- Project-level `.claude/` overrides user-level

