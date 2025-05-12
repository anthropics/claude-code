#!/bin/bash
echo "Starte Integration von: $(pwd)"
ls -l src/schema_ui/
# Integration von schema-ui-integration und src
# Dieses Skript automatisiert die Migration der Komponenten

# Farben für die Ausgabe
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Banner anzeigen
echo -e "${GREEN}"
echo "=================================================="
echo "UI-Komponenten Integration - Migrationsskript"
echo "=================================================="
echo -e "${NC}"

# Prüfen, ob das Skript im richtigen Verzeichnis ausgeführt wird
if [ ! -d "./src" ] || [ ! -d "./schema-ui-integration" ]; then
  echo -e "${RED}Fehler: Dieses Skript muss im Hauptverzeichnis des Projekts ausgeführt werden.${NC}"
  exit 1
fi

# Sicherung erstellen
echo -e "${YELLOW}Erstelle Sicherung der aktuellen Verzeichnisse...${NC}"
timestamp=$(date +%Y%m%d_%H%M%S)
mkdir -p ./backups
cp -r ./src ./backups/src_${timestamp}
cp -r ./schema-ui-integration ./backups/schema-ui-integration_${timestamp}
cp -r ./ui ./backups/ui_${timestamp}
echo -e "${GREEN}Sicherung erstellt unter ./backups/${NC}"

# Verzeichnisstruktur erstellen
echo -e "${YELLOW}Erstelle neue Verzeichnisstruktur...${NC}"
mkdir -p ./src/ui_components/dashboard
mkdir -p ./src/ui_components/design-system
mkdir -p ./src/schema_ui/adapters
mkdir -p ./src/schema_ui/components
mkdir -p ./src/schema_ui/utils
mkdir -p ./src/schema_ui/schemas
echo -e "${GREEN}Verzeichnisstruktur erstellt.${NC}"

# Schema-UI-Integration Komponenten bereits migriert
echo -e "${YELLOW}Schema-UI-Integration Komponenten bereits migriert - Überspringe Kopiervorgang${NC}"

# Dashboard-Komponenten migrieren
echo -e "${YELLOW}Migriere Dashboard-Komponenten...${NC}"
cp ./ui/dashboard/components/BentoGrid.js ./src/ui_components/dashboard/
cp ./ui/dashboard/components/AdvancedFilter.js ./src/ui_components/dashboard/
cp ./ui/dashboard/components/DynamicMetricTile.js ./src/ui_components/dashboard/
cp ./ui/dashboard/components/GradientCard.js ./src/ui_components/dashboard/

# CSS-Dateien kopieren
cp ./ui/dashboard/components/BentoGrid.css ./src/ui_components/dashboard/
cp ./ui/dashboard/components/AdvancedFilter.css ./src/ui_components/dashboard/
cp ./ui/dashboard/components/DynamicMetricTile.css ./src/ui_components/dashboard/
cp ./ui/dashboard/components/GradientCard.css ./src/ui_components/dashboard/
echo -e "${GREEN}Dashboard-Komponenten migriert.${NC}"

# Design-System migrieren
echo -e "${YELLOW}Migriere Design-System...${NC}"
cp ./ui/dashboard/design-system/colors.css ./src/ui_components/design-system/
cp ./ui/dashboard/design-system/responsive.css ./src/ui_components/design-system/
echo -e "${GREEN}Design-System migriert.${NC}"

# Adapter-Dateien erstellen
echo -e "${YELLOW}Erstelle Adapter-Dateien...${NC}"
cat > ./src/ui_components/adapters.js << 'EOF'
/**
 * Unified UI Adapter
 * ================
 * 
 * Dieser Adapter kombiniert die Funktionalitäten des Schema-UI-Adapters
 * und der bestehenden Framework-Adapter für eine einheitliche Integration.
 */

import { createFrameworkAdapter, standaloneAdapter } from '../schema_ui/adapters';
// Importieren der Kernfunktionalitäten
import logger from '../../core/logging/logger';
import * as errorHandler from '../../core/error/error_handler';
import * as configManager from '../../core/config/config_manager';
import { I18n } from '../../core/i18n/i18n';

