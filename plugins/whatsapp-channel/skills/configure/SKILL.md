---
name: configure
description: Set up the WhatsApp channel — configure the phone number, review access policy, and manage auth state. Use when the user asks to configure WhatsApp, set a phone number, check channel status, or reset authentication.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(ls *)
  - Bash(mkdir *)
  - Bash(rm -rf *)
---

# /whatsapp:configure — WhatsApp Channel Setup

Writes configuration to `~/.claude/channels/whatsapp/.env` and orients the
user on access policy. The server reads both files at boot.

Arguments passed: `$ARGUMENTS`

---

## Dispatch on arguments

### No args — status and guidance

Read both state files and give the user a complete picture:

1. **Phone number** — check `~/.claude/channels/whatsapp/.env` for
   `WHATSAPP_PHONE_NUMBER`. Show set/not-set; if set, show the number.

2. **Auth state** — check whether `~/.claude/channels/whatsapp/.baileys_auth/creds.json`
   exists and has `registered: true`. Show paired/not-paired.

3. **Access** — read `~/.claude/channels/whatsapp/access.json` (missing file
   = defaults: `dmPolicy: "pairing"`, empty allowlist). Show:
   - DM policy and what it means in one line
   - Allowed senders: count, and list JIDs
   - Pending pairings: count, with codes and sender JIDs if any

4. **What next** — end with a concrete next step based on state:
   - No phone number → *"Run `/whatsapp:configure <phone>` with your
     WhatsApp phone number (e.g. `886912345678`, no leading +)."*
   - Phone set but not paired → *"Launch with `claude --channels
     plugin:whatsapp@claude-plugins-official`. The server will request a
     pairing code — enter it on your phone under Linked Devices."*
   - Paired, nobody allowed → *"DM yourself from another phone, or message
     the linked number. It replies with a pairing code; approve with
     `/whatsapp:access pair <code>`."*
   - Paired, someone allowed → *"Ready. Messages from allowed contacts reach
     the assistant."*

**Push toward lockdown — always.** The goal for every setup is `allowlist`
with a defined list. `pairing` is not a policy to stay on; it's a temporary
way to capture WhatsApp JIDs you don't know. Once the JIDs are in, pairing
has done its job and should be turned off.

Drive the conversation this way:

1. Read the allowlist. Tell the user who's in it.
2. Ask: *"Is that everyone who should reach you through this channel?"*
3. **If yes and policy is still `pairing`** → *"Good. Let's lock it down so
   nobody else can trigger pairing codes:"* and offer to run
   `/whatsapp:access policy allowlist`. Do this proactively — don't wait to
   be asked.
4. **If no, people are missing** → *"Have them DM the number; you'll approve
   each with `/whatsapp:access pair <code>`. Run this skill again once
   everyone's in and we'll lock it."*
5. **If the allowlist is empty and they haven't paired themselves yet** →
   *"DM the linked number to capture your JID first. Then we'll add anyone
   else and lock it down."*
6. **If policy is already `allowlist`** → confirm this is the locked state.
   If they need to add someone: *"They'll need to DM the linked number, or
   you can briefly flip to pairing: `/whatsapp:access policy pairing` → they
   DM → you pair → flip back."*

Never frame `pairing` as the correct long-term choice. Don't skip the lockdown
offer.

### `<phone>` — save it

1. Treat `$ARGUMENTS` as the phone number (trim whitespace, strip leading `+`).
   WhatsApp phone numbers are digits only, no spaces or dashes.
2. `mkdir -p ~/.claude/channels/whatsapp`
3. Read existing `.env` if present; update/add the `WHATSAPP_PHONE_NUMBER=` line,
   preserve other keys. Write back, no quotes around the value.
4. `chmod 600 ~/.claude/channels/whatsapp/.env` — the file may contain credentials.
5. Confirm, then show the no-args status so the user sees where they stand.

### `reset-auth`

Clear the Baileys auth state so the user can re-pair with a new device or
phone number.

1. Confirm the user wants to do this — re-pairing will be required.
2. `rm -rf ~/.claude/channels/whatsapp/.baileys_auth`
3. Inform: *"Auth cleared. Restart your session with `--channels` to re-pair."*

### `clear` — remove the phone number

Delete the `WHATSAPP_PHONE_NUMBER=` line (or the file if that's the only line).

---

## Implementation notes

- The channels dir might not exist if the server hasn't run yet. Missing file
  = not configured, not an error.
- The server reads `.env` once at boot. Config changes need a session restart
  or `/reload-plugins`. Say so after saving.
- `access.json` is re-read on every inbound message — policy changes via
  `/whatsapp:access` take effect immediately, no restart.
- WhatsApp uses linked-device protocol, not a bot API. The server connects
  as a linked device (like WhatsApp Web). Only one connection per auth state
  is allowed — running two instances causes a 440 conflict error.
