# vibeguard (Claude Code plugin)

Community plugin (not affiliated with Anthropic / Claude Code).

Protects secrets/PII by **blocking prompts before they are sent**, and printing a **VibeGuard-style placeholder** version for you to copy.

## What this plugin does

The main risk when pasting secrets (API keys, tokens, emails, phone numbers, etc.) into Claude Code is that they may be sent to model providers.

This plugin runs on **UserPromptSubmit**:

- Detects configured secrets/PII in `user_prompt` (keywords / regex / builtin patterns)
- If matched, **blocks** the prompt and prints a redacted version using placeholders like `__VG_<CATEGORY>_<hash12>__`

## Requirements

- No MITM proxy required
- No VibeGuard binary required
- Needs a `vibeguard.config.json` redaction rules file (example below)

## Enable (per project)

Create:

`./.claude/vibeguard.local.md`

Example:

```md
---
enabled: true
guard_prompt: true
guard_action: block
guard_fail_closed: true
# redact_config: "./vibeguard.config.json"
---
```

Fields:

- `enabled`: enable/disable (default: false)
- `guard_prompt`: enable prompt guard mode (default: false)
- `guard_action`: `block` (default) or `warn` (warn will NOT prevent sending)
- `guard_fail_closed`: if true, block sending when no config file is found (default: true)
- `redact_config` / `redaction_config` / `config_json`: optional path to `vibeguard.config.json` (defaults to project root / `.claude/` / `~/.claude/`)

Create `vibeguard.config.json` in your project root:

```json
{
  "enabled": true,
  "placeholder_prefix": "__VG_",
  "patterns": {
    "keywords": [
      { "value": "example-secret-123", "category": "API_KEY" }
    ],
    "regex": [
      { "pattern": "sk-[A-Za-z0-9]{48}", "category": "OPENAI_KEY" }
    ],
    "builtin": ["email", "china_phone", "uuid", "ipv4"],
    "exclude": ["example.com", "localhost", "127.0.0.1", "0.0.0.0"]
  }
}
```

## Notes

- This is a **community integration plugin** and is **not affiliated** with Anthropic / Claude Code.
- It cannot automatically rewrite what gets sent; it blocks and prints a redacted version for you to copy.

---

## 中文说明

这是一个社区插件（非官方），用于在 **不走 MITM** 的前提下，尽可能降低“把密钥/PII 明文发送给模型提供商”的风险。

工作方式：

- 在 **UserPromptSubmit** 时扫描用户输入（关键词 / 正则 / 内置 PII 规则）
- 命中后默认 **阻止发送**，并输出一份使用 VibeGuard 风格占位符的文本（如 `__VG_<类别>_<hash12>__`）供你复制重发

注意：插件层面无法“自动改写”即将发送的 prompt，因此采用“阻断 + 提示复制替换版”的交互方式。
