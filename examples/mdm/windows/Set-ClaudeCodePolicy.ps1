<#
Deploys Claude Code managed settings as a JSON file.

Intune: Devices > Scripts and remediations > Platform scripts > Add (Windows 10 and later).
  Run this script using the logged on credentials: No
  Run script in 64 bit PowerShell Host: Yes

Claude Code reads C:\Program Files\ClaudeCode\managed-settings.json at startup
and treats it as a managed policy source. Edit the JSON below to change the
deployed settings; see https://code.claude.com/docs/en/settings for available keys.
#>

$ErrorActionPreference = 'Stop'

$dir = Join-Path $env:ProgramFiles 'ClaudeCode'
New-Item -ItemType Directory -Path $dir -Force | Out-Null

$json = @'
{
  "permissions": {
    "disableBypassPermissionsMode": "disable"
  }
}
'@

$path = Join-Path $dir 'managed-settings.json'
[System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Wrote $path"
