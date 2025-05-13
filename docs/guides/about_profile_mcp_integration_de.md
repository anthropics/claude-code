# Integration von .about-Profil und Model Context Protocol (MCP)

## 1. Einführung

Das `.about`-Profil und das Model Context Protocol (MCP) bilden zwei Kernkomponenten des VibeCodingFrameworks, die zusammen eine personalisierte und kontextbewusste KI-Erfahrung ermöglichen. Dieses Dokument erläutert die Struktur, Implementierung und Integration dieser Komponenten.

### 1.1 Das .about-Profil

Das `.about`-Profil ist ein strukturiertes Dokument, das persönliche Informationen, Präferenzen, Expertise und Ziele eines Benutzers oder Agenten enthält. Es dient als zentrale Datenquelle für die Personalisierung von KI-Interaktionen und die Anpassung der Benutzeroberfläche an individuelle Vorlieben.

### 1.2 Das Model Context Protocol (MCP)

Das Model Context Protocol ist ein Standardprotokoll zur Bereitstellung und Verwaltung von Kontext für KI-Modelle wie Claude. Es ermöglicht Modellen, auf kontrollierte Weise auf externe Informationen zuzugreifen, die über ihren ursprünglichen Trainingsdatensatz hinausgehen, und so fundierte, personalisierte und kontextbezogene Antworten zu generieren.

### 1.3 Zusammenspiel

Die Integration von `.about`-Profil und MCP ermöglicht es:
- KI-Modellen, personalisierte Antworten basierend auf Benutzerpräferenzen zu generieren
- Eine einheitliche Visualisierungssprache in allen Ausgaben zu gewährleisten
- Antworten auf die technische Expertise und Ziele des Benutzers zuzuschneiden
- Debugging- und Code-Vorschläge an die bevorzugten Arbeitsabläufe anzupassen

## 2. Struktur und Felder des .about-Profils

Das `.about`-Profil wird als JSON-Dokument gespeichert und umfasst folgende Hauptbereiche:

### 2.1 Struktur-Übersicht

```json
{
  "user_id": "user-12345",
  "name": "Alice Schmidt",
  "goals": [
    "KI-basierte Codeverbesserung",
    "Automatisierung von Tests",
    "Debugging-Effizienz steigern"
  ],
  "companies": ["TechInnovation GmbH"],
  "preferences": {
    "theme": "dark",
    "lang": "de",
    "colorScheme": {
      "primary": "#bb86fc",
      "secondary": "#03dac6",
      "accent": "#cf6679",
      "success": "#4caf50",
      "warning": "#ff9800",
      "danger": "#cf6679",
      "info": "#2196f3",
      "background": "#121212",
      "surface": "#1e1e1e",
      "text": "#ffffff",
      "textSecondary": "#b0b0b0",
      "border": "#333333"
    }
  },
  "expertise": [
    "javascript",
    "python",
    "recursion",
    "database-design"
  ],
  "debug_preferences": {
    "strategy": "bottom-up",
    "detail_level": "high",
    "auto_fix": true
  },
  "is_agent": true
}
```

### 2.2 Felddetails

#### 2.2.1 Kernfelder

- **user_id**: Eindeutige Benutzerkennung
- **name**: Vollständiger Name des Benutzers
- **goals**: Berufliche oder projektbezogene Ziele als Array
- **companies**: Zugehörige Unternehmen oder Organisationen
- **is_agent**: Flag, das angibt, ob das Profil für einen Agenten (true) oder einen menschlichen Benutzer (false) bestimmt ist

#### 2.2.2 Expertenfelder

- **expertise**: Technische Bereiche, in denen der Benutzer Fachwissen besitzt, als Array von Strings

#### 2.2.3 Präferenzen

- **preferences.theme**: UI-Theme ("light" oder "dark")
- **preferences.lang**: Bevorzugte Sprache ("de" oder "en")
- **preferences.colorScheme**: Benutzerdefiniertes Farbschema mit Farben für verschiedene UI-Elemente

#### 2.2.4 Debugging-Präferenzen

- **debug_preferences.strategy**: Bevorzugte Debugging-Methodik ("bottom-up" oder "top-down")
- **debug_preferences.detail_level**: Detaillierungsgrad bei Debugging-Berichten ("low", "medium", "high")
- **debug_preferences.auto_fix**: Ob Fehler automatisch behoben werden sollen, wenn möglich (Boolean)

