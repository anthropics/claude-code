# WhatsApp — Access & Delivery

WhatsApp has no bot API — this channel connects as a **linked device** (like WhatsApp Web). Any contact who can message the linked phone number can reach the server. The access model described here decides who gets through.

By default, a DM from an unknown sender triggers **pairing**: the server replies with a 6-character code and drops the message. You run `/whatsapp:access pair <code>` from your Claude Code session to approve them. Once approved, their messages pass through.

All state lives in `~/.claude/channels/whatsapp/access.json`. The `/whatsapp:access` skill commands edit this file; the server re-reads it on every inbound message, so changes take effect without a restart. Set `WHATSAPP_ACCESS_MODE=static` to pin config to what was on disk at boot (pairing is unavailable in static mode since it requires runtime writes).

## At a glance

| | |
| --- | --- |
| Default policy | `pairing` |
| Sender ID | WhatsApp JID (e.g. `886912345678@s.whatsapp.net`) |
| Group key | Group JID (e.g. `120363424405607157@g.us`) |
| `ackReaction` quirk | Any emoji — WhatsApp has no fixed whitelist |
| Config file | `~/.claude/channels/whatsapp/access.json` |

## DM policies

`dmPolicy` controls how DMs from senders not on the allowlist are handled.

| Policy | Behavior |
| --- | --- |
| `pairing` (default) | Reply with a pairing code, drop the message. Approve with `/whatsapp:access pair <code>`. |
| `allowlist` | Drop silently. No reply. Prevents strangers from knowing the linked device is active. |
| `disabled` | Drop everything, including allowlisted users and groups. |

```
/whatsapp:access policy allowlist
```

## User IDs (JIDs)

WhatsApp identifies users by **JIDs** — phone number + `@s.whatsapp.net`, e.g. `886912345678@s.whatsapp.net`. The allowlist stores JIDs.

Pairing captures the JID automatically. To add one manually, use the phone number with country code, no leading `+`, followed by `@s.whatsapp.net`.

```
/whatsapp:access allow 886912345678@s.whatsapp.net
/whatsapp:access remove 886912345678@s.whatsapp.net
```

## Groups

Groups are off by default. Opt each one in individually.

```
/whatsapp:access group add 120363424405607157@g.us
```

Group JIDs end in `@g.us`. To find one, add the linked device to the group — the server logs the group JID when it receives a message from an unenabled group.

With the default `requireMention: false`, the server responds to every message. Pass `--mention` to require @mention, or `--allow jid1,jid2` to restrict which members can trigger it.

```
/whatsapp:access group add 120363424405607157@g.us
/whatsapp:access group add 120363424405607157@g.us --mention
/whatsapp:access group add 120363424405607157@g.us --allow 886912345678@s.whatsapp.net
/whatsapp:access group rm 120363424405607157@g.us
```

### Per-group personality & memory

Each enabled group gets a config directory at `~/.claude/channels/whatsapp/groups/<groupJid>/`:

| File | Purpose |
| --- | --- |
| `config.md` | Personality, goals, and instructions for Claude in this group. User edits this. |
| `memory.md` | Conversation summaries appended by Claude automatically. Persists across sessions. |

Created automatically when a group is added. Edit `config.md` to customize Claude's behavior per group. View or clear with `/whatsapp:access group config <jid>` and `/whatsapp:access group memory <jid>`.

### LID identifiers

Baileys 7 uses LID (Local Identifier) format alongside phone JIDs. The same person may appear as both `16024101202@s.whatsapp.net` and `21737517412478@lid`. The server maintains a mapping at `~/.claude/channels/whatsapp/lid-map.json` and resolves both formats automatically. Both work in allowlists.

## Mention detection

In groups with `requireMention: true`, any of the following triggers the server:

- A structured @mention of the linked account's JID
- A match against any regex in `mentionPatterns`

```
/whatsapp:access set mentionPatterns '["claude", "assistant"]'
```

## Delivery

Configure outbound behavior with `/whatsapp:access set <key> <value>`.

**`ackReaction`** reacts to inbound messages on receipt. WhatsApp supports **any emoji** — there's no fixed whitelist like Telegram.

```
/whatsapp:access set ackReaction 👀
/whatsapp:access set ackReaction ""
```

**`replyToMode`** controls threading on chunked replies. When a long response is split, `first` (default) threads only the first chunk under the inbound message; `all` threads every chunk; `off` sends all chunks standalone.

**`textChunkLimit`** sets the split threshold. Default is 4096.

**`chunkMode`** chooses the split strategy: `length` cuts exactly at the limit; `newline` prefers paragraph boundaries.

## Skill reference

| Command | Effect |
| --- | --- |
| `/whatsapp:access` | Print current state: policy, allowlist, pending pairings, enabled groups. |
| `/whatsapp:access pair a4f91c` | Approve pairing code `a4f91c`. Adds the sender to `allowFrom` and sends a confirmation on WhatsApp. |
| `/whatsapp:access deny a4f91c` | Discard a pending code. The sender is not notified. |
| `/whatsapp:access allow 886912345678@s.whatsapp.net` | Add a JID directly. |
| `/whatsapp:access remove 886912345678@s.whatsapp.net` | Remove from the allowlist. |
| `/whatsapp:access policy allowlist` | Set `dmPolicy`. Values: `pairing`, `allowlist`, `disabled`. |
| `/whatsapp:access group add 120363424405607157@g.us` | Enable a group. Flags: `--no-mention`, `--allow jid1,jid2`. |
| `/whatsapp:access group rm 120363424405607157@g.us` | Disable a group. |
| `/whatsapp:access set ackReaction 👀` | Set a config key: `ackReaction`, `replyToMode`, `textChunkLimit`, `chunkMode`, `mentionPatterns`. |

## Config file

`~/.claude/channels/whatsapp/access.json`. Absent file is equivalent to `pairing` policy with empty lists, so the first DM triggers pairing.

```jsonc
{
  // Handling for DMs from senders not in allowFrom.
  "dmPolicy": "pairing",

  // WhatsApp JIDs allowed to DM.
  "allowFrom": ["886912345678@s.whatsapp.net"],

  // Groups the channel is active in. Empty object = DM-only.
  "groups": {
    "120363424405607157@g.us": {
      // true: respond only to @mentions.
      "requireMention": true,
      // Restrict triggers to these senders. Empty = any member (subject to requireMention).
      "allowFrom": []
    }
  },

  // Case-insensitive regexes that count as a mention.
  "mentionPatterns": ["claude"],

  // Any emoji. Empty string disables.
  "ackReaction": "👀",

  // Threading on chunked replies: first | all | off
  "replyToMode": "first",

  // Split threshold.
  "textChunkLimit": 4096,

  // length = cut at limit. newline = prefer paragraph boundaries.
  "chunkMode": "newline"
}
```
