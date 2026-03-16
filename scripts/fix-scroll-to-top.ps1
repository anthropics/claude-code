# fix-scroll-to-top.ps1 (v2 + throttle + sync disable)
# Fixes terminal scroll-to-top during Claude Code agent execution.
#
# 3 patches:
#   1. Stateful stdout.write interceptor — clamps cursor-up across all writes
#   2. Render throttle 16ms→200ms — reduces viewport resets from 60fps to 5fps
#   3. Disable synchronized update mode — lets terminal's native auto-scroll prevention work
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File fix-scroll-to-top.ps1
#
# Requires: npm-installed Claude Code (npm install -g @anthropic-ai/claude-code)
# Re-run after every npm update.
#
# Related: https://github.com/anthropics/claude-code/issues/34794
#          https://github.com/anthropics/claude-code/pull/34798

param([switch]$Uninstall)

$ErrorActionPreference = "Stop"
$cliPath = "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code\cli.js"

if (-not (Test-Path $cliPath)) {
    Write-Host "ERROR: npm install not found. Run: npm install -g @anthropic-ai/claude-code" -ForegroundColor Red
    exit 1
}

$code = [System.IO.File]::ReadAllText($cliPath, [System.Text.Encoding]::UTF8)

$marker = '/* SCROLL_FIX_v2 */'
$interceptor = '/* SCROLL_FIX_v2 */;(function(){var _ow=process.stdout.write.bind(process.stdout);var _gr=function(){return process.stdout.rows||24};var _up=0;process.stdout.write=function(d,e,c){if(typeof e==="function"){c=e;e=void 0}var s=typeof d==="string"?d:Buffer.isBuffer(d)?d.toString("utf-8"):String(d);var dn=0,m,re=/\x1b\[(\d+)B/g;while(m=re.exec(s))dn+=parseInt(m[1],10);var nl=0;for(var i=0;i<s.length;i++)if(s.charCodeAt(i)===10)nl++;_up=Math.max(0,_up-dn-nl);var mx=_gr()-1;s=s.replace(/\x1b\[(\d+)A/g,function(m,n){var v=parseInt(n,10);_up+=v;if(_up>mx){var a=Math.max(0,v-(_up-mx));_up=mx;if(a<=0)return"";return"\x1b["+a+"A"}return m});if(s.indexOf("\x1b[?2026l")!==-1)_up=0;if(s.indexOf("\x1b[H")!==-1)_up=0;return _ow(s,e,c)};})();'

# --- Uninstall ---
if ($Uninstall) {
    $reverted = 0
    if ($code.Contains($marker)) {
        $s = $code.IndexOf($marker); $e = $code.IndexOf('})();', $s) + 5
        $code = $code.Substring(0, $s) + $code.Substring($e + 1); $reverted++
    }
    $code = $code.Replace('var SK6=200;', 'var SK6=16;')
    $code = $code.Replace('kk7="",Ek7=""', 'kk7=qs(XO.SYNCHRONIZED_UPDATE),Ek7=Ks(XO.SYNCHRONIZED_UPDATE)')
    [System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)
    Write-Host "Reverted all scroll patches." -ForegroundColor Green
    exit 0
}

# --- Apply ---
$applied = 0

# Patch 1: stdout interceptor
if ($code.Contains($marker)) {
    Write-Host "[1/3] Interceptor already applied." -ForegroundColor Green
} else {
    $i = $code.IndexOf('import{')
    $code = $code.Substring(0, $i) + $interceptor + "`n" + $code.Substring($i)
    $applied++; Write-Host "[1/3] Applied stdout.write interceptor." -ForegroundColor Green
}

# Patch 2: render throttle
if ($code.Contains('var SK6=200;')) {
    Write-Host "[2/3] Render throttle already applied." -ForegroundColor Green
} elseif ($code.Contains('var SK6=16;')) {
    $code = $code.Replace('var SK6=16;', 'var SK6=200;')
    $applied++; Write-Host "[2/3] Applied render throttle (16ms -> 200ms)." -ForegroundColor Green
} else {
    Write-Host "[2/3] Render throttle pattern not found." -ForegroundColor Red
}

# Patch 3: disable sync update
if ($code.Contains('kk7="",Ek7=""')) {
    Write-Host "[3/3] Sync disable already applied." -ForegroundColor Green
} elseif ($code.Contains('kk7=qs(XO.SYNCHRONIZED_UPDATE),Ek7=Ks(XO.SYNCHRONIZED_UPDATE)')) {
    $code = $code.Replace('kk7=qs(XO.SYNCHRONIZED_UPDATE),Ek7=Ks(XO.SYNCHRONIZED_UPDATE)', 'kk7="",Ek7=""')
    $applied++; Write-Host "[3/3] Disabled synchronized update mode." -ForegroundColor Green
} else {
    Write-Host "[3/3] Sync update pattern not found." -ForegroundColor Red
}

if ($applied -gt 0) {
    [System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)
}

Write-Host "`nDone. Run: $env:APPDATA\npm\claude.cmd" -ForegroundColor Cyan
Write-Host "Revert: powershell -File $PSCommandPath -Uninstall" -ForegroundColor Gray
