# iOS 26 – Schritte Widget (Apple Health)

Ein vollständiges, importierbares Xcode-Projekt mit einer iOS-App und einem WidgetKit-Extension, das täglich Schritt-Daten direkt aus Apple Health liest.

## Vorschau

| Small | Medium | Lock Screen (Circular) | Lock Screen (Rectangular) |
|-------|--------|------------------------|---------------------------|
| Fortschrittsring + Schrittzahl | Ring + Distanz, Ziel, Fortschrittsbalken | Gauge-Ring mit kompakter Zahl | Schrittzahl + Fortschrittsbalken |

## Funktionen

- **Echtzeitdaten** aus Apple Health (HealthKit)
- **Fortschrittsring** – animiert, wird grün bei Zielerreichung
- **Distanzberechnung** (km) und **Kalorienabschätzung** (kcal)
- **Anpassbares Tagesziel** (Standard: 10.000) – wird im App-Group-UserDefaults gespeichert
- **Automatische Widget-Aktualisierung** alle 15 Minuten
- **5 Widget-Größen:** Small, Medium, Accessory Circular, Rectangular, Inline (Lock Screen)
- Vollständige **Xcode 16 Previews** mit `#Preview(as:)` Makro

## Anforderungen

| | |
|---|---|
| iOS | 26.0+ |
| Xcode | 16.0+ |
| Swift | 6.0 |
| Frameworks | HealthKit, WidgetKit, SwiftUI |

## Projekt öffnen

```bash
open examples/ios-widget-steps/StepsWidget/StepsWidget.xcodeproj
```

## Projektstruktur

```
StepsWidget/
├── StepsWidget.xcodeproj/
│   └── project.pbxproj
│
├── StepsApp/                          # Hauptapp-Target
│   ├── StepsApp.swift                 # @main App
│   ├── ContentView.swift              # Fortschrittsring, Stats, Ziel-Editor
│   ├── HealthKitManager.swift         # HealthKit-Abfragen + WidgetCenter reload
│   ├── Info.plist                     # NSHealthShareUsageDescription
│   ├── StepsApp.entitlements          # HealthKit + App Group
│   └── Assets.xcassets/
│
└── StepsWidgetExtension/              # Widget-Extension-Target
    ├── StepsWidgetBundle.swift        # @main WidgetBundle
    ├── StepsProvider.swift            # TimelineProvider + StepsEntry
    ├── StepsWidgetView.swift          # Alle Widget-Views + Widget-Config
    ├── Info.plist                     # NSExtensionPointIdentifier
    ├── StepsWidgetExtension.entitlements # HealthKit + App Group
    └── Assets.xcassets/
```

## Setup nach dem Öffnen in Xcode

### 1. Team & Bundle ID setzen

Wähle in Xcode beide Targets (`StepsApp` und `StepsWidgetExtension`) → **Signing & Capabilities** → wähle dein Team.

Die Bundle-IDs sind vorbelegt als:
- App: `com.example.stepswidget`
- Widget: `com.example.stepswidget.widget`

Passe sie auf deine eigene Domain an, z. B. `de.deinname.stepswidget`.

### 2. App Group konfigurieren

Beide Targets müssen zur **gleichen App Group** gehören, damit das Widget das Tagesziel aus der App lesen kann:

1. Target `StepsApp` → **Signing & Capabilities** → **+ Capability** → *App Groups*
2. Gruppe hinzufügen: `group.com.example.stepswidget`  
   *(oder deine eigene: `group.de.deinname.stepswidget`)*
3. Dasselbe für `StepsWidgetExtension` wiederholen
4. Den App-Group-Identifier in `HealthKitManager.swift` und `StepsProvider.swift` anpassen:
   ```swift
   private static let appGroup = "group.com.example.stepswidget"
   ```

### 3. HealthKit-Berechtigung

Die App fragt beim ersten Start automatisch nach HealthKit-Zugriff.  
Das Widget fordert die Berechtigung ebenfalls beim ersten Aktualisieren an.

> **Hinweis:** Der iOS-Simulator enthält **keine** HealthKit-Daten.  
> Zum Testen ein **echtes Gerät** verwenden oder die Simulator-Health-App zum Eintragen von Schritten nutzen.

## Architektur

```
┌─────────────────────────────────┐     App Group UserDefaults
│           StepsApp              │ ───────────────────────────────┐
│  HealthKitManager (@MainActor)  │  schreibt stepGoal             │
│  ├─ requestAuthorization()      │                                 │
│  ├─ fetchTodaySteps() async     │                                 ▼
│  └─ updateGoal(_:) → WidgetCenter.reloadTimelines()   ┌──────────────────────┐
└─────────────────────────────────┘                     │  StepsWidgetExtension │
                                                        │  StepsProvider        │
HealthKit Store                                         │  ├─ liest stepGoal   │
     │ HKStatisticsQuery (stepCount)                    │  └─ HKStatisticsQuery │
     └──────────────────────────────────────────────────┤                       │
                                                        │  StepsWidget (Views)  │
                                                        └──────────────────────┘
```

## Widget-Aktualisierung

Das Widget aktualisiert sich automatisch alle **15 Minuten** (WidgetKit policy).  
Wenn der Nutzer das Tagesziel in der App ändert, wird das Widget sofort neu geladen:

```swift
WidgetCenter.shared.reloadTimelines(ofKind: "StepsWidget")
```

## Lokalisierung

Alle Texte sind auf Deutsch. Für andere Sprachen können die Strings in eine  
`Localizable.xcstrings`-Datei extrahiert werden (`SWIFT_EMIT_LOC_STRINGS = YES` ist gesetzt).
