# Claude Code iOS 26 Widget

A WidgetKit extension for iOS 26 that shows Claude Code session statistics and API status directly on the Home Screen and Lock Screen.

## Widgets

### Claude Status Widget
Shows the current Claude API status and active model.

**Supported sizes:** Small, Medium, Accessory Circular, Accessory Rectangular, Accessory Inline

| Small | Medium | Accessory Circular |
|-------|--------|--------------------|
| API status + model | Status + token count + last update | Status indicator dot |

### Claude Session Stats Widget
Shows your Claude Code session statistics (sessions, files edited, tasks completed, lines changed).

**Supported sizes:** Small, Medium, Large

| Small | Medium | Large |
|-------|--------|-------|
| Session count + files + tasks | 4-stat grid | Full stats + model info |

## Requirements

- iOS 26+
- Xcode 16+
- Swift 6
- WidgetKit framework

## Project Structure

```
ClaudeWidget/
├── ClaudeWidget.xcodeproj/
│   └── project.pbxproj
└── WidgetExtension/
    ├── ClaudeWidgetBundle.swift     # Widget entry point (@main)
    ├── Info.plist
    ├── Assets.xcassets/
    ├── Model/
    │   └── WidgetData.swift         # Data models + App Group access
    ├── Provider/
    │   ├── ClaudeStatusProvider.swift   # Timeline provider (15 min refresh)
    │   └── ClaudeSessionProvider.swift  # Timeline provider (30 min refresh)
    └── Views/
        ├── ClaudeStatusWidgetView.swift  # Status widget views
        └── ClaudeSessionWidgetView.swift # Session stats widget views
```

## Integration

### Writing data from the main app

The widget reads data from a shared **App Group** (`group.com.anthropic.claude-code.widget`).
Write session data from your main app target:

```swift
import Foundation

func saveSessionData(_ session: ClaudeSessionData) {
    guard
        let encoded = try? JSONEncoder().encode(session),
        let defaults = UserDefaults(suiteName: "group.com.anthropic.claude-code.widget")
    else { return }
    defaults.set(encoded, forKey: "claudeSession")
    WidgetCenter.shared.reloadTimelines(ofKind: "ClaudeSessionWidget")
}

func saveStatusData(_ status: ClaudeStatusData) {
    guard
        let encoded = try? JSONEncoder().encode(status),
        let defaults = UserDefaults(suiteName: "group.com.anthropic.claude-code.widget")
    else { return }
    defaults.set(encoded, forKey: "claudeStatus")
    WidgetCenter.shared.reloadTimelines(ofKind: "ClaudeStatusWidget")
}
```

### Adding to your Xcode project

1. Open your existing Claude Code app project in Xcode.
2. **File > New > Target** and choose **Widget Extension**.
3. Copy the source files from `WidgetExtension/` into the new target.
4. Enable the **App Groups** capability on both the app target and widget target, using the same group ID (`group.com.anthropic.claude-code.widget`).
5. Build and run on a device or simulator running iOS 26.

## iOS 26 Features Used

- `containerBackground(.fill.tertiary, for: .widget)` — required on iOS 17+ for widget backgrounds
- `@Environment(\.widgetFamily)` — adapts layout per widget size
- `.accessoryCircular` / `.accessoryRectangular` / `.accessoryInline` — Lock Screen widgets (iOS 16+)
- `.ultraThinMaterial` backgrounds on stat tiles — glass-morphism effect
- Swift 6 strict concurrency (`Sendable` data models via `Codable`)
- `#Preview(as:)` macro — live widget previews in Xcode 16
