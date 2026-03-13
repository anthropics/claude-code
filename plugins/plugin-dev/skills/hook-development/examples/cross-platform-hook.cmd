:; # ============================================================================
:; # Cross-Platform Hook Wrapper (Polyglot: cmd.exe + bash)
:; # ============================================================================
:; #
:; # PURPOSE:
:; #   Ensures hook .sh scripts work on Windows even when WSL is installed.
:; #   On Windows, `bash` in PATH often resolves to WSL's bash.exe instead of
:; #   Git Bash, causing hooks to fail. This wrapper explicitly invokes Git Bash.
:; #
:; # USAGE:
:; #   In hooks.json, replace direct .sh references:
:; #     BEFORE: "command": "${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.sh"
:; #     AFTER:  "command": "${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd my-hook.sh"
:; #
:; # HOW IT WORKS:
:; #   Lines starting with `:;` are valid labels in cmd.exe (ignored) and valid
:; #   no-ops in bash. When bash runs this file, it executes the commands after
:; #   `:;` and `exec`s the target script. When cmd.exe runs it, it skips the
:; #   `:;` labels and executes the @echo off section below.
:; #
:; # COPY THIS FILE into your plugin's hooks directory and rename to run-hook.cmd
:; # ============================================================================
:;
:; # --- Unix/macOS execution path ---
:; SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
:; exec bash "$SCRIPT_DIR/$1" "${@:2}"
:; exit $?

@echo off
REM --- Windows execution path ---
REM Resolve the hook script path relative to this .cmd file
set "SCRIPT_DIR=%~dp0"
set "HOOK_SCRIPT=%SCRIPT_DIR%%~1"

REM Try standard Git for Windows installation paths
if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_SCRIPT%" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %errorlevel%
)
if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    "C:\Program Files (x86)\Git\bin\bash.exe" "%HOOK_SCRIPT%" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %errorlevel%
)

REM Fallback: locate bash via Git's installation directory
for /f "tokens=*" %%i in ('where git 2^>nul') do (
    for %%j in ("%%~dpi..") do (
        if exist "%%~fj\bin\bash.exe" (
            "%%~fj\bin\bash.exe" "%HOOK_SCRIPT%" %2 %3 %4 %5 %6 %7 %8 %9
            exit /b %errorlevel%
        )
    )
)

echo ERROR: Git Bash not found. Install Git for Windows from https://git-scm.com >&2
exit /b 1
