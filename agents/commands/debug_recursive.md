# Debug Recursive Command

Führt eine rekursive Fehleranalyse für den angegebenen Code durch, identifiziert Probleme und gibt strukturierte Lösungsvorschläge.

## Verwendung
/debug-recursive $ARGUMENTE

## Parameter
- file: Dateipfad zur zu analysierenden rekursiven Funktion (erforderlich)
- template: Zu verwendende Debugging-Vorlage (default: recursive_bug_analysis)
- trace: Stack-Trace bereitstellen (optional)
- expected: Erwartetes Verhalten beschreiben (optional)
- observed: Beobachtetes Verhalten beschreiben (optional)
- depth: Analysetiefe (default: deep)

## Beispiel
/debug-recursive file=src/algorithms/tree_traversal.js template=stack_overflow_debugging trace=error_log.txt depth=comprehensive

Der Befehl wird:
1. Die rekursive Funktion aus der angegebenen Datei analysieren
2. Die ausgewählte spezialisierte Debugging-Vorlage anwenden
3. Eine systematische Fehleranalyse durchführen
4. Nach Stack Overflow, fehlenden Abbruchbedingungen und anderen Rekursionsproblemen suchen
5. Präzise Fehleridentifikation und Lösungsvorschläge liefern
6. Optimierte Alternativimplementierungen vorschlagen

## Verfügbare Templates
- recursive_bug_analysis: Allgemeine rekursive Fehleranalyse
- stack_overflow_debugging: Spezialisiert auf Stack Overflow Probleme
- recursive_optimization: Fokus auf Performance-Optimierung
- complex_bug_hunt: Umfassende Bug-Jagd in komplexen Systemen
- systematic_debugging_workflow: Strukturierter Debugging-Prozess

Ergebnisse werden in einer strukturierten Ausgabe mit Fehleridentifikation, Ursachenanalyse, Lösungsvorschlägen und optimiertem Code zurückgegeben.