#### 2.2.5 Optionale erweiterte Felder

- **learning_preferences**: Lernstil-Präferenzen des Benutzers
- **work_environment**: Details zur technischen Arbeitsumgebung
- **project_context**: Informationen über den Projektkontext des Benutzers

## 3. Erstellung und Bearbeitung eines .about-Profils

### 3.1 Interaktive Erstellung

Das VibeCodingFramework bietet ein interaktives Kommandozeilenwerkzeug zur Erstellung eines `.about`-Profils:

```bash
node scripts/setup/create_about.js
```

Dieser interaktive Wizard führt durch alle erforderlichen Schritte:

1. **Persönliche Informationen**: Name, Ziele, Unternehmen
2. **Expertise**: Technische Bereiche und Erfahrungsstufen
3. **Debugging-Präferenzen**: Strategie, Detaillierungsgrad, Automatisierung
4. **UI-Präferenzen**: Theme, Sprache, Farbschema

### 3.2 Webbasierte Bearbeitung

Im VibeCodingFramework ist auch eine webbasierte Benutzeroberfläche zur Bearbeitung des `.about`-Profils verfügbar:

1. Navigieren Sie zu `/profile/about` in der Webanwendung
2. Bearbeiten Sie die verschiedenen Abschnitte des Profils
3. Die Änderungen werden automatisch gespeichert und sofort angewendet

### 3.3 Manuelle Bearbeitung

Sie können das `.about`-Profil auch manuell bearbeiten, indem Sie die JSON-Datei direkt ändern:

```bash
# Öffnen Sie die Datei in einem Texteditor
vi ~/.claude/user.about.json

# Validieren Sie die Datei gegen das Schema
node scripts/validate_about_profile.js
```

## 4. Integration von .about-Profil und MCP

### 4.1 Architektur-Übersicht

Die Integration zwischen dem `.about`-Profil und dem MCP folgt einer geschichteten Architektur:

```
+------------------+     +---------------------+
| .about-Profil    |     | Farbschema          |
| - Benutzerinfo   |     | - Primärfarben      |
| - Ziele          |     | - Statusfarben      |
| - Expertise      |     | - Hintergrundfarben |
+--------+---------+     +---------+-----------+
         |                         |
         v                         v
+------------------+     +---------------------+
| Profil-Manager   |     | Schema-Manager      |
| create_about.js  |     | color_schema_mgr.js |
+--------+---------+     +---------+-----------+
         |                         |
         v                         v
+--------------------------------------------+
|           MCP-Client                       |
|    - Lädt Profil aus Config-Manager        |
|    - Reichert Prompts mit Profildaten an   |
+--------------------+---------------------+
                     |
                     v
+--------------------------------------------+
|           Claude/MCP-Integration           |
|    - Sendet angereicherte Prompts          |
|    - Verarbeitet und formatiert Antworten  |
+--------------------------------------------+
```

### 4.2 Implementierungsdetails

#### 4.2.1 Profilbereitstellung über MCP

Das `.about`-Profil wird über MCP bereitgestellt, indem ein MCP-Tool definiert wird:

```json
// .claude/mcp_tools.json
{
  "tools": [
    {
      "name": "user_profile_context",
      "description": "Stellt den .about-Profilkontext des aktuellen Nutzers über MCP bereit.",
      "mcp_endpoint": "/api/mcp/user_profile",
      "schema_path": "specs/json_schema/about_profile_mcp.json",
      "authentication_required": true
    }
  ]
}
```

Die API-Route `api/mcp/user_profile` implementiert die Logik zum Abrufen des Profils:

```javascript
// src/app/api/mcp/user_profile/route.ts
export async function GET(request: Request) {
  // Authentifizierung und Benutzerkontext prüfen
  const user = await getUserContext(request);
  if (!user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // .about-Profil laden
  let userAbout = {};
  try {
    if (supabase) {
      const { data } = await supabase
        .from('profiles')
        .select('about')
        .eq('id', user.id)
        .single();
      
      if (data && data.about) {
        userAbout = data.about;
      }
    }
  } catch (err) {
    console.error(`Fehler beim Laden des .about-Profils: ${err.message}`);
    return Response.json({ error: "Interner Serverfehler" }, { status: 500 });
  }

  // MCP-Antwort formatieren
  return Response.json(userAbout);
}
```

