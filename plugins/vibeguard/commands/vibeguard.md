---
description: VibeGuard integration quickstart (community plugin)
allowed-tools: []
---

## What this does

This plugin blocks prompts containing configured secrets/PII before they are sent to model providers, and prints a VibeGuard-style placeholder version for you to copy and re-send.

## Enable (per project)

Create `./.claude/vibeguard.local.md` in your project root:

```md
---
enabled: true
guard_prompt: true
guard_action: block
guard_fail_closed: true
---
```

Then restart your Claude Code session.

Create `vibeguard.config.json` in your project root (same schema as opencode-vibeguard):

```json
{
  "enabled": true,
  "placeholder_prefix": "__VG_",
  "patterns": {
    "keywords": [{ "value": "example-secret-123", "category": "API_KEY" }],
    "regex": [{ "pattern": "sk-[A-Za-z0-9]{48}", "category": "OPENAI_KEY" }],
    "builtin": ["email", "china_phone", "uuid", "ipv4"],
    "exclude": ["example.com", "localhost", "127.0.0.1", "0.0.0.0"]
  }
}
```

---

## 中文

不走 MITM：在发送前检测到密钥/PII 就阻止发送，并打印“占位符替换版”供你复制重发（注意：无法自动改写即将发送的 prompt，只能阻断 + 提示）。
