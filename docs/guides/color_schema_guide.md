# Farbschema-System des Claude Neural Framework

Diese Anleitung erklärt, wie Sie das Farbschema-System des Claude Neural Framework verwenden und anpassen können, um eine konsistente Benutzeroberfläche für alle generierten Inhalte zu gewährleisten.

## Übersicht

Das Farbschema-System ermöglicht es Ihnen, ein konsistentes Farbschema für alle Komponenten des Claude Neural Framework festzulegen. Dies umfasst:

- UI-Komponenten wie Dashboards, Formulare und Visualisierungen
- Generierte Inhalte durch Claude und andere Agenten
- Reports und Dokumentation
- Prompt-Ausgaben und Codebeispiele

Das System ist vollständig anpassbar und wird automatisch auf alle neu generierten Inhalte angewendet.

## Interaktive Einrichtung

Die einfachste Methode zur Konfiguration Ihres Farbschemas ist der interaktive Setup-Assistent:

```bash
node scripts/setup/setup_user_colorschema.js
```

Der Assistent führt Sie durch die folgenden Schritte:

1. **Basis-Thema wählen**: Wählen Sie ein vordefiniertes Thema als Ausgangspunkt (Light, Dark, Blue, Green, Purple)
2. **Farben anpassen**: Passen Sie die Primärfarben, Statusfarben und Hintergrundfarben an
3. **Vorschau**: Sehen Sie eine Vorschau Ihres angepassten Farbschemas
4. **Speichern und Anwenden**: Speichern Sie das Farbschema und wenden Sie es auf bestehende UI-Komponenten an

## Verfügbare Themen

Das Framework bietet die folgenden vordefinierten Themen:

- **Light**: Helles Thema mit blauen Akzenten
- **Dark**: Dunkles Thema mit violetten Akzenten
- **Blue**: Blaues Thema mit hellblauen Akzenten
- **Green**: Grünes Thema mit hellgrünen Akzenten
- **Purple**: Violettes Thema mit pinken Akzenten

## Manuelle Konfiguration

Sie können das Farbschema auch manuell konfigurieren:

```bash
# Spezifisches Thema festlegen
node core/mcp/color_schema_manager.js --template=dark

# Farbschema auf bestehende UI-Komponenten anwenden
node core/mcp/color_schema_manager.js --template=light --apply=true

# Farbschema als CSS exportieren
node core/mcp/color_schema_manager.js --non-interactive --format=css
```

## Integration mit `.about`-Profil

Ihr Farbschema wird automatisch mit Ihrem `.about`-Profil integriert und im Verzeichnis `~/.claude/` gespeichert. Dies ermöglicht es Claude und anderen Agenten, Ihr Farbschema zu berücksichtigen, wenn sie Inhalte generieren.

Beispiel für ein `.about`-Profil mit Farbschema:

```json
{
  "user_id": "user-12345",
  "name": "Max Mustermann",
  "goals": ["KI-Anwendungen entwickeln"],
  "companies": ["Musterfirma GmbH"],
  "preferences": {
    "theme": "dark",
    "lang": "de",
    "colorScheme": {
      "primary": "#bb86fc",
      "secondary": "#03dac6",
      "accent": "#cf6679",
      "background": "#121212",
      "text": "#ffffff"
    }
  },
  "is_agent": true
}
```

## Programmierzugriff auf das Farbschema

Sie können in Ihren eigenen Skripten und Anwendungen auf das Farbschema zugreifen:

```javascript
const colorSchemaManager = require('./core/mcp/color_schema_manager');

// Aktuelles Farbschema abrufen
const schema = colorSchemaManager.getColorSchema();

// Farbschema als CSS exportieren
const css = colorSchemaManager.generateCSS(schema);

// Farbschema anwenden
colorSchemaManager.applyColorSchema(schema);
```

## Anpassung des Claude-Prompts mit Farbschema

Um sicherzustellen, dass Claude-generierte Inhalte Ihr Farbschema verwenden, fügen Sie das Farbschema als Teil des Prompts hinzu:

```javascript
const schema = colorSchemaManager.getColorSchema();

const claudePrompt = `
<instructions>
Du generierst UI-Komponenten für das Claude Neural Framework.
Verwende IMMER das folgende Farbschema:

- Primary: ${schema.colors.primary}
- Secondary: ${schema.colors.secondary}
- Accent: ${schema.colors.accent}
- Background: ${schema.colors.background}
- Text: ${schema.colors.text}

Alle generierten CSS-, HTML- und JavaScript-Inhalte müssen dieses Farbschema verwenden.
</instructions>

${userPrompt}
`;
```

## Technische Details

Das Farbschema-System basiert auf CSS-Variablen und kann in verschiedenen Formaten exportiert werden:

- **CSS**: Für Webkomponenten und Dashboards
- **SCSS**: Für SCSS/Sass-basierte Projekte
- **JavaScript**: Für programmatischen Zugriff

Die CSS-Variablen sind so konzipiert, dass sie mit gängigen CSS-Frameworks wie Bootstrap, Tailwind CSS und Material Design kompatibel sind.

## Best Practices

- **Konsistenz**: Verwenden Sie dasselbe Farbschema für alle Komponenten und generierten Inhalte
- **Accessibility**: Achten Sie auf ausreichenden Kontrast zwischen Text- und Hintergrundfarben
- **Themen-basiert**: Beginnen Sie mit einem vordefinierten Thema und passen Sie es dann an, anstatt von Grund auf zu beginnen
- **Dokumentation**: Dokumentieren Sie Ihr Farbschema für andere Entwickler

## Fehlerbehebung

Wenn Probleme mit dem Farbschema auftreten:

1. Überprüfen Sie die Datei `~/.claude/user.colorschema.json`
2. Führen Sie den interaktiven Setup-Assistenten erneut aus
3. Prüfen Sie, ob die CSS-Datei `ui/dashboard/color-schema.css` korrekt generiert wurde
4. Stellen Sie sicher, dass Ihre HTML-Dateien die CSS-Datei korrekt einbinden

## Fazit

Das Farbschema-System des Claude Neural Framework bietet eine leistungsstarke und flexible Möglichkeit, eine konsistente Benutzeroberfläche für alle generierten Inhalte zu gewährleisten. Durch die Integration mit dem `.about`-Profil und die Anpassung der Claude-Prompts können Sie sicherstellen, dass alle Komponenten und generierten Inhalte Ihrem definierten Stil entsprechen.