# fix-scroll-to-top.ps1 (v5 — idle-flush)
#
# Buffers all Ink renders during active Claude work. Screen stays frozen
# while working (no viewport jumping). Flushes only when:
#   (a) User types (stdin) — they're at the prompt, viewport follows naturally
#   (b) 5 seconds of no new renders — Claude finished, show final state
#
# Root cause: Windows Terminal bug microsoft/terminal#14774
# Any cursor positioning scrolls viewport, even when cursor is visible.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File fix-scroll-to-top.ps1
#
# Related: https://github.com/anthropics/claude-code/issues/34794
#          https://github.com/anthropics/claude-code/pull/34798
#          https://github.com/microsoft/terminal/issues/14774

param([switch]$Uninstall)

$ErrorActionPreference = "Stop"
$cliPath = "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code\cli.js"

if (-not (Test-Path $cliPath)) {
    Write-Host "ERROR: npm install not found. Run: npm install -g @anthropic-ai/claude-code" -ForegroundColor Red
    exit 1
}

$code = [System.IO.File]::ReadAllText($cliPath, [System.Text.Encoding]::UTF8)
$marker = '/* SCROLL_FIX_v5 */'

if ($Uninstall) {
    if ($code.Contains($marker)) {
        $s = $code.IndexOf($marker)
        $e = $code.IndexOf('})();', $s) + 5
        $code = $code.Substring(0, $s) + $code.Substring($e)
        if ($code[$s] -eq "`n") { $code = $code.Substring(0, $s) + $code.Substring($s + 1) }
        [System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)
        Write-Host "Reverted scroll fix." -ForegroundColor Green
    } else { Write-Host "No patch to revert." -ForegroundColor Yellow }
    exit 0
}

if ($code.Contains($marker)) {
    Write-Host "Already patched." -ForegroundColor Green
    exit 0
}

# Remove older versions
foreach ($old in @('/* SCROLL_FIX_v2 */', '/* SCROLL_FIX_v4 */')) {
    if ($code.Contains($old)) {
        $s = $code.IndexOf($old); $e = $code.IndexOf('})();', $s) + 5
        $code = $code.Substring(0, $s) + $code.Substring($e)
    }
}
# Revert throttle/sync changes from older versions
$code = $code.Replace('var SK6=200;', 'var SK6=16;').Replace('var SK6=1000;', 'var SK6=16;')
$code = $code.Replace('kk7="",Ek7=""', 'kk7=qs(XO.SYNCHRONIZED_UPDATE),Ek7=Ks(XO.SYNCHRONIZED_UPDATE)')

$fix = '/* SCROLL_FIX_v5 */;(function(){var _ow=process.stdout.write.bind(process.stdout);var _buf=null;var _timer=null;var _userInput=false;var _IDLE=5000;process.stdin.on("data",function(){_userInput=true});function _flush(){if(_timer){clearTimeout(_timer);_timer=null}if(!_buf)return;var b=_buf;_buf=null;_ow(b.s,b.e)}process.stdout.write=function(d,e,c){if(typeof e==="function"){c=e;e=void 0}var s=typeof d==="string"?d:Buffer.isBuffer(d)?d.toString("utf-8"):String(d);if(s.indexOf("\x1b[?2026h")!==-1){if(_userInput){_userInput=false;return _ow(s,e,c)}_buf={s:s,e:e};if(_timer)clearTimeout(_timer);_timer=setTimeout(_flush,_IDLE);if(c)c();return true}return _ow(s,e,c)};})();'

$i = $code.IndexOf('import{')
$code = $code.Substring(0, $i) + $fix + "`n" + $code.Substring($i)
[System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)

Write-Host "Applied scroll fix v5 (idle-flush)." -ForegroundColor Green
Write-Host "Run: $env:APPDATA\npm\claude.cmd" -ForegroundColor Cyan
