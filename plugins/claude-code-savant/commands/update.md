---
description: Check for updates and upgrade Savant to the latest version
---

# Savant Update

$ARGUMENTS

## Your Task

Check for updates and help user upgrade to the latest version.

## Step 1: Check Current Version

Read the current version from the plugin. Current version should be displayed.

## Step 2: Check Latest Version

Inform the user about the latest version available.

**Current Latest Version: 1.2.0**

## Step 3: Show Update Information

### If Update Available

```
## 🔄 Savant Update Available!

**Current Version**: [user's version]
**Latest Version**: 1.2.0

### What's New in 1.2.0:
- 🎭 **Smart Router**: Auto-detect best persona with `/savant`
- 🌍 **Multi-language**: English, 한국어, 日本語, 中文 support
- ⚡ **Default Mode**: Always-on routing with `/savant-default`
- 🧙 **Setup Wizard**: First-time configuration

### How to Update:

```bash
# Option 1: Via Marketplace (Recommended)
/plugin update claude-code-savant

# Option 2: Manual Update
cd ~/.claude/plugins/claude-code-savant
git pull origin master
```

### After Update:
Run `/savant-setup` to configure new features!
```

### If Already Latest

```
## ✅ You're Up to Date!

**Current Version**: 1.2.0 (Latest)

No updates available. You have the latest version of Savant.

### Current Features:
- 🧠 Einstein - Deep conceptual explanations
- 🎭 Shakespeare - Code narratives with flowcharts
- 💡 Steve Jobs - Visionary project direction
- 🔍 Socrates - Error debugging & root cause
- 🎯 Smart Router - Auto-detect best persona
- 🌍 Multi-language support
- ⚡ Default mode auto-routing
```

## Version History

| Version | Features |
|---------|----------|
| 1.2.0 | Smart Router, Default Mode, Multi-language, Setup Wizard |
| 1.1.0 | Steve Jobs & Socrates personas |
| 1.0.0 | Einstein & Shakespeare personas |
