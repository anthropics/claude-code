# /cjk-paste - Clipboard-based CJK Input Helper

Read text from the system clipboard and use it as your input. This is a workaround for CJK (Chinese, Japanese, Korean) IME input issues where composing characters are invisible in the terminal input field.

## How it works

1. The user types/composes CJK text in an external editor (Notes, TextEdit, VS Code, etc.)
2. The user copies the text to clipboard (Cmd+C / Ctrl+C)
3. The user runs `/cjk-paste` in Claude Code
4. Claude reads the clipboard content and processes it as if the user typed it

## Instructions

When the user runs this command:

1. Execute the appropriate clipboard read command based on the platform:
   - **macOS**: `pbpaste`
   - **Linux**: `xclip -selection clipboard -o` (or `xsel --clipboard --output`)
   - **Windows (WSL)**: `powershell.exe -command "Get-Clipboard"`

2. Display the clipboard content to the user for confirmation:
   ```
   Clipboard content: "<content>"
   ```

3. If the content is empty, inform the user:
   ```
   Clipboard is empty. Please copy some text first (Cmd+C / Ctrl+C).
   ```

4. If the content exists, treat it as the user's prompt and respond to it directly.

## Usage

```
/cjk-paste
```

No arguments needed - the command reads directly from the system clipboard.

## Example

```
# User copies "이 프로젝트의 구조를 설명해줘" in an external editor
# Then in Claude Code:
> /cjk-paste

Clipboard content: "이 프로젝트의 구조를 설명해줘"
Processing your request...
```

## Why this exists

Claude Code's terminal input uses React Ink, which has a known limitation with IME (Input Method Editor) composition in terminal raw mode. CJK characters require multi-stage composition (e.g., Korean: ㅎ → 하 → 한), but the terminal cannot display intermediate composition states. This command provides a reliable workaround by using the system clipboard as an input bridge.