#### 4.2.2 Anreicherung von Claude-Prompts

Die Claude-Integration reichert Prompts mit dem `.about`-Profil an:

```javascript
// Snippet aus core/mcp/claude_integration.js
async generateClaudeResponse(
  query: string,
  systemMessage: string = '',
  userAbout: Record<string, any> = {}
): Promise<string> {
  try {
    // Benutzerkontext in die Anfrage integrieren
    let fullPrompt = query;
    
    if (userAbout && Object.keys(userAbout).length > 0) {
      fullPrompt = `
BENUTZER-PROFIL:
${JSON.stringify(userAbout, null, 2)}

ANFRAGE: ${query}
`;
    }

    // Antwort von Claude generieren
    const response = await anthropic.messages.create({
      model: this.claudeModel,
      max_tokens: 1024,
      system: systemMessage,
      messages: [
        { role: 'user', content: fullPrompt }
      ]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Fehler beim Generieren der Claude-Antwort:', error);
    throw error;
  }
}
```

#### 4.2.3 Prompt-Vorlagen für `.about`-Integration

Um sicherzustellen, dass das `.about`-Profil konsistent in allen Claude-Interaktionen verwendet wird, werden Prompt-Vorlagen verwendet:

```javascript
// Beispiel-Prompt-Vorlage
const claudePrompt = `
<instructions>
Du bist ein Agent im Claude Neural Framework, der für ${userAbout.name} arbeitet.

## Benutzerprofil
Name: ${userAbout.name}
Ziele: ${userAbout.goals.join(', ')}
Expertise: ${userAbout.expertise.join(', ')}
Debugging-Strategie: ${userAbout.debug_preferences.strategy}

## Farbschema
Verwende bei allen generierten Inhalten das folgende Farbschema:
- Primär: ${userAbout.preferences.colorScheme.primary}
- Sekundär: ${userAbout.preferences.colorScheme.secondary}
- Akzent: ${userAbout.preferences.colorScheme.accent}
- Hintergrund: ${userAbout.preferences.colorScheme.background}
- Text: ${userAbout.preferences.colorScheme.text}

Passe deine Antworten an die Ziele, Expertise und Vorlieben des Benutzers an.
Stelle sicher, dass alle UI-Elemente, Visualisierungen und Codebeispiele dem definierten Farbschema folgen.
</instructions>

${userPrompt}
`;
```

### 4.3 Beispiel: Angepasste Debugging-Ausgabe

Ein Beispiel für eine an das `.about`-Profil angepasste Claude-Antwort:

```html
<div class="debug-report" style="background-color: #1e1e1e; color: #ffffff; border: 1px solid #333333; padding: 16px; border-radius: 8px;">
  <h3 style="color: #bb86fc;">Analyse der rekursiven Funktion</h3>
  
  <div class="issue-card" style="border-left: 4px solid #cf6679; padding: 8px; margin-bottom: 12px;">
    <h4 style="color: #cf6679;">Stack Overflow erkannt</h4>
    <p>Der rekursiven Funktion fehlt ein korrekter Basisfall, was zu einer unendlichen Rekursion führt.</p>
    <pre style="background: #121212; color: #b0b0b0; padding: 8px;">function fakultaet(n) {
  return n * fakultaet(n - 1); // Fehlender Basisfall
}</pre>
  </div>
  
  <div class="suggestion-card" style="border-left: 4px solid #03dac6; padding: 8px;">
    <h4 style="color: #03dac6;">Lösungsvorschlag</h4>
    <p>Fügen Sie einen Basisfall hinzu, um unendliche Rekursion zu verhindern:</p>
    <pre style="background: #121212; color: #b0b0b0; padding: 8px;">function fakultaet(n) {
  if (n <= 1) return 1; // Basisfall
  return n * fakultaet(n - 1);
}</pre>
  </div>
  
  <button style="background-color: #bb86fc; color: #000000; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Fix anwenden</button>
</div>
```

## 5. Best Practices für die Verwendung des .about-Profils mit MCP

