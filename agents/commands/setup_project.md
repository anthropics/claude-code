# Projekteinrichtung im interaktiven Dialog

Richtet ein neues oder bestehendes Projekt ein und konfiguriert die interaktiven Einstellungen inklusive Farbschema und Benutzerprofile. Integriert rekursives Debugging und Vektordatenbank-Funktionalität.

## Verwendung
/setup-project $ARGUMENTE

## Parameter
- path: Pfad zum Projekt (Standard: aktuelles Verzeichnis)
- languages: Zu unterstützende Programmiersprachen (Standard: js,py,ts,java,cpp)
- profile: Pfad zur Benutzerprofilvorlage (optional)
- color_schema: Farbschema für UI-Komponenten (Optional: "light", "dark", "blue", "green", "purple")
- template: Projektvorlage (Optional: "web", "api", "cli", "library")
- auto-triggers: Automatische Trigger aktivieren (Standard: true)
- ci-integration: CI/CD-Integration aktivieren (Standard: false)
- vector-db: Vektordatenbank-Typ (Standard: lancedb)

## Beispiel
/setup-project --path=~/mein-projekt --languages=js,py,java --color_schema="blue" --template="web" --auto-triggers=true

Der Befehl wird:
1. Die notwendigen Verzeichnisstrukturen im Projekt erstellen
2. CI/CD-Konfigurationen basierend auf dem Projekttyp generieren
3. Sprachspezifische Rekursions-Erkennungsmuster registrieren
4. Git-Hooks für automatisches Debugging einrichten
5. Benutzerprofile für personalisierte Debugging-Erfahrungen erstellen
6. Vektordatenbank für sprachübergreifende Codeanalyse initialisieren
7. Auto-Trigger für Laufzeitfehler konfigurieren

## Unterstützte Sprachen
- JavaScript/TypeScript: Funktionsmuster, Stack-Überläufe, Memo-Optimierung
- Python: Dekorierer-Erkennung, RecursionError-Behandlung, Tiefenlimits
- Java: JVM-Stacktrace-Analyse, Methodenmuster, Reflektion-Hooks
- C/C++: Pointer-Analyse, Speicherlecks, Stack-Frame-Überwachung
- Rust: Pattern-Matching, Ownership-Tracking, Tailrec-Optimierung
- Go: Goroutine-Sicherheit, Kanalblockaden, Parallelismus-Analyse

## Integration
Der Befehl richtet folgende Integrationen ein:
- Eigenes VSCode-Plugin mit Statusleisten-Indikator
- Git-Hooks für Pre-Commit und Post-Merge
- CI/CD-Pipelines (GitHub Actions, GitLab CI, Jenkins)
- Container-basierte Isolationsumgebungen
- Cloud-Profiling mit automatischem Deployment

Nach der Einrichtung werden alle rekursiven Funktionen im Projekt identifiziert und in der Vektordatenbank indexiert.
