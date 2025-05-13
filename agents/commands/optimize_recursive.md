# Optimize Recursive Command

Analysiert und optimiert rekursive Algorithmen für bessere Performance, Speichereffizienz und Robustheit.

## Verwendung
/optimize-recursive $ARGUMENTE

## Parameter
- file: Dateipfad zum zu optimierenden rekursiven Code (erforderlich)
- constraints: Performance- oder Speicherbeschränkungen (optional)
- strategy: Optimierungsstrategie [memoization, tail-call, iterative, parallel] (default: auto)
- test-cases: Pfad zu Testfällen (optional)
- measure: Was gemessen werden soll [time, memory, calls, all] (default: all)
- output: Ausgabeformat [diff, side-by-side, full-rewrite] (default: diff)

## Beispiel
/optimize-recursive file=src/algorithms/fibonacci.js strategy=memoization constraints="max_memory=100MB,max_time=50ms" test-cases=tests/fib_cases.json

Der Befehl wird:
1. Die gegebene rekursive Implementierung analysieren
2. Die aktuelle Zeit- und Raumkomplexität bestimmen
3. Überlappende Teilprobleme für Memoization identifizieren
4. Tail-Call-Optimierungspotential prüfen
5. Möglichkeiten zur iterativen Umformung untersuchen
6. Eine optimierte Version mit der gewählten Strategie erstellen
7. Leistungsvergleich zwischen Original und optimierter Version durchführen

## Optimierungsstrategien
- memoization: Implementiert Caching für Zwischenergebnisse
- tail-call: Optimiert für Tail-Call-Elimination
- iterative: Wandelt Rekursion in eine iterative Lösung um
- parallel: Analysiert Möglichkeiten zur Parallelisierung
- auto: Wählt die beste Strategie basierend auf der Codeanalyse

Ergebnisse beinhalten optimierten Code, Performance-Vergleich, erwartete Verbesserungen und detaillierte Erklärungen aller vorgenommenen Optimierungen.
