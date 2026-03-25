#!/usr/bin/env bash

# WhatsApp channel onboarding — checks setup state and guides user through next steps.

STATE_DIR="${HOME}/.claude/channels/whatsapp"
ENV_FILE="${STATE_DIR}/.env"
AUTH_CREDS="${STATE_DIR}/.baileys_auth/creds.json"
ACCESS_FILE="${STATE_DIR}/access.json"

# Check setup state
has_phone=false
has_auth=false
has_contacts=false

if [ -f "$ENV_FILE" ] && grep -q 'WHATSAPP_PHONE_NUMBER=' "$ENV_FILE" 2>/dev/null; then
  has_phone=true
fi

if [ -f "$AUTH_CREDS" ] && grep -q '"registered":true' "$AUTH_CREDS" 2>/dev/null; then
  has_auth=true
fi

if [ -f "$ACCESS_FILE" ] && grep -q '"allowFrom":\[".' "$ACCESS_FILE" 2>/dev/null; then
  has_contacts=true
fi

# Build context message based on state
if [ "$has_phone" = false ]; then
  msg="WhatsApp plugin installed but not configured yet. Guide the user through setup:\n\n1. Run: /whatsapp:configure <phone> (country code + number, no +, e.g. 886912345678)\n2. Exit and launch: claude --dangerously-load-development-channels plugin:whatsapp@whatsapp-claude-plugin\n3. The pairing code appears automatically — enter it on phone: WhatsApp > Linked Devices > Link with phone number instead\n\nPrompt the user to provide their WhatsApp phone number to get started."
elif [ "$has_auth" = false ]; then
  msg="WhatsApp phone number is configured but device is not paired yet.\n\nThe user needs to:\n1. Exit and launch: claude --dangerously-load-development-channels plugin:whatsapp@whatsapp-claude-plugin\n2. The pairing code appears automatically in the session\n3. Enter it on phone: WhatsApp > Linked Devices > Link with phone number instead"
elif [ "$has_contacts" = false ]; then
  msg="WhatsApp is paired but no contacts are allowlisted yet. The owner JID is auto-added on connection.\n\nIf the user needs to add other contacts:\n1. Run: /whatsapp:access policy pairing\n2. Have them DM the linked number\n3. Run: /whatsapp:access pair <code>\n4. Policy auto-locks back to allowlist after pairing"
else
  msg="WhatsApp channel is fully configured and ready. Paired contacts can message this session."
fi

cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "${msg}"
  }
}
EOF

exit 0
