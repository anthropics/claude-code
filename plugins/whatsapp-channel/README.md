# WhatsApp

Connect WhatsApp to your Claude Code session via linked-device protocol.

The MCP server connects to WhatsApp as a linked device (like WhatsApp Web) and provides tools to Claude to reply, react, edit messages, and handle media. When someone messages the linked number, the server forwards the message to your Claude Code session.

## Prerequisites

- [Bun](https://bun.sh) — the MCP server runs on Bun. Install with `curl -fsSL https://bun.sh/install | bash`.
- A WhatsApp account with an active phone number.

## Quick Setup

> Default setup uses QR code scanning. See [ACCESS.md](./ACCESS.md) for groups and multi-user config.

**1. Install the plugin.**

```
/plugin install whatsapp-channel@<your-marketplace>
```

**2. Launch with the channel flag.**

```sh
claude --channels plugin:whatsapp-channel@<your-marketplace>
```

**3. Run the setup wizard.**

```
/whatsapp:setup
```

The wizard walks you through:
- **Device linking** — a QR code image is generated automatically. Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → scan the QR code.
- **Phone number** (optional) — saves your number for future re-pairing via numeric code as a backup.
- **Access control** — choose who can message your Claude session (pairing mode, allowlist, or add contacts directly).

**That's it.** Messages from approved contacts now flow into your Claude Code session.

## How device linking works

On first launch, the server detects no auth credentials and starts the linking flow:

1. WhatsApp sends QR data → server generates a **QR code image** → Claude displays it to you
2. You scan the QR with your phone's WhatsApp camera
3. Connection established, auth saved to `~/.claude/channels/whatsapp/.baileys_auth/`

**Alternative (pairing code):** If you've configured a phone number and can't scan the QR, you can tap "Link with phone number instead" in WhatsApp and enter the numeric pairing code shown alongside the QR.

> **Note:** WhatsApp may temporarily lock your account if you attempt too many pairing/linking attempts in a short period. This is a WhatsApp anti-abuse measure, not a bug. Wait a few minutes and try again.

## Access control

See **[ACCESS.md](./ACCESS.md)** for DM policies, groups, mention detection, delivery config, skill commands, and the `access.json` schema.

Quick reference: IDs are **WhatsApp JIDs** (e.g. `886912345678@s.whatsapp.net`). Default policy is `pairing`. `ackReaction` accepts any emoji.

## Tools exposed to the assistant

| Tool | Purpose |
| --- | --- |
| `reply` | Send to a chat. Takes `chat_id` + `text`, optionally `reply_to` (message ID) for quote-reply and `files` (absolute paths) for attachments. Images send as photos; videos as video messages; other types as documents. Max 16MB each. Auto-chunks text; files send as separate messages after the text. Returns the sent message ID(s). |
| `react` | Add an emoji reaction to a message by ID. **Any emoji** is supported. |
| `download_attachment` | Download media from a received message. Use when inbound meta shows `attachment_file_id`. Returns the local file path. |
| `edit_message` | Edit a message the account previously sent. Only works on the account's own messages. |
| `whatsapp_status` | Check connection status. Returns whether the channel is connected, pairing (with QR image path), or disconnected. |

Inbound messages trigger a typing indicator automatically.

## Photos & Media

Inbound **photos** are downloaded eagerly to `~/.claude/channels/whatsapp/inbox/`
and the local path is included in the `<channel>` notification so the assistant
can `Read` it.

Other media types (**voice notes, audio, video, documents, stickers**) are lazy — the
inbound notification includes an `attachment_file_id`. The assistant calls
`download_attachment` to fetch the file on demand.

## Session conflicts

WhatsApp allows only **one connection per auth state**. Running two instances
against the same auth causes a 440 disconnect. If you see repeated reconnects:

```sh
pkill -f "bun.*whatsapp"
```

## No history or search

WhatsApp's linked-device protocol exposes **neither** message history nor search.
The server only sees messages as they arrive. If the assistant needs earlier
context, it will ask you to paste or summarize.

## Resetting auth

If the linked device is unlinked from your phone, or you want to pair a
different number:

```
/whatsapp:configure reset-auth
```

Then relaunch with `--channels` to re-pair.

## Skills

| Skill | Purpose |
| --- | --- |
| `/whatsapp:setup` | Interactive onboarding wizard — device linking, phone config, access control |
| `/whatsapp:access` | Manage access control — pair, allow, remove, groups, policies |
| `/whatsapp:configure` | Phone number setup, auth reset, status check |
