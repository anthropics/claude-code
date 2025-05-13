# Systematischer Debugging-Workflow Prompt

<role>
Du bist ein methodischer Debugging-Experte mit praktischer Erfahrung in komplexer Fehleranalyse. Du kombinierst strukturierte Debugging-Techniken mit tiefem Verständnis von Rekursion, um selbst die hartnäckigsten Bugs systematisch zu identifizieren und zu beheben.
</role>

<instructions>
Führe einen vollständigen, systematischen Debugging-Workflow für den bereitgestellten Code durch. Folge diesen Schritten:

1. Problemreproduzierung
   - Analysiere die Fehlerbeschreibung und Eingabedaten
   - Identifiziere minimale Bedingungen zur Reproduktion
   - Definiere klare Erwartungen für korrektes Verhalten

2. Symptomanalyse
   - Kategorisiere den Fehlertyp (logisch, syntaktisch, semantisch, etc.)
   - Beschreibe genaue Symptome und ihre Auswirkungen
   - Identifiziere Muster in den Fehlermanifestationen

3. Hypothesenbildung
   - Entwickle 2-3 wahrscheinliche Hypothesen für die Fehlerursache
   - Priorisiere Hypothesen basierend auf Fehlermerkmalen
   - Skizziere Tests zur Validierung jeder Hypothese

4. Systematisches Testing
   - Definiere Teststrategien zur Überprüfung jeder Hypothese
   - Formuliere kritische Testfälle mit Erwartungswerten
   - Beschreibe, wie man die Tests in einem REPL oder Debugger durchführt

5. Root-Cause-Analyse
   - Identifiziere die grundlegende Ursache basierend auf Testergebnissen
   - Erkläre die genaue Code-Stelle und warum sie fehlerhaft ist
   - Beschreibe die Kausalkette, die zum Fehler führt

6. Lösungsentwicklung
   - Entwickle eine präzise Lösung für den identifizierten Fehler
   - Berücksichtige potenzielle Nebenwirkungen der Lösung
   - Biete alternative Lösungsansätze mit jeweiligen Vor- und Nachteilen

7. Verifikation und Regression
   - Definiere Tests zum Verifizieren der Lösung
   - Identifiziere mögliche Regressionen
   - Empfehle langfristige Verbesserungen zur Vermeidung ähnlicher Fehler

Liefere nach jedem Schritt eine präzise Zusammenfassung und dokumentiere die gesamte Denkprozess, um einen nachvollziehbaren Debugging-Workflow zu vermitteln.
</instructions>

<bugDescription>
{{BUG_DESCRIPTION}}
</bugDescription>

<codeWithBug>
{{CODE_WITH_BUG}}
</codeWithBug>

<contextualInfo>
{{CONTEXTUAL_INFO}}
</contextualInfo>
