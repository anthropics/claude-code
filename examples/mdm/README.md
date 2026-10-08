# MDM Deployment Examples

Example templates for deploying Claude Code [managed settings](https://code.claude.com/docs/en/settings#settings-files) through Jamf, Iru (Kandji), Intune, or Group Policy. Use these as starting points — adjust them to fit your needs.

All templates encode the same minimal example (`permissions.disableBypassPermissionsMode`). See the [settings reference](https://code.claude.com/docs/en/settings#available-settings) for the full list of keys, and [`../settings`](../settings) for more complete example configurations.


## Templates

> [!WARNING]
> These examples are community-maintained templates which may be unsupported or incorrect. You are responsible for the correctness of your own deployment configuration.

| File | Use with |
| :--- | :--- |
| [`managed-settings.json`](./managed-settings.json) | Any platform. Deploy to the [system config directory](https://code.claude.com/docs/en/settings#settings-files). |
| [`macos/com.anthropic.claudecode.plist`](./macos/com.anthropic.claudecode.plist) | Jamf or Iru (Kandji) **Custom Settings** payload. Preference domain: `com.anthropic.claudecode`. |
| [`macos/com.anthropic.claudecode.mobileconfig`](./macos/com.anthropic.claudecode.mobileconfig) | Full configuration profile for local testing or MDMs that take a complete profile. |
| [`windows/Set-ClaudeCodePolicy.ps1`](./windows/Set-ClaudeCodePolicy.ps1) | Intune **Platform scripts**. Writes `managed-settings.json` to `C:\Program Files\ClaudeCode\`. |
| [`windows/ClaudeCode.admx`](./windows/ClaudeCode.admx) + [`en-US/ClaudeCode.adml`](./windows/en-US/ClaudeCode.adml) | Group Policy or Intune **Import ADMX**. Writes `HKLM\SOFTWARE\Policies\ClaudeCode\Settings` (REG_SZ, single-line JSON). |

## Tips
- Replace the placeholder `PayloadUUID` and `PayloadOrganization` values in the `.mobileconfig` with your own (`uuidgen`)
- Before deploying to your fleet, test on a single machine and confirm `/status` lists the source under **Setting sources** — e.g. `Enterprise managed settings (plist)` on macOS or `Enterprise managed settings (HKLM)` on Windows
- Settings deployed this way sit at the top of the precedence order and cannot be overridden by users

## Full Documentation

See https://code.claude.com/docs/en/settings#settings-files for complete documentation on managed settings and settings precedence.