/**
 * Der vereinheitlichte UI-Adapter, der alle Funktionalitäten kombiniert
 */
export const unifiedAdapter = createFrameworkAdapter({
  // Kernfunktionalitäten
  logger,
  errorHandler,
  config: configManager,
  i18n: new I18n(),
  
  // UI-spezifische Helfer
  ui: {
    theme: {
      getCurrentTheme: () => {
        return document.body.getAttribute('data-theme') || 'light';
      },
      setTheme: (theme) => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
      }
    },
    
    // Formatierungsfunktionen
    format: {
      number: (value, options = {}) => {
        // Nummer-Formatierungsfunktionen
        return new Intl.NumberFormat(
          options.locale || 'de-DE', 
          options
        ).format(value);
      },
      date: (value, options = {}) => {
        // Datums-Formatierungsfunktionen
        return new Intl.DateTimeFormat(
          options.locale || 'de-DE',
          options
        ).format(value instanceof Date ? value : new Date(value));
      }
    }
  }
});

/**
 * Standalone-Adapter mit minimalen Abhängigkeiten für isolierte Komponenten
 */
export const lightweightAdapter = standaloneAdapter;

export default unifiedAdapter;
EOF
echo -e "${GREEN}Adapter-Dateien erstellt.${NC}"

# Index-Datei für ui_components erstellen
echo -e "${YELLOW}Erstelle Index-Datei...${NC}"
cat > ./src/ui_components/index.js << 'EOF'
/**
 * Main UI Components Export
 * ========================
 * 
 * Diese Datei exportiert alle UI-Komponenten aus dem ui_components-Paket
 * für die einfache Wiederverwendung in der gesamten Anwendung.
 */

// Dashboard-Komponenten
export * from './dashboard/BentoGrid';
export * from './dashboard/AdvancedFilter';
export * from './dashboard/DynamicMetricTile';
export * from './dashboard/GradientCard';

// Design-System
export * from './design-system/colors';
export * from './design-system/responsive';

// Schema-UI-Integration
export * from '../schema_ui';

// Kombinierte Adapter
export * from './adapters';
EOF
echo -e "${GREEN}Index-Datei erstellt.${NC}"

# Dokumentation optional kopieren
echo -e "${YELLOW}Prüfe Dokumentation...${NC}"
mkdir -p ./docs
[ -f "./MIGRATION_GUIDE.md" ] && cp ./MIGRATION_GUIDE.md ./docs/ || echo "MIGRATION_GUIDE.md nicht gefunden"
[ -f "./INTEGRATED_UI_COMPONENTS.md" ] && cp ./INTEGRATED_UI_COMPONENTS.md ./docs/ || echo "INTEGRATED_UI_COMPONENTS.md nicht gefunden"
echo -e "${GREEN}Dokumentation geprüft.${NC}"

# Komponenten-Refactoring - Beispiel
echo -e "${YELLOW}Beginne Refactoring der Komponenten für modularen Import...${NC}"
# Dieses Skript konvertiert die globalen Klassen noch nicht automatisch zu ES-Modulen,
# sondern zeigt nur, was zu tun ist.
echo -e "${YELLOW}Hinweis: Komponenten müssen manuell für ES-Module angepasst werden.${NC}"
echo -e "${YELLOW}Siehe Dokumentation unter ./docs/MIGRATION_GUIDE.md ${NC}"

# Zusammenfassung
echo -e "${GREEN}"
echo "=================================================="
echo "Integration abgeschlossen!"
echo "=================================================="
echo -e "${NC}"
echo "Die Integration hat folgende Komponenten zusammengeführt:"
echo " - Schema-UI-Integration Komponenten -> ./src/schema_ui/"
echo " - Dashboard-Komponenten -> ./src/ui_components/dashboard/"
echo " - Design-System -> ./src/ui_components/design-system/"
echo ""
echo "Nächste Schritte:"
echo "1. Komponenten für modularen Import anpassen (siehe Dokumentation)"
echo "2. Tests ausführen, um die Integration zu validieren"
echo "3. Abhängigkeiten in package.json aktualisieren"
echo ""
echo -e "${YELLOW}Hinweis: Eine Sicherung wurde unter ./backups/ erstellt.${NC}"
echo "
