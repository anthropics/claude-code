# Bug Hunt Command

Führt eine umfassende, mehrstufige Bug-Jagd in komplexen Codebases mit besonderem Fokus auf rekursive Strukturen durch.

## Verwendung
/bug-hunt $ARGUMENTE

## Parameter
- path: Dateipfad oder Verzeichnis für die Analyse (erforderlich)
- depth: Analysetiefe [quick, standard, deep] (default: standard)
- focus: Fokus der Analyse [recursive, memory, logic, concurrency, all] (default: all)
- output: Ausgabeformat [report, inline, fixes] (default: report)
- context: Zusätzliche Kontextinformationen (optional)
- issues: Beschreibung bekannter Probleme (optional)
- patterns: Zu suchende Problemmuster (optional)

## Beispiel
/bug-hunt path=src/algorithms/ focus=recursive depth=deep output=fixes patterns=stack-overflow,infinite-loop

Der Befehl wird:
1. Eine statische Analyse des gesamten Codes durchführen
2. Alle rekursiven Strukturen identifizieren und analysieren
3. Kontrollflussverfolgung für jede rekursive Funktion durchführen
4. Datenflussanalyse zur Identifikation unbeabsichtigter Mutationen durchführen
5. Fehlerwahrscheinlichkeit verschiedener Codeteile bewerten
6. Einen priorisierten Bug-Katalog erstellen
7. Konkrete Fixes für identifizierte Probleme vorschlagen

## Analysearten
- Statische Analyse: Identifiziert problematische Codemuster
- Kontrollflussverfolgung: Analysiert alle möglichen Ausführungspfade
- Datenflussanalyse: Verfolgt Datentransformationen
- Fehlerwahrscheinlichkeitsanalyse: Priorisiert potentielle Problemstellen
- Fix-Generierung: Liefert konkrete Lösungsvorschläge

Ergebnisse werden in einem detaillierten Bericht mit priorisierten Bugs, konkreten Fix-Vorschlägen, Teststrategien und langfristigen Verbesserungsempfehlungen geliefert.
