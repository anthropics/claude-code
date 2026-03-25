# WhatsApp

Connect WhatsApp to your Claude Code session via linked-device protocol.

The MCP server connects to WhatsApp as a linked device (like WhatsApp Web) and provides tools to Claude to reply, react, edit messages, and handle media. When someone messages the linked number, the server forwards the message to your Claude Code session.

## Prerequisites

- [Bun](https://bun.sh) — the MCP server runs on Bun. Install with `curl -fsSL https://bun.sh/install | bash`.
- A WhatsApp account with an active phone number.

## Quick Setup
> Default pairing flow for a single-user DM setup. See [ACCESS.md](./ACCESS.md) for groups and multi-user setups.

**1. Install the plugin.**

These are Claude Code commands — run `claude` to start a session first.

```
/plugin install whatsapp@claude-code-plugins
```

**2. Configure your phone number.**

```
/whatsapp:configure 15551234567
```

Writes `WHATSAPP_PHONE_NUMBER=...` to `~/.claude/channels/whatsapp/.env`. Use your WhatsApp phone number with country code, no leading `+`. You can also write that file by hand, or set the variable in your shell environment — shell takes precedence.

**3. Launch with the channel flag.**

Exit your session and start a new one:

```sh
claude --channels plugin:whatsapp@claude-code-plugins
```

**4. Pair the device.**

On first launch, the server requests a pairing code and prints it to stderr. On your phone:

1. Open WhatsApp > **Settings** > **Linked Devices** > **Link a Device**
2. Tap **Link with phone number instead**
3. Enter the pairing code shown in your terminal

> **Note:** QR code pairing is not reliable with Baileys 6.x (the underlying WhatsApp library). Always configure `WHATSAPP_PHONE_NUMBER` to use pairing code instead.

**5. Pair a contact.**

With Claude Code running, have someone DM the linked number. The server replies with a 6-character pairing code. In your Claude Code session:

```
/whatsapp:access pair <code>
```

Their next message reaches the assistant.

**6. Lock it down.**

Pairing is for capturing JIDs. Once everyone's in, switch to `allowlist` so strangers don't get pairing-code replies:

```
/whatsapp:access policy allowlist
```

## Access control

See **[ACCESS.md](./ACCESS.md)** for DM policies, groups, mention detection, delivery config, skill commands, and the `access.json` schema.

Quick reference: IDs are **WhatsApp JIDs** (e.g. `15551234567@s.whatsapp.net`). Default policy is `pairing`. `ackReaction` accepts any emoji.

## Tools exposed to the assistant

| Tool | Purpose |
| --- | --- |
| `reply` | Send to a chat. Takes `chat_id` + `text`, optionally `reply_to` (message ID) for quote-reply and `files` (absolute paths) for attachments. Images send as photos; videos as video messages; other types as documents. Max 16MB each. Auto-chunks text; files send as separate messages after the text. Returns the sent message ID(s). |
| `react` | Add an emoji reaction to a message by ID. **Any emoji** is supported — WhatsApp has no fixed whitelist. |
| `download_attachment` | Download media from a received message. Use when inbound meta shows `attachment_file_id`. Returns the local file path. |
| `edit_message` | Edit a message the account previously sent. Only works on the account's own messages. |

Inbound messages trigger a typing indicator automatically — WhatsApp shows
"typing…" while the assistant works on a response.

## Photos & Media

Inbound **photos** are downloaded eagerly to `~/.claude/channels/whatsapp/inbox/`
and the local path is included in the `<channel>` notification so the assistant
can `Read` it.

Other media types (**voice notes, audio, video, documents, stickers**) are lazy — the
inbound notification includes an `attachment_file_id`. The assistant calls
`download_attachment` to fetch the file on demand, keeping startup fast and
bandwidth low.

## Session conflicts

WhatsApp allows only **one connection per auth state**. Running two instances
(or two Claude Code sessions with `--channels`) against the same auth causes
a 440 disconnect. If you see repeated reconnects, check for stale processes:

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
