# fix-scroll-to-top.ps1 (v7 — replay all frames on stdin flush)
#
# Buffers ALL Ink renders. Replays entire chain when user types.
# No timer. No auto-flush. Correct diff chain (no outdated screens).
#
# Root cause: Windows Terminal bug microsoft/terminal#14774
# Usage: powershell -ExecutionPolicy Bypass -File fix-scroll-to-top.ps1

param([switch]$Uninstall)
$ErrorActionPreference = "Stop"
$cliPath = "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code\cli.js"

if (-not (Test-Path $cliPath)) {
    Write-Host "ERROR: Run: npm install -g @anthropic-ai/claude-code" -ForegroundColor Red; exit 1
}

$code = [System.IO.File]::ReadAllText($cliPath, [System.Text.Encoding]::UTF8)
$marker = '/* SCROLL_FIX_v7 */'

if ($Uninstall) {
    if ($code.Contains($marker)) {
        $s = $code.IndexOf($marker); $e = $code.IndexOf('})();', $s) + 5
        $code = $code.Substring(0, $s) + $code.Substring($e)
        if ($code[$s] -eq "`n") { $code = $code.Substring(0, $s) + $code.Substring($s + 1) }
        [System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)
        Write-Host "Reverted." -ForegroundColor Green
    } else { Write-Host "No patch found." -ForegroundColor Yellow }
    exit 0
}

if ($code.Contains($marker)) { Write-Host "Already patched." -ForegroundColor Green; exit 0 }

foreach ($old in @('/* SCROLL_FIX_v2 */','/* SCROLL_FIX_v4 */','/* SCROLL_FIX_v5 */','/* SCROLL_FIX_v6 */')) {
    if ($code.Contains($old)) {
        $s = $code.IndexOf($old); $e = $code.IndexOf('})();', $s) + 5
        $code = $code.Substring(0, $s) + $code.Substring($e)
    }
}
$code = $code.Replace('var SK6=200;','var SK6=16;').Replace('var SK6=1000;','var SK6=16;')
$code = $code.Replace('kk7="",Ek7=""','kk7=qs(XO.SYNCHRONIZED_UPDATE),Ek7=Ks(XO.SYNCHRONIZED_UPDATE)')

$fix = '/* SCROLL_FIX_v7 */;(function(){var _ow=process.stdout.write.bind(process.stdout);var _buf=[];var _userInput=false;process.stdin.on("data",function(){_userInput=true});function _flush(){if(_buf.length===0)return;var all="";for(var i=0;i<_buf.length;i++)all+=_buf[i];_buf=[];_ow(all)}process.stdout.write=function(d,e,c){if(typeof e==="function"){c=e;e=void 0}var s=typeof d==="string"?d:Buffer.isBuffer(d)?d.toString("utf-8"):String(d);if(s.indexOf("\x1b[?2026h")!==-1){if(_userInput){_userInput=false;_flush();return _ow(s,e,c)}_buf.push(s);if(c)c();return true}return _ow(s,e,c)};})();'

$i = $code.IndexOf('import{')
$code = $code.Substring(0, $i) + $fix + "`n" + $code.Substring($i)
[System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)
Write-Host "Applied scroll fix v7." -ForegroundColor Green
