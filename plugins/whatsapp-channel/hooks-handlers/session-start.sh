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
  msg="WhatsApp plugin installed but not configured yet. Guide the user through setup:\n\n1. Run: /whatsapp:configure <phone> (country code + number, no +, e.g. 886912345678)\n2. Restart with: claude --channels plugin:whatsapp@whatsapp-claude-plugin\n3. Enter the pairing code on phone: WhatsApp > Linked Devices > Link with phone number instead\n\nPrompt the user to provide their WhatsApp phone number to get started."
elif [ "$has_auth" = false ]; then
  msg="WhatsApp phone number is configured but device is not paired yet.\n\nThe user needs to:\n1. Launch with: claude --channels plugin:whatsapp@whatsapp-claude-plugin\n2. A pairing code will be printed — enter it on phone: WhatsApp > Linked Devices > Link with phone number instead\n\nIf already running with --channels, the pairing code should appear in stderr output."
elif [ "$has_contacts" = false ]; then
  msg="WhatsApp is paired but no contacts are allowlisted yet.\n\nThe user needs to:\n1. Have someone DM the linked number — the server replies with a 6-character code\n2. Run: /whatsapp:access pair <code>\n3. Once all contacts are added: /whatsapp:access policy allowlist"
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
