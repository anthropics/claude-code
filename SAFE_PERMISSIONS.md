# Safe Permissions Configuration

This guide provides a recommended `settings.json` configuration that enables bypass mode for faster development while maintaining safety guardrails to block dangerous commands.

## The Problem

Claude Code's default permission system asks for confirmation on every command, which can slow down development workflows. The `--dangerously-skip-permissions` flag removes all safety checks, which is risky.

## Solution: Safe Bypass Mode

Configure bypass mode with a deny list that blocks destructive operations while allowing normal development commands.

## Configuration

Add this to your `~/.claude/settings.json`:

```json
{
  "permissions": {
    "defaultMode": "bypassPermissions",
    "deny": [
      "Bash(rm -rf /)",
      "Bash(rm -rf /*)",
      "Bash(rm -rf ~)",
      "Bash(rm -rf $HOME)",
      "Bash(sudo rm -rf)",
      "Bash(mkfs)",
      "Bash(dd if=/dev/zero)",
      "Bash(dd if=/dev/random)",
      "Bash(diskutil eraseDisk)",
      "Bash(diskutil partitionDisk)",
      "Bash(sudo shutdown)",
      "Bash(sudo reboot)",
      "Bash(sudo halt)",
      "Bash(sudo poweroff)",
      "Bash(sudo init 0)",
      "Bash(sudo init 6)",
      "Bash(sudo passwd)",
      "Bash(sudo adduser)",
      "Bash(sudo deluser)",
      "Bash(sudo userdel)",
      "Bash(sudo visudo)",
      "Bash(launchctl unload)",
      "Bash(systemctl disable)",
      "Bash(systemctl mask)",
      "Bash(git push --force origin main)",
      "Bash(git push --force origin master)",
      "Bash(git push -f origin main)",
      "Bash(git push -f origin master)",
      "Bash(git reset --hard HEAD~)",
      "Read(.env)",
      "Read(.env.*)",
      "Read(secrets/)",
      "Read(*credential*)",
      "Read(*password*)",
      "Read(*secret*)",
      "Read(id_rsa)",
      "Read(id_ed25519)",
      "Read(*.pem)",
      "Read(*.key)"
    ],
    "allow": [
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(cp:*)",
      "Bash(mv:*)",
      "Bash(mkdir:*)",
      "Bash(touch:*)",
      "Bash(chmod:*)",
      "Bash(find:*)",
      "Bash(git:*)",
      "Bash(gh:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(yarn:*)",
      "Bash(pnpm:*)",
      "Bash(bun:*)",
      "Bash(pip:*)",
      "Bash(cargo:*)",
      "Bash(python:*)",
      "Bash(python3:*)",
      "Bash(node:*)",
      "Bash(go:*)",
      "Bash(rustc:*)",
      "Bash(gcc:*)",
      "Bash(clang:*)",
      "Bash(docker:*)",
      "Bash(kubectl:*)",
      "Bash(terraform:*)",
      "Bash(aws:*)",
      "Bash(gcloud:*)",
      "Bash(az:*)",
      "Bash(curl:*)",
      "Bash(wget:*)",
      "Bash(jq:*)",
      "Bash(grep:*)",
      "Bash(sed:*)",
      "Bash(awk:*)",
      "Bash(tar:*)",
      "Bash(zip:*)",
      "Bash(unzip:*)",
      "Read:*",
      "Edit:*",
      "Write:*",
      "Glob:*",
      "Grep:*"
    ]
  }
}
```

## What This Blocks

| Category | Blocked Commands |
|----------|------------------|
| **Destructive deletion** | `rm -rf /`, `rm -rf ~`, `sudo rm -rf` |
| **Disk operations** | `mkfs`, `dd if=/dev/zero`, `diskutil eraseDisk` |
| **System control** | `sudo shutdown`, `sudo reboot`, `sudo halt` |
| **User management** | `sudo passwd`, `sudo adduser`, `sudo deluser` |
| **Service control** | `launchctl unload`, `systemctl disable` |
| **Dangerous git** | `git push --force origin main`, `git reset --hard HEAD~` |
| **Sensitive files** | `.env`, `secrets/`, SSH keys, credentials |

## What This Allows

All standard development commands run without prompts:
- File operations: `ls`, `cat`, `cp`, `mv`, `mkdir`
- Git: `git`, `gh` (except force push to main/master)
- Package managers: `npm`, `yarn`, `pnpm`, `bun`, `pip`, `cargo`
- Languages: `python`, `node`, `go`, `rustc`
- DevOps: `docker`, `kubectl`, `terraform`, `aws`, `gcloud`

## Toggling Modes

Use **Shift+Tab** to cycle between:
1. Bypass mode (uses deny list)
2. Plan-only mode
3. Default mode (ask every time)

## Important

This is safer than `--dangerously-skip-permissions` because:
- The deny list still applies in bypass mode
- Destructive commands are blocked regardless of mode
- Sensitive file reads are prevented

## Credits

This guide was contributed by [@ajjucoder](https://github.com/ajjucoder).
