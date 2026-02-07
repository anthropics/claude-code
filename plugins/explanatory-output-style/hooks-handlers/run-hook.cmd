:; # Cross-platform hook wrapper (polyglot: cmd.exe + bash)
:; # On Windows: invokes Git Bash explicitly to avoid WSL bash.exe
:; # On Unix/macOS: passes through to bash natively
:;
:; # --- Unix/macOS execution path ---
:; SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
:; exec bash "$SCRIPT_DIR/$1" "${@:2}"
:; exit $?

@echo off
REM --- Windows execution path ---
set "SCRIPT_DIR=%~dp0"
set "HOOK_SCRIPT=%SCRIPT_DIR%%~1"

if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_SCRIPT%" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %errorlevel%
)
if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    "C:\Program Files (x86)\Git\bin\bash.exe" "%HOOK_SCRIPT%" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %errorlevel%
)

for /f "tokens=*" %%i in ('where git 2^>nul') do (
    for %%j in ("%%~dpi..") do (
        if exist "%%~fj\bin\bash.exe" (
            "%%~fj\bin\bash.exe" "%HOOK_SCRIPT%" %2 %3 %4 %5 %6 %7 %8 %9
            exit /b %errorlevel%
        )
    )
)

echo ERROR: Git Bash not found. Install Git for Windows. >&2
exit /b 1
