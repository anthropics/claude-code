---
name: setup
description: Interactive WhatsApp channel onboarding — guides through device linking, phone number config, and access control setup
---

# WhatsApp Channel Setup

You are guiding the user through first-time WhatsApp channel setup. Follow these phases in order. Be conversational, not robotic. Ask one question at a time.

## Phase 1: Welcome & Prerequisites

Tell the user:
- This plugin connects Claude Code to WhatsApp as a linked device (like WhatsApp Web)
- They'll need their phone with WhatsApp open nearby
- The setup takes about 2 minutes

## Phase 2: Device Linking

Check the connection status by calling the `whatsapp_status` tool.

**If status is `connected`:**
- Skip to Phase 4. Tell the user they're already linked.

**If status is `pairing` and a `qr_image_path` is present:**
- Read the QR image file and display it to the user.
- Tell them: "Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → scan this QR code"
- If a `pairing_code` is also available, mention: "If you can't scan the QR, tap 'Link with phone number instead' and enter: [code]"
- Wait for confirmation. Call `whatsapp_status` again to check if connection succeeded.

**If status is `disconnected`:**
- Tell the user the server needs to start first. They should restart Claude Code with the WhatsApp channel enabled.

## Phase 3: Phone Number (Optional)

Ask the user:
> "Would you like to save your phone number for future re-pairing? This lets the server offer a numeric pairing code as a backup if QR scanning isn't available. You can skip this."

If yes:
- Ask for their phone number with country code (e.g., `886912345678`, no `+` or spaces)
- Save it to `~/.claude/channels/whatsapp/.env`:
  ```
  WHATSAPP_PHONE_NUMBER=<their number>
  ```
- Confirm it's saved.

If no, skip to Phase 4.

## Phase 4: Access Control

Explain the access model:
> "By default, when someone DMs your WhatsApp account, they'll get a pairing code. You approve them by running `/whatsapp:access pair <code>` here. This prevents random people from talking to your Claude session."

Ask:
> "Would you like to:"
> 1. **Keep the default** (pairing mode) — recommended for most users
> 2. **Allowlist only** — silently drop messages from unknown senders (no pairing reply)
> 3. **Add a specific contact now** — if you already know their WhatsApp user ID

For option 1: No action needed, just confirm.
For option 2: Write `{"dmPolicy": "allowlist", "allowFrom": [], "groups": {}, "pending": {}}` to `~/.claude/channels/whatsapp/access.json`.
For option 3: Ask for the numeric user ID (e.g., `886912345678`). They can find it by having the contact message @userinfobot on Telegram, or by checking WhatsApp linked device logs. Add it to `allowFrom` in access.json.

## Phase 5: Done

Summarize:
- Connection status (connected as [JID] or waiting for scan)
- Access policy (pairing / allowlist)
- Allowed contacts (if any)
- How to manage access later: `/whatsapp:access`
- How to reset auth if needed: `/whatsapp:configure reset-auth`

Tell the user they're all set. Messages from approved contacts will now appear in their Claude Code session.
