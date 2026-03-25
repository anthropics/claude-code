# WhatsApp

Connect WhatsApp to your Claude Code session via linked-device protocol.

The MCP server connects to WhatsApp as a linked device (like WhatsApp Web) and provides tools to Claude to reply, react, edit messages, and handle media. When someone messages the linked number, the server forwards the message to your Claude Code session.

## Prerequisites

- [Bun](https://bun.sh) — the MCP server runs on Bun. Install with `curl -fsSL https://bun.sh/install | bash`.
- A WhatsApp account with an active phone number.

## Quick Setup

**1. Install the plugin.**

```
/plugin marketplace add Rich627/whatsapp-claude-plugin
/plugin install whatsapp@whatsapp-claude-plugin
/exit
```

Restart to activate the plugin:

```sh
claude
```

**2. Configure and pair.**

```
/whatsapp:configure 886912345678
/exit
```

Use your WhatsApp phone number with country code, no leading `+`. Then launch with the channel flag:

```sh
claude --dangerously-load-development-channels plugin:whatsapp@whatsapp-claude-plugin
```

The pairing code appears automatically in your session. On your phone:

1. Open WhatsApp > **Settings** > **Linked Devices** > **Link a Device**
2. Tap **Link with phone number instead**
3. Enter the pairing code

Once paired, your own number is **auto-added to the allowlist** and the policy is **auto-locked to allowlist mode**. You're ready to go — messages you send to the linked number from another device (or that others send you) will appear in your Claude Code session.

> **Note:** `--dangerously-load-development-channels` is required for third-party plugins. Once submitted and approved by Anthropic, use `--channels` instead.

**3. Add other contacts (optional).**

Have someone DM the linked number. Briefly flip to pairing mode:

```
/whatsapp:access policy pairing
```

They'll receive a 6-character code. Approve in your Claude Code session:

```
/whatsapp:access pair <code>
```

After pairing, the policy auto-locks back to `allowlist`.

## Daily use

After initial setup, just run:

```sh
claude --dangerously-load-development-channels plugin:whatsapp@whatsapp-claude-plugin
```

Auth is saved in `~/.claude/channels/whatsapp/.baileys_auth/`. The session must stay open to receive messages.

## Access control

See **[ACCESS.md](./ACCESS.md)** for DM policies, groups, mention detection, delivery config, skill commands, and the `access.json` schema.

## Tools exposed to the assistant

| Tool | Purpose |
| --- | --- |
| `reply` | Send to a chat. Takes `chat_id` + `text`, optionally `reply_to` (message ID) for quote-reply and `files` (absolute paths) for attachments. |
| `react` | Add an emoji reaction to a message by ID. Any emoji is supported. |
| `download_attachment` | Download media from a received message. Returns the local file path. |
| `edit_message` | Edit a message the account previously sent. |
| `status` | Check connection state and get the pairing code if not yet paired. |

## Photos & Media

Inbound **photos** are downloaded eagerly to `~/.claude/channels/whatsapp/inbox/` and the local path is included in the notification so the assistant can read it.

Other media types (**voice notes, audio, video, documents, stickers**) are lazy — the notification includes an `attachment_file_id`. The assistant calls `download_attachment` to fetch the file on demand.

## Session conflicts

WhatsApp allows only **one connection per auth state**. Running two instances causes a 440 disconnect. Check for stale processes:

```sh
pkill -f "whatsapp.*server"
```

## Resetting auth

```
/whatsapp:configure reset-auth
```

Then relaunch to re-pair.
