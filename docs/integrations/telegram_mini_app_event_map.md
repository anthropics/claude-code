# Telegram Mini App Event Map

This note maps selected Telegram Mini App events into a safe PinkyBot + Ethos integration surface.

## Use these first

### Messaging and UI
- `web_app_ready`
- `web_app_close`
- `web_app_open_popup`
- `web_app_setup_main_button`
- `web_app_setup_back_button`
- `web_app_setup_settings_button`
- `web_app_trigger_haptic_feedback`

### Permissioned access
- `web_app_request_write_access`
- `web_app_request_phone`
- `web_app_read_text_from_clipboard`
- `web_app_request_file_download`

### Secure local state
- `web_app_secure_storage_save_key`
- `web_app_secure_storage_get_key`
- `web_app_secure_storage_restore_key`
- `web_app_secure_storage_clear`
- `web_app_device_storage_save_key`
- `web_app_device_storage_get_key`
- `web_app_device_storage_clear`

### Sensors and environment
- `web_app_request_theme`
- `web_app_request_viewport`
- `web_app_request_safe_area`
- `web_app_request_content_safe_area`
- `web_app_check_location`
- `web_app_request_location`

## Treat as high-risk or approval-gated

- `payment_form_submit`
- `web_app_open_invoice`
- `web_app_set_emoji_status`
- `web_app_request_emoji_status_access`
- `web_app_invoke_custom_method`
- `web_app_open_link`
- `web_app_open_tg_link`

## Integration rule

Map Telegram events into an internal broker event shape before handing them to a PinkyBot-style daemon. Example internal shape:

```json
{
  "platform": "telegram",
  "event_type": "web_app_request_write_access",
  "user_interaction_required": true,
  "approval_required": true,
  "payload": {}
}
```

## Recommended behavior

- validate all event payloads before use
- gate high-impact actions behind explicit user interaction or approval
- persist only minimal necessary state
- prefer secure storage for secrets or tokens
- log every accepted event in the activity feed
