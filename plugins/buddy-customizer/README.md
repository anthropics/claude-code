# Buddy Customizer Plugin

Customize your Claude Code coding buddy — rename, adjust personality, track stats, and earn achievements through gamified coding milestones.

**Related issue:** [anthropics/claude-code#41908](https://github.com/anthropics/claude-code/issues/41908)

## Features

### Rename Your Buddy
```
/buddy-rename Charmander
```

### Set Custom Personality
```
/buddy-personality A fiery debugger who celebrates every green test with a tiny dance
```

### View Stats Card
```
/buddy-stats
```
```
┌──────────────────────────────────────┐
│  Charmander ⭐⭐ Level 5 (Journeyman)
│
│  "A fiery debugger who celebrates
│  every green test with a tiny dance"
│
│  XP: 520 [██████████░░░░░░░░░░] 20/300 to Lv.6
│
│  DEBUGGING  ████████░░   82
│  PATIENCE   ██████░░░░   61
│  CHAOS      ██░░░░░░░░   15
│  WISDOM     ███████░░░   72
│  SNARK      ████░░░░░░   40
│
│  🔥 7-day streak · 📊 42 sessions
│  🎯 🧪 🔥 ⭐ 🏆
└──────────────────────────────────────┘
```

### View Achievements
```
/buddy-achievements
```

### Reset Customizations
```
/buddy-reset
```

## How Gamification Works

The plugin tracks your coding activity via PostToolUse hooks and awards XP:

| Activity | XP | Stat Boosted |
|----------|-----|-------------|
| Git Commit | +10 | Debugging |
| Test Run | +8 | Patience |
| Build | +7 | Patience |
| Git Push | +6 | Chaos |
| File Edit | +5 | Debugging |
| Lint Check | +4 | Wisdom |
| File Create | +3 | Wisdom |
| Code Search | +2 | Wisdom |
| File Read | +1 | Patience |

### Levels

| Level | XP Required | Title |
|-------|-------------|-------|
| 0 | 0 | Hatchling |
| 1 | 50 | Curious |
| 2 | 150 | Apprentice |
| 3 | 300 | Companion |
| 4 | 500 | Sidekick |
| 5 | 800 | Journeyman |
| 6 | 1200 | Adept |
| 7 | 1800 | Veteran |
| 8 | 2500 | Expert |
| 9 | 3500 | Master |
| 10 | 5000 | Legend |

### Achievements

| Icon | Name | Requirement |
|------|------|-------------|
| 🎯 | First Blood | 1 git commit |
| 🧪 | Test Champion | 25 test runs |
| 💯 | Centurion | 100 file edits |
| 🔥 | On Fire | 3-day streak |
| ⚡ | Unstoppable | 7-day streak |
| ⭐ | Journeyman | Level 5 |
| 👑 | Master | Level 10 |
| 🔍 | Explorer | 50 code searches |
| 🏗️ | Builder | 20 builds |
| 🏆 | Prolific | 1000 total XP |

## Installation

Install via Claude Code:
```bash
claude /install-plugin /path/to/buddy-customizer
```

Or add to your project's `.claude/settings.json`:
```json
{
  "plugins": ["path/to/buddy-customizer"]
}
```

## Data Storage

Profile data is stored at `~/.claude/buddy-customizer/profile.json` — portable and human-readable.

## Limitations

This plugin is a **proof-of-concept overlay** on top of the existing `/buddy` feature:
- Cannot modify the core buddy's visual appearance (ASCII art, species, eye style)
- Cannot change the buddy's hat or native stats displayed in the companion card
- Custom name and personality are tracked in the plugin's own profile, not the native buddy system
- Gamification stats are based on tool-use hooks, not direct integration with the buddy UI

These limitations would be resolved if Anthropic exposes buddy customization APIs (see issue #41908).
