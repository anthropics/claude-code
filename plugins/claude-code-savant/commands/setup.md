---
description: Initial setup wizard for Savant - configure language and default mode
---

# Savant Setup Wizard

Welcome to **Claude Code Savant**! Let's configure your preferences.

## Setup Process

Use AskUserQuestion to configure the following settings:

### Step 1: Language Selection

```
AskUserQuestion:
- question: "Which language should Savant respond in?"
- header: "Language"
- options:
  - label: "English"
    description: "Responses in English"
  - label: "한국어 (Korean)"
    description: "한국어로 응답합니다"
  - label: "日本語 (Japanese)"
    description: "日本語で応答します"
  - label: "中文 (Chinese)"
    description: "用中文回复"
```

### Step 2: Default Mode

```
AskUserQuestion:
- question: "Enable Savant Default Mode? (Auto-route all questions)"
- header: "Default Mode"
- options:
  - label: "Yes, enable (Recommended)"
    description: "All questions automatically analyzed and routed to best persona"
  - label: "No, manual only"
    description: "Use /savant or specific commands when needed"
```

### Step 3: Confirmation

After collecting preferences, display:

```
## ✅ Savant Setup Complete!

### Your Settings:
- **Language**: [Selected Language]
- **Default Mode**: [Enabled/Disabled]

### Quick Start:
[If default mode enabled]
Just ask any question! I'll automatically route it to the best persona.

[If default mode disabled]
Use these commands:
- `/savant [question]` - Smart router
- `/savant-question` - Einstein (concepts)
- `/savant-code` - Shakespeare (code analysis)
- `/savant-new` - Steve Jobs (direction)
- `/savant-fix` - Socrates (debugging)

### Change Settings Anytime:
- `/savant-lang` - Change language
- `/savant-default` - Enable default mode
- `/savant-default-off` - Disable default mode

Enjoy using Savant! 🎭
```

## Language Instruction

Based on language selection, inform the user that all Savant responses will be in their chosen language. Store this preference for the session.
