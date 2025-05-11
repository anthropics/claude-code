# Interaktives Farbschema für die Benutzeroberfläche festlegen

Ermöglicht Benutzern, ein konsistentes Farbschema für alle UI-Komponenten festzulegen, das automatisch auf alle neu generierten Benutzeroberflächen angewendet wird.

## Verwendung
/set-color-schema $ARGUMENTE

## Parameter
- interactive: Interaktive Erstellung mit Dialogen (Standard: true)
- output: Ausgabepfad für das Farbschema (Standard: ~/.claude/user.colorschema.json)
- template: Vorlage für das Farbschema (Optional: "light", "dark", "blue", "green", "purple")
- preview: Vorschau des Farbschemas anzeigen (Standard: true)
- apply: Farbschema sofort auf bestehende UI-Komponenten anwenden (Standard: false)

## Beispiel
/set-color-schema --interactive=true --template="dark" --apply=true

## Interaktive Erfahrung
Bei interaktiver Erstellung führt der Befehl durch einen mehrstufigen Dialog:

1. **Basis-Thema wählen**
   - Light, Dark, Blue, Green, Purple als Ausgangspunkt
   - Präsentation von Beispielen für jedes Thema
   - Möglichkeit zur Anpassung ausgewählter Farben

2. **Primäre Farben**
   - Primärfarbe (für Hauptelemente, Überschriften, Navigation)
   - Sekundärfarbe (für Akzente, Hervorhebungen)
   - Tertiärfarbe (für spezielle Elemente)

3. **Status-Farben**
   - Erfolg (für erfolgreiche Operationen)
   - Warnung (für Warnungen)
   - Gefahr (für Fehler oder kritische Situationen)
   - Information (für Informationsmeldungen)

4. **Neutrale Farben**
   - Hintergrundfarbe
   - Textfarbe
   - Rahmenfarbe
   - Schatten-/Overlay-Farbe

5. **Vorschau und Bestätigung**
   - Anzeige des gewählten Farbschemas in verschiedenen UI-Komponenten
   - Möglichkeit zur Anpassung einzelner Farben
   - Bestätigung und Speicherung

## Farbschema-Funktionen
Das erstellte Farbschema ermöglicht:

- Konsistente Farbgebung in allen generierten UI-Komponenten
- Automatische Anwendung auf neue Dashboards, Formulare und Visualisierungen
- Personalisierte Benutzeroberfläche, die den Vorlieben des Benutzers entspricht
- Einhaltung von Barrierefreiheitsstandards (WCAG) für ausgewählte Farbkombinationen
- Nahtlose Integration in das Design-System des Claude Neural Framework

Das Farbschema wird in einer JSON-Datei gespeichert und automatisch von allen UI-Generierungstools der Plattform verwendet. Entwickler können das Schema über eine einfache API abrufen und in ihre eigenen Komponenten integrieren.

## Technische Details
Das Farbschema wird als CSS-Variablen definiert und kann als:
- CSS-Datei
- JSON-Konfiguration
- SCSS-Variablen
- JavaScript-Konstanten

exportiert werden, um maximale Flexibilität in verschiedenen Entwicklungsumgebungen zu gewährleisten.