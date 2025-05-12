# Interaktives Benutzerprofil erstellen

Erstellt oder aktualisiert ein interaktives .about-Profil für den Benutzer, das für personalisierte Debugging-Erfahrungen und kontextbewusste Analysen verwendet wird.

## Verwendung
/create-about $ARGUMENTE

## Parameter
- interactive: Interaktive Erstellung mit Dialogen (Standard: true)
- output: Ausgabepfad für das Profil (Standard: ~/.claude/user.about.json)
- template: Vorlage für das Profil (Optional)
- migrate: Vorhandene Konfigurationen migrieren (Standard: true)
- expertise: Liste von Kompetenzfeldern (Optional, z.B. "js,python,algorithms")
- preferences: Debugging-Präferenzen (Optional)

## Beispiel
/create-about --interactive=true --expertise="javascript,recursion,algorithms" --preferences="performance-focus"

## Interaktive Erfahrung
Bei interaktiver Erstellung führt der Befehl durch einen mehrstufigen Dialog:

1. **Persönliche Informationen**
   - Name und optionale Kontaktdaten
   - Bevorzugte Programmiersprachen
   - Erfahrungsgrad in verschiedenen Bereichen

2. **Arbeitsumgebung**
   - Bevorzugter Editor/IDE
   - Betriebssystem und Toolchain
   - CI/CD-Umgebung

3. **Debugging-Präferenzen**
   - Bevorzugte Debugging-Strategie (Bottom-Up vs. Top-Down)
   - Detaillierungsgrad von Reports
   - Automatisierungsgrad (manuell bis vollautomatisch)

4. **Projektkontext**
   - Aktuelle und frühere Projekte
   - Typische Architekturmuster
   - Teamgröße und Kollaborationsstil

5. **Lernpräferenzen**
   - Bevorzugte Lernressourcen
   - Feedback-Präferenzen
   - Adaption an neue Technologien

## Profil-Funktionen
Das erstellte Profil ermöglicht:

- Personalisierte Debugging-Workflows basierend auf Expertise
- Intelligente Vorschläge für Bugfixes und Optimierungen
- Automatische Anpassung der Analysetiefe an die Erfahrung
- Kontextbewusste RAG-Integration mit relevanten Beispielen
- Fortlaufende Verbesserung der Empfehlungen durch Feedback

Nach Erstellung wird das Profil für alle Debugging-Tools und Analysen genutzt, um eine optimale Erfahrung zu bieten. Jeder folgende Debug-Vorgang wird automatisch im Profil gespeichert, um das System kontinuierlich zu verbessern.
