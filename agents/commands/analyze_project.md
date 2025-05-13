# Projekt-Analyse mit Neural-RAG-Integration

Führt eine vollständige Analyse des Projekts durch, erkennt rekursive Muster, optimiert vorhandenen Code und generiert detaillierte Berichte mit Neural-RAG-Unterstützung.

## Verwendung
/analyze-project $ARGUMENTE

## Parameter
- path: Pfad zum Projekt (Standard: aktuelles Verzeichnis)
- depth: Analysetiefe [quick, standard, deep, exhaustive] (Standard: standard)
- focus: Fokus der Analyse [all, recursive, performance, security] (Standard: all)
- report: Report-Format [summary, detailed, interactive, dashboard] (Standard: detailed)
- threshold: Schwellenwert für Warnungen (1-10, Standard: 5)
- include-deps: Auch Abhängigkeiten analysieren (Standard: false)
- branch: Spezifischen Git-Branch analysieren (Optional)
- neural-boost: Tiefe des neuralen Netzwerkabgleichs (1-10, Standard: 8)

## Beispiel
/analyze-project --path=~/mein-projekt --depth=deep --focus=recursive --report=dashboard --neural-boost=10

Der Befehl wird:
1. Eine tiefe strukturelle Analyse des gesamten Projekts durchführen
2. Alle rekursiven Muster identifizieren und klassifizieren
3. Code-Performance und Komplexität bewerten
4. Optimierungspotenziale mit konkreten Verbesserungsvorschlägen aufzeigen
5. Ähnliche Codemuster im neuralen Netzwerk suchen und vergleichen
6. Einen interaktiven Dashboard-Report generieren
7. Automatisch Fixes für kritische Probleme vorschlagen

## Neural-RAG-Integration
Die Analyse nutzt eine bidirektionale RAG-Integration:
- Abfragen der Vektordatenbank für ähnliche Codemuster
- Vergleich mit erfolgreich gelösten Rekursionsproblemen
- Automatisches Lernen aus früheren Optimierungen
- Projektkontextbewusstes Embedding mit semantischer Codeanalyse
- Sprachübergreifende Musterübertragung (z.B. Python → JavaScript)

## Dashboard-Features
Bei Auswahl des Dashboard-Formats enthält der Report:
- Interaktive Heatmap der Rekursionskomplexität
- Callgraph-Visualisierung mit Rekursionspfaden
- Performance-Benchmarks mit Optimierungspotenzialen
- Codequalitäts-Metriken im Zeit- und Projektvergleich
- Empfehlungs-Engine für Best Practices

## Report-Integration
Der generierte Report kann automatisch in folgende Systeme integriert werden:
- GitHub/GitLab als Wiki oder Issue
- Jira als Ticket mit Anhängen
- Slack/Teams als interaktive Nachricht
- E-Mail-Zusammenfassung mit Link zum vollständigen Report
- CI/CD-Pipeline als Quality Gate

Die Analyse verwendet den Benutzerkontext aus dem .about-Profil, um die Ergebnisse auf die Entwicklerpräferenzen abzustimmen und projekt-spezifische Empfehlungen zu geben.
