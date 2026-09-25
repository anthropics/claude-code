# Mobile Apps Plugin

Organise all apps in a mobile project with a structured, scalable folder layout — covering React Native, Expo, Flutter, iOS, Android, and monorepos.

## Overview

The Mobile Apps Plugin audits your current project structure, identifies disorganisation, proposes a clean layout based on platform best practices, and applies the reorganisation while keeping all imports and config references intact.

## Command: `/mobile-apps:organize`

Launches a guided 7-phase workflow to organise all apps in a mobile project.

**Usage:**

```bash
/mobile-apps:organize
```

With an optional path or platform hint:

```bash
/mobile-apps:organize ./my-app
/mobile-apps:organize react-native
/mobile-apps:organize flutter
```

## The 7-Phase Workflow

| Phase | Name | What happens |
|-------|------|--------------|
| 1 | Discovery | Detect platform, list apps and config files |
| 2 | Structure Audit | Map current layout, flag misplaced files and duplicates |
| 3 | Clarifying Questions | Resolve ambiguities about targets, naming, and CI constraints |
| 4 | Proposed Layout | Generate feature-based and layer-based layout options |
| 5 | Reorganisation | Move files, update imports and config references |
| 6 | Validation | Scan for broken imports and missing asset paths |
| 7 | Summary | Document all changes and suggested follow-up steps |

## Supported Platforms

| Platform | Entry point detection | Import update | Config update |
|----------|-----------------------|---------------|---------------|
| React Native | `package.json` + `metro.config.js` | ✅ | ✅ |
| Expo | `app.json` / `app.config.ts` | ✅ | ✅ |
| Flutter | `pubspec.yaml` | ✅ | ✅ |
| iOS (Swift) | `*.xcodeproj` / `Podfile` | ✅ | ✅ |
| Android (Kotlin) | `build.gradle` / `AndroidManifest.xml` | ✅ | ✅ |
| Monorepo (Turborepo / Nx / Yarn workspaces) | `turbo.json` / `nx.json` / workspace `package.json` | ✅ | ✅ |

## Agents

| Agent | Role |
|-------|------|
| `mobile-structure-auditor` | Scans and reports on the current project layout |
| `mobile-structure-designer` | Proposes feature-based and layer-based layout options |
| `mobile-import-validator` | Validates all imports and references after reorganisation |

## Example

```
You: /mobile-apps:organize

Claude: Let me start by detecting what's in your project...

Platform detected: React Native (Expo managed workflow)
Apps found: 2 — `apps/consumer`, `apps/driver`

Audit findings:
- 14 screens placed directly in `src/` instead of `src/screens/`
- Assets duplicated between `assets/` and `src/assets/`
- No shared package for the design system used by both apps

Proposed layout: feature-based monorepo with `packages/ui` shared library

Shall I proceed?
```

## Authors

Claude Code
