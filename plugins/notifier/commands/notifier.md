---
allowed-tools: Bash(sed:*), Bash(cat:*), Bash(grep:*), Bash(mkdir:*), Bash(echo:*), Bash(~/.claude-code-notifier/uninstall.sh)
argument-hint: <command> [value]
description: Configure claude-code-notifier settings
---

# Claude Code Notifier Configuration

## Available Commands

| Command | Description |
|---------|-------------|
| `help` | Show this help message |
| `status` | Show current configuration |
| `lang <en\|ko>` | Set language (en: English, ko: 한국어) |
| `duration <seconds>` | Set minimum task duration (default: 20) |
| `preview <length>` | Set prompt preview length (default: 45) |
| `test` | Send a test notification |
| `uninstall` | Uninstall claude-code-notifier |

## Language Detection

First, read NOTIFIER_LANG from ~/.claude-code-notifier/hooks-handlers/config.sh to determine response language.

## Task

User command: `$ARGUMENTS`

Perform the appropriate action based on the detected language:

### 1. `status`
Display current settings:

**English (en):**
```
📊 Current Configuration
━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Language: {en|ko}
⏱️  Min Duration: {value} seconds
📝 Preview Length: {value} characters
━━━━━━━━━━━━━━━━━━━━━━━━
```

**Korean (ko):**
```
📊 현재 설정
━━━━━━━━━━━━━━━━━━━━━━━━
🌐 언어: {en|ko}
⏱️  최소 시간: {value}초
📝 미리보기 길이: {value}자
━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. `lang <en|ko>`
- Validate that the value is "en" or "ko"
- Update NOTIFIER_LANG in config.sh using sed
- **en:** "✅ Language updated to {value}"
- **ko:** "✅ 언어가 {value}(으)로 변경되었습니다"

### 3. `duration <number>`
- Validate that the value is a positive number
- Update MIN_DURATION_SECONDS in config.sh using sed
- **en:** "✅ Duration updated to {value} seconds"
- **ko:** "✅ 최소 시간이 {value}초로 변경되었습니다"

### 4. `preview <number>`
- Validate that the value is a positive number
- Update PROMPT_PREVIEW_LENGTH in config.sh using sed
- **en:** "✅ Preview length updated to {value} characters"
- **ko:** "✅ 미리보기 길이가 {value}자로 변경되었습니다"

### 5. `test`
Run these commands:
```bash
mkdir -p ~/.claude-code-notifier/data
echo "Test notification from /notifier" > ~/.claude-code-notifier/data/prompt-test.txt
echo $(date +%s) > ~/.claude-code-notifier/data/timestamp-test.txt
echo '{"session_id": "test"}' | ~/.claude-code-notifier/hooks-handlers/notify.sh
```
- **en:** "✅ Test notification sent!"
- **ko:** "✅ 테스트 알림을 전송했습니다!"

### 6. `uninstall`
Run the uninstall script:
```bash
~/.claude-code-notifier/uninstall.sh
```

**English (en):**
```
✅ claude-code-notifier has been uninstalled.

⚠️ Please restart Claude Code to complete the uninstallation.
   (Type /exit or press Ctrl+C)
```

**Korean (ko):**
```
✅ claude-code-notifier가 삭제되었습니다.

⚠️ 삭제를 완료하려면 Claude Code를 재시작하세요.
   (/exit 입력 또는 Ctrl+C)
```

### 7. `help` or empty/invalid command
Show the available commands table above.

### Error Handling

**English (en):**
- If config.sh not found: "❌ claude-code-notifier is not installed. Run install.sh first."
- If invalid number provided: "❌ Please provide a valid positive number."
- If invalid language provided: "❌ Please provide a valid language (en or ko)."
- If unknown command: "❌ Unknown command. Use `/notifier help` to see available commands."

**Korean (ko):**
- If config.sh not found: "❌ claude-code-notifier가 설치되지 않았습니다. install.sh를 먼저 실행하세요."
- If invalid number provided: "❌ 유효한 양수를 입력하세요."
- If invalid language provided: "❌ 유효한 언어를 입력하세요 (en 또는 ko)."
- If unknown command: "❌ 알 수 없는 명령어입니다. `/notifier help`로 사용 가능한 명령어를 확인하세요."