### 5.1 Profilerstellung und -verwaltung

1. **Vollständige Profile**: Stellen Sie sicher, dass sowohl das `.about`-Profil als auch das Farbschema vollständig konfiguriert sind
2. **Interaktive Einrichtung**: Nutzen Sie die interaktiven Einrichtungswerkzeuge für personalisierte Profile:
   ```bash
   node scripts/setup/create_about.js
   node scripts/setup/setup_user_colorschema.js
   ```
3. **Kombinierte Einrichtung**: Für eine vollständige Projekteinrichtung inklusive Profil und Farbschema:
   ```bash
   node scripts/setup/setup_project.js
   ```
4. **Regelmäßige Aktualisierung**: Aktualisieren Sie die Profile basierend auf Feedback und Änderungen der Benutzerpräferenzen
5. **Barrierefreiheit prüfen**: Stellen Sie sicher, dass das gewählte Farbschema ausreichenden Kontrast bietet

### 5.2 Prompt-Engineering mit Profilen

1. **Strukturierte Metadaten**: Integrieren Sie Profildaten in einem strukturierten, konsistenten Format
2. **Explizite Anweisungen**: Geben Sie explizite Anweisungen, wie das Profil die Antworten beeinflussen soll
3. **Prägnantes Format**: Halten Sie Profilinformationen prägnant und relevant für die Aufgabe
4. **Konsistente Anwendung**: Verwenden Sie Profildaten in allen Agenten-Interaktionen
5. **Kontextuelle Relevanz**: Integrieren Sie nur Profilelemente, die für die aktuelle Anfrage relevant sind

### 5.3 Antwortformatierung

1. **Konsistente Gestaltung**: Wenden Sie das Farbschema konsistent auf alle generierten Inhalte an
2. **Adaptive Inhalte**: Passen Sie die technische Tiefe basierend auf dem Expertise-Level des Benutzers an
3. **Zielorientierung**: Stellen Sie sicher, dass Antworten die angegebenen Ziele des Benutzers unterstützen
4. **Debugging-Ansatz**: Folgen Sie der bevorzugten Debugging-Strategie des Benutzers bei der Problemlösung
5. **Sprachpräferenz**: Respektieren Sie die Sprachpräferenz des Benutzers

### 5.4 Sicherheitsaspekte

1. **Lokale Speicherung**: Profile werden lokal im Heimverzeichnis des Benutzers gespeichert
2. **Sichere Übertragung**: Stellen Sie eine sichere Übertragung sicher, wenn Profildaten an API-Endpunkte gesendet werden
3. **Selektive Freigabe**: Teilen Sie nur notwendige Profilinformationen mit jedem Prompt
4. **Keine sensiblen Daten**: Vermeiden Sie die Speicherung sensibler Informationen wie API-Schlüssel im Profil
5. **Authentifizierung**: Implementieren Sie robuste Authentifizierungs- und Autorisierungsmechanismen für MCP-Endpunkte

## 6. Fazit

Die Integration von `.about`-Profil und Model Context Protocol (MCP) bildet eine leistungsstarke Grundlage für personalisierte KI-Erlebnisse im VibeCodingFramework. Durch die Verbindung von Benutzerpräferenzen, Expertise, Zielen und visueller Gestaltung über das MCP ermöglicht das Framework KI-Modellen, Antworten zu generieren, die auf die individuellen Bedürfnisse jedes Benutzers zugeschnitten sind.

Diese Architektur gewährleistet eine konsistente Personalisierung über verschiedene Komponenten des Frameworks hinweg und behält gleichzeitig eine klare Trennung der Zuständigkeiten zwischen Benutzerprofilen, Farbschemata und KI-Interaktionslogik bei. Entwicklungsteams können diese Integration erweitern, um zusätzliche Personalisierungsparameter zu unterstützen oder die Integration mit anderen MCP-Servern für erweiterte Funktionalität zu implementieren.

Durch Befolgung der in diesem Dokument beschriebenen Best Practices können Entwickler hochpersonalisierte KI-Erlebnisse schaffen, die die Privatsphäre und Sicherheit der Benutzer wahren und gleichzeitig eine intuitive und konsistente Schnittstelle für die Arbeit mit KI-Modellen im Entwicklungsworkflow bieten.