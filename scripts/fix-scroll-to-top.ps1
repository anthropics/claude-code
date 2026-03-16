# fix-scroll-to-top.ps1 (v2)
# Fixes terminal scroll-to-top during Claude Code agent execution.
#
# Root cause: Ink's rendering and the prompt renderer emit cursor-up (\x1B[nA)
# sequences that move the cursor above the viewport. Terminal emulators follow
# the cursor, snapping the viewport to the top.
#
# This patch injects a stateful stdout.write interceptor into cli.js that
# tracks net cursor-up movement across ALL writes and clamps it to the
# terminal height. The cursor can never leave the viewport.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File fix-scroll-to-top.ps1
#
# Requires: npm-installed Claude Code (npm install -g @anthropic-ai/claude-code)
# Re-run after every npm update.
#
# Related: https://github.com/anthropics/claude-code/issues/34794
#          https://github.com/anthropics/claude-code/pull/34798

param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$cliPath = "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code\cli.js"

if (-not (Test-Path $cliPath)) {
    Write-Host "ERROR: Claude Code npm install not found at $cliPath" -ForegroundColor Red
    Write-Host "Run: npm install -g @anthropic-ai/claude-code" -ForegroundColor Yellow
    exit 1
}

$code = [System.IO.File]::ReadAllText($cliPath, [System.Text.Encoding]::UTF8)

$marker = '/* SCROLL_FIX_v2 */'

# The interceptor code (single line, injected before first import)
$interceptor = '/* SCROLL_FIX_v2 */;(function(){var _ow=process.stdout.write.bind(process.stdout);var _gr=function(){return process.stdout.rows||24};var _up=0;process.stdout.write=function(d,e,c){if(typeof e==="function"){c=e;e=void 0}var s=typeof d==="string"?d:Buffer.isBuffer(d)?d.toString("utf-8"):String(d);var dn=0,m,re=/\x1b\[(\d+)B/g;while(m=re.exec(s))dn+=parseInt(m[1],10);var nl=0;for(var i=0;i<s.length;i++)if(s.charCodeAt(i)===10)nl++;_up=Math.max(0,_up-dn-nl);var mx=_gr()-1;s=s.replace(/\x1b\[(\d+)A/g,function(m,n){var v=parseInt(n,10);_up+=v;if(_up>mx){var a=Math.max(0,v-(_up-mx));_up=mx;if(a<=0)return"";return"\x1b["+a+"A"}return m});if(s.indexOf("\x1b[?2026l")!==-1)_up=0;if(s.indexOf("\x1b[H")!==-1)_up=0;return _ow(s,e,c)};})();'

# --- Uninstall ---

if ($Uninstall) {
    if ($code.Contains($marker)) {
        $start = $code.IndexOf($marker)
        $end = $code.IndexOf('})();', $start) + 5
        $code = $code.Substring(0, $start) + $code.Substring($end + 1)
        [System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)
        Write-Host "Reverted scroll fix." -ForegroundColor Green
    } else {
        Write-Host "No scroll fix to revert." -ForegroundColor Yellow
    }
    exit 0
}

# --- Apply ---

if ($code.Contains($marker)) {
    Write-Host "Already patched." -ForegroundColor Green
    exit 0
}

$insertAt = $code.IndexOf('import{')
if ($insertAt -eq -1) {
    Write-Host "ERROR: Could not find import statement in cli.js" -ForegroundColor Red
    exit 1
}

$code = $code.Substring(0, $insertAt) + $interceptor + "`n" + $code.Substring($insertAt)
[System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)

Write-Host "Applied scroll fix v2 to cli.js" -ForegroundColor Green
Write-Host "Run Claude Code via: $env:APPDATA\npm\claude.cmd" -ForegroundColor White
Write-Host "To revert: powershell -File $PSCommandPath -Uninstall" -ForegroundColor Gray
