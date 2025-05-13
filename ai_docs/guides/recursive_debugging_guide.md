# Leitfaden zum Debuggen rekursiver Fehler mit Claude Code CLI

Dieser Leitfaden zeigt, wie Sie die Claude Code CLI effektiv für das Auffinden, Analysieren und Beheben von Fehlern in rekursiven Codestrukturen einsetzen.

## Einführung

Rekursive Algorithmen sind mächtige Werkzeuge, aber sie können komplexe Fehler verursachen, die schwer zu identifizieren und zu beheben sind. Die Claude Code CLI, kombiniert mit spezialisierten Prompts, bietet einen systematischen Ansatz zur Lösung solcher Probleme.

## Verfügbare Debugging-Prompts

Das Framework stellt fünf spezialisierte Prompt-Templates für unterschiedliche Debugging-Szenarien bereit:

1. **Rekursive Bug-Analyse** (`/docs/prompts/recursive_bug_analysis.md`)  
   Für die systematische Analyse von Problemen in rekursiven Algorithmen mit Fokus auf Abbruchbedingungen, Stack-Management und Rekursionsfortschritt.

2. **Stack Overflow Debugging** (`/docs/prompts/stack_overflow_debugging.md`)  
   Spezialisiert auf die Analyse und Behebung von Stack Overflow Fehlern in rekursiven Strukturen.

3. **Rekursive Optimierung** (`/docs/prompts/recursive_optimization.md`)  
   Für die Optimierung rekursiver Algorithmen hinsichtlich Performance, Speicherverbrauch und Stabilität.

4. **Komplexer Bug Hunt** (`/docs/prompts/complex_bug_hunt.md`)  
   Für die umfassende Jagd nach versteckten Fehlern in komplexen rekursiven Systemen durch mehrstufige Analyse.

5. **Systematischer Debugging-Workflow** (`/docs/prompts/systematic_debugging_workflow.md`)  
   Ein strukturierter, schrittweiser Ansatz zur methodischen Fehlersuche und -behebung.

## Anwendungsbeispiele

### Beispiel 1: Rekursiven Stack Overflow beheben

```bash
# Angenommen, Ihre Funktion verursacht einen Stack Overflow
claude-cli debug recursive --template stack_overflow_debugging --file recursive_function.js
```

### Beispiel 2: Langsamen rekursiven Algorithmus optimieren

```bash
# Für einen funktionierenden, aber ineffizienten rekursiven Algorithmus
claude-cli optimize --template recursive_optimization --file slow_algorithm.py --constraints "max runtime: 100ms"
```

### Beispiel 3: Systematischen Debugging-Workflow durchführen

```bash
# Für komplexe Bugs in rekursiven Strukturen
claude-cli workflow --template systematic_debugging_workflow --file buggy_system.js --description "Sporadischer Fehler bei tiefer Rekursion mit großen Arrays"
```

## Best Practices

1. **Eingabedaten vorbereiten**
   - Stellen Sie minimale Testfälle bereit, die den Fehler reproduzieren
   - Inkludieren Sie Edge Cases und Grenzwerte
   - Dokumentieren Sie erwartetes vs. tatsächliches Verhalten

2. **Kontext bereitstellen**
   - Fügen Sie relevanten Systemkontext hinzu
   - Beschreiben Sie die Funktion im größeren Zusammenhang
   - Erklären Sie den Zweck der rekursiven Implementation

3. **Iterativer Prozess**
   - Beginnen Sie mit allgemeiner Analyse und vertiefen Sie sich
   - Validieren Sie Fixes inkrementell
   - Verwenden Sie unterschiedliche Prompt-Templates für verschiedene Phasen

## Prompt-Anpassung

Sie können die Prompt-Templates an Ihre spezifischen Bedürfnisse anpassen:

1. Editieren Sie die Markdown-Dateien im `/docs/prompts/` Verzeichnis
2. Passen Sie die Anweisungen und Fokusbereiche an
3. Fügen Sie spezifische Prüfpunkte für Ihre Codebasis hinzu

### Beispiel für eine Prompt-Anpassung:

```markdown
<instructions>
# Original-Anweisungen + spezifische Anforderungen
...
# Zusätzliche projektspezifische Prüfungen
- Prüfe auf Inkompatibilitäten mit dem XYZ-Framework
- Stelle sicher, dass die ABC-Datenbankschnittstelle korrekt verwendet wird
- Validiere die Rekursion gegen Max-Tiefe von 500 (Systemlimit)
</instructions>
```

## Fortgeschrittene Techniken

### 1. Multi-Stage-Debugging

Kombinieren Sie mehrere Prompt-Templates in einer Pipeline:
```bash
claude-cli pipeline --templates "recursive_bug_analysis,recursive_optimization" --file complex_function.js
```

### 2. Komparative Analyse

Vergleichen Sie verschiedene Implementierungen:
```bash
claude-cli compare --template recursive_optimization --files "impl_v1.py,impl_v2.py" --metrics "speed,memory,stability"
```

### 3. Automatisierte Regression-Tests

Generieren Sie Test-Suites für gefundene Bugs:
```bash
claude-cli generate-tests --template complex_bug_hunt --file fixed_function.js --bugs-file bug_report.json
```

## Fazit

Die Kombination aus Claude Code CLI und spezialisierten Debugging-Prompts bietet einen mächtigen Ansatz zur Lösung komplexer rekursiver Fehler. Der strukturierte Prozess hilft, selbst hartnäckige Bugs systematisch zu identifizieren und zu beheben, während die KI-Unterstützung tiefe Einblicke in komplexe Algorithmen ermöglicht.
