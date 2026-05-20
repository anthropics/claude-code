---
description: Organise all apps in a mobile project with a structured, scalable folder layout
argument-hint: Optional path to project root or specific platform (ios/android/react-native/flutter)
---

# Mobile Apps Organiser

You are helping a developer organise all apps and modules in a mobile project. Follow a systematic approach: audit the current structure, identify disorganisation, propose a clean layout, then apply it.

## Core Principles

- **Audit before acting**: Understand the existing layout before suggesting changes
- **Platform-aware**: Respect iOS, Android, React Native, Flutter, and cross-platform conventions
- **Non-destructive**: Move files, update imports — never delete unless explicitly confirmed
- **Use TodoWrite**: Track every phase of progress

---

## Phase 1: Discovery

**Goal**: Identify the project type and current state

Initial context: $ARGUMENTS

**Actions**:
1. Create a todo list with all phases
2. Detect the platform(s) present (iOS, Android, React Native, Flutter, Expo, etc.)
3. List all top-level directories and key config files (`package.json`, `pubspec.yaml`, `Podfile`, `build.gradle`, `AndroidManifest.xml`, `Info.plist`, etc.)
4. Identify the number of apps / modules / packages in the workspace
5. Confirm findings with the user before proceeding

---

## Phase 2: Structure Audit

**Goal**: Map the current file and folder organisation

**Actions**:
1. Launch a `mobile-structure-auditor` agent to:
   - Recursively list all source directories
   - Flag files that appear misplaced (e.g. screens in `utils/`, assets in `src/`, tests scattered outside `__tests__/`)
   - Identify duplicated resources (icons, images, fonts stored in multiple locations)
   - Note any platform-specific folders that are missing standard sub-structure
2. Present a concise audit report to the user with problem areas highlighted

---

## Phase 3: Clarifying Questions

**Goal**: Resolve ambiguities before proposing a new layout

**CRITICAL**: Do NOT skip this phase.

**Actions**:
1. Based on the audit, ask the user:
   - Which apps/targets should remain separate vs. merged into a monorepo?
   - Preferred naming convention for screens, components, and services?
   - Are shared libraries or design-system packages required?
   - Any existing CI paths or Fastlane lanes that must not move?
2. Wait for answers before proceeding

---

## Phase 4: Proposed Layout

**Goal**: Design a clean, scalable folder structure

**Actions**:
1. Launch a `mobile-structure-designer` agent to generate two layout options:
   - **Feature-based**: `apps/<name>/features/<feature>/` — screens, state, and tests co-located
   - **Layer-based**: `apps/<name>/screens/`, `apps/<name>/services/`, `apps/<name>/components/` — classic separation
2. Show the user a diff-style preview of the proposed structure
3. Ask the user to choose an option (or blend them)

---

## Phase 5: Reorganisation

**Goal**: Apply the approved layout

**DO NOT START WITHOUT USER APPROVAL**

**Actions**:
1. Wait for explicit user approval of the proposed layout
2. Move files and folders to their new locations
3. Update all import paths affected by the moves
4. Update any references in config files (`metro.config.js`, `tsconfig.json`, `pubspec.yaml`, `build.gradle`, etc.)
5. Regenerate or update index barrel files where needed
6. Mark todos as completed incrementally

---

## Phase 6: Validation

**Goal**: Confirm nothing is broken after the reorganisation

**Actions**:
1. Launch a `mobile-import-validator` agent to:
   - Scan all source files for broken imports
   - Check that asset references resolve correctly
   - Verify platform config files still point to the right entry points
2. Report any issues found and apply fixes
3. Suggest running the project's test suite and build commands to verify

---

## Phase 7: Summary

**Goal**: Document what changed

**Actions**:
1. Mark all todos complete
2. Produce a summary:
   - Files and folders moved
   - Imports updated
   - Config files modified
   - Suggested follow-up steps (e.g. updating CI, Fastlane, documentation)
